/**
 * Quy định đóng quỹ hiển thị ở trang Tổng quan.
 *
 * Quản trị viên sửa ngay trên trang; thay đổi nằm trong localStorage của máy đó
 * cho tới khi bấm "Lưu chung lên GitHub" và dán khối JSON vào data.json.
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { store } from '../state/store.js';
import { readJson, removeKey, writeJson } from './storage-service.js';

/** Các trường của một mức đóng, theo đúng thứ tự hiển thị. */
const RULE_FIELDS = ['amount', 'who', 'unit'];

/** Mức đóng trống dùng khi thêm dòng mới. */
const EMPTY_RULE_ITEM = { amount: '0đ', who: 'Nhóm mới', unit: 'mỗi tháng' };

/**
 * Chuẩn hoá một mức đóng về đủ 3 trường chuỗi.
 * @param {Record<string, unknown>} item
 * @returns {{amount: string, who: string, unit: string}}
 */
function normalizeItem(item) {
  return {
    amount: String(item?.amount ?? ''),
    who: String(item?.who ?? ''),
    unit: String(item?.unit ?? ''),
  };
}

/**
 * Danh sách mức đóng gốc trong data.json.
 * @returns {{amount: string, who: string, unit: string}[]}
 */
function getBaseItems() {
  return (store.data?.rules?.items ?? []).map(normalizeItem);
}

/** Nạp bản sửa đang lưu trên máy. */
export function loadLocalRuleChanges() {
  const stored = readJson(STORAGE_KEYS.RULES, null);
  store.ruleItemsOverride = Array.isArray(stored) ? stored.map(normalizeItem) : null;
}

/** Ghi bản sửa hiện tại xuống máy. */
function persistLocalRuleChanges() {
  if (store.ruleItemsOverride) writeJson(STORAGE_KEYS.RULES, store.ruleItemsOverride);
  else removeKey(STORAGE_KEYS.RULES);
}

/**
 * Danh sách mức đóng đang hiển thị: bản sửa cục bộ nếu có, không thì lấy data.json.
 * @returns {{amount: string, who: string, unit: string}[]}
 */
export function getEffectiveRuleItems() {
  return store.ruleItemsOverride ?? getBaseItems();
}

/**
 * Có đang khác dữ liệu chung hay không.
 * @returns {boolean}
 */
export function hasRuleChanges() {
  if (!store.ruleItemsOverride) return false;
  return JSON.stringify(store.ruleItemsOverride) !== JSON.stringify(getBaseItems());
}

/**
 * Sửa một trường của một mức đóng.
 * @param {number} index vị trí mức đóng
 * @param {string} field 'amount' | 'who' | 'unit'
 * @param {string} value
 */
export function setRuleField(index, field, value) {
  if (!RULE_FIELDS.includes(field)) return;
  const items = getEffectiveRuleItems().map(normalizeItem);
  if (!items[index]) return;
  items[index][field] = value;
  store.ruleItemsOverride = items;
  persistLocalRuleChanges();
}

/** Thêm một mức đóng trống vào cuối danh sách. */
export function addRuleItem() {
  store.ruleItemsOverride = [...getEffectiveRuleItems().map(normalizeItem), { ...EMPTY_RULE_ITEM }];
  persistLocalRuleChanges();
}

/**
 * Xoá một mức đóng.
 * @param {number} index
 */
export function removeRuleItem(index) {
  const items = getEffectiveRuleItems().map(normalizeItem);
  if (!items[index]) return;
  items.splice(index, 1);
  store.ruleItemsOverride = items;
  persistLocalRuleChanges();
}

/** Bỏ mọi thay đổi cục bộ, quay lại đúng data.json. */
export function resetRuleItems() {
  store.ruleItemsOverride = null;
  persistLocalRuleChanges();
}

/**
 * Khối JSON của mục "rules" để dán đè vào data.json.
 * @returns {string}
 */
export function buildRulesJson() {
  const rules = store.data?.rules ?? {};
  const items = getEffectiveRuleItems().map(
    (item) =>
      `      { "amount": ${JSON.stringify(item.amount)}, "unit": ${JSON.stringify(item.unit)}, ` +
      `"who": ${JSON.stringify(item.who)} }`,
  );
  const lines = [
    '  "rules": {',
    `    "title": ${JSON.stringify(rules.title ?? '')},`,
    `    "subtitle": ${JSON.stringify(rules.subtitle ?? '')},`,
    '    "items": [',
    items.join(',\n'),
    '    ],',
    `    "footer": ${JSON.stringify(rules.footer ?? '')}`,
    '  },',
  ];
  return lines.join('\n');
}
