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
const errors = [];
// Mỗi newPage là một context riêng nên localStorage không dùng chung: trang khách
// phải được gieo lại dữ liệu, kèm đúng trạng thái công tắc cần kiểm tra.
const moTrang = async (hienQuyCongTy = false) => {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.addInitScript(
    ([thisM, prevM, hien]) => {
      if (localStorage.getItem('__fakestore__')) return;
      localStorage.setItem(
        '__fakestore__',
        JSON.stringify({
          settings: {
            club: { name: 'CLB Test', updated: thisM + '-01', notes: [], showCompanyFund: hien },
            rules: { footer: '', items: [] },
            qr: {},
            roster: { active: { An: true, Bình: true, Cường: true }, order: { An: 1, Bình: 2, Cường: 3 } },
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
                An: { paid: 50000, note: '', skip: false },
                Bình: { paid: 0, note: '', skip: false },
                Cường: { paid: 0, note: '', skip: true },
              },
            },
          },
          transactions: {
            t1: {
              type: 'thu',
              date: prevM + '-05',
              amount: 300000,
              desc: 'Công ty cấp tháng trước',
              cat: 'Tiền quỹ công ty hàng tháng',
            },
            t2: {
              type: 'thu',
              date: thisM + '-05',
              amount: 1000000,
              desc: 'Công ty cấp tháng này',
              cat: 'Tiền quỹ công ty hàng tháng',
            },
            t3: {
              type: 'thu',
              date: thisM + '-07',
              amount: 200000,
              desc: 'Công ty cấp bổ sung',
              cat: 'Tiền quỹ công ty hàng tháng',
            },
            t4: {
              type: 'thu',
              date: thisM + '-06',
              amount: 90000,
              desc: 'Quỹ thành viên gõ tay',
              cat: 'Tiền quỹ thành viên hàng tháng',
            },
            t5: { type: 'chi', date: thisM + '-06', amount: 200000, desc: 'Thuê sân', cat: 'Tiền thuê sân' },
          },
          admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
        }),
      );
    },
    [THIS, PREV, hienQuyCongTy],
  );
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return page;
};
const dangNhap = async (page) => {
  await page.click('#auth-toggle');
  await page.fill('#login-username', 'nghia@arito.vn');
  await page.fill('#login-password', 'MatKhauRatDai#2026');
  await page.click('#login-submit');
  await page.waitForTimeout(1800);
};

const page = await moTrang();
await dangNhap(page);
await page.click('[data-panel="months"]');
await page.waitForTimeout(1000);

/* ---------- 1. Ô mới nằm ngay trước ô "Đã đóng", không thay thế ô nào ---------- */

check('vẫn còn ô Đã đóng', await page.isVisible('#month-paid-count'), true);
check('có thêm ô Tiền quỹ công ty cấp', await page.isVisible('#month-company-fund'), true);
check(
  'nhãn đúng',
  await page.$eval('#month-company-tile .stat-tile__label', (e) => e.textContent.trim()),
  'Tiền quỹ công ty cấp',
);
check(
  'thứ tự bốn ô đúng',
  await page.$$eval('#panel-months .stat-tile__label', (els) => els.map((e) => e.textContent.trim())),
  ['Thu được', 'Tiền quỹ công ty cấp', 'Đã đóng', 'Chưa đóng'],
);

/* ---------- 2. Số tiền lấy từ sổ thu chi, theo tháng đang xem ---------- */

await page.selectOption('#month-picker', THIS);
await page.waitForTimeout(800);
check(
  'tháng này cộng đủ hai khoản công ty cấp',
  (await page.textContent('#month-company-fund')).trim(),
  '1.200.000 đ',
);
check(
  'không lẫn khoản quỹ thành viên gõ tay',
  (await page.textContent('#month-company-fund')).includes('1.290'),
  false,
);

await page.selectOption('#month-picker', PREV);
await page.waitForTimeout(800);
check('đổi tháng thì số đổi theo', (await page.textContent('#month-company-fund')).trim(), '300.000 đ');

await page.selectOption('#month-picker', THIS);
await page.waitForTimeout(800);

/* ---------- 3. Các ô đếm cũ giữ nguyên ---------- */

check('ô Đã đóng đếm đúng', (await page.textContent('#month-paid-count')).trim(), '1/2');
check('ô Chưa đóng đếm đúng', (await page.textContent('#month-unpaid-count')).trim(), '1 người');
check(
  'ghi chú người không chơi vẫn ở ô Đã đóng',
  (await page.textContent('#month-paid-note')).trim(),
  '1 người không chơi tháng này',
);

/* ---------- 4. Công tắc hiển thị ---------- */

