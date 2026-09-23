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
 * Chặn scheme nguy hiểm (VD `javascript:`) trước khi gán vào href/src.
 *
 * Chỉ dùng cho giá trị admin gõ trực tiếp trên Firebase Console (`settings/qr`,
 * `settings/club.mapLink`) — nếu tài khoản admin bị chiếm, kẻ tấn công có thể
 * đặt `javascript:...` thay vì link thật để chạy script khi người khác bấm vào.
 * Đường dẫn tương đối (không có `:` trước dấu `/` đầu tiên, VD ảnh trong repo)
 * và `http(s):` đều coi là an toàn.
 * @param {string} url
 * @returns {string} url gốc nếu an toàn, rỗng nếu không
 */
export function isSafeUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return value;
  return /^https?$/i.test(schemeMatch[1]) ? value : '';
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

/** Hẹn giờ tự ẩn của lần gọi showToast gần nhất. */
let toastTimer = 0;

/**
 * Hiện thông báo nổi ở dưới màn hình rồi tự ẩn sau một khoảng thời gian.
 *
 * Gọi liên tiếp thì lần sau huỷ hẹn giờ của lần trước — tránh toast mới vừa
 * hiện đã bị timer của toast cũ ẩn mất.
 *
 * @param {string} message
 * @param {number} [duration=3000] mili giây trước khi tự ẩn
 */
export function showToast(message, duration = 3000) {
  const toast = qs('#toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
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
