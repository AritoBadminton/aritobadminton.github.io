/**
 * Nói chuyện với Cloudflare Worker — nơi giữ token GitHub.
 *
 * Trang không bao giờ cầm token. Đăng nhập xong Worker cấp một vé có hạn,
 * mỗi lần lưu trang gửi kèm vé đó; Worker kiểm tra rồi mới commit data.json.
 * Khi data.json chưa khai báo "api" thì mọi hàm ở đây báo chưa cấu hình và
 * trang quay về luồng cũ: xuất JSON để dán tay.
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { store } from '../state/store.js';
import { readJson, removeKey, writeJson } from './storage-service.js';

/** Chờ tối đa bao lâu cho một lời gọi, tránh treo giao diện khi Worker chết. */
const REQUEST_TIMEOUT_MS = 20000;

/** Địa chỉ Worker khai báo trong data.json, đã bỏ dấu "/" thừa ở cuối. */
export function getApiBaseUrl() {
  return String(store.data?.api?.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
}

/** Đã khai báo Worker hay chưa. */
export function isApiConfigured() {
  return getApiBaseUrl().length > 0;
}

/** Nạp phiên đăng nhập đã lưu; bỏ luôn nếu hết hạn. */
export function loadApiSession() {
  const saved = readJson(STORAGE_KEYS.API_SESSION, null);
  if (!saved?.token || (saved.expiresAt ?? 0) * 1000 < Date.now()) {
    store.apiSession = null;
    return null;
  }
  store.apiSession = saved;
  return saved;
}

/** Xoá phiên đăng nhập khỏi máy. */
export function clearApiSession() {
  store.apiSession = null;
  removeKey(STORAGE_KEYS.API_SESSION);
}

/**
 * Gọi Worker và luôn trả về một đối tượng, không ném lỗi ra ngoài.
 * @returns {Promise<{ok: boolean, error?: string, [key: string]: unknown}>}
 */
async function callApi(path, body, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: result.error ?? `Máy chủ báo lỗi ${response.status}.`,
      };
    }
    return { ok: true, ...result };
  } catch (error) {
    const message =
      error.name === 'AbortError'
        ? 'Máy chủ lưu trữ không phản hồi. Kiểm tra lại mạng rồi thử lại.'
        : 'Không kết nối được máy chủ lưu trữ. Kiểm tra lại mạng rồi thử lại.';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Đăng nhập qua Worker và giữ lại vé nếu thành công.
 * @param {string} user
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function apiLogin(user, password) {
  const result = await callApi('/login', { user, password });
  if (!result.ok) return result;

  store.apiSession = { user: result.user, token: result.token, expiresAt: result.expiresAt };
  writeJson(STORAGE_KEYS.API_SESSION, store.apiSession);
  return { ok: true };
}

/**
 * Gửi một phần dữ liệu lên Worker để commit vào data.json.
 * @param {'rules'|'roster'|'month'|'ledger'} section
 * @param {object} payload
 * @returns {Promise<{ok: boolean, data?: object, message?: string, error?: string}>}
 */
export async function apiSave(section, payload) {
  if (!store.apiSession?.token) {
    return { ok: false, error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' };
  }

  const result = await callApi('/save', { section, payload }, store.apiSession.token);
  if (!result.ok && result.status === 401) clearApiSession();
  return result;
}

/** Tên người đang đăng nhập, để hiện lên giao diện. */
export function getApiUserName() {
  return store.apiSession?.user ?? '';
}
