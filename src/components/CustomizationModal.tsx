import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { OptionGroup } from '../data/app-schema';
import { fromRinggit, multiplySen, toRinggit } from '../domain/money';
import {
  buildOptionSelectionSnapshots,
  calculateOptionSelectionSen,
  getEnabledOptionGroups,
  getLegacyAddOnChoiceIds,
  getLegacyNoodleChoiceIds,
  getLegacySizeGroupId,
  getLegacyNoodleGroupId,
  getLegacyAddOnGroupId,
  getLegacySizeChoiceId,
  type OptionSelectionMap,
  type OptionSelectionValidation,
  validateOptionSelections,
} from '../domain/menu-options';
import { MenuItem, Language, CartItem } from '../types';
import { formatCurrency } from '../utils';
import { tr, localized } from '../i18n';
import { X, Plus, Minus, ImageOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  item: MenuItem;
  language: Language;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, 'id'>) => void | boolean | Promise<boolean | void>;
  initialCartItem?: CartItem;
}

export interface CustomizationSelection {
  optionSelections: OptionSelectionMap;
  quantity: number;
}

export function calculateCustomizationTotal(
  item: MenuItem,
  { optionSelections, quantity }: CustomizationSelection,
): number {
  const groups = getEnabledOptionGroups(item);
  const unitPriceSen = fromRinggit(item.basePrice) + calculateOptionSelectionSen(groups, optionSelections);
  return toRinggit(multiplySen(unitPriceSen, quantity));
}

function resolveOptionText(
  text: Partial<Record<Language, string>>,
  language: Language,
  fallback: string,
): string {
  return localized(text, language) || fallback;
}

function minimumForGroup(group: OptionGroup): number {
  return group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
}

function createInitialSelections(groups: OptionGroup[], itemId: string): OptionSelectionMap {
  const legacySizeGroupId = getLegacySizeGroupId(itemId);
  return Object.fromEntries(groups.map((group) => {
    // Preserve the old convenient Size default, but require an explicit choice
    // for merchant-defined groups such as Protein or Rice type.
    const shouldPreselect = minimumForGroup(group) === 1
      && group.maxSelect === 1
      && (group.id === legacySizeGroupId || group.choices.length === 1);
    return [group.id, shouldPreselect && group.choices[0] ? [group.choices[0].id] : []];
  }));
}

function selectionRuleText(group: OptionGroup, language: Language): string {
  const minimum = minimumForGroup(group);
  if (minimum === 1 && group.maxSelect === 1) return tr(language, 'Choose 1', '请选择 1 项', 'Pilih 1');
  if (minimum > 0) return tr(language, `Choose ${minimum}–${group.maxSelect}`, `请选择 ${minimum}–${group.maxSelect} 项`, `Pilih ${minimum}–${group.maxSelect}`);
  return tr(language, `Optional · choose up to ${group.maxSelect}`, `可选 · 最多选择 ${group.maxSelect} 项`, `Pilihan · pilih sehingga ${group.maxSelect}`);
}

function validationMessage(validation: OptionSelectionValidation, language: Language): string {
  const group = validation.group;
  if (!group) return tr(language, 'Please review the selected options.', '请检查已选择的选项。', 'Sila semak pilihan anda.');
  const name = localized(group.names, language);
  if (validation.reason === 'minimum') return tr(language, `Choose at least ${minimumForGroup(group)} for “${name}”.`, `“${name}”至少选择 ${minimumForGroup(group)} 项。`, `Pilih sekurang-kurangnya ${minimumForGroup(group)} untuk “${name}”.`);
  if (validation.reason === 'maximum') return tr(language, `Choose no more than ${group.maxSelect} for “${name}”.`, `“${name}”最多选择 ${group.maxSelect} 项。`, `Pilih tidak lebih daripada ${group.maxSelect} untuk “${name}”.`);
  return tr(language, `A choice in “${name}” is no longer available. Please choose again.`, `“${name}”有选项已不可用，请重新选择。`, `Pilihan dalam “${name}” tidak lagi tersedia. Sila pilih semula.`);
}

function initialSelections(groups: OptionGroup[], item: MenuItem, cartItem?: CartItem): OptionSelectionMap {
  if (!cartItem) return createInitialSelections(groups, item.id);
  return Object.fromEntries(groups.map(group => {
    const snapshots = (cartItem.optionSelections ?? []).filter(selection => selection.optionGroupId === group.id);
    let savedChoices: string[] = snapshots.map(selection => selection.choiceId);
    if (!snapshots.length) {
      if (group.id === getLegacySizeGroupId(item.id)) savedChoices = cartItem.sizeId ? [cartItem.sizeId] : cartItem.size ? [cartItem.size] : [];
      if (group.id === getLegacyNoodleGroupId(item.id)) savedChoices = cartItem.noodleBaseIds?.length ? cartItem.noodleBaseIds : cartItem.noodleBases ?? [];
      if (group.id === getLegacyAddOnGroupId(item.id)) savedChoices = cartItem.addOnIds?.length ? cartItem.addOnIds : cartItem.addOns ?? [];
    }
    // Older carts stored English names. Resolve them to current IDs and drop
    // removed choices so invisible selections cannot prevent a replacement.
    const selectedIds = savedChoices.flatMap(saved => {
      const choice = group.choices.find(candidate => candidate.id === saved)
        ?? (!snapshots.length ? group.choices.find(candidate => Object.values(candidate.names).includes(saved)) : undefined);
      return choice ? [choice.id] : [];
    });
    return [group.id, [...new Set(selectedIds)]];
  }));
}

