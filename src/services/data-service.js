/** Tải dữ liệu chung từ data.json. */

import { DATA_URL } from '../config/constants.js';

/**
 * Tải data.json, luôn lấy bản mới nhất thay vì bản cache của trình duyệt —
 * nếu không, người đã mở trang trước đó sẽ không thấy dữ liệu vừa commit.
 * @returns {Promise<object>}
 */
export async function fetchClubData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Không tải được ${DATA_URL} (HTTP ${response.status})`);
  }
  return response.json();
}
