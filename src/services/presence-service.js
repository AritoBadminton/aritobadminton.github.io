/**
 * Ước lượng số người đang xem trang cùng lúc, dựng từ nhịp "còn sống"
 * (heartbeat) ghi vào Firestore — Firebase không cho trang tĩnh đọc thẳng số
 * "Active connections" nội bộ của chính dự án (cần tài khoản dịch vụ + máy
 * chủ riêng để gọi Cloud Monitoring API), nên tự làm bản gần đúng bằng dữ
 * liệu công khai.
 *
 * Mỗi tab mở trang có một session id riêng (sessionStorage, không dùng chung
 * giữa các tab — mở hai tab tính là hai người xem, giống "Active connections"
 * thật) và ghi lại lastSeen mỗi PRESENCE_HEARTBEAT_MS. Phía đọc đếm những
 * phiên có lastSeen còn trong PRESENCE_ONLINE_WINDOW_MS gần nhất, hỏi lại
 * theo chu kỳ (không onSnapshot) vì Firestore không tự báo khi một tài liệu
 * "hết hạn" theo đồng hồ thực mà không có ghi mới.
 *
 * Chỉ chạy ở chế độ Firebase — chế độ data.json không có nơi ghi/đọc chung
 * nên không có gì để đếm.
 */

import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_POLL_MS,
  PRESENCE_TTL_MS,
  STORAGE_KEYS,
} from '../config/constants.js';
import { requestRender } from '../state/render-bus.js';
import { store } from '../state/store.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import { readSessionRaw, writeRaw } from './storage-service.js';

/** Id phiên riêng của tab này, sinh một lần rồi giữ nguyên suốt phiên làm việc. */
function getSessionId() {
  let id = readSessionRaw(STORAGE_KEYS.PRESENCE_SESSION);
  if (!id) {
    id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    writeRaw(STORAGE_KEYS.PRESENCE_SESSION, id, false);
  }
  return id;
}

/**
 * Ghi một nhịp "còn sống", lặp lại đều đặn cho tới khi đóng tab. Lỗi ghi
 * (thường do firestore.rules trên Firebase Console chưa publish rule cho
 * collection "presence") chỉ bỏ qua — đây là số liệu phụ, không được để ảnh
 * hưởng tới phần còn lại của trang.
 */
function startHeartbeat() {
  const sessionId = getSessionId();
  const beat = async () => {
    try {
      await firebaseApi().saveHeartbeat(sessionId, PRESENCE_TTL_MS);
    } catch {
      /* bỏ qua — xem ghi chú ở trên */
    }
  };
  beat();
  setInterval(beat, PRESENCE_HEARTBEAT_MS);
}

/** Hỏi lại Firestore theo chu kỳ để cập nhật số người đang xem. */
function startPolling() {
  const poll = async () => {
    try {
      store.onlineCount = await firebaseApi().countOnlineViewers(PRESENCE_ONLINE_WINDOW_MS);
    } catch {
      store.onlineCount = null;
    }
    requestRender('presence');
  };
  poll();
  setInterval(poll, PRESENCE_POLL_MS);
}

/** Bật đếm số người đang xem — không làm gì ở chế độ data.json. */
export function startPresenceTracking() {
  if (!isFirebaseMode()) return;
  startHeartbeat();
  startPolling();
}
