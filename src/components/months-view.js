/** Trang Đóng quỹ theo tháng: danh sách đóng quỹ, mã QR và chi tiêu của tháng. */

import { getAllExpenses } from '../services/ledger-service.js';
import {
  fillMonthWithActiveMembers,
  getActiveMemberNames,
  getChangedMemberNames,
  getEffectiveNote,
  getEffectivePaid,
  getFutureMonthKeys,
  getMonthMembers,
  getMonthsWithChanges,
  getUsualAmount,
  isVirtualMonth,
  resetMonth,
  setNote,
  setPaidAmount,
} from '../services/dues-service.js';
import { aggregateMembers } from '../services/member-service.js';
import { requestRender } from '../state/render-bus.js';
import { buildDuesKey, store } from '../state/store.js';
import { copyToClipboard, escapeHtml, flashButtonLabel, qs, qsa, setVisible } from '../utils/dom.js';
import {
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getCategoryColor,
  parseAmount,
} from '../utils/format.js';

/** Tháng đang được chọn trong ô lọc. */
function getSelectedMonthKey() {
  return qs('#month-picker').value || store.months[store.months.length - 1].month;
}

/** Một dòng có ghi đè số tiền hoặc ghi chú hay không. */
function hasOverride(monthKey, memberName) {
  const key = buildDuesKey(monthKey, memberName);
  return key in store.duesPaidOverrides || key in store.duesNoteOverrides;
}

/* ---------- Xử lý sự kiện ---------- */

/** Đổi số tiền đóng quỹ rồi vẽ lại các vùng liên quan. */
function handleSetPaid(monthKey, memberName, amount) {
  setPaidAmount(monthKey, memberName, amount);
  aggregateMembers();
  requestRender('months', 'members');
}

/** Đổi ghi chú rồi vẽ lại bảng tháng. */
function handleSetNote(monthKey, memberName, note) {
  setNote(monthKey, memberName, note);
  requestRender('months');
}

/** Bổ sung thành viên đang hoạt động còn thiếu vào tháng đã ghi. */
function handleFillMonth() {
  fillMonthWithActiveMembers(getSelectedMonthKey());
  aggregateMembers();
  requestRender('months', 'members');
}

/** Bỏ mọi thay đổi chưa lưu chung của tháng đang xem. */
function handleResetMonth() {
  resetMonth(getSelectedMonthKey());
  aggregateMembers();
  setVisible(qs('#month-export'), false);
  requestRender('months', 'members');
}