function formatPriceDelta(priceDeltaSen: number, language: Language): string {
  if (priceDeltaSen === 0) return tr(language, 'Included', '已包含', 'Termasuk');
  const sign = priceDeltaSen > 0 ? '+' : '−';
  return `${sign}${formatCurrency(toRinggit(Math.abs(priceDeltaSen)))}`;
}

export default function CustomizationModal({ item, language, onClose, onAdd, initialCartItem }: Props) {
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [saving, setSaving] = useState(false);
  const submissionLock = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleClose = () => { if (!submissionLock.current) onClose(); };
  const optionGroups = useMemo(() => getEnabledOptionGroups(item), [item]);
  const [optionSelections, setOptionSelections] = useState<OptionSelectionMap>(() => (
    initialSelections(optionGroups, item, initialCartItem)
  ));
  const [quantity, setQuantity] = useState(initialCartItem?.quantity ?? 1);
  const [validationError, setValidationError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submissionLock.current) onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from<HTMLElement>(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex="0"]',
      ) ?? []).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const chooseSingleOption = (groupId: string, choiceId: string | null) => {
    setValidationError('');
    setOptionSelections((current) => ({
      ...current,
      [groupId]: choiceId ? [choiceId] : [],
    }));
  };

  const toggleMultipleOption = (group: OptionGroup, choiceId: string) => {
    setValidationError('');
    setOptionSelections((current) => {
      const selectedIds = current[group.id] ?? [];
      if (selectedIds.includes(choiceId)) {
        return {
          ...current,
          [group.id]: selectedIds.filter((id) => id !== choiceId),
        };
      }
      if (selectedIds.length >= group.maxSelect) return current;
      return {
        ...current,
        [group.id]: [...selectedIds, choiceId],
      };
    });
  };

  const total = calculateCustomizationTotal(item, { optionSelections, quantity });

  const handleAddToCart = async () => {
    if (submissionLock.current) return;
    const validation = validateOptionSelections(optionGroups, optionSelections);
    if (!validation.valid) {
      setValidationError(validationMessage(validation, language));
      return;
    }

    const sizeId = getLegacySizeChoiceId(item, optionSelections);
    const noodleBaseIds = getLegacyNoodleChoiceIds(item, optionSelections);
    const addOnIds = getLegacyAddOnChoiceIds(item, optionSelections);

    submissionLock.current = true; setSaving(true);
    try {
    const result = await onAdd({
      menuItemId: item.id,
      itemName: { ...item.name },
      sizeId,
      noodleBaseIds,
      addOnIds,
      sizeSelection: item.sizes.find((choice) => choice.id === sizeId),
      optionSelections: buildOptionSelectionSnapshots(optionGroups, optionSelections),
      addOnSelections: item.addOns.filter((choice) => addOnIds.includes(choice.id)),
      quantity,
      unitPrice: calculateCustomizationTotal(item, { optionSelections, quantity: 1 }),
      totalPrice: total,
    });
    if (result === false) throw new Error('Cart was not saved');
    onClose();
    } catch {
      setValidationError(t('Could not save this item. Please retry.', '此商品未能保存，请重试。', 'Item ini gagal disimpan. Sila cuba lagi.'));
    } finally { submissionLock.current = false; setSaving(false); }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <motion.div 
          ref={dialogRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex h-auto max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-background-light shadow-2xl dark:bg-background-dark sm:max-h-[90vh] sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Handle for mobile */}
          <div className="flex h-6 w-full items-center justify-center sm:hidden absolute top-0 z-20">
            <div className="h-1.5 w-12 rounded-full bg-white/50"></div>
          </div>

          {/* Header Image & Close */}
          <div className="relative h-40 w-full shrink-0 sm:h-48">
            {item.image ? (
              <img
                src={item.image}
                alt={localized(item.name, language)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-primary/10 text-emphasis dark:text-primary">
                <ImageOff aria-hidden="true" className="h-12 w-12" />
                <span className="sr-only">
                  {t('No item image', '暂无商品图片', 'Tiada gambar item')}
                </span>
              </div>
            )}
            <button 
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              disabled={saving}
              aria-label={t('Close item options', '关闭商品选项', 'Tutup pilihan item')}
              className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center rounded-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md text-slate-900 dark:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h2 id={titleId} className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                  {localized(item.name, language)}
                </h2>
                <p className="mt-1 font-semibold text-emphasis dark:text-primary">
                  {t('From', '起价', 'Dari')} {formatCurrency(item.basePrice)}
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('Choose the options you want for this item.', '请选择这件商品所需的选项。', 'Pilih pilihan yang anda mahu untuk item ini.')}
            </p>

            {validationError && (
              <p role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {validationError}
              </p>
            )}

            {optionGroups.map((group) => {
              const selectedIds = optionSelections[group.id] ?? [];
              const groupName = resolveOptionText(
                group.names,
                language,
                t('Options', '选项', 'Pilihan'),
              );
              const singleSelection = group.maxSelect === 1;
              const canChooseNone = minimumForGroup(group) === 0;

              return (
                <fieldset key={group.id} disabled={saving} className="mb-8">
                  <legend className="w-full">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {groupName}
                      </span>
                      {minimumForGroup(group) > 0 && (
                        <span className="rounded-full bg-primary/15 px-2 py-1 text-sm font-medium text-emphasis dark:text-primary">
                          {t('Required', '必选', 'Wajib')}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                      {selectionRuleText(group, language)}
                    </span>
                  </legend>

                  <div className="mt-3 flex flex-col gap-2">
                    {singleSelection && canChooseNone && (
                      <label className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border-2 p-3 transition-colors ${
                        selectedIds.length === 0
                          ? 'border-primary bg-primary/5'
                          : 'border-primary/10 hover:border-primary/30 dark:border-primary/5'
                      }`}>
                        <input
                          type="radio"
                          name={`${titleId}-${group.id}`}
                          checked={selectedIds.length === 0}
                          onChange={() => chooseSingleOption(group.id, null)}
                          className="h-5 w-5 shrink-0 border-2 border-primary/30 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {t('No selection', '不选择', 'Tiada pilihan')}
                        </span>
                      </label>
                    )}

                    {group.choices.map((choice) => {
                      const checked = selectedIds.includes(choice.id);
                      const disabled = !singleSelection
                        && !checked
                        && selectedIds.length >= group.maxSelect;
                      const choiceName = resolveOptionText(
                        choice.names,
                        language,
                        t('Unnamed option', '未命名选项', 'Pilihan tanpa nama'),
                      );

                      return (
                        <label
                          key={choice.id}
                          className={`flex min-h-14 items-center gap-4 rounded-xl border-2 p-3 transition-colors ${
                            disabled
                              ? 'cursor-not-allowed border-primary/5 opacity-50'
                              : checked
                                ? 'cursor-pointer border-primary bg-primary/5'
                                : 'cursor-pointer border-primary/10 hover:border-primary/30 dark:border-primary/5'
                          }`}
                        >
                          <input
                            type={singleSelection ? 'radio' : 'checkbox'}
                            name={singleSelection ? `${titleId}-${group.id}` : undefined}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => {
                              if (singleSelection) chooseSingleOption(group.id, choice.id);
                              else toggleMultipleOption(group, choice.id);
                            }}
                            className={`${singleSelection ? 'rounded-full' : 'rounded-md'} h-6 w-6 shrink-0 border-primary/20 text-primary focus:ring-primary focus:ring-offset-0`}
                          />
                          <span className="min-w-0 flex-1 break-words font-semibold text-slate-700 dark:text-slate-300">
                            {choiceName}
                          </span>
                          <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {formatPriceDelta(choice.priceDeltaSen, language)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            {optionGroups.length === 0 && (
              <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                {t('No extra choices are required for this item.', '这件商品不需要选择其他选项。', 'Tiada pilihan tambahan diperlukan untuk item ini.')}
              </p>
            )}

          </div>

          {/* Sticky Footer Action */}
          <div className="shrink-0 border-t border-zinc-200 bg-background-light p-4 dark:border-zinc-800 dark:bg-background-dark sm:p-6">
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex shrink-0 self-center items-center bg-primary/10 rounded-full p-1 min-h-12">
                <button 
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={saving || quantity <= 1}
                  aria-label={t('Decrease quantity', '减少数量', 'Kurangkan kuantiti')}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Minus aria-hidden="true" className="w-5 h-5" />
                </button>
                <span className="w-8 text-center font-bold text-slate-900 dark:text-slate-100">{quantity}</span>
                <button 
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={saving}
                  aria-label={t('Increase quantity', '增加数量', 'Tambah kuantiti')}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Plus aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>
              
              <button 
                type="button"
                onClick={handleAddToCart}
                disabled={saving}
                className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-bold text-on-primary shadow-lg shadow-black/15 transition-colors hover:bg-primary-hover min-[360px]:text-base"
              >
                <span className="hidden min-[360px]:inline">
                  {saving ? t('Saving…', '保存中…', 'Menyimpan…') : initialCartItem ? t('Update item', '更新商品', 'Kemas kini item') : t('Add to order', '加入订单', 'Tambah pesanan')}
                </span>
                <span className="min-[360px]:hidden">
                  {saving ? t('Saving…', '保存中…', 'Menyimpan…') : initialCartItem ? t('Update', '更新', 'Kemas kini') : t('Add', '加入', 'Tambah')}
                </span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-black/30"></span>
                <span>{formatCurrency(total)}</span>
              </button>
            </div>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
