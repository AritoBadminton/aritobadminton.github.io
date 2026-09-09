# Hướng dẫn cho phiên Claude tiếp theo

Trang quản lý quỹ CLB cầu lông công ty Arito. Đây là **quỹ thật, tiền thật của
một nhóm người thật** — mỗi lần đẩy code lên là đổi luôn trang mà cả nhóm đang
dùng. Không có môi trường thử. Chạy hết bộ kiểm thử trước khi đẩy, và để dành
mọi thao tác xoá dữ liệu cho chủ trang tự bấm.

- Trang chạy: https://aritobadminton.github.io/
- Repo: `AritoBadminton/aritobadminton.github.io` (**public**)
- Chủ trang trao đổi bằng tiếng Việt; trả lời bằng tiếng Việt.

`README.md` mô tả trang cho người dùng. File này mô tả cách làm việc trên mã nguồn.

## Kiến trúc

Web tĩnh trên GitHub Pages, **ES Modules thuần, không có bước build**. Sửa file
là xong, không transpile, không bundler.

```
index.html              một file, chứa toàn bộ khung của cả 4 tab
data.json               dữ liệu gốc; ở chế độ Firebase chỉ còn là bản dự phòng
firestore.rules         quyền đọc/ghi Firestore
src/
  config/               constants.js, firebase-config.js
  services/             toàn bộ nghiệp vụ; chỉ services được ghi vào store
  components/           các màn hình; chỉ đọc store, không ghi
  state/                store.js (kho dùng chung), render-bus.js
  utils/                dom.js, date.js, format.js
  assets/styles/        base · layout · components · features
tests/                  kiểm thử Playwright + Firebase giả lập (xem tests/README.md)
docs/                   hướng dẫn triển khai Firebase và Cloudflare Worker
worker/                 hướng đi cũ, không dùng; giữ lại phòng khi quay về lưu bằng Git
```

**Luồng dữ liệu một chiều:** component gọi service → service ghi vào `store` →
service gọi `requestRender(...)` → component vẽ lại. Component không bao giờ tự
sửa `store`. Giữ đúng quy tắc này thì lần ngược lỗi rất nhanh.

## Hai chế độ dữ liệu

`src/config/firebase-config.js` có `projectId`:

- có giá trị → **chế độ Firebase**: đọc/ghi thẳng Cloud Firestore, mọi máy thấy
  ngay qua `onSnapshot`. **Trang thật đang chạy chế độ này.**
- rỗng → chế độ `data.json`: sửa nằm trong `localStorage`, admin bấm "Lưu chung
  lên GitHub" rồi dán JSON vào `data.json`.

`isFirebaseMode()` trong `services/data-source.js` là chỗ duy nhất phân biệt.
Nhiều service có hai nhánh theo hàm này — sửa nghiệp vụ thì nhớ sửa cả hai, hoặc
cố ý chỉ hỗ trợ chế độ Firebase thì ghi rõ trong chú thích.

### Hình dạng dữ liệu trên Firestore

```
settings/club     { name, updated, notes[] }
settings/rules    { title, subtitle, items[], footer }
settings/qr       { image, name, account, bank, note }
settings/roster   { active: { "<tên>": bool }, order: { "<tên>": số } }
months/<2026-09>  { label, dues: { "<tên>": { paid, note, skip } } }
transactions/<id> { type: 'thu'|'chi', date, amount, desc, cat }
admins/<uid>      { email, name }
```

Tên thành viên là **khoá tài liệu và khoá map**, có dấu tiếng Việt và dấu cách.
Vì vậy khi xoá một khoá trong map phải dùng `new FieldPath('active', name)` +
`deleteField()`, không được viết `'active.' + name` — dấu chấm trong chuỗi sẽ bị
hiểu là đường dẫn lồng nhau.

Danh sách thành viên được **dựng lại từ các dòng đóng quỹ** cộng với
`settings/roster`. Nên `deleteMember` phải xoá dòng đóng quỹ ở mọi tháng **trước**,
rồi mới xoá khỏi roster; làm ngược lại thì người đó hiện lại ngay.

## Quy ước code (chủ trang đặt ra, giữ nguyên)