check('admin thấy công tắc', await page.isVisible('#month-company-switch'), true);
check('mặc định chưa bật', await page.isChecked('#month-company-show'), false);

await page.check('#month-company-show');
await page.waitForTimeout(1500);
check(
  'bật thì ghi lên settings/club',
  await page.evaluate(() => JSON.parse(localStorage.getItem('__fakestore__')).settings.club.showCompanyFund),
  true,
);
check('ô tích vẫn bật sau khi vẽ lại', await page.isChecked('#month-company-show'), true);

/* ---------- 5. Người xem thường ---------- */

const khachBat = await moTrang(true);
await khachBat.click('[data-panel="months"]');
await khachBat.waitForTimeout(900);
check('đã bật: khách thấy ô', await khachBat.isVisible('#month-company-tile'), true);
check('khách không thấy công tắc', await khachBat.isVisible('#month-company-switch'), false);
check('khách thấy đúng số', (await khachBat.textContent('#month-company-fund')).trim(), '1.200.000 đ');
await khachBat.close();

const khachTat = await moTrang(false);
await khachTat.click('[data-panel="months"]');
await khachTat.waitForTimeout(900);
check('tắt: khách không thấy ô', await khachTat.isVisible('#month-company-tile'), false);
await khachTat.close();

await page.uncheck('#month-company-show');
await page.waitForTimeout(1500);
check(
  'tắt xong ghi lại lên settings/club',
  await page.evaluate(() => JSON.parse(localStorage.getItem('__fakestore__')).settings.club.showCompanyFund),
  false,
);
check('admin vẫn thấy ô khi đang tắt', await page.isVisible('#month-company-tile'), true);

/* ---------- 6. Sổ thu chi: số tiền mặc định 1 triệu ---------- */

await page.click('[data-panel="ledger"]');
await page.waitForTimeout(900);
check('ô số tiền điền sẵn 1 triệu', await page.inputValue('#new-amount'), '1.000.000');
check('ô nội dung điền sẵn', await page.inputValue('#new-desc'), 'Tiền quỹ thành viên hàng tháng');

await page.click('#ledger-add-toggle');
await page.waitForTimeout(400);
await page.fill('#new-amount', '250000');
await page.fill('#new-desc', 'Khoản thử');
await page.waitForTimeout(200);
check('số tiền sửa lại được', await page.inputValue('#new-amount'), '250.000');
check('nội dung sửa lại được', await page.inputValue('#new-desc'), 'Khoản thử');

await page.fill('#new-date', THIS + '-09');
await page.click('#new-submit');
await page.waitForTimeout(1600);
check('thêm xong thì điền lại 1 triệu', await page.inputValue('#new-amount'), '1.000.000');
check(
  'thêm xong thì điền lại nội dung mặc định',
  await page.inputValue('#new-desc'),
  'Tiền quỹ thành viên hàng tháng',
);
check(
  'vẫn ghi đúng nội dung đã gõ',
  await page.evaluate(() =>
    Object.values(JSON.parse(localStorage.getItem('__fakestore__')).transactions).some(
      (t) => t.desc === 'Khoản thử' && t.amount === 250000,
    ),
  ),
  true,
);

/* ---------- 7. Danh mục thu chỉ còn quỹ công ty ---------- */

await page.click('#new-type-toggle [data-type="thu"]');
await page.waitForTimeout(400);
check(
  'danh mục thu chỉ còn một lựa chọn',
  await page.$$eval('#new-category option', (els) => els.map((e) => e.textContent)),
  ['Tiền quỹ công ty hàng tháng'],
);
await page.click('#new-type-toggle [data-type="chi"]');
await page.waitForTimeout(300);
check(
  'danh mục chi giữ nguyên bốn lựa chọn',
  await page.$$eval('#new-category option', (els) => els.length),
  4,
);
await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);

/* ---------- 8. Dòng mang danh mục cũ không bị đổi khi sửa ---------- */

await page.selectOption('#filter-month', '');
await page.fill('#filter-keyword', 'gõ tay');
await page.waitForTimeout(700);
await page.click('#ledger-table tr:first-child input[type="checkbox"]');
await page.waitForTimeout(400);
await page.click('#ledger-update');
await page.waitForTimeout(600);
check(
  'form sửa giữ đúng danh mục cũ',
  await page.inputValue('#update-category'),
  'Tiền quỹ thành viên hàng tháng',
);

await page.fill('#update-desc', 'Quỹ thành viên gõ tay 2');
await page.click('#update-save');
await page.waitForTimeout(1600);
check(
  'lưu xong danh mục vẫn nguyên',
  await page.evaluate(() => JSON.parse(localStorage.getItem('__fakestore__')).transactions.t4.cat),
  'Tiền quỹ thành viên hàng tháng',
);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
