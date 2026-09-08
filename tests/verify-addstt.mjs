import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8199';
let pass = 0,
  fail = 0;
const check = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log(ok ? `✓ ${n}` : `✗ ${n}\n   nhận: ${JSON.stringify(g)}\n   cần : ${JSON.stringify(w)}`);
  ok ? pass++ : fail++;
};
// Dùng đúng tháng hiện tại: người mới chỉ được thêm vào tháng hiện tại trở đi.
const M = new Date().toISOString().slice(0, 7);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
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
        roster: { active: { An: true, Bình: false, Cường: true }, order: { An: 1, Bình: 2, Cường: 3 } },
      },
      months: {
        [month]: {
          label: 'Tháng thử',
          dues: {
            An: { paid: 50000, note: '', skip: false },
            Bình: { paid: 0, note: '', skip: false },
            Cường: { paid: 50000, note: '', skip: false },
          },
        },
      },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
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
await page.click('[data-panel="members"]');
await page.waitForTimeout(900);

const table = () =>
  page.$$eval('#members-table tr', (rows) =>
    rows
      .filter((r) => r.querySelector('.js-member-order'))
      .map((r) => ({
        ten: r.querySelector('.cell-name').textContent.trim(),
        stt: r.querySelector('.js-member-order').value,
        doNhau: r.querySelector('.js-member-order').classList.contains('stt-input--clash'),
      })),
  );
const pick = async (name) => (await table()).find((r) => r.ten === name);
const openForm = async () => {
  await page.click('#members-add-toggle');
  await page.waitForTimeout(400);
};

/* ---------- 1. Ô STT có mặt trong form ---------- */

await openForm();
check('form có ô STT', await page.isVisible('#members-add-order'), true);
check(
  'ô STT nằm cạnh ô tên, trước nút Thêm',
  await page.$eval('#members-add-form', (f) => [...f.children].map((c) => c.id || c.tagName.toLowerCase())),
  ['members-add-name', 'members-add-order', 'members-add-submit', 'members-add-cancel', 'members-add-error'],
);
check('gợi ý số kế tiếp còn trống', await page.getAttribute('#members-add-order', 'placeholder'), '4');
check(
  'có nhãn trợ năng',
  (await page.getAttribute('#members-add-order', 'aria-label')).includes('Số thứ tự'),
  true,
);

/* ---------- 2. Nhắc khi gõ trúng số người khác ---------- */

await page.fill('#members-add-order', '2');
await page.waitForTimeout(400);
check(
  'gõ số đã có người thì nhắc',
  await page.textContent('#members-add-error'),
  'Số 2 đang là của Bình — thêm xong sẽ báo trùng.',
);
await page.fill('#members-add-order', '9');
await page.waitForTimeout(400);
check('gõ số còn trống thì không nhắc', await page.textContent('#members-add-error'), '');

/* ---------- 3. Gõ số không hợp lệ ---------- */

await page.fill('#members-add-name', 'Dũng');
await page.fill('#members-add-order', 'abc');
await page.waitForTimeout(300);
check(
  'chữ không phải số thì báo lỗi ngay',
  await page.textContent('#members-add-error'),
  'STT phải là số từ 1 trở lên.',
);
await page.click('#members-add-submit');
await page.waitForTimeout(900);
check('không thêm khi STT sai', Boolean(await pick('Dũng')), false);
check('form vẫn mở', await page.isVisible('#members-add-form'), true);

await page.fill('#members-add-order', '0');
await page.click('#members-add-submit');
await page.waitForTimeout(900);
check('số 0 cũng bị chặn', Boolean(await pick('Dũng')), false);

/* ---------- 4. Thêm kèm STT tự chọn ---------- */

await page.fill('#members-add-order', '9');
await page.click('#members-add-submit');
await page.waitForTimeout(2000);
check('đã thêm Dũng', Boolean(await pick('Dũng')), true);
check('Dũng nhận đúng số 9', (await pick('Dũng')).stt, '9');
check('form đóng lại', await page.isVisible('#members-add-form'), false);
check(
  'không đụng số của ai',
  (await table()).some((r) => r.doNhau),
  false,
);

/* ---------- 5. Để trống thì lấy số kế tiếp ---------- */

await openForm();
check('gợi ý cập nhật theo số lớn nhất', await page.getAttribute('#members-add-order', 'placeholder'), '10');
await page.fill('#members-add-name', 'Én');
await page.click('#members-add-submit');
await page.waitForTimeout(2000);
check('đã thêm Én', Boolean(await pick('Én')), true);
check('Én lấy đúng số gợi ý', (await pick('Én')).stt, '10');

/* ---------- 6. Cố tình trùng thì vẫn thêm nhưng báo đỏ ---------- */

await openForm();
await page.fill('#members-add-name', 'Phong');
await page.fill('#members-add-order', '1');
await page.waitForTimeout(400);
check(
  'nhắc trùng với An',
  await page.textContent('#members-add-error'),
  'Số 1 đang là của An — thêm xong sẽ báo trùng.',
);
await page.click('#members-add-submit');
await page.waitForTimeout(2000);
check('vẫn thêm được', (await pick('Phong')).stt, '1');
check(
  'cả An và Phong đều bị tô đỏ',
  (await table())
    .filter((r) => r.doNhau)
    .map((r) => r.ten)
    .sort(),
  ['An', 'Phong'],
);
check('thanh nhắc trùng hiện ra', await page.isVisible('#members-clash'), true);

/* ---------- 7. Bấm Huỷ thì xoá sạch ô ---------- */

await openForm();
await page.fill('#members-add-name', 'Quân');
await page.fill('#members-add-order', '7');
await page.click('#members-add-cancel');
await page.waitForTimeout(400);
await openForm();
check('mở lại thì ô tên trống', await page.inputValue('#members-add-name'), '');
check('mở lại thì ô STT trống', await page.inputValue('#members-add-order'), '');
check('mở lại thì lời nhắc cũ biến mất', await page.textContent('#members-add-error'), '');
await page.click('#members-add-cancel');
await page.waitForTimeout(300);

/* ---------- 8. Số phải nằm trong dữ liệu chung ---------- */

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="members"]');
await page.waitForTimeout(900);
check(
  'tải lại vẫn đúng số',
  [(await pick('Dũng')).stt, (await pick('Én')).stt, (await pick('Phong')).stt],
  ['9', '10', '1'],
);

// Người mới cũng phải có mặt trong bảng đóng quỹ tháng này.
await page.click('[data-panel="months"]');
await page.waitForTimeout(1200);
const coTenTrongThang = await page.$$eval('#dues-table .cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check(
  'người mới có trong bảng đóng quỹ',
  ['Dũng', 'Én', 'Phong'].every((n) => coTenTrongThang.includes(n)),
  true,
);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
