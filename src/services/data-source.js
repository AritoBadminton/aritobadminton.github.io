/**
 * Chọn nguồn dữ liệu: Firebase hay data.json.
 *
 * Chưa điền cấu hình Firebase thì trang chạy y như cũ — đọc data.json, sửa trên
 * máy rồi dán tay. Điền đủ thì mọi thay đổi ghi thẳng lên Firestore và hiện ngay
 * trên máy của cả nhóm. Nhờ tách ở đây, các màn hình không cần biết khác biệt đó.
 */

import { isFirebaseConfigured } from '../config/firebase-config.js';

/** Module firebase-service sau khi được nạp; null khi chạy chế độ data.json. */
let firebase = null;

/** Đang chạy chế độ Firebase hay không. */
export function isFirebaseMode() {
  return isFirebaseConfigured();
}

/**
 * Nạp firebase-service theo yêu cầu. Nạp động để chế độ data.json không phải
 * tải SDK Firebase, và vẫn chạy được khi không có mạng ra ngoài.
 */
export async function loadFirebase() {
  if (!firebase) firebase = await import('./firebase-service.js');
  return firebase;
}

/** Lấy module đã nạp. Gọi sau khi loadFirebase() đã chạy xong lúc khởi động. */
export function firebaseApi() {
  if (!firebase) throw new Error('Chưa nạp firebase-service.');
  return firebase;
}
