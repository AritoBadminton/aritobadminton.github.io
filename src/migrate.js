/**
 * Chuyển dữ liệu một lần từ data.json sang Firestore.
 *
 * Chạy trong trình duyệt của quản trị viên, dùng chính phiên đăng nhập của họ —
 * không cần khoá bí mật nào. Trang tự dừng nếu Firestore đã có dữ liệu, để
 * chạy nhầm lần hai không ghi đè lên số liệu đang dùng.
 */

import { FIREBASE_CONFIG, isFirebaseConfigured } from './config/firebase-config.js';
import { commitBatch, firebaseLogin, getConnection, watchAuth } from './services/firebase-service.js';
import { formatMonthLabel } from './utils/format.js';

const log = (message, tone = '') => {
  const line = document.createElement('div');
  line.className = `log-line ${tone}`;
  line.textContent = message;
  document.querySelector('#log').append(line);
  line.scrollIntoView({ block: 'nearest' });
};

/** Dựng danh sách tài liệu cần ghi từ nội dung data.json. */
function buildWrites(data) {
  const writes = [
    {
      path: ['settings', 'club'],
      data: { name: data.club ?? '', updated: data.updated ?? '', notes: data.notes ?? [] },
    },
    { path: ['settings', 'rules'], data: data.rules ?? {} },
    { path: ['settings', 'qr'], data: data.qr ?? {} },
    {
      path: ['settings', 'roster'],
      data: {
        active: Object.fromEntries((data.roster ?? []).map((item) => [item.name, Boolean(item.active)])),
      },
    },
  ];

  (data.months ?? []).forEach((month) => {
    const dues = {};
    (month.members ?? []).forEach((member) => {
      dues[member.name] = {
        paid: Number(member.paid ?? 0),
        note: String(member.note ?? ''),
        skip: Boolean(member.skip),
      };
    });
    writes.push({
      path: ['months', month.month],
      data: { label: month.label ?? formatMonthLabel(month.month), dues },
    });
  });

  const pushRows = (rows, type) =>
    (rows ?? []).forEach((row, index) => {
      writes.push({
        path: ['transactions', `${type}-${String(index).padStart(4, '0')}`],
        data: { type, date: row.date, amount: Number(row.amount), desc: row.desc ?? '', cat: row.cat ?? '' },
      });
    });
  pushRows(data.incomes, 'thu');
  pushRows(data.expenses, 'chi');

  return writes;
}

/** Đọc lại Firestore và đối chiếu với data.json. */
async function verify(data) {
  const { getDoc, doc, getDocs, collection } = await import('firebase/firestore');
  const { db } = getConnection();

  const months = await getDocs(collection(db, 'months'));
  const transactions = await getDocs(collection(db, 'transactions'));
  const roster = (await getDoc(doc(db, 'settings', 'roster'))).data()?.active ?? {};

  const duesCount = months.docs.reduce((sum, item) => sum + Object.keys(item.data().dues ?? {}).length, 0);
  const expectedDues = (data.months ?? []).reduce((sum, month) => sum + (month.members ?? []).length, 0);
  const expectedTx = (data.incomes ?? []).length + (data.expenses ?? []).length;

  const checks = [
    ['Số tháng', months.size, (data.months ?? []).length],
    ['Số dòng đóng quỹ', duesCount, expectedDues],
    ['Số giao dịch thu chi', transactions.size, expectedTx],
    ['Số thành viên', Object.keys(roster).length, (data.roster ?? []).length],
  ];

  let allMatch = true;
  checks.forEach(([label, got, want]) => {
    const same = got === want;
    allMatch = allMatch && same;
    log(`${same ? '✓' : '✗'} ${label}: ${got} / ${want}`, same ? 'ok' : 'bad');
  });
  return allMatch;
}

/** Chạy toàn bộ quá trình chuyển. */
async function runMigration() {
  const button = document.querySelector('#run');
  button.disabled = true;

  try {
    const { getDocs, collection } = await import('firebase/firestore');
    const { db } = getConnection();

    const existing = await getDocs(collection(db, 'months'));
    if (!existing.empty && !document.querySelector('#force').checked) {
      log(`Firestore đã có ${existing.size} tháng — dừng lại để khỏi ghi đè.`, 'bad');
      log('Muốn chuyển lại thì tick ô "Ghi đè" rồi bấm lại.', '');
      button.disabled = false;
      return;
    }

    log('Đang tải data.json…');
    const data = await (await fetch('data.json?t=' + Date.now(), { cache: 'no-store' })).json();

    const writes = buildWrites(data);
    log(`Chuẩn bị ghi ${writes.length} tài liệu…`);
    await commitBatch(writes);
    log('Ghi xong. Đang đối chiếu lại…', 'ok');

    const matched = await verify(data);
    log(
      matched ? 'HOÀN TẤT — số liệu khớp hoàn toàn.' : 'CÓ SAI LỆCH — xem các dòng ✗ ở trên.',
      matched ? 'ok' : 'bad',
    );
  } catch (error) {
    log(`Lỗi: ${error.message}`, 'bad');
    if (String(error.message).includes('permission')) {
      log('Tài khoản này chưa có trong danh sách admins của Firestore.', 'bad');
    }
  }
  button.disabled = false;
}

/** Đăng nhập rồi mở phần chuyển dữ liệu. */
async function handleLogin() {
  const result = await firebaseLogin(
    document.querySelector('#email').value,
    document.querySelector('#password').value,
  );
  if (!result.ok) document.querySelector('#login-error').textContent = result.error;
}

if (!isFirebaseConfigured()) {
  document.querySelector('#state').textContent =
    'Chưa điền src/config/firebase-config.js — làm bước đó trước đã.';
} else {
  document.querySelector('#project').textContent = FIREBASE_CONFIG.projectId;
  watchAuth((state) => {
    document.querySelector('#login-box').hidden = Boolean(state);
    document.querySelector('#run-box').hidden = !state;
    document.querySelector('#state').textContent = state
      ? `Đang đăng nhập: ${state.email}${state.isAdmin ? '' : ' — TÀI KHOẢN NÀY CHƯA CÓ QUYỀN GHI'}`
      : 'Chưa đăng nhập.';
  });
  document.querySelector('#login').addEventListener('click', handleLogin);
  document.querySelector('#run').addEventListener('click', runMigration);
}
