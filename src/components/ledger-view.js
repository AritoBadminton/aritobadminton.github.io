/** Trang Sổ thu chi: bộ lọc, bảng giao dịch, form thêm mới và form cập nhật. */

import { CATEGORIES, KEEP_UNCHANGED, MONTH_OPTION_LIMIT, MONTH_OPTION_MORE } from '../config/constants.js';
import {
  addTransaction,
  countPendingLedgerChanges,
  discardAllLedgerChanges,
  getAllExpenses,
  getAllIncomes,
  hasEditsIn,
  removeAddedTransaction,
  revertTransactions,
  updateTransaction,
} from '../services/ledger-service.js';
import { saveSection } from './save-bar.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
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

/** Tháng đang lọc, giữ lại khi mở rộng danh sách tháng. */
let selectedMonthFilter = '';
let sortField = 'date';
let sortDirection = -1;
let newEntryType = 'chi';
let visibleRowIds = [];

/* ---------- Hàm bổ trợ ---------- */

/** Các dòng đang được tick chọn. */
function getSelectedRows() {
  return store.transactions.filter((item) => store.selectedTransactionIds.has(item.id));
}

/** Cập nhật nhãn và trạng thái nút "Cập nhật". */
function syncUpdateButton() {
  const count = store.selectedTransactionIds.size;
  const button = qs('#ledger-update');
  button.disabled = !store.isAdmin || count === 0;
  button.style.opacity = button.disabled ? '0.45' : '1';
  button.textContent = count ? `Cập nhật (${count})` : 'Cập nhật';
  button.title = !store.isAdmin
    ? 'Đăng nhập để chỉnh sửa'
    : count === 0
      ? 'Tick chọn dòng cần sửa ở bảng bên dưới'
      : `Sửa ${count} dòng đang chọn`;
}

