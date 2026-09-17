/**
 * Địa chỉ CLB kèm link Google Maps, hiển thị ở trang Tổng quan.
 *
 * Quản trị viên sửa ngay trên trang; ở chế độ Firebase ghi thẳng lên Firestore
 * (chung một tài liệu settings/club với tên CLB), ở chế độ data.json thì nằm
 * trong localStorage của máy đó cho tới khi bấm "Lưu chung lên GitHub" và dán
 * khối JSON vào data.json.
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { store } from '../state/store.js';
import { firebaseApi, isFirebaseMode } from './data-source.js';
import { readJson, removeKey, writeJson } from './storage-service.js';

/** Địa chỉ gốc trong data.json. */
function getBaseAddress() {
  return {
    text: store.data?.address ?? '',
    mapLink: store.data?.mapLink ?? '',
  };
}

/** Nạp bản sửa đang lưu trên máy. */
export function loadLocalAddressChanges() {
  if (isFirebaseMode()) {
    store.addressOverride = null;
    return;
  }
  store.addressOverride = readJson(STORAGE_KEYS.ADDRESS, null);
}

/** Ghi bản sửa hiện tại xuống máy. */
function persistLocalAddressChanges() {
  if (store.addressOverride) writeJson(STORAGE_KEYS.ADDRESS, store.addressOverride);
  else removeKey(STORAGE_KEYS.ADDRESS);
}

/**
 * Địa chỉ đang hiển thị: bản sửa cục bộ nếu có, không thì lấy data.json.
 * @returns {{text: string, mapLink: string}}
 */
export function getEffectiveAddress() {
  return store.addressOverride ?? getBaseAddress();
}

/** Có đang khác dữ liệu chung hay không. */
export function hasAddressChanges() {
  if (!store.addressOverride) return false;
  return JSON.stringify(store.addressOverride) !== JSON.stringify(getBaseAddress());
}

/**
 * Sửa một trường của địa chỉ.
 * @param {'text'|'mapLink'} field
 * @param {string} value
 */
export function setAddressField(field, value) {
  if (field !== 'text' && field !== 'mapLink') return;
  const current = { ...getEffectiveAddress(), [field]: value };
  if (isFirebaseMode()) return firebaseApi().saveClubAddress(current.text, current.mapLink);
  store.addressOverride = current;
  persistLocalAddressChanges();
}

/** Bỏ mọi thay đổi cục bộ, quay lại đúng data.json. */
export function resetAddress() {
  store.addressOverride = null;
  persistLocalAddressChanges();
}

/**
 * Khối JSON của địa chỉ để dán đè vào data.json.
 * @returns {string}
 */
export function buildAddressJson() {
  const address = getEffectiveAddress();
  return [
    `  "address": ${JSON.stringify(address.text)},`,
    `  "mapLink": ${JSON.stringify(address.mapLink)},`,
  ].join('\n');
}
