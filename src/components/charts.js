/**
 * Vẽ biểu đồ bằng SVG nội tuyến — không dùng thư viện ngoài để trang tải nhanh
 * và chạy được cả khi không có mạng tới CDN.
 */

import { getAllExpenses, getAllIncomes, getMonthlyTotals } from '../services/ledger-service.js';
import { store } from '../state/store.js';
import { formatCurrency, formatMonthLabel, formatThousands, getCategoryColor } from '../utils/format.js';
import { escapeHtml, qs, qsa } from '../utils/dom.js';
import { hideTooltip, moveTooltip, showTooltip } from './tooltip.js';

const AXIS_STEPS = 4;

let visibleMonthCount = 12;

/**
 * Làm tròn giá trị lớn nhất lên mốc đẹp để chia trục.
 * @param {number} value
 * @returns {number}
 */
function roundUpToNiceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return (Math.ceil((value / magnitude) * 2) / 2) * magnitude;
}

/**
 * Thẻ mở của một khung SVG.
 * @param {number} width
 * @param {number} height
 */
function openSvg(width, height) {
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">`;
}

/** Gắn chú giải cho các cột của biểu đồ thu chi. */
function bindBarTooltips(container) {
  qsa('rect[data-month]', container).forEach((bar) => {
    bar.style.cursor = 'pointer';
    bar.addEventListener('mouseenter', (event) => {
      const income = Number(bar.dataset.income);
      const expense = Number(bar.dataset.expense);
      const net = income - expense;
      showTooltip(
        event,
        `<b>${escapeHtml(bar.dataset.month)}</b>
         <div><span>Thu</span><span>${formatCurrency(income)}</span></div>
         <div><span>Chi</span><span>${formatCurrency(expense)}</span></div>
         <div style="border-top:1px solid var(--border);margin-top:5px;padding-top:5px">
           <span>Chênh lệch</span>
           <span style="color:${net >= 0 ? 'var(--good)' : 'var(--crit)'}">
             ${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}
           </span>
         </div>`,
      );
    });
    bar.addEventListener('mousemove', moveTooltip);
    bar.addEventListener('mouseleave', hideTooltip);
  });
}

/** Biểu đồ cột kép thu và chi theo tháng. */
function drawMonthlyBars() {
  let data = getMonthlyTotals();
  if (visibleMonthCount > 0) data = data.slice(-visibleMonthCount);

  const width = 980;
  const height = 300;
  const marginLeft = 52;
  const marginRight = 8;
  const marginTop = 12;
  const marginBottom = 42;
  const innerWidth = width - marginLeft - marginRight;
  const innerHeight = height - marginTop - marginBottom;

  const maxValue = roundUpToNiceMax(Math.max(...data.map((d) => Math.max(d.thu, d.chi))));
  const slotWidth = innerWidth / data.length;
  const gap = Math.min(10, slotWidth * 0.16);
  const barWidth = (slotWidth - gap * 2) / 2 - 1.5;

  let markup = openSvg(width, height);
  for (let step = 0; step <= AXIS_STEPS; step += 1) {
    const y = marginTop + innerHeight - (innerHeight * step) / AXIS_STEPS;
    markup += `<line class="${step ? 'chart__grid-line' : 'chart__zero-line'}" x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}"/>`;
    markup += `<text class="chart__axis-label" x="${marginLeft - 8}" y="${y + 4}" text-anchor="end">${formatThousands((maxValue * step) / AXIS_STEPS)}</text>`;
  }

  data.forEach((point, index) => {
    const slotX = marginLeft + slotWidth * index + gap;
    [
      ['thu', 'var(--series-1)', 0],
      ['chi', 'var(--series-2)', barWidth + 3],
    ].forEach(([key, color, offset]) => {
      const barHeight = Math.max((point[key] / maxValue) * innerHeight, point[key] > 0 ? 2 : 0);
      if (barHeight <= 0) return;
      markup += `<rect x="${slotX + offset}" y="${marginTop + innerHeight - barHeight}" width="${barWidth}" height="${barHeight}" rx="4" fill="${color}" data-month="${formatMonthLabel(point.month)}" data-income="${point.thu}" data-expense="${point.chi}"/>`;
    });
    const label = `${point.month.slice(5)}/${point.month.slice(2, 4)}`;
    markup += `<text class="chart__axis-label" x="${slotX + slotWidth / 2 - gap}" y="${height - marginBottom + 20}" text-anchor="middle">${label}</text>`;
  });
  markup += '</svg>';

  const container = qs('#chart-monthly');
  container.innerHTML = markup;
  bindBarTooltips(container);
}

/**
 * Danh sách tỷ trọng theo danh mục, dạng thanh ngang.
 * @param {string} selector
 * @param {object[]} transactions
 */
