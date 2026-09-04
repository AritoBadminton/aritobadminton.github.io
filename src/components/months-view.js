/** Trang Đóng quỹ theo tháng: danh sách đóng quỹ, mã QR và chi tiêu của tháng. */

import {
  DUES_STATUS,
  DUES_STATUS_LABELS,
  MONTH_OPTION_LIMIT,
  MONTH_OPTION_MORE,
} from '../config/constants.js';
import {
  fillMonthWithActiveMembers,
  getActiveMemberNames,
  getChangedMemberNames,
  getDuesStatus,
  getEffectiveNote,
  getEffectivePaid,
  getEffectiveSkip,
  getFutureMonthKeys,
  getMonthMembers,
  getMonthsWithChanges,
  isVirtualMonth,
  resetMonth,
  setDuesStatus,
  setNote,
  setPaidAmount,
} from '../services/dues-service.js';
import { aggregateMembers } from '../services/member-service.js';
import { saveSection } from './save-bar.js';
import { requestRender } from '../state/render-bus.js';
import { buildDuesKey, store } from '../state/store.js';
import {
  buildMoreOption,
  copyToClipboard,
  escapeHtml,
  flashButtonLabel,
  qs,
  qsa,
  setVisible,
} from '../utils/dom.js';
import { formatCurrency, formatMonthLabel, parseAmount } from '../utils/format.js';

/** Lớp CSS tô màu cho ô trạng thái. */
const STATUS_CLASS = {
  [DUES_STATUS.PAID]: 'status-select--paid',
  [DUES_STATUS.UNPAID]: 'status-select--unpaid',
  [DUES_STATUS.SKIPPED]: 'status-select--skipped',
};

/** Tháng đang xem, giữ lại khi mở rộng danh sách tháng. */
let lastMonthKey = '';

/* ---------- Xử lý sự kiện ---------- */

/** Đổi số tiền đóng quỹ rồi vẽ lại các vùng liên quan. */
function handleSetPaid(monthKey, memberName, amount) {
  setPaidAmount(monthKey, memberName, amount);
  aggregateMembers();
  requestRender('months', 'members');
}

