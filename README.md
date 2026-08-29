# Quỹ CLB Cầu Lông Arito

Trang web thống kê & quản lý thu chi quỹ câu lạc bộ cầu lông công ty Arito.

**Xem trang:** https://aritobadminton.github.io/

## Có gì trong trang

| Tab                     | Nội dung                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tổng quan**           | Số dư quỹ, tổng thu, tổng chi, **khối Quy định đóng quỹ nổi bật**, biểu đồ thu-chi theo tháng, cơ cấu chi phí, diễn biến số dư, giao dịch gần đây |
| **Sổ thu chi**          | **Form nhập khoản thu/chi mới**, toàn bộ giao dịch, lọc theo loại / tháng / danh mục, tìm kiếm, sắp xếp                                           |
| **Thành viên**          | Tổng đóng góp từng người, số tháng tham gia, tỷ lệ đóng đủ, **ô tick phân loại đang / ngưng hoạt động**                                           |
| **Đóng quỹ theo tháng** | **Dropdown Đã đóng / Chưa đóng cho từng người**, sửa được số tiền, + các khoản chi của tháng đó                                                   |

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
> rồi thay giá trị `hash` trong biến `AUTH` ở `index.html`.

## Sửa khối Quy định đóng quỹ

Khối này nằm ngay đầu tab **Tổng quan**. Sửa mục `"rules"` trong `data.json`:
thêm / bớt phần tử trong `items` (mỗi ô là một mức đóng), đổi `title`, `subtitle`, `footer` tuỳ ý.
Nếu xoá hẳn `"rules"`, trang sẽ tự quay về hiển thị các dòng trong `"notes"`.

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

Hiện ở tab **Đóng quỹ theo tháng**, ngay trên bảng Chi tiêu trong tháng. Sửa mục `"qr"` trong `data.json`:

```jsonc
"qr": {
  "image": "qr-chuyen-khoan.png",     // đổi ảnh: upload ảnh mới lên repo rồi đổi tên file ở đây
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

Khoản mới hiện ngay trong sổ (có nhãn **mới**) và cộng luôn vào số dư, biểu đồ, thống kê tháng.
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
> Muốn đổi mức chuẩn, sửa dòng `const std=50000;` trong `index.html`.

## Thêm tháng mới

Copy khối tháng gần nhất trong `months`, đổi `month`, `label`, đặt `paid` về 0 cho mọi người, rồi cập nhật dần trong tháng.

## Bật GitHub Pages

Repo → **Settings** → **Pages** → Source: `Deploy from a branch` → Branch: `main` / `/(root)` → **Save**.
