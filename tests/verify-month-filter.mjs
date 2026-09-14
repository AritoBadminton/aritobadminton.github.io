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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// Ba người tên khác nhau để gõ một từ khoá chỉ khớp một hoặc hai người, phân biệt
// rõ với việc lọc theo "Văn" (khớp hai người có đệm "Văn") và theo họ riêng.
await page.addInitScript(
  ([thisM]) => {
    if (localStorage.getItem('__fakestore__')) return;
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: {
            active: { 'Nguyễn Văn An': true, 'Trần Thị Bình': true, 'Lê Văn Cường': true },
            order: { 'Nguyễn Văn An': 1, 'Trần Thị Bình': 2, 'Lê Văn Cường': 3 },
          },
        },
        months: {
          [thisM]: {
            label: 'Tháng này',
            dues: {
              'Nguyễn Văn An': { paid: 100000, note: '', skip: false },
              'Trần Thị Bình': { paid: 0, note: '', skip: false },
              'Lê Văn Cường': { paid: 0, note: '', skip: true },
            },
          },
        },
        transactions: {},
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
await page.waitForTimeout(1800);

await page.click('[data-panel="months"]');
await page.waitForTimeout(900);

const rowNames = () => page.$$eval('#dues-table .cell-name', (els) => els.map((e) => e.textContent.trim()));
const statSnapshot = () =>
  page.evaluate(() => ({
    collected: document.querySelector('#month-collected').textContent,
    paidCount: document.querySelector('#month-paid-count').textContent,
    unpaidCount: document.querySelector('#month-unpaid-count').textContent,
  }));

/* ---------- 1. Chưa gõ gì: đủ ba người ---------- */

check('chưa lọc: đủ ba người', await rowNames(), ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Cường']);
const statsBefore = await statSnapshot();

/* ---------- 2. Gõ họ riêng: còn đúng một người ---------- */

await page.fill('#month-keyword', 'Trần');
await page.waitForTimeout(200);
check('lọc "Trần": còn một người', await rowNames(), ['Trần Thị Bình']);

/* ---------- 3. Các ô tổng hợp không đổi theo bộ lọc ---------- */

check('lọc tên không đổi số liệu tổng hợp', await statSnapshot(), statsBefore);

/* ---------- 4. Gõ đệm dùng chung: khớp hai người, không phân biệt hoa/thường ---------- */

await page.fill('#month-keyword', 'văn');
await page.waitForTimeout(200);
check('lọc "văn" (thường): khớp hai người', await rowNames(), ['Nguyễn Văn An', 'Lê Văn Cường']);

/* ---------- 5. Không khớp ai: báo trống, không phải bảng rỗng im lặng ---------- */

await page.fill('#month-keyword', 'xyz-khong-ai-ten-nay');
await page.waitForTimeout(200);
check('lọc không khớp: báo trống', await rowNames(), []);
check(
  'lọc không khớp: có dòng thông báo',
  await page.$eval('#dues-table', (e) => e.textContent.includes('Không có ai khớp')),
  true,
);

/* ---------- 6. Xoá ô lọc: quay lại đủ ba người ---------- */

await page.fill('#month-keyword', '');
await page.waitForTimeout(200);
check('xoá bộ lọc: đủ ba người trở lại', await rowNames(), ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Cường']);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
