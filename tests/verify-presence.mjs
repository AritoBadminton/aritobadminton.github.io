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
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const trackErrors = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
};

/** Gieo dữ liệu tối thiểu, kèm sẵn các phiên "presence" tuỳ chọn. */
const seed = ([month, presence]) => {
  if (localStorage.getItem('__fakestore__')) return;
  localStorage.setItem(
    '__fakestore__',
    JSON.stringify({
      settings: {
        club: { name: 'CLB Test', updated: month + '-01', notes: [] },
        rules: { footer: '', items: [] },
        qr: {},
        roster: { active: { An: true }, order: {} },
      },
      months: { [month]: { label: 'Tháng này', dues: { An: { paid: 0, note: '', skip: false } } } },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
      admins: {},
      presence,
    }),
  );
};

/** Một context riêng, một trang — dùng cho các phép kiểm không cần chia sẻ dữ liệu với trang khác. */
const moTrangRieng = async (extraPresence = {}) => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  trackErrors(page);
  await page.addInitScript(seed, [M, extraPresence]);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return page;
};

/* ---------- 1. Một mình thì huy hiệu đếm đúng 1 ---------- */

const tab1 = await moTrangRieng();
check('huy hiệu hiện ra sau khi vào trang', await tab1.isVisible('#presence-badge'), true);
check('một mình thì đếm đúng 1', (await tab1.textContent('#presence-count')).trim(), '1');
await tab1.close();

/* ---------- 2. Phiên cũ đã quá hạn (lastSeen 5 phút trước) không được tính ---------- */

const staleTab = await moTrangRieng({
  'nguoi-cu': {
    lastSeen: { _millis: Date.now() - 5 * 60 * 1000 },
    expiresAt: { _millis: Date.now() + 60000 },
  },
});
check(
  'phiên cũ quá hạn không được tính là đang xem',
  (await staleTab.textContent('#presence-count')).trim(),
  '1',
);
await staleTab.close();

/* ---------- 3. Hai tab cùng mở (chia sẻ một "Firestore" giả) thì đếm đủ 2 ---------- */

// Cố ý dùng chung một BrowserContext ở đây (khác mọi test khác trong bộ, vốn
// luôn mở context riêng cho từng trang) — phép kiểm này cần hai tab CHIA SẺ
// cùng một localStorage/BroadcastChannel để mô phỏng đúng việc hai người
// cùng mở trang thật cùng lúc; context riêng sẽ cô lập dữ liệu, không tab nào
// thấy tab kia.
const sharedContext = await browser.newContext({ viewport: { width: 1300, height: 900 } });
sharedContext.on('page', trackErrors);

const tabA = await sharedContext.newPage();
await tabA.addInitScript(seed, [M, {}]);
await tabA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await tabA.waitForTimeout(1200);
check('tab A một mình đếm đúng 1', (await tabA.textContent('#presence-count')).trim(), '1');

const tabB = await sharedContext.newPage();
await tabB.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await tabB.waitForTimeout(1200);
check('tab B vừa mở tự thấy cả hai (mình + tab A)', (await tabB.textContent('#presence-count')).trim(), '2');

await sharedContext.close();

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
