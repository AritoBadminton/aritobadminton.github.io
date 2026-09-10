import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8199';
let pass = 0,
  fail = 0;
const check = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log(ok ? `✓ ${n}` : `✗ ${n}\n   nhận: ${JSON.stringify(g)}\n   cần : ${JSON.stringify(w)}`);
  ok ? pass++ : fail++;
};
const THIS = new Date().toISOString().slice(0, 7);
const prevKey = (k) => {
  const [y, m] = k.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
const PREV = prevKey(THIS);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// Đóng quỹ: tháng trước 100.000, tháng này 70.000 → tổng 170.000.
// Sổ thu chi có sẵn một khoản "Tiền quỹ thành viên hàng tháng" 90.000 (bản gõ tay cũ,
// lệch với bảng đóng quỹ) và một khoản quỹ công ty 500.000, cùng một khoản chi 200.000.
await page.addInitScript(
  ([thisM, prevM]) => {
    if (localStorage.getItem('__fakestore__')) return;
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: { active: { An: true, Bình: true }, order: { An: 1, Bình: 2 } },
        },
        months: {
          [prevM]: {
            label: 'Tháng trước',
            dues: {
              An: { paid: 50000, note: '', skip: false },
              Bình: { paid: 50000, note: '', skip: false },
            },
          },
          [thisM]: {
            label: 'Tháng này',
            dues: {
              An: { paid: 70000, note: '', skip: false },
              Bình: { paid: 0, note: '', skip: false },
            },
          },
        },
        transactions: {
          t1: {
            type: 'thu',
            date: prevM + '-05',
            amount: 90000,
            desc: 'Quỹ thành viên',
            cat: 'Tiền quỹ thành viên hàng tháng',
          },
          t2: {
            type: 'thu',
            date: thisM + '-05',
            amount: 500000,
            desc: 'Quỹ công ty',
            cat: 'Tiền quỹ công ty hàng tháng',
          },
          t3: { type: 'chi', date: thisM + '-06', amount: 200000, desc: 'Thuê sân', cat: 'Tiền thuê sân' },
        },
        admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
      }),
    );
  },
  [THIS, PREV],
);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ---------- 1. Tổng quan: gộp đúng, không đếm hai lần ---------- */

// Thu = 500.000 quỹ công ty + 170.000 đóng quỹ. Khoản 90.000 gõ tay không được cộng.
check('tổng thu gộp tiền đóng quỹ', (await page.textContent('#kpi-income')).trim(), '670.000 đ');
check('tổng chi giữ nguyên', (await page.textContent('#kpi-expense')).trim(), '200.000 đ');
check('số dư đúng', (await page.textContent('#kpi-balance')).trim(), '470.000 đ');
check(
  'ghi rõ phần đóng quỹ',
  (await page.textContent('#kpi-income-note')).includes('Gồm 170.000 đ tiền đóng quỹ'),
  true,
);

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1800);
await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);

const tiles = async () => ({
  thu: (await page.textContent('#ledger-income')).trim(),
  chi: (await page.textContent('#ledger-expense')).trim(),
  ghiChu: (await page.textContent('#ledger-income-note')).trim(),
});

/* ---------- 2. Sổ thu chi: ô tổng theo bộ lọc ---------- */

await page.selectOption('#filter-month', '');
await page.waitForTimeout(500);
check('tất cả các tháng: thu gộp đủ', (await tiles()).thu, '670.000 đ');
check('tất cả các tháng: ghi rõ phần đóng quỹ', (await tiles()).ghiChu, 'Gồm 170.000 đ tiền đóng quỹ');
check('ô Số dư quỹ khớp với Tổng quan', (await page.textContent('#ledger-balance')).trim(), '470.000 đ');

await page.selectOption('#filter-month', THIS);
await page.waitForTimeout(500);
check('lọc tháng này: chỉ cộng đóng quỹ tháng này', (await tiles()).thu, '570.000 đ');
check('lọc tháng này: ghi chú theo tháng', (await tiles()).ghiChu, 'Gồm 70.000 đ tiền đóng quỹ');
check(
  'lọc tháng này: Số dư quỹ không đổi theo bộ lọc',
  (await page.textContent('#ledger-balance')).trim(),
  '470.000 đ',
);

