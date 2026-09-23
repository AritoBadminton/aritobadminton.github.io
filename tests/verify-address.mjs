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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const errors = [];

/** Mỗi newPage là một context riêng, localStorage không dùng chung — seed lại mỗi lần. */
const moTrang = async (seedAddress) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.addInitScript(
    ([month, address]) => {
      if (localStorage.getItem('__fakestore__')) return;
      localStorage.setItem(
        '__fakestore__',
        JSON.stringify({
          settings: {
            club: { name: 'CLB Test', updated: month + '-01', notes: [], ...address },
            rules: { footer: '', items: [] },
            qr: {},
            roster: { active: { An: true }, order: { An: 1 } },
          },
          months: { [month]: { label: 'Tháng này', dues: { An: { paid: 50000, note: '', skip: false } } } },
          transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
          admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
        }),
      );
    },
    [M, seedAddress],
  );
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return page;
};
const dangNhap = async (page) => {
  await page.click('#auth-toggle');
  await page.fill('#login-username', 'nghia@arito.vn');
  await page.fill('#login-password', 'MatKhauRatDai#2026');
  await page.click('#login-submit');
  await page.waitForTimeout(1600);
};

/* ---------- 1. Khách: chưa có địa chỉ thì khối tự ẩn ---------- */

const khach1 = await moTrang({});
check('chưa nhập địa chỉ thì khối ẩn với khách', await khach1.isVisible('#address-panel'), false);
await khach1.close();

/* ---------- 2. Admin: luôn thấy khối, kể cả khi chưa có gì ---------- */

const admin = await moTrang({});
await dangNhap(admin);
check('admin luôn thấy khối dù chưa có gì', await admin.isVisible('#address-panel'), true);
check('admin thấy ô nhập địa chỉ', await admin.isVisible('#address-text-input'), true);
check('admin thấy ô nhập link Google Maps', await admin.isVisible('#address-maplink-input'), true);
check('ô địa chỉ để trống ban đầu', await admin.inputValue('#address-text-input'), '');
check('ô link để trống ban đầu', await admin.inputValue('#address-maplink-input'), '');
check('tiêu đề khối đổi thành "Địa chỉ sân"', await admin.textContent('#address-panel h3'), 'Địa chỉ sân');

/* ---------- 2b. Gõ từng ký tự không bị mất focus giữa chừng ---------- */

// Bug đã gặp: mỗi ký tự ghi thẳng lên Firestore, onSnapshot đẩy ngược lại
// khiến renderDashboard() dựng lại toàn bộ innerHTML của khối, huỷ luôn ô
// đang gõ — mất focus ngay sau ký tự đầu tiên.
await admin.focus('#address-text-input');
await admin.type('#address-text-input', 'Sân A', { delay: 120 });
await admin.waitForTimeout(500);
check(
  'gõ nhiều ký tự liên tiếp không bị mất focus',
  await admin.evaluate(() => document.activeElement?.id),
  'address-text-input',
);
check(
  'gõ nhiều ký tự liên tiếp vẫn ra đủ chữ, không bị cắt cụt',
  await admin.inputValue('#address-text-input'),
  'Sân A',
);
await admin.fill('#address-text-input', '');
await admin.waitForTimeout(400);

/* ---------- 3. Admin gõ vào thì lưu ngay (chế độ Firebase: gõ là lưu) ---------- */

await admin.fill('#address-text-input', '123 Nguyễn Huệ, Quận 1, TP.HCM');
await admin.waitForTimeout(400);
await admin.fill('#address-maplink-input', 'https://maps.app.goo.gl/abc123');
await admin.waitForTimeout(600);

const saved = await admin.evaluate(() => JSON.parse(localStorage.getItem('__fakestore__')).settings.club);
check('lưu đúng địa chỉ vào settings/club', saved.address, '123 Nguyễn Huệ, Quận 1, TP.HCM');
check('lưu đúng link vào settings/club', saved.mapLink, 'https://maps.app.goo.gl/abc123');

check(
  'có dòng xem trước với đúng nội dung',
  (await admin.textContent('#address-panel')).includes('123 Nguyễn Huệ, Quận 1, TP.HCM'),
  true,
);
check(
  'link xem trước trỏ đúng địa chỉ đã lưu',
  await admin.getAttribute('#address-panel a', 'href'),
  'https://maps.app.goo.gl/abc123',
);
check('link mở tab mới', await admin.getAttribute('#address-panel a', 'target'), '_blank');

/* ---------- 4. Tải lại trang: ô nhập vẫn giữ đúng giá trị đã lưu ---------- */

await admin.reload({ waitUntil: 'networkidle' });
await admin.waitForTimeout(1300);
check(
  'tải lại vẫn giữ đúng địa chỉ trong ô nhập',
  await admin.inputValue('#address-text-input'),
  '123 Nguyễn Huệ, Quận 1, TP.HCM',
);
check(
  'tải lại vẫn giữ đúng link trong ô nhập',
  await admin.inputValue('#address-maplink-input'),
  'https://maps.app.goo.gl/abc123',
);
await admin.close();

/* ---------- 5. Khách: đã có địa chỉ thì thấy dòng chữ + link, không thấy ô nhập ---------- */

const khach2 = await moTrang({
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
  mapLink: 'https://maps.app.goo.gl/abc123',
});
check('khách thấy khối khi đã có địa chỉ', await khach2.isVisible('#address-panel'), true);
check('khách không thấy ô nhập địa chỉ', await khach2.isVisible('#address-text-input'), false);
check(
  'khách thấy đúng nội dung địa chỉ',
  (await khach2.textContent('#address-panel')).includes('123 Nguyễn Huệ, Quận 1, TP.HCM'),
  true,
);
check(
  'khách cũng thấy nhãn "Địa chỉ sân"',
  (await khach2.textContent('#address-panel')).includes('Địa chỉ sân'),
  true,
);
check(
  'khách thấy link Google Maps đúng href',
  await khach2.getAttribute('#address-panel a', 'href'),
  'https://maps.app.goo.gl/abc123',
);
await khach2.close();

/* ---------- 6. Có địa chỉ nhưng chưa có link: vẫn hiện chữ, không hiện link vỡ ---------- */

const khach3 = await moTrang({ address: 'Chỉ có địa chỉ, chưa có link', mapLink: '' });
check('vẫn hiện khối khi chỉ có chữ, chưa có link', await khach3.isVisible('#address-panel'), true);
check(
  'không có thẻ <a> khi chưa có link',
  await khach3.$eval('#address-panel', (e) => e.querySelector('a')),
  null,
);
await khach3.close();

/* ---------- 7. mapLink kiểu javascript: bị chặn, không gán vào href ---------- */

// Phòng khi tài khoản admin bị chiếm và mapLink bị đổi thành scheme nguy hiểm
// thay vì link Google Maps thật — xem isSafeUrl trong utils/dom.js.
const khach4 = await moTrang({
  address: 'Có địa chỉ, link là javascript:',
  mapLink: "javascript:alert('x')",
});
check(
  'không có thẻ <a> khi mapLink không phải http(s)',
  await khach4.$eval('#address-panel', (e) => e.querySelector('a')),
  null,
);
await khach4.close();

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
