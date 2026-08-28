# Quỹ CLB Cầu Lông Arito

Trang web thống kê & quản lý thu chi quỹ câu lạc bộ cầu lông công ty Arito.

**Xem trang:** https://<tên-tài-khoản>.github.io/<tên-repo>/

## Có gì trong trang

| Tab | Nội dung |
|---|---|
| **Tổng quan** | Số dư quỹ, tổng thu, tổng chi, biểu đồ thu-chi theo tháng, cơ cấu chi phí, diễn biến số dư, giao dịch gần đây |
| **Sổ thu chi** | Toàn bộ giao dịch, lọc theo loại / tháng / danh mục, tìm kiếm, sắp xếp |
| **Thành viên** | Tổng đóng góp từng người, số tháng tham gia, tỷ lệ đóng đủ |
| **Đóng quỹ theo tháng** | Ai đã đóng / chưa đóng trong từng tháng + các khoản chi của tháng đó |

## Cấu trúc file

```
index.html   # toàn bộ giao diện (không cần cài đặt gì)
data.json    # TOÀN BỘ DỮ LIỆU — chỉ cần sửa file này
nhap-lieu.html # công cụ tạo nhanh 1 dòng JSON để dán vào data.json
```

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
