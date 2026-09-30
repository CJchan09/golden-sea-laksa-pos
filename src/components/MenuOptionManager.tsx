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
import { useStore } from '../store';
import { tr, localized } from '../i18n';
import type { Language } from '../types';
import { LocalizedNameEditor } from './LanguageSelector';
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
  nameMs: string;
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
    nameMs: choice?.names.ms ?? '',
    price: choice ? senToDecimalString(choice.priceDeltaSen) : '0.00',
  };
}

function validateChoiceDraft(draft: ChoiceDraft, language: Language): ChoiceErrors {
  const errors: ChoiceErrors = {};
  if (![draft.nameEn, draft.nameZh, draft.nameMs].some(name => name.trim())) errors.nameEn = tr(language, 'Enter a name in at least one language.', '请至少填写一种语言的名称。', 'Masukkan nama dalam sekurang-kurangnya satu bahasa.');

  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(draft.price.trim())) {
    errors.price = tr(language, "Use a valid RM amount with up to 2 decimals.", "请输入最多两位小数的金额。", "Masukkan amaun RM yang sah dengan sehingga 2 tempat perpuluhan.");
  } else {
    try {
      fromRinggit(draft.price);
    } catch {
      errors.price = tr(language, "Enter a valid price adjustment.", "请输入有效的价格差额。", "Masukkan pelarasan harga yang sah.");
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
      ms: draft.nameMs.trim(),
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

function displayNames(names: OptionGroup['names'] | OptionChoice['names'], language: Language): string {
  return localized(names, language) || tr(language, 'Unnamed', '未命名', 'Tanpa nama');
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
  const { language } = useStore();
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
              aria-label={tr(language, "Back", "返回", "Kembali")}
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
            aria-label={tr(language, "Close editor", "关闭编辑器", "Tutup editor")}
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
  const { language } = useStore();
  const nameEnId = useId();
  const nameZhId = useId();
  const priceId = useId();

  return (
    <div className="space-y-5">
      <LocalizedNameEditor language={language} label={tr(language, 'Option name', '选项名称', 'Nama pilihan')}
        value={{ en: draft.nameEn, zh: draft.nameZh, ms: draft.nameMs }}
        onChange={names => onChange({ ...draft, nameEn: names.en ?? '', nameZh: names.zh ?? '', nameMs: names.ms ?? '' })}
        error={errors.nameEn} inputRef={nameEnRef} />

      <div>
        <label htmlFor={priceId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
          {tr(language, "Price adjustment (RM)", "价格差额 (RM)", "Pelarasan harga (RM)")}
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
          {tr(language, "Use 0 for no change; a negative value lowers the price.", "不加价填 0，负数代表减价。", "Masukkan 0 jika tiada perubahan; nilai negatif mengurangkan harga.")}
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
  const { language } = useStore();
  const [draft, setDraft] = useState(() => choiceToDraft(choice));
  const [errors, setErrors] = useState<ChoiceErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameEnRef = useRef<HTMLInputElement>(null);
  const sectionLabel = section === 'size' ? tr(language, "size", "份量", "saiz") : tr(language, "add-on", "加料", "tambahan");

  const handleDone = () => {
    const nextErrors = validateChoiceDraft(draft, language);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      nameEnRef.current?.focus();
      return;
    }
    onDone(draftToChoice(draft, choice, nextChoiceSortOrder));
  };

  return (
    <ResponsiveDialog
      title={`${choice ? tr(language, 'Edit', '编辑', 'Sunting') : tr(language, 'Add', '新增', 'Tambah')} ${sectionLabel}`}
      description={tr(language, "Enter a name and price. Translations are optional.", "填写名称和价格，其他语言可选。", "Masukkan nama dan harga. Terjemahan adalah pilihan.")}
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
                {tr(language, "Delete", "删除", "Padam")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
            >
              {tr(language, "Cancel", "取消", "Batal")}
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
            >
              {tr(language, "Done", "完成", "Selesai")}
            </button>
          </div>
        </div>
      )}
    >
      <ChoiceFields draft={draft} errors={errors} nameEnRef={nameEnRef} onChange={setDraft} />

      {confirmDelete && onDelete && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-bold text-red-900 dark:text-red-100">{tr(language, "Delete this option?", "删除这个选项？", "Padam pilihan ini?")}</p>
          <p className="mt-1 text-sm leading-5 text-red-800 dark:text-red-200">
            {tr(language, "It will be removed from this item draft.", "它会从这个商品草稿中移除。", "Pilihan akan dipadam daripada draf item ini.")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
            >
              {tr(language, "Keep", "保留", "Kekalkan")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
            >
              {tr(language, "Delete", "删除", "Padam")}
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
  const { language } = useStore();
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
    const nextErrors = validateChoiceDraft(choiceDraft, language);
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
    if (!localized(draft.names, language)) errors.nameEn = tr(language, 'Enter a group name in at least one language.', '请至少填写一种语言的组名。', 'Masukkan nama kumpulan dalam sekurang-kurangnya satu bahasa.');
    if (draft.minSelect < 0) errors.minSelect = tr(language, "Minimum cannot be below 0.", "最少数量不能小于 0。", "Minimum tidak boleh kurang daripada 0.");
    if (draft.required && draft.minSelect < 1) errors.minSelect = tr(language, "A required group must select at least 1.", "必选组至少要选 1 项。", "Kumpulan wajib mesti memilih sekurang-kurangnya 1.");
    if (draft.maxSelect < 1) errors.maxSelect = tr(language, "Maximum must be at least 1.", "最多数量至少为 1。", "Maksimum mestilah sekurang-kurangnya 1.");
    if (draft.minSelect > draft.maxSelect) errors.maxSelect = tr(language, "Maximum must be at least the minimum.", "最多数量不能小于最少数量。", "Maksimum tidak boleh kurang daripada minimum.");
    if (enabledChoiceCount === 0) errors.choices = tr(language, "Add at least one option.", "请至少新增一个选项。", "Tambah sekurang-kurangnya satu pilihan.");
    else if (draft.maxSelect > enabledChoiceCount) {
      errors.maxSelect = tr(language, `Maximum cannot exceed ${enabledChoiceCount} enabled options.`, `最多数量不能超过 ${enabledChoiceCount} 个可用选项。`, `Maksimum tidak boleh melebihi ${enabledChoiceCount} pilihan aktif.`);
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
        ms: draft.names.ms?.trim(),
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
            {tr(language, "Delete group", "删除组", "Padam kumpulan")}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
        >
          {tr(language, "Cancel", "取消", "Batal")}
        </button>
        <button
          type="button"
          onClick={handleGroupDone}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
        >
          {tr(language, "Done", "完成", "Selesai")}
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
            {tr(language, "Delete", "删除", "Padam")}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <button
          type="button"
          onClick={closeChoiceEditor}
          className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-primary"
        >
          {tr(language, "Cancel", "取消", "Batal")}
        </button>
        <button
          type="button"
          onClick={handleChoiceDone}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis focus-visible:ring-offset-2 dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-900"
        >
          {tr(language, "Done", "完成", "Selesai")}
        </button>
      </div>
    </div>
  );

  return (
    <ResponsiveDialog
      title={screen === 'group'
        ? (group ? tr(language, 'Edit option group', '编辑种类选项', 'Sunting kumpulan pilihan') : tr(language, 'Add option group', '新增种类选项', 'Tambah kumpulan pilihan'))
        : (editingChoice ? tr(language, 'Edit option', '编辑选项', 'Sunting pilihan') : tr(language, 'Add option', '新增选项', 'Tambah pilihan'))}
      description={screen === 'group'
        ? tr(language, "Create choices such as rice type, protein or cooking style.", "可建立饭类、肉类或烹调方式等选择。", "Cipta pilihan seperti jenis nasi, protein atau cara masakan.")
        : tr(language, `Editing ${displayNames(draft.names, language)}`, `正在编辑 ${displayNames(draft.names, language)}`, `Menyunting ${displayNames(draft.names, language)}`)}
      onClose={onClose}
      onBack={screen === 'choice' ? closeChoiceEditor : undefined}
      initialFocusRef={screen === 'group' ? groupNameRef : choiceNameRef}
      footer={screen === 'group' ? groupFooter : choiceFooter}
    >
      {screen === 'group' ? (
        <div className="space-y-6">
          <LocalizedNameEditor language={language} label={tr(language, 'Group name', '选项组名称', 'Nama kumpulan')}
            value={draft.names} onChange={names => setDraft(current => ({ ...current, names }))}
            error={groupErrors.nameEn} inputRef={groupNameRef} />

          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
            <span>
              <span className="block font-bold text-gray-900 dark:text-white">{tr(language, "Required", "必选", "Wajib")}</span>
              <span className="mt-1 block text-sm leading-5 text-gray-600 dark:text-zinc-300">
                {tr(language, "Customers must complete this group.", "顾客必须完成这一组选项。", "Pelanggan mesti melengkapkan kumpulan ini.")}
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
              {tr(language, "Selection rule", "选择方式", "Peraturan pilihan")}
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
                  <span className="block font-bold text-gray-900 dark:text-white">{tr(language, "Choose one", "单选", "Pilih satu")}</span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-zinc-300">{tr(language, "Example: chicken or beef", "例如鸡肉或牛肉", "Contoh: ayam atau daging lembu")}</span>
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
                  <span className="block font-bold text-gray-900 dark:text-white">{tr(language, "Choose multiple", "多选", "Pilih beberapa")}</span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-zinc-300">{tr(language, "Example: mixed noodles", "例如混合面类", "Contoh: mi campur")}</span>
                </span>
              </label>
            </div>
          </fieldset>

          {!isSingle && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={minSelectId} className="mb-2 block text-sm font-bold text-gray-800 dark:text-zinc-200">
                  {tr(language, "Minimum", "最少选择", "Minimum")}
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
                  {tr(language, "Maximum", "最多选择", "Maksimum")}
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
                  {tr(language, "Options", "可选内容", "Pilihan")}
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
                  {tr(language, "Each option can have its own price.", "每个选项都可以有不同价格。", "Setiap pilihan boleh mempunyai harga tersendiri.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openChoiceEditor()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis sm:w-auto"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {tr(language, "Add option", "新增选项", "Tambah pilihan")}
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
                      {displayNames(choice.names, language)}
                    </span>
                    <span className="mt-1 block text-sm tabular-nums text-gray-600 dark:text-zinc-300">
                      {formatChoicePrice(choice.priceDeltaSen)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
                    {tr(language, "Edit", "编辑", "Sunting")}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </button>
              ))}
              {draft.choices.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-600 dark:bg-zinc-950 dark:text-zinc-300">
                  {tr(language, "No options yet.", "还没有可选内容。", "Belum ada pilihan.")}
                </p>
              )}
            </div>
          </section>

          {confirmDeleteGroup && onDelete && (
            <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <p className="font-bold text-red-900 dark:text-red-100">{tr(language, "Delete this group?", "删除这个种类组？", "Padam kumpulan ini?")}</p>
              <p className="mt-1 text-sm leading-5 text-red-800 dark:text-red-200">
                {tr(language, "The group and its options will be removed from this item draft.", "此组和里面的选项会从商品草稿中移除。", "Kumpulan dan pilihannya akan dipadam daripada draf item ini.")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGroup(false)}
                  className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
                >
                  {tr(language, "Keep", "保留", "Kekalkan")}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                >
                  {tr(language, "Delete", "删除", "Padam")}
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
              <p className="font-bold text-red-900 dark:text-red-100">{tr(language, "Delete this option?", "删除这个选项？", "Padam pilihan ini?")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteChoice(false)}
                  className="min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-800 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
                >
                  {tr(language, "Keep", "保留", "Kekalkan")}
                </button>
                <button
                  type="button"
                  onClick={handleChoiceDelete}
                  className="min-h-11 rounded-xl bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                >
                  {tr(language, "Delete", "删除", "Padam")}
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
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h4 className="break-words font-extrabold text-gray-950 dark:text-white">{title}</h4>
          <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-300">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis"
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
  const { language } = useStore();
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emphasis dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary/60 dark:focus-visible:ring-primary"
    >
      <span className="min-w-0">
        <span className="block break-words font-bold text-gray-900 dark:text-white">
          {displayNames(choice.names, language)}
        </span>
        <span className="mt-1 block text-sm tabular-nums text-gray-600 dark:text-zinc-300">
          {formatChoicePrice(choice.priceDeltaSen)}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
        <Pencil aria-hidden="true" className="h-4 w-4" />
        <span className="hidden 2xl:inline">{tr(language, "Edit", "编辑", "Sunting")}</span>
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
  const { language } = useStore();
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
      ? { en: 'Size', zh: '份量', ms: 'Saiz' }
      : { en: 'Add-ons', zh: '加料', ms: 'Tambahan' },
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
        <h4 className="text-base font-extrabold text-gray-950 dark:text-white">{tr(language, "Item choices", "商品选项", "Pilihan item")}</h4>
        <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-300">
          {tr(language, "Tap to edit an option. Choose Done, then Save settings to keep your changes.", "点选选项进行编辑，完成后记得保存设置。", "Tekan untuk menyunting pilihan. Pilih Selesai, kemudian Simpan tetapan.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SummaryCard
          title={tr(language, "Sizes", "份量", "Saiz")}
          description={tr(language, "Serving sizes for this item.", "此商品的份量大小。", "Saiz hidangan untuk item ini.")}
          addLabel={tr(language, "Add size", "新增份量", "Tambah saiz")}
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
          {!sizeGroup?.choices.length && <EmptySummary text={tr(language, "No sizes.", "还没有份量选项。", "Belum ada saiz.")} />}
        </SummaryCard>

        <SummaryCard
          title={tr(language, "Option groups", "种类选项", "Kumpulan pilihan")}
          description={tr(language, "Add rice, protein, noodle or other groups.", "可加饭类、肉类、面类等多个组。", "Tambah kumpulan nasi, protein, mi atau yang lain.")}
          addLabel={tr(language, "Add group", "新增种类", "Tambah kumpulan")}
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
                  {displayNames(group.names, language)}
                </span>
                <span className="mt-1 block break-words text-sm leading-5 text-gray-600 dark:text-zinc-300">
                  {group.required ? tr(language, "Required", "必选", "Wajib") : tr(language, "Optional", "可选", "Pilihan")} · {group.maxSelect === 1
                    ? tr(language, "Choose 1", "单选", "Pilih 1")
                    : tr(language, `Choose ${group.minSelect}–${group.maxSelect}`, `可选 ${group.minSelect}–${group.maxSelect} 项`, `Pilih ${group.minSelect}–${group.maxSelect}`)} · {tr(language, `${group.choices.length} options`, `${group.choices.length} 个选项`, `${group.choices.length} pilihan`)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-emphasis dark:text-primary">
                <Pencil aria-hidden="true" className="h-4 w-4" />
                <span className="hidden 2xl:inline">{tr(language, "Edit", "编辑", "Sunting")}</span>
              </span>
            </button>
          ))}
          {customGroups.length === 0 && (
            <EmptySummary text={tr(language, "No groups yet. Add rice, protein or another choice.", "还没有种类组，可新增饭类、肉类等选择。", "Belum ada kumpulan. Tambah pilihan nasi, protein atau yang lain.")} />
          )}
        </SummaryCard>

        <SummaryCard
          title={tr(language, "Add-ons", "加料", "Tambahan")}
          description={tr(language, "Optional extras with their own prices.", "可另外加价的附加项目。", "Tambahan pilihan dengan harga tersendiri.")}
          addLabel={tr(language, "Add add-on", "新增加料", "Tambah tambahan")}
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
          {!addOnGroup?.choices.length && <EmptySummary text={tr(language, "No add-ons.", "还没有加料。", "Belum ada tambahan.")} />}
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
        {tr(language, `Editing options for ${itemName}`, `正在编辑 ${itemName} 的选项`, `Menyunting pilihan untuk ${itemName}`)}
      </span>
    </div>
  );
}
