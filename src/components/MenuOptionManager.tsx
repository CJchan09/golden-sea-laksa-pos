import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { OptionChoice, OptionGroup } from '../data/app-schema';
import { fromRinggit, senToDecimalString } from '../domain/money';
import {
  getLegacyAddOnGroupId,
  getLegacySizeGroupId,
} from '../domain/menu-options';

interface MenuOptionManagerProps {
  itemId: string;
  itemName: string;
  groups: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
}

type SpecialSection = 'size' | 'addOn';

interface SpecialChoiceEditorState {
  section: SpecialSection;
  choice?: OptionChoice;
}

interface ChoiceDraft {
  nameEn: string;
  nameZh: string;
  price: string;
}

interface ChoiceErrors {
  nameEn?: string;
  nameZh?: string;
  price?: string;
}

interface GroupErrors {
  nameEn?: string;
  nameZh?: string;
  minSelect?: string;
  maxSelect?: string;
  choices?: string;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const inputClassName =
  'min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-emphasis focus:ring-2 focus:ring-emphasis/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-primary dark:focus:ring-primary/25';

function cloneGroup(group: OptionGroup): OptionGroup {
  return {
    ...group,
    names: { ...group.names },
    choices: group.choices.map((choice) => ({
      ...choice,
      names: { ...choice.names },
    })),
  };
}

function choiceToDraft(choice?: OptionChoice): ChoiceDraft {
  return {
    nameEn: choice?.names.en ?? '',
    nameZh: choice?.names.zh ?? '',
    price: choice ? senToDecimalString(choice.priceDeltaSen) : '0.00',
  };
}

function validateChoiceDraft(draft: ChoiceDraft): ChoiceErrors {
  const errors: ChoiceErrors = {};
  if (!draft.nameEn.trim()) errors.nameEn = 'Enter the English name. / 请输入英文名称。';
  if (!draft.nameZh.trim()) errors.nameZh = 'Enter the Chinese name. / 请输入中文名称。';

  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(draft.price.trim())) {
    errors.price = 'Use a valid RM amount with up to 2 decimals. / 请输入最多两位小数的金额。';
  } else {
    try {
      fromRinggit(draft.price);
    } catch {
      errors.price = 'Enter a valid price adjustment. / 请输入有效的价格差额。';
    }
  }
  return errors;
}

function draftToChoice(
  draft: ChoiceDraft,
  existing: OptionChoice | undefined,
  sortOrder: number,
): OptionChoice {
  return {
    id: existing?.id ?? uuidv4(),
    names: {
      ...existing?.names,
      en: draft.nameEn.trim(),
      zh: draft.nameZh.trim(),
    },
    priceDeltaSen: fromRinggit(draft.price),
    enabled: existing?.enabled ?? true,
    sortOrder: existing?.sortOrder ?? sortOrder,
  };
}

function formatChoicePrice(priceDeltaSen: number): string {
  if (priceDeltaSen === 0) return 'RM 0.00';
  const sign = priceDeltaSen > 0 ? '+' : '-';
  return `${sign}RM ${senToDecimalString(Math.abs(priceDeltaSen))}`;
}

function displayNames(names: OptionGroup['names'] | OptionChoice['names']): string {
  const en = names.en?.trim();
  const zh = names.zh?.trim();
  if (en && zh) return `${en} / ${zh}`;
  return en || zh || 'Unnamed / 未命名';
}

function nextSortOrder(groups: OptionGroup[]): number {
  return groups.reduce((highest, group) => Math.max(highest, group.sortOrder), -1) + 1;
}

interface ResponsiveDialogProps {
  title: string;
  description: string;
  onClose: () => void;
  onBack?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  footer: React.ReactNode;
}

