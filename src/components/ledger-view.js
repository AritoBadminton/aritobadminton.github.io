/** Trang Sổ thu chi: bộ lọc, bảng giao dịch, form thêm mới và form cập nhật. */

import {
  CATEGORIES,
  DEFAULT_ENTRY_AMOUNT,
  DEFAULT_ENTRY_DESC,
  MEMBER_DUES_CATEGORY,
  MONTH_OPTION_LIMIT,
  MONTH_OPTION_MORE,
} from '../config/constants.js';
import { getDuesTotal } from '../services/dues-service.js';
import {
  addTransaction,
  countPendingLedgerChanges,
  discardAllLedgerChanges,
  getAllExpenses,
  getAllIncomes,
  getFundBalanceUpTo,
  hasEditsIn,
  isDuesEntry,
  removeAddedTransaction,
  revertTransactions,
  updateTransaction,
} from '../services/ledger-service.js';
import { saveSection } from './save-bar.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { isFirebaseMode } from '../services/data-source.js';
import { getTodayIso } from '../utils/date.js';
import {
  buildMoreOption,
  copyToClipboard,
  escapeHtml,
  flashButtonLabel,
  qs,
  qsa,
  setVisible,
} from '../utils/dom.js';
import {
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  formatNumber,
  getCategoryColor,
  parseAmount,
} from '../utils/format.js';

/* ---------- Trạng thái riêng của trang ---------- */

let filterType = 'all';

/** Bấm xoá lần đầu rồi bao lâu thì tự huỷ xác nhận. */
const DELETE_CONFIRM_MS = 4000;

/** Nhãn mặc định của nút mở form thêm mới — khớp với chữ tĩnh trong index.html. */
const ADD_TOGGLE_LABEL = '+ Thêm giao dịch';

/** Biểu tượng cây bút cho nút "Cập nhật" ở mỗi dòng. */
const EDIT_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>`;
/** Biểu tượng hai ô chồng nhau cho nút "Sao chép" ở mỗi dòng. */
const COPY_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>`;

/** Dòng đang chờ xác nhận xoá, và hẹn giờ tự huỷ xác nhận đó. */
let pendingDeleteId = '';
let pendingDeleteTimer = 0;

/** Tháng đang lọc, giữ lại khi mở rộng danh sách tháng. */
let selectedMonthFilter = '';
let sortField = 'date';
let sortDirection = -1;
let newEntryType = 'chi';

/** Id dòng đang mở trong form cập nhật, rỗng khi form đang đóng hoặc đang ở chế độ sao chép. */
let editingId = '';

/**
 * Loại ('thu'/'chi') của dòng nguồn khi form đang mở ở chế độ sao chép, rỗng
 * khi không sao chép. Khác `editingId`: bấm Lưu lúc này tạo dòng MỚI chứ không
 * sửa dòng đã có — form chỉ mượn dữ liệu để điền sẵn, chưa đụng gì tới dữ liệu
 * chung cho tới khi admin bấm Lưu.
 */
let copyType = '';

/**
 * Các dòng khớp bộ lọc tháng, danh mục và từ khoá — chưa áp nút Thu/Chi.
 *
 * Ba ô tổng dùng danh sách này để dù đang xem riêng Thu hay riêng Chi thì tổng
 * của tháng vẫn hiện đủ cả hai chiều.
 */
function getScopedRows() {
  const month = qs('#filter-month').value;
  const category = qs('#filter-category').value;
  const keyword = qs('#filter-keyword').value.trim().toLowerCase();

  return store.transactions.filter(
    (item) =>
      (!month || item.date.startsWith(month)) &&
      (!category || item.cat === category) &&
      (!keyword || `${item.desc} ${item.cat}`.toLowerCase().includes(keyword)),
  );
}

/**
 * Tiền đóng quỹ được tính vào ba ô tổng, theo đúng bộ lọc đang đặt.
 *
 * Tiền này không có dòng riêng trong bảng nên không lọc theo từ khoá được; gõ
 * tìm kiếm thì bỏ qua, và ô tổng ghi rõ phần đóng quỹ để không ai thấy lệch mà
 * tưởng là lỗi.
 *
 * @returns {number}
 */
function getScopedDues() {
  if (qs('#filter-keyword').value.trim()) return 0;
  const category = qs('#filter-category').value;
  if (category && category !== MEMBER_DUES_CATEGORY) return 0;
  return getDuesTotal(qs('#filter-month').value);
}

