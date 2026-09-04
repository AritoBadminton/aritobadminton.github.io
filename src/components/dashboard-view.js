/** Trang Tổng quan: ô số liệu, khối quy định, mã QR và giao dịch gần đây. */

import { RECENT_TRANSACTION_COUNT } from '../config/constants.js';
import { getAllExpenses, getAllIncomes } from '../services/ledger-service.js';
import {
  addRuleItem,
  buildRulesJson,
  getEffectiveRuleItems,
  hasRuleChanges,
  removeRuleItem,
  resetRuleItems,
  setRuleField,
} from '../services/rules-service.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { copyToClipboard, escapeHtml, flashButtonLabel, qs, qsa, setVisible } from '../utils/dom.js';
import { formatCurrency, formatDateLabel, formatMonthLabel } from '../utils/format.js';

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.9 9.9 0 01-4.2-.9L3 20.5l1.5-4.4A8.4 8.4 0 1121 11.5z"/></svg>`;

/* ---------- Xử lý sự kiện ---------- */

/** Sửa một ô trong khối quy định rồi cập nhật thanh lưu. */
function handleEditRule(index, field, value) {
  setRuleField(index, field, value);
  renderRulesSaveBar();
}

/** Thêm một mức đóng mới rồi vẽ lại khối quy định. */
function handleAddRule() {
  addRuleItem();
  requestRender('dashboard');
}

/** Xoá một mức đóng rồi vẽ lại khối quy định. */
function handleRemoveRule(index) {
  removeRuleItem(index);
  requestRender('dashboard');
}

/** Bỏ mọi thay đổi, quay lại quy định trong data.json. */
function handleResetRules() {
  resetRuleItems();
  setVisible(qs('#rules-export'), false);
  requestRender('dashboard');
}

