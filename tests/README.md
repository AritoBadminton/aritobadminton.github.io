# Bộ kiểm thử

Kiểm thử đầu-cuối chạy bằng Playwright trên Chromium thật, với Firebase được
thay bằng module giả lập trong `fbstub/`. Nhờ vậy test chạy được không cần mạng,
không cần tài khoản Firebase, và **không bao giờ đụng vào dữ liệu thật của quỹ**.

## Chạy

```bash
bash tests/chay-tat-ca.sh          # dựng bản test, mở máy chủ, chạy hết
```

Chạy riêng một file:

```bash
bash tests/make-fbtest.sh          # dựng /tmp/fbtest
bash tests/serve.sh                # phục vụ ở http://127.0.0.1:8199
node tests/verify-guest.mjs
```

Cần `playwright` và một bản Chromium. Mặc định tìm ở `/opt/pw-browsers/chromium`;
máy khác thì đặt biến môi trường `CHROMIUM_PATH`.

## Cách hoạt động

`make-fbtest.sh` chép mã nguồn sang `/tmp/fbtest`, đổi import map trong các file
HTML để `firebase/app|auth|firestore` trỏ vào `fbstub/`, rồi điền một cấu hình
Firebase giả để ứng dụng chạy ở **chế độ Firebase**.

`fbstub/firestore.js` giữ toàn bộ dữ liệu trong `localStorage.__fakestore__`
theo đúng hình dạng Firestore thật:

```js
{
  settings: { club: {...}, rules: {...}, qr: {...}, roster: { active: {}, order: {} } },
  months:   { '2026-09': { label, dues: { '<tên>': { paid, note, skip } } } },
  transactions: { '<id>': { type, date, amount, desc, cat } },
  admins:   { '<uid>': { email, name } },
}
```

Mỗi test tự gieo dữ liệu bằng `page.addInitScript` trước khi trang tải. Lưu ý:
`browser.newPage()` tạo một context riêng nên **localStorage không dùng chung**
giữa các page — trang khách phải được gieo lại dữ liệu của chính nó.

Tài khoản admin trong bản giả lập: `nghia@arito.vn` / `MatKhauRatDai#2026`.

## Các file

| File                                                     | Kiểm cái gì                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `verify-guest.mjs`                                       | Khách chưa đăng nhập thấy gì; tab và bảng chỉ dành cho admin               |
| `verify-gopquy.mjs`                                      | Gộp tiền đóng quỹ vào tổng thu, không đếm hai lần                          |
| `verify-quycongty.mjs`                                   | Ô "Tiền quỹ công ty cấp", công tắc hiển thị, mặc định ô nhập, danh mục thu |
| `verify-stt.mjs`, `verify-stt2.mjs`, `verify-addstt.mjs` | Số thứ tự thành viên: đặt, trùng, đánh số lại, giữ nguyên khi lọc          |
| `verify-addmember.mjs`, `verify-delmember.mjs`           | Thêm và xoá thành viên                                                     |
| `verify-createmonth.mjs`, `verify-delmonth.mjs`          | Tạo và xoá tháng đóng quỹ                                                  |
| `verify-copy.mjs`                                        | Nhân bản giao dịch ở Sổ thu chi                                            |

Chạy hết bộ mất khoảng 12 phút. Sửa mã nguồn xong vẫn nên chạy lại **cả bộ**
trước khi đẩy lên, vì các màn hình dùng
chung store nên một thay đổi nhỏ dễ làm hỏng chỗ khác.
