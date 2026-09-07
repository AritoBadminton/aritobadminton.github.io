/** Nghiệp vụ thành viên: trạng thái hoạt động và thống kê gộp. */

import { STORAGE_KEYS } from '../config/constants.js';
import { buildDuesKey, store } from '../state/store.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import {
  addMemberToOpenMonths,
  getEffectivePaid,
  getEffectiveSkip,
  getFutureMonthKeys,
  getMonthMembers,
  removeMemberFromOpenMonths,
} from './dues-service.js';
import { readJson, removeKey, writeJson } from './storage-service.js';

/** Tên thành viên dài nhất chấp nhận được. */
const MAX_MEMBER_NAME_LENGTH = 60;

/**
 * Gom số liệu từng thành viên qua mọi tháng.
 *
 * Hai điều quan trọng:
 * - Tháng tự sinh chỉ được tính khi đã thực sự có đánh dấu — nếu không, việc chỉ
 *   xem trước tháng 9 sẽ làm tỷ lệ đóng đủ của cả câu lạc bộ tụt oan.
 * - Tháng đánh dấu "Không chơi" không tính vào mẫu số của tỷ lệ đóng đủ, vì
 *   tháng đó người ta không được kỳ vọng phải đóng.
 */
export function aggregateMembers() {
  const monthKeys = store.months.map((month) => month.month);

  getFutureMonthKeys().forEach((key) => {
    const hasMark = [...Object.keys(store.duesPaidOverrides), ...Object.keys(store.duesNoteOverrides)].some(
      (overrideKey) => overrideKey.split('|')[0] === key,
    );
    if (hasMark) monthKeys.push(key);
  });

  const byName = new Map();
  monthKeys.forEach((monthKey) => {
    getMonthMembers(monthKey).forEach((member) => {
      const paid = getEffectivePaid(monthKey, member);
      if (!byName.has(member.name)) {
        byName.set(member.name, {
          name: member.name,
          total: 0,
          months: 0,
          paidMonths: 0,
          skippedMonths: 0,
          lastMonth: null,
          lastPaid: 0,
          lastSkipped: false,
        });
      }
      const stats = byName.get(member.name);
      const isSkipped = getEffectiveSkip(monthKey, member);

      stats.total += paid;
      if (isSkipped) stats.skippedMonths += 1;
      else {
        stats.months += 1;
        if (paid > 0) stats.paidMonths += 1;
      }
      stats.lastMonth = monthKey;
      stats.lastPaid = paid;
      stats.lastSkipped = isSkipped;
    });
  });

  // Người vừa được thêm chưa có tên ở tháng nào, nhưng vẫn phải hiện ở tab
  // Thành viên — nếu không thì thêm xong lại không thấy đâu cả.
  (store.data.roster ?? []).forEach((entry) => {
    if (!entry?.name || byName.has(entry.name)) return;
    byName.set(entry.name, {
      name: entry.name,
      total: 0,
      months: 0,
      paidMonths: 0,
      skippedMonths: 0,
      lastMonth: null,
      lastPaid: 0,
      lastSkipped: false,
    });
  });

  store.members = [...byName.values()];
}

/**
 * Dựng trạng thái hoạt động: mặc định là có tên ở tháng mới nhất đã ghi,
 * data.json ghi đè lên mặc định, và localStorage ghi đè lên data.json.
 */
export function initActiveMembers() {
  const lastRecorded = store.months[store.months.length - 1];
  const namesInLastMonth = new Set((lastRecorded?.members ?? []).map((member) => member.name));

  store.baseActiveMembers = {};
  store.members.forEach((member) => {
    store.baseActiveMembers[member.name] = namesInLastMonth.has(member.name);
  });
  (store.data.roster ?? []).forEach((entry) => {
    if (entry && entry.name in store.baseActiveMembers) {
      store.baseActiveMembers[entry.name] = Boolean(entry.active);
    }
  });

  store.memberOrder = {};
  (store.data.roster ?? []).forEach((entry) => {
    // Number(null) ra 0 chứ không ra NaN, nên phải loại null và chuỗi rỗng trước.
    if (!entry || entry.order === null || entry.order === undefined || entry.order === '') return;
    const order = Number(entry.order);
    if (Number.isFinite(order)) store.memberOrder[entry.name] = order;
  });

  store.activeMembers = { ...store.baseActiveMembers };
  if (isFirebaseMode()) return;

  const saved = readJson(STORAGE_KEYS.ACTIVE_MEMBERS, null);
  if (saved) {
    Object.keys(saved).forEach((name) => {
      if (name in store.activeMembers) store.activeMembers[name] = Boolean(saved[name]);
    });
  }
}