/** Danh sách hiện trên bảng: thêm nút Thu/Chi và sắp xếp theo cột đang chọn. */
function getFilteredRows() {
  const rows = getScopedRows().filter((item) => filterType === 'all' || item.type === filterType);

  return rows.sort((a, b) => {
    const left = sortField === 'date' ? a.date : a.amount;
    const right = sortField === 'date' ? b.date : b.amount;
    return (left < right ? -1 : left > right ? 1 : 0) * sortDirection;
  });
}

/** Cập nhật thanh nhắc "chưa lưu chung". */
function renderPendingBar() {
  const pending = countPendingLedgerChanges();
  const hasPending = pending.added > 0 || pending.edited > 0;
  setVisible(qs('#ledger-pending-bar'), hasPending && store.isAdmin, 'flex');

  const parts = [];
  if (pending.added) {
    parts.push(`${pending.added} khoản mới (${pending.addedIncomes} thu, ${pending.addedExpenses} chi)`);
  }
  if (pending.edited) parts.push(`${pending.edited} dòng đã sửa`);
  qs('#ledger-pending-count').textContent = `${parts.join(' · ')} — chưa lưu chung`;
}

/* ---------- Form thêm mới ---------- */

/**
 * Điền lại số tiền và nội dung mặc định cho ô nhập khoản mới.
 *
 * Chỉ Thu mới có giá trị mặc định — đó là khoản quỹ công ty lặp lại gần như y
 * hệt nhau mỗi tháng. Chi thì mỗi khoản một số tiền, một nội dung khác nhau nên
 * điền sẵn số của Thu vào chỉ gây nhầm; để trống cho admin gõ tay.
 */
function resetNewEntryFields() {
  const isThu = newEntryType === 'thu';
  qs('#new-amount').value = isThu ? formatNumber(DEFAULT_ENTRY_AMOUNT) : '';
  qs('#new-desc').value = isThu ? DEFAULT_ENTRY_DESC : '';
}

/**
 * Danh mục cho một ô chọn: danh mục đang dùng, cộng thêm những danh mục cũ mà
 * các dòng đang sửa vẫn mang.
 *
 * Thiếu bước cộng thêm này thì mở form sửa một dòng thuộc danh mục đã bỏ, ô chọn
 * tự nhảy về danh mục đầu tiên và bấm Lưu là đổi danh mục dòng đó lúc nào không hay.
 *
 * @param {string[]} allowed danh mục còn chọn được
 * @param {object[]} rows các dòng đang sửa
 * @returns {string[]}
 */
function buildCategoryOptions(allowed, rows) {
  return [...new Set([...allowed, ...rows.map((row) => row.cat)])];
}

/** Nạp danh mục hợp lệ theo loại giao dịch đang chọn. */
function fillNewEntryCategories() {
  qs('#new-category').innerHTML = CATEGORIES[newEntryType]
    .map((category) => `<option>${escapeHtml(category)}</option>`)
    .join('');
}

/**
 * Chọn danh mục thì gán luôn tên danh mục vào ô nội dung.
 *
 * Đa số khoản chi/thu trùng ngay tên danh mục ("Tiền nước", "Tiền quỹ công ty
 * hàng tháng"…), gán sẵn đỡ phải gõ lại; ai cần nội dung khác cứ sửa đè lên.
 */
function handleNewCategoryChange() {
  qs('#new-desc').value = qs('#new-category').value;
}

/** Đóng form cập nhật. */
function closeUpdateForm() {
  editingId = '';
  copyType = '';
  setVisible(qs('#update-form'), false);
}

/** Mở hoặc đóng form thêm mới. */
function toggleNewEntryForm() {
  closeUpdateForm();
  const form = qs('#new-entry-form');
  const isOpen = form.style.display !== 'none';
  setVisible(form, !isOpen);
  qs('#ledger-add-toggle').setAttribute('aria-expanded', String(!isOpen));
  qs('#ledger-add-toggle').textContent = isOpen ? ADD_TOGGLE_LABEL : 'Đóng';
  if (isOpen) return;
  if (!qs('#new-date').value) qs('#new-date').value = getTodayIso();
  if (!qs('#new-amount').value) resetNewEntryFields();
  // Bôi đen sẵn để gõ đè lên nội dung mặc định, khỏi phải xoá tay.
  qs('#new-desc').select();
}

