import { ADD_ONS, NOODLE_BASES, SIZES } from '../constants';
import type { OrderLineOptionSnapshot } from '../data/app-schema';
import type { CartItem, Language, MenuItem } from '../types';
import { localized, tr } from '../i18n';
import {
  getLegacyAddOnGroupId,
  getLegacyNoodleGroupId,
  getLegacySizeGroupId,
  getMenuOptionGroups,
} from './menu-options';

export interface CartItemDisplay {
  itemName: string;
  sizeName: string;
  optionLabels: string[];
  addOnNames: string[];
  details: string[];
}

function localName(
  value: { en?: string; zh?: string; ms?: string } | undefined,
  language: Language,
): string {
  return localized(value, language);
}

function cloneSnapshots(snapshots: OrderLineOptionSnapshot[]): OrderLineOptionSnapshot[] {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    groupNames: { ...snapshot.groupNames },
    choiceNames: { ...snapshot.choiceNames },
  }));
}

function legacyOptionSnapshots(item: CartItem, menuItem: MenuItem): OrderLineOptionSnapshot[] {
  const groups = getMenuOptionGroups(menuItem);
  const sizeId = item.sizeId || item.size || '';
  const noodleIds = item.noodleBaseIds?.length
    ? item.noodleBaseIds
    : item.noodleBases ?? [];
  const addOnIds = item.addOnIds?.length
    ? item.addOnIds
    : item.addOns ?? [];
  const legacyIdsByGroup = new Map<string, string[]>([
    [getLegacySizeGroupId(menuItem.id), sizeId ? [sizeId] : []],
    [getLegacyNoodleGroupId(menuItem.id), [...noodleIds]],
    [getLegacyAddOnGroupId(menuItem.id), [...addOnIds]],
  ]);

  return groups.flatMap((group) => {
    const selectedIds = new Set(legacyIdsByGroup.get(group.id) ?? []);
    return group.choices
      .filter((choice) => selectedIds.has(choice.id))
      .map((choice) => ({
        optionGroupId: group.id,
        groupNames: { ...group.names },
        choiceId: choice.id,
        choiceNames: { ...choice.names },
        priceDeltaSen: choice.priceDeltaSen,
      }));
  });
}

/** Adds immutable labels to a legacy cart line without recalculating its price. */
export function hydrateCartItemSnapshots(item: CartItem, menuItem?: MenuItem): CartItem {
  if (!menuItem) return { ...item };

  const sizeId = item.sizeId || item.size || '';
  const noodleBaseIds = item.noodleBaseIds?.length
    ? item.noodleBaseIds
    : [...(item.noodleBases ?? [])];
  const addOnIds = item.addOnIds?.length
    ? item.addOnIds
    : [...(item.addOns ?? [])];
  const size = item.sizeSelection
    ?? menuItem.sizes.find((choice) => choice.id === sizeId);
  const storedAddOns = item.addOnSelections?.length ? item.addOnSelections : undefined;
  const addOns = storedAddOns
    ?? addOnIds
      .map((id) => menuItem.addOns.find((choice) => choice.id === id))
      .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));

  return {
    ...item,
    sizeId,
    noodleBaseIds,
    addOnIds,
    itemName: item.itemName ? { ...item.itemName } : { ...menuItem.name },
    sizeSelection: size ? { ...size, name: { ...size.name } } : undefined,
    optionSelections: item.optionSelections?.length
      ? cloneSnapshots(item.optionSelections)
      : legacyOptionSnapshots(item, menuItem),
    addOnSelections: addOns.map((choice) => ({ ...choice, name: { ...choice.name } })),
  };
}

function groupSnapshots(
  snapshots: OrderLineOptionSnapshot[],
  language: Language,
): Array<{ id: string; name: string; choiceNames: string[] }> {
  const groups = new Map<string, { id: string; name: string; choiceNames: string[] }>();
  snapshots.forEach((snapshot) => {
    const existing = groups.get(snapshot.optionGroupId);
    const choiceName = localName(snapshot.choiceNames, language) || snapshot.choiceId;
    if (existing) {
      existing.choiceNames.push(choiceName);
    } else {
      groups.set(snapshot.optionGroupId, {
        id: snapshot.optionGroupId,
        name: localName(snapshot.groupNames, language),
        choiceNames: [choiceName],
      });
    }
  });
  return [...groups.values()];
}

export function getCartItemDisplay(
  item: CartItem,
  menuItem: MenuItem | undefined,
  language: Language,
): CartItemDisplay {
  const snapshots = item.optionSelections?.length
    ? item.optionSelections
    : menuItem
      ? legacyOptionSnapshots(item, menuItem)
      : [];
  const grouped = groupSnapshots(snapshots, language);
  const sizeGroupId = getLegacySizeGroupId(item.menuItemId);
  const addOnGroupId = getLegacyAddOnGroupId(item.menuItemId);

  const snapshotSize = grouped.find((group) => group.id === sizeGroupId)?.choiceNames[0];
  const snapshotAddOns = grouped.find((group) => group.id === addOnGroupId)?.choiceNames ?? [];
  const genericOptions = grouped.filter((group) => group.id !== sizeGroupId && group.id !== addOnGroupId);

  const currentSize = item.sizeId
    ? menuItem?.sizes.find((choice) => choice.id === item.sizeId)?.name
    : SIZES.find((choice) => choice.id === item.size)?.name;
  const sizeName = snapshotSize
    || localName(item.sizeSelection?.name, language)
    || localName(currentSize, language)
    || item.sizeId
    || item.size
    || '';

  let optionLabels = genericOptions.map((group) => {
    const groupName = group.name ? `${group.name}: ` : '';
    return `${groupName}${group.choiceNames.join(' + ')}`;
  });
  if (!optionLabels.length && !snapshots.length) {
    const legacyNames = (item.noodleBaseIds?.length ? item.noodleBaseIds : item.noodleBases ?? [])
      .map((id) => menuItem?.noodleBases.find((choice) => choice.id === id)?.name
        ?? NOODLE_BASES.find((choice) => choice.id === id)?.name)
      .map((name, index) => localName(name, language)
        || item.noodleBaseIds?.[index]
        || item.noodleBases?.[index]
        || '')
      .filter(Boolean);
    if (legacyNames.length) optionLabels = [legacyNames.join(' + ')];
  }

  let addOnNames = snapshotAddOns;
  if (!addOnNames.length) {
    const storedAddOnNames = item.addOnSelections
      ?.map((choice) => localName(choice.name, language))
      .filter(Boolean) ?? [];
    addOnNames = storedAddOnNames.length
      ? storedAddOnNames
      : (item.addOnIds?.length ? item.addOnIds : item.addOns ?? [])
        .map((id) => menuItem?.addOns.find((choice) => choice.id === id)?.name
          ?? ADD_ONS.find((choice) => choice.id === id)?.name)
        .map((name, index) => localName(name, language)
          || item.addOnIds?.[index]
          || item.addOns?.[index]
          || '')
        .filter(Boolean);
  }

  const itemName = localName(item.itemName, language)
    || localName(menuItem?.name, language)
    || item.menuItemId;
  const details = [
    sizeName,
    ...optionLabels,
    addOnNames.length ? `${tr(language, 'Add-ons', '加料', 'Tambahan')}: ${addOnNames.join(', ')}` : '',
  ].filter(Boolean);

  return { itemName, sizeName, optionLabels, addOnNames, details };
}
