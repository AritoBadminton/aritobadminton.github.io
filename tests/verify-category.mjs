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
        t1: { type: 'chi', date: month + '-14', amount: 200000, desc: 'Thuê sân', cat: 'Tiền thuê sân' },
      },
      categories: {
        c1: {
          type: 'chi',
          code: 'CHI-001',
          name: 'Tiền thuê sân',
          color: '#2a78d6',
          defaultAmount: 0,
          defaultDesc: 'Thuê sân 2 tiếng',
        },
        c2: {
          type: 'chi',
          code: 'CHI-002',
          name: 'Tiền nước',
          color: '#1baf7a',
          defaultAmount: 0,
          defaultDesc: 'Tiền nước',
        },
        c3: {
          type: 'thu',
          code: 'THU-001',
          name: 'Tiền quỹ công ty hàng tháng',
          color: '#eb6834',
          defaultAmount: 1480000,
          defaultDesc: 'Quỹ công ty',
          protected: true,
        },
      },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
}, M);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);

/* ---------- 0. Khách chưa đăng nhập không thấy tab ---------- */

check(
  'khách chưa đăng nhập: tab Danh mục giao dịch bị ẩn',
  await page.$eval('[data-panel="categories"]', (e) => getComputedStyle(e).display),
  'none',
);

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1600);

check(
  'admin: tab Danh mục giao dịch hiện ra',
  await page.$eval('[data-panel="categories"]', (e) => getComputedStyle(e).display !== 'none'),
  true,
);

await page.click('[data-panel="categories"]');
await page.waitForTimeout(500);

const rowCount = () =>
  page.$$eval('#category-table tr', (els) => els.filter((e) => !e.querySelector('.table-empty')).length);

/* ---------- 1. Bảng Grid nạp đúng danh mục có sẵn ---------- */

check('nạp đủ 3 danh mục có sẵn', await rowCount(), 3);

check(
  'không còn cột Mã/ID nào trong bảng Grid — luôn ẩn, không có nút bật lại',
  await page.$('.category-code-col'),
  null,
);
check('không còn công tắc "Hiện mã"', await page.$('#category-show-code'), null);

/* ---------- 2. Danh mục đã có giao dịch: chỉ Sửa, không Xoá ---------- */

const rowInUse = await page.$$eval('#category-table tr', (els) => {
  const row = els.find((e) => e.textContent.includes('Tiền thuê sân'));
  return {
    hasEdit: Boolean(row.querySelector('.js-category-edit')),
    hasDelete: Boolean(row.querySelector('.js-category-delete')),
  };
});
check('danh mục đang dùng: có nút Sửa', rowInUse.hasEdit, true);
check('danh mục đang dùng: KHÔNG có nút Xoá', rowInUse.hasDelete, false);

const rowUnused = await page.$$eval('#category-table tr', (els) => {
  const row = els.find((e) => e.textContent.includes('Tiền nước'));
  return {
    hasEdit: Boolean(row.querySelector('.js-category-edit')),
    hasDelete: Boolean(row.querySelector('.js-category-delete')),
  };
});
check('danh mục chưa dùng: có cả nút Sửa lẫn Xoá', rowUnused, { hasEdit: true, hasDelete: true });

/* ---------- 3. Thêm danh mục mới ---------- */

check('lúc chưa bấm, popup thêm danh mục còn ẩn', await page.isVisible('#category-modal'), false);
await page.click('#category-add-toggle');
await page.waitForTimeout(300);
check('bấm "+ Thêm danh mục" thì popup hiện ra', await page.isVisible('#category-modal'), true);
check('mặc định ô Tên không bị khoá', await page.isDisabled('#category-name'), false);
check('form Thêm chưa có id để hiện', await page.textContent('#category-id-note'), '');

// Bug đã gặp: ở bộ lọc Grid "Tất cả", bấm qua lại Thu/Chi trong popup Thêm
// không đổi được gì (thiếu hẳn sự kiện click cho #category-type-toggle).
check(
  'bộ lọc Grid đang ở Tất cả',
  await page.getAttribute('#category-filter-type [data-type="all"]', 'aria-pressed'),
  'true',
);
check(
  'popup Thêm mặc định chọn Chi',
  await page.getAttribute('#category-type-toggle [data-type="chi"]', 'aria-pressed'),
  'true',
);
await page.click('#category-type-toggle [data-type="thu"]');
await page.waitForTimeout(200);
check(
  'bấm Thu thì chuyển sang chọn Thu',
  await page.getAttribute('#category-type-toggle [data-type="thu"]', 'aria-pressed'),
  'true',
);
check(
  'bấm Thu thì Chi hết được chọn',
  await page.getAttribute('#category-type-toggle [data-type="chi"]', 'aria-pressed'),
  'false',
);
await page.click('#category-type-toggle [data-type="chi"]');
await page.waitForTimeout(200);
check(
  'bấm lại Chi thì chuyển về Chi',
  await page.getAttribute('#category-type-toggle [data-type="chi"]', 'aria-pressed'),
  'true',
);
check(
  'bấm lại Chi thì Thu hết được chọn',
  await page.getAttribute('#category-type-toggle [data-type="thu"]', 'aria-pressed'),
  'false',
);