- Thứ tự trong file: Imports → Types → Constants → Main → State → Hooks →
  Event handlers → Helpers.
- Thứ tự thuộc tính CSS: Positioning → Box Model → Typography → Visuals → Misc.
- Đặt tên: `camelCase` hàm/biến, `PascalCase` lớp, `SNAKE_CASE` hằng số,
  `kebab-case` file và class CSS.
- **Toàn bộ chú thích viết bằng tiếng Việt, và giải thích _tại sao_ chứ không
  phải _cái gì_.** Chú thích chỉ lặp lại tên hàm là chú thích thừa.
- ESLint 9 (flat config) + Prettier 3. Chạy thật, không đoán:

```bash
npm run check      # prettier --check && eslint
npm run format     # prettier --write
```

## Kiểm thử

```bash
bash tests/chay-tat-ca.sh
```

260 test, chạy hết mất khoảng 12 phút, tất cả phải xanh. Chi tiết trong
`tests/README.md`. Bộ test dùng Firebase giả lập nên không đụng dữ liệu thật.

Sửa gì cũng nên **thêm test cho đúng phần đó** rồi mới đẩy lên. Các màn hình
dùng chung store nên một thay đổi nhỏ rất dễ làm hỏng chỗ khác.

## Đẩy code lên

Container của Claude **clone được nhưng không push được**. Cách đang dùng: mở
trình soạn thảo web của GitHub bằng Claude-in-Chrome rồi thay nội dung file:

```js
const view = document.querySelector('.cm-content').cmTile.view;
view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
```

Vài điều đã trả giá mới biết:

- **Phải kiểm SHA-256 của bản gốc trước khi vá và của kết quả sau khi vá.** Vá mù
  lên file đang mở là cách nhanh nhất để phá dữ liệu thật.
- Nút "Commit changes" bật theo debounce. **Mở hộp thoại, điền message, bấm gửi
  phải là ba lời gọi công cụ riêng biệt**; gộp lại thì nút còn disabled.
  Ô nhập là `#commit-message-input`.
- Tab bị đưa xuống nền sẽ bóp timer, `setTimeout` và `fetch` treo luôn. Gặp thì
  đóng tab, mở tab mới, và đọc nội dung gốc bằng `view.state.doc.toString()`
  thay vì fetch từ `raw.githubusercontent.com`.
- Đẩy xong luôn đối chiếu: `git clone --depth 1` rồi `diff -rq`. Khác biệt hợp lệ
  duy nhất là `.nojekyll` (chỉ có trên repo) và dấu xuống dòng cuối `data.json`.

**GitHub Pages phục vụ CSS với `max-age=600`.** Mọi thẻ `<link>` CSS mang
`?v=N`; **đổi CSS là phải tăng N** ở cả bốn dòng, nếu không người dùng thấy giao
diện vỡ và tưởng là lỗi code. Hiện tại `?v=8`.

## Các quyết định nghiệp vụ đã chốt (đừng vô tình lật lại)

**Tiền đóng quỹ chỉ đếm một lần.** Ngày xưa tiền thành viên đóng được gõ tay ở
cả hai nơi nên hai bản lệch nhau. Nay **bảng Đóng quỹ theo tháng là bản chuẩn**:
mọi khoản thu thuộc danh mục `MEMBER_DUES_CATEGORY` bị loại khỏi mọi phép cộng
(`isDuesEntry`), tổng thu lấy thẳng từ `getDuesTotal()`. 22 dòng cũ vẫn nằm trong
sổ để giữ lịch sử, có nhãn "đã gộp". **Đừng xoá chúng và đừng cộng lại.**

**Danh mục thu chỉ còn "Tiền quỹ công ty hàng tháng".** Nhưng các dòng cũ vẫn
mang danh mục đã bỏ, nên form Cập nhật phải cộng thêm danh mục của chính dòng
đang sửa vào ô chọn (`buildCategoryOptions`). Thiếu bước đó thì ô chọn tự nhảy về
mục đầu tiên và bấm Lưu là đổi danh mục dòng đó lúc nào không hay.

