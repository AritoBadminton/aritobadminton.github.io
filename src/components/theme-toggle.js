/** Nút chuyển giao diện sáng/tối, ghi nhớ lựa chọn trên máy người dùng. */

import { STORAGE_KEYS } from '../config/constants.js';
import { readRaw, writeRaw } from '../services/storage-service.js';
import { qs } from '../utils/dom.js';

/** Áp dụng giao diện đã lưu từ lần truy cập trước. */
function applyStoredTheme() {
  const stored = readRaw(STORAGE_KEYS.THEME);
  if (stored) document.documentElement.setAttribute('data-theme', stored);
}

/** Đảo giữa sáng và tối, dựa trên cài đặt hệ điều hành khi chưa chọn thủ công. */
function handleToggleClick() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current ? current === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  writeRaw(STORAGE_KEYS.THEME, next);
}

/** Gắn sự kiện cho nút chuyển giao diện. */
export function initThemeToggle() {
  applyStoredTheme();
  qs('#theme-toggle').addEventListener('click', handleToggleClick);
}
