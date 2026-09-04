/**
 * Nghiệp vụ đóng quỹ theo tháng.
 *
 * Nguyên tắc quan trọng: tháng đã ghi trong data.json KHÔNG bao giờ bị sinh lại
 * từ danh sách hiện tại — làm vậy sẽ phá lịch sử (tháng 12/2024 vốn chỉ có 8
 * người). Chỉ tháng chưa có mới được tự sinh, hoặc tháng cũ được bổ sung thủ
 * công qua duesFilledMonths.
 */

import { DUES_STATUS, FUTURE_MONTH_COUNT, STANDARD_DUES, STORAGE_KEYS } from '../config/constants.js';
import { buildDuesKey, store } from '../state/store.js';
import { getFollowingMonthKeys } from '../utils/date.js';
import { formatMonthLabel } from '../utils/format.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import { readJson, writeJson } from './storage-service.js';

/** Nạp mọi ghi đè đóng quỹ đã lưu trên máy. */
export function loadLocalDuesChanges() {
  store.duesPaidOverrides = readJson(STORAGE_KEYS.DUES_PAID, {});
  store.duesNoteOverrides = readJson(STORAGE_KEYS.DUES_NOTES, {});
  store.duesFilledMonths = readJson(STORAGE_KEYS.DUES_FILL, {});
  store.duesSkipOverrides = readJson(STORAGE_KEYS.DUES_SKIP, {});
}

/** Lưu mọi ghi đè đóng quỹ xuống máy. */
export function persistLocalDuesChanges() {
  writeJson(STORAGE_KEYS.DUES_PAID, store.duesPaidOverrides);
  writeJson(STORAGE_KEYS.DUES_NOTES, store.duesNoteOverrides);
  writeJson(STORAGE_KEYS.DUES_FILL, store.duesFilledMonths);
  writeJson(STORAGE_KEYS.DUES_SKIP, store.duesSkipOverrides);
}

/**
 * Số tiền đang hiệu lực của một thành viên trong tháng.
 * @param {string} monthKey
 * @param {{name: string, paid: number}} member
 * @returns {number}
 */
export function getEffectivePaid(monthKey, member) {
  const key = buildDuesKey(monthKey, member.name);
  return key in store.duesPaidOverrides ? store.duesPaidOverrides[key] : member.paid;
}

/**
 * Ghi chú đang hiệu lực của một thành viên trong tháng.
 * @param {string} monthKey
 * @param {{name: string, note?: string}} member
 * @returns {string}
 */
export function getEffectiveNote(monthKey, member) {
  const key = buildDuesKey(monthKey, member.name);
  return key in store.duesNoteOverrides ? store.duesNoteOverrides[key] : (member.note ?? '');
}

/**
 * Tháng này thành viên có đánh dấu "Không chơi" hay không.
 * @param {string} monthKey
 * @param {{name: string, skip?: boolean}} member
 * @returns {boolean}
 */
export function getEffectiveSkip(monthKey, member) {
  const key = buildDuesKey(monthKey, member.name);
  return key in store.duesSkipOverrides ? store.duesSkipOverrides[key] : Boolean(member.skip);
}

/**
 * Trạng thái đóng quỹ đang hiệu lực của một thành viên trong tháng.
 * @param {string} monthKey
 * @param {object} member
 * @returns {'paid'|'unpaid'|'skipped'}
 */
export function getDuesStatus(monthKey, member) {
  if (getEffectiveSkip(monthKey, member)) return DUES_STATUS.SKIPPED;
  return getEffectivePaid(monthKey, member) > 0 ? DUES_STATUS.PAID : DUES_STATUS.UNPAID;
}

/** Tên các thành viên đang ở trạng thái hoạt động. */
export function getActiveMemberNames() {
  return store.members.filter((member) => store.activeMembers[member.name]).map((member) => member.name);
}

/** Các tháng chưa có trong data.json, được đề xuất sẵn để đánh dấu trước. */
export function getFutureMonthKeys() {
  const lastRecorded = store.months[store.months.length - 1]?.month;
  return lastRecorded ? getFollowingMonthKeys(lastRecorded, FUTURE_MONTH_COUNT) : [];
}

/**
 * Tháng này đã có trong data.json chưa.
 * @param {string} monthKey
 */
export function isVirtualMonth(monthKey) {
  return !store.months.some((month) => month.month === monthKey);
}

