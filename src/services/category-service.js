/**
 * Nghiệp vụ danh mục giao dịch: tab "Danh mục giao dịch" (chỉ admin).
 *
 * Khác với sổ thu chi (ghi đè tại chỗ + dán tay ở chế độ data.json), quản lý
 * danh mục chỉ chạy ở chế độ Firebase — có xoá thật, phải chặn xoá khi danh
 * mục đã có giao dịch, và không đáng công dựng lại luồng dán-tay-JSON cho một
 * đường vốn đã ngưng hoạt động trên trang thật (xem CLAUDE.md).
 *
 * Giao dịch vẫn lưu danh mục dưới dạng TÊN (transactions/<id>.cat), không đổi
 * sang tham chiếu id — tra cứu màu/mặc định của danh mục cũng theo tên, nhờ
 * vậy không phải đụng tới hàng trăm dòng giao dịch đã có.
 */

import { COMPANY_FUND_CATEGORY } from '../config/constants.js';
import { store } from '../state/store.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';

/**
 * Danh mục mặc định, gieo một lần duy nhất khi collection "categories" còn
 * trống — tái hiện đúng danh sách/màu/mặc định đang chạy trước khi có tab
 * này, để không ai mất khả năng chọn danh mục ngay sau khi triển khai.
 */
export const DEFAULT_CATEGORIES = [
  { type: 'chi', name: 'Tiền thuê sân', color: '#2a78d6', defaultAmount: 0, defaultDesc: 'Tiền thuê sân' },
  { type: 'chi', name: 'Tiền cầu lông', color: '#eb6834', defaultAmount: 0, defaultDesc: 'Tiền cầu lông' },
  { type: 'chi', name: 'Tiền nước', color: '#1baf7a', defaultAmount: 0, defaultDesc: 'Tiền nước' },
  { type: 'chi', name: 'Tiền khác', color: '#eda100', defaultAmount: 0, defaultDesc: 'Tiền khác' },
  {
    type: 'thu',
    name: COMPANY_FUND_CATEGORY,
    color: '#2a78d6',
    defaultAmount: 1000000,
    defaultDesc: COMPANY_FUND_CATEGORY,
    protected: true,
  },
  {
    type: 'thu',
    name: 'Tiền được tài trợ cho CLB',
    color: '#e87ba4',
    defaultAmount: 1000000,
    defaultDesc: 'Tiền được tài trợ cho CLB',
  },
];

/** Toàn bộ danh mục hiện có. */
export function getAllCategories() {
  return store.data?.categories ?? [];
}

/**
 * Danh mục theo loại thu/chi.
 * @param {'thu'|'chi'} type
 */
export function getCategoriesByType(type) {
  return getAllCategories().filter((item) => item.type === type);
}

/** Map tên danh mục → màu, dùng cho `getCategoryColor(cat, map)`. */
export function getCategoryColorMap() {
  const map = {};
  getAllCategories().forEach((item) => {
    map[item.name] = item.color;
  });
  return map;
}

/** Danh mục theo tên, hoặc undefined nếu không có. */
export function findCategoryByName(name) {
  return getAllCategories().find((item) => item.name === name);
}

/** Quản lý danh mục (thêm/sửa/xoá) chỉ dùng được ở chế độ Firebase. */
export function canManageCategories() {
  return isFirebaseMode();
}

/**
 * Danh mục đã có giao dịch nào mang tên này chưa — có thì không cho xoá,
 * chỉ cho sửa (đúng theo yêu cầu: xoá một danh mục đang dùng sẽ làm các dòng
 * giao dịch cũ hiện lỗi màu/không lọc được nữa).
 * @param {string} name
 */
export function isCategoryInUse(name) {
  return store.transactions.some((item) => item.cat === name);
}

/**
 * Sinh mã danh mục kế tiếp theo loại, dạng "THU-001"/"CHI-001".
 *
 * Lấy số lớn nhất đang có rồi +1 thay vì đếm số lượng danh mục — đếm số
 * lượng sẽ sinh trùng mã ngay khi một danh mục ở giữa dãy bị xoá.
 * @param {'thu'|'chi'} type
 */
export function generateCategoryCode(type) {
  const prefix = type === 'thu' ? 'THU' : 'CHI';
  const usedNumbers = getCategoriesByType(type)
    .map((item) => Number(String(item.code ?? '').replace(`${prefix}-`, '')))
    .filter((number) => Number.isFinite(number));
  const next = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/**
 * Tạo danh mục mới, tự sinh mã theo loại.
 * @param {{type: string, name: string, color: string, defaultAmount: number, defaultDesc: string}} fields
 */
export function addCategory(fields) {
  if (!isFirebaseMode()) return Promise.resolve();
  return firebaseApi().addCategory({ ...fields, code: generateCategoryCode(fields.type) });
}

/**
 * Sửa một danh mục đã có.
 * @param {string} id
 * @param {object} changes
 */
export function updateCategory(id, changes) {
  if (!isFirebaseMode()) return Promise.resolve();
  return firebaseApi().updateCategory(id, changes);
}

/**
 * Xoá một danh mục — gọi trước khi gọi phải tự kiểm `isCategoryInUse`, hàm
 * này không kiểm lại để tránh đọc `store.transactions` hai lần cho cùng một
 * thao tác.
 * @param {string} id
 */
export function deleteCategory(id) {
  if (!isFirebaseMode()) return Promise.resolve();
  return firebaseApi().deleteCategory(id);
}

/**
 * Gieo danh mục mặc định nếu collection đang trống — chạy tự động ở lần đăng
 * nhập admin đầu tiên sau khi triển khai tính năng này (`login-modal.js`),
 * vì Claude không ghi thẳng lên Firestore thật được.
 */
export async function seedDefaultCategoriesIfEmpty() {
  if (!isFirebaseMode() || getAllCategories().length > 0) return;
  const withCodes = DEFAULT_CATEGORIES.map((category, index) => ({
    ...category,
    code: `${category.type === 'thu' ? 'THU' : 'CHI'}-${String(
      DEFAULT_CATEGORIES.slice(0, index + 1).filter((item) => item.type === category.type).length,
    ).padStart(3, '0')}`,
  }));
  await firebaseApi().seedCategories(withCodes);
}
