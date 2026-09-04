# Quỹ CLB Cầu Lông Arito

Trang web thống kê & quản lý thu chi quỹ câu lạc bộ cầu lông công ty Arito.

**Xem trang:** https://aritobadminton.github.io/

## Có gì trong trang

| Tab                     | Nội dung                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tổng quan**           | Số dư quỹ, số thành viên, **khối Quy định đóng quỹ nổi bật**, giao dịch gần đây. Tổng thu và tổng chi chỉ hiện với admin                    |
| **Sổ thu chi**          | **Form nhập khoản thu/chi mới**, toàn bộ giao dịch, lọc theo loại / tháng / danh mục, tìm kiếm, sắp xếp                                     |
| **Thành viên**          | Tổng đóng góp từng người, số tháng tham gia, tỷ lệ đóng đủ, **ô tick phân loại đang / ngưng hoạt động**                                     |
| **Đóng quỹ theo tháng** | **Dropdown Đã đóng / Chưa đóng / Không chơi cho từng người**, sửa được số tiền và ghi chú, mã QR chuyển khoản, + các khoản chi của tháng đó |

## Nơi lưu dữ liệu

Trang chạy được ở hai chế độ, đổi qua lại bằng một dòng cấu hình:

|              | Nguồn dữ liệu          | Lưu chung bằng cách               | Người khác thấy khi nào |
| ------------ | ---------------------- | --------------------------------- | ----------------------- |
| **Mặc định** | `data.json` trong repo | copy JSON rồi dán vào `data.json` | sau khi commit          |
| **Firebase** | Cloud Firestore        | sửa là lưu ngay                   | **ngay lập tức**        |

Bật chế độ Firebase bằng cách điền `src/config/firebase-config.js` — xem
[docs/TRIEN-KHAI-FIREBASE.md](docs/TRIEN-KHAI-FIREBASE.md). Khi đó:

- Mỗi thủ quỹ một tài khoản email riêng, Firebase kiểm tra mật khẩu thật.
- Thu hồi quyền của ai thì xoá tài liệu `admins/<uid>` của người đó.
- Người chỉ xem số liệu vẫn không cần đăng nhập.
- Mọi thanh "Lưu chung lên GitHub" và khối dán JSON tự biến mất.

Xoá `projectId` về `''` là quay lại chế độ `data.json`, không phải sửa code.

Thư mục `worker/` chứa một hướng đi khác đã dựng xong nhưng không dùng tới: một Cloudflare
Worker giữ token GitHub để commit thẳng vào `data.json`
([docs/TRIEN-KHAI-WORKER.md](docs/TRIEN-KHAI-WORKER.md)). Giữ lại phòng khi cần quay về
cách lưu bằng Git thay vì cơ sở dữ liệu.

## Sửa Quy định đóng quỹ

Đăng nhập admin rồi bấm thẳng vào chữ trong khối **Quy định đóng quỹ** ở tab Tổng quan để sửa:
số tiền, đối tượng áp dụng và đơn vị tính. Rê chuột vào một ô sẽ thấy nút 🗑 để xoá mức đó;
ô cuối cùng là **+ Thêm mức đóng**.

Thay đổi lưu trên máy bạn trước. Muốn cả nhóm cùng thấy thì bấm **Lưu chung lên GitHub**,
khối `"rules"` sẽ tự sao chép vào clipboard — mở `data.json` trên GitHub, thay toàn bộ mục
`"rules"` bằng khối đó rồi Commit. Bấm **Đặt lại theo dữ liệu chung** để bỏ hết thay đổi.

Tiêu đề khối và dòng "Lưu ý" phía dưới vẫn sửa trực tiếp trong `data.json`.

## Ai xem được gì

Trang chia hai mức: **khách** (mặc định) và **admin** (đã đăng nhập).

| Nội dung                             | Khách | Admin |
| ------------------------------------ | :---: | :---: |
| Số dư quỹ, số thành viên             |  ✅   |  ✅   |
| Quy định đóng quỹ, giao dịch gần đây |  ✅   |  ✅   |
| Bảng đóng quỹ theo tháng, mã QR      |  ✅   |  ✅   |
| **Tổng thu, tổng chi**               |  ❌   |  ✅   |
| **Tab Thành viên**                   |  ❌   |  ✅   |
| **Sổ thu chi: "Tất cả các tháng"**   |  ❌   |  ✅   |
| Nhập, sửa, đánh dấu đóng quỹ         |  ❌   |  ✅   |

