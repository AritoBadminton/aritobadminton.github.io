/** Thanh tab điều hướng giữa các trang nội dung. */

import { requestRender } from '../state/render-bus.js';
import { qsa } from '../utils/dom.js';

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
  requestRender('charts');
}

/** Gắn sự kiện cho toàn bộ tab. */
export function initTabNav() {
  qsa('.tab-nav__item').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab));
  });
}
