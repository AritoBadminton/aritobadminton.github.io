/** Trang Thành viên: thống kê đóng góp và phân loại đang / ngừng hoạt động. */

import { MEMBER_PAGE_SIZE } from '../config/constants.js';
import { compareByOrder } from '../services/dues-service.js';
import {
  addMember,
  aggregateMembers,
  countUnpaidActive,
  getChangedActiveNames,
  getDuplicateOrders,
  getNextFreeOrder,
  getOrderOwner,
  renumberMembers,
  resetActiveMembers,
  setMemberActive,
  setMemberOrder,
} from '../services/member-service.js';
import { saveSection } from './save-bar.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { copyToClipboard, escapeHtml, flashButtonLabel, qs, qsa, setVisible } from '../utils/dom.js';
import { formatCurrency, formatMonthLabel } from '../utils/format.js';

/** Bộ lọc trạng thái hiện tại: 'all' | 'active' | 'inactive'. */
let statusFilter = 'all';

/** Trang đang xem của bảng thành viên, đếm từ 1. */
let currentPage = 1;

/** Các cách sắp xếp danh sách thành viên. */
/** Tỷ lệ đóng đủ; người chưa có tháng nào tính là 0 để không ra NaN. */
function getPaidRate(member) {
  return member.months ? member.paidMonths / member.months : 0;
}

const SORT_COMPARATORS = {
  stt: (a, b) => compareByOrder(a, b) || b.total - a.total,
  total: (a, b) => b.total - a.total,
  rate: (a, b) => getPaidRate(b) - getPaidRate(a),
  months: (a, b) => b.months - a.months,
  name: (a, b) => a.name.localeCompare(b.name, 'vi'),
};

/** Màu thanh tỷ lệ theo mức độ đóng đủ. */
function getRateColor(rate) {
  if (rate >= 0.8) return 'var(--good)';
  if (rate >= 0.5) return 'var(--warn)';
  return 'var(--crit)';
}

/** Đổi trạng thái hoạt động của một thành viên. */
function handleToggleActive(name, isActive) {
  setMemberActive(name, isActive);
  requestRender('members');
}

/** Mở hoặc đóng ô nhập thành viên mới. */
function toggleAddForm(open) {
  setVisible(qs('#members-add-form'), open, 'flex');
  qs('#members-add-error').textContent = '';
  if (!open) return;

  qs('#members-add-name').value = '';
  qs('#members-add-order').value = '';
  // Gợi ý số kế tiếp còn trống, và cũng là số dùng luôn nếu để trống ô này.
  qs('#members-add-order').placeholder = String(getNextFreeOrder());
  qs('#members-add-name').focus();
}

/**
 * Đọc ô STT của form thêm mới.
 * @returns {{order: number|null, error?: string}} order null nghĩa là để hệ thống tự chọn
 */
function readNewMemberOrder() {
  const text = qs('#members-add-order').value.trim();
  if (text === '') return { order: null };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 1) return { order: null, error: 'STT phải là số từ 1 trở lên.' };
  return { order: Math.round(value) };
}

/** Nhắc ngay khi số thứ tự vừa gõ đã có người giữ; nhắc thôi chứ không chặn. */
function checkNewMemberOrder() {
  const { order, error } = readNewMemberOrder();
  const message = qs('#members-add-error');

  if (error) {
    message.textContent = error;
    message.style.color = 'var(--crit)';
    return;
  }
  const owner = order === null ? '' : getOrderOwner(order);
  message.textContent = owner ? `Số ${order} đang là của ${owner} — thêm xong sẽ báo trùng.` : '';
  message.style.color = 'var(--warn)';
}

/** Thêm thành viên mới rồi vẽ lại các bảng liên quan. */
async function handleAddMember() {
  const { order, error } = readNewMemberOrder();
  if (error) {
    qs('#members-add-error').textContent = error;
    qs('#members-add-error').style.color = 'var(--crit)';
    qs('#members-add-order').select();
    return;
  }

  const button = qs('#members-add-submit');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang thêm…';

  const result = await addMember(qs('#members-add-name').value, order);

  button.disabled = false;
  button.textContent = label;

  if (!result.ok) {
    qs('#members-add-error').textContent = result.error ?? 'Không thêm được.';
    qs('#members-add-error').style.color = 'var(--crit)';
    qs('#members-add-name').select();
    return;
  }
  toggleAddForm(false);
  aggregateMembers();
  requestRender('members', 'months');
}

