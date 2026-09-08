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
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// An đã đóng tiền ở hai tháng; Bình chưa đóng đồng nào (dòng nhập thử).
await page.addInitScript(
  ([thisM, prevM]) => {
    if (localStorage.getItem('__fakestore__')) return;
    localStorage.setItem(
      '__fakestore__',
      JSON.stringify({
        settings: {
          club: { name: 'CLB Test', updated: thisM + '-01', notes: [] },
          rules: { footer: '', items: [] },
          qr: {},
          roster: { active: { An: true, Bình: true, Cường: true }, order: { An: 1, Bình: 2, Cường: 3 } },
        },
        months: {
          [prevM]: {
            label: 'Tháng trước',
            dues: {
              An: { paid: 50000, note: '', skip: false },
              Cường: { paid: 50000, note: '', skip: false },
            },
          },
          [thisM]: {
            label: 'Tháng này',
            dues: {
              An: { paid: 70000, note: '', skip: false },
              Bình: { paid: 0, note: '', skip: false },
              Cường: { paid: 0, note: '', skip: false },
            },
          },
        },
        transactions: { t1: { type: 'thu', date: thisM + '-01', amount: 50000, desc: 'x', cat: 'y' } },
        admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
      }),
    );
  },
  [THIS, PREV],
);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);

/* ---------- 1. Thứ tự tab ---------- */

check(
  'thứ tự tab đúng yêu cầu',
  await page.$$eval('.tab-nav__item', (els) => els.map((e) => e.textContent.trim())),
  ['Tổng quan', 'Thành viên', 'Đóng quỹ theo tháng', 'Sổ thu chi'],
);

/* ---------- 2. Logo ---------- */

check(
  'biểu tượng tab là ảnh png',
  (await page.getAttribute('link[rel="icon"]', 'href')).startsWith('data:image/png;base64,'),
  true,
);
check(
  'logo là thẻ img, không phụ thuộc file CSS',
  await page.$eval('.app-header__logo', (e) => e.tagName.toLowerCase()),
  'img',
);
check(
  'logo trỏ vào ảnh png',
  (await page.getAttribute('.app-header__logo', 'src')).startsWith('data:image/png;base64,'),
  true,
);
check('logo có chữ thay thế', await page.getAttribute('.app-header__logo', 'alt'), 'Logo Arito Badminton');
check(
  'logo hiện ra với đúng kích thước',
  await page.$eval('.app-header__logo', (e) => [e.clientWidth, e.clientHeight]),
  [38, 38],
);
check(
  'các file CSS có gắn số phiên bản',
  await page.$$eval('link[rel=stylesheet]', (els) =>
    els.every((e) => /\?v=\d+$/.test(e.getAttribute('href'))),
  ),
  true,
);

/* ---------- 3. Khách không thấy nút xoá ---------- */

await page.click('[data-panel="months"]');
await page.waitForTimeout(700);
check('chưa đăng nhập thì tab Thành viên bị ẩn', await page.isVisible('[data-panel="members"]'), false);

await page.click('#auth-toggle');
await page.fill('#login-username', 'nghia@arito.vn');
await page.fill('#login-password', 'MatKhauRatDai#2026');
await page.click('#login-submit');
await page.waitForTimeout(1600);
await page.click('[data-panel="members"]');
await page.waitForTimeout(900);

const names = () => page.$$eval('#members-table .cell-name', (els) => els.map((e) => e.textContent.trim()));

// Một người gác hộp thoại duy nhất: page.once còn treo lại sẽ nuốt nhầm hộp
// thoại của bài kiểm thử sau.
let hopThoai = { hien: false, loi: '', dongY: false };
page.on('dialog', async (d) => {
  hopThoai.hien = true;
  hopThoai.loi = d.message();
  await (hopThoai.dongY ? d.accept() : d.dismiss());
});
const rinhHopThoai = (dongY = false) => {
  hopThoai = { hien: false, loi: '', dongY };
};
const delBtn = async (name) => {
  const i = (await names()).indexOf(name);
  return page.$(`#members-table tr:nth-child(${i + 1}) .js-member-delete`);
};

