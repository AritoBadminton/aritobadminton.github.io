# Hướng dẫn cho phiên Claude tiếp theo

Trang quản lý quỹ CLB cầu lông công ty Arito. Đây là **quỹ thật, tiền thật của
một nhóm người thật** — mỗi lần đẩy code lên là đổi luôn trang mà cả nhóm đang
dùng. Không có môi trường thử. Để dành mọi thao tác xoá dữ liệu cho chủ trang tự
bấm. Chạy `npm run check` trước khi đẩy; bộ kiểm thử Playwright thì chủ trang tự
test tay sau khi Claude cập nhật xong — xem thêm mục "Kiểm thử" bên dưới.

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
settings/club     { name, updated, notes[], address, mapLink }
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

260+ test, chạy hết mất khoảng 12-20 phút. Chi tiết trong `tests/README.md`. Bộ
test dùng Firebase giả lập nên không đụng dữ liệu thật.

**Từ 09/2026, Claude không cần tự chạy cả bộ này trước khi đẩy nữa — chủ trang
tự test tay sau khi Claude cập nhật xong.** Trước đó đây là bước bắt buộc; chủ
trang chủ động đổi vì thấy chạy lâu và muốn tự kiểm tra trực tiếp. Vẫn luôn chạy
`npm run check` (prettier + eslint) trước khi đẩy — nhanh, không phải chạy trình
duyệt, và bắt được lỗi cú pháp/biến thừa mà việc bấm tay không chắc phát hiện ra.
Sửa gì cũng nên **thêm test cho đúng phần đó** vào bộ Playwright dù không tự
chạy — hỏng ở đâu chủ trang test tay vẫn thấy, và test có sẵn giúp session sau
không giẫm lại đúng lỗi cũ. Nếu chủ trang yêu cầu chạy lại kiểm thử (ví dụ sau
một đợt sửa lớn) thì chạy như bình thường.

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
diện vỡ và tưởng là lỗi code. Hiện tại `?v=20`.

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
Từng chỉ admin thấy ô này, có công tắc `settings/club.showCompanyFund` cho admin
bật hiển thị cho người xem thường rồi bị bỏ (09/2026). Sau đó chủ trang lại yêu
cầu cho người xem thường thấy hẳn (09/2026), nên **giờ ai cũng thấy ô này, không
còn phân biệt admin hay không** — không dùng công tắc, `renderCompanyFund`
(`months-view.js`) hiện luôn hiện ô này.

**Số thứ tự thành viên (STT)** đặt ở mục "Tất cả" là số dùng chung cho mọi bộ
lọc. Người bị lọc ra vẫn giữ số của mình và **số đó không được nhảy sang người
khác**. Trùng số thì báo đỏ nhưng vẫn cho lưu, kèm nút "Đánh số lại".

**Tab chỉ dành cho admin: chỉ còn Thành viên.** Sổ thu chi từng là tab admin
nhưng đã mở cho mọi người xem (`4f9bc0b`, 09/2026) — khách đọc được bảng giao
dịch, còn khu "Thêm giao dịch" và các nút sửa/xoá/sao chép vẫn mang `admin-only`
nên không ai ngoài admin ghi được vào sổ. **Đừng thêm lại `admin-only` vào tab
`data-panel="ledger"`**, đó là lật ngược một quyết định đã chốt. `tab-nav.js` từ
chối kích hoạt tab đang `display: none`, nên bấm thẳng vào tab Thành viên khi
chưa đăng nhập cũng không mở được. Bảng "Giao dịch gần đây" ở Tổng quan vẫn mang
class `admin-only`.