/** Ghi nhận một khoản thu/chi mới. */
function handleAddTransaction() {
  const date = qs('#new-date').value;
  const amount = parseAmount(qs('#new-amount').value);
  const desc = qs('#new-desc').value.trim();
  const category = qs('#new-category').value;
  const message = qs('#new-message');

  if (!date || !amount || !desc) {
    message.textContent = 'Vui lòng điền đủ ngày, số tiền và nội dung.';
    message.style.color = 'var(--crit)';
    return;
  }

  addTransaction(newEntryType, { date, amount, desc, cat: category });
  requestRender();
  message.textContent = `Đã thêm: ${newEntryType === 'thu' ? 'thu' : 'chi'} ${formatCurrency(amount)} — ${desc}`;
  message.style.color = 'var(--good)';
  resetNewEntryFields();
  qs('#new-desc').select();
}

/* ---------- Form cập nhật ---------- */

/**
 * Mở form cập nhật cho đúng một dòng, điền sẵn dữ liệu của dòng đó.
 * @param {string} id
 */
function openUpdateForm(id) {
  const row = store.transactions.find((item) => item.id === id);
  if (!row) return;

  editingId = id;
  copyType = '';

  fillUpdateForm(row, {
    head: `Đang sửa: <b>${escapeHtml(row.desc)}</b> · ${formatDateLabel(row.date)} · ${row.type === 'thu' ? 'Thu' : 'Chi'} ${formatCurrency(row.amount)}`,
    showRevert: Boolean(row.edited),
  });
}

/**
 * Mở form với dữ liệu mượn từ một dòng có sẵn, nhưng bấm Lưu sẽ TẠO DÒNG MỚI
 * chứ không sửa dòng nguồn — sao chép chỉ điền sẵn để đổi rồi lưu, không đụng
 * gì tới dữ liệu chung cho tới lúc đó.
 * @param {string} id
 */
function openCopyForm(id) {
  const row = store.transactions.find((item) => item.id === id);
  if (!row) return;

  editingId = '';
  copyType = row.type;

  fillUpdateForm(row, {
    head: `Đang sao chép: <b>${escapeHtml(row.desc)}</b> · ${formatDateLabel(row.date)} · ${row.type === 'thu' ? 'Thu' : 'Chi'} ${formatCurrency(row.amount)}. Sửa rồi bấm "Lưu thay đổi" để tạo khoản mới.`,
    showRevert: false,
  });
}

/**
 * Phần dựng giao diện dùng chung giữa mở form sửa và mở form sao chép: điền
 * sẵn 4 ô từ dòng nguồn, chỉ khác nhau ở dòng đầu và có hiện nút Khôi phục hay
 * không.
 * @param {object} row
 * @param {{head: string, showRevert: boolean}} options
 */
function fillUpdateForm(row, { head, showRevert }) {
  setVisible(qs('#new-entry-form'), false);
  qs('#ledger-add-toggle').textContent = ADD_TOGGLE_LABEL;
  qs('#ledger-add-toggle').setAttribute('aria-expanded', 'false');
  setVisible(qs('#update-form'), true);
  qs('#update-message').textContent = '';

  const categories = buildCategoryOptions(CATEGORIES[row.type], [row]);
  qs('#update-category').innerHTML = categories
    .map((category) => `<option>${escapeHtml(category)}</option>`)
    .join('');

  qs('#update-head').innerHTML = head;
  qs('#update-date').value = row.date;
  qs('#update-amount').value = formatNumber(row.amount);
  qs('#update-desc').value = row.desc;
  qs('#update-category').value = row.cat;
  setVisible(qs('#update-revert'), showRevert, 'inline-block');
}

/** Lưu nội dung form cập nhật: sửa dòng đang sửa, hoặc tạo dòng mới nếu đang sao chép. */
function handleSaveUpdate() {
  if (!editingId && !copyType) return;

  const date = qs('#update-date').value;
  const category = qs('#update-category').value;
  const amount = parseAmount(qs('#update-amount').value);
  const desc = qs('#update-desc').value.trim();
  const message = qs('#update-message');

  if (!date || !amount || !desc) {
    message.textContent = 'Cần đủ ngày, số tiền và nội dung.';
    message.style.color = 'var(--crit)';
    return;
  }

  if (copyType) addTransaction(copyType, { date, amount, desc, cat: category });
  else updateTransaction(editingId, { date, amount, desc, cat: category });

  closeUpdateForm();
  requestRender();
}

