/** Huy hiệu nhỏ ở header: số người đang xem trang cùng lúc (ước lượng). */

import { store } from '../state/store.js';
import { qs, setVisible } from '../utils/dom.js';

/** Vẽ lại huy hiệu — tự ẩn khi chưa có số (chế độ data.json, hoặc chưa hỏi được lần nào). */
export function renderPresenceBadge() {
  const badge = qs('#presence-badge');
  if (store.onlineCount === null) {
    setVisible(badge, false);
    return;
  }
  setVisible(badge, true, 'inline-flex');
  qs('#presence-count').textContent = String(store.onlineCount);
}
