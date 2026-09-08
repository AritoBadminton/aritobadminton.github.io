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
        roster: { active: { An: true, Bình: true }, order: {} },
      },
      months: {
        [month]: {
          label: 'Tháng thử',
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
}, THIS);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1600);
await page.click('[data-panel="months"]');
await page.waitForTimeout(900);

check('có nút xoá tháng', await page.isVisible('#month-delete'), true);
check('nút ghi rõ tháng nào', (await page.textContent('#month-delete')).trim().startsWith('Xoá tháng'), true);
check('tháng đang có tiền → nút mờ', await page.isDisabled('#month-delete'), true);

// tao thang moi (trang) roi xoa duoc
await page.click('#month-create');
await page.waitForTimeout(1500);
check('đang xem tháng mới', await page.inputValue('#month-picker'), NEXT);
check('tháng trắng → nút bật', await page.isDisabled('#month-delete'), false);

// huy o hop xac nhan thi khong xoa
page.once('dialog', (d) => d.dismiss());
await page.click('#month-delete');
await page.waitForTimeout(900);
check(
  'bấm Huỷ thì tháng vẫn còn',
  (await page.$$eval('#month-picker option', (els) => els.map((e) => e.value))).includes(NEXT),
  true,
);

// dong y thi xoa that
page.once('dialog', (d) => d.accept());
await page.click('#month-delete');
await page.waitForTimeout(1500);
check(
  'đồng ý thì tháng biến mất',
  (await page.$$eval('#month-picker option', (els) => els.map((e) => e.value))).includes(NEXT),
  false,
);
check('quay về tháng còn lại', await page.inputValue('#month-picker'), THIS);

// xoa roi van tao lai duoc
await page.click('#month-create');
await page.waitForTimeout(1500);
check(
  'tạo lại được sau khi xoá',
  (await page.$$eval('#month-picker option', (els) => els.map((e) => e.value))).includes(NEXT),
  true,
);

// danh dau mot nguoi da dong roi thu xoa -> bi chan
await page.selectOption('#month-picker', NEXT);
await page.waitForTimeout(700);
await page.selectOption('#dues-table .status-select >> nth=0', 'paid');
await page.waitForTimeout(1200);
check('có người đóng rồi → nút mờ lại', await page.isDisabled('#month-delete'), true);

// khach khong thay nut
await page.click('#auth-toggle');
await page.waitForTimeout(1200);
await page.click('[data-panel="months"]').catch(() => {});
await page.waitForTimeout(700);
check('khách không thấy nút xoá', await page.isVisible('#month-delete'), false);

check('không có lỗi JavaScript', errors, []);
await browser.close();
console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