Khách vào Sổ thu chi sẽ được lọc sẵn theo tháng gần nhất và chỉ đổi được sang từng tháng một.

Đây **không phải bảo mật thật** — trang chạy tĩnh trên GitHub Pages nên phần kiểm tra nằm ngay
trong trình duyệt. Nó chỉ để tránh người ngoài bấm nhầm và bớt lộ số liệu tổng. Thứ bảo vệ dữ
liệu chung thật sự là quyền ghi vào repo GitHub.

## Danh sách dài thì rút gọn thế nào

- **Ô chọn tháng** (cả hai tab) chỉ hiện **5 tháng gần nhất**; các tháng cũ hơn nằm sau dòng
  `▾ Xem thêm N tháng cũ hơn…`. Chọn dòng đó thì danh sách mở đầy đủ và vẫn giữ nguyên tháng đang xem.
- **Bảng Thành viên** phân trang **15 người mỗi trang**, có nút Trước / Sau và dòng trạng thái
  `1–15 trên 43 người · trang 1/3`. Đổi bộ lọc hay ô tìm kiếm thì tự về trang 1.

## Cấu trúc dự án

```
index.html      # điểm vào, chỉ chứa markup
data.json       # TOÀN BỘ DỮ LIỆU — sửa file này để cập nhật số liệu
src/            # mã nguồn: config, state, services, components, utils, assets
docs/           # ARCHITECTURE.md — sơ đồ thư mục, luồng dữ liệu, quy ước đặt tên
```

Chi tiết kiến trúc và quy ước code: xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Dành cho người sửa code:

```bash
npm install     # cài ESLint + Prettier
npm run dev     # chạy thử ở http://localhost:8080
npm run check   # kiểm tra format + lint trước khi commit
```

## Đăng nhập quản trị

Bấm nút **Đăng nhập** ở góc phải trên cùng.

|           |                                      |
| --------- | ------------------------------------ |
| Tài khoản | `Admin` (không phân biệt hoa thường) |
| Mật khẩu  | `Badminton2808`                      |

- **Chưa đăng nhập** → chỉ xem: mọi ô nhập, dropdown, nút xoá và thanh "Lưu chung lên GitHub" đều bị khoá, có banner vàng nhắc ở đầu trang.
- **Đã đăng nhập** → nhập liệu và chỉnh sửa bình thường. Nút góc phải chuyển thành **✓ Admin**, bấm lại để đăng xuất.
- Tick "Ghi nhớ trên máy này" để không phải đăng nhập lại; bỏ tick thì chỉ giữ trong phiên làm việc.

> ⚠️ **Đây không phải bảo mật thật.** Trang chạy trên GitHub Pages, không có máy chủ,
> nên việc kiểm tra mật khẩu chạy bằng JavaScript ngay trong trình duyệt và repo lại
> để public — người rành kỹ thuật xem mã nguồn vẫn vượt qua được. Mục đích của nó là
> **chống bấm nhầm**, không phải chống người cố tình.
>
> Dữ liệu chung vẫn an toàn: mọi chỉnh sửa trên web chỉ lưu trong máy người đó, muốn
> đổi số liệu chung thì phải commit vào `data.json` — việc này cần quyền ghi vào repo GitHub.
>
> **Đừng dùng lại mật khẩu này cho email, ngân hàng hay bất kỳ tài khoản nào khác.**
> Muốn đổi mật khẩu: tính SHA-256 của mật khẩu mới (ví dụ trên trang emn178.github.io/online-tools/sha256.html)
> rồi thay `ADMIN_PASSWORD_HASH` trong `src/config/constants.js`.

## Sửa khối Quy định đóng quỹ

Khối này nằm ngay đầu tab **Tổng quan**. Sửa mục `"rules"` trong `data.json`:
thêm / bớt phần tử trong `items` (mỗi ô là một mức đóng), đổi `title`, `subtitle`, `footer` tuỳ ý.
Nếu xoá hẳn `"rules"`, trang sẽ tự quay về hiển thị các dòng trong `"notes"`.

## Đánh dấu đóng quỹ theo tháng

Vào tab **Đóng quỹ theo tháng**, chọn tháng ở ô trên cùng (cần đăng nhập Admin).

Cột **Trạng thái** là dropdown 3 lựa chọn:

| Trạng thái     | Màu     | Ý nghĩa                                                                                     |
| -------------- | ------- | ------------------------------------------------------------------------------------------- |
| **Đã đóng**    | xanh lá | Tự điền đúng mức người đó vẫn đóng — Chị Lu 100k, Ngọc Em 80k, còn lại 50k. Không cào bằng. |
| **Chưa đóng**  | đỏ      | Còn nợ quỹ tháng này                                                                        |
| **Không chơi** | vàng    | Tháng đó nghỉ, **không bị tính là còn nợ**                                                  |

