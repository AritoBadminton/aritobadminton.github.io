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

/** Gieo đủ mỗi loại dữ liệu một dòng, để kiểm bản sao lưu đọc đúng cả 5 nhóm. */
const seed = (month) => {
  if (localStorage.getItem('__fakestore__')) return;
  localStorage.setItem(
    '__fakestore__',
    JSON.stringify({
      settings: {
        club: { name: 'CLB Test', updated: month + '-01', notes: [], address: '123 Đường X' },
        rules: { title: 'Mức đóng', items: [{ label: 'Thành viên', amount: 50000 }], footer: '' },
        qr: { name: 'NGUYEN VAN A', account: '0000', bank: 'Test Bank' },
        roster: { active: { An: true }, order: { An: 1 } },
      },
      months: { [month]: { label: 'Tháng này', dues: { An: { paid: 50000, note: '', skip: false } } } },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
      categories: {
        c1: { type: 'thu', code: 'THU-001', name: 'y', color: '#000000', defaultAmount: 0, defaultDesc: '' },
      },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
};

const moTrang = async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.addInitScript(seed, M);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return page;
};

const dangNhap = async (page) => {
  await page.click('#auth-toggle');
  await page.fill('#login-username', 'nghia@arito.vn');
  await page.fill('#login-password', 'MatKhauRatDai#2026');
  await page.click('#login-submit');
  await page.waitForTimeout(1200);
};

/* ---------- 1. Khách không thấy nút sao lưu ---------- */

const khach = await moTrang();
check('khách không thấy nút tải sao lưu', await khach.isVisible('#backup-toggle'), false);
await khach.close();

/* ---------- 2. Admin thấy nút và tải được file đúng nội dung ---------- */

const admin = await moTrang();
await dangNhap(admin);
check('admin thấy nút tải sao lưu', await admin.isVisible('#backup-toggle'), true);

const [download] = await Promise.all([admin.waitForEvent('download'), admin.click('#backup-toggle')]);
check('tên file đúng dạng .json', download.suggestedFilename().endsWith('.json'), true);
check('tên file có chữ "sao-luu"', download.suggestedFilename().includes('sao-luu'), true);

const stream = await download.createReadStream();
const chunks = [];
for await (const chunk of stream) chunks.push(chunk);
const content = JSON.parse(Buffer.concat(chunks).toString('utf8'));

check('có trường exportedAt', typeof content.exportedAt === 'string' && content.exportedAt.length > 0, true);
check('có đủ tháng đã gieo', Object.keys(content.months), [M]);
check('tháng đọc đúng dữ liệu đóng quỹ', content.months[M].dues.An.paid, 50000);
check('có đủ giao dịch đã gieo', Object.keys(content.transactions), ['t1']);
check('có đủ danh mục đã gieo', Object.keys(content.categories), ['c1']);
check('có đủ admin đã gieo', Object.keys(content.admins), ['uid-nghia']);
check('settings.club đọc đúng', content.settings.club.name, 'CLB Test');
check('settings.rules đọc đúng', content.settings.rules.title, 'Mức đóng');
check('settings.qr đọc đúng', content.settings.qr.bank, 'Test Bank');
check('settings.roster đọc đúng', content.settings.roster.active.An, true);

await admin.waitForTimeout(500);
check('toast báo đã tải xong', (await admin.textContent('#toast'))?.trim(), 'Đã tải xong bản sao lưu');

await admin.close();

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
