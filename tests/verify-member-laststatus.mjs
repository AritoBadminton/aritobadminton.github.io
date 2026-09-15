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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// Ba người ba trạng thái khác nhau ở tháng gần nhất, để kiểm đủ cả ba nhãn
// cột "Tháng có tên gần nhất" ở tab Thành viên.
await page.addInitScript(
  (thisM) => {
    if (localStorage.getItem('__fakestore__')) return;
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: {
            active: { An: true, Binh: true, Cuong: true },
            order: { An: 1, Binh: 2, Cuong: 3 },
          },
        },
        months: {
          [thisM]: {
            label: 'Tháng này',
            dues: {
              An: { paid: 50000, note: '', skip: false },
              Binh: { paid: 0, note: '', skip: false },
              Cuong: { paid: 0, note: '', skip: true },
            },
          },
        },
        transactions: {},
        admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
      }),
    );
  },
  [THIS],
);
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1800);

await page.click('[data-panel="members"]');
await page.waitForTimeout(900);

const rows = await page.$$eval('#members-table tr', (trs) =>
  trs.map((tr) => {
    const name = tr.querySelector('.cell-name')?.textContent.trim();
    const pill = tr.querySelector('.pill');
    return { name, label: pill?.textContent.trim(), className: pill?.className };
  }),
);
const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

/* ---------- 1. Ba nhãn đúng chữ, viết hoa chữ cái đầu ---------- */

check('An đã đóng: nhãn "Đã đóng"', byName.An.label, 'Đã đóng');
check('An đã đóng: lớp pill--paid', byName.An.className.includes('pill--paid'), true);

check('Binh chưa đóng: nhãn "Chưa đóng"', byName.Binh.label, 'Chưa đóng');
check('Binh chưa đóng: lớp pill--unpaid', byName.Binh.className.includes('pill--unpaid'), true);

/* ---------- 2. Trạng thái mới "Không chơi" ---------- */

check('Cuong không chơi: nhãn "Không chơi"', byName.Cuong.label, 'Không chơi');
check('Cuong không chơi: lớp pill--skipped', byName.Cuong.className.includes('pill--skipped'), true);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
