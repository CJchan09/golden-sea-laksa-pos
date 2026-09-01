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
  getLegacySizeChoiceId,
  type OptionSelectionMap,
  type OptionSelectionValidation,
  validateOptionSelections,
} from '../domain/menu-options';
import { MenuItem, Language, CartItem } from '../types';
import { formatCurrency } from '../utils';
import { X, Plus, Minus, ImageOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  item: MenuItem;
  language: Language;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, 'id'>) => void;
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
  return text[language] || text.en || text.zh || fallback;
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

  if (group.maxSelect === 1) {
    if (minimum === 1) return language === 'en' ? 'Choose 1' : '请选择 1 项';
    return language === 'en' ? 'Optional · choose up to 1' : '可选 · 最多选择 1 项';
  }

  if (minimum > 0) {
    return language === 'en'
      ? `Choose ${minimum}–${group.maxSelect}`
      : `请选择 ${minimum}–${group.maxSelect} 项`;
  }

  return language === 'en'
    ? `Optional · choose up to ${group.maxSelect}`
    : `可选 · 最多选择 ${group.maxSelect} 项`;
}

function validationMessage(
  validation: OptionSelectionValidation,
  language: Language,
): string {
  const group = validation.group;
  if (!group) {
    return language === 'en'
      ? 'Please review the selected options.'
      : '请检查已选择的选项。';
  }

  const groupName = resolveOptionText(
    group.names,
    language,
    language === 'en' ? 'this group' : '这个选项组',
  );
  const minimum = minimumForGroup(group);

  if (validation.reason === 'minimum') {
    return language === 'en'
      ? `Please select at least ${minimum} option${minimum === 1 ? '' : 's'} for “${groupName}”.`
      : `请在“${groupName}”至少选择 ${minimum} 项。`;
  }

  if (validation.reason === 'maximum') {
    return language === 'en'
      ? `Please select no more than ${group.maxSelect} option${group.maxSelect === 1 ? '' : 's'} for “${groupName}”.`
      : `“${groupName}”最多只能选择 ${group.maxSelect} 项。`;
  }

  if (validation.reason === 'disabled-choice') {
    return language === 'en'
      ? `A selected option in “${groupName}” is no longer available. Please choose again.`
      : `“${groupName}”中有选项已停用，请重新选择。`;
  }

  return language === 'en'
    ? `A selected option in “${groupName}” could not be found. Please choose again.`
    : `“${groupName}”中有选项已不存在，请重新选择。`;
}

function formatPriceDelta(priceDeltaSen: number, language: Language): string {
  if (priceDeltaSen === 0) return language === 'en' ? 'Included' : '已包含';
  const sign = priceDeltaSen > 0 ? '+' : '−';
  return `${sign}${formatCurrency(toRinggit(Math.abs(priceDeltaSen)))}`;
}

export default function CustomizationModal({ item, language, onClose, onAdd }: Props) {
  const optionGroups = useMemo(() => getEnabledOptionGroups(item), [item]);
  const [optionSelections, setOptionSelections] = useState<OptionSelectionMap>(() => (
    createInitialSelections(optionGroups, item.id)
  ));
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

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

  const handleAddToCart = () => {
    const validation = validateOptionSelections(optionGroups, optionSelections);
    if (!validation.valid) {
      setValidationError(validationMessage(validation, language));
      return;
    }

    const sizeId = getLegacySizeChoiceId(item, optionSelections);
    const noodleBaseIds = getLegacyNoodleChoiceIds(item, optionSelections);
    const addOnIds = getLegacyAddOnChoiceIds(item, optionSelections);

    onAdd({
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
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div 
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
                alt={item.name[language]}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-primary/10 text-emphasis dark:text-primary">
                <ImageOff aria-hidden="true" className="h-12 w-12" />
                <span className="sr-only">
                  {language === 'en' ? 'No menu image' : '暂无餐点图片'}
                </span>
              </div>
            )}
            <button 
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={language === 'en' ? 'Close item options' : '关闭商品选项'}
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
                  {item.name[language]}
                </h2>
                <p className="mt-1 font-semibold text-emphasis dark:text-primary">
                  {language === 'en' ? 'From' : '起价'} {formatCurrency(item.basePrice)}
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {language === 'en'
                ? 'Choose the options you want for this item.'
                : '请选择这份餐点所需的选项。'}
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
                language === 'en' ? 'Options' : '选项',
              );
              const singleSelection = group.maxSelect === 1;
              const canChooseNone = minimumForGroup(group) === 0;

              return (
                <fieldset key={group.id} className="mb-8">
                  <legend className="w-full">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {groupName}
                      </span>
                      {minimumForGroup(group) > 0 && (
                        <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-emphasis dark:text-primary">
                          {language === 'en' ? 'Required' : '必选'}
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
                          {language === 'en' ? 'No selection' : '不选择'}
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
                        language === 'en' ? 'Unnamed option' : '未命名选项',
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
                {language === 'en'
                  ? 'No extra choices are required for this item.'
                  : '这份餐点不需要选择其他选项。'}
              </p>
            )}

          </div>

          {/* Sticky Footer Action */}
          <div className="shrink-0 border-t border-zinc-200 bg-background-light p-4 dark:border-zinc-800 dark:bg-background-dark sm:p-6">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center bg-primary/10 rounded-full p-1 h-12">
                <button 
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label={language === 'en' ? 'Decrease quantity' : '减少数量'}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Minus aria-hidden="true" className="w-5 h-5" />
                </button>
                <span className="w-8 text-center font-bold text-slate-900 dark:text-slate-100">{quantity}</span>
                <button 
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label={language === 'en' ? 'Increase quantity' : '增加数量'}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Plus aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>
              
              <button 
                type="button"
                onClick={handleAddToCart}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 text-sm font-bold text-on-primary shadow-lg shadow-black/15 transition-colors hover:bg-primary-hover min-[360px]:text-base"
              >
                <span className="hidden min-[360px]:inline">
                  {language === 'en' ? 'Add to Order' : '加入订单'}
                </span>
                <span className="min-[360px]:hidden">
                  {language === 'en' ? 'Add' : '加入'}
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
