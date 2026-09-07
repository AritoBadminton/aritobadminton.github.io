/**
 * Nhập lại toàn bộ bảng đóng quỹ và sổ thu chi từ data.json.
 *
 * Khác với lần chuyển đầu tiên: trang này XOÁ SẠCH hai bộ sưu tập "months" và
 * "transactions" trước khi ghi, nên số liệu cũ không còn sót lại dòng nào.
 *
 * Cố ý KHÔNG đụng tới settings/roster, settings/qr, settings/rules và admins —
 * danh sách hoạt động, số thứ tự tự đặt, mã QR và quyền quản trị giữ nguyên.
 */

import { FIREBASE_CONFIG, isFirebaseConfigured } from './config/firebase-config.js';
import {
  commitBatch,
  commitDeletes,
  firebaseLogin,
  getConnection,
  watchAuth,
} from './services/firebase-service.js';
import { formatCurrency, formatMonthLabel } from './utils/format.js';

const log = (message, tone = '') => {
  const line = document.createElement('div');
  line.className = `log-line ${tone}`;
  line.textContent = message;
  document.querySelector('#log').append(line);
  line.scrollIntoView({ block: 'nearest' });
};

/* ---------- Đọc dữ liệu ---------- */

/** Tải data.json, không lấy bản trong bộ nhớ đệm. */
async function fetchData() {
  return (await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' })).json();
}

/** Đếm những gì Firestore đang có. */
async function readCurrent() {
  const { getDocs, collection } = await import('firebase/firestore');
  const { db } = getConnection();
  const months = await getDocs(collection(db, 'months'));
  const transactions = await getDocs(collection(db, 'transactions'));
  const dues = months.docs.reduce((sum, item) => sum + Object.keys(item.data().dues ?? {}).length, 0);
  return { months, transactions, dues };
}

/* ---------- Dựng nội dung sẽ ghi ---------- */

/** Đổi data.json thành danh sách tài liệu months/ và transactions/. */
function buildWrites(data) {
  const writes = [];

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

/* ---------- Đối chiếu ---------- */

/** Đọc lại Firestore và so từng con số với data.json. */
async function verify(data) {
  const { months, transactions, dues } = await readCurrent();

  const sumBy = (rows) => (rows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  let gotThu = 0;
  let gotChi = 0;
  transactions.docs.forEach((item) => {
    const row = item.data();
    if (row.type === 'thu') gotThu += Number(row.amount ?? 0);
    else gotChi += Number(row.amount ?? 0);
  });

  const expectedDues = (data.months ?? []).reduce((sum, month) => sum + (month.members ?? []).length, 0);

  const checks = [
    ['Số tháng', months.size, (data.months ?? []).length],
    ['Số dòng đóng quỹ', dues, expectedDues],
    ['Số giao dịch thu chi', transactions.size, (data.incomes ?? []).length + (data.expenses ?? []).length],
    ['Tổng thu', gotThu, sumBy(data.incomes)],
    ['Tổng chi', gotChi, sumBy(data.expenses)],
  ];

  let allMatch = true;
  checks.forEach(([label, got, want]) => {
    const same = got === want;
    allMatch = allMatch && same;
    const show = label.startsWith('Tổng') ? (value) => formatCurrency(value) : (value) => String(value);
    log(`${same ? '✓' : '✗'} ${label}: ${show(got)} / ${show(want)}`, same ? 'ok' : 'bad');
  });
  log(`Số dư sau khi nhập: ${formatCurrency(gotThu - gotChi)}`, '');
  return allMatch;
}

/* ---------- Chạy ---------- */

/** Xoá sạch rồi ghi lại. */
async function runImport() {
  const button = document.querySelector('#run');
  button.disabled = true;

  try {
    if (!document.querySelector('#force').checked) {
      log('Chưa tick ô xác nhận — dừng lại, chưa xoá gì cả.', 'bad');
      button.disabled = false;
      return;
    }

    const data = await fetchData();
    const { months, transactions } = await readCurrent();

    const paths = [
      ...months.docs.map((item) => ['months', item.id]),
      ...transactions.docs.map((item) => ['transactions', item.id]),
    ];
    log(`Đang xoá ${months.size} tháng và ${transactions.size} giao dịch…`);
    await commitDeletes(paths);
    log('Đã xoá sạch.', 'ok');

    const writes = buildWrites(data);
    log(`Đang ghi lại ${writes.length} tài liệu từ data.json…`);
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

/** Cho xem trước cái gì mất, cái gì thay vào, trước khi bấm. */
async function showPreview() {
  try {
    const data = await fetchData();
    const { months, transactions, dues } = await readCurrent();
    const newDues = (data.months ?? []).reduce((sum, month) => sum + (month.members ?? []).length, 0);
    const newTx = (data.incomes ?? []).length + (data.expenses ?? []).length;
    document.querySelector('#preview').innerHTML =
      `<b>Sẽ xoá:</b> ${months.size} tháng · ${dues} dòng đóng quỹ · ${transactions.size} giao dịch<br>` +
      `<b>Ghi lại:</b> ${(data.months ?? []).length} tháng · ${newDues} dòng đóng quỹ · ${newTx} giao dịch`;
  } catch (error) {
    document.querySelector('#preview').textContent = `Không đọc được số liệu: ${error.message}`;
  }
}

/** Đăng nhập bằng tài khoản quản trị. */
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
    if (state) showPreview();
  });
  document.querySelector('#login').addEventListener('click', handleLogin);
  document.querySelector('#run').addEventListener('click', runImport);
}
