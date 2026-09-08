/** Hộp thoại đăng nhập quản trị, đổi mật khẩu, và nút bật/tắt phiên trên header. */

import { login, logout, restoreSession } from '../services/auth-service.js';
import { firebaseApi, isFirebaseMode } from '../services/data-source.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { enforceVisibleTab } from './tab-nav.js';
import { escapeHtml, qs, setVisible } from '../utils/dom.js';

/** Firebase bắt mật khẩu tối thiểu 6 ký tự. */
const MIN_PASSWORD_LENGTH = 6;

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
  // Khách chưa đăng nhập không cần thanh nhắc nào; chỉ người đăng nhập được mà
  // chưa có quyền ghi mới cần biết vì sao mình không sửa được gì.
  const needsGrant = signedIn && !store.isAdmin;
  setVisible(qs('#readonly-bar'), needsGrant, 'flex');
  qs('#readonly-text').innerHTML = needsGrant
    ? `Tài khoản <b>${escapeHtml(store.authEmail)}</b> chưa được cấp quyền chỉnh sửa — ` +
      'nhờ thủ quỹ thêm bạn vào danh sách quản trị.'
    : '';
  const passwordButton = qs('#password-toggle');
  if (passwordButton) passwordButton.style.display = isFirebaseMode() && signedIn ? '' : 'none';
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

/* ---------- Đổi mật khẩu ---------- */

/** Mở hộp thoại đổi mật khẩu với ba ô trống. */
function openPasswordModal() {
  qs('#password-error').textContent = '';
  ['#password-current', '#password-new', '#password-confirm'].forEach((selector) => {
    qs(selector).value = '';
  });
  qs('#password-email').textContent = store.authEmail;
  qs('#password-modal').hidden = false;
  qs('#password-current').focus();
}

/** Đóng hộp thoại đổi mật khẩu. */
function closePasswordModal() {
  qs('#password-modal').hidden = true;
}

/** Kiểm tra rồi đổi mật khẩu của chính người đang đăng nhập. */
async function handleChangePassword() {
  const current = qs('#password-current').value;
  const next = qs('#password-new').value;
  const confirm = qs('#password-confirm').value;
  const error = qs('#password-error');

  if (!current || !next) {
    error.textContent = 'Điền đủ mật khẩu hiện tại và mật khẩu mới.';
    return;
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    error.textContent = `Mật khẩu mới phải từ ${MIN_PASSWORD_LENGTH} ký tự trở lên.`;
    return;
  }
  if (next !== confirm) {
    error.textContent = 'Hai ô mật khẩu mới chưa giống nhau.';
    return;
  }
  if (next === current) {
    error.textContent = 'Mật khẩu mới trùng với mật khẩu cũ.';
    return;
  }

  const button = qs('#password-submit');
  button.disabled = true;
  button.textContent = 'Đang đổi…';

  const result = await firebaseApi().changePassword(current, next);

  button.disabled = false;
  button.textContent = 'Đổi mật khẩu';

  if (!result.ok) {
    error.textContent = result.error ?? 'Không đổi được mật khẩu.';
    return;
  }
  closePasswordModal();
  window.alert('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.');
}

/** Gửi thư đặt lại mật khẩu tới email đang gõ ở ô tài khoản. */
async function handleForgotPassword() {
  const email = qs('#login-username').value.trim();
  const error = qs('#login-error');
  if (!email) {
    error.textContent = 'Gõ email vào ô Tài khoản trước, rồi bấm lại.';
    qs('#login-username').focus();
    return;
  }
  const result = await firebaseApi().sendResetEmail(email);
  error.textContent = result.ok
    ? `Đã gửi thư đặt lại mật khẩu tới ${email}. Kiểm tra hộp thư, cả mục spam.`
    : (result.error ?? 'Không gửi được thư.');
}

/** Gắn toàn bộ sự kiện cho luồng đăng nhập. */
export function initLoginModal() {
  applyAuthState();

  qs('#auth-toggle').addEventListener('click', () => {
    if (store.isAdmin || store.authEmail) handleLogout();
    else openLoginModal();
  });
  qs('#password-toggle').addEventListener('click', openPasswordModal);
  qs('#password-cancel').addEventListener('click', closePasswordModal);
  qs('#password-submit').addEventListener('click', handleChangePassword);
  qs('#login-forgot').addEventListener('click', handleForgotPassword);
  qs('#password-modal').addEventListener('click', (event) => {
    if (event.target.id === 'password-modal') closePasswordModal();
  });
  ['#password-current', '#password-new', '#password-confirm'].forEach((selector) => {
    qs(selector).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handleChangePassword();
    });
  });
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
    if (event.key !== 'Escape') return;
    if (!qs('#login-modal').hidden) closeLoginModal();
    if (!qs('#password-modal').hidden) closePasswordModal();
  });

  // Ô "Quên mật khẩu" chỉ có nghĩa ở chế độ Firebase.
  qs('#login-forgot-row').style.display = isFirebaseMode() ? '' : 'none';
}

/**
 * Khôi phục phiên đăng nhập sau khi đã tải xong data.json.
 * Phải chờ tới lúc này vì địa chỉ máy chủ lưu trữ nằm trong data.json.
 */
export function restoreAuthState() {
  restoreSession();
  applyAuthState();
}
