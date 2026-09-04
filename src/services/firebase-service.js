/**
 * Kết nối Firebase: đăng nhập, lắng nghe dữ liệu theo thời gian thực, và ghi.
 *
 * Mỗi thay đổi của admin được ghi thẳng lên Firestore; Firestore đẩy ngược về
 * mọi máy đang mở trang, nên cả nhóm thấy cùng lúc mà không cần tải lại.
 *
 * Đường dẫn dữ liệu:
 *   settings/club          { name, updated }
 *   settings/rules         { title, subtitle, items[], footer }
 *   settings/qr            { image, name, account, bank, note }
 *   settings/roster        { active: { "<tên>": true|false } }
 *   months/<YYYY-MM>       { label, dues: { "<tên>": { paid, note, skip } } }
 *   transactions/<id>      { type: 'thu'|'chi', date, amount, desc, cat }
 *   admins/<uid>           { email, name }  — chỉ đọc, sửa trong Firebase Console
 */

import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config/firebase-config.js';

/** Số tài liệu tối đa trong một lô ghi của Firestore. */
const BATCH_LIMIT = 450;

/** Kết nối đã dựng: { app, db, auth }. */
let connection = null;

/** Huỷ các lắng nghe đang chạy khi cần dựng lại. */
let unsubscribers = [];

/* ---------- Kết nối ---------- */

/** Dựng kết nối Firebase một lần rồi dùng lại. */
export function getConnection() {
  if (!connection) {
    const app = initializeApp(FIREBASE_CONFIG);
    connection = { app, db: getFirestore(app), auth: getAuth(app) };
  }
  return connection;
}

/* ---------- Đăng nhập ---------- */

/**
 * Đăng nhập bằng email và mật khẩu.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function firebaseLogin(email, password) {
  const { auth } = getConnection();
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeAuthError(error) };
  }
}

/** Đóng phiên đăng nhập. */
export async function firebaseLogout() {
  await signOut(getConnection().auth);
}

/**
 * Theo dõi trạng thái đăng nhập và cho biết người đó có quyền ghi hay không.
 * @param {(state: {email: string, isAdmin: boolean}|null) => void} onChange
 */
export function watchAuth(onChange) {
  const { auth, db } = getConnection();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onChange(null);
      return;
    }
    // Có tài khoản chưa chắc có quyền ghi: phải nằm trong danh sách admins.
    let isAdmin = false;
    try {
      isAdmin = (await getDoc(doc(db, 'admins', user.uid))).exists();
    } catch {
      isAdmin = false;
    }
    onChange({ email: user.email ?? '', isAdmin });
  });
}

/** Đổi mã lỗi khô khan của Firebase thành câu tiếng Việt dễ hiểu. */
function describeAuthError(error) {
  const messages = {
    'auth/invalid-email': 'Email không đúng định dạng.',
    'auth/invalid-credential': 'Sai email hoặc mật khẩu.',
    'auth/wrong-password': 'Sai email hoặc mật khẩu.',
    'auth/user-not-found': 'Sai email hoặc mật khẩu.',
    'auth/user-disabled': 'Tài khoản này đã bị khoá.',
    'auth/too-many-requests': 'Sai quá nhiều lần, thử lại sau ít phút.',
    'auth/network-request-failed': 'Không kết nối được. Kiểm tra lại mạng.',
  };
  return messages[error?.code] ?? 'Không đăng nhập được, thử lại giúp tôi.';
}

/* ---------- Lắng nghe dữ liệu ---------- */

/**
 * Lắng nghe toàn bộ dữ liệu và gọi lại mỗi khi có thay đổi từ bất kỳ máy nào.
 * @param {(data: object) => void} onData nhận dữ liệu đã gộp thành hình dạng cũ
 * @param {(message: string) => void} onError
 */
export function watchClubData(onData, onError) {
  const { db } = getConnection();
  stopWatching();

  const parts = { settings: {}, months: null, transactions: null };
  const publish = () => {
    if (parts.months && parts.transactions) onData(buildClubData(parts));
  };
  const fail = () => onError('Mất kết nối tới Firebase. Số liệu đang xem có thể chưa mới nhất.');

  ['club', 'rules', 'qr', 'roster'].forEach((name) => {
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', name),
        (snapshot) => {
          parts.settings[name] = snapshot.data() ?? {};
          publish();
        },
        fail,
      ),
    );
  });

  unsubscribers.push(
    onSnapshot(
      collection(db, 'months'),
      (snapshot) => {
        parts.months = snapshot.docs.map((item) => ({ month: item.id, ...item.data() }));
        publish();
      },
      fail,
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        parts.transactions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        publish();
      },
      fail,
    ),
  );
}