Khi chọn **Không chơi**, người đó bị trừ khỏi mẫu số ô "Đã đóng x/y", khỏi ô "Chưa đóng",
và khỏi tỷ lệ đóng đủ ở tab Thành viên. Ô số tiền cũng khoá lại. Nhờ vậy người nghỉ hẳn một
tháng không làm số liệu trông như đang nợ quỹ.

Ngoài ra:

- Số tiền khác thường thì bấm thẳng vào ô **Số tiền** gõ lại
- Cột **Ghi chú** sửa được: bấm vào ô, gõ nội dung ("đã chuyển khoản 29/8", "+1 buổi vãng lai"), Enter là xong
- Dòng nào có sửa được tô nền xanh nhạt

Đánh dấu và ghi chú lưu ngay trên trình duyệt của bạn. Muốn cả nhóm cùng thấy, bấm
**Lưu chung lên GitHub** — nó sao chép sẵn khối tháng đó để bạn dán đè vào `data.json`.
Sửa nhiều tháng thì chọn từng tháng rồi lưu từng khối. Nút **Đặt lại tháng này** huỷ mọi
đánh dấu chưa lưu của tháng đang xem.

## Tháng mới tự sinh danh sách

Ô chọn tháng có sẵn **3 tháng kế tiếp** chưa có trong dữ liệu, ghi "— tự tạo".
Chọn một tháng như vậy, bảng **Danh sách đóng quỹ** tự dựng từ **danh sách thành viên đang
hoạt động** (cột tick ở tab Thành viên), tất cả để "Chưa đóng". Đánh dấu ai đã đóng rồi bấm
**Tạo tháng này trên GitHub** — nó sinh sẵn khối JSON để bạn _thêm vào cuối_ mục `"months"`.

**Các tháng đã có trong `data.json` không bị sinh lại** — lịch sử giữ nguyên (tháng 12/2024 vẫn
là 8 người, tháng 05/2025 vẫn 18 người). Nếu giữa tháng có người mới vào và bạn muốn thêm họ,
bấm **+ Bổ sung thành viên đang hoạt động** — nút này chỉ thêm những người còn thiếu, các dòng
cũ không đụng tới, và những dòng vừa thêm có nhãn **mới**.

Tháng tự tạo chỉ được tính vào thống kê ở tab Thành viên **sau khi bạn đánh dấu ít nhất một
người** — xem trước thôi thì không làm lệch số liệu.

## Phân loại thành viên đang / ngưng hoạt động

Trong tab **Thành viên**, cột **Hoạt động** có ô tick ở mỗi dòng. Tick = đang hoạt động,
bỏ tick = ngưng hoạt động (dòng đó mờ đi). Ba nút lọc phía trên: **Tất cả / Đang hoạt động /
Ngừng hoạt động**. Ô "Chưa đóng tháng gần nhất" chỉ đếm trong nhóm đang hoạt động.

Bấm **Lưu chung lên GitHub** để lấy khối `"roster"` dán đè vào `data.json`.

## Sửa một khoản thu / chi đã có

Tab **Sổ thu chi**, cần đăng nhập Admin:

1. Tick chọn dòng cần sửa ở cột đầu bảng (tick ô trên tiêu đề để chọn hết những dòng đang hiện theo bộ lọc)
2. Bấm **Cập nhật** cạnh nút "+ Nhập khoản mới"
3. **Chọn 1 dòng** → sửa được cả 4 ô: ngày, số tiền, nội dung, danh mục
   **Chọn nhiều dòng** → chỉ đổi được **Ngày** và **Danh mục** cho cả nhóm (số tiền và nội dung phải sửa từng dòng)
4. Bấm **Lưu thay đổi**

Dòng đã sửa có nhãn **đã sửa** màu vàng. Nút **Khôi phục bản gốc** trả dòng đang chọn về đúng như trong `data.json`.

> Khi có dòng cũ bị sửa, khối JSON xuất ra sẽ là **thay toàn bộ** danh sách `expenses` / `incomes`
> chứ không phải dán thêm — vì không thể mô tả "sửa dòng thứ mấy" một cách an toàn.
> Đọc kỹ ghi chú trên từng khối trước khi dán.

## Mã QR chuyển khoản

