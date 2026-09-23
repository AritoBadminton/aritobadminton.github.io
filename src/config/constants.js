/**
 * Hằng số dùng chung toàn ứng dụng.
 * Quy ước: hằng số cố định viết SNAKE_CASE in hoa.
 */

/** Đường dẫn tới file dữ liệu chung (đặt ở gốc repo để dễ sửa trực tiếp trên GitHub). */
export const DATA_URL = 'data.json';

/** Mức đóng quỹ chuẩn cho thành viên công ty (đồng / tháng). */
export const STANDARD_DUES = 50000;

/**
 * Số tháng tự sinh sẵn sau tháng cuối cùng đã ghi.
 *
 * Để 0 vì tháng mới giờ do admin bấm nút "Tạo tháng mới" tạo ra — rõ ràng hơn là
 * bày sẵn vài tháng chưa ai đụng tới trong ô chọn tháng.
 */
export const FUTURE_MONTH_COUNT = 0;

/** Số giao dịch hiển thị ở khối "Giao dịch gần đây". */
export const RECENT_TRANSACTION_COUNT = 10;

/**
 * Danh mục của khoản tiền công ty cấp cho quỹ.
 *
 * Danh mục giao dịch giờ do admin tự quản lý (tab "Danh mục giao dịch",
 * `category-service.js`) nên tên có thể đổi — NHƯNG chuỗi này vẫn phải khớp
 * đúng tên danh mục thật trên Firestore, vì `getCompanyFundTotal()` so khớp
 * theo tên. Danh mục tương ứng được đánh dấu `protected: true` khi tạo, khoá
 * ô Tên trên giao diện để không ai lỡ đổi tên làm lệch công thức này.
 */
export const COMPANY_FUND_CATEGORY = 'Tiền quỹ công ty hàng tháng';

/**
 * Danh mục thu do bảng "Đóng quỹ theo tháng" cung cấp.
 *
 * Tiền đóng quỹ trước đây được gõ tay hai nơi nên hai bản lệch nhau. Nay bảng
 * đóng quỹ là bản chuẩn: các khoản thu thuộc danh mục này không cộng vào tổng
 * nữa, tổng lấy thẳng từ bảng đóng quỹ.
 *
 * Không còn chọn được khi nhập mới, nhưng các dòng cũ vẫn mang danh mục này nên
 * bảng lọc và form sửa vẫn phải hiểu nó.
 */
export const MEMBER_DUES_CATEGORY = 'Tiền quỹ thành viên hàng tháng';

/** Màu dùng khi một danh mục (thường là dòng cũ đã xoá khỏi danh sách) không còn màu riêng. */
export const CATEGORY_COLOR_FALLBACK = '#9aa3af';

/**
 * Ước lượng số người đang xem trang (`presence-service.js`), không phải dữ
 * liệu quỹ. Firebase không cho trang tĩnh đọc thẳng số "Active connections"
 * nội bộ của chính nó (cần tài khoản dịch vụ + máy chủ), nên tự ước lượng
 * bằng nhịp "còn sống" ghi vào Firestore.
 */
export const PRESENCE_HEARTBEAT_MS = 20000;
export const PRESENCE_POLL_MS = 15000;
/** Coi là "đang xem" nếu nhịp gần nhất còn trong khoảng này — nới hơn 2 lần
 *  nhịp tim để một nhịp bị trễ/rớt mạng không làm người đó biến mất khỏi số đếm. */
export const PRESENCE_ONLINE_WINDOW_MS = 50000;
/** Mốc để bật TTL policy tự xoá tài liệu presence cũ trên Firebase Console (không bắt buộc). */
export const PRESENCE_TTL_MS = 5 * 60 * 1000;

/** Khoá lưu trữ trong localStorage / sessionStorage. */
export const STORAGE_KEYS = {
  THEME: 'clb-theme',
  ACTIVE_MEMBERS: 'clb-active-v1',
  DUES_PAID: 'clb-paid-v1',
  DUES_NOTES: 'clb-note-v1',
  DUES_FILL: 'clb-fill-v1',
  DUES_SKIP: 'clb-skip-v1',
  LEDGER_ADDED: 'clb-tx-v1',
  LEDGER_EDITED: 'clb-txedit-v1',
  RULES: 'clb-rules-v1',
  ADDRESS: 'clb-address-v1',
  API_SESSION: 'clb-session-v1',
  PRESENCE_SESSION: 'clb-presence-v1',
};

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

/** Số tháng hiển thị sẵn trong ô chọn tháng; phần cũ hơn nằm sau "Xem thêm". */
export const MONTH_OPTION_LIMIT = 5;

/** Giá trị của dòng "Xem thêm" trong ô chọn tháng. */
export const MONTH_OPTION_MORE = '__more__';

/** Số thành viên hiển thị trên mỗi trang của bảng Thành viên. */
export const MEMBER_PAGE_SIZE = 25;
