/**
 * Firebase Auth giả lập: danh sách tài khoản cố định, phiên giữ trong
 * localStorage để kiểm tra được việc nhớ đăng nhập sau khi tải lại.
 */
const USERS = {
  'nghia@arito.vn': { password: 'MatKhauRatDai#2026', uid: 'uid-nghia' },
  'lu@arito.vn': { password: 'MatKhauKhac#2026', uid: 'uid-lu' },
  'khach@arito.vn': { password: 'KhachKhongPhaiAdmin#1', uid: 'uid-khach' },
};
const SESSION_KEY = '__fakeauth__';
const watchers = new Set();

const current = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
const notify = () => watchers.forEach((fn) => fn(current()));

export function getAuth() {
  // Firebase thật cho đọc auth.currentUser bất cứ lúc nào, nên stub cũng phải có.
  return {
    kind: 'fake-auth',
    get currentUser() {
      return current();
    },
  };
}
export async function setPersistence() {}
export const browserLocalPersistence = 'local';

export function onAuthStateChanged(_auth, callback) {
  watchers.add(callback);
  queueMicrotask(() => callback(current()));
  return () => watchers.delete(callback);
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const found = USERS[String(email).trim().toLowerCase()];
  if (!found || found.password !== password) {
    const error = new Error('sai thông tin');
    error.code = 'auth/invalid-credential';
    throw error;
  }
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ uid: found.uid, email: String(email).trim().toLowerCase() }),
  );
  notify();
}

export async function signOut() {
  localStorage.removeItem(SESSION_KEY);
  notify();
}

/* ---------- Đổi mật khẩu ---------- */

export const EmailAuthProvider = {
  credential: (email, password) => ({ email, password }),
};

export async function reauthenticateWithCredential(user, credential) {
  const found = USERS[String(credential.email).trim().toLowerCase()];
  if (!found || found.password !== credential.password) {
    const error = new Error('sai mật khẩu hiện tại');
    error.code = 'auth/invalid-credential';
    throw error;
  }
  return { user };
}

export async function updatePassword(user, newPassword) {
  const found = USERS[String(user.email).trim().toLowerCase()];
  if (!found) throw new Error('không có tài khoản');
  found.password = newPassword;
  // Đếm lại cho bài kiểm thử biết lệnh đổi đã chạy tới nơi.
  window.__stubPasswordChanges = (window.__stubPasswordChanges ?? 0) + 1;
}

export async function sendPasswordResetEmail(_auth, email) {
  const address = String(email).trim().toLowerCase();
  if (!USERS[address]) {
    const error = new Error('không có tài khoản');
    error.code = 'auth/user-not-found';
    throw error;
  }
  window.__stubResetEmails = [...(window.__stubResetEmails ?? []), address];
}
