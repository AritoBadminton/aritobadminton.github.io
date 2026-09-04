/**
 * Cấu hình Firebase.
 *
 * Điền thông tin lấy từ Firebase Console (xem docs/TRIEN-KHAI-FIREBASE.md).
 * Các giá trị này công khai theo thiết kế của Firebase — chúng chỉ cho biết
 * dự án nào, không cấp quyền gì. Quyền ghi do firestore.rules quyết định.
 *
 * Để trống projectId thì trang chạy y như trước: đọc data.json, sửa trên máy
 * rồi dán tay. Điền đủ thì chuyển sang chế độ Firebase, mọi thay đổi hiện ngay
 * trên máy của tất cả mọi người.
 */

/** Phiên bản Firebase SDK dùng trong index.html — giữ khớp với import map. */
export const FIREBASE_SDK_VERSION = '12.18.0';

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** Đã cấu hình Firebase hay chưa. */
export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.apiKey);
}
