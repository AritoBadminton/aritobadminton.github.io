/** Trang Tổng quan: ô số liệu, khối quy định, địa chỉ CLB và giao dịch gần đây. */

import { RECENT_TRANSACTION_COUNT } from '../config/constants.js';
import {
  buildAddressJson,
  getEffectiveAddress,
  hasAddressChanges,
  resetAddress,
  setAddressField,
} from '../services/address-service.js';
import { getDuesTotal } from '../services/dues-service.js';
import { getAllExpenses, getAllIncomes, getFundBalance, isDuesEntry } from '../services/ledger-service.js';
import {
  addRuleItem,
  buildRulesJson,
  getEffectiveRuleItems,
  hasRuleChanges,
  removeRuleItem,
  resetRuleItems,
  setRuleField,
} from '../services/rules-service.js';
import { saveSection } from './save-bar.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { copyToClipboard, escapeHtml, qs, qsa, setVisible } from '../utils/dom.js';
import { formatCurrency, formatDateLabel, formatNoteHtml } from '../utils/format.js';

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.9 9.9 0 01-4.2-.9L3 20.5l1.5-4.4A8.4 8.4 0 1121 11.5z"/></svg>`;
const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

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

/** Hiện khối "rules" để dán tay vào data.json. */
async function showRulesManualBlock() {
  const block = buildRulesJson();
  qs('#rules-export-code').textContent = block;
  setVisible(qs('#rules-export'), true);
  await copyToClipboard(block);
  qs('#rules-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Lưu quy định lên dữ liệu chung. */
function handleSaveRules() {
  return saveSection({
    buttonSelector: '#rules-export-toggle',
    statusSelector: '#rules-pending-state',
    section: 'rules',
    buildPayload: () => ({ items: getEffectiveRuleItems() }),
    showManualBlock: showRulesManualBlock,
  });
}

/** Sửa một ô của địa chỉ CLB rồi cập nhật thanh lưu. */
function handleEditAddress(field, value) {
  setAddressField(field, value);
  renderAddressSaveBar();
}

/** Bỏ mọi thay đổi, quay lại địa chỉ trong data.json. */
function handleResetAddress() {
  resetAddress();
  setVisible(qs('#address-export'), false);
  requestRender('dashboard');
}

/** Hiện khối "address"/"mapLink" để dán tay vào data.json. */
async function showAddressManualBlock() {
  const block = buildAddressJson();
  qs('#address-export-code').textContent = block;
  setVisible(qs('#address-export'), true);
  await copyToClipboard(block);
  qs('#address-export').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Lưu địa chỉ lên dữ liệu chung. */
function handleSaveAddress() {
  return saveSection({
    buttonSelector: '#address-export-toggle',
    statusSelector: '#address-pending-state',
    section: 'address',
    buildPayload: () => getEffectiveAddress(),
    showManualBlock: showAddressManualBlock,
  });
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

/** Cập nhật thanh lưu chung của địa chỉ CLB. */
function renderAddressSaveBar() {
  const changed = hasAddressChanges();
  qs('#address-pending-state').textContent = changed
    ? 'Đang có thay đổi chưa lưu chung — bấm "Lưu chung lên GitHub" để cả nhóm cùng thấy.'
    : 'Chưa thay đổi gì so với dữ liệu chung.';
  qs('#address-export-toggle').disabled = !changed;
  qs('#address-export-toggle').style.opacity = changed ? '1' : '0.45';
  setVisible(qs('#address-reset'), changed, 'inline-block');
}

/**
 * Khối địa chỉ CLB. Admin sửa được ngay tại chỗ, người xem thường chỉ thấy khi
 * đã có nội dung — như khối mã QR, tự ẩn hẳn khi chưa admin nào nhập gì.
 */
function renderAddressPanel() {
  const address = getEffectiveAddress();
  const panel = qs('#address-panel');

  if (!store.isAdmin && !address.text && !address.mapLink) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  const mapLinkHtml = address.mapLink
    ? ` — <a href="${escapeHtml(address.mapLink)}" target="_blank" rel="noopener">Xem trên Google Maps →</a>`
    : '';

  const pinSpan = (size) =>
    `<span style="display:inline-flex;flex:0 0 auto;width:${size}px;height:${size}px;color:var(--text-3)">${PIN_ICON}</span>`;

  if (!store.isAdmin) {
    panel.innerHTML = `
      <div class="card__body" style="display:flex;align-items:center;gap:10px">
        ${pinSpan(22)}
        <span>${escapeHtml(address.text)}${mapLinkHtml}</span>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="card__header" style="display:flex;align-items:center;gap:10px">
      ${pinSpan(20)}
      <div>
        <h3>Địa chỉ CLB</h3>
        <p>Chỉ admin thấy hai ô sửa dưới đây; người xem thường chỉ thấy dòng địa chỉ kèm link.</p>
      </div>
    </div>
    <div class="card__body">
      <div class="field-grid address-panel__fields">
        <label>Địa chỉ<input type="text" id="address-text-input" value="${escapeHtml(address.text)}" placeholder="Số nhà, đường, phường/xã, tỉnh/thành…"></label>
        <label>Link Google Maps<input type="url" id="address-maplink-input" value="${escapeHtml(address.mapLink)}" placeholder="https://maps.app.goo.gl/…"></label>
      </div>
      ${address.text || address.mapLink ? `<p class="text-muted mt-sm">Xem trước: ${escapeHtml(address.text)}${mapLinkHtml}</p>` : ''}
    </div>`;

  qs('#address-text-input').addEventListener('input', (event) =>
    handleEditAddress('text', event.target.value),
  );
  qs('#address-maplink-input').addEventListener('input', (event) =>
    handleEditAddress('mapLink', event.target.value),
  );

  renderAddressSaveBar();
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
          `<div class="rule-item"><span class="rule-item__text"><span class="rule-item__who">${formatNoteHtml(
            String(note).replace(/^(Ghi chú|Note)\s*:\s*/i, ''),
          )}</span></span></div>`,
      )
      .join('')}</div>`;
  }

  const footer = rules?.footer
    ? `<div class="rules-panel__footer">${CHAT_ICON}<div><b>Lưu ý:</b> ${formatNoteHtml(rules.footer)}</div></div>`
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
  // Tiền đóng quỹ lấy thẳng từ bảng Đóng quỹ theo tháng; các khoản thu cùng loại
  // gõ tay ngày xưa bị loại ra để không đếm hai lần cùng một số tiền.
  const otherIncomes = getAllIncomes().filter((item) => !isDuesEntry({ ...item, type: 'thu' }));
  const expenses = getAllExpenses();
  const duesTotal = getDuesTotal();
  const totalIncome = otherIncomes.reduce((sum, item) => sum + item.amount, 0) + duesTotal;
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  // Không giới hạn ngày — khác ô "Số dư quỹ của tháng" ở Sổ thu chi, vốn tính
  // luỹ kế đến hết tháng đang lọc (xem getFundBalanceUpTo).
  const balance = getFundBalance();
  const monthCount = store.months.length;

  const balanceValue = qs('#kpi-balance');
  balanceValue.textContent = formatCurrency(balance);
  balanceValue.classList.toggle('stat-tile__value--negative', balance < 0);

  qs('#kpi-income').textContent = formatCurrency(totalIncome);
  qs('#kpi-income-note').textContent =
    `Gồm ${formatCurrency(duesTotal)} tiền đóng quỹ · TB ${formatCurrency(totalIncome / monthCount)}/tháng`;
  qs('#kpi-expense').textContent = formatCurrency(totalExpense);
  qs('#kpi-expense-note').textContent =
    `${expenses.length} khoản chi · TB ${formatCurrency(totalExpense / monthCount)}/tháng`;

  const lastMonth = store.months[store.months.length - 1];
  qs('#kpi-members').textContent = String(lastMonth?.members.length ?? 0);

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
  renderAddressPanel();
  renderQrPanel();
}

/** Gắn sự kiện cho các nút lưu chung của khối quy định và địa chỉ CLB. */
export function initDashboardView() {
  qs('#rules-export-toggle').addEventListener('click', handleSaveRules);
  qs('#rules-reset').addEventListener('click', handleResetRules);
  qs('#address-export-toggle').addEventListener('click', handleSaveAddress);
  qs('#address-reset').addEventListener('click', handleResetAddress);
}
