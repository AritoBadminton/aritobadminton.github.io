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
import { getCurrentMonthKey, getFollowingMonthKeys, getNextMonthKey } from '../utils/date.js';
import { formatMonthLabel } from '../utils/format.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import { readJson, writeJson } from './storage-service.js';

/** Nạp mọi ghi đè đóng quỹ đã lưu trên máy. */
export function loadLocalDuesChanges() {
  // Chế độ Firebase không có bản nháp: mọi thay đổi ghi thẳng lên máy chủ. Bỏ qua
  // bản nháp cũ còn sót lại trên máy, nếu không nó sẽ đắp lên số liệu chung.
  if (isFirebaseMode()) {
    store.duesPaidOverrides = {};
    store.duesNoteOverrides = {};
    store.duesFilledMonths = {};
    store.duesSkipOverrides = {};
    return;
  }
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

/**
 * So sánh hai người theo số thứ tự admin đặt ở tab Thành viên.
 * Người chưa có số xếp sau tất cả, và giữ nguyên thứ tự vốn có giữa họ với nhau.
 * @param {{name: string}} a
 * @param {{name: string}} b
 * @returns {number}
 */
export function compareByOrder(a, b) {
  const left = store.memberOrder[a.name];
  const right = store.memberOrder[b.name];
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

/**
 * Sắp một danh sách theo số thứ tự, giữ nguyên thứ tự cũ giữa những người chưa có số.
 * @template {{name: string}} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function sortByMemberOrder(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareByOrder(a.row, b.row) || a.index - b.index)
    .map((item) => item.row);
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
  if (!shouldFill) return sortByMemberOrder(rows);

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
  return sortByMemberOrder(rows);
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
  const rows = getMonthMembers(monthKey);
  const current = rows.find((member) => member.name === memberName) ?? {};
  const entry = {
    paid: current.paid ?? 0,
    note: current.note ?? '',
    skip: Boolean(current.skip),
    ...changes,
  };

  // Tháng còn ảo: ghi luôn cả bảng đang hiện, không chỉ một dòng. Ghi mỗi một
  // dòng sẽ tạo ra tài liệu tháng chỉ có đúng người vừa đánh dấu, những người
  // còn lại biến mất khỏi bảng.
  if (isVirtualMonth(monthKey)) {
    const all = rows.map((member) => ({
      name: member.name,
      paid: member.name === memberName ? entry.paid : (member.paid ?? 0),
      note: member.name === memberName ? entry.note : (member.note ?? ''),
      skip: member.name === memberName ? entry.skip : Boolean(member.skip),
    }));
    return firebaseApi().saveDuesRows(monthKey, formatMonthLabel(monthKey), all);
  }

  return firebaseApi().saveDuesEntry(monthKey, memberName, entry, formatMonthLabel(monthKey));
}

/** Dòng này chưa có số liệu gì: chưa đóng, không ghi chú, không "Không chơi". */
function isBlankDuesRow(row) {
  return !row.paid && !String(row.note ?? '').trim() && !row.skip;
}

/**
 * Thêm một người vào bảng đóng quỹ của các tháng từ tháng hiện tại trở đi.
 * Tháng nào đã có tên rồi thì bỏ qua, không ghi đè số liệu sẵn có.
 * @param {string} memberName
 */
export function addMemberToOpenMonths(memberName) {
  if (!isFirebaseMode()) return Promise.resolve();
  const fromMonth = getCurrentMonthKey();
  const targets = store.months.filter(
    (month) => month.month >= fromMonth && !month.members.some((member) => member.name === memberName),
  );
  return Promise.all(
    targets.map((month) =>
      firebaseApi().saveDuesEntry(
        month.month,
        memberName,
        { paid: 0, note: '', skip: false },
        formatMonthLabel(month.month),
      ),
    ),
  );
}

/**
 * Gỡ một người khỏi bảng đóng quỹ của các tháng từ tháng hiện tại trở đi.
 *
 * Chỉ gỡ những tháng người đó chưa có số liệu nào — tháng đã đóng tiền, có ghi
 * chú hay đánh dấu "Không chơi" thì giữ nguyên, vì đó là lịch sử. Tháng trước
 * tháng hiện tại cũng không đụng tới.
 * @param {string} memberName
 */
export function removeMemberFromOpenMonths(memberName) {
  if (!isFirebaseMode()) return Promise.resolve();
  const fromMonth = getCurrentMonthKey();
  const targets = store.months.filter((month) => {
    if (month.month < fromMonth) return false;
    const row = month.members.find((member) => member.name === memberName);
    return row && isBlankDuesRow(row);
  });
  return Promise.all(targets.map((month) => firebaseApi().removeDuesEntry(month.month, memberName)));
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
 * Tháng sắp được tạo tiếp theo: ngay sau tháng cuối cùng đã ghi.
 * Chưa có tháng nào thì lấy tháng hiện tại theo lịch.
 * @returns {string} khoá dạng "2026-11"
 */
export function getNextMonthToCreate() {
  const last = store.months[store.months.length - 1]?.month;
  return last ? getNextMonthKey(last) : getCurrentMonthKey();
}

/**
 * Tạo tháng mới với đúng những người đang được tick hoạt động, tất cả để "Chưa đóng".
 * @returns {Promise<{ok: boolean, month?: string, count?: number, error?: string}>}
 */
export async function createNextMonth() {
  if (!isFirebaseMode()) return { ok: false, error: 'Chế độ data.json chưa tạo được tháng mới.' };

  const monthKey = getNextMonthToCreate();
  if (!isVirtualMonth(monthKey)) return { ok: false, error: `${formatMonthLabel(monthKey)} đã có rồi.` };

  const names = getActiveMemberNames();
  if (!names.length) return { ok: false, error: 'Chưa có ai được tick hoạt động.' };

  const rows = names.map((name) => ({ name, paid: 0, note: '', skip: false }));
  try {
    await firebaseApi().saveDuesRows(monthKey, formatMonthLabel(monthKey), rows);
    return { ok: true, month: monthKey, count: rows.length };
  } catch (error) {
    return { ok: false, error: `Không lưu được: ${error?.message ?? error}` };
  }
}

/**
 * Xoá hẳn một tháng.
 *
 * Chỉ cho xoá tháng chưa có số liệu nào — chưa ai đóng, không ghi chú, không
 * đánh dấu "Không chơi". Tháng đã có số liệu là lịch sử, xoá là mất luôn.
 * @param {string} monthKey
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteMonth(monthKey) {
  if (!isFirebaseMode()) return { ok: false, error: 'Chế độ data.json chưa xoá được tháng.' };
  if (isVirtualMonth(monthKey)) {
    return { ok: false, error: `${formatMonthLabel(monthKey)} chưa có trong dữ liệu.` };
  }

  const dirty = getMonthMembers(monthKey).filter((member) => !isBlankDuesRow(member));
  if (dirty.length) {
    const names = dirty
      .slice(0, 3)
      .map((member) => member.name)
      .join(', ');
    return {
      ok: false,
      error:
        `${formatMonthLabel(monthKey)} đã có số liệu của ${dirty.length} người ` +
        `(${names}${dirty.length > 3 ? '…' : ''}) nên không xoá được.\n\n` +
        'Chỉ xoá được tháng chưa ai đóng, không ghi chú, không đánh dấu "Không chơi".',
    };
  }

  try {
    await firebaseApi().removeMonth(monthKey);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Không xoá được: ${error?.message ?? error}` };
  }
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
