/** Trang Tổng quan: ô số liệu, khối quy định, mã QR và giao dịch gần đây. */

import { RECENT_TRANSACTION_COUNT } from '../config/constants.js';
import { getAllExpenses, getAllIncomes } from '../services/ledger-service.js';
import { store } from '../state/store.js';
import { escapeHtml, qs } from '../utils/dom.js';
import { formatCurrency, formatDateLabel, formatMonthLabel } from '../utils/format.js';

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>`;
const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.9 9.9 0 01-4.2-.9L3 20.5l1.5-4.4A8.4 8.4 0 1121 11.5z"/></svg>`;

/** Khối quy định đóng quỹ, ưu tiên dữ liệu có cấu trúc trong data.json. */
function renderRules() {
  const rules = store.data.rules;
  const items = rules?.items?.length ? rules.items : null;

  const body = items
    ? `<div class="rules-panel__grid">${items
        .map(
          (item) => `
        <div class="rule-item">
          <span class="rule-item__amount">${escapeHtml(item.amount)}</span>
          <span class="rule-item__text">
            <span class="rule-item__who">${escapeHtml(item.who)}</span><br>
            <span class="rule-item__unit">${escapeHtml(item.unit)}</span>
          </span>
        </div>`,
        )
        .join('')}</div>`
    : `<div class="rules-panel__grid">${(store.data.notes ?? [])
        .map(
          (note) =>
            `<div class="rule-item"><span class="rule-item__text"><span class="rule-item__who">${escapeHtml(
              String(note).replace(/^(Ghi chú|Note)\s*:\s*/i, ''),
            )}</span></span></div>`,
        )
        .join('')}</div>`;

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