/**
 * Danh sách đóng quỹ của một tháng.
 * - Tháng đã ghi: giữ nguyên danh sách gốc, chỉ bổ sung khi bật duesFilledMonths.
 * - Tháng chưa có: tự sinh toàn bộ từ danh sách thành viên đang hoạt động.
 * @param {string} monthKey
 * @returns {Array<{name: string, paid: number, note: string, added?: boolean}>}
 */
export function getMonthMembers(monthKey) {
  const recorded = store.months.find((month) => month.month === monthKey);
  const rows = recorded ? recorded.members.map((member) => ({ ...member })) : [];
  const shouldFill = !recorded || store.duesFilledMonths[monthKey];
  if (!shouldFill) return rows;

  const present = new Set(rows.map((row) => row.name));
  const activeNames = getActiveMemberNames();

  // Giữ thứ tự quen mắt: theo tháng gần nhất trước, người mới xếp theo bảng chữ cái.
  const previousOrder = recorded
    ? null
    : (store.months[store.months.length - 1]?.members ?? []).map((m) => m.name);
  const orderedNames = previousOrder
    ? [
        ...previousOrder.filter((name) => activeNames.includes(name)),
        ...activeNames
          .filter((name) => !previousOrder.includes(name))
          .sort((a, b) => a.localeCompare(b, 'vi')),
      ]
    : activeNames;

  orderedNames.forEach((name) => {
    if (present.has(name)) return;
    rows.push({ name, paid: 0, note: '', added: true });
    present.add(name);
  });
  return rows;
}

/**
 * Mức đóng quen thuộc của một người, dùng khi đánh dấu "Đã đóng".
 * Chị Lu đóng 100k thì gợi ý 100k chứ không cào bằng 50k.
 * @param {string} memberName
 * @param {string} untilMonthKey
 * @returns {number}
 */
export function getUsualAmount(memberName, untilMonthKey) {
  let amount = 0;
  for (const month of store.months) {
    if (month.month > untilMonthKey) break;
    const member = month.members.find((item) => item.name === memberName);
    if (!member) continue;
    const paid = getEffectivePaid(month.month, member);
    if (paid > 0) amount = paid;
  }
  if (amount) return amount;

  for (const month of store.months) {
    const member = month.members.find((item) => item.name === memberName);
    if (member?.paid > 0) return member.paid;
  }
  return STANDARD_DUES;
}

/**
 * Ghi một ô của bảng đóng quỹ lên Firestore, giữ nguyên các trường không đổi.
 * @param {string} monthKey
 * @param {string} memberName
 * @param {object} changes phần cần đổi, ví dụ { paid: 50000 }
 */
function writeDuesEntry(monthKey, memberName, changes) {
  const current = getMonthMembers(monthKey).find((member) => member.name === memberName) ?? {};
  const entry = {
    paid: current.paid ?? 0,
    note: current.note ?? '',
    skip: Boolean(current.skip),
    ...changes,
  };
  return firebaseApi().saveDuesEntry(monthKey, memberName, entry, formatMonthLabel(monthKey));
}

/**
 * Đặt số tiền đóng quỹ, tự bỏ ghi đè nếu trùng với bản gốc.
 * @param {string} monthKey
 * @param {string} memberName
 * @param {number} amount
 */
export function setPaidAmount(monthKey, memberName, amount) {
  if (isFirebaseMode()) return writeDuesEntry(monthKey, memberName, { paid: amount });
  const original = getMonthMembers(monthKey).find((member) => member.name === memberName) ?? { paid: 0 };
  const key = buildDuesKey(monthKey, memberName);
  if (amount === original.paid) delete store.duesPaidOverrides[key];
  else store.duesPaidOverrides[key] = amount;
  persistLocalDuesChanges();
}

/**
 * Đặt trạng thái "Không chơi", tự bỏ ghi đè nếu trùng với bản gốc.
 * @param {string} monthKey
 * @param {string} memberName
 * @param {boolean} isSkipped
 */
export function setSkipped(monthKey, memberName, isSkipped) {
  if (isFirebaseMode()) return writeDuesEntry(monthKey, memberName, { skip: isSkipped });
  const original = getMonthMembers(monthKey).find((member) => member.name === memberName) ?? {};
  const key = buildDuesKey(monthKey, memberName);
  if (isSkipped === Boolean(original.skip)) delete store.duesSkipOverrides[key];
  else store.duesSkipOverrides[key] = isSkipped;
  persistLocalDuesChanges();
}

