/**
 * Neutral defaults for a fresh install.
 *
 * Deliberately generic: no shop name, no menu, no branding. The Golden Sea
 * Laksa sample lives in the legacy seed and is only reachable through
 * migration or tests. Phase 1C adds the neutral demo menu on top of this.
 */

import { DEFAULT_BUSINESS_DAY_CUTOFF } from '../domain/business-date';
import {
  AppDataSchema,
  CURRENT_SCHEMA_VERSION,
  ChargeRule,
  FeatureFlags,
  LocaleSettings,
  NumberingSettings,
  OrderMode,
  PaymentMethodConfig,
  ReceiptSettings,
} from './app-schema';

export const DEFAULT_LOCALE_SETTINGS: LocaleSettings = {
  currencyCode: 'MYR',
  currencySymbol: 'RM',
  spaceAfterSymbol: false,
  locale: 'en-MY',
  timezone: 'Asia/Kuala_Lumpur',
  primaryLanguage: 'en',
  enabledLanguages: ['en'],
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  customerOrdering: true,
  kitchenDisplay: true,
  tableManagement: true,
  receipts: true,
  googleSheetSync: false,
};

export const DEFAULT_ORDER_MODES: OrderMode[] = [
  {
    id: 'mode_dine_in',
    names: { en: 'Dine-in', zh: '堂食', ms: 'Makan Sini' },
    requiresTable: true,
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'mode_takeaway',
    names: { en: 'Takeaway', zh: '打包', ms: 'Bungkus' },
    requiresTable: false,
    enabled: true,
    sortOrder: 1,
  },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'pay_cash',
    names: { en: 'Cash', zh: '现金', ms: 'Tunai' },
    kind: 'cash',
    requiresQrImage: false,
    requiresStaffConfirmation: true,
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'pay_qr',
    names: { en: 'QR Pay', zh: '扫码付款', ms: 'Bayar QR' },
    kind: 'qr_manual',
    requiresQrImage: true,
    // A customer opening the QR is not proof of payment. Staff must confirm.
    requiresStaffConfirmation: true,
    enabled: true,
    sortOrder: 1,
  },
];

/** Charges start disabled. Merchants opt in once they understand the maths. */
export const DEFAULT_CHARGE_RULES: ChargeRule[] = [];

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  footerText: {},
  showContact: true,
  showOrderMode: true,
};

export const DEFAULT_NUMBERING_SETTINGS: NumberingSettings = {
  prefix: '',
  resetPeriod: 'daily',
  businessDayCutoff: DEFAULT_BUSINESS_DAY_CUTOFF,
  nextNumber: 1,
  counterBusinessDate: null,
};

export function createEmptyAppData(businessId: string): AppDataSchema {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    businessProfile: {
      id: businessId,
      displayName: '',
      themeColor: '#0f766e',
    },
    localeSettings: { ...DEFAULT_LOCALE_SETTINGS, enabledLanguages: ['en'] },
    featureFlags: { ...DEFAULT_FEATURE_FLAGS },
    // Clone nested values too. These defaults are module-level constants, so a
    // shallow copy would let one shop mutate the next fresh install's names,
    // hints or order-mode filters through a shared object/array reference.
    orderModes: DEFAULT_ORDER_MODES.map((m) => ({ ...m, names: { ...m.names } })),
    paymentMethods: DEFAULT_PAYMENT_METHODS.map((p) => ({
      ...p,
      names: { ...p.names },
      customerHint: p.customerHint ? { ...p.customerHint } : undefined,
    })),
    chargeRules: DEFAULT_CHARGE_RULES.map((c) => ({
      ...c,
      names: { ...c.names },
      appliesToOrderModeIds: [...c.appliesToOrderModeIds],
    })),
    menuCategories: [],
    menuItems: [],
    optionGroups: [],
    receiptSettings: {
      ...DEFAULT_RECEIPT_SETTINGS,
      footerText: { ...DEFAULT_RECEIPT_SETTINGS.footerText },
    },
    numberingSettings: { ...DEFAULT_NUMBERING_SETTINGS },
    orders: [],
  };
}