/** Xuất khối "rules" để dán vào data.json. */
async function handleExportRules() {
  const block = buildRulesJson();
  qs('#rules-export-code').textContent = block;
  setVisible(qs('#rules-export'), true);
  await copyToClipboard(block);
  flashButtonLabel(qs('#rules-export-toggle'));
  qs('#rules-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Vẽ giao diện ---------- */

/** Cập nhật thanh lưu chung của khối quy định. */
function renderRulesSaveBar() {
  const changed = hasRuleChanges();
  qs('#rules-pending-state').textContent = changed
    ? 'Đang có thay đổi chưa lưu chung — bấm "Lưu chung lên GitHub" để cả nhóm cùng thấy.'
    : 'Chưa thay đổi gì so với dữ liệu chung.';
  qs('#rules-export-toggle').disabled = !changed;
  qs('#rules-export-toggle').style.opacity = changed ? '1' : '0.45';
  setVisible(qs('#rules-reset'), changed, 'inline-block');
}

/** Một mức đóng ở chế độ chỉ xem. */
function buildRuleItemView(item) {
  return `
    <div class="rule-item">
      <span class="rule-item__amount">${escapeHtml(item.amount)}</span>
      <span class="rule-item__text">
        <span class="rule-item__who">${escapeHtml(item.who)}</span><br>
        <span class="rule-item__unit">${escapeHtml(item.unit)}</span>
      </span>
    </div>`;
}

/** Một mức đóng ở chế độ admin sửa được. */
function buildRuleItemEditor(item, index) {
  return `
    <div class="rule-item rule-item--editable">
      <input type="text" class="rule-item__amount rule-input js-rule-field" value="${escapeHtml(item.amount)}"
        data-index="${index}" data-field="amount" aria-label="Mức tiền của quy định ${index + 1}">
      <span class="rule-item__text">
        <input type="text" class="rule-item__who rule-input js-rule-field" value="${escapeHtml(item.who)}"
          data-index="${index}" data-field="who" aria-label="Đối tượng áp dụng của quy định ${index + 1}">
        <input type="text" class="rule-item__unit rule-input js-rule-field" value="${escapeHtml(item.unit)}"
          data-index="${index}" data-field="unit" aria-label="Đơn vị tính của quy định ${index + 1}">
      </span>
      <button class="rule-item__remove js-rule-remove" data-index="${index}" type="button"
        title="Xoá mức đóng này" aria-label="Xoá mức đóng ${index + 1}">${TRASH_ICON}</button>
    </div>`;
}

/** Khối quy định đóng quỹ; admin sửa được từng ô ngay tại chỗ. */
function renderRules() {
  const rules = store.data.rules;
  const items = getEffectiveRuleItems();

  let body;
  if (items.length || store.isAdmin) {
    const cards = store.isAdmin
      ? items.map(buildRuleItemEditor).join('') +
        `<button class="rule-item rule-item--add" id="rules-add" type="button">+ Thêm mức đóng</button>`
      : items.map(buildRuleItemView).join('');
    body = `<div class="rules-panel__grid">${cards}</div>`;
  } else {
    body = `<div class="rules-panel__grid">${(store.data.notes ?? [])
      .map(
        (note) =>
          `<div class="rule-item"><span class="rule-item__text"><span class="rule-item__who">${escapeHtml(
            String(note).replace(/^(Ghi chú|Note)\s*:\s*/i, ''),
          )}</span></span></div>`,
      )
      .join('')}</div>`;
  }

  const footer = rules?.footer
    ? `<div class="rules-panel__footer">${CHAT_ICON}<div><b>Lưu ý:</b> ${escapeHtml(rules.footer)}</div></div>`
    : '';

  qs('#rules-panel').innerHTML = `
    <div class="rules-panel__inner">
      <div class="rules-panel__header">
        <span class="rules-panel__icon">${CHECK_ICON}</span>
        <div>
          <h2 id="rules-heading">${escapeHtml(rules?.title ?? 'Quy định đóng quỹ')}</h2>
          <p class="rules-panel__subtitle">${escapeHtml(rules?.subtitle ?? 'Mức đóng áp dụng cho câu lạc bộ')}</p>
        </div>
      </div>
      ${body}${footer}
    </div>`;

  if (store.isAdmin) {
    qsa('#rules-panel .js-rule-field').forEach((input) => {
      input.addEventListener('input', () =>
        handleEditRule(Number(input.dataset.index), input.dataset.field, input.value),
      );
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    });
    qsa('#rules-panel .js-rule-remove').forEach((button) => {
      button.addEventListener('click', () => handleRemoveRule(Number(button.dataset.index)));
    });
    qs('#rules-add').addEventListener('click', handleAddRule);
  }

  renderRulesSaveBar();
}

/** Khối mã QR chuyển khoản; tự ẩn khi data.json không khai báo mục "qr". */
export function renderQrPanel() {
  const qrConfig = store.data.qr;
  const panel = qs('#qr-panel');
  if (!qrConfig?.image) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  qs('#qr-image').src = qrConfig.image;
  qs('#qr-link').href = qrConfig.image;
  qs('#qr-name').textContent = qrConfig.name ?? '';
  qs('#qr-account').textContent = qrConfig.account ?? '';
  qs('#qr-bank').textContent = qrConfig.bank ?? '';
  if (qrConfig.note) qs('#qr-note').textContent = qrConfig.note;
}

/** Vẽ lại toàn bộ trang Tổng quan. */
export function renderDashboard() {
  const incomes = getAllIncomes();
  const expenses = getAllExpenses();
  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpense;
  const monthCount = store.months.length;

  const firstDate = store.transactions.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const lastDate = store.transactions.reduce((a, b) => (a.date > b.date ? a : b)).date;

  const balanceValue = qs('#kpi-balance');
  balanceValue.textContent = formatCurrency(balance);
  balanceValue.classList.toggle('stat-tile__value--negative', balance < 0);
  qs('#kpi-balance-note').textContent = `Cập nhật ${formatDateLabel(lastDate)}`;

  qs('#kpi-income').textContent = formatCurrency(totalIncome);
  qs('#kpi-income-note').textContent =
    `${incomes.length} khoản thu · TB ${formatCurrency(totalIncome / monthCount)}/tháng`;
  qs('#kpi-expense').textContent = formatCurrency(totalExpense);
  qs('#kpi-expense-note').textContent =
    `${expenses.length} khoản chi · TB ${formatCurrency(totalExpense / monthCount)}/tháng`;

  const lastMonth = store.months[store.months.length - 1];
  qs('#kpi-members').textContent = String(lastMonth.members.length);
  qs('#kpi-members-note').textContent =
    `${formatMonthLabel(lastMonth.month)} · ${store.members.length} người từng tham gia`;

  qs('#app-subtitle').textContent = `Từ ${formatDateLabel(firstDate)} đến ${formatDateLabel(lastDate)}`;
  qs('#footer-updated').textContent = `Cập nhật lần cuối: ${formatDateLabel(lastDate)}`;

  const recent = [...store.transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, RECENT_TRANSACTION_COUNT);
  qs('#recent-table').innerHTML = recent
    .map(
      (item) => `<tr>
        <td>${formatDateLabel(item.date)}</td>
        <td><span class="pill ${item.type === 'thu' ? 'pill--income' : 'pill--expense'}">${item.type === 'thu' ? 'Thu' : 'Chi'}</span></td>
        <td class="cell-name">${escapeHtml(item.desc)}</td>
        <td>${escapeHtml(item.cat)}</td>
        <td class="cell-num" style="color:${item.type === 'thu' ? 'var(--good)' : 'var(--crit)'}">
          ${item.type === 'thu' ? '+' : '−'}${formatCurrency(item.amount)}
        </td>
      </tr>`,
    )
    .join('');

  renderRules();
  renderQrPanel();
}

/** Gắn sự kiện cho các nút lưu chung của khối quy định. */
export function initDashboardView() {
  qs('#rules-export-toggle').addEventListener('click', handleExportRules);
  qs('#rules-reset').addEventListener('click', handleResetRules);
}
