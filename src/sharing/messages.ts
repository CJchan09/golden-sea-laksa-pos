import type { Language } from '../types';
import { tr } from '../i18n';
import { SharingError } from './protocol';
import { FileSaveError, fileErrorMessage } from '../domain/native-export';
export function sharingErrorMessage(error: unknown, language: Language): string {
  if (error instanceof FileSaveError) return fileErrorMessage(error, language);
  const code = error instanceof SharingError ? error.code : error instanceof Error ? error.message : '';
  const messages: Record<string, [string, string, string]> = {
    MENU_TOO_LARGE: ['Menu exceeds 10 MB. Reduce photo sizes or split your menu, then retry. No items were removed.', '菜单包超过 10MB，请缩小照片或分成多个菜单后重试，没有自动删除商品。', 'Menu melebihi 10 MB. Kecilkan foto atau bahagikan menu. Tiada item dibuang.'],
    ORDER_TOO_LARGE: ['Receipt exceeds the size limit. Use the receipt file for a long link; if the file is too large, reduce items or notes and retry.', '回单超过大小限制。链接过长请用回单文件；文件仍过大时，请减少商品或备注后重试。', 'Resit melebihi had saiz. Gunakan fail resit untuk pautan panjang; jika fail terlalu besar, kurangkan item atau nota dan cuba semula.'],
    INVALID_PHONE: ['Enter a valid phone number. The shop number needs a country code, for example 60123456789.', '请填写有效电话；店家号码须含国家代码，例如 60123456789。', 'Masukkan nombor telefon sah. Nombor kedai perlu kod negara, contohnya 60123456789.'],
    PHOTO_UNAVAILABLE: ['A menu photo is unavailable. Save it to this device before sharing offline.', '有菜单照片无法读取，请先保存到本机，再离线分享。', 'Foto menu tidak tersedia. Simpan pada peranti sebelum berkongsi luar talian.'],
    INVALID_PHOTO: ['A photo cannot be opened. Choose a JPG, PNG or WebP photo and retry.', '有照片不能打开，请选择 JPG、PNG 或 WebP 照片后重试。', 'Foto tidak dapat dibuka. Pilih JPG, PNG atau WebP dan cuba lagi.'],
    ITEM_REMOVED: ['An ordered item was removed. Contact the customer to revise the request.', '有商品已删除，请联系顾客调整回单。', 'Item pesanan telah dibuang. Hubungi pelanggan untuk mengubah pesanan.'],
    OPTION_REMOVED: ['An option is unavailable or invalid. Contact the customer to revise the request.', '有选项已删除或不可用，请联系顾客调整回单。', 'Pilihan tidak tersedia atau tidak sah. Hubungi pelanggan untuk mengubah pesanan.'],
    WRONG_SHOP: ['This receipt belongs to another shop.', '这张回单属于另一家店。', 'Resit ini milik kedai lain.'],
    UNKNOWN_MENU: ['This menu was not issued by this shop. Use the original shop device or restore its full backup.', '本机没有这份已分享菜单，请使用原店家设备或恢复完整备份。', 'Menu ini tidak dikeluarkan oleh kedai ini. Gunakan peranti asal atau pulihkan sandaran penuh.'],
    REQUEST_CONFLICT: ['This receipt ID already exists with different contents. No order was changed.', '相同回单编号已有不同内容，没有更改订单。', 'ID resit sama sudah wujud dengan kandungan berlainan. Tiada pesanan diubah.'],
    PRICE_CHANGED: ['Menu contents or charges changed after preview. Review the updated preview before confirming.', '预览后菜单内容或收费已改变，请重新核对预览再确认。', 'Menu atau caj berubah selepas pratonton. Semak pratonton baharu sebelum mengesahkan.'],
    EMPTY_MENU: ['Add at least one menu item first.', '请先加入至少一个商品。', 'Tambah sekurang-kurangnya satu item dahulu.'],
    QUOTE_MISMATCH: ['The quoted amount does not match the original menu. Ask the customer to regenerate the receipt from the menu file.', '回单金额与原菜单不符，请让顾客从菜单文件重新生成回单。', 'Jumlah tidak sepadan dengan menu asal. Minta pelanggan menjana resit semula daripada fail menu.'],
  };
  const aliases: Record<string, string> = { REQUEST_ID_CONFLICT: 'REQUEST_CONFLICT', STALE_PREVIEW: 'PRICE_CHANGED', SHOP_MISMATCH: 'WRONG_SHOP', MENU_NOT_ISSUED: 'UNKNOWN_MENU' };
  const values = messages[aliases[code] ?? code];
  return values ? tr(language, ...values) : tr(language, 'Could not open or save this data. Check the file and available space, then retry.', '资料未能打开或保存，请检查文件与可用空间后重试。', 'Data gagal dibuka atau disimpan. Semak fail dan ruang, kemudian cuba lagi.');
}
