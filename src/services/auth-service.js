/**
 * Xác thực quản trị viên.
 *
 * Chế độ Firebase (trang thật đang chạy chế độ này): Firebase Auth tự giữ
 * phiên đăng nhập, watchAuth() trong main.js báo lại trạng thái isAdmin.
 * Chế độ Worker (worker/, hiện không dùng, giữ phòng khi quay lại lưu bằng
 * Git): phiên do Worker cấp một vé có hạn, xem api-service.js.
 */

import { store } from '../state/store.js';
import { apiLogin, clearApiSession, isApiConfigured, loadApiSession } from './api-service.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';

/**
 * Khôi phục phiên đăng nhập đã lưu từ lần trước.
 * @returns {boolean}
 */
export function restoreSession() {
  // Chế độ Firebase: phiên do Firebase khôi phục, watchAuth sẽ báo lại.
  if (isFirebaseMode()) return store.isAdmin;
  if (isApiConfigured()) {
    store.isAdmin = Boolean(loadApiSession());
    return store.isAdmin;
  }
  store.isAdmin = false;
  return store.isAdmin;
}

/**
 * Kiểm tra thông tin đăng nhập và mở phiên nếu đúng.
 * @param {string} username tên tài khoản (không phân biệt hoa thường)
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(username, password) {
  if (isFirebaseMode()) {
    // Firebase tự giữ phiên; trạng thái isAdmin do watchAuth cập nhật.
    return firebaseApi().firebaseLogin(username, password);
  }

  if (isApiConfigured()) {
    const result = await apiLogin(username.trim().toLowerCase(), password);
    store.isAdmin = result.ok;
    return result;
  }

  return { ok: false, error: 'Chưa cấu hình nơi đăng nhập (Firebase hoặc máy chủ lưu trữ).' };
}

/** Đóng phiên đăng nhập và xoá dấu vết đã lưu. */
export function logout() {
  if (isFirebaseMode()) {
    return firebaseApi().firebaseLogout();
  }
  store.isAdmin = false;
  clearApiSession();
}
