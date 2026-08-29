/**
 * Kho trạng thái dùng chung của ứng dụng.
 *
 * Quy ước: chỉ services được phép ghi vào store; components chỉ đọc.
 * Nhờ vậy luồng dữ liệu một chiều và dễ lần ngược khi có lỗi.
 */

export const store = {
  /** Nội dung data.json sau khi tải về. */
  data: null,

  /** Danh sách tháng đã ghi trong data.json. */
  months: [],

  /** Toàn bộ giao dịch đã gộp (thu + chi), tính cả khoản thêm/sửa cục bộ. */
  transactions: [],

  /** Thống kê gộp theo từng thành viên. */
  members: [],

  /** Trạng thái hoạt động hiện tại: { [tên]: boolean }. */
  activeMembers: {},

  /** Trạng thái hoạt động gốc từ data.json, dùng để so sánh thay đổi. */
  baseActiveMembers: {},

  /** Ghi đè số tiền đóng quỹ: { "2026-08|Văn Khánh": 50000 }. */
  duesPaidOverrides: {},

  /** Ghi đè ghi chú đóng quỹ, cùng dạng khoá với duesPaidOverrides. */
  duesNoteOverrides: {},

  /** Tháng nào được bổ sung thành viên đang hoạt động: { "2026-08": true }. */
  duesFilledMonths: {},

  /** Giao dịch mới nhập trên máy, chưa lưu vào data.json. */
  addedTransactions: { incomes: [], expenses: [] },

  /** Sửa đổi lên giao dịch vốn có: { "chi#12": { amount: 250000 } }. */
  editedTransactions: {},

  /** Id các dòng đang được tick chọn ở sổ thu chi. */
  selectedTransactionIds: new Set(),

  /** Người dùng đã đăng nhập quản trị hay chưa. */
  isAdmin: false,
};

/**
 * Ghép khoá tra cứu đóng quỹ từ tháng và tên thành viên.
 * @param {string} monthKey
 * @param {string} memberName
 * @returns {string}
 */
export function buildDuesKey(monthKey, memberName) {
  return `${monthKey}|${memberName}`;
}
