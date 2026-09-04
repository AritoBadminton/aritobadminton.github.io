/** Hộp thoại đăng nhập quản trị và nút bật/tắt phiên trên header. */

import { login, logout, restoreSession } from '../services/auth-service.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { enforceVisibleTab } from './tab-nav.js';
import { qs } from '../utils/dom.js';

/** Cập nhật giao diện theo trạng thái đăng nhập hiện tại. */
export function applyAuthState() {
  if (!store.isAdmin) store.selectedTransactionIds.clear();
  document.body.classList.toggle('is-admin', store.isAdmin);
  qs('#auth-icon').textContent = store.isAdmin ? '✓' : '🔒';
  qs('#auth-label').textContent = store.isAdmin ? 'Admin' : 'Đăng nhập';
  qs('#auth-toggle').title = store.isAdmin ? 'Bấm để đăng xuất' : 'Đăng nhập để chỉnh sửa';
  enforceVisibleTab();
  if (store.data) requestRender('dashboard', 'ledger', 'members', 'months');
}

/** Mở hộp thoại đăng nhập với ô mật khẩu trống. */
function openLoginModal() {
  qs('#login-error').textContent = '';
  qs('#login-password').value = '';
  qs('#login-username').value = 'Admin';
  qs('#login-modal').hidden = false;
  qs('#login-password').focus();
}

/** Đóng hộp thoại đăng nhập. */
function closeLoginModal() {
  qs('#login-modal').hidden = true;
}

/** Kiểm tra thông tin và mở phiên nếu hợp lệ. */
async function handleSubmit() {
  const username = qs('#login-username').value;
  const password = qs('#login-password').value;
  const remember = qs('#login-remember').checked;

  const success = await login(username, password, remember);
  if (!success) {
    qs('#login-error').textContent = 'Sai tài khoản hoặc mật khẩu.';
    qs('#login-password').select();
    return;
  }
  closeLoginModal();
  applyAuthState();
}

/** Đóng phiên đăng nhập. */
function handleLogout() {
  logout();
  applyAuthState();
}

/** Gắn toàn bộ sự kiện cho luồng đăng nhập. */
export function initLoginModal() {
  restoreSession();
  applyAuthState();

  qs('#auth-toggle').addEventListener('click', () => {
    if (store.isAdmin) handleLogout();
    else openLoginModal();
  });
  qs('#readonly-login').addEventListener('click', openLoginModal);
  qs('#login-submit').addEventListener('click', handleSubmit);
  qs('#login-cancel').addEventListener('click', closeLoginModal);
  qs('#login-modal').addEventListener('click', (event) => {
    if (event.target.id === 'login-modal') closeLoginModal();
  });
  ['#login-username', '#login-password'].forEach((selector) => {
    qs(selector).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handleSubmit();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !qs('#login-modal').hidden) closeLoginModal();
  });
}
