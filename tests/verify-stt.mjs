import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8199';
let pass = 0,
  fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    ok ? `✓ ${name}` : `✗ ${name}\n   nhận: ${JSON.stringify(got)}\n   cần : ${JSON.stringify(want)}`,
  );
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// gieo du lieu vao localStorage cua stub truoc khi tai trang
await page.addInitScript(() => {
  if (localStorage.getItem('__fakestore__')) return; // chi gieo lan dau, de kiem tra du lieu song sot qua reload
  const db = {
    settings: {
      club: { name: 'CLB Test', updated: '2026-09-01', notes: [] },
      rules: { footer: '', items: [] },
      qr: {},
      roster: { active: { An: true, Bình: true, Cường: true, Dũng: true }, order: {} },
    },
    months: {
      '2026-09': {
        label: 'Tháng 09/2026',
        dues: {
          An: { paid: 0, note: '', skip: false },
          Bình: { paid: 0, note: '', skip: false },
          Cường: { paid: 0, note: '', skip: false },
          Dũng: { paid: 0, note: '', skip: false },
        },
      },
    },
    transactions: { t1: { type: 'thu', date: '2026-09-01', amount: 50000, desc: 'x', cat: 'y' } },
    admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
  };
  localStorage.setItem('__fakestore__', JSON.stringify(db));
});

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// --- dang nhap admin ---
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1200);
check('đăng nhập thành công', await page.evaluate(() => document.body.classList.contains('is-admin')), true);
check('nút đổi mật khẩu hiện ra', await page.isVisible('#password-toggle'), true);

// --- tab Thanh vien: o STT ---
await page.click('[data-panel="members"]');
await page.waitForTimeout(600);
const sttCount = await page.locator('#members-table .js-member-order').count();
check('mỗi dòng có một ô STT', sttCount, 4);
check('mặc định sắp theo STT', await page.inputValue('#members-sort'), 'stt');

// nhap STT: Dung = 1, Cuong = 2
const setStt = async (name, value) => {
  const input = page.locator(`#members-table .js-member-order[data-name="${name}"]`);
  await input.fill(value);
  await input.press('Enter');
  await page.waitForTimeout(500);
};
await setStt('Dũng', '1');
await setStt('Cường', '2');

const memberNames = await page.$$eval('#members-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check('tab Thành viên sắp theo STT', memberNames.slice(0, 2), ['Dũng', 'Cường']);

// --- tab Dong quy: cung thu tu ---
await page.click('[data-panel="months"]');
await page.waitForTimeout(800);
const duesNames = await page.$$eval('#dues-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check('tab Đóng quỹ sắp theo STT', duesNames, ['Dũng', 'Cường', 'An', 'Bình']);

// --- STT co giu sau khi tai lai trang ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('[data-panel="months"]');
await page.waitForTimeout(600);
const afterReload = await page.$$eval('#dues-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check('STT giữ sau khi tải lại', afterReload.slice(0, 2), ['Dũng', 'Cường']);

// --- bo STT ---
await page.click('[data-panel="members"]');
await page.waitForTimeout(600);
const dung = page.locator('#members-table .js-member-order[data-name="Dũng"]');
await dung.fill('');
await dung.press('Enter');
await page.waitForTimeout(700);
const afterClear = await page.$$eval('#members-table tr td.cell-name', (els) =>
  els.map((e) => e.textContent.trim()),
);
check('bỏ STT → xuống cuối', afterClear[0], 'Cường');

// --- doi mat khau ---
await page.click('#password-toggle');
await page.waitForTimeout(400);
check('hộp thoại đổi mật khẩu mở', await page.isVisible('#password-modal'), true);
check('hiện đúng email', await page.textContent('#password-email'), 'nghia@arito.vn');

await page.fill('#password-current', 'MatKhauRatDai#2026');
await page.fill('#password-new', '123');
await page.fill('#password-confirm', '123');
await page.click('#password-submit');
await page.waitForTimeout(400);
check(
  'chặn mật khẩu dưới 6 ký tự',
  await page.textContent('#password-error'),
  'Mật khẩu mới phải từ 6 ký tự trở lên.',
);

await page.fill('#password-new', 'MatKhauMoi#2026');
await page.fill('#password-confirm', 'MatKhauKhacHan');
await page.click('#password-submit');
await page.waitForTimeout(400);
check(
  'chặn hai ô không khớp',
  await page.textContent('#password-error'),
  'Hai ô mật khẩu mới chưa giống nhau.',
);

await page.fill('#password-current', 'SaiMatKhauCu#1');
await page.fill('#password-new', 'MatKhauMoi#2026');
await page.fill('#password-confirm', 'MatKhauMoi#2026');
await page.click('#password-submit');
await page.waitForTimeout(700);
check('sai mật khẩu cũ thì báo lỗi', await page.textContent('#password-error'), 'Sai email hoặc mật khẩu.');

page.once('dialog', (d) => d.accept());
await page.fill('#password-current', 'MatKhauRatDai#2026');
await page.click('#password-submit');
await page.waitForTimeout(900);
check('đổi mật khẩu thành công', await page.evaluate(() => window.__stubPasswordChanges ?? 0), 1);
check('đóng hộp thoại sau khi đổi', await page.isHidden('#password-modal'), true);

// --- quen mat khau ---
await page.click('#auth-toggle'); // dang xuat
await page.waitForTimeout(800);
await page.click('#auth-toggle'); // mo lai hop thoai dang nhap
await page.waitForTimeout(400);
check('có nút Quên mật khẩu', await page.isVisible('#login-forgot'), true);
await page.click('#login-forgot');
await page.waitForTimeout(300);
check(
  'chưa gõ email thì nhắc',
  await page.textContent('#login-error'),
  'Gõ email vào ô Tài khoản trước, rồi bấm lại.',
);
await page.fill('#login-username', 'nghia@arito.vn');
await page.click('#login-forgot');
await page.waitForTimeout(600);
check('gửi thư đặt lại', await page.evaluate(() => window.__stubResetEmails ?? []), ['nghia@arito.vn']);

check('không có lỗi JavaScript', errors, []);

await browser.close();
console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
