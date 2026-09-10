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
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

// Khối quy định chỉ rơi về hiển thị ghi chú khi rules.items rỗng và người xem
// không phải admin (renderRules trong dashboard-view.js) — đúng cảnh trang thật
// đang gặp vì chưa có ai nhập mức đóng vào settings/rules trên Firestore.
await page.addInitScript((month) => {
  if (localStorage.getItem('__fakestore__')) return;
  localStorage.setItem(
    '__fakestore__',
    JSON.stringify({
      settings: {
        club: { name: 'CLB Test', updated: month + '-01', notes: [] },
        rules: { footer: '', items: [] },
        qr: {},
        roster: { active: { An: true }, order: { An: 1 } },
      },
      months: {
        [month]: { label: 'Tháng này', dues: { An: { paid: 50000, note: '', skip: false } } },
      },
      transactions: { t1: { type: 'thu', date: month + '-01', amount: 50000, desc: 'x', cat: 'y' } },
      admins: { 'uid-nghia': { email: 'nghia@arito.vn', name: 'Nghia' } },
    }),
  );
}, M);

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ---------- 1. Xuống dòng, in đậm, số tiền tô đỏ ---------- */

await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('__fakestore__'));
  data.settings.club.notes = [
    'Để hạn chế lãng phí tiền sân:\n**Vote mà không đi, phạt 30.000đ** (trừ trường hợp có lý do hợp lý)',
  ];
  localStorage.setItem('__fakestore__', JSON.stringify(data));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const noteHtml = await page.$eval('#rules-panel .rule-item__who', (e) => e.innerHTML);
check('có xuống dòng', noteHtml.includes('<br>'), true);
check('có chữ đậm', noteHtml.includes('<strong>Vote mà không đi, phạt'), true);
check('số tiền được bọc span tô đỏ', noteHtml.includes('<span class="note-amount">30.000đ</span>'), true);
check(
  'không còn cú pháp ** thô trên trang',
  await page.$eval('#rules-panel', (e) => e.textContent.includes('**')),
  false,
);
check(
  'phần ghi chú ngoại lệ vẫn hiển thị, không bị nuốt mất',
  (await page.textContent('#rules-panel .rule-item__who')).includes('trừ trường hợp có lý do hợp lý'),
  true,
);

/* ---------- 2. Ghi chú thường (không có cú pháp) vẫn hiển thị nguyên vẹn ---------- */

await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('__fakestore__'));
  data.settings.club.notes = ['Ghi chú: Chuyển khoản xong nhắn Zalo cho thủ quỹ'];
  localStorage.setItem('__fakestore__', JSON.stringify(data));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check(
  'bỏ tiền tố "Ghi chú:" và hiển thị đúng nội dung',
  (await page.textContent('#rules-panel .rule-item__who')).trim(),
  'Chuyển khoản xong nhắn Zalo cho thủ quỹ',
);

/* ---------- 3. Ký tự đặc biệt trong ghi chú vẫn được thoát an toàn ---------- */

await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('__fakestore__'));
  data.settings.club.notes = ['Sân <script>alert(1)</script> & "trích dẫn"'];
  localStorage.setItem('__fakestore__', JSON.stringify(data));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check(
  'không lọt thẻ script vào trang',
  await page.$eval('#rules-panel .rule-item__who', (e) => e.innerHTML.includes('<script>')),
  false,
);
check(
  'ký tự đặc biệt hiển thị đúng chữ, không phá layout',
  (await page.textContent('#rules-panel .rule-item__who')).trim(),
  'Sân <script>alert(1)</script> & "trích dẫn"',
);

check('không có lỗi javascript', errors, []);

await browser.close();
console.log(`\n${pass} đạt / ${fail} hỏng`);
process.exit(fail ? 1 : 0);