**Ghi chú ở Tổng quan** (`settings/club.notes[]`) chỉ hiện khi `settings/rules.items`
rỗng và người xem không phải admin (`renderRules` trong `dashboard-view.js`) —
đây là bản dự phòng khi chưa ai nhập mức đóng vào `settings/rules`, và đúng là
cảnh trang thật đang gặp. `settings/rules.footer` ("Lưu ý") dùng chung hàm này.
`formatNoteHtml` (`utils/format.js`) hỗ trợ `\n` để xuống dòng, `**...**` để in
đậm, `*...*` để in nghiêng (đậm phải thay trước nghiêng), và **tự động tô đỏ
số tiền** — nhận cả có hậu tố ("30.000đ", "30k") lẫn số viết theo nhóm ba chữ
số kiểu Việt Nam mà không có hậu tố ("30.000"), nhưng bỏ qua số trần không
chấm nhóm (như năm "2026") để không tô nhầm. Không cần đánh dấu riêng cho phần
tiền. Chữ đậm trong "Lưu ý" ra `<strong>`, không phải `<b>`, nên CSS
(`.rules-panel__footer b, .rules-panel__footer strong`) phải bắt cả hai thì mới
cùng màu với nhãn "Lưu ý:". Chưa có màn hình admin nào để sửa `notes` hay
`footer`; đổi nội dung phải sửa thẳng trong Firebase Console.

**Ô nhập khoản mới ở Sổ thu chi: số tiền chỉ Thu mới có mặc định, nội dung thì
cả hai đều có, lấy theo danh mục (09/2026).** Số tiền dùng `DEFAULT_ENTRY_AMOUNT`,
chỉ áp cho Thu — đó là khoản quỹ công ty lặp lại gần như y hệt mỗi tháng, Chi thì
mỗi khoản một số khác nhau nên để trống. Nội dung không còn hằng số riêng
(`DEFAULT_ENTRY_DESC` đã xoá khỏi `constants.js`) — `resetNewEntryFields` gán
thẳng theo **danh mục đang chọn trong `#new-category`**, giống hệt việc tự chọn
lại danh mục (`handleNewCategoryChange`), chỉ khác là chạy ngay lúc mở form/đổi
Thu-Chi thay vì phải đợi bấm chọn lại mới có. Đổi qua lại Thu/Chi ở
`#new-type-toggle` sẽ tự căn lại theo đúng hai quy tắc này.

**Danh mục Thu có hai lựa chọn:** "Tiền quỹ công ty hàng tháng" và "Tiền được
tài trợ cho CLB" — khoản tài trợ là tiền thật có vào quỹ nên vẫn cộng vào tổng
thu bình thường, chỉ khác là **không** được `getCompanyFundTotal` xem là tiền
công ty cấp hàng tháng (chỉ lọc đúng danh mục quỹ công ty).

**Sổ thu chi không còn chọn nhiều dòng cùng lúc (09/2026).** Trước đây mỗi dòng
có ô tick, một nút "Cập nhật" và một nút "Sao chép" dùng chung ở đầu bảng thao
tác trên các dòng đang chọn. Chủ trang yêu cầu bỏ hẳn cơ chế chọn nhiều dòng: giờ
mỗi dòng có sẵn hai nút riêng — Cập nhật (bút chì) và Sao chép — đặt trước nút xoá
(`renderLedger` trong `ledger-view.js`, class `.btn--row-action`). Form cập nhật
giờ chỉ sửa được đúng một dòng, không còn nhánh sửa hàng loạt (giữ nguyên Ngày/
Danh mục cho cả nhóm). `store.selectedTransactionIds`, `KEEP_UNCHANGED` và cột
tick chọn (`cell-select`) đã xoá khỏi mã nguồn — **đừng thêm lại**.

**Nút Sao chép không tạo dòng ngay khi bấm.** Bấm chỉ mở form Cập nhật, điền sẵn
dữ liệu mượn từ dòng nguồn (`openCopyForm`) — chưa ghi gì vào dữ liệu chung. Dòng
mới chỉ thật sự được tạo (`addTransaction`) khi admin sửa xong và bấm "Lưu thay
đổi" (`handleSaveUpdate`, rẽ nhánh theo biến trạng thái `copyType` thay vì
`editingId`). Hàm `copyTransactions` (từng nhân bản và ghi ngay) đã xoá khỏi
`ledger-service.js` — đừng thêm lại kiểu ghi-trước-sửa-sau đó.