/* ---------- 4. Dấu × luôn hiện ---------- */

check(
  'mỗi dòng có một nút xoá',
  (await page.$$('#members-table .js-member-delete')).length,
  (await names()).length,
);
check(
  'nút nằm ở ô cuối cùng của dòng',
  await page.$eval('#members-table tr', (r) => r.lastElementChild.classList.contains('cell-delete')),
  true,
);
check(
  'dấu × luôn hiện, giống bên Sổ thu chi',
  await page.$$eval('#members-table .js-member-delete', (els) =>
    els.every((e) => getComputedStyle(e).opacity === '1'),
  ),
  true,
);
check('dấu × là chữ ×', (await page.textContent('#members-table .js-member-delete')).trim(), '\u00d7');
check(
  'cột xoá không có tiêu đề, giống Sổ thu chi',
  await page.$eval('#panel-members thead tr', (r) => r.lastElementChild.textContent.trim()),
  '',
);

/* ---------- 5. Bấm một lần chỉ hỏi lại ---------- */

(await delBtn('Bình')).click();
await page.waitForTimeout(600);
const armed = await page.$('#members-table .btn--delete-armed');
check('bấm lần đầu đổi thành "Xoá?"', await armed.textContent(), 'Xoá?');
check('chưa xoá ai', (await names()).includes('Bình'), true);

// Bấm sang người khác thì huỷ xác nhận của người cũ.
(await delBtn('Cường')).click();
await page.waitForTimeout(600);
check('chỉ một nút ở trạng thái chờ', (await page.$$('#members-table .btn--delete-armed')).length, 1);
check(
  'nút chờ là của Cường',
  await page.$eval('#members-table .btn--delete-armed', (e) => e.dataset.name),
  'Cường',
);

/* ---------- 6. Xoá người chưa có số liệu: không hỏi thêm ---------- */

(await delBtn('Bình')).click();
await page.waitForTimeout(500);
rinhHopThoai();
(await delBtn('Bình')).click();
await page.waitForTimeout(2000);
check('người chưa đóng đồng nào thì không hỏi thêm', hopThoai.hien, false);
check('Bình đã bị xoá', (await names()).includes('Bình'), false);

/* ---------- 7. Xoá người đã có lịch sử: hỏi rõ số tiền ---------- */

(await delBtn('An')).click();
await page.waitForTimeout(500);
rinhHopThoai();
(await delBtn('An')).click();
await page.waitForTimeout(1500);
check('có hỏi lại khi người đó đã đóng tiền', hopThoai.loi.includes('120.000'), true);
check('lời nhắc nêu số tháng', hopThoai.loi.includes('2 tháng'), true);
check('lời nhắc gợi ý bỏ tick thay vì xoá', hopThoai.loi.includes('Hoạt động'), true);
check('bấm Huỷ thì An còn nguyên', (await names()).includes('An'), true);

(await delBtn('An')).click();
await page.waitForTimeout(500);
rinhHopThoai(true);
(await delBtn('An')).click();
await page.waitForTimeout(2500);
check('đồng ý thì An biến mất', (await names()).includes('An'), false);
check('còn lại đúng một người', await names(), ['Cường']);

/* ---------- 8. Xoá sạch cả dòng đóng quỹ ở mọi tháng ---------- */

await page.click('[data-panel="months"]');
await page.waitForTimeout(1200);
const trongThang = () => page.$$eval('#dues-table .cell-name', (els) => els.map((e) => e.textContent.trim()));
check(
  'tháng này không còn tên đã xoá',
  (await trongThang()).filter((n) => n === 'An' || n === 'Bình'),
  [],
);
await page.selectOption('#month-picker', PREV);
await page.waitForTimeout(900);
check('tháng cũ cũng sạch', (await trongThang()).includes('An'), false);

/* ---------- 9. Xoá hẳn khỏi dữ liệu chung, không hiện lại sau khi tải ---------- */

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('[data-panel="members"]');
await page.waitForTimeout(900);
check('tải lại vẫn chỉ còn Cường', await names(), ['Cường']);
check('số thứ tự của Cường giữ nguyên', await page.inputValue('#members-table .js-member-order'), '3');

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