/** Xuất khối JSON của tháng đang xem. */
async function handleExport() {
  const monthKey = getSelectedMonthKey();
  const isVirtual = isVirtualMonth(monthKey);
  const members = getMonthMembers(monthKey);

  const entries = members.map(
    (member) =>
      `     { "name": ${JSON.stringify(member.name)}, "paid": ${getEffectivePaid(monthKey, member)}, ` +
      `"note": ${JSON.stringify(getEffectiveNote(monthKey, member))} }`,
  );
  const total = members.reduce((sum, member) => sum + getEffectivePaid(monthKey, member), 0);
  const block =
    `  {\n   "month": ${JSON.stringify(monthKey)},\n` +
    `   "label": ${JSON.stringify(formatMonthLabel(monthKey))},\n` +
    `   "total": ${total},\n   "members": [\n${entries.join(',\n')}\n   ]\n  }`;

  qs('#month-export-code').textContent = block;
  qs('#month-export-hint').textContent = isVirtual
    ? 'thêm khối này vào CUỐI danh sách "months" (nhớ dấu phẩy ở khối trước)'
    : `tìm khối "month": "${monthKey}" rồi thay bằng khối dưới`;
  setVisible(qs('#month-export'), true);
  await copyToClipboard(block);
  flashButtonLabel(qs('#month-export-toggle'));
  qs('#month-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Vẽ giao diện ---------- */

/** Dựng lại ô chọn tháng, gồm cả các tháng tự tạo. */
export function renderMonthPicker() {
  const kept = qs('#month-picker').value;
  const activeCount = getActiveMemberNames().length;

  qs('#month-picker').innerHTML =
    store.months
      .map(
        (month) =>
          `<option value="${month.month}">${formatMonthLabel(month.month)} — ${month.members.length} thành viên</option>`,
      )
      .join('') +
    getFutureMonthKeys()
      .map(
        (key) =>
          `<option value="${key}">${formatMonthLabel(key)} — tự tạo, ${activeCount} người đang hoạt động</option>`,
      )
      .join('');

  const options = [...qs('#month-picker').options].map((option) => option.value);
  qs('#month-picker').value = options.includes(kept) ? kept : store.months[store.months.length - 1].month;
}

/** Vẽ lại toàn bộ trang Đóng quỹ theo tháng. */
export function renderMonths() {
  const monthKey = getSelectedMonthKey();
  const isVirtual = isVirtualMonth(monthKey);

  const rows = getMonthMembers(monthKey).map((member) => ({
    ...member,
    amount: getEffectivePaid(monthKey, member),
    note: getEffectiveNote(monthKey, member),
    isNewRow: Boolean(member.added) && !isVirtual,
    isEdited: hasOverride(monthKey, member.name) || (Boolean(member.added) && !isVirtual),
  }));

  const paidRows = rows.filter((row) => row.amount > 0);
  const collected = rows.reduce((sum, row) => sum + row.amount, 0);
  const expenses = getAllExpenses().filter((item) => item.date.startsWith(monthKey));
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  qs('#month-collected').textContent = formatCurrency(collected);
  qs('#month-paid-count').textContent = `${paidRows.length}/${rows.length}`;
  qs('#month-unpaid-count').textContent = `${rows.length - paidRows.length} người`;
  qs('#month-unpaid-count').style.color = rows.length - paidRows.length ? 'var(--crit)' : 'var(--good)';
  qs('#month-expense').textContent = formatCurrency(expenseTotal);

  qs('#month-subtitle').textContent =
    `${formatMonthLabel(monthKey)} · ${rows.length} thành viên` +
    (store.isAdmin ? ' · chọn ở cột Trạng thái để đánh dấu' : '');
  qs('#month-note-hint').textContent = store.isAdmin ? '(sửa được)' : '';
  qs('#month-expense-subtitle').textContent =
    `${expenses.length} khoản chi trong ${formatMonthLabel(monthKey).toLowerCase()}`;

  /* Thanh báo tháng tự sinh / đã bổ sung */
  const addedCount = rows.filter((row) => row.isNewRow).length;
  setVisible(qs('#month-auto-bar'), isVirtual || Boolean(store.duesFilledMonths[monthKey]), 'flex');
  qs('#month-auto-text').innerHTML = isVirtual
    ? `<b>${formatMonthLabel(monthKey)} chưa có trong dữ liệu chung.</b> Bảng dưới được tự sinh từ ` +
      `${getActiveMemberNames().length} thành viên đang hoạt động, tất cả để "Chưa đóng". ` +
      `Đánh dấu xong bấm <b>Tạo tháng này trên GitHub</b> để tạo tháng này thật.`
    : `Đã bổ sung <b>${addedCount} người</b> đang hoạt động chưa có tên trong tháng này. Các dòng cũ giữ nguyên.`;

  const recorded = store.months.find((month) => month.month === monthKey);
  const canFill =
    !isVirtual &&
    !store.duesFilledMonths[monthKey] &&
    getActiveMemberNames().some((name) => !recorded.members.some((member) => member.name === name));
  setVisible(qs('#month-fill'), store.isAdmin && canFill, 'inline-block');

  /* Bảng danh sách đóng quỹ */
  qs('#dues-table').innerHTML = rows
    .map((row, index) => {
      const isPaid = row.amount > 0;
      return `<tr class="${row.isEdited ? 'row--edited' : ''} ${row.isNewRow ? 'row--added' : ''}">
        <td class="cell-num" style="color:var(--text-3)">${index + 1}</td>
        <td class="cell-name">${escapeHtml(row.name)}</td>
        <td class="cell-num">
          <input type="text" inputmode="numeric" class="amount-input ${isPaid ? 'amount-input--filled' : ''}"
            value="${isPaid ? formatCurrency(row.amount) : '0 đ'}" placeholder="0 đ" ${store.isAdmin ? '' : 'disabled'}
            data-name="${escapeHtml(row.name)}" data-raw="${row.amount}"
            aria-label="Số tiền ${escapeHtml(row.name)} đóng">
        </td>
        <td>
          <select class="status-select ${isPaid ? 'status-select--paid' : 'status-select--unpaid'}"
            data-name="${escapeHtml(row.name)}" ${store.isAdmin ? '' : 'disabled'}
            aria-label="Trạng thái đóng quỹ ${escapeHtml(row.name)}">
            <option value="1" ${isPaid ? 'selected' : ''}>Đã đóng</option>
            <option value="0" ${isPaid ? '' : 'selected'}>Chưa đóng</option>
          </select>
        </td>
        <td>
          <input type="text" class="note-input" value="${escapeHtml(row.note)}"
            placeholder="${store.isAdmin ? 'Thêm ghi chú…' : ''}" ${store.isAdmin ? '' : 'disabled'}
            data-name="${escapeHtml(row.name)}" aria-label="Ghi chú cho ${escapeHtml(row.name)}">
        </td>
      </tr>`;
    })
    .join('');

  qsa('#dues-table .status-select').forEach((select) => {
    select.addEventListener('change', () => {
      const name = select.dataset.name;
      const amount = select.value === '1' ? getUsualAmount(name, monthKey) : 0;
      handleSetPaid(monthKey, name, amount);
    });
  });

  qsa('#dues-table .amount-input').forEach((input) => {
    input.addEventListener('focus', () => {
      input.value = Number(input.dataset.raw) > 0 ? input.dataset.raw : '';
      input.select();
    });
    input.addEventListener('blur', () => {
      const amount = parseAmount(input.value);
      if (amount === Number(input.dataset.raw)) {
        input.value = amount > 0 ? formatCurrency(amount) : '0 đ';
        return;
      }
      handleSetPaid(monthKey, input.dataset.name, amount);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
  });

  qsa('#dues-table .note-input').forEach((input) => {
    input.addEventListener('change', () => handleSetNote(monthKey, input.dataset.name, input.value.trim()));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
  });

  /* Bảng chi tiêu trong tháng */
  qs('#month-expense-table').innerHTML = expenses.length
    ? expenses
        .map(
          (item) => `<tr>
        <td>${formatDateLabel(item.date)}</td>
        <td class="cell-name">${escapeHtml(item.desc)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:7px">
          <i class="color-dot" style="background:${getCategoryColor(item.cat)}"></i>${escapeHtml(item.cat)}
        </span></td>
        <td class="cell-num">${formatCurrency(item.amount)}</td>
      </tr>`,
        )
        .join('') +
      `<tr><td colspan="3" style="font-weight:600;color:var(--text)">Tổng chi</td>
       <td class="cell-num" style="font-weight:650;color:var(--crit)">${formatCurrency(expenseTotal)}</td></tr>`
    : '<tr><td colspan="4" class="table-empty text-muted">Không có khoản chi nào</td></tr>';

  /* Thanh lưu chung */
  const changedNames = getChangedMemberNames(monthKey);
  const markedNames = rows.filter((row) => hasOverride(monthKey, row.name)).map((row) => row.name);
  const otherMonths = getMonthsWithChanges().filter((key) => key !== monthKey);
  const otherText = otherMonths.length
    ? `<br>Các tháng khác cũng đang có thay đổi: ${otherMonths.map(formatMonthLabel).join(', ')} — chọn từng tháng rồi lưu.`
    : '';

  qs('#month-pending-state').innerHTML = isVirtual
    ? `Tháng mới, sẽ thêm <b>${rows.length} dòng</b> vào dữ liệu chung` +
      (markedNames.length
        ? ` — đã đánh dấu ${markedNames.length} người: ${markedNames.slice(0, 6).map(escapeHtml).join(', ')}${markedNames.length > 6 ? '…' : ''}.`
        : ' — chưa đánh dấu ai đóng tiền.') +
      otherText
    : changedNames.length
      ? `Tháng này có ${changedNames.length} thay đổi chưa lưu chung: ${changedNames.slice(0, 6).map(escapeHtml).join(', ')}${changedNames.length > 6 ? '…' : ''}${otherText}`
      : otherMonths.length
        ? `Tháng này chưa đổi gì. Các tháng khác đang có thay đổi: ${otherMonths.map(formatMonthLabel).join(', ')}.`
        : 'Chưa thay đổi gì so với dữ liệu chung.';

  const canSave = isVirtual || changedNames.length > 0;
  qs('#month-export-toggle').disabled = !canSave;
  qs('#month-export-toggle').style.opacity = canSave ? '1' : '0.45';
  qs('#month-export-toggle').textContent = isVirtual ? 'Tạo tháng này trên GitHub' : 'Lưu chung lên GitHub';
  setVisible(
    qs('#month-reset'),
    markedNames.length > 0 || Boolean(store.duesFilledMonths[monthKey]),
    'inline-block',
  );
  qs('#month-reset').textContent = isVirtual ? 'Xoá đánh dấu tháng này' : 'Đặt lại tháng này';
}

/** Gắn sự kiện cho trang Đóng quỹ theo tháng. */
export function initMonthsView() {
  qs('#month-picker').addEventListener('change', () => {
    setVisible(qs('#month-export'), false);
    renderMonths();
  });
  qs('#month-fill').addEventListener('click', handleFillMonth);
  qs('#month-export-toggle').addEventListener('click', handleExport);
  qs('#month-reset').addEventListener('click', handleResetMonth);
}
