/** Chú giải nổi theo con trỏ, dùng chung cho các biểu đồ. */

import { qs } from '../utils/dom.js';

let tooltipElement = null;

/** Lấy phần tử tooltip, khởi tạo ở lần gọi đầu tiên. */
function getTooltip() {
  tooltipElement ??= qs('#chart-tooltip');
  return tooltipElement;
}

/**
 * Đặt tooltip cạnh con trỏ, tự lật khi chạm mép màn hình.
 * @param {MouseEvent} event
 */
export function moveTooltip(event) {
  const tooltip = getTooltip();
  const box = tooltip.getBoundingClientRect();
  let left = event.clientX + 14;
  let top = event.clientY + 14;
  if (left + box.width > window.innerWidth - 8) left = event.clientX - box.width - 14;
  if (top + box.height > window.innerHeight - 8) top = event.clientY - box.height - 14;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Hiện tooltip với nội dung cho trước.
 * @param {MouseEvent} event
 * @param {string} html
 */
export function showTooltip(event, html) {
  const tooltip = getTooltip();
  tooltip.innerHTML = html;
  tooltip.style.opacity = '1';
  moveTooltip(event);
}

/** Ẩn tooltip. */
export function hideTooltip() {
  getTooltip().style.opacity = '0';
}
