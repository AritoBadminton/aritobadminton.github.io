import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8199';
let pass = 0,
  fail = 0;
const check = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log(ok ? `✓ ${n}` : `✗ ${n}\n   nhận: ${JSON.stringify(g)}\n   cần : ${JSON.stringify(w)}`);
  ok ? pass++ : fail++;
};
const M = '2026-08';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
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
        club: { name: 'CLB Test', updated: month + '-28', notes: [] },
        rules: { footer: '', items: [] },
        qr: {},
        roster: { active: { An: true }, order: {} },
      },
      months: { [month]: { label: 'Tháng thử', dues: { An: { paid: 0, note: '', skip: false } } } },
      transactions: {
        t1: {
          type: 'thu',
          date: month + '-02',
          amount: 1480000,
          desc: 'Quỹ công ty',
          cat: 'Tiền quỹ công ty hàng tháng',
        },
        t2: { type: 'chi', date: month + '-14', amount: 200000, desc: 'Thuê sân', cat: 'Tiền thuê sân' },
        t3: { type: 'chi', date: month + '-21', amount: 60000, desc: 'Nước uống', cat: 'Tiền nước' },
      },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
}, M);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1600);
await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);
await page.selectOption('#filter-month', M);
await page.waitForTimeout(500);

const rowCount = () =>
  page.$$eval('#ledger-table tr', (els) => els.filter((e) => !e.querySelector('.table-empty')).length);

/* ---------- 0. Cột Giao dịch (trước là Danh mục) đứng trước cột Nội dung ---------- */

check(
  'thứ tự cột đúng: Ngày, Loại, Giao dịch, Nội dung, Số tiền',
  await page.$$eval('#panel-ledger thead th', (els) => els.map((e) => e.textContent.trim())),
  ['Ngày ⇅', 'Loại', 'Giao dịch', 'Nội dung', 'Số tiền ⇅', ''],
);

const rowWithThueSan = await page.$$eval('#ledger-table tr', (els) => {
  const row = els.find((e) => e.textContent.includes('Thuê sân'));
  return [...row.querySelectorAll('td')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
});
check('cột thứ 3 (Giao dịch) là danh mục', rowWithThueSan[2], 'Tiền thuê sân');
check('cột thứ 4 (Nội dung) là tên khoản', rowWithThueSan[3].includes('Thuê sân'), true);

/* ---------- 1. Hộp thoại "Thêm giao dịch" hiện dạng popup ---------- */

check('lúc chưa bấm, popup thêm giao dịch còn ẩn', await page.isVisible('#new-entry-modal'), false);

await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);
check('bấm nút thì popup hiện ra', await page.isVisible('#new-entry-modal'), true);
check('popup có role dialog', await page.getAttribute('#new-entry-modal', 'role'), 'dialog');
check('popup có aria-modal', await page.getAttribute('#new-entry-modal', 'aria-modal'), 'true');
// Popup phải phủ kín màn hình (overlay cố định) để đúng nghĩa "màn hình con".
check(
  'popup là lớp phủ toàn màn hình',
  await page.$eval('#new-entry-modal', (e) => getComputedStyle(e).position),
  'fixed',
);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('bấm Escape thì đóng popup', await page.isVisible('#new-entry-modal'), false);

await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);
await page.click('#new-entry-modal', { position: { x: 5, y: 5 } });
await page.waitForTimeout(300);
check('bấm ra ngoài (lớp phủ) thì đóng popup', await page.isVisible('#new-entry-modal'), false);

await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);
await page.click('#new-cancel');
await page.waitForTimeout(300);
check('bấm Huỷ thì đóng popup', await page.isVisible('#new-entry-modal'), false);

/* ---------- 2. Hộp thoại "Cập nhật" cũng hiện dạng popup ---------- */

await page.click('#ledger-table tr:first-child .js-row-update');
await page.waitForTimeout(400);
check('bấm Cập nhật thì popup sửa hiện ra', await page.isVisible('#update-modal'), true);
check('popup sửa có role dialog', await page.getAttribute('#update-modal', 'role'), 'dialog');

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('bấm Escape đóng popup sửa, không lưu gì', await page.isVisible('#update-modal'), false);

/* ---------- 3. Nút xoá mở popup xác nhận ---------- */

const rowIndex = await page.$$eval('#ledger-table tr', (els) =>
  els.findIndex((e) => e.textContent.includes('Thuê sân')),
);
const deleteButtonSelector = `#ledger-table tr:nth-child(${rowIndex + 1}) .js-row-delete`;

const before = await rowCount();
await page.click(deleteButtonSelector);
await page.waitForTimeout(300);
check('bấm xoá mở popup xác nhận', await page.isVisible('#delete-confirm-modal'), true);
check(
  'popup nhắc rõ tên khoản sắp xoá',
  (await page.textContent('#delete-confirm-text')).includes('Thuê sân'),
  true,
);
check('chưa xoá gì khi popup còn mở', await rowCount(), before);

// Huỷ: đóng popup, không xoá.
await page.click('#delete-confirm-cancel');
await page.waitForTimeout(300);
check('bấm Huỷ đóng popup mà không xoá', await page.isVisible('#delete-confirm-modal'), false);
check('bảng vẫn còn đủ dòng sau khi Huỷ', await rowCount(), before);

// Đồng ý: xoá thật, đóng popup, hiện toast rồi tự ẩn.
await page.click(deleteButtonSelector);
await page.waitForTimeout(300);
await page.click('#delete-confirm-ok');
await page.waitForTimeout(500);

check('bấm Đồng ý đóng popup xác nhận', await page.isVisible('#delete-confirm-modal'), false);
check('bảng bớt đúng 1 dòng sau khi xoá', await rowCount(), before - 1);
check(
  'bảng không còn dòng Thuê sân',
  await page.$$eval('#ledger-table tr', (els) => els.some((e) => e.textContent.includes('Thuê sân'))),
  false,
);

check('toast báo đã xoá thành công', await page.isVisible('#toast'), true);
check('toast đúng nội dung', (await page.textContent('#toast')).trim(), 'Đã xoá thành công');

await page.waitForTimeout(3200);
check('toast tự ẩn sau khoảng 3 giây', await page.isVisible('#toast'), false);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