Hiện ở tab **Đóng quỹ theo tháng**, cột bên phải bảng đóng quỹ. Sửa mục `"qr"` trong `data.json`:

```jsonc
"qr": {
  "image": "src/assets/images/qr-transfer.png",     // đổi ảnh: upload ảnh mới lên repo rồi đổi tên file ở đây
  "name": "NGUYEN MINH NGHIA",
  "account": "1905 0021 1080 12",
  "bank": "Techcombank · VietQR / Napas 247",
  "note": "Quét mã bằng app ngân hàng · chuyển xong nhắn Zalo cho thủ quỹ"
},
```

Xoá hẳn mục `"qr"` thì khối này tự ẩn đi.

## Nhập khoản thu / chi mới

Vào tab **Sổ thu chi** → bấm **+ Nhập khoản mới**:

1. Chọn **Khoản CHI** hoặc **Khoản THU**
2. Điền ngày, số tiền, nội dung, chọn danh mục
3. Bấm **Thêm vào sổ**

Khoản mới hiện ngay trong sổ (có nhãn **mới**) và cộng luôn vào số dư và thống kê tháng.
Bấm dấu **×** cuối dòng nếu nhập nhầm.

Lúc này khoản mới chỉ nằm trên máy bạn. Để cả nhóm cùng thấy, bấm **Lưu chung lên GitHub**:
trang sẽ hiện sẵn các khối JSON kèm nút **Sao chép** cho từng khối. Mở `data.json` trên GitHub,
bấm ✏️, dán từng khối vào cuối danh sách tương ứng (nhớ thêm dấu phẩy `,` sau dấu `}` của dòng cuối cũ),
sửa luôn dòng `"updated"`, rồi **Commit changes**. Sau ~1 phút trang web tự cập nhật.

### Định dạng data.json

```jsonc
{
  "club": "CLB Cầu Lông Arito",
  "updated": "2026-08-28", // ngày cập nhật gần nhất
  "notes": ["Ghi chú: Thu 50k/1tháng", "..."], // giữ lại làm dự phòng

  "rules": {
    // khối Quy định hiển thị ở đầu tab Tổng quan
    "title": "Quy định đóng quỹ",
    "subtitle": "Mức đóng áp dụng cho câu lạc bộ",
    "items": [
      { "amount": "50.000đ", "who": "Thành viên công ty", "unit": "mỗi tháng" },
      { "amount": "30.000đ", "who": "Khách ngoài công ty", "unit": "mỗi buổi chơi" },
      { "amount": "100.000đ", "who": "Khách ngoài công ty", "unit": "trọn tháng" },
    ],
    "footer": "Chuyển khoản xong nhắn Zalo cho thủ quỹ để được ghi nhận.",
  },

  "roster": [
    // phân loại đang / ngưng hoạt động
    { "name": "Văn Khánh", "active": true },
    { "name": "Kim Trinh", "active": false },
  ],

  "expenses": [
    // các khoản CHI
    { "date": "2026-08-28", "amount": 200000, "desc": "Thuê sân 2 tiếng", "cat": "Tiền thuê sân" },
  ],

  "incomes": [
    // các khoản THU
    {
      "date": "2026-08-01",
      "amount": 1000000,
      "desc": "Tiền quỹ công ty cấp",
      "cat": "Tiền quỹ công ty hàng tháng",
    },
  ],

  "months": [
    // đóng quỹ theo tháng
    {
      "month": "2026-08",
      "label": "Tháng 08/2026",
      "total": 630000,
      "members": [
        { "name": "Văn Khánh", "paid": 50000, "note": "" },
        { "name": "Thị Thảo", "paid": 0, "note": "" },
      ],
    },
  ],
}
```

**Danh mục chi** (`cat`): `Tiền thuê sân`, `Tiền cầu lông`, `Tiền nước`, `Tiền khác`
**Danh mục thu** (`cat`): `Tiền quỹ công ty hàng tháng`, `Tiền quỹ thành viên hàng tháng`

> Mức đóng chuẩn đang tính là **50.000đ/tháng**. Người ngoài công ty: 30k/buổi hoặc 100k/tháng.
> Muốn đổi mức chuẩn, sửa hằng số `STANDARD_DUES` trong `src/config/constants.js`.

## Thêm tháng mới

Copy khối tháng gần nhất trong `months`, đổi `month`, `label`, đặt `paid` về 0 cho mọi người, rồi cập nhật dần trong tháng.

## Bật GitHub Pages

Repo → **Settings** → **Pages** → Source: `Deploy from a branch` → Branch: `main` / `/(root)` → **Save**.
