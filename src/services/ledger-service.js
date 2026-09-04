/**
 * Nghiệp vụ sổ thu chi: gộp dữ liệu gốc với các khoản thêm mới và sửa đổi
 * đang lưu trên máy người dùng.
 *
 * Id giao dịch có hai dạng:
 *   - "chi#12" / "thu#3": dòng vốn có trong data.json, số là vị trí trong mảng.
 *   - "n<timestamp><random>": dòng mới nhập trên máy, chưa lưu vào data.json.
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { store } from '../state/store.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import { readJson, writeJson } from './storage-service.js';

const INCOME_PREFIX = 'thu';
const EXPENSE_PREFIX = 'chi';

/**
 * Gắn id và áp dụng sửa đổi lên một mảng giao dịch gốc.
 * @param {object[]} source
 * @param {string} prefix
 * @returns {object[]}
 */
function withOverrides(source, prefix) {
  return source.map((item, index) => {
    const id = `${prefix}#${index}`;
    return { ...item, ...(store.editedTransactions[id] ?? {}), id, edited: id in store.editedTransactions };
  });
}

/** Toàn bộ khoản thu đang hiệu lực. */
export function getAllIncomes() {
  if (isFirebaseMode()) return store.data.incomes;
  return withOverrides(store.data.incomes, INCOME_PREFIX).concat(store.addedTransactions.incomes);
}

/** Toàn bộ khoản chi đang hiệu lực. */
export function getAllExpenses() {
  if (isFirebaseMode()) return store.data.expenses;
  return withOverrides(store.data.expenses, EXPENSE_PREFIX).concat(store.addedTransactions.expenses);
}

/** Dựng lại danh sách giao dịch gộp trong store. */
export function rebuildTransactions() {
  store.transactions = [
    ...getAllIncomes().map((item) => ({ ...item, type: INCOME_PREFIX })),
    ...getAllExpenses().map((item) => ({ ...item, type: EXPENSE_PREFIX })),
  ];
}

/** Nạp các khoản thêm mới và sửa đổi đã lưu trên máy. */
export function loadLocalLedgerChanges() {
  const added = readJson(STORAGE_KEYS.LEDGER_ADDED, null);
  if (added?.incomes && added?.expenses) store.addedTransactions = added;
  store.editedTransactions = readJson(STORAGE_KEYS.LEDGER_EDITED, {});
}

/** Lưu các khoản thêm mới và sửa đổi xuống máy. */
export function persistLocalLedgerChanges() {
  writeJson(STORAGE_KEYS.LEDGER_ADDED, store.addedTransactions);
  writeJson(STORAGE_KEYS.LEDGER_EDITED, store.editedTransactions);
}

/**
 * Lưu xuống máy, dựng lại danh sách gộp và bỏ những dòng đã chọn nhưng không
 * còn tồn tại. Mọi hàm ghi bên dưới đều kết thúc bằng lời gọi này để giao diện
 * không bao giờ đọc phải dữ liệu cũ.
 */
function commitLedgerChange() {
  persistLocalLedgerChanges();
  rebuildTransactions();
  const availableIds = new Set(store.transactions.map((item) => item.id));
  [...store.selectedTransactionIds].forEach((id) => {
    if (!availableIds.has(id)) store.selectedTransactionIds.delete(id);
  });
}

/**
 * Thêm một giao dịch mới.
 * @param {'thu'|'chi'} type
 * @param {{date: string, amount: number, desc: string, cat: string}} fields
 */
export function addTransaction(type, fields) {
  if (isFirebaseMode()) {
    return firebaseApi().addTransaction({ type, ...fields });
  }
  const record = {
    id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    ...fields,
    isNew: true,
  };
  const bucket = type === INCOME_PREFIX ? 'incomes' : 'expenses';
  store.addedTransactions[bucket].push(record);
  commitLedgerChange();
}

/**
 * Xoá một giao dịch mới nhập (không áp dụng cho dòng vốn có trong data.json).
 * @param {string} id
 */
export function removeAddedTransaction(id) {
  if (isFirebaseMode()) return firebaseApi().deleteTransaction(id);
  store.addedTransactions.incomes = store.addedTransactions.incomes.filter((item) => item.id !== id);
  store.addedTransactions.expenses = store.addedTransactions.expenses.filter((item) => item.id !== id);
  commitLedgerChange();
}

/**
 * Áp dụng sửa đổi lên một giao dịch, tự bỏ ghi đè nếu sửa về đúng bản gốc.
 * @param {string} id
 * @param {object} patch các trường cần đổi
 */
export function updateTransaction(id, patch) {
  if (isFirebaseMode()) {
    return firebaseApi().updateTransaction(id, patch);
  }
  if (id.startsWith('n')) {
    ['incomes', 'expenses'].forEach((bucket) => {
      const target = store.addedTransactions[bucket].find((item) => item.id === id);
      if (target) Object.assign(target, patch);
    });
    commitLedgerChange();
    return;
  }

  store.editedTransactions[id] = { ...(store.editedTransactions[id] ?? {}), ...patch };

  const [prefix, index] = id.split('#');
  const original = (prefix === INCOME_PREFIX ? store.data.incomes : store.data.expenses)[Number(index)];
  const isBackToOriginal =
    original &&
    ['date', 'amount', 'desc', 'cat'].every((field) => {
      const value = store.editedTransactions[id][field];
      return value === undefined || value === original[field];
    });
  if (isBackToOriginal) delete store.editedTransactions[id];

  commitLedgerChange();
}

/**
 * Bỏ mọi sửa đổi trên các dòng vốn có, trả về đúng như data.json.
 * @param {string[]} ids
 */
export function revertTransactions(ids) {
  ids.filter((id) => !id.startsWith('n')).forEach((id) => delete store.editedTransactions[id]);
  commitLedgerChange();
}

/** Bỏ toàn bộ khoản mới và sửa đổi chưa lưu chung. */
export function discardAllLedgerChanges() {
  store.addedTransactions = { incomes: [], expenses: [] };
  store.editedTransactions = {};
  store.selectedTransactionIds.clear();
  commitLedgerChange();
}

/** Số lượng thay đổi chưa lưu chung. */
export function countPendingLedgerChanges() {
  if (isFirebaseMode()) return 0;
  return {
    added: store.addedTransactions.incomes.length + store.addedTransactions.expenses.length,
    addedIncomes: store.addedTransactions.incomes.length,
    addedExpenses: store.addedTransactions.expenses.length,
    edited: Object.keys(store.editedTransactions).length,
  };
}

/**
 * Có sửa đổi trên nhóm thu hay chi hay không.
 * @param {'thu'|'chi'} prefix
 */
export function hasEditsIn(prefix) {
  return Object.keys(store.editedTransactions).some((key) => key.startsWith(`${prefix}#`));
}

/** Gộp thu/chi theo từng tháng, sắp xếp tăng dần. */
export function getMonthlyTotals() {
  const totals = {};
  store.transactions.forEach((item) => {
    const monthKey = item.date.slice(0, 7);
    totals[monthKey] ??= { month: monthKey, thu: 0, chi: 0 };
    totals[monthKey][item.type] += item.amount;
  });
  return Object.values(totals).sort((a, b) => (a.month < b.month ? -1 : 1));
}
