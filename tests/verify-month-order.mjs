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
const M1 = prevKey(THIS);
const M2 = prevKey(M1);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// Ba tháng có cả dòng đóng quỹ lẫn giao dịch, để hai droplist tháng (tab Đóng quỹ
// theo tháng và tab Sổ thu chi) đều có đúng ba lựa chọn thật để so thứ tự.
await page.addInitScript(
  ([m2, m1, thisM]) => {
    if (localStorage.getItem('__fakestore__')) return;
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: { active: { An: true }, order: { An: 1 } },
        },
        months: {
          [m2]: { label: 'Tháng cũ nhất', dues: { An: { paid: 50000, note: '', skip: false } } },
          [m1]: { label: 'Tháng giữa', dues: { An: { paid: 50000, note: '', skip: false } } },
          [thisM]: { label: 'Tháng này', dues: { An: { paid: 50000, note: '', skip: false } } },
        },
        transactions: {
          t1: {
            type: 'thu',
            date: m2 + '-05',
            amount: 300000,
            desc: 'A',
            cat: 'Tiền quỹ công ty hàng tháng',
          },
          t2: {
            type: 'thu',
            date: m1 + '-05',
            amount: 300000,
            desc: 'B',
            cat: 'Tiền quỹ công ty hàng tháng',
          },
          t3: {
            type: 'thu',
            date: thisM + '-05',
            amount: 300000,
            desc: 'C',
            cat: 'Tiền quỹ công ty hàng tháng',
          },
        },
        admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
      }),
    );
  },
  [M2, M1, THIS],
);
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1800);

/* ---------- 1. Tab Đóng quỹ theo tháng: mới nhất lên đầu ---------- */

await page.click('[data-panel="months"]');
await page.waitForTimeout(900);
const monthsOrder = await page.$$eval('#month-picker option', (els) => els.map((e) => e.value));
check('droplist Đóng quỹ theo tháng: mới → cũ', monthsOrder, [THIS, M1, M2]);
check('mặc định chọn tháng mới nhất', await page.$eval('#month-picker', (e) => e.value), THIS);

/* ---------- 2. Tab Sổ thu chi: cùng thứ tự ---------- */

await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);
const ledgerOrder = await page.$$eval('#filter-month option', (els) =>
  els.map((e) => e.value).filter((v) => v !== ''),
);
check('droplist Sổ thu chi: mới → cũ, khớp tab kia', ledgerOrder, [THIS, M1, M2]);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
