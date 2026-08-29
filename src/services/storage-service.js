/**
 * Bọc localStorage / sessionStorage để mọi lời gọi đều an toàn.
 * Trình duyệt ở chế độ ẩn danh có thể ném lỗi khi ghi, nên luôn bắt lỗi.
 */

/**
 * Đọc và parse JSON từ localStorage.
 * @template T
 * @param {string} key
 * @param {T} fallback giá trị trả về khi không có dữ liệu hoặc lỗi
 * @returns {T}
 */
export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Ghi giá trị dạng JSON vào localStorage.
 * @param {string} key
 * @param {unknown} value
 */
export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* bộ nhớ bị chặn — bỏ qua, ứng dụng vẫn chạy được trong phiên này */
  }
}

/**
 * Đọc chuỗi thô từ localStorage.
 * @param {string} key
 * @returns {string|null}
 */
export function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Ghi chuỗi thô vào localStorage hoặc sessionStorage.
 * @param {string} key
 * @param {string} value
 * @param {boolean} [persist=true] true dùng localStorage, false dùng sessionStorage
 */
export function writeRaw(key, value, persist = true) {
  try {
    (persist ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Đọc chuỗi thô từ sessionStorage.
 * @param {string} key
 * @returns {string|null}
 */
export function readSessionRaw(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Xoá khoá khỏi cả hai vùng lưu trữ.
 * @param {string} key
 */
export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* bỏ qua */
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* bỏ qua */
  }
}
