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
        roster: { active: { An: true, Bình: true }, order: {} },
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
        t2: {
          type: 'chi',
          date: month + '-14',
          amount: 200000,
          desc: 'Thuê sân 2 tiếng',
          cat: 'Tiền thuê sân',
        },
        t3: { type: 'chi', date: month + '-21', amount: 60000, desc: 'Nước', cat: 'Tiền nước' },
        t4: { type: 'chi', date: '2026-07-05', amount: 999000, desc: 'Tháng khác', cat: 'Tiền khác' },
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

const tiles = async () => ({
  thu: (await page.textContent('#ledger-income')).trim(),
  chi: (await page.textContent('#ledger-expense')).trim(),
  net: (await page.textContent('#ledger-net')).trim(),
});
const rowCount = () =>
  page.$$eval('#ledger-table tr', (els) => els.filter((e) => !e.querySelector('.table-empty')).length);

/* ---------- 1. Ô tổng bỏ qua nút Thu/Chi ---------- */

const all = await tiles();
check('Tất cả: thu đúng', all.thu, '1.480.000 đ');
check('Tất cả: chi đúng', all.chi, '260.000 đ');
check('Tất cả: bảng có 3 dòng', await rowCount(), 3);

await page.click('#ledger-type-toggle [data-type="thu"]');
await page.waitForTimeout(400);
check('lọc Thu: ô tổng không đổi', await tiles(), all);
check('lọc Thu: bảng chỉ còn 1 dòng', await rowCount(), 1);

await page.click('#ledger-type-toggle [data-type="chi"]');
await page.waitForTimeout(400);
check('lọc Chi: ô tổng không đổi', await tiles(), all);
check('lọc Chi: bảng còn 2 dòng', await rowCount(), 2);

// Bộ lọc tháng thì vẫn phải ăn vào ô tổng.
await page.selectOption('#filter-month', '2026-07');
await page.waitForTimeout(400);
check('đổi tháng: ô tổng đổi theo', (await tiles()).chi, '999.000 đ');

// Bộ lọc danh mục cũng vậy.
await page.selectOption('#filter-month', M);
await page.selectOption('#filter-category', 'Tiền nước');
await page.waitForTimeout(400);
check('lọc danh mục: chi chỉ còn tiền nước', (await tiles()).chi, '60.000 đ');
check('lọc danh mục: thu về 0', (await tiles()).thu, '0 đ');
await page.selectOption('#filter-category', '');
await page.click('#ledger-type-toggle [data-type="all"]');
await page.waitForTimeout(400);

/* ---------- 2. Nút Sao chép trên từng dòng ---------- */

// Dòng "Thuê sân 2 tiếng" có nút sao chép riêng, đặt trước nút xoá.
const rowIndex = await page.$$eval('#ledger-table tr', (els) =>
  els.findIndex((e) => e.textContent.includes('Thuê sân 2 tiếng')),
);
const rowSelector = `#ledger-table tr:nth-child(${rowIndex + 1})`;
const copyButtonSelector = `${rowSelector} .js-row-copy`;

check('có nút sao chép trên dòng', await page.isVisible(copyButtonSelector), true);
check('nút chỉ có biểu tượng, không có chữ', (await page.textContent(copyButtonSelector)).trim(), '');
check('có svg bên trong', await page.$eval(copyButtonSelector, (e) => Boolean(e.querySelector('svg'))), true);

const before = await rowCount();
await page.click(copyButtonSelector);
await page.waitForTimeout(500);

// Bấm sao chép chỉ mở form điền sẵn — chưa ghi gì, bảng chưa đổi.
check('bấm sao chép chưa tạo dòng nào', await rowCount(), before);
check('hộp thoại sửa/sao chép hiện ra dạng popup', await page.isVisible('#update-modal'), true);
check('popup có role dialog', await page.getAttribute('#update-modal', 'role'), 'dialog');
check(
  'form nhắc sẽ tạo khoản mới khi lưu',
  (await page.textContent('#update-head')).includes('Lưu thay đổi'),
  true,
);
check('điền sẵn ngày theo dòng gốc', await page.inputValue('#update-date'), '2026-08-14');
check('điền sẵn số tiền theo dòng gốc', await page.inputValue('#update-amount'), '200.000');
check('điền sẵn nội dung theo dòng gốc', await page.inputValue('#update-desc'), 'Thuê sân 2 tiếng');
check('không hiện nút Khôi phục bản gốc khi đang sao chép', await page.isVisible('#update-revert'), false);

// Đổi ngày rồi bấm Lưu mới thật sự tạo dòng mới — dòng gốc không đụng tới.
await page.fill('#update-date', '2026-08-27');
await page.click('#update-save');
await page.waitForTimeout(1500);

check('lưu xong hiện toast báo đã thực hiện', await page.isVisible('#toast'), true);
check('toast đúng nội dung', (await page.textContent('#toast')).trim(), 'Đã thực hiện xong');

check('lưu xong bảng mới thêm đúng 1 dòng', await rowCount(), before + 1);
const copies = await page.$$eval('#ledger-table tr', (els) =>
  els
    .filter((e) => e.textContent.includes('Thuê sân 2 tiếng'))
    .map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
);
check('có 2 dòng Thuê sân 2 tiếng', copies.length, 2);
check(
  'cả hai dòng đều giữ nguyên số tiền',
  copies.every((t) => t.includes('200.000')),
  true,
);
check('tổng chi tăng đúng 200.000', (await tiles()).chi, '460.000 đ');

const dates = await page.$$eval('#ledger-table tr', (els) =>
  els
    .filter((e) => e.textContent.includes('Thuê sân 2 tiếng'))
    .map((e) => e.textContent.match(/\d{2}\/\d{2}\/\d{4}/)[0])
    .sort(),
);
check('bản gốc giữ ngày, dòng mới lấy đúng ngày đã đổi', dates, ['14/08/2026', '27/08/2026']);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
