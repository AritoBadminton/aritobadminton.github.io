/** Các hàm định dạng số tiền, ngày tháng và nhãn hiển thị. */

import { CATEGORY_COLOR_FALLBACK, CATEGORY_COLORS } from '../config/constants.js';
import { escapeHtml } from './dom.js';

const NUMBER_FORMATTER = new Intl.NumberFormat('vi-VN');

/**
 * Định dạng số tiền đầy đủ: 1234567 -> "1.234.567 đ".
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `${NUMBER_FORMATTER.format(Math.round(amount))} đ`;
}

/**
 * Định dạng rút gọn theo nghìn đồng, dùng cho trục biểu đồ.
 * @param {number} amount
 * @returns {string}
 */
export function formatThousands(amount) {
  return NUMBER_FORMATTER.format(Math.round(amount / 1000));
}

/**
 * Định dạng số nguyên có dấu phân cách nghìn, dùng cho ô nhập liệu.
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return NUMBER_FORMATTER.format(value);
}

/**
 * Lấy phần chữ số từ chuỗi người dùng gõ vào ô tiền.
 * @param {string} input
 * @returns {number}
 */
export function parseAmount(input) {
  return Number(String(input).replace(/[^0-9]/g, '')) || 0;
}

/**
 * "2026-08" -> "Tháng 08/2026".
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `Tháng ${month}/${year}`;
}

/**
 * "2026-08-28" -> "28/08/2026".
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateLabel(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Màu đại diện cho một danh mục thu/chi.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLOR_FALLBACK;
}

/**
 * Định dạng một dòng ghi chú thành HTML: xuống dòng, chữ đậm `**...**`, chữ
 * nghiêng `*...*`, và tô đỏ số tiền (nhận cả "30.000đ" lẫn cách viết tắt
 * "30k") — để chủ trang gõ ghi chú trong Firestore mà vẫn trình bày đẹp ngay,
 * khỏi cần thêm màn hình soạn thảo riêng cho ghi chú.
 *
 * Đậm phải thay trước nghiêng: thay nghiêng trước thì mỗi cặp `**` bị đọc
 * nhầm thành hai cặp `*` lồng nhau, hỏng cả chữ đậm lẫn chữ nghiêng.
 * @param {string} text
 * @returns {string} HTML đã thoát ký tự đặc biệt, an toàn để chèn thẳng
 */
export function formatNoteHtml(text) {
  return escapeHtml(text)
    .replace(/\d[\d.,]*\s?(?:đ|k)(?![\p{L}])/gu, (amount) => `<span class="note-amount">${amount}</span>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