await page.selectOption('#filter-month', PREV);
await page.waitForTimeout(500);
check('lọc tháng trước: bỏ khoản gõ tay 90.000', (await tiles()).thu, '100.000 đ');
check(
  'lọc tháng trước: Số dư quỹ vẫn không đổi',
  (await page.textContent('#ledger-balance')).trim(),
  '470.000 đ',
);

/* ---------- 3. Lọc danh mục ---------- */

await page.selectOption('#filter-month', '');
await page.selectOption('#filter-category', 'Tiền thuê sân');
await page.waitForTimeout(500);
check('lọc danh mục khác: không cộng đóng quỹ', (await tiles()).thu, '0 đ');
check('lọc danh mục khác: không có ghi chú', (await tiles()).ghiChu, '');

await page.selectOption('#filter-category', 'Tiền quỹ thành viên hàng tháng');
await page.waitForTimeout(500);
check('lọc đúng danh mục đóng quỹ: hiện tiền đóng quỹ', (await tiles()).thu, '170.000 đ');

/* ---------- 4. Tìm kiếm thì bỏ qua tiền đóng quỹ ---------- */

await page.selectOption('#filter-category', '');
await page.fill('#filter-keyword', 'công ty');
await page.waitForTimeout(500);
check('đang tìm kiếm: chỉ tính các dòng khớp', (await tiles()).thu, '500.000 đ');
check('đang tìm kiếm: không có ghi chú đóng quỹ', (await tiles()).ghiChu, '');
await page.fill('#filter-keyword', '');
await page.waitForTimeout(500);

/* ---------- 5. Dòng gõ tay cũ vẫn còn, có nhãn "đã gộp" ---------- */

const rows = () =>
  page.$$eval('#ledger-table tr', (els) =>
    els.map((e) => ({
      noiDung: e.querySelector('.cell-name')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      daGop: Boolean(e.querySelector('.pill--merged')),
    })),
  );
check(
  'dòng gõ tay cũ vẫn hiện',
  (await rows()).some((r) => r.noiDung.includes('Quỹ thành viên')),
  true,
);
check('dòng đó có nhãn đã gộp', (await rows()).find((r) => r.noiDung.includes('Quỹ thành viên')).daGop, true);
check('chỉ đúng một dòng có nhãn', (await rows()).filter((r) => r.daGop).length, 1);
check(
  'dòng quỹ công ty không bị đánh nhãn',
  (await rows()).find((r) => r.noiDung.includes('Quỹ công ty')).daGop,
  false,
);

/* ---------- 6. Tick tiền ở tab Đóng quỹ thì Sổ thu chi đổi theo ngay ---------- */

await page.click('[data-panel="months"]');
await page.waitForTimeout(1000);
await page.selectOption('#month-picker', THIS);
await page.waitForTimeout(800);
const binhRow = await page.$$eval('#dues-table tr', (els) =>
  els.findIndex((e) => e.querySelector('.cell-name')?.textContent.trim() === 'Bình'),
);
await page.selectOption(`#dues-table tr:nth-child(${binhRow + 1}) select`, 'paid');
await page.waitForTimeout(2200);

await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);
await page.selectOption('#filter-month', '');
await page.waitForTimeout(600);
check('đóng thêm 50.000 thì tổng thu tăng đúng', (await tiles()).thu, '720.000 đ');
check('ghi chú cập nhật theo', (await tiles()).ghiChu, 'Gồm 220.000 đ tiền đóng quỹ');
check(
  'ô Số dư quỹ ở Sổ thu chi cũng cập nhật theo',
  (await page.textContent('#ledger-balance')).trim(),
  '520.000 đ',
);

await page.click('[data-panel="dashboard"]');
await page.waitForTimeout(700);
check('Tổng quan cũng đổi theo', (await page.textContent('#kpi-balance')).trim(), '520.000 đ');

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
