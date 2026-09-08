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
await page.waitForTimeout(1200);

// khach thi khong thay nut
await page.waitForTimeout(300);
check('khách không thấy nút thêm', await page.isVisible('#members-add-toggle'), false);

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1500);
await page.click('[data-panel="members"]');
await page.waitForTimeout(700);

check('admin thấy nút thêm', await page.isVisible('#members-add-toggle'), true);
check('ô nhập ẩn lúc đầu', await page.isVisible('#members-add-form'), false);

await page.click('#members-add-toggle');
await page.waitForTimeout(300);
check('bấm nút thì hiện ô nhập', await page.isVisible('#members-add-form'), true);

// ten rong
await page.click('#members-add-submit');
await page.waitForTimeout(400);
check('tên rỗng báo lỗi', await page.textContent('#members-add-error'), 'Chưa nhập tên.');

// trung ten
await page.fill('#members-add-name', 'an');
await page.click('#members-add-submit');
await page.waitForTimeout(500);
check('trùng tên báo lỗi', await page.textContent('#members-add-error'), 'Đã có "An" trong danh sách.');

// them that
await page.fill('#members-add-name', 'Cường Văn');
await page.press('#members-add-name', 'Enter');
await page.waitForTimeout(1200);
check('thêm xong thì đóng ô nhập', await page.isVisible('#members-add-form'), false);
const names = await page.$$eval('#members-table td.cell-name', (els) => els.map((e) => e.textContent.trim()));
check('người mới có trong bảng', names.includes('Cường Văn'), true);
check('đang hoạt động là 3 người', await page.textContent('#members-active'), '3 người');

const row = await page.$$eval('#members-table tr', (els) => {
  const tr = els.find((e) => e.textContent.includes('Cường Văn'));
  return [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
});
check('tổng đóng của người mới là 0', row[3], '0 đ');
check('đã tính vào tháng hiện tại', row[4], '1');
check('chưa đóng đủ tháng nào', row[5], '0/1');
check('không hiện NaN', row.join(' ').includes('NaN'), false);
check('cột tháng gần nhất là tháng này', row[7].startsWith('Tháng '), true);

// co mat o bang dong quy thang hien tai
await page.click('[data-panel="months"]');
await page.waitForTimeout(900);
const dues = await page.$$eval('#dues-table td.cell-name', (els) => els.map((e) => e.textContent.trim()));
check('có mặt ở bảng đóng quỹ tháng này', dues.includes('Cường Văn'), true);

// giu sau khi tai lai
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
const dues2 = await page.$$eval('#dues-table td.cell-name', (els) => els.map((e) => e.textContent.trim()));
check('giữ sau khi tải lại', dues2.includes('Cường Văn'), true);

// bo tick roi tick lai
await page.click('[data-panel="members"]');
await page.waitForTimeout(700);
const cb = page.locator('#members-table .js-member-active[data-name="Cường Văn"]');
await cb.uncheck();
await page.waitForTimeout(1000);
await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
check(
  'bỏ tick → biến khỏi bảng đóng quỹ',
  (await page.$$eval('#dues-table td.cell-name', (els) => els.map((e) => e.textContent.trim()))).includes(
    'Cường Văn',
  ),
  false,
);

await page.click('[data-panel="members"]');
await page.waitForTimeout(700);
await page.locator('#members-table .js-member-active[data-name="Cường Văn"]').check();
await page.waitForTimeout(1000);
await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
check(
  'tick lại → quay về bảng đóng quỹ',
  (await page.$$eval('#dues-table td.cell-name', (els) => els.map((e) => e.textContent.trim()))).includes(
    'Cường Văn',
  ),
  true,
);

// nguoi chi co trong roster, chua thuoc thang nao: khong duoc ra NaN
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('__fakestore__'));
  db.settings.roster.active['Người Lẻ'] = true;
  localStorage.setItem('__fakestore__', JSON.stringify(db));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="members"]');
await page.waitForTimeout(700);
const lone = await page.$$eval('#members-table tr', (els) => {
  const tr = els.find((e) => e.textContent.includes('Người Lẻ'));
  return tr ? [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()) : null;
});
check('người chưa thuộc tháng nào vẫn hiện', lone !== null, true);
check('người đó: 0 tháng', lone && lone[4], '0');
check('người đó: không NaN', lone && lone.join(' ').includes('NaN'), false);
check('người đó: báo chưa có tháng nào', lone && lone[7], 'Chưa có tháng nào');

check('không có lỗi JavaScript', errors, []);
await browser.close();
console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
