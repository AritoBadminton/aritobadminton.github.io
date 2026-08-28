# Quỹ CLB Cầu Lông Arito

Trang web thống kê & quản lý thu chi quỹ câu lạc bộ cầu lông công ty Arito.

**Xem trang:** https://aritobadminton.github.io/

## Có gì trong trang

| Tab | Nội dung |
|---|---|
| **Tổng quan** | Số dư quỹ, tổng thu, tổng chi, **khối Quy định đóng quỹ nổi bật**, biểu đồ thu-chi theo tháng, cơ cấu chi phí, diễn biến số dư, giao dịch gần đây |
| **Sổ thu chi** | **Form nhập khoản thu/chi mới**, toàn bộ giao dịch, lọc theo loại / tháng / danh mục, tìm kiếm, sắp xếp |
| **Thành viên** | Tổng đóng góp từng người, số tháng tham gia, tỷ lệ đóng đủ, **ô tick phân loại đang / ngưng hoạt động** |
| **Đóng quỹ theo tháng** | **Dropdown Đã đóng / Chưa đóng cho từng người**, sửa được số tiền, + các khoản chi của tháng đó |

## Cấu trúc file

```
index.html     # toàn bộ giao diện + form nhập liệu (không cần cài đặt gì)
data.json      # TOÀN BỘ DỮ LIỆU — chỉ cần sửa file này
nhap-lieu.html # trang nhập liệu cũ, vẫn dùng được nhưng form trong index.html tiện hơn
```

## Phân loại thành viên đang / ngưng hoạt động

Trong tab **Thành viên**, cột **Hoạt động** có ô tick ở mỗi dòng:

- **Tick** = đang hoạt động · **bỏ tick** = ngưng hoạt động (dòng đó sẽ mờ đi)
- 3 nút lọc phía trên: **Tất cả / Đang hoạt động / Ngưng hoạt động**
- Ô "Chưa đóng tháng gần nhất" chỉ đếm trong nhóm đang hoạt động, nên người đã nghỉ không làm sai số liệu

Tick lưu ngay trên trình duyệt của bạn. Muốn **cả nhóm cùng thấy giống nhau**, bấm nút
**Lưu chung lên GitHub** — nó tự sao chép khối `"roster"` để bạn dán đè vào `data.json`
(giống cách dán khoản thu/chi bên dưới). Nút **Đặt lại theo dữ liệu chung** huỷ mọi tick
chưa lưu và quay về đúng những gì đang có trong `data.json`.

## Tháng mới tự sinh danh sách

Ô chọn tháng có sẵn **3 tháng kế tiếp** chưa có trong dữ liệu, ghi "— tự tạo".
Chọn một tháng như vậy, bảng **Danh sách đóng quỹ** tự dựng từ **danh sách thành viên đang hoạt động**
(cột tick ở tab Thành viên), tất cả để "Chưa đóng". Đánh dấu ai đã đóng rồi bấm
**Tạo tháng này trên GitHub** — nó sinh sẵn khối JSON để bạn *thêm vào cuối* mục `"months"`.

**Các tháng đã có trong `data.json` không bị sinh lại** — lịch sử giữ nguyên (tháng 12/2024 vẫn là 8 người,
tháng 05/2025 vẫn 18 người). Nếu giữa tháng có người mới vào và bạn muốn thêm họ, bấm
**+ Bổ sung thành viên đang hoạt động** — nút này chỉ thêm những người còn thiếu, các dòng cũ không đụng tới,
và những dòng vừa thêm có nhãn **mới**.

Tháng tự tạo chỉ được tính vào thống kê ở tab Thành viên **sau khi bạn đánh dấu ít nhất một người** —
xem trước thôi thì không làm lệch số liệu.

## Đánh dấu thành viên đã đóng tiền

Vào tab **Đóng quỹ theo tháng**, chọn tháng ở ô trên cùng:

- Cột **Trạng thái** là dropdown — chọn **Đã đóng** hoặc **Chưa đóng** cho từng người
- Chọn "Đã đóng" sẽ tự điền **đúng mức người đó vẫn đóng** (Chị Lu 100k, Ngọc Em 80k…), không cào bằng 50k
- Số tiền khác thường thì bấm thẳng vào ô **Số tiền** gõ lại
- Cột **Ghi chú** sửa được: bấm vào ô, gõ nội dung (ví dụ "đã chuyển khoản 29/8", "+1 buổi vãng lai"), Enter là xong
- 4 ô thống kê phía trên (Thu được, Đã đóng x/y, Chưa đóng) và cả tab Thành viên tự cập nhật theo

Đánh dấu và ghi chú lưu ngay trên trình duyệt của bạn. Muốn cả nhóm cùng thấy, bấm **Lưu chung lên GitHub** —
nó sao chép sẵn khối tháng đó để bạn dán đè vào `data.json`. Sửa nhiều tháng thì chọn từng tháng
rồi lưu từng khối. Nút **Đặt lại tháng này** huỷ mọi đánh dấu chưa lưu của tháng đang xem.

## Đăng nhập quản trị

Bấm nút **Đăng nhập** ở góc phải trên cùng.

| | |
|---|---|
| Tài khoản | `Admin` (không phân biệt hoa thường) |
| Mật khẩu | `Badminton2808` |

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
  "updated": "2026-08-28",          // ngày cập nhật gần nhất
  "notes": ["Ghi chú: Thu 50k/1tháng", "..."],   // giữ lại làm dự phòng

  "rules": {                         // khối Quy định hiển thị ở đầu tab Tổng quan
    "title": "Quy định đóng quỹ",
    "subtitle": "Mức đóng áp dụng cho câu lạc bộ",
    "items": [
      { "amount": "50.000đ",  "who": "Thành viên công ty",  "unit": "mỗi tháng" },
      { "amount": "30.000đ",  "who": "Khách ngoài công ty", "unit": "mỗi buổi chơi" },
      { "amount": "100.000đ", "who": "Khách ngoài công ty", "unit": "trọn tháng" }
    ],
    "footer": "Chuyển khoản xong nhắn Zalo cho thủ quỹ để được ghi nhận."
  },

  "roster": [                        // phân loại đang / ngưng hoạt động
    { "name": "Văn Khánh", "active": true },
    { "name": "Kim Trinh", "active": false }
  ],

  "expenses": [                      // các khoản CHI
    { "date": "2026-08-28", "amount": 200000, "desc": "Thuê sân 2 tiếng", "cat": "Tiền thuê sân" }
  ],

  "incomes": [                       // các khoản THU
    { "date": "2026-08-01", "amount": 1000000, "desc": "Tiền quỹ công ty cấp", "cat": "Tiền quỹ công ty hàng tháng" }
  ],

  "months": [                        // đóng quỹ theo tháng
    {
      "month": "2026-08",
      "label": "Tháng 08/2026",
      "total": 630000,
      "members": [
        { "name": "Văn Khánh", "paid": 50000, "note": "" },
        { "name": "Thị Thảo",  "paid": 0,     "note": "" }
      ]
    }
  ]
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
