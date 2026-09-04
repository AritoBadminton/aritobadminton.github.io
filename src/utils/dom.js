/** Các hàm bổ trợ thao tác DOM. */

/**
 * Tìm phần tử đầu tiên khớp selector.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {HTMLElement|null}
 */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Tìm mọi phần tử khớp selector, trả về mảng thật để dùng map/filter.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {HTMLElement[]}
 */
export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/**
 * Thoát ký tự đặc biệt trước khi chèn vào HTML, tránh lỗi hiển thị và XSS.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(value ?? '').replace(/[&<>"]/g, (char) => map[char]);
}

/**
 * Bật/tắt trạng thái ẩn của một phần tử bằng thuộc tính display.
 * @param {HTMLElement} element
 * @param {boolean} visible
 * @param {string} [displayValue='block']
 */
export function setVisible(element, visible, displayValue = 'block') {
  if (element) element.style.display = visible ? displayValue : 'none';
}

/**
 * Sao chép văn bản vào clipboard, có phương án dự phòng cho trình duyệt cũ.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

/**
 * Đổi nhãn nút thành thông báo xác nhận rồi trả lại nhãn cũ.
 * @param {HTMLElement} button
 * @param {string} [message='Đã sao chép ✓']
 */
export function flashButtonLabel(button, message = 'Đã sao chép ✓') {
  const original = button.textContent;
  button.textContent = message;
  setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

/**
 * Dựng dòng "Xem thêm" cho ô chọn tháng khi danh sách bị rút gọn.
 * @param {number} hiddenCount số tháng đang bị ẩn bớt
 * @param {string} moreValue giá trị gán cho dòng "Xem thêm"
 * @returns {string} chuỗi HTML của một <option>, rỗng nếu không cần
 */
export function buildMoreOption(hiddenCount, moreValue) {
  if (hiddenCount <= 0) return '';
  return `<option value="${moreValue}">▾ Xem thêm ${hiddenCount} tháng cũ hơn…</option>`;
}