/** Đọc bộ lọc hiện tại và trả về danh sách dòng đã lọc, đã sắp xếp. */
function getFilteredRows() {
  const month = qs('#filter-month').value;
  const category = qs('#filter-category').value;
  const keyword = qs('#filter-keyword').value.trim().toLowerCase();

  const rows = store.transactions.filter(
    (item) =>
      (filterType === 'all' || item.type === filterType) &&
      (!month || item.date.startsWith(month)) &&
      (!category || item.cat === category) &&
      (!keyword || `${item.desc} ${item.cat}`.toLowerCase().includes(keyword)),
  );

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

/** Nạp danh mục hợp lệ theo loại giao dịch đang chọn. */
function fillNewEntryCategories() {
  qs('#new-category').innerHTML = CATEGORIES[newEntryType]
    .map((category) => `<option>${escapeHtml(category)}</option>`)
    .join('');
}

/** Đóng form cập nhật. */
function closeUpdateForm() {
  setVisible(qs('#update-form'), false);
}

/** Mở hoặc đóng form thêm mới. */
function toggleNewEntryForm() {
  closeUpdateForm();
  const form = qs('#new-entry-form');
  const isOpen = form.style.display !== 'none';
  setVisible(form, !isOpen);
  qs('#ledger-add-toggle').setAttribute('aria-expanded', String(!isOpen));
  qs('#ledger-add-toggle').textContent = isOpen ? '+ Nhập khoản mới' : 'Đóng';
  if (isOpen) return;
  if (!qs('#new-date').value) qs('#new-date').value = getTodayIso();
  qs('#new-desc').focus();
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
  qs('#new-amount').value = '';
  qs('#new-desc').value = '';
  qs('#new-desc').focus();
}

/* ---------- Form cập nhật ---------- */

/** Mở form cập nhật, điền sẵn dữ liệu của các dòng đang chọn. */
function openUpdateForm() {
  const rows = getSelectedRows();
  if (!rows.length) return;

  const isSingle = rows.length === 1;
  const [firstRow] = rows;

  setVisible(qs('#new-entry-form'), false);
  qs('#ledger-add-toggle').textContent = '+ Nhập khoản mới';
  qs('#ledger-add-toggle').setAttribute('aria-expanded', 'false');
  setVisible(qs('#update-form'), true);
  qs('#update-message').textContent = '';

  const types = [...new Set(rows.map((row) => row.type))];
  const categories = types.length === 1 ? CATEGORIES[types[0]] : [...CATEGORIES.chi, ...CATEGORIES.thu];
  qs('#update-category').innerHTML =
    (isSingle ? '' : `<option value="${KEEP_UNCHANGED}">— giữ nguyên —</option>`) +
    categories.map((category) => `<option>${escapeHtml(category)}</option>`).join('');

  if (isSingle) {
    qs('#update-head').innerHTML =
      `Đang sửa: <b>${escapeHtml(firstRow.desc)}</b> · ${formatDateLabel(firstRow.date)} · ` +
      `${firstRow.type === 'thu' ? 'Thu' : 'Chi'} ${formatCurrency(firstRow.amount)}`;
    qs('#update-date').value = firstRow.date;
    qs('#update-amount').value = formatNumber(firstRow.amount);
    qs('#update-amount').disabled = false;
    qs('#update-desc').value = firstRow.desc;
    qs('#update-desc').disabled = false;
    qs('#update-category').value = firstRow.cat;
    setVisible(qs('#update-revert'), Boolean(firstRow.edited), 'inline-block');
    return;
  }

  qs('#update-head').innerHTML =
    `Đang sửa <b>${rows.length} dòng</b> cùng lúc. Chỉ <b>Ngày</b> và <b>Danh mục</b> áp dụng cho tất cả — ` +
    `để trống Ngày và chọn "giữ nguyên" ở Danh mục thì ô đó không đổi. ` +
    `Số tiền và nội dung phải sửa từng dòng một.`;
  qs('#update-date').value = '';
  qs('#update-amount').value = '';
  qs('#update-amount').disabled = true;
  qs('#update-desc').value = '';
  qs('#update-desc').disabled = true;
  qs('#update-category').value = KEEP_UNCHANGED;
  setVisible(
    qs('#update-revert'),
    rows.some((row) => row.edited),
    'inline-block',
  );
}

/** Lưu nội dung form cập nhật vào các dòng đang chọn. */
function handleSaveUpdate() {
  const rows = getSelectedRows();
  if (!rows.length) return;

  const date = qs('#update-date').value;
  const category = qs('#update-category').value;
  const message = qs('#update-message');

  if (rows.length === 1) {
    const amount = parseAmount(qs('#update-amount').value);
    const desc = qs('#update-desc').value.trim();
    if (!date || !amount || !desc) {
      message.textContent = 'Cần đủ ngày, số tiền và nội dung.';
      message.style.color = 'var(--crit)';
      return;
    }
    updateTransaction(rows[0].id, { date, amount, desc, cat: category });
  } else {
    const patch = {};
    if (date) patch.date = date;
    if (category !== KEEP_UNCHANGED) patch.cat = category;
    if (!Object.keys(patch).length) {
      message.textContent = 'Chưa chọn gì để đổi.';
      message.style.color = 'var(--crit)';
      return;
    }
    rows.forEach((row) => updateTransaction(row.id, patch));
  }

  closeUpdateForm();
  store.selectedTransactionIds.clear();
  requestRender();
}

/** Trả các dòng đang chọn về đúng như trong data.json. */
function handleRevert() {
  revertTransactions(getSelectedRows().map((row) => row.id));
  closeUpdateForm();
  store.selectedTransactionIds.clear();
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

  const latestDate = store.transactions.reduce((a, b) => (a.date > b.date ? a : b)).date;
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
    updated: store.transactions.reduce((a, b) => (a.date > b.date ? a : b)).date,
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
  const income = rows.filter((row) => row.type === 'thu').reduce((sum, row) => sum + row.amount, 0);
  const expense = rows.filter((row) => row.type === 'chi').reduce((sum, row) => sum + row.amount, 0);
  const net = income - expense;

  qs('#ledger-income').textContent = formatCurrency(income);
  qs('#ledger-income').style.color = 'var(--good)';
  qs('#ledger-expense').textContent = formatCurrency(expense);
  qs('#ledger-expense').style.color = 'var(--crit)';
  qs('#ledger-net').textContent = `${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`;
  qs('#ledger-net').style.color = net >= 0 ? 'var(--good)' : 'var(--crit)';

  qs('#ledger-table').innerHTML = rows.length
    ? rows
        .map(
          (row) => `<tr class="${store.selectedTransactionIds.has(row.id) ? 'row--selected' : ''}">
        <td class="cell-select" style="text-align:center">
          <input type="checkbox" class="checkbox-input js-row-select" data-id="${row.id}"
            ${store.selectedTransactionIds.has(row.id) ? 'checked' : ''} ${store.isAdmin ? '' : 'disabled'}
            aria-label="Chọn ${escapeHtml(row.desc)}">
        </td>
        <td>${formatDateLabel(row.date)}</td>
        <td><span class="pill ${row.type === 'thu' ? 'pill--income' : 'pill--expense'}">${row.type === 'thu' ? 'Thu' : 'Chi'}</span></td>
        <td class="cell-name">${escapeHtml(row.desc)}
          ${row.isNew ? '<span class="pill pill--new">mới</span>' : ''}
          ${row.edited ? '<span class="pill pill--edited">đã sửa</span>' : ''}
        </td>
        <td><span style="display:inline-flex;align-items:center;gap:7px">
          <i class="color-dot" style="background:${getCategoryColor(row.cat)}"></i>${escapeHtml(row.cat)}
        </span></td>
        <td class="cell-num" style="color:${row.type === 'thu' ? 'var(--good)' : 'var(--crit)'}">
          ${row.type === 'thu' ? '+' : '−'}${formatCurrency(row.amount)}
        </td>
        <td>${
          row.isNew && store.isAdmin
            ? `<button class="btn--delete js-row-delete" data-id="${row.id}" title="Xoá khoản vừa thêm" aria-label="Xoá khoản ${escapeHtml(row.desc)}">×</button>`
            : ''
        }</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="7" class="table-empty text-muted">Không có giao dịch nào khớp bộ lọc</td></tr>';

  qsa('#ledger-table .js-row-delete').forEach((button) => {
    button.addEventListener('click', () => {
      removeAddedTransaction(button.dataset.id);
      requestRender();
    });
  });
  qsa('#ledger-table .js-row-select').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) store.selectedTransactionIds.add(checkbox.dataset.id);
      else store.selectedTransactionIds.delete(checkbox.dataset.id);
      checkbox.closest('tr').classList.toggle('row--selected', checkbox.checked);
      syncUpdateButton();
    });
  });

  visibleRowIds = rows.map((row) => row.id);
  const selectAll = qs('#ledger-select-all');
  selectAll.checked = rows.length > 0 && rows.every((row) => store.selectedTransactionIds.has(row.id));
  selectAll.disabled = !store.isAdmin || rows.length === 0;

  syncUpdateButton();
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

  qs('#ledger-select-all').addEventListener('change', () => {
    const shouldSelect = qs('#ledger-select-all').checked;
    visibleRowIds.forEach((id) => {
      if (shouldSelect) store.selectedTransactionIds.add(id);
      else store.selectedTransactionIds.delete(id);
    });
    renderLedger();
  });

  qsa('#new-type-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#new-type-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      newEntryType = button.dataset.type;
      fillNewEntryCategories();
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
  qs('#new-submit').addEventListener('click', handleAddTransaction);
  qs('#ledger-update').addEventListener('click', openUpdateForm);
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
}
