/**
 * Kênh phát tín hiệu vẽ lại giao diện.
 *
 * Các view tự đăng ký hàm vẽ của mình; service sau khi đổi dữ liệu chỉ cần gọi
 * requestRender(). Nhờ vậy service không phải import view, tránh phụ thuộc vòng.
 */

/** @type {Map<string, () => void>} */
const renderers = new Map();

/**
 * Đăng ký hàm vẽ cho một vùng giao diện.
 * @param {string} scope tên vùng: 'dashboard' | 'ledger' | 'members' | 'months'
 * @param {() => void} renderFn
 */
export function registerRenderer(scope, renderFn) {
  renderers.set(scope, renderFn);
}

/**
 * Yêu cầu vẽ lại. Không truyền tham số thì vẽ lại tất cả.
 * @param {...string} scopes
 */
export function requestRender(...scopes) {
  const targets = scopes.length ? scopes : [...renderers.keys()];
  targets.forEach((scope) => renderers.get(scope)?.());
}
