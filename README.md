# Quỹ CLB Cầu Lông Arito

Trang web thống kê & quản lý thu chi quỹ câu lạc bộ cầu lông công ty Arito.

**Xem trang:** https://aritobadminton.github.io/

## Có gì trong trang

| Tab | Nội dung |
|---|---|
| **Tổng quan** | Số dư quỹ, tổng thu, tổng chi, biểu đồ thu-chi theo tháng, cơ cấu chi phí, diễn biến số dư, giao dịch gần đây |
| **Sổ thu chi** | Toàn bộ giao dịch, lọc theo loại / tháng / danh mục, tìm kiếm, sắp xếp |
| **Thành viên** | Tổng đóng góp từng người, số tháng tham gia, tỷ lệ đóng đủ, **ô tick phân loại đang / ngưng hoạt động** |
| **Đóng quỹ theo tháng** | **Dropdown Đã đóng / Chưa đóng cho từng người**, sửa được số tiền, + các khoản chi của tháng đó |

## Cấu trúc file

```
index.html   # toàn bộ giao diện (không cần cài đặt gì)
data.json    # TOÀN BỘ DỮ LIỆU — chỉ cần sửa file này
nhap-lieu.html # công cụ tạo nhanh 1 dòng JSON để dán vào data.json
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

## Đánh dấu thành viên đã đóng tiền

Vào tab **Đóng quỹ theo tháng**, chọn tháng ở ô trên cùng:

- Cột **Trạng thái** là dropdown — chọn **Đã đóng** hoặc **Chưa đóng** cho từng người
- Chọn "Đã đóng" sẽ tự điền **đúng mức người đó vẫn đóng** (Chị Lu 100k, Ngọc Em 80k…), không cào bằng 50k
- Số tiền khác thường thì bấm thẳng vào ô **Số tiền** gõ lại
- 4 ô thống kê phía trên (Thu được, Đã đóng x/y, Chưa đóng) và cả tab Thành viên tự cập nhật theo

Đánh dấu lưu ngay trên trình duyệt của bạn. Muốn cả nhóm cùng thấy, bấm **Lưu chung lên GitHub** —
nó sao chép sẵn khối tháng đó để bạn dán đè vào `data.json`. Sửa nhiều tháng thì chọn từng tháng
rồi lưu từng khối. Nút **Đặt lại tháng này** huỷ mọi đánh dấu chưa lưu của tháng đang xem.

## Cách cập nhật dữ liệu

Mọi số liệu nằm trong `data.json`. Cách nhanh nhất:

1. Mở `nhap-lieu.html` (hoặc trang `.../nhap-lieu.html`), điền thông tin khoản thu/chi.
2. Bấm **Sao chép JSON**.
3. Vào GitHub → mở `data.json` → bấm biểu tượng bút chì ✏️ (Edit).
4. Dán dòng vừa copy vào **cuối danh sách** `"expenses"` (khoản chi) hoặc `"incomes"` (khoản thu), nhớ thêm dấu phẩy `,` ở dòng trước.
5. Bấm **Commit changes**. Sau ~1 phút trang web tự cập nhật.

### Định dạng data.json

```jsonc
{
  "club": "CLB Cầu Lông Arito",
  "updated": "2026-08-28",          // ngày cập nhật gần nhất
  "notes": ["Ghi chú: Thu 50k/1tháng", "..."],

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
