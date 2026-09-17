import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8199';
let pass = 0,
  fail = 0;
const check = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log(ok ? `✓ ${n}` : `✗ ${n}\n   nhận: ${JSON.stringify(g)}\n   cần : ${JSON.stringify(w)}`);
  ok ? pass++ : fail++;
};
const M = new Date().toISOString().slice(0, 7);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
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
        roster: { active: { An: true, Bình: true }, order: { An: 1, Bình: 2 } },
      },
      months: {
        [month]: {
          label: 'Tháng này',
          dues: {
            An: { paid: 50000, note: '', skip: false },
            Bình: { paid: 0, note: '', skip: false },
          },
        },
      },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
}, M);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const tabsHien = () =>
  page.$$eval('.tab-nav__item', (els) =>
    els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()),
  );

/* ---------- 1. Khách chưa đăng nhập ---------- */

check('không còn thanh "chế độ chỉ xem"', await page.isVisible('#readonly-bar'), false);
check('không còn nút Đăng nhập trong thanh đó', await page.$('#readonly-login'), null);
check('khách thấy ba tab công khai', await tabsHien(), ['Tổng quan', 'Đóng quỹ theo tháng', 'Sổ thu chi']);
check(
  'tab Thành viên chỉ dành cho admin',
  await page.$eval('[data-panel="members"]', (e) => getComputedStyle(e).display),
  'none',
);
check(
  'tab Danh mục giao dịch cũng chỉ dành cho admin',
  await page.$eval('[data-panel="categories"]', (e) => getComputedStyle(e).display),
  'none',
);
check('khách không thấy bảng Giao dịch gần đây', await page.isVisible('#recent-card'), false);
check('nhưng vẫn thấy các ô số liệu ở Tổng quan', await page.isVisible('#kpi-balance'), true);
check('vẫn còn nút đăng nhập trên đầu trang', await page.isVisible('#auth-toggle'), true);
check('nút đó ghi rõ là để đăng nhập', (await page.textContent('#auth-toggle')).includes('Đăng nhập'), true);

// Sổ thu chi mở cho cả khách đọc — đó là điểm minh bạch cố ý — nhưng mọi lối
// ghi vào sổ vẫn phải khoá.
await page.click('[data-panel="ledger"]');
await page.waitForTimeout(500);
check('khách mở được Sổ thu chi', await page.isVisible('#panel-ledger'), true);
check('khách đọc được bảng giao dịch', await page.isVisible('#ledger-table'), true);
check('nhưng khách không có khu Thêm giao dịch', await page.isVisible('#ledger-add-toggle'), false);

// Bấm thẳng vào tab đang ẩn thì vẫn không mở được — cả hai tab riêng admin.
await page.evaluate(() => document.querySelector('[data-panel="members"]').click());
await page.waitForTimeout(500);
check('không mở được tab Thành viên', await page.isVisible('#panel-members'), false);

await page.evaluate(() => document.querySelector('[data-panel="categories"]').click());
await page.waitForTimeout(500);
check('không mở được tab Danh mục giao dịch', await page.isVisible('#panel-categories'), false);

// Trả về Tổng quan, không thì các phép kiểm sau lại đo nhầm tab đang mở.
await page.click('[data-panel="dashboard"]');
await page.waitForTimeout(500);

/* ---------- 2. Đăng nhập admin thì thấy đủ ---------- */

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1800);

check('admin thấy đủ năm tab', await tabsHien(), [
  'Tổng quan',
  'Thành viên',
  'Đóng quỹ theo tháng',
  'Sổ thu chi',
  'Danh mục giao dịch',
]);
check('admin không thấy thanh nhắc nào', await page.isVisible('#readonly-bar'), false);
check('admin thấy bảng Giao dịch gần đây', await page.isVisible('#recent-card'), true);
await page.click('[data-panel="ledger"]');
await page.waitForTimeout(700);
check('admin mở được Sổ thu chi', await page.isVisible('#panel-ledger'), true);

await page.click('[data-panel="categories"]');
await page.waitForTimeout(700);
check('admin mở được Danh mục giao dịch', await page.isVisible('#panel-categories'), true);

/* ---------- 3. Đăng xuất khi đang ở tab admin thì bị đẩy về Tổng quan ---------- */

// Phải đứng ở Thành viên: Sổ thu chi nay ai cũng xem được nên đăng xuất không
// đẩy ra khỏi đó, không còn kiểm được cơ chế này nữa.
await page.click('[data-panel="members"]');
await page.waitForTimeout(700);
check('admin mở được Thành viên', await page.isVisible('#panel-members'), true);

await page.click('#auth-toggle');
await page.waitForTimeout(1800);
check('đăng xuất thì quay về Tổng quan', await page.isVisible('#panel-dashboard'), true);
check('đăng xuất thì Thành viên đóng lại', await page.isVisible('#panel-members'), false);
check('đăng xuất thì bảng Giao dịch gần đây ẩn lại', await page.isVisible('#recent-card'), false);
check('đăng xuất vẫn không có thanh nhắc', await page.isVisible('#readonly-bar'), false);

/* ---------- 4. Tài khoản chưa được cấp quyền vẫn được báo rõ ---------- */

await page.click('#auth-toggle');
await page.fill('#login-username', 'khach@arito.vn');
await page.fill('#login-password', 'KhachKhongPhaiAdmin#1');
await page.click('#login-submit');
await page.waitForTimeout(1800);

check('tài khoản chưa có quyền thì hiện thanh nhắc', await page.isVisible('#readonly-bar'), true);
check(
  'thanh nhắc nêu đúng email',
  (await page.textContent('#readonly-bar')).includes('khach@arito.vn'),
  true,
);
check(
  'thanh nhắc chỉ cách xử lý',
  (await page.textContent('#readonly-bar')).includes('danh sách quản trị'),
  true,
);
check('người này vẫn không thấy tab admin', await tabsHien(), [
  'Tổng quan',
  'Đóng quỹ theo tháng',
  'Sổ thu chi',
]);
check('người này cũng không thấy Giao dịch gần đây', await page.isVisible('#recent-card'), false);

await page.click('#auth-toggle');
await page.waitForTimeout(1500);
check('đăng xuất thì thanh nhắc biến mất', await page.isVisible('#readonly-bar'), false);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
