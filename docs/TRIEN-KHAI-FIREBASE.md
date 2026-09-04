# Chuyển sang Firebase — sửa là cả nhóm thấy ngay

Hiện trang đọc `data.json` và admin phải dán tay khi muốn cập nhật dữ liệu chung. Làm xong
tài liệu này thì: mỗi thủ quỹ có tài khoản riêng, sửa cái gì là **mọi máy đang mở trang thấy
ngay lập tức**, không cần commit, không cần tải lại.

Khoảng 30 phút. Miễn phí — gói Spark cho 50.000 lượt đọc và 20.000 lượt ghi mỗi ngày, không
cần khai báo thẻ. CLB dùng chưa tới 1%.

> **Đừng gửi mật khẩu hay khoá nào vào khung chat.** Riêng `firebaseConfig` ở Bước 5 thì gửi
> được — Firebase thiết kế để nó công khai, nó chỉ cho biết dự án nào chứ không cấp quyền gì.
> Quyền ghi do `firestore.rules` quyết định.

---

## Bước 1 — Tạo dự án Firebase

1. Vào https://console.firebase.google.com → **Create a project**.
2. Đặt tên, ví dụ `arito-quy-clb`. Tắt Google Analytics cho gọn.
3. Chờ tạo xong → **Continue**.

## Bước 2 — Bật Firestore

1. Menu trái → **Build** → **Firestore Database** → **Create database**.
2. Chọn **Start in production mode** (không chọn test mode — chế độ đó cho ai cũng ghi được).
3. Chọn vùng đặt máy chủ: `asia-southeast1 (Singapore)` cho gần Việt Nam nhất.

## Bước 3 — Dán luật bảo mật

Vào tab **Rules** của Firestore, xoá hết nội dung cũ, dán **toàn bộ** file `firestore.rules`
trong repo này vào, rồi bấm **Publish**.

Luật này cho: ai cũng **đọc** được số liệu, nhưng chỉ tài khoản có hồ sơ trong `admins` mới
**ghi** được. Nó cũng chặn dữ liệu sai hình dạng — số tiền âm, ngày sai định dạng đều bị từ chối.

## Bước 4 — Bật đăng nhập và tạo tài khoản

1. Menu trái → **Build** → **Authentication** → **Get started**.
2. Tab **Sign-in method** → chọn **Email/Password** → bật **Enable** → **Save**.
   (Không cần bật Email link.)
3. Tab **Users** → **Add user** → nhập email và mật khẩu cho từng thủ quỹ. Mỗi người một tài khoản.
4. Với **mỗi người**, copy giá trị cột **User UID** (chuỗi dài như `k3Jd8...`).

Rồi cấp quyền ghi cho họ:

5. Quay lại **Firestore Database** → **Start collection** → Collection ID: `admins`.
6. Document ID: **dán đúng User UID** của người đó (không phải email).
7. Thêm hai trường cho dễ nhớ: `email` (string) và `name` (string). Bấm **Save**.
8. Lặp lại cho từng người.

Sau này thu hồi quyền của ai thì **xoá tài liệu `admins/<uid>` của người đó** — họ vẫn đăng nhập
được nhưng chỉ xem, và trang sẽ nói rõ lý do cho họ.

## Bước 5 — Lấy cấu hình và gửi cho tôi

1. Bấm bánh răng ⚙ cạnh **Project Overview** → **Project settings**.
2. Kéo xuống mục **Your apps** → bấm biểu tượng web `</>`.
3. Đặt tên app, ví dụ `web`. **Không** cần bật Firebase Hosting.
4. Firebase hiện một khối `const firebaseConfig = { ... }` — copy cả khối đó.
5. Gửi khối đó cho tôi, hoặc tự điền vào `src/config/firebase-config.js` rồi commit.

## Bước 6 — Chuyển dữ liệu cũ sang

Sau khi `firebase-config.js` đã có thông tin và trang đã cập nhật:

1. Mở `https://aritobadminton.github.io/migrate.html`
2. Đăng nhập bằng tài khoản vừa tạo.
3. Bấm **Bắt đầu chuyển**.

Trang sẽ đọc `data.json`, ghi **230 tài liệu** vào Firestore rồi tự đối chiếu lại và in ra:

```
✓ Số tháng: 21 / 21
✓ Số dòng đóng quỹ: 353 / 353
✓ Số giao dịch thu chi: 205 / 205
✓ Số thành viên: 43 / 43
HOÀN TẤT — số liệu khớp hoàn toàn.
```

Chạy nhầm lần hai sẽ bị chặn để khỏi ghi đè. Xong rồi mở lại trang chính là thấy dữ liệu chạy
từ Firebase.

---

## Sau khi chuyển, có gì đổi

|                   | Trước                                            | Sau                                     |
| ----------------- | ------------------------------------------------ | --------------------------------------- |
| Lưu dữ liệu chung | copy JSON rồi dán vào `data.json`                | sửa là lưu ngay                         |
| Người khác thấy   | sau khi commit và chờ GitHub Pages               | **ngay lập tức**, không cần tải lại     |
| Đăng nhập         | một mật khẩu trong code, mở DevTools là qua được | tài khoản riêng, Firebase kiểm tra thật |
| Thu hồi quyền     | đổi mật khẩu, báo lại cả nhóm                    | xoá một tài liệu `admins/<uid>`         |
| Người chỉ xem     | không cần đăng nhập                              | vẫn không cần đăng nhập                 |

Toàn bộ thanh **"Lưu chung lên GitHub"** và khối dán JSON sẽ tự biến mất — không còn cần nữa.

## Điều cần biết trước

- **Không có sao lưu tự động.** Gói miễn phí của Firebase không có khôi phục theo thời điểm.
  `data.json` trong repo vẫn còn nguyên cùng lịch sử Git, nên số liệu tính tới ngày chuyển vẫn
  an toàn — nhưng từ đó về sau thì chưa có gì đỡ. Muốn thêm nút "Tải bản sao lưu" thì báo tôi.
- **Tắt được bất cứ lúc nào.** Xoá `projectId` trong `src/config/firebase-config.js` về `''`
  là trang quay lại chạy bằng `data.json` y như cũ. Không phải sửa code.
- **Mật khẩu `Badminton2808` hết tác dụng** ngay khi bật chế độ Firebase.
- **Đừng chọn "test mode"** ở Bước 2. Test mode cho bất kỳ ai trên Internet ghi vào cơ sở dữ
  liệu của bạn trong 30 ngày.

## Tự kiểm tra luật bảo mật

Firebase Console có sẵn **Rules Playground** (tab Rules → nút **Playground**). Nên thử 4 tình
huống này trước khi tin tưởng:

| Thao tác | Đường dẫn                | Đăng nhập                       | Kết quả đúng |
| -------- | ------------------------ | ------------------------------- | ------------ |
| get      | `/transactions/thu-0000` | không                           | **Allow**    |
| create   | `/transactions/moi`      | không                           | **Deny**     |
| create   | `/transactions/moi`      | UID có trong `admins`           | **Allow**    |
| create   | `/transactions/moi`      | UID **không** có trong `admins` | **Deny**     |

## Khi có trục trặc

- **"Missing or insufficient permissions"** — tài khoản đó chưa có tài liệu trong `admins`, hoặc
  Document ID điền nhầm email thay vì UID.
- **Trang báo "Firestore chưa có dữ liệu"** — chưa chạy Bước 6.
- **Sửa xong máy khác không thấy** — kiểm tra máy đó có báo "Mất kết nối tới Firebase" ở đầu
  trang không; thường là do mạng.
