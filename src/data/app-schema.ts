/**
 * Versioned application data schema.
 *
 * Everything the product persists hangs off `AppDataSchema`. It carries a
 * `schemaVersion` so a merchant who installed months ago can still open their
 * data after an update -- the free tier keeps orders on the device, so there is
 * no server-side backfill to fall back on.
 *
 * Money: every amount is an integer number of sen (see domain/money.ts).
 * Text:  every merchant-visible string is Record<LangCode, string>.
 */

import type { Sen } from '../domain/money';
import type { BusinessDate, CutoffTime } from '../domain/business-date';

export const CURRENT_SCHEMA_VERSION = 1;

// ==================== Localisation ====================

export type LangCode = 'en' | 'zh' | 'ms';

export const ALL_LANG_CODES: readonly LangCode[] = ['en', 'zh', 'ms'];

/**
 * A record rather than fixed fields, so adding a language later does not
 * change the type of every menu item, option and order snapshot in the app.
 */
export type LocalizedText = Partial<Record<LangCode, string>>;

/** Falls back to the primary language, then any present value, then ''. */
export function resolveText(
  text: LocalizedText | undefined,
  preferred: LangCode,
  primary: LangCode
): string {
  if (!text) return '';
  return text[preferred] ?? text[primary] ?? Object.values(text).find(Boolean) ?? '';
}

// ==================== Settings ====================

export interface BusinessProfile {
  id: string;
  displayName: string;
  secondaryName?: string;
  logoAssetId?: string;
  coverAssetId?: string;
  themeColor: string;
  contact?: string;
  /** [e-Invoice reserved] Stored but unused until MyInvois work is scheduled. */
  taxIdentificationNumber?: string;
  /** [e-Invoice reserved] Stored but unused. */
  sstRegistrationNumber?: string;
}

export interface LocaleSettings {
  currencyCode: string;
  currencySymbol: string;
  /** Space between symbol and digits when formatting. */
  spaceAfterSymbol: boolean;
  locale: string;
  timezone: string;
  primaryLanguage: LangCode;
  enabledLanguages: LangCode[];
}

export interface FeatureFlags {
  customerOrdering: boolean;
  kitchenDisplay: boolean;
  tableManagement: boolean;
  receipts: boolean;
  googleSheetSync: boolean;
}

// ==================== Operations ====================

export interface OrderMode {
  id: string;
  names: LocalizedText;
  requiresTable: boolean;
  enabled: boolean;
  sortOrder: number;
}

export type PaymentKind = 'cash' | 'qr_manual' | 'other_manual';

export interface PaymentMethodConfig {
  id: string;
  names: LocalizedText;
  kind: PaymentKind;
  requiresQrImage: boolean;
  requiresStaffConfirmation: boolean;
  customerHint?: LocalizedText;
  enabled: boolean;
  sortOrder: number;
}

export type ChargeType = 'percentage' | 'fixed';

export interface ChargeRule {
  id: string;
  names: LocalizedText;
  type: ChargeType;
  /** Percent (e.g. 6 for 6%) when type is 'percentage'. */
  ratePercent?: number;
  /** Integer sen when type is 'fixed'. */
  amountSen?: Sen;
  /** Empty means "applies to every order mode". */
  appliesToOrderModeIds: string[];
  /** Ascending. Each rule rounds to whole sen before the next one runs. */
  calculationOrder: number;
  showOnReceipt: boolean;
  enabled: boolean;
}

// ==================== Menu ====================

export interface OptionChoice {
  id: string;
  names: LocalizedText;
  priceDeltaSen: Sen;
  enabled: boolean;
  sortOrder: number;
}

export interface OptionGroup {
  id: string;
  names: LocalizedText;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  choices: OptionChoice[];
  sortOrder: number;
}

export interface MenuCategory {
  id: string;
  names: LocalizedText;
  sortOrder: number;
  enabled: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  names: LocalizedText;
  basePriceSen: Sen;
  imageAssetId?: string;
  optionGroupIds: string[];
  enabled: boolean;
  sortOrder: number;
}

// ==================== Receipt & numbering ====================

export interface ReceiptSettings {
  footerText: LocalizedText;
  showContact: boolean;
  showOrderMode: boolean;
}

export type NumberingResetPeriod = 'daily' | 'monthly' | 'never';

export interface NumberingSettings {
  prefix: string;
  resetPeriod: NumberingResetPeriod;
  /** "HH:MM" local. Splits the trading day; see domain/business-date.ts. */
  businessDayCutoff: CutoffTime;
  /** Next number to hand out. Only ever increases; cancelled numbers are not reused. */
  nextNumber: number;
  /** Business date the counter was last reset for. */
  counterBusinessDate: BusinessDate | null;
}

// ==================== Orders ====================

export interface OrderLineOptionSnapshot {
  optionGroupId: string;
  groupNames: LocalizedText;
  choiceId: string;
  choiceNames: LocalizedText;
  priceDeltaSen: Sen;
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  /** Snapshot: editing the menu later must not rewrite history. */
  itemNames: LocalizedText;
  basePriceSen: Sen;
  options: OrderLineOptionSnapshot[];
  quantity: number;
  unitPriceSen: Sen;
  lineTotalSen: Sen;
  note?: string;
}

export interface AppliedCharge {
  chargeRuleId: string;
  names: LocalizedText;
  type: ChargeType;
  ratePercent?: number;
  amountSen: Sen;
  showOnReceipt: boolean;
}

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type FulfillmentStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface Order {
  /** Permanent internal identity. Never shown to staff or customers. */
  orderUid: string;
  /** Generated once. Never renumbered by cancellation, reload or sync. */
  displayNumber: string;
  createdAt: string;
  updatedAt: string;
  businessDate: BusinessDate;

  orderModeId: string;
  orderModeNames: LocalizedText;
  tableLabel?: string;

  lines: OrderLine[];
  subtotalSen: Sen;
  charges: AppliedCharge[];
  totalSen: Sen;

  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethodId?: string;
  paymentMethodNames?: LocalizedText;

  cancelledAt?: string;
  cancelReason?: string;

  /** Optional Google Sheet adapter bookkeeping. Never blocks local operation. */
  synced: boolean;
  /** Set when this order came from a pre-v1 install, for support triage. */
  migratedFrom?: string;
}

// ==================== Root ====================

export interface AppDataSchema {
  schemaVersion: number;
  businessProfile: BusinessProfile;
  localeSettings: LocaleSettings;
  featureFlags: FeatureFlags;
  orderModes: OrderMode[];
  paymentMethods: PaymentMethodConfig[];
  chargeRules: ChargeRule[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  optionGroups: OptionGroup[];
  receiptSettings: ReceiptSettings;
  numberingSettings: NumberingSettings;
  orders: Order[];
}
