/** Hộp thoại đăng nhập quản trị và nút bật/tắt phiên trên header. */

import { login, logout, restoreSession } from '../services/auth-service.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { isFirebaseMode } from '../services/data-source.js';
import { enforceVisibleTab } from './tab-nav.js';
import { escapeHtml, qs } from '../utils/dom.js';

/** Cập nhật giao diện theo trạng thái đăng nhập hiện tại. */
export function applyAuthState() {
  if (!store.isAdmin) store.selectedTransactionIds.clear();
  // Đăng nhập được nhưng chưa được cấp quyền là một trạng thái riêng: phải nói rõ
  // lý do và vẫn cho đăng xuất, nếu không người đó sẽ bị kẹt ở màn hình chỉ xem.
  const signedIn = store.isAdmin || Boolean(store.authEmail);
  const shortName = store.authEmail.split('@')[0];

  document.body.classList.toggle('is-admin', store.isAdmin);
  qs('#auth-icon').textContent = store.isAdmin ? '✓' : signedIn ? '!' : '🔒';
  qs('#auth-label').textContent = signedIn ? shortName || 'Admin' : 'Đăng nhập';
  qs('#auth-toggle').title = signedIn ? 'Bấm để đăng xuất' : 'Đăng nhập để chỉnh sửa';
  qs('#readonly-text').innerHTML =
    signedIn && !store.isAdmin
      ? `Tài khoản <b>${escapeHtml(store.authEmail)}</b> chưa được cấp quyền chỉnh sửa — ` +
        'nhờ thủ quỹ thêm bạn vào danh sách quản trị.'
      : 'Đang ở <b>chế độ chỉ xem</b> — đăng nhập để nhập liệu và chỉnh sửa.';
  enforceVisibleTab();
  if (store.data) requestRender('dashboard', 'ledger', 'members', 'months');
}

/** Mở hộp thoại đăng nhập với ô mật khẩu trống. */
function openLoginModal() {
  qs('#login-error').textContent = '';
  qs('#login-password').value = '';
  if (isFirebaseMode()) {
    qs('#login-username-label').firstChild.textContent = 'Email';
    qs('#login-username').type = 'email';
    qs('#login-username').placeholder = 'ten@vidu.com';
    qs('#login-username').value = '';
  } else {
    qs('#login-username').value = 'Admin';
  }
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

  const submitButton = qs('#login-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Đang kiểm tra…';

  const result = await login(username, password, remember);

  submitButton.disabled = false;
  submitButton.textContent = 'Đăng nhập';

  if (!result.ok) {
    qs('#login-error').textContent = result.error ?? 'Sai tài khoản hoặc mật khẩu.';
    qs('#login-password').select();
    return;
  }
  closeLoginModal();
  applyAuthState();
}

/** Đóng phiên đăng nhập. */
async function handleLogout() {
  await logout();
  if (!isFirebaseMode()) applyAuthState();
}

/** Gắn toàn bộ sự kiện cho luồng đăng nhập. */
export function initLoginModal() {
  applyAuthState();

  qs('#auth-toggle').addEventListener('click', () => {
    if (store.isAdmin || store.authEmail) handleLogout();
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

/**
 * Khôi phục phiên đăng nhập sau khi đã tải xong data.json.
 * Phải chờ tới lúc này vì địa chỉ máy chủ lưu trữ nằm trong data.json.
 */
export function restoreAuthState() {
  restoreSession();
  applyAuthState();
}
