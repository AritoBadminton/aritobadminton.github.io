/**
 * Hằng số dùng chung toàn ứng dụng.
 * Quy ước: hằng số cố định viết SNAKE_CASE in hoa.
 */

/** Đường dẫn tới file dữ liệu chung (đặt ở gốc repo để dễ sửa trực tiếp trên GitHub). */
export const DATA_URL = 'data.json';

/** Mức đóng quỹ chuẩn cho thành viên công ty (đồng / tháng). */
export const STANDARD_DUES = 50000;

/** Số tháng tương lai được đề xuất sẵn trong ô chọn tháng. */
export const FUTURE_MONTH_COUNT = 3;

/** Số giao dịch hiển thị ở khối "Giao dịch gần đây". */
export const RECENT_TRANSACTION_COUNT = 10;

/** Danh mục hợp lệ theo từng loại giao dịch. */
export const CATEGORIES = {
  chi: ['Tiền thuê sân', 'Tiền cầu lông', 'Tiền nước', 'Tiền khác'],
  thu: ['Tiền quỹ công ty hàng tháng', 'Tiền quỹ thành viên hàng tháng'],
};

/** Màu biểu diễn cho từng danh mục, tham chiếu biến CSS trong base.css. */
export const CATEGORY_COLORS = {
  'Tiền thuê sân': 'var(--series-1)',
  'Tiền cầu lông': 'var(--series-2)',
  'Tiền nước': 'var(--series-3)',
  'Tiền khác': 'var(--series-4)',
  'Tiền quỹ công ty hàng tháng': 'var(--series-1)',
  'Tiền quỹ thành viên hàng tháng': 'var(--series-2)',
};

export const CATEGORY_COLOR_FALLBACK = 'var(--series-5)';

/** Khoá lưu trữ trong localStorage / sessionStorage. */
export const STORAGE_KEYS = {
  THEME: 'clb-theme',
  AUTH: 'clb-auth-v1',
  ACTIVE_MEMBERS: 'clb-active-v1',
  DUES_PAID: 'clb-paid-v1',
  DUES_NOTES: 'clb-note-v1',
  DUES_FILL: 'clb-fill-v1',
  DUES_SKIP: 'clb-skip-v1',
  LEDGER_ADDED: 'clb-tx-v1',
  LEDGER_EDITED: 'clb-txedit-v1',
  RULES: 'clb-rules-v1',
};

/**
 * Thông tin đăng nhập quản trị.
 *
 * CẢNH BÁO: đây là web tĩnh không có máy chủ, việc kiểm tra chạy ngay trong
 * trình duyệt và repo để public — nên đây chỉ là khoá chống bấm nhầm, KHÔNG
 * phải bảo mật thật. Dữ liệu chung được bảo vệ bởi quyền ghi vào repo GitHub.
 * Đổi mật khẩu: thay ADMIN_PASSWORD_HASH bằng SHA-256 của mật khẩu mới.
 */
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD_HASH = '0f52167b7f8d9dd7a4cb1f59cfd855acf53021f3168cae3bc9c5085a4d1afab5';

/**
 * Trạng thái đóng quỹ của một thành viên trong tháng.
 * SKIPPED nghĩa là tháng đó không chơi, nên không bị tính là còn nợ quỹ.
 */
export const DUES_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  SKIPPED: 'skipped',
};

/** Nhãn hiển thị cho từng trạng thái đóng quỹ. */
export const DUES_STATUS_LABELS = {
  [DUES_STATUS.PAID]: 'Đã đóng',
  [DUES_STATUS.UNPAID]: 'Chưa đóng',
  [DUES_STATUS.SKIPPED]: 'Không chơi',
};

/** Giá trị đại diện cho lựa chọn "giữ nguyên" khi sửa nhiều dòng cùng lúc. */
export const KEEP_UNCHANGED = '__keep-unchanged__';

/** Số tháng hiển thị sẵn trong ô chọn tháng; phần cũ hơn nằm sau "Xem thêm". */
export const MONTH_OPTION_LIMIT = 5;

/** Giá trị của dòng "Xem thêm" trong ô chọn tháng. */
export const MONTH_OPTION_MORE = '__more__';

/** Số thành viên hiển thị trên mỗi trang của bảng Thành viên. */
export const MEMBER_PAGE_SIZE = 15;
