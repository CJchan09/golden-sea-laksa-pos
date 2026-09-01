import type { OptionGroup, OrderLineOptionSnapshot } from '../data/app-schema';
import type { MenuItem } from '../types';

const LEGACY_NOODLE_GROUP_SUFFIX = 'legacy-noodle-group';
const LEGACY_SIZE_GROUP_SUFFIX = 'legacy-size-group';
const LEGACY_ADD_ON_GROUP_SUFFIX = 'legacy-add-on-group';

export interface OptionSelectionMap {
  [groupId: string]: string[];
}

export interface OptionSelectionValidation {
  valid: boolean;
  group?: OptionGroup;
  reason?: 'minimum' | 'maximum' | 'unknown-choice' | 'disabled-choice';
}

export function getLegacyNoodleGroupId(menuItemId: string): string {
  return `${menuItemId}:${LEGACY_NOODLE_GROUP_SUFFIX}`;
}

export function getLegacySizeGroupId(menuItemId: string): string {
  return `${menuItemId}:${LEGACY_SIZE_GROUP_SUFFIX}`;
}

export function getLegacyAddOnGroupId(menuItemId: string): string {
  return `${menuItemId}:${LEGACY_ADD_ON_GROUP_SUFFIX}`;
}

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

function legacyOptionsToGroups(item: MenuItem): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const makeChoices = (choices: MenuItem['sizes']) => choices.map((choice, index) => ({
    id: choice.id,
    names: { ...choice.name },
    priceDeltaSen: Math.round(choice.price * 100),
    enabled: true,
    sortOrder: index,
  }));

  if (item.sizes?.length) {
    groups.push({
      id: getLegacySizeGroupId(item.id),
      names: { en: 'Size', zh: '大小份' },
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: groups.length,
      choices: makeChoices(item.sizes),
    });
  }

  if (item.noodleBases?.length) {
    groups.push({
      id: getLegacyNoodleGroupId(item.id),
      names: { en: 'Noodle type', zh: '面类' },
      required: true,
      minSelect: 1,
      maxSelect: Math.min(2, item.noodleBases.length),
      sortOrder: groups.length,
      choices: makeChoices(item.noodleBases),
    });
  }

  if (item.addOns?.length) {
    groups.push({
      id: getLegacyAddOnGroupId(item.id),
      names: { en: 'Add-ons', zh: '加料' },
      required: false,
      minSelect: 0,
      maxSelect: item.addOns.length,
      sortOrder: groups.length,
      choices: makeChoices(item.addOns),
    });
  }

  return groups;
}

/**
 * Returns the generic groups used by the active ordering UI.
 * Presence, rather than length, is significant: `[]` is an intentional value.
 */
export function getMenuOptionGroups(item: MenuItem): OptionGroup[] {
  if (Object.prototype.hasOwnProperty.call(item, 'optionGroups')) {
    return (item.optionGroups ?? []).map(cloneGroup);
  }
  return legacyOptionsToGroups(item);
}

/** One-time, idempotent adapter for the legacy localStorage menu format. */
export function normalizeMenuItemOptionGroups(item: MenuItem): MenuItem {
  return {
    ...item,
    name: { ...item.name },
    sizes: (item.sizes ?? []).map((choice) => ({ ...choice, name: { ...choice.name } })),
    noodleBases: (item.noodleBases ?? []).map((choice) => ({ ...choice, name: { ...choice.name } })),
    addOns: (item.addOns ?? []).map((choice) => ({ ...choice, name: { ...choice.name } })),
    optionGroups: getMenuOptionGroups(item),
  };
}

export function getEnabledOptionGroups(item: MenuItem): OptionGroup[] {
  const sizeGroupId = getLegacySizeGroupId(item.id);
  const addOnGroupId = getLegacyAddOnGroupId(item.id);
  return getMenuOptionGroups(item)
    .map((group) => ({
      ...group,
      choices: group.choices
        .filter((choice) => choice.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((group) => group.choices.length > 0)
    .sort((a, b) => {
      if (a.id === sizeGroupId) return -1;
      if (b.id === sizeGroupId) return 1;
      if (a.id === addOnGroupId) return 1;
      if (b.id === addOnGroupId) return -1;
      return a.sortOrder - b.sortOrder;
    });
}

export function validateOptionSelections(
  groups: OptionGroup[],
  selections: OptionSelectionMap,
): OptionSelectionValidation {
  for (const group of groups) {
    const selectedIds = [...new Set(selections[group.id] ?? [])];
    const minimum = group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
    if (selectedIds.length < minimum) return { valid: false, group, reason: 'minimum' };
    if (selectedIds.length > group.maxSelect) return { valid: false, group, reason: 'maximum' };

    for (const choiceId of selectedIds) {
      const choice = group.choices.find((candidate) => candidate.id === choiceId);
      if (!choice) return { valid: false, group, reason: 'unknown-choice' };
      if (!choice.enabled) return { valid: false, group, reason: 'disabled-choice' };
    }
  }
  return { valid: true };
}

export function calculateOptionSelectionSen(
  groups: OptionGroup[],
  selections: OptionSelectionMap,
): number {
  return groups.reduce((total, group) => {
    const selectedIds = new Set(selections[group.id] ?? []);
    return total + group.choices.reduce((groupTotal, choice) => (
      selectedIds.has(choice.id) && choice.enabled
        ? groupTotal + choice.priceDeltaSen
        : groupTotal
    ), 0);
  }, 0);
}

export function buildOptionSelectionSnapshots(
  groups: OptionGroup[],
  selections: OptionSelectionMap,
): OrderLineOptionSnapshot[] {
  return groups.flatMap((group) => {
    const selectedIds = new Set(selections[group.id] ?? []);
    return group.choices
      .filter((choice) => selectedIds.has(choice.id) && choice.enabled)
      .map((choice) => ({
        optionGroupId: group.id,
        groupNames: { ...group.names },
        choiceId: choice.id,
        choiceNames: { ...choice.names },
        priceDeltaSen: choice.priceDeltaSen,
      }));
  });
}

export function getLegacyNoodleChoiceIds(
  item: MenuItem,
  selections: OptionSelectionMap,
): string[] {
  return [...(selections[getLegacyNoodleGroupId(item.id)] ?? [])];
}

export function getLegacySizeChoiceId(
  item: MenuItem,
  selections: OptionSelectionMap,
): string {
  return selections[getLegacySizeGroupId(item.id)]?.[0] ?? '';
}

export function getLegacyAddOnChoiceIds(
  item: MenuItem,
  selections: OptionSelectionMap,
): string[] {
  return [...(selections[getLegacyAddOnGroupId(item.id)] ?? [])];
}
