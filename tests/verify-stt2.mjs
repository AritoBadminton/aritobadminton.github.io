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
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// An=1 (đang hoạt động), Bình=2 (ngừng), Cường=3 (đang), Dũng chưa có số (ngừng), Én chưa có số (đang).
await page.addInitScript((month) => {
  if (localStorage.getItem('__fakestore__')) return;
  localStorage.setItem(
    '__fakestore__',
    JSON.stringify({
      settings: {
        club: { name: 'CLB Test', updated: month + '-28', notes: [] },
        rules: { footer: '', items: [] },
        qr: {},
        roster: {
          active: { An: true, Bình: false, Cường: true, Dũng: false, Én: true },
          order: { An: 1, Bình: 2, Cường: 3 },
        },
      },
      months: {
        [month]: {
          label: 'Tháng thử',
          dues: {
            An: { paid: 50000, note: '', skip: false },
            Bình: { paid: 0, note: '', skip: false },
            Cường: { paid: 50000, note: '', skip: false },
            Dũng: { paid: 0, note: '', skip: false },
            Én: { paid: 0, note: '', skip: false },
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

/** Bảng đang hiện: tên → giá trị ô STT (và placeholder khi trống). */
const table = () =>
  page.$$eval('#members-table tr', (rows) =>
    rows
      .filter((r) => r.querySelector('.js-member-order'))
      .map((r) => ({
        ten: r.querySelector('.cell-name').textContent.trim(),
        stt: r.querySelector('.js-member-order').value,
        goiY: r.querySelector('.js-member-order').placeholder,
        doNhau: r.querySelector('.js-member-order').classList.contains('stt-input--clash'),
      })),
  );
const pick = async (name) => (await table()).find((r) => r.ten === name);
const status = (which) => page.click(`#members-status-toggle [data-status="${which}"]`);

/* ---------- 1. Số giữ nguyên qua cả ba mục lọc ---------- */

check(
  'Tất cả: đúng số đã lưu',
  (await table()).map((r) => `${r.ten}=${r.stt}`),
  ['An=1', 'Bình=2', 'Cường=3', 'Dũng=', 'Én='],
);

await status('active');
await page.waitForTimeout(500);
check('Đang hoạt động: An vẫn số 1', (await pick('An')).stt, '1');
check('Đang hoạt động: Cường vẫn số 3 (không tụt xuống 2)', (await pick('Cường')).stt, '3');
check('Đang hoạt động: không có Bình', Boolean(await pick('Bình')), false);

await status('inactive');
await page.waitForTimeout(500);
check('Ngừng hoạt động: Bình vẫn số 2', (await pick('Bình')).stt, '2');
check(
  'Ngừng hoạt động: không đẩy số 1 cho ai',
  (await table()).some((r) => r.stt === '1'),
  false,
);
check('Ngừng hoạt động: Dũng vẫn để trống', (await pick('Dũng')).stt, '');

/* ---------- 2. Ô trống không gợi ý số theo vị trí ---------- */

check('ô trống chỉ hiện dấu gạch', (await pick('Dũng')).goiY, '—');
await status('all');
await page.waitForTimeout(500);
check('mục Tất cả cũng vậy', (await pick('Dũng')).goiY, '—');
check(
  'không ô nào gợi ý bằng số',
  (await table()).every((r) => r.goiY === '—'),
  true,
);

/* ---------- 3. Cảnh báo trùng số ---------- */

check('chưa trùng thì không có thanh nhắc', await page.isVisible('#members-clash'), false);
check(
  'chưa trùng thì không ô nào đỏ',
  (await table()).some((r) => r.doNhau),
  false,
);

// Gõ cho Dũng số 1 — đụng An.
const dungRow = (await table()).findIndex((r) => r.ten === 'Dũng') + 1;
await page.fill(`#members-table tr:nth-child(${dungRow}) .js-member-order`, '1');
await page.click('#members-keyword');
await page.waitForTimeout(1500);

check('trùng số thì hiện thanh nhắc', await page.isVisible('#members-clash'), true);
check(
  'thanh nhắc gọi tên cả hai người',
  (await page.textContent('#members-clash-text')).includes('An và Dũng'),
  true,
);
check(
  'cả hai ô đều đỏ',
  (await table())
    .filter((r) => r.doNhau)
    .map((r) => r.ten)
    .sort(),
  ['An', 'Dũng'],
);
check('vẫn lưu được số trùng', (await pick('Dũng')).stt, '1');

// Cảnh báo phải theo sang mục lọc khác, dù người kia bị lọc ra ngoài.
await status('inactive');
await page.waitForTimeout(500);
check('lọc riêng vẫn báo đỏ', (await pick('Dũng')).doNhau, true);
check('lọc riêng vẫn hiện thanh nhắc', await page.isVisible('#members-clash'), true);

/* ---------- 4. Nút Đánh số lại ---------- */

check('mục Ngừng hoạt động: nút mờ', await page.isDisabled('#members-renumber'), true);
check(
  'có nhắc phải về mục Tất cả',
  (await page.getAttribute('#members-renumber', 'title')).includes('Tất cả'),
  true,
);

await status('all');
await page.waitForTimeout(500);
check('mục Tất cả: nút bật', await page.isDisabled('#members-renumber'), false);

await page.fill('#members-keyword', 'An');
await page.waitForTimeout(500);
check('đang tìm kiếm thì nút mờ', await page.isDisabled('#members-renumber'), true);
await page.fill('#members-keyword', '');
await page.waitForTimeout(500);

// Bấm Huỷ thì không đổi gì.
page.once('dialog', (d) => d.dismiss());
await page.click('#members-renumber');
await page.waitForTimeout(900);
check('bấm Huỷ thì số giữ nguyên', (await pick('Dũng')).stt, '1');

// Đồng ý thì đánh lại 1→5 theo thứ tự đang hiện.
const truoc = (await table()).map((r) => r.ten);
page.once('dialog', (d) => d.accept());
await page.click('#members-renumber');
await page.waitForTimeout(2000);

const sau = await table();
check(
  'đánh lại đúng 1→5',
  sau.map((r) => r.stt),
  ['1', '2', '3', '4', '5'],
);
check(
  'giữ nguyên thứ tự đang hiện',
  sau.map((r) => r.ten),
  truoc,
);
check(
  'hết trùng số',
  (await table()).some((r) => r.doNhau),
  false,
);
check('thanh nhắc biến mất', await page.isVisible('#members-clash'), false);

// Sau khi đánh lại, số vẫn dùng chung cho các mục lọc.
const soCuaCuong = (await pick('Cường')).stt;
await status('active');
await page.waitForTimeout(500);
check('sau khi đánh lại, Cường giữ nguyên số ở mục Đang hoạt động', (await pick('Cường')).stt, soCuaCuong);

// Tải lại trang: số phải nằm trong dữ liệu chung, không phải chỉ trong bộ nhớ.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="members"]');
await page.waitForTimeout(900);
check(
  'tải lại vẫn còn số vừa đánh',
  (await table()).map((r) => r.stt),
  ['1', '2', '3', '4', '5'],
);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