/** Đổi trạng thái đóng quỹ rồi vẽ lại các vùng liên quan. */
function handleSetStatus(monthKey, memberName, status) {
  setDuesStatus(monthKey, memberName, status);
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

/** Nội dung tháng đang xem, dùng cho cả lưu thẳng lẫn dán tay. */
function buildMonthPayload(monthKey) {
  const members = getMonthMembers(monthKey).map((member) => {
    const entry = {
      name: member.name,
      paid: getEffectivePaid(monthKey, member),
      note: getEffectiveNote(monthKey, member),
    };
    if (getEffectiveSkip(monthKey, member)) entry.skip = true;
    return entry;
  });
  return {
    month: {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      total: members.reduce((sum, item) => sum + item.paid, 0),
      members,
    },
  };
}

/** Lưu tháng đang xem lên dữ liệu chung. */
function handleSaveMonth() {
  const monthKey = getSelectedMonthKey();
  return saveSection({
    buttonSelector: '#month-export-toggle',
    statusSelector: '#month-pending-state',
    section: 'month',
    monthKey,
    buildPayload: () => buildMonthPayload(monthKey),
    showManualBlock: handleExport,
  });
}

/** Hiện khối JSON của tháng đang xem để dán tay. */
async function handleExport() {
  const monthKey = getSelectedMonthKey();
  const isVirtual = isVirtualMonth(monthKey);
  const members = getMonthMembers(monthKey);

  const entries = members.map((member) => {
    const skipField = getEffectiveSkip(monthKey, member) ? ', "skip": true' : '';
    return (
      `     { "name": ${JSON.stringify(member.name)}, "paid": ${getEffectivePaid(monthKey, member)}, ` +
      `"note": ${JSON.stringify(getEffectiveNote(monthKey, member))}${skipField} }`
    );
  });
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

/** Chọn "Xem thêm" thì mở đầy đủ danh sách tháng và giữ nguyên tháng đang xem. */
function handleMonthPickerChange() {
  setVisible(qs('#month-export'), false);
  if (qs('#month-picker').value !== MONTH_OPTION_MORE) {
    renderMonths();
    return;
  }
  store.showAllDuesMonths = true;
  qs('#month-picker').value = lastMonthKey;
  renderMonthPicker();
  renderMonths();
}

/* ---------- Vẽ giao diện ---------- */

/** Dựng lại ô chọn tháng, gồm cả các tháng tự tạo. */
export function renderMonthPicker() {
  const kept = qs('#month-picker').value;
  const activeCount = getActiveMemberNames().length;

  // Mặc định chỉ hiện 5 tháng gần nhất cho gọn; tháng tự tạo luôn giữ lại.
  const hiddenCount = store.showAllDuesMonths ? 0 : Math.max(0, store.months.length - MONTH_OPTION_LIMIT);
  const shownMonths = store.months.slice(hiddenCount);

  qs('#month-picker').innerHTML =
    buildMoreOption(hiddenCount, MONTH_OPTION_MORE) +
    shownMonths
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
  const fallback = store.months[store.months.length - 1]?.month ?? getFutureMonthKeys()[0] ?? '';
  qs('#month-picker').value = options.includes(kept) ? kept : fallback;
}

/** Vẽ lại toàn bộ trang Đóng quỹ theo tháng. */
export function renderMonths() {
  const monthKey = getSelectedMonthKey();
  lastMonthKey = monthKey;
  const isVirtual = isVirtualMonth(monthKey);

  const rows = getMonthMembers(monthKey).map((member) => ({
    ...member,
    amount: getEffectivePaid(monthKey, member),
    note: getEffectiveNote(monthKey, member),
    status: getDuesStatus(monthKey, member),
    isNewRow: Boolean(member.added) && !isVirtual,
    isEdited: hasOverride(monthKey, member.name) || (Boolean(member.added) && !isVirtual),
  }));

  const paidRows = rows.filter((row) => row.status === DUES_STATUS.PAID);
  const skippedRows = rows.filter((row) => row.status === DUES_STATUS.SKIPPED);
  const expectedCount = rows.length - skippedRows.length;
  const collected = rows.reduce((sum, row) => sum + row.amount, 0);
  const unpaidCount = expectedCount - paidRows.length;
  qs('#month-collected').textContent = formatCurrency(collected);
  qs('#month-paid-count').textContent = `${paidRows.length}/${expectedCount}`;
  qs('#month-paid-note').textContent = skippedRows.length
    ? `${skippedRows.length} người không chơi tháng này`
    : '';
  qs('#month-unpaid-count').textContent = `${unpaidCount} người`;
  qs('#month-unpaid-count').style.color = unpaidCount ? 'var(--crit)' : 'var(--good)';

  qs('#month-subtitle').textContent =
    `${formatMonthLabel(monthKey)} · ${rows.length} thành viên` +
    (store.isAdmin ? ' · chọn ở cột Trạng thái để đánh dấu' : '');
  qs('#month-note-hint').textContent = store.isAdmin ? '(sửa được)' : '';

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
      const isPaid = row.status === DUES_STATUS.PAID;
      const isSkipped = row.status === DUES_STATUS.SKIPPED;
      const statusOptions = Object.values(DUES_STATUS)
        .map(
          (value) =>
            `<option value="${value}" ${value === row.status ? 'selected' : ''}>${DUES_STATUS_LABELS[value]}</option>`,
        )
        .join('');
      return `<tr class="${row.isEdited ? 'row--edited' : ''} ${row.isNewRow ? 'row--added' : ''}">
        <td class="cell-num" style="color:var(--text-3)">${index + 1}</td>
        <td class="cell-name">${escapeHtml(row.name)}</td>
        <td class="cell-num">
          <input type="text" inputmode="numeric" class="amount-input ${isPaid ? 'amount-input--filled' : ''}"
            value="${isSkipped ? '—' : isPaid ? formatCurrency(row.amount) : '0 đ'}" placeholder="0 đ"
            ${store.isAdmin && !isSkipped ? '' : 'disabled'}
            data-name="${escapeHtml(row.name)}" data-raw="${row.amount}"
            aria-label="Số tiền ${escapeHtml(row.name)} đóng">
        </td>
        <td>
          <select class="status-select ${STATUS_CLASS[row.status]}"
            data-name="${escapeHtml(row.name)}" ${store.isAdmin ? '' : 'disabled'}
            aria-label="Trạng thái đóng quỹ ${escapeHtml(row.name)}">
            ${statusOptions}
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
    select.addEventListener('change', () => handleSetStatus(monthKey, select.dataset.name, select.value));
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
  qs('#month-picker').addEventListener('change', handleMonthPickerChange);
  qs('#month-fill').addEventListener('click', handleFillMonth);
  qs('#month-export-toggle').addEventListener('click', handleSaveMonth);
  qs('#month-reset').addEventListener('click', handleResetMonth);
}

/* ---------- Hàm phụ trợ ---------- */

/** Tháng đang được chọn trong ô lọc. */
function getSelectedMonthKey() {
  return qs('#month-picker').value || store.months[store.months.length - 1]?.month || '';
}

/** Một dòng có ghi đè số tiền, ghi chú hay trạng thái không chơi hay không. */
function hasOverride(monthKey, memberName) {
  const key = buildDuesKey(monthKey, memberName);
  return key in store.duesPaidOverrides || key in store.duesNoteOverrides || key in store.duesSkipOverrides;
}
