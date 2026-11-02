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
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// "Tiền thuê sân 1 tháng" là tên danh mục cũ không còn trong Danh mục giao
// dịch, chỉ còn sót ở vài dòng giao dịch cũ — vẫn phải gộp đúng vào ô lọc
// "Tiền thuê sân" dù không có trong collection categories.
await page.addInitScript(
  (thisM) => {
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: { active: { An: true }, order: {} },
        },
        months: {},
        transactions: {
          t1: {
            type: 'chi',
            date: thisM + '-05',
            amount: 200000,
            desc: 'Thuê sân buổi tối',
            cat: 'Tiền thuê sân',
          },
          t2: {
            type: 'chi',
            date: thisM + '-10',
            amount: 1000000,
            desc: 'Thuê sân cả tháng',
            cat: 'Tiền thuê sân 1 tháng',
          },
          t3: { type: 'chi', date: thisM + '-12', amount: 50000, desc: 'Tiền nước', cat: 'Tiền nước' },
        },
        admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
      }),
    );
  },
  [THIS],
);
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1200);
await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);

/* ---------- 1. Ô lọc chỉ còn đúng một lựa chọn "Tiền thuê sân" ---------- */

const options = await page.$$eval('#filter-category option', (els) => els.map((e) => e.textContent.trim()));
check(
  'không còn "Tiền thuê sân 1 tháng" riêng trong ô lọc',
  options.includes('Tiền thuê sân 1 tháng'),
  false,
);
check('chỉ còn đúng một "Tiền thuê sân" trong ô lọc', options.filter((t) => t === 'Tiền thuê sân').length, 1);

/* ---------- 2. Chọn "Tiền thuê sân" thì lọc cả hai danh mục cũ lẫn mới ---------- */

await page.selectOption('#filter-category', 'Tiền thuê sân');
await page.waitForTimeout(400);
const rows = await page.$$eval('#ledger-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check(
  'lọc "Tiền thuê sân" ra đủ cả hai dòng (cat cũ lẫn mới)',
  rows.sort(),
  ['Thuê sân buổi tối', 'Thuê sân cả tháng'].sort(),
);

await page.selectOption('#filter-category', '');
await page.waitForTimeout(400);
const allRows = await page.$$eval('#ledger-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check('bỏ lọc thì thấy lại đủ ba dòng', allRows.length, 3);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