/** Ngừng mọi lắng nghe. */
export function stopWatching() {
  unsubscribers.forEach((stop) => stop());
  unsubscribers = [];
}

/**
 * Gộp dữ liệu Firestore về đúng hình dạng mà phần còn lại của ứng dụng đang dùng,
 * nhờ vậy các màn hình không cần biết dữ liệu đến từ đâu.
 */
function buildClubData(parts) {
  const { settings, months, transactions } = parts;
  const activeMap = settings.roster?.active ?? {};

  const monthList = months
    .map((item) => {
      const dues = item.dues ?? {};
      const members = Object.keys(dues).map((name) => {
        const entry = dues[name] ?? {};
        const row = { name, paid: Number(entry.paid ?? 0), note: String(entry.note ?? '') };
        if (entry.skip) row.skip = true;
        return row;
      });
      return {
        month: item.month,
        label: item.label ?? '',
        total: members.reduce((sum, row) => sum + row.paid, 0),
        members,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const pick = (type) =>
    transactions
      .filter((item) => item.type === type)
      .map((item) => ({ id: item.id, date: item.date, amount: item.amount, desc: item.desc, cat: item.cat }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const roster = [
    ...new Set([...Object.keys(activeMap), ...monthList.flatMap((m) => m.members.map((x) => x.name))]),
  ]
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((name) => ({ name, active: Boolean(activeMap[name]) }));

  return {
    club: settings.club?.name ?? 'CLB Cầu Lông',
    updated: settings.club?.updated ?? '',
    rules: settings.rules ?? {},
    qr: settings.qr ?? {},
    notes: settings.club?.notes ?? [],
    roster,
    months: monthList,
    incomes: pick('thu'),
    expenses: pick('chi'),
  };
}

/* ---------- Ghi dữ liệu ---------- */

/** Ghi lại danh sách mức đóng quỹ. */
export function saveRuleItems(items) {
  const { db } = getConnection();
  return setDoc(doc(db, 'settings', 'rules'), { items }, { merge: true });
}

/** Đánh dấu một thành viên còn hoạt động hay không. */
export function saveMemberActive(name, isActive) {
  const { db } = getConnection();
  return setDoc(doc(db, 'settings', 'roster'), { active: { [name]: isActive } }, { merge: true });
}

/**
 * Ghi một ô trong bảng đóng quỹ của một tháng.
 * Dùng merge nên hai người sửa hai thành viên khác nhau trong cùng tháng
 * không ghi đè lên nhau.
 */
export function saveDuesEntry(monthKey, memberName, entry, label) {
  const { db } = getConnection();
  return setDoc(doc(db, 'months', monthKey), { label, dues: { [memberName]: entry } }, { merge: true });
}

/** Ghi nhiều dòng đóng quỹ của một tháng cùng lúc. */
export function saveDuesRows(monthKey, label, rows) {
  const { db } = getConnection();
  const dues = {};
  rows.forEach((row) => {
    dues[row.name] = { paid: row.paid, note: row.note, skip: Boolean(row.skip) };
  });
  return setDoc(doc(db, 'months', monthKey), { label, dues }, { merge: true });
}

/** Thêm một khoản thu hoặc chi, trả về mã tài liệu vừa tạo. */
export async function addTransaction(entry) {
  const { db } = getConnection();
  const created = await addDoc(collection(db, 'transactions'), entry);
  await touchUpdated(entry.date);
  return created.id;
}

/** Sửa một khoản thu chi đã có. */
export async function updateTransaction(id, changes) {
  const { db } = getConnection();
  await updateDoc(doc(db, 'transactions', id), changes);
  if (changes.date) await touchUpdated(changes.date);
}

/** Xoá một khoản thu chi. */
export function deleteTransaction(id) {
  const { db } = getConnection();
  return deleteDoc(doc(db, 'transactions', id));
}

/** Cập nhật ngày giao dịch mới nhất, chỉ khi ngày mới thật sự muộn hơn. */
async function touchUpdated(date) {
  const { db } = getConnection();
  const ref = doc(db, 'settings', 'club');
  const current = (await getDoc(ref)).data()?.updated ?? '';
  if (String(date) > String(current)) await setDoc(ref, { updated: date }, { merge: true });
}

/**
 * Ghi nhiều tài liệu theo lô, tự chia nhỏ cho vừa giới hạn của Firestore.
 * @param {{path: string[], data: object, merge?: boolean}[]} writes
 */
export async function commitBatch(writes) {
  const { db } = getConnection();
  for (let start = 0; start < writes.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(start, start + BATCH_LIMIT).forEach((item) => {
      batch.set(doc(db, ...item.path), item.data, { merge: item.merge ?? false });
    });
    await batch.commit();
  }
}