/**
 * Xoá một dòng: bấm lần đầu chỉ hỏi lại, bấm lần hai mới xoá thật.
 * Ở chế độ Firebase đây là xoá khỏi dữ liệu chung nên không cho lỡ tay.
 * @param {string} id
 */
function handleRowDelete(id) {
  clearTimeout(pendingDeleteTimer);

  if (pendingDeleteId !== id) {
    pendingDeleteId = id;
    pendingDeleteTimer = setTimeout(() => {
      pendingDeleteId = '';
      renderLedger();
    }, DELETE_CONFIRM_MS);
    renderLedger();
    return;
  }

  pendingDeleteId = '';
  removeAddedTransaction(id);
  requestRender();
}

/** Trả dòng đang sửa về đúng như trong data.json. */
function handleRevert() {
  if (!editingId) return;
  revertTransactions([editingId]);
  closeUpdateForm();
  requestRender();
}

/* ---------- Xuất JSON ---------- */

/**
 * Dựng các khối JSON để dán vào data.json.
 *
 * Có sửa dòng cũ thì phải thay cả danh sách — không thể mô tả an toàn kiểu
 * "sửa dòng thứ mấy". Chỉ thêm mới thì dán thêm vào cuối cho gọn.
 */
function buildExportBlocks() {
  const formatEntry = (item) =>
    `  { "date": ${JSON.stringify(item.date)}, "amount": ${item.amount}, ` +
    `"desc": ${JSON.stringify(item.desc)}, "cat": ${JSON.stringify(item.cat)} }`;

  const blocks = [];
  [
    ['chi', 'expenses', 'khoản chi', () => store.addedTransactions.expenses, getAllExpenses],
    ['thu', 'incomes', 'khoản thu', () => store.addedTransactions.incomes, getAllIncomes],
  ].forEach(([prefix, jsonKey, label, getAdded, getAll]) => {
    if (hasEditsIn(prefix)) {
      blocks.push([
        `Thay <b>TOÀN BỘ</b> nội dung trong ngoặc vuông của <code>"${jsonKey}"</code> (${label} — có dòng đã sửa)`,
        getAll().map(formatEntry).join(',\n'),
      ]);
    } else if (getAdded().length) {
      blocks.push([
        `Dán vào <b>cuối</b> danh sách <code>"${jsonKey}"</code> (${label})`,
        getAdded().map(formatEntry).join(',\n'),
      ]);
    }
  });

  const latestDate =
    store.transactions
      .map((item) => item.date)
      .sort()
      .at(-1) ?? '';
  blocks.push([
    'Sửa dòng <code>"updated"</code> ở đầu file thành',
    ` "updated": ${JSON.stringify(latestDate)},`,
  ]);
  return blocks;
}

/** Toàn bộ sổ thu chi hiện tại, dùng khi lưu thẳng lên dữ liệu chung. */
function buildLedgerPayload() {
  const clean = (item) => ({ date: item.date, amount: item.amount, desc: item.desc, cat: item.cat });
  return {
    incomes: getAllIncomes().map(clean),
    expenses: getAllExpenses().map(clean),
    updated:
      store.transactions
        .map((item) => item.date)
        .sort()
        .at(-1) ?? '',
  };
}

/** Lưu sổ thu chi lên dữ liệu chung. */
function handleSave() {
  return saveSection({
    buttonSelector: '#ledger-export-toggle',
    statusSelector: '#ledger-pending-state',
    section: 'ledger',
    buildPayload: buildLedgerPayload,
    showManualBlock: handleExport,
  });
}