// Lưu ở loại Thu để xác nhận việc bấm chuyển qua lại thật sự đổi được giá trị lưu, không chỉ đổi mỗi giao diện.
await page.click('#category-type-toggle [data-type="thu"]');
await page.fill('#category-name', 'Tiền khác');
await page.fill('#category-amount', '150000');
await page.fill('#category-desc', 'Chi phí phát sinh');
await page.click('#category-save');
await page.waitForTimeout(500);

check('lưu xong đóng popup', await page.isVisible('#category-modal'), false);
check('bảng có thêm 1 dòng', await rowCount(), 4);
check(
  'danh mục mới lưu đúng loại Thu đã chuyển sang, không phải Chi mặc định ban đầu',
  await page.$$eval('#category-table tr', (els) => {
    const row = els.find((e) => e.textContent.includes('Tiền khác'));
    return row.textContent.includes('Thu');
  }),
  true,
);
check('toast báo đã thực hiện xong', (await page.textContent('#toast')).trim(), 'Đã thực hiện xong');
await page.waitForTimeout(3200);

/* ---------- 4. Sửa danh mục, kể cả danh mục khoá tên ---------- */

const editButtonFor = (name) =>
  page.$$eval(
    `#category-table tr`,
    (els, target) => {
      const row = els.find((e) => e.textContent.includes(target));
      const button = row.querySelector('.js-category-edit');
      return button ? Array.from(els).indexOf(row) + 1 : -1;
    },
    name,
  );

const protectedRowIndex = await editButtonFor('Tiền quỹ công ty hàng tháng');
await page.click(`#category-table tr:nth-child(${protectedRowIndex}) .js-category-edit`);
await page.waitForTimeout(300);
check('danh mục khoá tên: ô Tên bị disable khi sửa', await page.isDisabled('#category-name'), true);
check('hiện ghi chú giải thích lý do khoá tên', await page.isVisible('#category-protected-note'), true);
check(
  'form Sửa hiện đúng id danh mục đang sửa',
  (await page.textContent('#category-id-note')).trim(),
  'id: c3',
);
await page.fill('#category-amount', '1500000');
await page.click('#category-save');
await page.waitForTimeout(500);

check(
  'sửa số tiền mặc định của danh mục khoá tên vẫn lưu được',
  await page.$$eval('#category-table tr', (els) => {
    const row = els.find((e) => e.textContent.includes('Tiền quỹ công ty hàng tháng'));
    return row.textContent.includes('1.500.000');
  }),
  true,
);

/* ---------- 5. Xoá danh mục chưa dùng ---------- */

const before = await rowCount();
const unusedRowIndex = await editButtonFor('Tiền nước');
await page.click(`#category-table tr:nth-child(${unusedRowIndex}) .js-category-delete`);
await page.waitForTimeout(300);
check('bấm xoá mở popup xác nhận', await page.isVisible('#category-delete-modal'), true);
check(
  'popup nhắc rõ tên danh mục sắp xoá',
  (await page.textContent('#category-delete-text')).includes('Tiền nước'),
  true,
);

await page.click('#category-delete-cancel');
await page.waitForTimeout(300);
check('bấm Huỷ không xoá gì', await rowCount(), before);

await page.click(`#category-table tr:nth-child(${unusedRowIndex}) .js-category-delete`);
await page.waitForTimeout(300);
await page.click('#category-delete-ok');
await page.waitForTimeout(500);
check('bấm Đồng ý xoá đúng 1 dòng', await rowCount(), before - 1);
check(
  'bảng không còn dòng Tiền nước',
  await page.$$eval('#category-table tr', (els) => els.some((e) => e.textContent.includes('Tiền nước'))),
  false,
);

/* ---------- 6. Chọn danh mục ở Sổ thu chi tự điền tiền + nội dung ---------- */

await page.click('[data-panel="ledger"]');
await page.waitForTimeout(500);
await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);

await page.click('#new-type-toggle .segmented__item[data-type="thu"]');
await page.waitForTimeout(200);
await page.selectOption('#new-category', 'Tiền quỹ công ty hàng tháng');
await page.waitForTimeout(200);
check('chọn danh mục tự điền số tiền mặc định', await page.inputValue('#new-amount'), '1.500.000');
check('chọn danh mục tự điền nội dung mặc định', await page.inputValue('#new-desc'), 'Quỹ công ty');

await page.click('#new-type-toggle .segmented__item[data-type="chi"]');
await page.waitForTimeout(200);
await page.click('#new-cancel');
await page.waitForTimeout(300);

/* ---------- 7. Thêm danh mục mới thì combobox ở Sổ thu chi thấy ngay, không cần tải lại trang ---------- */

await page.click('[data-panel="categories"]');
await page.waitForTimeout(500);
await page.click('#category-add-toggle');
await page.waitForTimeout(300);
await page.fill('#category-name', 'Tiền vé gửi xe');
await page.click('#category-save');
await page.waitForTimeout(500);

await page.click('[data-panel="ledger"]');
await page.waitForTimeout(500);
await page.click('#ledger-add-toggle');
await page.waitForTimeout(300);
check(
  'mở lại form Thêm giao dịch (không đổi Thu/Chi) đã thấy ngay danh mục vừa thêm',
  await page.$$eval('#new-category option', (els) => els.some((e) => e.textContent === 'Tiền vé gửi xe')),
  true,
);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
