/**
 * Đồng bộ giữa dữ liệu chung và bản nháp trên máy.
 *
 * Sau khi lưu thành công, Worker trả về nội dung data.json mới. Dùng luôn nội
 * dung đó thay vì tải lại data.json, vì GitHub Pages mất một hai phút mới phát
 * ra bản mới — người vừa bấm Lưu sẽ thấy ngay kết quả đúng.
 */

import { store } from '../state/store.js';
import { loadLocalDuesChanges, resetMonth } from './dues-service.js';
import { discardAllLedgerChanges, loadLocalLedgerChanges, rebuildTransactions } from './ledger-service.js';
import { aggregateMembers, initActiveMembers, resetActiveMembers } from './member-service.js';
import { loadLocalRuleChanges, resetRuleItems } from './rules-service.js';

/**
 * Dựng lại toàn bộ trạng thái dẫn xuất từ store.data và bản nháp trên máy.
 * Gọi lúc khởi động và sau mỗi lần dữ liệu chung thay đổi.
 */
export function buildDerivedState() {
  loadLocalRuleChanges();
  loadLocalLedgerChanges();
  rebuildTransactions();
  store.months = store.data.months;

  loadLocalDuesChanges();
  aggregateMembers();
  initActiveMembers();
  // Gom lại lần nữa: giờ mới biết ai đang hoạt động để tính tháng tự sinh.
  aggregateMembers();
}

/**
 * Bỏ bản nháp của phần vừa lưu thành công — nó đã trở thành dữ liệu chung.
 * @param {'rules'|'roster'|'month'|'ledger'} section
 * @param {string} [monthKey] chỉ dùng cho section 'month'
 */
function discardLocalDraft(section, monthKey) {
  if (section === 'rules') resetRuleItems();
  else if (section === 'roster') resetActiveMembers();
  else if (section === 'month') resetMonth(monthKey);
  else discardAllLedgerChanges();
}

/**
 * Nhận dữ liệu chung mới sau khi lưu, xoá bản nháp tương ứng rồi dựng lại trạng thái.
 * @param {object} freshData nội dung data.json mới
 * @param {'rules'|'roster'|'month'|'ledger'} section
 * @param {string} [monthKey]
 */
export function applySavedData(freshData, section, monthKey) {
  store.data = freshData;
  discardLocalDraft(section, monthKey);
  buildDerivedState();
}