/**
 * Đổi trạng thái đóng quỹ của một thành viên trong tháng.
 * Chọn "Đã đóng" tự điền mức người đó vẫn đóng; hai trạng thái còn lại đưa số tiền về 0.
 * @param {string} monthKey
 * @param {string} memberName
 * @param {'paid'|'unpaid'|'skipped'} status
 */
export function setDuesStatus(monthKey, memberName, status) {
  const paid = status === DUES_STATUS.PAID ? getUsualAmount(memberName, monthKey) : 0;
  const skip = status === DUES_STATUS.SKIPPED;
  // Ghi một lần cho cả hai trường, tránh hai lượt ghi cho một thao tác.
  if (isFirebaseMode()) return writeDuesEntry(monthKey, memberName, { paid, skip });
  setSkipped(monthKey, memberName, skip);
  setPaidAmount(monthKey, memberName, paid);
}

/**
 * Đặt ghi chú, tự bỏ ghi đè nếu trùng với bản gốc.
 * @param {string} monthKey
 * @param {string} memberName
 * @param {string} note
 */
export function setNote(monthKey, memberName, note) {
  if (isFirebaseMode()) return writeDuesEntry(monthKey, memberName, { note });
  const original = getMonthMembers(monthKey).find((member) => member.name === memberName) ?? { note: '' };
  const key = buildDuesKey(monthKey, memberName);
  if (note === (original.note ?? '')) delete store.duesNoteOverrides[key];
  else store.duesNoteOverrides[key] = note;
  persistLocalDuesChanges();
}

/**
 * Bổ sung thành viên đang hoạt động còn thiếu vào một tháng đã ghi.
 * @param {string} monthKey
 */
export function fillMonthWithActiveMembers(monthKey) {
  if (isFirebaseMode()) {
    const rows = getMonthMembers(monthKey).map((member) => ({
      name: member.name,
      paid: getEffectivePaid(monthKey, member),
      note: getEffectiveNote(monthKey, member),
      skip: getEffectiveSkip(monthKey, member),
    }));
    const activeRows = getActiveMemberNames()
      .filter((name) => !rows.some((row) => row.name === name))
      .map((name) => ({ name, paid: 0, note: '', skip: false }));
    return firebaseApi().saveDuesRows(monthKey, formatMonthLabel(monthKey), [...rows, ...activeRows]);
  }
  store.duesFilledMonths[monthKey] = true;
  persistLocalDuesChanges();
}

/**
 * Bỏ mọi thay đổi chưa lưu chung của một tháng.
 * @param {string} monthKey
 */
export function resetMonth(monthKey) {
  Object.keys(store.duesPaidOverrides)
    .filter((key) => key.startsWith(`${monthKey}|`))
    .forEach((key) => delete store.duesPaidOverrides[key]);
  Object.keys(store.duesNoteOverrides)
    .filter((key) => key.startsWith(`${monthKey}|`))
    .forEach((key) => delete store.duesNoteOverrides[key]);
  Object.keys(store.duesSkipOverrides)
    .filter((key) => key.startsWith(`${monthKey}|`))
    .forEach((key) => delete store.duesSkipOverrides[key]);
  delete store.duesFilledMonths[monthKey];
  persistLocalDuesChanges();
}

/**
 * Tên các thành viên có thay đổi chưa lưu chung trong một tháng.
 * @param {string} monthKey
 * @returns {string[]}
 */
export function getChangedMemberNames(monthKey) {
  return getMonthMembers(monthKey)
    .filter((member) => {
      const key = buildDuesKey(monthKey, member.name);
      return (
        member.added ||
        key in store.duesPaidOverrides ||
        key in store.duesNoteOverrides ||
        key in store.duesSkipOverrides
      );
    })
    .map((member) => member.name);
}

/** Mọi tháng đang có thay đổi chưa lưu chung. */
export function getMonthsWithChanges() {
  const monthOf = (key) => key.split('|')[0];
  const keys = [
    ...Object.keys(store.duesPaidOverrides).map(monthOf),
    ...Object.keys(store.duesNoteOverrides).map(monthOf),
    ...Object.keys(store.duesSkipOverrides).map(monthOf),
    ...Object.keys(store.duesFilledMonths).filter((key) => store.duesFilledMonths[key]),
    ...getFutureMonthKeys().filter((key) =>
      getMonthMembers(key).some((member) => {
        const duesKey = buildDuesKey(key, member.name);
        return (
          duesKey in store.duesPaidOverrides ||
          duesKey in store.duesNoteOverrides ||
          duesKey in store.duesSkipOverrides
        );
      }),
    ),
  ];
  return [...new Set(keys)].sort();
}