**Ô "Tiền quỹ công ty cấp"** ở tab Đóng quỹ đọc ngược từ sổ thu chi
(`getCompanyFundTotal(monthKey)`), vì bảng đóng quỹ chỉ ghi phần thành viên đóng.
**Chỉ admin thấy ô này**; người xem thường không bao giờ thấy. Trước đây có công
tắc `settings/club.showCompanyFund` cho phép admin bật hiển thị cho người xem
thường, nhưng đã bỏ theo yêu cầu chủ trang (09/2026) — đừng thêm lại.

**Số thứ tự thành viên (STT)** đặt ở mục "Tất cả" là số dùng chung cho mọi bộ
lọc. Người bị lọc ra vẫn giữ số của mình và **số đó không được nhảy sang người
khác**. Trùng số thì báo đỏ nhưng vẫn cho lưu, kèm nút "Đánh số lại".

**Tab chỉ dành cho admin:** Thành viên và Sổ thu chi. `tab-nav.js` từ chối kích
hoạt tab đang `display: none`, nên bấm thẳng vào tab ẩn cũng không mở được.
Bảng "Giao dịch gần đây" ở Tổng quan cũng mang class `admin-only`.

## Cạm bẫy đã gặp

- `addMemberToOpenMonths` chỉ đụng các tháng **từ tháng hiện tại trở đi**. Fixture
  test dùng tháng quá khứ sẽ hỏng vì lý do này, không phải lỗi code.
- `copyTransactions` ghi **tuần tự**, không song song: ở chế độ Firebase mỗi lần
  ghi còn cập nhật `settings/club.updated`, chạy chồng lên nhau dễ ghi đè nhau.
- Trong test, mỗi `browser.newPage()` là một context riêng nên **localStorage
  không dùng chung**; trang khách phải được gieo dữ liệu của chính nó.
- Flex item có `min-width: auto` bằng bề rộng nội tại của `<input>`; muốn ô nhập
  nhỏ lại phải đặt `min-width: 0`.
- `page.once('dialog')` còn treo sẽ nuốt hộp thoại của test kế tiếp. Dùng một
  `page.on('dialog')` cố định và một hàm đặt lại lựa chọn.

## Bảo mật

- **Repo để public.** Số tài khoản ngân hàng của thủ quỹ đã gỡ khỏi `data.json`
  và `README.md` nhưng **vẫn còn trong lịch sử git**, và ảnh
  `src/assets/images/qr-transfer.png` vẫn mã hoá số tài khoản đó. Muốn sạch hẳn
  phải viết lại lịch sử repo.
- `ADMIN_PASSWORD_HASH` trong `constants.js` là tàn dư của cách đăng nhập cũ chạy
  ngay trong trình duyệt — **không phải bảo mật thật**. Bảo vệ thật nằm ở Firebase
  Auth và `firestore.rules`.
- `firebaseConfig` công khai được (Firebase thiết kế vậy). **Mật khẩu, token,
  khoá riêng thì không** — đừng nhận và đừng yêu cầu chúng qua khung chat.
- Việc xoá dữ liệu, publish rules, tạo tài khoản: nêu rõ các bước rồi để chủ
  trang tự bấm.

## Lịch sử cần biết

Dữ liệu hiện tại được nạp từ file Excel của thủ quỹ (tháng 12/2024 → 09/2026,
22 tháng, 367 dòng đóng quỹ). Việc nạp dùng một trang dùng-một-lần
`nhap-lai.html` + `src/nhap-lai.js`, **đã xoá khỏi repo sau khi nạp xong** vì bất
kỳ admin nào cũng có thể dùng nó xoá sạch dữ liệu. Cần lại thì lấy từ lịch sử:

```bash
git log --diff-filter=D --name-only -- nhap-lai.html   # tìm commit đã xoá
git show <commit>^:nhap-lai.html > nhap-lai.html
```

Trang đó xoá và ghi lại `months` + `transactions`, **cố ý không đụng vào**
`settings/*` và `admins` — nên cờ đang/ngưng hoạt động và STT sống sót qua lần
nạp. Hệ quả: người được thêm vào roster trước khi nạp sẽ mất hết dòng đóng quỹ và
biến khỏi bảng; sửa bằng nút "+ Bổ sung thành viên đang hoạt động".
