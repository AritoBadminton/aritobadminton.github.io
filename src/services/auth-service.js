/**
 * Xác thực quản trị viên.
 *
 * CẢNH BÁO: trang chạy trên GitHub Pages, không có máy chủ, nên việc kiểm tra
 * diễn ra ngay trong trình duyệt. Đây là khoá chống bấm nhầm chứ không phải
 * bảo mật thật — dữ liệu chung vẫn được bảo vệ bởi quyền ghi vào repo GitHub.
 */

import { ADMIN_PASSWORD_HASH, ADMIN_USERNAME, STORAGE_KEYS } from '../config/constants.js';
import { store } from '../state/store.js';
import { apiLogin, clearApiSession, isApiConfigured, loadApiSession } from './api-service.js';
import { readRaw, readSessionRaw, removeKey, writeRaw } from './storage-service.js';

/**
 * Băm SHA-256 một chuỗi, trả về dạng hex.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function hashText(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Khôi phục phiên đăng nhập đã lưu từ lần trước.
 * Có máy chủ lưu trữ thì phiên do máy chủ cấp mới tính, khoá cục bộ bị bỏ qua.
 * @returns {boolean}
 */
export function restoreSession() {
  if (isApiConfigured()) {
    store.isAdmin = Boolean(loadApiSession());
    return store.isAdmin;
  }
  const stored = readRaw(STORAGE_KEYS.AUTH) ?? readSessionRaw(STORAGE_KEYS.AUTH);
  store.isAdmin = stored === ADMIN_PASSWORD_HASH;
  return store.isAdmin;
}

/**
 * Kiểm tra thông tin đăng nhập và mở phiên nếu đúng.
 * @param {string} username tên tài khoản (không phân biệt hoa thường)
 * @param {string} password
 * @param {boolean} remember true thì nhớ qua nhiều phiên, false chỉ giữ trong phiên hiện tại
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(username, password, remember) {
  const normalizedUser = username.trim().toLowerCase();

  if (isApiConfigured()) {
    const result = await apiLogin(normalizedUser, password);
    store.isAdmin = result.ok;
    return result;
  }

  const passwordHash = await hashText(password);
  if (normalizedUser !== ADMIN_USERNAME || passwordHash !== ADMIN_PASSWORD_HASH) {
    return { ok: false, error: 'Sai tài khoản hoặc mật khẩu.' };
  }
  store.isAdmin = true;
  writeRaw(STORAGE_KEYS.AUTH, ADMIN_PASSWORD_HASH, remember);
  return { ok: true };
}

/** Đóng phiên đăng nhập và xoá dấu vết đã lưu. */
export function logout() {
  store.isAdmin = false;
  store.selectedTransactionIds.clear();
  removeKey(STORAGE_KEYS.AUTH);
  clearApiSession();
}