function drawCategoryBreakdown(selector, transactions) {
  const totals = {};
  transactions.forEach((item) => {
    totals[item.cat] = (totals[item.cat] ?? 0) + item.amount;
  });
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = rows.reduce((sum, [, value]) => sum + value, 0);

  qs(selector).innerHTML =
    rows
      .map(
        ([category, value]) => `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px">
          <span style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text)">
            <i class="color-dot" style="background:${getCategoryColor(category)}"></i>${escapeHtml(category)}
          </span>
          <span style="font-size:13.5px;font-variant-numeric:tabular-nums;color:var(--text-2)">
            <b style="color:var(--text)">${formatCurrency(value)}</b> · ${((value / grandTotal) * 100).toFixed(1)}%
          </span>
        </div>
        <div class="progress-bar" style="height:8px">
          <i class="progress-bar__fill" style="width:${(value / grandTotal) * 100}%;background:${getCategoryColor(category)}"></i>
        </div>
      </div>`,
      )
      .join('') +
    `<div class="text-muted" style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between">
       <span>Tổng cộng</span><b style="color:var(--text)">${formatCurrency(grandTotal)}</b>
     </div>`;
}

/** Đường diễn biến số dư luỹ kế. */
function drawBalanceLine() {
  let running = 0;
  const points = getMonthlyTotals().map((item) => {
    running += item.thu - item.chi;
    return { month: item.month, value: running };
  });

  const width = 980;
  const height = 250;
  const marginLeft = 56;
  const marginRight = 10;
  const marginTop = 14;
  const marginBottom = 40;
  const innerWidth = width - marginLeft - marginRight;
  const innerHeight = height - marginTop - marginBottom;

  const maxValue = roundUpToNiceMax(Math.max(...points.map((p) => p.value), 0));
  const minValue = Math.min(0, ...points.map((p) => p.value));
  const toY = (value) => marginTop + innerHeight - ((value - minValue) / (maxValue - minValue)) * innerHeight;
  const toX = (index) =>
    marginLeft + (points.length > 1 ? (innerWidth * index) / (points.length - 1) : innerWidth / 2);

  let markup = openSvg(width, height);
  for (let step = 0; step <= AXIS_STEPS; step += 1) {
    const value = minValue + ((maxValue - minValue) * step) / AXIS_STEPS;
    const y = toY(value);
    markup += `<line class="${value === 0 ? 'chart__zero-line' : 'chart__grid-line'}" x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}"/>`;
    markup += `<text class="chart__axis-label" x="${marginLeft - 8}" y="${y + 4}" text-anchor="end">${formatThousands(value)}</text>`;
  }

  const linePath = points
    .map((point, index) => `${index ? 'L' : 'M'}${toX(index).toFixed(1)},${toY(point.value).toFixed(1)}`)
    .join(' ');
  markup += `<path d="${linePath} L${toX(points.length - 1)},${toY(minValue)} L${toX(0)},${toY(minValue)} Z" fill="var(--series-1)" opacity=".10"/>`;
  markup += `<path d="${linePath}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  const labelEvery = Math.ceil(points.length / 12);
  points.forEach((point, index) => {
    markup += `<circle cx="${toX(index)}" cy="${toY(point.value)}" r="3.5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>`;
    markup += `<circle cx="${toX(index)}" cy="${toY(point.value)}" r="14" fill="transparent" data-month="${formatMonthLabel(point.month)}" data-balance="${point.value}"/>`;
    if (index % labelEvery === 0 || index === points.length - 1) {
      markup += `<text class="chart__axis-label" x="${toX(index)}" y="${height - marginBottom + 20}" text-anchor="middle">${point.month.slice(5)}/${point.month.slice(2, 4)}</text>`;
    }
  });

  const last = points[points.length - 1];
  const labelY = Math.max(marginTop + 13, toY(last.value) - 14);
  markup += `<text x="${toX(points.length - 1) - 8}" y="${labelY}" text-anchor="end" font-size="12.5" font-weight="620" fill="var(--text)" paint-order="stroke" stroke="var(--surface)" stroke-width="4">${formatCurrency(last.value)}</text>`;
  markup += '</svg>';

  const container = qs('#chart-balance');
  container.innerHTML = markup;
  qsa('circle[data-month]', container).forEach((dot) => {
    dot.addEventListener('mouseenter', (event) =>
      showTooltip(
        event,
        `<b>${escapeHtml(dot.dataset.month)}</b><div><span>Số dư cuối tháng</span><span>${formatCurrency(Number(dot.dataset.balance))}</span></div>`,
      ),
    );
    dot.addEventListener('mousemove', moveTooltip);
    dot.addEventListener('mouseleave', hideTooltip);
  });
}

/** Vẽ lại toàn bộ biểu đồ trên trang tổng quan. */
export function renderCharts() {
  if (!store.data) return;
  drawMonthlyBars();
  drawCategoryBreakdown('#chart-expense-categories', getAllExpenses());
  drawCategoryBreakdown('#chart-income-categories', getAllIncomes());
  drawBalanceLine();
}

/** Gắn sự kiện cho nhóm nút chọn khoảng thời gian. */
export function initCharts() {
  qsa('#chart-range-toggle .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#chart-range-toggle .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      visibleMonthCount = Number(button.dataset.range);
      renderCharts();
    });
  });
}
