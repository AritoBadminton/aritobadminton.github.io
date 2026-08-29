/** Các hàm bổ trợ về tháng, dùng khoá dạng "YYYY-MM". */

/**
 * Trả về khoá tháng kế tiếp: "2026-12" -> "2027-01".
 * @param {string} monthKey
 * @returns {string}
 */
export function getNextMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Sinh danh sách khoá tháng liên tiếp sau một tháng cho trước.
 * @param {string} startMonthKey
 * @param {number} count
 * @returns {string[]}
 */
export function getFollowingMonthKeys(startMonthKey, count) {
  const keys = [];
  let cursor = startMonthKey;
  for (let index = 0; index < count; index += 1) {
    cursor = getNextMonthKey(cursor);
    keys.push(cursor);
  }
  return keys;
}

/** Ngày hôm nay theo định dạng ISO "YYYY-MM-DD". */
export function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}
