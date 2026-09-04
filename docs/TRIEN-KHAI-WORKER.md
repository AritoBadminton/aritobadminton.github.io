# Bật chế độ lưu thẳng lên GitHub

Bình thường trang chỉ đọc `data.json`, muốn sửa dữ liệu chung phải dán tay. Tài liệu này
hướng dẫn dựng một **Cloudflare Worker** làm trung gian: Worker giữ token GitHub ở phía
máy chủ, admin đăng nhập vào trang rồi bấm **Lưu chung lên GitHub** là xong.

Làm một lần, khoảng 20 phút. Miễn phí — mức dùng của CLB không tới 1% hạn mức free.

> **Quan trọng:** token GitHub và mật khẩu ở dưới **chỉ dán vào Cloudflare**, đừng gửi cho
> ai, kể cả gửi lại vào khung chat này.

---

## Bước 1 — Tạo token GitHub

1. Mở https://github.com/settings/personal-access-tokens/new (Fine-grained token).
2. Điền:
   - **Token name**: `arito-quy-worker`
   - **Expiration**: chọn 1 năm (nhớ ngày hết hạn để tạo lại)
   - **Resource owner**: chọn tổ chức **AritoBadminton**
   - **Repository access**: `Only select repositories` → chọn `aritobadminton.github.io`
3. Kéo xuống **Repository permissions**, tìm dòng **Contents** → đổi thành
   **Read and write**. Không cần bật thêm quyền nào khác.
4. Bấm **Generate token**. GitHub hiện token **một lần duy nhất** — copy giữ tạm.

Token này chỉ ghi được đúng repo trang web, không đụng được vào tài khoản GitHub của bạn.

## Bước 2 — Tạo chuỗi khoá phiên

Worker cần một chuỗi ngẫu nhiên để ký vé đăng nhập. Mở trang bất kỳ, bấm **F12** → tab
**Console**, dán dòng này rồi Enter, copy kết quả:

```js
crypto.randomUUID() + crypto.randomUUID();
```

## Bước 3 — Tạo Worker trên Cloudflare

1. Đăng ký tài khoản miễn phí tại https://dash.cloudflare.com/sign-up rồi đăng nhập.
2. Menu trái → **Workers & Pages** → **Create** → **Start with Hello World!** → **Deploy**.
3. Đặt tên, ví dụ `arito-quy`. Sau khi deploy xong bấm **Edit code**.
4. Xoá hết code mẫu, dán **toàn bộ** nội dung file `worker/arito-quy-worker.js` trong repo
   này vào, rồi bấm **Deploy**.

## Bước 4 — Đặt 5 biến bí mật

Vào Worker vừa tạo → **Settings** → **Variables and Secrets** → **Add**. Với mỗi dòng dưới,
chọn **Type: Secret**, điền tên và giá trị, rồi **Deploy** lại một lần ở cuối.

| Tên biến         | Giá trị                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`   | token vừa tạo ở Bước 1                                                                           |
| `GITHUB_REPO`    | `AritoBadminton/aritobadminton.github.io`                                                        |
| `ADMIN_USERS`    | danh sách tài khoản dạng JSON, ví dụ:<br>`{"nghia":"MatKhauRieng#2026","lu":"MatKhauKhac#2026"}` |
| `SESSION_SECRET` | chuỗi ngẫu nhiên ở Bước 2                                                                        |
| `ALLOWED_ORIGIN` | `https://aritobadminton.github.io`                                                               |

Về `ADMIN_USERS`:

- Tên đăng nhập viết thường, không dấu, không khoảng trắng.
- Mỗi người **một mật khẩu riêng** — commit trên GitHub sẽ ghi tên người lưu, nên nhìn
  lịch sử là biết ai sửa gì.
- Mật khẩu **đặt dài và không dùng lại** mật khẩu email hay ngân hàng. Cloudflare cất
  dạng bí mật, sau khi lưu chính bạn cũng không xem lại được — chỉ ghi đè được.
- Bỏ ai khỏi danh sách này là người đó mất quyền ngay, không cần đổi gì khác.

## Bước 5 — Kiểm tra Worker sống

Copy địa chỉ Worker (dạng `https://arito-quy.<tên-bạn>.workers.dev`), mở thêm `/health`
trên trình duyệt:

```
https://arito-quy.<tên-bạn>.workers.dev/health
```

Thấy `{"ok":true}` là đạt.

## Bước 6 — Bật cho trang web

Mở `data.json` trên GitHub → bấm ✏️ → sửa mục `"api"` ở gần đầu file:

```json
 "api": {
  "baseUrl": "https://arito-quy.<tên-bạn>.workers.dev"
 },
```

Commit. Chờ khoảng một phút rồi tải lại trang.

---

## Sau khi bật, có gì đổi

|                   | Trước                                            | Sau                                         |
| ----------------- | ------------------------------------------------ | ------------------------------------------- |
| Đăng nhập         | mật khẩu nằm trong code, mở DevTools là qua được | máy chủ kiểm tra, không bịp được            |
| Số tài khoản      | một mật khẩu chung                               | mỗi người một tài khoản, thu hồi riêng được |
| Lưu dữ liệu chung | copy JSON rồi dán tay vào `data.json`            | bấm **Lưu chung lên GitHub** là xong        |
| Biết ai sửa       | không                                            | commit ghi tên người lưu                    |

Mật khẩu `Badminton2808` cũ **hết tác dụng** ngay khi `baseUrl` có giá trị. Vì vậy hãy
làm xong Bước 5 rồi mới làm Bước 6.

## Khi có trục trặc

- **Worker chết hoặc mất mạng** — trang tự quay về cách cũ: hiện khối JSON kèm hướng dẫn
  dán tay, thay đổi vẫn còn nguyên trên máy. Không mất dữ liệu.
- **"Phiên đăng nhập đã hết hạn"** — vé sống 8 tiếng, đăng nhập lại là được.
- **"Có người khác vừa lưu cùng lúc"** — hai người bấm Lưu gần như đồng thời. Worker đã tự
  thử lại 2 lần; gặp báo này thì bấm Lưu lần nữa.
- **Muốn tắt hẳn** — xoá giá trị `baseUrl` trong `data.json` về `""`. Trang quay lại y như
  trước, không cần sửa code.
- **Đổi mật khẩu một người** — sửa `ADMIN_USERS` trong Cloudflare rồi Deploy lại.
- **Token GitHub hết hạn** — tạo token mới theo Bước 1, ghi đè `GITHUB_TOKEN` rồi Deploy lại.

## Điều tài liệu này không hứa

Worker chặn được người ngoài ghi vào `data.json`, nhưng nó không phải hệ thống bảo mật
doanh nghiệp. Địa chỉ Worker là công khai, thứ chặn kẻ lạ là mật khẩu — nên mật khẩu yếu
là điểm yếu duy nhất còn lại. Worker cố tình trả lời chậm 0,7 giây mỗi lần sai mật khẩu để
làm nản việc dò, nhưng cách phòng thật sự vẫn là đặt mật khẩu dài.

Nếu muốn chắc hơn nữa, trong Cloudflare có thể bật thêm **Rate limiting rule** miễn phí cho
đường dẫn `/login`.
