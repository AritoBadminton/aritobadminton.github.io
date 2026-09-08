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
const nextKey = (k) => {
  const [y, m] = k.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const NEXT = nextKey(THIS);
const label = (k) => `Tháng ${k.slice(5)}/${k.slice(0, 4)}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.addInitScript((month) => {
  if (localStorage.getItem('__fakestore__')) return;
  localStorage.setItem(
    '__fakestore__',
    JSON.stringify({
      settings: {
        club: { name: 'CLB Test', updated: month + '-01', notes: [] },
        rules: { footer: '', items: [] },
        qr: {},
        roster: { active: { An: true, Bình: true, Cường: false }, order: {} },
      },
      months: {
        [month]: {
          label: 'Tháng thử',
          dues: {
            An: { paid: 50000, note: '', skip: false },
            Bình: { paid: 0, note: '', skip: false },
            Cường: { paid: 0, note: '', skip: false },
          },
        },
      },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
}, THIS);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);

await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
const guestOpts = await page.$$eval('#month-picker option', (els) => els.map((e) => e.value));
check('khách: ô chọn tháng không còn tháng tự sinh', guestOpts, [THIS]);
check('khách không thấy nút tạo tháng', await page.isVisible('#month-create'), false);

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1600);
await page.click('[data-panel="months"]');
await page.waitForTimeout(800);

check('admin thấy nút tạo tháng', await page.isVisible('#month-create'), true);
check(
  'nút ghi rõ tháng nào',
  (await page.textContent('#month-create')).trim(),
  `+ Tạo ${label(NEXT).toLowerCase()}`,
);
check(
  'vẫn chỉ một tháng trong ô chọn',
  await page.$$eval('#month-picker option', (els) => els.map((e) => e.value)),
  [THIS],
);

await page.click('#month-create');
await page.waitForTimeout(1500);
check(
  'tạo xong: ô chọn có hai tháng',
  (await page.$$eval('#month-picker option', (els) => els.map((e) => e.value))).sort(),
  [THIS, NEXT].sort(),
);
check('mở đúng tháng vừa tạo', await page.inputValue('#month-picker'), NEXT);
const names = await page.$$eval('#dues-table td.cell-name', (els) => els.map((e) => e.textContent.trim()));
check('chỉ lấy người đang tick', names.sort(), ['An', 'Bình']);
check(
  'tất cả để chưa đóng',
  await page.$$eval('#dues-table .status-select', (els) => [...new Set(els.map((e) => e.value))]),
  ['unpaid'],
);
check(
  'nút giờ trỏ sang tháng kế tiếp nữa',
  (await page.textContent('#month-create')).trim(),
  `+ Tạo ${label(nextKey(NEXT)).toLowerCase()}`,
);

// giu sau khi tai lai
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
check(
  'tháng mới còn sau khi tải lại',
  (await page.$$eval('#month-picker option', (els) => els.map((e) => e.value))).includes(NEXT),
  true,
);

// khong ai tick thi bao loi
await page.click('[data-panel="members"]');
await page.waitForTimeout(700);
for (const n of ['An', 'Bình']) {
  await page.locator(`#members-table .js-member-active[data-name="${n}"]`).uncheck();
  await page.waitForTimeout(700);
}
await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
let alerted = null;
page.once('dialog', (d) => {
  alerted = d.message();
  d.accept();
});
await page.click('#month-create');
await page.waitForTimeout(1200);
check('không ai tick thì báo rõ', alerted, 'Chưa có ai được tick hoạt động.');

check('không có lỗi JavaScript', errors, []);
await browser.close();
console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