function ResponsiveDialog({
  title,
  description,
  onClose,
  onBack,
  initialFocusRef,
  children,
  footer,
}: ResponsiveDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onCloseRef.current = onClose;
    onBackRef.current = onBack;
  }, [onBack, onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const requestedFocus = initialFocusRef?.current;
      if (requestedFocus) {
        requestedFocus.focus();
        return;
      }
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (onBackRef.current) onBackRef.current();
        else onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const candidates = dialogRef.current.querySelectorAll(focusableSelector) as NodeListOf<HTMLElement>;
      const focusable: HTMLElement[] = Array.from(candidates)
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
    // Keep the original trigger for focus restoration. Screen changes inside
    // the same dialog manage their own initial focus without remounting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-gray-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back / 返回"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-lg font-extrabold leading-6 text-gray-950 dark:text-white">
              {title}
            </h3>
            <p id={descriptionId} className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-300">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor / 关闭编辑器"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </div>

        <footer className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:pb-4">
          {footer}
        </footer>
      </div>
    </div>
  );
}

interface ChoiceFieldsProps {
  draft: ChoiceDraft;
  errors: ChoiceErrors;
  nameEnRef: React.RefObject<HTMLInputElement | null>;
  onChange: (draft: ChoiceDraft) => void;
}

function ChoiceFields({ draft, errors, nameEnRef, onChange }: ChoiceFieldsProps) {
  const nameEnId = useId();
  const nameZhId = useId();
  const priceId = useId();

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={nameEnId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
          Name (EN) / 英文名称 <span aria-hidden="true" className="text-red-600">*</span>
        </label>
        <input
          ref={nameEnRef}
          id={nameEnId}
          type="text"
          autoComplete="off"
          value={draft.nameEn}
          onChange={(event) => onChange({ ...draft, nameEn: event.target.value })}
          aria-invalid={Boolean(errors.nameEn)}
          aria-describedby={errors.nameEn ? `${nameEnId}-error` : undefined}
          className={inputClassName}
        />
        {errors.nameEn && (
          <p id={`${nameEnId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
            {errors.nameEn}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={nameZhId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
          Name (ZH) / 中文名称 <span aria-hidden="true" className="text-red-600">*</span>
        </label>
        <input
          id={nameZhId}
          type="text"
          autoComplete="off"
          value={draft.nameZh}
          onChange={(event) => onChange({ ...draft, nameZh: event.target.value })}
          aria-invalid={Boolean(errors.nameZh)}
          aria-describedby={errors.nameZh ? `${nameZhId}-error` : undefined}
          className={inputClassName}
        />
        {errors.nameZh && (
          <p id={`${nameZhId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
            {errors.nameZh}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={priceId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
          Price adjustment (RM) / 价格差额
        </label>
        <input
          id={priceId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft.price}
          onChange={(event) => onChange({ ...draft, price: event.target.value })}
          aria-invalid={Boolean(errors.price)}
          aria-describedby={`${priceId}-help${errors.price ? ` ${priceId}-error` : ''}`}
          className={`${inputClassName} tabular-nums`}
        />
        <p id={`${priceId}-help`} className="mt-2 text-sm leading-5 text-gray-600 dark:text-zinc-300">
          Use 0 for no change; a negative value lowers the price. / 不加价填 0，负数代表减价。
        </p>
        {errors.price && (
          <p id={`${priceId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
            {errors.price}
          </p>
        )}
      </div>
    </div>
  );
}

interface SpecialChoiceDialogProps {
  section: SpecialSection;
  choice?: OptionChoice;
  onClose: () => void;
  onDone: (choice: OptionChoice) => void;
  onDelete?: () => void;
  nextChoiceSortOrder: number;
}

function SpecialChoiceDialog({
  section,
  choice,
  onClose,
  onDone,
  onDelete,
  nextChoiceSortOrder,
}: SpecialChoiceDialogProps) {
  const [draft, setDraft] = useState(() => choiceToDraft(choice));
  const [errors, setErrors] = useState<ChoiceErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameEnRef = useRef<HTMLInputElement>(null);
  const sectionLabel = section === 'size' ? 'size / 大小份' : 'add-on / 加料';

  const handleDone = () => {
    const nextErrors = validateChoiceDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      nameEnRef.current?.focus();
      return;
    }
    onDone(draftToChoice(draft, choice, nextChoiceSortOrder));
  };

  return (
    <ResponsiveDialog
      title={`${choice ? 'Edit' : 'Add'} ${sectionLabel}`}
      description="Use full-width fields so both language names stay readable. / 使用大输入框完整填写双语名称。"
      onClose={onClose}
      initialFocusRef={nameEnRef}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {onDelete && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 sm:w-auto"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete / 删除
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
            >
              Cancel / 取消
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
            >
              Done / 完成
            </button>
          </div>
        </div>
      )}
    >
      <ChoiceFields draft={draft} errors={errors} nameEnRef={nameEnRef} onChange={setDraft} />

      {confirmDelete && onDelete && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-bold text-red-900 dark:text-red-100">Delete this option? / 删除这个选项？</p>
          <p className="mt-1 text-sm leading-5 text-red-800 dark:text-red-200">
            It will be removed from this menu item draft. / 它会从这个商品草稿中移除。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
            >
              Keep / 保留
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
            >
              Delete / 删除
            </button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}

interface OptionGroupDialogProps {
  group?: OptionGroup;
  nextGroupSortOrder: number;
  onClose: () => void;
  onDone: (group: OptionGroup) => void;
  onDelete?: () => void;
}

function OptionGroupDialog({
  group,
  nextGroupSortOrder,
  onClose,
  onDone,
  onDelete,
}: OptionGroupDialogProps) {
  const [draft, setDraft] = useState<OptionGroup>(() => group
    ? cloneGroup(group)
    : {
      id: uuidv4(),
      names: { en: '', zh: '' },
      required: true,
      minSelect: 1,
      maxSelect: 1,
      choices: [],
      sortOrder: nextGroupSortOrder,
    });
  const [screen, setScreen] = useState<'group' | 'choice'>('group');
  const [editingChoice, setEditingChoice] = useState<OptionChoice | undefined>();
  const [choiceDraft, setChoiceDraft] = useState<ChoiceDraft>(() => choiceToDraft());
  const [groupErrors, setGroupErrors] = useState<GroupErrors>({});
  const [choiceErrors, setChoiceErrors] = useState<ChoiceErrors>({});
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [confirmDeleteChoice, setConfirmDeleteChoice] = useState(false);
  const groupNameRef = useRef<HTMLInputElement>(null);
  const choiceNameRef = useRef<HTMLInputElement>(null);
  const groupNameEnId = useId();
  const groupNameZhId = useId();
  const minSelectId = useId();
  const maxSelectId = useId();
  const isSingle = draft.maxSelect === 1;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (screen === 'choice') choiceNameRef.current?.focus();
      else groupNameRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen]);

  const openChoiceEditor = (choice?: OptionChoice) => {
    setEditingChoice(choice);
    setChoiceDraft(choiceToDraft(choice));
    setChoiceErrors({});
    setConfirmDeleteChoice(false);
    setScreen('choice');
  };

  const closeChoiceEditor = () => {
    setScreen('group');
    setEditingChoice(undefined);
    setChoiceErrors({});
    setConfirmDeleteChoice(false);
  };

  const handleChoiceDone = () => {
    const nextErrors = validateChoiceDraft(choiceDraft);
    setChoiceErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      choiceNameRef.current?.focus();
      return;
    }

    const nextChoice = draftToChoice(choiceDraft, editingChoice, draft.choices.length);
    const nextChoices = editingChoice
      ? draft.choices.map((candidate) => candidate.id === editingChoice.id ? nextChoice : candidate)
      : [...draft.choices, nextChoice];
    setDraft((current) => ({ ...current, choices: nextChoices }));
    closeChoiceEditor();
  };

  const handleChoiceDelete = () => {
    if (!editingChoice) return;
    setDraft((current) => ({
      ...current,
      choices: current.choices.filter((choice) => choice.id !== editingChoice.id),
    }));
    closeChoiceEditor();
  };

  const setSelectionMode = (mode: 'single' | 'multiple') => {
    if (mode === 'single') {
      setDraft((current) => ({
        ...current,
        minSelect: current.required ? 1 : 0,
        maxSelect: 1,
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      minSelect: current.required ? Math.max(1, current.minSelect) : Math.max(0, current.minSelect),
      maxSelect: Math.max(2, current.maxSelect),
    }));
  };

  const setRequired = (required: boolean) => {
    setDraft((current) => ({
      ...current,
      required,
      minSelect: required ? Math.max(1, current.minSelect) : 0,
    }));
  };

  const validateGroup = (): GroupErrors => {
    const errors: GroupErrors = {};
    const enabledChoiceCount = draft.choices.filter((choice) => choice.enabled).length;
    if (!draft.names.en?.trim()) errors.nameEn = 'Enter the English group name. / 请输入英文组名。';
    if (!draft.names.zh?.trim()) errors.nameZh = 'Enter the Chinese group name. / 请输入中文组名。';
    if (draft.minSelect < 0) errors.minSelect = 'Minimum cannot be below 0. / 最少数量不能小于 0。';
    if (draft.required && draft.minSelect < 1) errors.minSelect = 'A required group must select at least 1. / 必选组至少要选 1 项。';
    if (draft.maxSelect < 1) errors.maxSelect = 'Maximum must be at least 1. / 最多数量至少为 1。';
    if (draft.minSelect > draft.maxSelect) errors.maxSelect = 'Maximum must be at least the minimum. / 最多数量不能小于最少数量。';
    if (enabledChoiceCount === 0) errors.choices = 'Add at least one option. / 请至少新增一个选项。';
    else if (draft.maxSelect > enabledChoiceCount) {
      errors.maxSelect = `Maximum cannot exceed ${enabledChoiceCount} enabled option${enabledChoiceCount === 1 ? '' : 's'}. / 最多数量不能超过可用选项数。`;
    }
    return errors;
  };

  const handleGroupDone = () => {
    const nextErrors = validateGroup();
    setGroupErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.nameEn) groupNameRef.current?.focus();
      return;
    }
    onDone({
      ...draft,
      names: {
        ...draft.names,
        en: draft.names.en?.trim(),
        zh: draft.names.zh?.trim(),
      },
    });
  };

  const groupFooter = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {onDelete && !confirmDeleteGroup && (
          <button
            type="button"
            onClick={() => setConfirmDeleteGroup(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 sm:w-auto"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete group / 删除组
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
        >
          Cancel / 取消
        </button>
        <button
          type="button"
          onClick={handleGroupDone}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
        >
          Done / 完成
        </button>
      </div>
    </div>
  );

  const choiceFooter = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {editingChoice && !confirmDeleteChoice && (
          <button
            type="button"
            onClick={() => setConfirmDeleteChoice(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 sm:w-auto"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete / 删除
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <button
          type="button"
          onClick={closeChoiceEditor}
          className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
        >
          Cancel / 取消
        </button>
        <button
          type="button"
          onClick={handleChoiceDone}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
        >
          Done / 完成
        </button>
      </div>
    </div>
  );

  return (
    <ResponsiveDialog
      title={screen === 'group'
        ? `${group ? 'Edit' : 'Add'} option group / ${group ? '编辑' : '新增'}种类选项`
        : `${editingChoice ? 'Edit' : 'Add'} option / ${editingChoice ? '编辑' : '新增'}可选内容`}
      description={screen === 'group'
        ? 'Create choices such as rice type, protein or cooking style. / 可建立饭类、肉类或烹调方式等选择。'
        : `Editing inside ${displayNames(draft.names)}. / 正在编辑 ${displayNames(draft.names)}。`}
      onClose={onClose}
      onBack={screen === 'choice' ? closeChoiceEditor : undefined}
      initialFocusRef={screen === 'group' ? groupNameRef : choiceNameRef}
      footer={screen === 'group' ? groupFooter : choiceFooter}
    >
      {screen === 'group' ? (
        <div className="space-y-6">
          <div>
            <label htmlFor={groupNameEnId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
              Group name (EN) / 英文组名 <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              ref={groupNameRef}
              id={groupNameEnId}
              type="text"
              autoComplete="off"
              value={draft.names.en ?? ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                names: { ...current.names, en: event.target.value },
              }))}
              aria-invalid={Boolean(groupErrors.nameEn)}
              aria-describedby={groupErrors.nameEn ? `${groupNameEnId}-error` : undefined}
              className={inputClassName}
            />
            {groupErrors.nameEn && (
              <p id={`${groupNameEnId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                {groupErrors.nameEn}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={groupNameZhId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
              Group name (ZH) / 中文组名 <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              id={groupNameZhId}
              type="text"
              autoComplete="off"
              value={draft.names.zh ?? ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                names: { ...current.names, zh: event.target.value },
              }))}
              aria-invalid={Boolean(groupErrors.nameZh)}
              aria-describedby={groupErrors.nameZh ? `${groupNameZhId}-error` : undefined}
              className={inputClassName}
            />
            {groupErrors.nameZh && (
              <p id={`${groupNameZhId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                {groupErrors.nameZh}
              </p>
            )}
          </div>

          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
            <span>
              <span className="block font-bold text-gray-900 dark:text-white">Required / 必选</span>
              <span className="mt-1 block text-sm leading-5 text-gray-600 dark:text-zinc-300">
                Customers must complete this group. / 顾客必须完成这一组选项。
              </span>
            </span>
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(event) => setRequired(event.target.checked)}
              className="h-6 w-6 shrink-0 accent-primary"
            />
          </label>

          <fieldset>
            <legend className="mb-3 text-sm font-bold text-gray-800 dark:text-zinc-200">
              Selection rule / 选择方式
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${
                isSingle
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-950'
              }`}>
                <input
                  type="radio"
                  name={`selection-mode-${draft.id}`}
                  checked={isSingle}
                  onChange={() => setSelectionMode('single')}
                  className="mt-0.5 h-5 w-5 accent-primary"
                />
                <span>
                  <span className="block font-bold text-gray-900 dark:text-white">Choose one / 单选</span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-zinc-300">Example: chicken or beef / 例如鸡肉或牛肉</span>
                </span>
              </label>
              <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${
                !isSingle
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-950'
              }`}>
                <input
                  type="radio"
                  name={`selection-mode-${draft.id}`}
                  checked={!isSingle}
                  onChange={() => setSelectionMode('multiple')}
                  className="mt-0.5 h-5 w-5 accent-primary"
                />
                <span>
                  <span className="block font-bold text-gray-900 dark:text-white">Choose multiple / 多选</span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-zinc-300">Example: mixed noodles / 例如混合面类</span>
                </span>
              </label>
            </div>
          </fieldset>

          {!isSingle && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={minSelectId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
                  Minimum / 最少选择
                </label>
                <input
                  id={minSelectId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={draft.minSelect}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    minSelect: Number.parseInt(event.target.value, 10) || 0,
                  }))}
                  aria-invalid={Boolean(groupErrors.minSelect)}
                  aria-describedby={groupErrors.minSelect ? `${minSelectId}-error` : undefined}
                  className={`${inputClassName} tabular-nums`}
                />
                {groupErrors.minSelect && (
                  <p id={`${minSelectId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    {groupErrors.minSelect}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={maxSelectId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
                  Maximum / 最多选择
                </label>
                <input
                  id={maxSelectId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={draft.maxSelect}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    maxSelect: Number.parseInt(event.target.value, 10) || 0,
                  }))}
                  aria-invalid={Boolean(groupErrors.maxSelect)}
                  aria-describedby={groupErrors.maxSelect ? `${maxSelectId}-error` : undefined}
                  className={`${inputClassName} tabular-nums`}
                />
                {groupErrors.maxSelect && (
                  <p id={`${maxSelectId}-error`} role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    {groupErrors.maxSelect}
                  </p>
                )}
              </div>
            </div>
          )}

          <section aria-labelledby={`${groupNameEnId}-choices`} className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 id={`${groupNameEnId}-choices`} className="font-extrabold text-gray-950 dark:text-white">
                  Options / 可选内容
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
                  Each option can have its own price. / 每个选项都可以有不同价格。
                </p>
              </div>
              <button
                type="button"
                onClick={() => openChoiceEditor()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis sm:w-auto"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add option / 新增选项
              </button>
            </div>

            {groupErrors.choices && (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {groupErrors.choices}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {draft.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => openChoiceEditor(choice)}
                  className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-primary/60 dark:focus-visible:ring-primary"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-bold text-gray-900 dark:text-white">
                      {displayNames(choice.names)}
                    </span>
                    <span className="mt-1 block text-sm tabular-nums text-gray-600 dark:text-zinc-300">
                      {formatChoicePrice(choice.priceDeltaSen)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
                    Edit / 编辑
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </button>
              ))}
              {draft.choices.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-600 dark:bg-zinc-950 dark:text-zinc-300">
                  No options yet. / 还没有可选内容。
                </p>
              )}
            </div>
          </section>

          {confirmDeleteGroup && onDelete && (
            <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <p className="font-bold text-red-900 dark:text-red-100">Delete this group? / 删除这个种类组？</p>
              <p className="mt-1 text-sm leading-5 text-red-800 dark:text-red-200">
                The group and all of its options will be removed from this item draft. / 此组和里面的选项会从商品草稿中移除。
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGroup(false)}
                  className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
                >
                  Keep / 保留
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                >
                  Delete / 删除
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <ChoiceFields
            draft={choiceDraft}
            errors={choiceErrors}
            nameEnRef={choiceNameRef}
            onChange={setChoiceDraft}
          />

          {confirmDeleteChoice && editingChoice && (
            <div role="alert" className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <p className="font-bold text-red-900 dark:text-red-100">Delete this option? / 删除这个选项？</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteChoice(false)}
                  className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
                >
                  Keep / 保留
                </button>
                <button
                  type="button"
                  onClick={handleChoiceDelete}
                  className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                >
                  Delete / 删除
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}

interface SummaryCardProps {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}

function SummaryCard({ title, description, addLabel, onAdd, children }: SummaryCardProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row">
        <div className="min-w-0">
          <h4 className="break-words font-extrabold text-gray-950 dark:text-white">{title}</h4>
          <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-300">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis xl:w-full 2xl:w-auto"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

interface ChoiceSummaryButtonProps {
  choice: OptionChoice;
  onClick: () => void;
}

function ChoiceSummaryButton({ choice, onClick }: ChoiceSummaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary/60 dark:focus-visible:ring-primary"
    >
      <span className="min-w-0">
        <span className="block break-words font-bold text-gray-900 dark:text-white">
          {displayNames(choice.names)}
        </span>
        <span className="mt-1 block text-sm tabular-nums text-gray-600 dark:text-zinc-300">
          {formatChoicePrice(choice.priceDeltaSen)}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
        <Pencil aria-hidden="true" className="h-4 w-4" />
        <span className="hidden 2xl:inline">Edit / 编辑</span>
      </span>
    </button>
  );
}

function EmptySummary({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-4 text-center text-sm leading-5 text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      {text}
    </p>
  );
}

export default function MenuOptionManager({
  itemId,
  itemName,
  groups,
  onChange,
}: MenuOptionManagerProps) {
  const sizeGroupId = getLegacySizeGroupId(itemId);
  const addOnGroupId = getLegacyAddOnGroupId(itemId);
  const sizeGroup = groups.find((group) => group.id === sizeGroupId);
  const addOnGroup = groups.find((group) => group.id === addOnGroupId);
  const customGroups = useMemo(() => groups
    .filter((group) => group.id !== sizeGroupId && group.id !== addOnGroupId)
    .sort((a, b) => a.sortOrder - b.sortOrder), [addOnGroupId, groups, sizeGroupId]);
  const [specialEditor, setSpecialEditor] = useState<SpecialChoiceEditorState | null>(null);
  const [groupEditor, setGroupEditor] = useState<OptionGroup | 'new' | null>(null);

  const updateGroups = (nextGroups: OptionGroup[]) => {
    onChange(nextGroups.map((group, index) => ({
      ...cloneGroup(group),
      sortOrder: index,
    })));
  };

  const upsertGroup = (nextGroup: OptionGroup) => {
    const exists = groups.some((group) => group.id === nextGroup.id);
    updateGroups(exists
      ? groups.map((group) => group.id === nextGroup.id ? cloneGroup(nextGroup) : cloneGroup(group))
      : [...groups.map(cloneGroup), cloneGroup(nextGroup)]);
  };

  const removeGroup = (groupId: string) => {
    updateGroups(groups.filter((group) => group.id !== groupId));
  };

  const specialGroupFor = (section: SpecialSection): OptionGroup | undefined => (
    section === 'size' ? sizeGroup : addOnGroup
  );

  const specialGroupIdFor = (section: SpecialSection): string => (
    section === 'size' ? sizeGroupId : addOnGroupId
  );

  const createSpecialGroup = (section: SpecialSection): OptionGroup => ({
    id: specialGroupIdFor(section),
    names: section === 'size'
      ? { en: 'Size', zh: '大小份' }
      : { en: 'Add-ons', zh: '加料' },
    required: section === 'size',
    minSelect: section === 'size' ? 1 : 0,
    maxSelect: 1,
    choices: [],
    sortOrder: section === 'size' ? 0 : nextSortOrder(groups),
  });

  const saveSpecialChoice = (section: SpecialSection, choice: OptionChoice) => {
    const currentGroup = specialGroupFor(section) ?? createSpecialGroup(section);
    const exists = currentGroup.choices.some((candidate) => candidate.id === choice.id);
    const nextChoices = exists
      ? currentGroup.choices.map((candidate) => candidate.id === choice.id ? choice : candidate)
      : [...currentGroup.choices, choice];
    upsertGroup({
      ...currentGroup,
      choices: nextChoices,
      required: section === 'size',
      minSelect: section === 'size' ? 1 : 0,
      maxSelect: section === 'size' ? 1 : Math.max(1, nextChoices.filter((candidate) => candidate.enabled).length),
    });
    setSpecialEditor(null);
  };

  const deleteSpecialChoice = (section: SpecialSection, choiceId: string) => {
    const currentGroup = specialGroupFor(section);
    if (!currentGroup) return;
    const nextChoices = currentGroup.choices.filter((choice) => choice.id !== choiceId);
    if (nextChoices.length === 0) {
      removeGroup(currentGroup.id);
    } else {
      upsertGroup({
        ...currentGroup,
        choices: nextChoices,
        maxSelect: section === 'size' ? 1 : Math.max(1, nextChoices.filter((choice) => choice.enabled).length),
      });
    }
    setSpecialEditor(null);
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-base font-extrabold text-gray-950 dark:text-white">Item choices / 商品选项</h4>
        <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-300">
          Tap a row to edit the full name and price in a larger box. “Done” changes this draft only; use Save settings to keep it. / 点选一行即可在大弹窗编辑完整名称与价格；“完成”只修改草稿，最后仍要保存设置。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SummaryCard
          title="Sizes / 大小份"
          description="Serving sizes for this item. / 此商品的份量大小。"
          addLabel="Add size / 新增大小"
          onAdd={() => setSpecialEditor({ section: 'size' })}
        >
          {sizeGroup?.choices.map((choice) => (
            <div key={choice.id}>
              <ChoiceSummaryButton
                choice={choice}
                onClick={() => setSpecialEditor({ section: 'size', choice })}
              />
            </div>
          ))}
          {!sizeGroup?.choices.length && <EmptySummary text="No sizes. / 还没有大小份。" />}
        </SummaryCard>

        <SummaryCard
          title="Option Groups / 种类选项"
          description="Add rice, protein, noodle or other groups. / 可加饭类、肉类、面类等多个组。"
          addLabel="Add group / 新增种类"
          onAdd={() => setGroupEditor('new')}
        >
          {customGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setGroupEditor(group)}
              className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary/60 dark:focus-visible:ring-primary"
            >
              <span className="min-w-0">
                <span className="block break-words font-bold text-gray-900 dark:text-white">
                  {displayNames(group.names)}
                </span>
                <span className="mt-1 block break-words text-sm leading-5 text-gray-600 dark:text-zinc-300">
                  {group.required ? 'Required / 必选' : 'Optional / 可选'} · {group.maxSelect === 1
                    ? 'Choose 1 / 单选'
                    : `${group.minSelect}–${group.maxSelect} selections / 可选 ${group.minSelect}–${group.maxSelect} 项`} · {group.choices.length} options / 选项
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
                <Pencil aria-hidden="true" className="h-4 w-4" />
                <span className="hidden 2xl:inline">Edit / 编辑</span>
              </span>
            </button>
          ))}
          {customGroups.length === 0 && (
            <EmptySummary text="No type groups yet. Add rice, protein or another choice. / 还没有种类组，可新增饭类、肉类等选择。" />
          )}
        </SummaryCard>

        <SummaryCard
          title="Add-ons / 加料"
          description="Optional extras with their own prices. / 可另外加价的附加项目。"
          addLabel="Add add-on / 新增加料"
          onAdd={() => setSpecialEditor({ section: 'addOn' })}
        >
          {addOnGroup?.choices.map((choice) => (
            <div key={choice.id}>
              <ChoiceSummaryButton
                choice={choice}
                onClick={() => setSpecialEditor({ section: 'addOn', choice })}
              />
            </div>
          ))}
          {!addOnGroup?.choices.length && <EmptySummary text="No add-ons. / 还没有加料。" />}
        </SummaryCard>
      </div>

      {specialEditor && (
        <SpecialChoiceDialog
          section={specialEditor.section}
          choice={specialEditor.choice}
          onClose={() => setSpecialEditor(null)}
          onDone={(choice) => saveSpecialChoice(specialEditor.section, choice)}
          onDelete={specialEditor.choice
            ? () => deleteSpecialChoice(specialEditor.section, specialEditor.choice!.id)
            : undefined}
          nextChoiceSortOrder={specialGroupFor(specialEditor.section)?.choices.length ?? 0}
        />
      )}

      {groupEditor && (
        <OptionGroupDialog
          group={groupEditor === 'new' ? undefined : groupEditor}
          nextGroupSortOrder={nextSortOrder(groups)}
          onClose={() => setGroupEditor(null)}
          onDone={(group) => {
            upsertGroup(group);
            setGroupEditor(null);
          }}
          onDelete={groupEditor === 'new'
            ? undefined
            : () => {
              removeGroup(groupEditor.id);
              setGroupEditor(null);
            }}
        />
      )}

      <span className="sr-only" aria-live="polite">
        Editing options for {itemName}
      </span>
    </div>
  );
}