**Form Thêm/Sửa/Sao chép giao dịch và xác nhận xoá đều là popup, không còn mở
inline trong thẻ (09/2026).** Trước đây `#new-entry-form`/`#update-form` là
`.card__body` mở rộng ngay dưới nút bấm trong cùng khối thẻ. Nay là ba hộp thoại
riêng — `#new-entry-modal`, `#update-modal`, `#delete-confirm-modal` — theo đúng
mẫu `.modal`/`.modal__box` đã dùng cho đăng nhập/đổi mật khẩu (khai báo cạnh hai
hộp đó trong `index.html`, ngoài mọi `<section>` tab). `.modal__box` mặc định
rộng 380px chỉ đủ một cột; hộp chứa `.field-grid` 4 ô (thêm/sửa) dùng thêm class
`.modal__box--wide` (560px) và ép cứng `.field-grid` về 2 cột bằng chọn lọc
`.modal__box--wide .field-grid` — mốc `@media (max-width: 820px)` của
`.field-grid` gốc đo theo bề rộng **cửa sổ**, không đo theo bề rộng hộp thoại,
nên không tự áp dụng dù hộp chỉ rộng 560px. Đóng bằng bấm Huỷ, bấm ra ngoài lớp
phủ (so `event.target.id` với chính id hộp thoại, giống `login-modal.js`), hoặc
phím Escape — cả ba cách đều gắn trong `initLedgerView`. Nút "+ Thêm giao dịch"
giờ luôn hiện đúng một chữ tĩnh, không còn tự đổi thành "Đóng" — `ADD_TOGGLE_LABEL`
đã xoá khỏi mã nguồn.

**Xoá giao dịch dùng popup xác nhận + toast, không còn kiểu bấm hai lần
(09/2026).** Trước đây bấm nút × đổi ngay thành "Xoá?" rồi phải bấm lần hai trong
4 giây mới xoá thật (`pendingDeleteId`/`pendingDeleteTimer`, class
`.btn--delete-armed`) — cơ chế đó **vẫn còn** ở tab Thành viên
(`members-view.js`, xoá thành viên), nhưng ở Sổ thu chi đã đổi sang bấm một cái
mở `#delete-confirm-modal` hỏi rõ tên/ngày/số tiền khoản sắp xoá; Đồng ý mới xoá
thật, Huỷ chỉ đóng popup không đụng gì. Xoá xong gọi `showToast()` (`utils/dom.js`)
hiện chữ "Đã xoá thành công" ở `#toast` rồi tự ẩn sau 3 giây.

**Bấm "Thêm vào sổ"/"Lưu thay đổi" cũng hiện toast, dùng chung `showToast()`
(09/2026).** Ba chỗ gọi `addTransaction`/`updateTransaction` thành công —
`handleAddTransaction`, và `handleSaveUpdate` (dùng chung cho cả sửa lẫn sao
chép) — đều gọi thêm `showToast('Đã thực hiện xong')` sau khi lưu, cùng cơ chế
toast của nút xoá ở trên. Chữ khác nhau theo hành động (`'Đã xoá thành công'` so
với `'Đã thực hiện xong'`), không dùng chung một hằng số — nếu sau này thêm chỗ
gọi mới thì nhớ chọn đúng câu, đừng gộp lại thành một chuỗi chung chung. Riêng
form Thêm giao dịch vẫn giữ nguyên hành vi **không đóng popup** sau khi lưu
(để nhập liên tiếp nhiều khoản), form Cập nhật/Sao chép thì đóng popup như cũ —
toast không đổi phần đó, chỉ thêm thông báo.

**Ô "Số dư quỹ" ở tab Sổ thu chi theo bộ lọc tháng (09/2026, lật ngược quyết định
cũ).** Trước đây ô này cố ý KHÔNG theo bộ lọc để luôn khớp ô "Số dư quỹ hiện tại"
ở Tổng quan. Chủ trang đổi ý: ô này đổi tên thành "Số dư quỹ của tháng" và tính
số dư **luỹ kế đến hết tháng đang xem** qua `getFundBalanceUpTo(monthKey)`
(`ledger-service.js`) — không chọn tháng (hoặc chọn "Tất cả các tháng") thì ra
đúng số dư hiện tại, khớp `getFundBalance()`. Ô "Số dư quỹ hiện tại" ở Tổng quan
(`#kpi-balance`, `dashboard-view.js`) **không đổi**, vẫn luôn là số dư mới nhất
bất kể ai đang lọc gì ở tab Sổ thu chi.

