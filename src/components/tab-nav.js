/** Thanh tab điều hướng giữa các trang nội dung. */

import { qs, qsa } from '../utils/dom.js';

/** Tab mặc định khi tab đang mở bị ẩn. */
const DEFAULT_PANEL = 'dashboard';

/**
 * Chuyển sang tab được chọn.
 * @param {HTMLElement} selectedTab
 */
function activateTab(selectedTab) {
  qsa('.tab-nav__item').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab === selectedTab));
  });
  qsa('.tab-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `panel-${selectedTab.dataset.panel}`);
  });
}

/**
 * Đưa người dùng về tab mặc định nếu tab đang mở chỉ dành cho admin.
 * Gọi sau mỗi lần đổi trạng thái đăng nhập.
 */
export function enforceVisibleTab() {
  const activeTab = qsa('.tab-nav__item').find((tab) => tab.getAttribute('aria-selected') === 'true');
  if (!activeTab || getComputedStyle(activeTab).display !== 'none') return;
  activateTab(qs(`.tab-nav__item[data-panel="${DEFAULT_PANEL}"]`));
}

/** Gắn sự kiện cho toàn bộ tab. */
export function initTabNav() {
  qsa('.tab-nav__item').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab));
  });
}