/** Đặt số thứ tự cho một thành viên; ô trống nghĩa là bỏ số. */
function handleSetOrder(name, rawValue) {
  const text = rawValue.trim();
  const value = text === '' ? null : Number(text);
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    requestRender('members');
    return;
  }
  setMemberOrder(name, value === null ? null : Math.round(value));
  requestRender('members', 'months');
}

/**
 * Đánh lại số thứ tự 1→N cho toàn bộ danh sách theo thứ tự đang sắp xếp.
 *
 * Cố ý lấy cả store.members chứ không lấy danh sách đang lọc: số thứ tự dùng
 * chung cho cả ba mục, đánh lại chỉ một phần thì lại sinh ra trùng số.
 */
async function handleRenumber() {
  const names = [...store.members]
    .sort(SORT_COMPARATORS[qs('#members-sort').value])
    .map((member) => member.name);
  const message =
    `Đánh số lại 1→${names.length} cho toàn bộ thành viên theo thứ tự đang hiện?\n\n` +
    `Số thứ tự cũ sẽ bị ghi đè. Người đầu danh sách là ${names[0]}, cuối là ${names.at(-1)}.`;
  if (!names.length || !window.confirm(message)) return;

  const button = qs('#members-renumber');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang đánh số…';
  try {
    await renumberMembers(names);
    requestRender('members', 'months');
  } catch (error) {
    window.alert(`Không đánh số lại được: ${error?.message ?? error}`);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/** Danh sách thành viên hiện tại, dùng cho cả lưu thẳng lẫn dán tay. */
function buildRosterPayload() {
  return {
    roster: [...store.members]
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((member) => ({ name: member.name, active: Boolean(store.activeMembers[member.name]) })),
  };
}

/** Lưu danh sách thành viên lên dữ liệu chung. */
function handleSave() {
  return saveSection({
    buttonSelector: '#members-export-toggle',
    statusSelector: '#members-pending-state',
    section: 'roster',
    buildPayload: buildRosterPayload,
    showManualBlock: handleExport,
  });
}

/** Hiện khối "roster" để dán tay vào data.json. */
async function handleExport() {
  const entries = [...store.members]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map(
      (member) =>
        `  { "name": ${JSON.stringify(member.name)}, "active": ${Boolean(store.activeMembers[member.name])} }`,
    );
  const block = `"roster": [\n${entries.join(',\n')}\n ],`;

  qs('#members-export-code').textContent = block;
  setVisible(qs('#members-export'), true);
  await copyToClipboard(block);
  flashButtonLabel(qs('#members-export-toggle'));
  qs('#members-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Trả trạng thái hoạt động về đúng như data.json. */
function handleReset() {
  resetActiveMembers();
  setVisible(qs('#members-export'), false);
  requestRender('members');
}

/** Chuyển trang bảng thành viên. */
function handleChangePage(step) {
  currentPage += step;
  renderMembers();
}

/**
 * Cập nhật thanh phân trang dưới bảng thành viên.
 * @param {number} totalRows tổng số dòng sau khi lọc
 * @param {number} pageCount tổng số trang
 * @param {number} pageStart vị trí dòng đầu của trang hiện tại
 * @param {number} pageRowCount số dòng đang hiện
 */
function renderPager(totalRows, pageCount, pageStart, pageRowCount) {
  setVisible(qs('#members-pager'), pageCount > 1, 'flex');
  qs('#members-pager-status').textContent = totalRows
    ? `${pageStart + 1}–${pageStart + pageRowCount} trên ${totalRows} người · trang ${currentPage}/${pageCount}`
    : '';
  qs('#members-prev').disabled = currentPage <= 1;
  qs('#members-next').disabled = currentPage >= pageCount;
}

/**
 * Nhắc khi có người trùng số thứ tự, kể cả khi họ nằm ở mục lọc khác.
 * @param {Record<string, string[]>} clashes
 */
function renderClashBar(clashes) {
  const names = Object.keys(clashes);
  setVisible(qs('#members-clash'), names.length > 0 && store.isAdmin, 'flex');
  if (!names.length) return;

  const groups = [
    ...new Set(
      names.map((name) => [name, ...clashes[name]].sort((a, b) => a.localeCompare(b, 'vi')).join(' và ')),
    ),
  ];
  qs('#members-clash-text').textContent =
    `Đang có ${groups.length} số thứ tự bị hai người dùng chung: ${groups.join('; ')}. ` +
    'Số thứ tự dùng chung cho cả ba mục lọc nên mỗi người cần một số riêng.';
}

/**
 * Bật/tắt nút "Đánh số lại".
 *
 * Chỉ cho bấm ở mục Tất cả và khi không tìm kiếm, vì nút đánh lại cả danh sách
 * chứ không riêng phần đang hiện.
 * @param {string} keyword từ khoá đang tìm
 */
function renderRenumberButton(keyword) {
  const button = qs('#members-renumber');
  setVisible(button, store.isAdmin, 'inline-block');
  if (!store.isAdmin) return;

  const blocked = statusFilter !== 'all' ? 'filter' : keyword ? 'keyword' : '';
  button.disabled = Boolean(blocked) || store.members.length === 0;
  button.style.opacity = button.disabled ? '0.45' : '1';
  button.title =
    blocked === 'filter'
      ? 'Chuyển về mục "Tất cả" đã — số thứ tự dùng chung nên phải đánh lại cả danh sách.'
      : blocked === 'keyword'
        ? 'Xoá ô tìm kiếm đã — nút này đánh lại cho toàn bộ danh sách.'
        : `Đánh lại 1→${store.members.length} theo thứ tự đang sắp xếp`;
}

/** Vẽ lại trang Thành viên. */
export function renderMembers() {
  const lastMonthKey = store.months[store.months.length - 1]?.month ?? '';
  const keyword = qs('#members-keyword').value.trim().toLowerCase();
  const sortKey = qs('#members-sort').value;

  const rows = store.members
    .filter((member) => {
      const matchesKeyword = !keyword || member.name.toLowerCase().includes(keyword);
      const isActive = Boolean(store.activeMembers[member.name]);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive);
      return matchesKeyword && matchesStatus;
    })
    .sort(SORT_COMPARATORS[sortKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / MEMBER_PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount);
  const pageStart = (currentPage - 1) * MEMBER_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + MEMBER_PAGE_SIZE);

  const activeMembers = store.members.filter((member) => store.activeMembers[member.name]);
  const inactiveCount = store.members.length - activeMembers.length;
  const activeDues = activeMembers.reduce((sum, member) => sum + member.total, 0);
  const totalDues = store.members.reduce((sum, member) => sum + member.total, 0);
  const unpaidCount = countUnpaidActive(lastMonthKey);

  qs('#members-active').textContent = `${activeMembers.length} người`;
  qs('#members-active-note').textContent = `trên tổng ${store.members.length} người từng tham gia`;
  qs('#members-inactive').textContent = `${inactiveCount} người`;
  qs('#members-dues').textContent = formatCurrency(totalDues);
  qs('#members-dues-note').textContent = `Nhóm đang hoạt động: ${formatCurrency(activeDues)}`;
  qs('#members-unpaid').textContent = `${unpaidCount} người`;
  qs('#members-unpaid').style.color = unpaidCount ? 'var(--crit)' : 'var(--good)';
  qs('#members-unpaid-note').textContent = `trong nhóm đang hoạt động · ${formatMonthLabel(lastMonthKey)}`;

  // Số thứ tự là của riêng từng người và dùng chung cho cả ba mục lọc, nên ô
  // trống để trống hẳn — gợi ý theo vị trí trong danh sách đang lọc sẽ khiến
  // người dùng gõ trúng số của người đang bị lọc ra ngoài.
  const clashes = getDuplicateOrders();

  qs('#members-table').innerHTML = pageRows.length
    ? pageRows
        .map((member) => {
          const rate = getPaidRate(member);
          const isActive = Boolean(store.activeMembers[member.name]);
          const clash = clashes[member.name];
          const orderLabel = clash
            ? `Số ${store.memberOrder[member.name]} đang trùng với ${clash.join(', ')}`
            : `Số thứ tự của ${member.name}`;
          return `<tr class="${isActive ? '' : 'row--inactive'}">
        <td style="text-align:center">
          <input type="checkbox" class="checkbox-input js-member-active" data-name="${escapeHtml(member.name)}"
            ${isActive ? 'checked' : ''} ${store.isAdmin ? '' : 'disabled'}
            aria-label="Đánh dấu ${escapeHtml(member.name)} còn hoạt động">
        </td>
        <td class="cell-num">
          <input type="text" inputmode="numeric" class="stt-input js-member-order${clash ? ' stt-input--clash' : ''}"
            value="${store.memberOrder[member.name] ?? ''}" placeholder="—"
            ${store.isAdmin ? '' : 'disabled'} data-name="${escapeHtml(member.name)}"
            title="${escapeHtml(orderLabel)}" aria-label="${escapeHtml(orderLabel)}">
        </td>
        <td class="cell-name">${escapeHtml(member.name)}</td>
        <td class="cell-num" style="color:var(--text);font-weight:550">${formatCurrency(member.total)}</td>
        <td class="cell-num">${member.months}</td>
        <td class="cell-num">${member.paidMonths}/${member.months}</td>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            <div class="progress-bar" style="flex:1">
              <i class="progress-bar__fill" style="width:${rate * 100}%;background:${getRateColor(rate)}"></i>
            </div>
            <span style="font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums">${Math.round(rate * 100)}%</span>
          </div>
        </td>
        <td>${
          member.lastMonth
            ? `${formatMonthLabel(member.lastMonth)}
          ${member.lastPaid > 0 ? '<span class="pill pill--paid">đã đóng</span>' : '<span class="pill pill--unpaid">chưa</span>'}`
            : '<span class="text-muted">Chưa có tháng nào</span>'
        }</td>
      </tr>`;
        })
        .join('')
    : '<tr><td colspan="8" class="table-empty text-muted">Không có thành viên nào khớp bộ lọc</td></tr>';

  qsa('#members-table .js-member-active').forEach((checkbox) => {
    checkbox.addEventListener('change', () => handleToggleActive(checkbox.dataset.name, checkbox.checked));
  });

  qsa('#members-table .js-member-order').forEach((input) => {
    input.addEventListener('blur', () => {
      const current = String(store.memberOrder[input.dataset.name] ?? '');
      if (input.value.trim() !== current) handleSetOrder(input.dataset.name, input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
  });

  setVisible(qs('#members-add-toggle'), store.isAdmin, 'inline-block');
  if (!store.isAdmin) setVisible(qs('#members-add-form'), false);

  renderClashBar(clashes);
  renderRenumberButton(keyword);

  renderPager(rows.length, pageCount, pageStart, pageRows.length);

  const changed = getChangedActiveNames();
  qs('#members-pending-state').textContent = changed.length
    ? `Đang có ${changed.length} thay đổi chưa lưu chung: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? '…' : ''}`
    : 'Chưa thay đổi gì so với dữ liệu chung.';
  qs('#members-export-toggle').disabled = changed.length === 0;
  qs('#members-export-toggle').style.opacity = changed.length ? '1' : '0.45';
  setVisible(qs('#members-reset'), changed.length > 0, 'inline-block');
}

/** Gắn sự kiện cho trang Thành viên. */
export function initMembersView() {
  qs('#members-add-toggle').addEventListener('click', () => {
    toggleAddForm(qs('#members-add-form').style.display === 'none');
  });
  qs('#members-add-cancel').addEventListener('click', () => toggleAddForm(false));
  qs('#members-add-submit').addEventListener('click', handleAddMember);
  ['#members-add-name', '#members-add-order'].forEach((selector) => {
    qs(selector).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handleAddMember();
      if (event.key === 'Escape') toggleAddForm(false);
    });
  });
  qs('#members-add-order').addEventListener('input', checkNewMemberOrder);

  ['#members-keyword', '#members-sort'].forEach((selector) => {
    qs(selector).addEventListener('input', () => {
      currentPage = 1;
      renderMembers();
    });
  });

  qs('#members-prev').addEventListener('click', () => handleChangePage(-1));
  qs('#members-next').addEventListener('click', () => handleChangePage(1));

  qsa('#members-status-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#members-status-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      statusFilter = button.dataset.status;
      currentPage = 1;
      renderMembers();
    });
  });

  qs('#members-renumber').addEventListener('click', handleRenumber);
  qs('#members-export-toggle').addEventListener('click', handleSave);
  qs('#members-reset').addEventListener('click', handleReset);
}

export { aggregateMembers };
