/**
 * Nút "Lưu chung" dùng chung cho bốn phần dữ liệu.
 *
 * Có máy chủ lưu trữ thì bấm một cái là commit thẳng vào data.json. Chưa cấu
 * hình máy chủ — hoặc máy chủ đang lỗi — thì quay về cách cũ: hiện khối JSON
 * để dán tay, nhờ vậy không bao giờ rơi vào cảnh không lưu được.
 */

import { apiSave, isApiConfigured } from '../services/api-service.js';
import { applySavedData } from '../services/sync-service.js';
import { requestRender } from '../state/render-bus.js';
import { qs } from '../utils/dom.js';

/** Nhãn giữ lại bao lâu sau khi lưu xong. */
const SUCCESS_LABEL_MS = 2200;

/**
 * Lưu một phần dữ liệu lên máy chủ, hoặc rơi về cách dán tay.
 * @param {object} options
 * @param {string} options.buttonSelector nút "Lưu chung"
 * @param {string} options.statusSelector ô chữ báo trạng thái
 * @param {'rules'|'roster'|'month'|'ledger'} options.section
 * @param {() => object} options.buildPayload dựng nội dung gửi lên
 * @param {() => void} options.showManualBlock hiện khối JSON để dán tay
 * @param {string} [options.monthKey] chỉ dùng cho section 'month'
 */
export async function saveSection({
  buttonSelector,
  statusSelector,
  section,
  buildPayload,
  showManualBlock,
  monthKey,
}) {
  if (!isApiConfigured()) {
    showManualBlock();
    return;
  }

  const button = qs(buttonSelector);
  const status = qs(statusSelector);
  const originalLabel = button.textContent;

  button.disabled = true;
  button.textContent = 'Đang lưu…';

  const result = await apiSave(section, buildPayload());

  if (!result.ok) {
    button.disabled = false;
    button.textContent = originalLabel;
    status.textContent = `Chưa lưu được: ${result.error} Dùng tạm cách dán tay bên dưới.`;
    showManualBlock();
    return;
  }

  applySavedData(result.data, section, monthKey);
  requestRender();

  button.textContent = 'Đã lưu ✓';
  setTimeout(() => {
    button.textContent = originalLabel;
  }, SUCCESS_LABEL_MS);
}
