# Kiến trúc dự án

Trang chạy trên GitHub Pages — **không có bước build, không có máy chủ**. Vì vậy mã nguồn dùng
ES Modules gốc của trình duyệt (`<script type="module">`) thay vì bundler. Mở `index.html` qua
một máy chủ tĩnh bất kỳ là chạy được ngay.

## Sơ đồ thư mục

```
index.html                    Điểm vào: chỉ chứa markup và thẻ <link>/<script>
data.json                     Dữ liệu chung (cố ý để ở gốc — xem ghi chú bên dưới)
package.json                  Script lint/format và devDependencies
eslint.config.js              Cấu hình ESLint (flat config)
.prettierrc.json              Cấu hình Prettier
.vscode/                      Bật format-on-save và auto-fix cho cả nhóm

src/
├── main.js                   Bootstrap: gắn component → tải dữ liệu → vẽ lần đầu
├── config/
│   └── constants.js          Hằng số SNAKE_CASE: khoá lưu trữ, danh mục, mức đóng chuẩn
├── state/
│   ├── store.js              Kho trạng thái dùng chung (chỉ services được ghi)
│   └── render-bus.js         Kênh yêu cầu vẽ lại, giúp service không phải import view
├── services/                 Nghiệp vụ và dữ liệu — không đụng tới DOM
│   ├── data-service.js       Tải data.json
│   ├── storage-service.js    Bọc localStorage/sessionStorage an toàn
│   ├── auth-service.js       Đăng nhập quản trị
│   ├── ledger-service.js     Sổ thu chi: thêm, sửa, gộp, xuất
│   ├── dues-service.js       Đóng quỹ theo tháng (đã đóng / chưa đóng / không chơi)
│   ├── member-service.js     Thành viên và trạng thái hoạt động
│   ├── rules-service.js      Quy định đóng quỹ admin sửa tại chỗ
│   ├── api-service.js        Gọi Cloudflare Worker: đăng nhập và lưu chung
│   ├── firebase-service.js   Firestore: đăng nhập, lắng nghe realtime, ghi
│   ├── data-source.js        Chọn nguồn dữ liệu: Firebase hay data.json
│   └── sync-service.js       Dựng lại trạng thái sau khi dữ liệu chung đổi
├── components/               Giao diện — nơi duy nhất chạm vào DOM
│   ├── dashboard-view.js
│   ├── ledger-view.js
│   ├── members-view.js
│   ├── months-view.js
│   ├── login-modal.js
│   ├── tab-nav.js
│   ├── save-bar.js
│   └── theme-toggle.js
├── utils/                    Hàm bổ trợ thuần, không phụ thuộc trạng thái
│   ├── dom.js                qs, qsa, escapeHtml, copyToClipboard
│   ├── format.js             Định dạng tiền, ngày, nhãn tháng
│   └── date.js               Tính khoá tháng
└── assets/
    ├── images/qr-transfer.png
    └── styles/
        ├── base.css          Biến thiết kế, reset, kiểu chữ
        ├── layout.css        Header, tab, lưới, footer
        ├── components.css    Thẻ, nút, bảng, form, modal, phân trang
        └── features.css      Khối đặc thù: quy định, QR, chế độ chỉ xem
```

## Luồng dữ liệu

```
data.json ──▶ data-service ──▶ store ──▶ components ──▶ DOM
                                 ▲                        │
                                 │                        │ sự kiện người dùng
                             services ◀────────────────────┘
                                 │
                                 └──▶ render-bus.requestRender() ──▶ vẽ lại
```

Quy tắc bất di bất dịch:

1. **Chỉ services được ghi vào store.** Components chỉ đọc.
2. **Chỉ components được chạm vào DOM.** Services không biết gì về giao diện.
3. Sau khi service đổi dữ liệu, nó gọi `requestRender()`. Không service nào import component
   → không có phụ thuộc vòng.
4. Mọi hàm ghi trong `ledger-service` kết thúc bằng `commitLedgerChange()` — lưu xuống máy,
   dựng lại danh sách gộp, dọn các dòng đã chọn không còn tồn tại. Nhờ vậy giao diện không
   bao giờ đọc phải dữ liệu cũ.

## Vì sao `data.json` nằm ở gốc chứ không trong `src/`

Đây là ngoại lệ có chủ đích. Người quản lý quỹ sửa file này **trực tiếp trên giao diện web của
GitHub**, không qua editor. Chôn nó vào `src/assets/data/` chỉ làm họ phải bấm thêm 3 lần mỗi
lần cập nhật, đổi lại không được lợi ích kỹ thuật nào — vì không có bước build để phân biệt
"mã nguồn" với "tài nguyên".

## Thứ tự bên trong một file

**File JavaScript** — từ trên xuống:

1. Chú thích mô tả vai trò của file
2. `import` — thư viện ngoài → file trong dự án → style
3. Hằng số riêng của file
4. Biến trạng thái của module
5. Hàm bổ trợ nội bộ
6. Hàm xử lý sự kiện (`handleXxx`)
7. Hàm vẽ (`renderXxx`) — export
8. Hàm khởi tạo (`initXxx`) — export, đặt cuối

**File CSS** — thuộc tính trong một selector xếp theo _ngoại thất trước, nội thất sau_:

1. Positioning — `position`, `top`, `z-index`
2. Box model — `display`, `flex`, `width`, `padding`, `margin`
3. Typography — `font-size`, `font-weight`, `color`
4. Visuals — `background`, `border`, `box-shadow`
5. Misc — `opacity`, `transition`, `cursor`

## Quy ước đặt tên

| Loại              | Quy ước                          | Ví dụ                                  |
| ----------------- | -------------------------------- | -------------------------------------- |
| Tên file, thư mục | kebab-case                       | `ledger-service.js`, `dues-service.js` |
| Class CSS         | kebab-case, BEM nhẹ              | `.stat-tile__value`, `.btn--ghost`     |
| Biến, hàm JS      | camelCase                        | `isVirtualMonth`, `getEffectivePaid`   |
| Hằng số cố định   | SNAKE_CASE                       | `STANDARD_DUES`, `STORAGE_KEYS`        |
| Id trong DOM      | kebab-case, có tiền tố theo vùng | `#month-collected`, `#ledger-update`   |
| Hàm xử lý sự kiện | `handle` + hành động             | `handleSaveUpdate`                     |
| Hàm vẽ giao diện  | `render` + vùng                  | `renderMonths`                         |
| Hàm khởi tạo      | `init` + vùng                    | `initLedgerView`                       |

Class có tiền tố `js-` (`js-row-select`, `js-member-active`) chỉ dùng để JavaScript bắt sự kiện,
**không gắn style** — đổi giao diện không làm hỏng logic.

## Công cụ

```bash
npm install         # cài ESLint + Prettier
npm run dev         # chạy máy chủ tĩnh ở cổng 8080
npm run lint        # bắt lỗi logic, biến thừa, code sai chuẩn
npm run format      # tự căn lề toàn bộ dự án
npm run check       # kiểm tra format + lint, dùng trước khi commit
```

`.vscode/settings.json` đã bật sẵn format-on-save và ESLint auto-fix, chỉ cần cài hai extension
được gợi ý khi mở dự án.