/**
 * Bật/tắt trạng thái hoạt động của một thành viên.
 * @param {string} name
 * @param {boolean} isActive
 */
export function setMemberActive(name, isActive) {
  // Đổi ngay trong bộ nhớ để ô tích không nháy về trạng thái cũ trong lúc chờ
  // Firestore trả lời; bản trên máy chủ về sau sẽ xác nhận lại.
  store.activeMembers[name] = isActive;

  if (isFirebaseMode()) {
    // Bật lại thì đưa tên trở vào bảng đóng quỹ của tháng hiện tại trở đi;
    // tắt đi thì rút ra. Nhờ vậy bảng đóng quỹ luôn khớp với danh sách có tick.
    return firebaseApi()
      .saveMemberActive(name, isActive)
      .then(() => (isActive ? addMemberToOpenMonths(name) : removeMemberFromOpenMonths(name)));
  }

  writeJson(STORAGE_KEYS.ACTIVE_MEMBERS, store.activeMembers);
}

/**
 * Đặt số thứ tự cho một thành viên. Truyền null để bỏ số.
 * @param {string} name
 * @param {number|null} order
 */
export function setMemberOrder(name, order) {
  if (order === null) delete store.memberOrder[name];
  else store.memberOrder[name] = order;
  if (isFirebaseMode()) return firebaseApi().saveMemberOrder(name, order);
  return Promise.resolve();
}

/**
 * Thêm một thành viên mới vào danh sách chung.
 *
 * Người mới được coi là đang hoạt động và có mặt ngay ở bảng đóng quỹ của tháng
 * hiện tại trở đi. Các tháng cũ không đụng tới, vì lúc đó họ chưa tham gia.
 * @param {string} rawName
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function addMember(rawName) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Chưa nhập tên.' };
  if (name.length > MAX_MEMBER_NAME_LENGTH) {
    return { ok: false, error: `Tên dài quá ${MAX_MEMBER_NAME_LENGTH} ký tự.` };
  }
  const existing = store.members.find((member) => member.name.toLowerCase() === name.toLowerCase());
  if (existing) return { ok: false, error: `Đã có "${existing.name}" trong danh sách.` };

  store.activeMembers[name] = true;
  if (!isFirebaseMode()) {
    writeJson(STORAGE_KEYS.ACTIVE_MEMBERS, store.activeMembers);
    return { ok: false, error: 'Chế độ data.json chưa thêm được thành viên mới.' };
  }

  try {
    await firebaseApi().saveMemberActive(name, true);
    await addMemberToOpenMonths(name);
    return { ok: true };
  } catch (error) {
    delete store.activeMembers[name];
    return { ok: false, error: `Không lưu được: ${error?.message ?? error}` };
  }
}

/** Trả trạng thái hoạt động về đúng như data.json. */
export function resetActiveMembers() {
  store.activeMembers = { ...store.baseActiveMembers };
  removeKey(STORAGE_KEYS.ACTIVE_MEMBERS);
}

/** Tên các thành viên có trạng thái khác với data.json. */
export function getChangedActiveNames() {
  return store.members
    .filter((member) => store.activeMembers[member.name] !== store.baseActiveMembers[member.name])
    .map((member) => member.name);
}

/**
 * Số người trong nhóm đang hoạt động chưa đóng tháng gần nhất.
 * @param {string} lastMonthKey
 */
export function countUnpaidActive(lastMonthKey) {
  return store.members.filter(
    (member) =>
      store.activeMembers[member.name] &&
      !member.lastSkipped &&
      !(member.lastMonth === lastMonthKey && member.lastPaid > 0),
  ).length;
}

export { buildDuesKey };