**Bảng Sổ thu chi: cột "Giao dịch" (trước là "Danh mục") đứng trước cột "Nội
dung" (09/2026).** Thứ tự cột cũ là Ngày, Loại, Nội dung, Danh mục, Số tiền;
chủ trang yêu cầu đảo hai cột giữa và đổi tên cột danh mục thành "Giao dịch" —
giờ là Ngày, Loại, **Giao dịch**, Nội dung, Số tiền. Đây chỉ là đổi vị trí `<td>`
trong `renderLedger` (`ledger-view.js`) và thứ tự `<th>` khớp theo trong
`index.html`; dữ liệu bên dưới (`row.cat`/`row.desc`) không đổi, `colspan` dòng
trống vẫn là 6. **Đừng nhầm với bảng "Giao dịch gần đây" ở Tổng quan
(`#recent-table`, `dashboard-view.js`)** — bảng đó vẫn giữ thứ tự Nội dung rồi
Danh mục như cũ, chưa được yêu cầu đổi.

**Phụ đề dưới tiêu đề và các dòng "Cập nhật ..." đã bỏ (09/2026).** Trước đây
`renderDashboard` tự tính `firstDate`/`lastDate` từ ngày giao dịch mới nhất để
hiển thị "Cập nhật lần cuối" ở footer, "Cập nhật ..." dưới số dư quỹ, và phụ đề
"Từ ... đến ..." dưới tiêu đề — theo yêu cầu chủ trang, cả ba đã bỏ. Phụ đề
`#app-subtitle` giờ là **chữ tĩnh** "Từ tháng 11/2024 đến nay" viết thẳng trong
`index.html`, không còn do JS tính. **Đừng thêm lại** các dòng ngày-cập-nhật tự
động này nếu không được yêu cầu lại.

**Địa chỉ CLB + link Google Maps ở Tổng quan, admin sửa trực tiếp trên trang
(09/2026).** Hai trường mới `address`/`mapLink` nằm chung tài liệu
`settings/club` (đã có sẵn `name`/`updated`) chứ không phải tài liệu riêng —
`watchClubData` đã lắng nghe `'club'` từ trước nên không cần thêm listener.
Dịch vụ mới `address-service.js` mô phỏng đúng `rules-service.js`: admin gõ vào
ô là `setAddressField` ghi thẳng lên Firestore (`saveClubAddress`,
`firebase-service.js`) ở chế độ Firebase, hoặc lưu `store.addressOverride` +
localStorage rồi chờ "Lưu chung lên GitHub" ở chế độ `data.json`. `#address-panel`
(`renderAddressPanel`, `dashboard-view.js`) dùng chung một `<div id="address-panel">`
cho cả hai vai: admin thấy hai ô nhập (địa chỉ, link) và luôn thấy khối này kể cả
khi còn trống; người xem thường chỉ thấy một dòng chữ kèm link, và **khối tự ẩn
hẳn** nếu chưa admin nào nhập gì — giống hệt cách khối mã QR tự ẩn khi thiếu
`qr.image`. Link chỉ hiện khi `mapLink` khác rỗng; có địa chỉ mà chưa có link thì
chỉ hiện chữ, không tự bịa link. `.address-panel__fields` trong `components.css`
ép `.field-grid` (vốn 4 cột ở màn rộng) xuống 2 cột — cùng lý do và cùng cách
làm với `.modal__box--wide .field-grid` đã ghi ở trên.

## Cạm bẫy đã gặp

- `addMemberToOpenMonths` chỉ đụng các tháng **từ tháng hiện tại trở đi**. Fixture
  test dùng tháng quá khứ sẽ hỏng vì lý do này, không phải lỗi code.
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