/** Hiện khối JSON kèm nút sao chép cho từng phần, để dán tay. */
function handleExport() {
  const blocks = buildExportBlocks();
  qs('#ledger-export-body').innerHTML = blocks
    .map(
      ([heading, code], index) => `
      <div style="${index ? 'margin-top:18px' : ''}">
        <div class="export-block__head">
          <span style="flex:1">${heading}</span>
          <button class="btn btn--ghost" data-block="${index}">Sao chép</button>
        </div>
        <pre class="code-block">${escapeHtml(code)}</pre>
      </div>`,
    )
    .join('');

  qsa('#ledger-export-body button').forEach((button) => {
    button.addEventListener('click', async () => {
      await copyToClipboard(blocks[Number(button.dataset.block)][1]);
      flashButtonLabel(button);
    });
  });

  setVisible(qs('#ledger-export'), true);
  qs('#ledger-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Vẽ giao diện ---------- */

/** Chọn "Xem thêm" thì mở đầy đủ danh sách tháng và giữ nguyên tháng đang lọc. */
function handleMonthFilterChange() {
  const picked = qs('#filter-month').value;
  if (picked !== MONTH_OPTION_MORE) {
    selectedMonthFilter = picked;
    renderLedger();
    return;
  }
  store.showAllLedgerMonths = true;
  renderLedgerFilters();
  qs('#filter-month').value = selectedMonthFilter;
  renderLedger();
}

/** Dựng lại các ô chọn tháng và danh mục, giữ nguyên lựa chọn của người dùng. */
export function renderLedgerFilters() {
  const keptMonth = qs('#filter-month').value || selectedMonthFilter;
  const keptCategory = qs('#filter-category').value;

  const months = [...new Set(store.transactions.map((item) => item.date.slice(0, 7)))].sort().reverse();
  // Chỉ admin mới xem được toàn bộ sổ; người dùng thường xem từng tháng một.
  const shownMonths = store.showAllLedgerMonths ? months : months.slice(0, MONTH_OPTION_LIMIT);
  qs('#filter-month').innerHTML =
    (store.isAdmin ? '<option value="">Tất cả các tháng</option>' : '') +
    shownMonths.map((month) => `<option value="${month}">${formatMonthLabel(month)}</option>`).join('') +
    buildMoreOption(months.length - shownMonths.length, MONTH_OPTION_MORE);

  const categories = [...new Set(store.transactions.map((item) => item.cat))].sort();
  qs('#filter-category').innerHTML =
    '<option value="">Tất cả danh mục</option>' +
    categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('');

  if (shownMonths.includes(keptMonth)) qs('#filter-month').value = keptMonth;
  else if (!store.isAdmin) qs('#filter-month').value = shownMonths[0] ?? '';
  else qs('#filter-month').value = '';
  selectedMonthFilter = qs('#filter-month').value;
  if (categories.includes(keptCategory)) qs('#filter-category').value = keptCategory;
}

/** Vẽ lại bảng sổ thu chi và các số liệu kèm theo. */
export function renderLedger() {
  const rows = getFilteredRows();

  // Cố ý lấy getScopedRows chứ không phải rows: nút Thu/Chi chỉ lọc bảng bên
  // dưới, ba ô tổng luôn hiện đủ cả thu lẫn chi của tháng đang xem.
  const scoped = getScopedRows();
  const dues = getScopedDues();
  const income =
    scoped
      .filter((row) => row.type === 'thu' && !isDuesEntry(row))
      .reduce((sum, row) => sum + row.amount, 0) + dues;
  const expense = scoped.filter((row) => row.type === 'chi').reduce((sum, row) => sum + row.amount, 0);
  const net = income - expense;
  qs('#ledger-income-note').textContent = dues ? `Gồm ${formatCurrency(dues)} tiền đóng quỹ` : '';

  // Số dư luỹ kế tính đến hết tháng đang lọc — khác ô "Số dư quỹ hiện tại" ở
  // Tổng quan, vốn luôn là số dư mới nhất bất kể đang lọc gì ở đây.
  const balance = getFundBalanceUpTo(qs('#filter-month').value);
  qs('#ledger-balance').textContent = formatCurrency(balance);
  qs('#ledger-balance').classList.toggle('stat-tile__value--negative', balance < 0);

  qs('#ledger-income').textContent = formatCurrency(income);
  qs('#ledger-income').style.color = 'var(--good)';
  qs('#ledger-expense').textContent = formatCurrency(expense);
  qs('#ledger-expense').style.color = 'var(--crit)';
  qs('#ledger-net').textContent = `${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`;
  qs('#ledger-net').style.color = net >= 0 ? 'var(--good)' : 'var(--crit)';

  qs('#ledger-table').innerHTML = rows.length
    ? rows
        .map(
          (row) => `<tr>
        <td>${formatDateLabel(row.date)}</td>
        <td><span class="pill ${row.type === 'thu' ? 'pill--income' : 'pill--expense'}">${row.type === 'thu' ? 'Thu' : 'Chi'}</span></td>
        <td class="cell-name">${escapeHtml(row.desc)}
          ${row.isNew ? '<span class="pill pill--new">mới</span>' : ''}
          ${row.edited ? '<span class="pill pill--edited">đã sửa</span>' : ''}
          ${
            isDuesEntry(row)
              ? '<span class="pill pill--merged" title="Tiền đóng quỹ nay lấy từ tab Đóng quỹ theo tháng, nên dòng này không cộng vào tổng nữa">đã gộp</span>'
              : ''
          }
        </td>
        <td><span style="display:inline-flex;align-items:center;gap:7px">
          <i class="color-dot" style="background:${getCategoryColor(row.cat)}"></i>${escapeHtml(row.cat)}
        </span></td>
        <td class="cell-num" style="color:${row.type === 'thu' ? 'var(--good)' : 'var(--crit)'}">
          ${row.type === 'thu' ? '+' : '−'}${formatCurrency(row.amount)}
        </td>
        <td class="admin-only" style="white-space:nowrap">
          <button class="btn--row-action js-row-update" data-id="${row.id}" type="button"
            title="Sửa khoản này" aria-label="Sửa khoản ${escapeHtml(row.desc)}">${EDIT_ICON}</button>
          <button class="btn--row-action js-row-copy" data-id="${row.id}" type="button"
            title="Sao chép thành khoản mới" aria-label="Sao chép khoản ${escapeHtml(row.desc)}">${COPY_ICON}</button>
          ${
            row.isNew || isFirebaseMode()
              ? `<button class="btn--delete js-row-delete${pendingDeleteId === row.id ? ' btn--delete-armed' : ''}"
                data-id="${row.id}" title="${row.isNew ? 'Xoá khoản vừa thêm' : 'Xoá khoản này khỏi dữ liệu chung'}"
                aria-label="Xoá khoản ${escapeHtml(row.desc)}">${pendingDeleteId === row.id ? 'Xoá?' : '×'}</button>`
              : ''
          }
        </td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="table-empty text-muted">Không có giao dịch nào khớp bộ lọc</td></tr>';

  qsa('#ledger-table .js-row-delete').forEach((button) => {
    button.addEventListener('click', () => handleRowDelete(button.dataset.id));
  });
  qsa('#ledger-table .js-row-update').forEach((button) => {
    button.addEventListener('click', () => openUpdateForm(button.dataset.id));
  });
  qsa('#ledger-table .js-row-copy').forEach((button) => {
    button.addEventListener('click', () => openCopyForm(button.dataset.id));
  });

  qs('#ledger-count').textContent = `${rows.length} giao dịch`;
  renderPendingBar();
}

/* ---------- Khởi tạo ---------- */

/** Gắn toàn bộ sự kiện cho trang Sổ thu chi. */
export function initLedgerView() {
  qsa('#ledger-type-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#ledger-type-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      filterType = button.dataset.type;
      renderLedger();
    });
  });

  qs('#filter-month').addEventListener('change', handleMonthFilterChange);
  ['#filter-category', '#filter-keyword'].forEach((selector) => {
    qs(selector).addEventListener('input', renderLedger);
  });

  qsa('#panel-ledger th[data-sort]').forEach((header) => {
    header.addEventListener('click', () => {
      const field = header.dataset.sort;
      if (sortField === field) sortDirection *= -1;
      else {
        sortField = field;
        sortDirection = -1;
      }
      renderLedger();
    });
  });

  qsa('#new-type-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#new-type-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      newEntryType = button.dataset.type;
      fillNewEntryCategories();
      // Đổi loại thì giá trị mặc định của loại cũ (nếu có) không còn hợp nữa.
      resetNewEntryFields();
    });
  });

  [
    ['#new-amount', '#new-amount'],
    ['#update-amount', '#update-amount'],
  ].forEach(([selector]) => {
    qs(selector).addEventListener('input', () => {
      const digits = parseAmount(qs(selector).value);
      qs(selector).value = digits ? formatNumber(digits) : '';
    });
  });

  qs('#ledger-add-toggle').addEventListener('click', toggleNewEntryForm);
  qs('#new-category').addEventListener('change', handleNewCategoryChange);
  qs('#new-submit').addEventListener('click', handleAddTransaction);
  qs('#update-save').addEventListener('click', handleSaveUpdate);
  qs('#update-cancel').addEventListener('click', closeUpdateForm);
  qs('#update-revert').addEventListener('click', handleRevert);
  qs('#ledger-export-toggle').addEventListener('click', handleSave);
  qs('#ledger-discard').addEventListener('click', () => {
    if (!window.confirm('Bỏ toàn bộ khoản mới và các chỉnh sửa chưa lưu chung?')) return;
    discardAllLedgerChanges();
    setVisible(qs('#ledger-export'), false);
    requestRender();
  });

  fillNewEntryCategories();
  resetNewEntryFields();
}
