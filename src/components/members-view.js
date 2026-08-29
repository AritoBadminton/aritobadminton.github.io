/** Trang Thành viên: thống kê đóng góp và phân loại đang / ngừng hoạt động. */

import {
  aggregateMembers,
  countUnpaidActive,
  getChangedActiveNames,
  resetActiveMembers,
  setMemberActive,
} from '../services/member-service.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { copyToClipboard, escapeHtml, flashButtonLabel, qs, qsa, setVisible } from '../utils/dom.js';
import { formatCurrency, formatMonthLabel } from '../utils/format.js';

/** Bộ lọc trạng thái hiện tại: 'all' | 'active' | 'inactive'. */
let statusFilter = 'all';

/** Các cách sắp xếp danh sách thành viên. */
const SORT_COMPARATORS = {
  total: (a, b) => b.total - a.total,
  rate: (a, b) => b.paidMonths / b.months - a.paidMonths / a.months,
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

/** Xuất khối "roster" để dán vào data.json. */
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

/** Vẽ lại trang Thành viên. */
export function renderMembers() {
  const lastMonthKey = store.months[store.months.length - 1].month;
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

  qs('#members-table').innerHTML = rows.length
    ? rows
        .map((member, index) => {
          const rate = member.paidMonths / member.months;
          const isActive = Boolean(store.activeMembers[member.name]);
          return `<tr class="${isActive ? '' : 'row--inactive'}">
        <td style="text-align:center">
          <input type="checkbox" class="checkbox-input js-member-active" data-name="${escapeHtml(member.name)}"
            ${isActive ? 'checked' : ''} ${store.isAdmin ? '' : 'disabled'}
            aria-label="Đánh dấu ${escapeHtml(member.name)} còn hoạt động">
        </td>
        <td class="cell-num" style="color:var(--text-3)">${index + 1}</td>
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
        <td>${formatMonthLabel(member.lastMonth)}
          ${member.lastPaid > 0 ? '<span class="pill pill--paid">đã đóng</span>' : '<span class="pill pill--unpaid">chưa</span>'}
        </td>
      </tr>`;
        })
        .join('')
    : '<tr><td colspan="8" class="table-empty text-muted">Không có thành viên nào khớp bộ lọc</td></tr>';

  qsa('#members-table .js-member-active').forEach((checkbox) => {
    checkbox.addEventListener('change', () => handleToggleActive(checkbox.dataset.name, checkbox.checked));
  });

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
  ['#members-keyword', '#members-sort'].forEach((selector) => {
    qs(selector).addEventListener('input', renderMembers);
  });

  qsa('#members-status-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#members-status-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      statusFilter = button.dataset.status;
      renderMembers();
    });
  });

  qs('#members-export-toggle').addEventListener('click', handleExport);
  qs('#members-reset').addEventListener('click', handleReset);
}

export { aggregateMembers };
