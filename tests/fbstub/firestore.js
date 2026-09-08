/**
 * Firestore giả lập cho việc kiểm thử: giữ dữ liệu trong localStorage và phát
 * thay đổi qua BroadcastChannel, nhờ vậy hai cửa sổ cùng mở sẽ thấy nhau y như
 * onSnapshot thật. Chỉ dựng đủ phần API mà ứng dụng dùng tới.
 */
const KEY = '__fakestore__';
const channel = new BroadcastChannel('__fakestore__');
const listeners = new Set();

const readAll = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const writeAll = (data) => {
  localStorage.setItem(KEY, JSON.stringify(data));
  channel.postMessage('changed');
  queueMicrotask(fire);
};
const fire = () => listeners.forEach((fn) => fn());
channel.onmessage = () => fire();
window.addEventListener('storage', fire);

/** Ghép map lồng nhau, giống hành vi setDoc(..., {merge:true}) của Firestore. */
function deepMerge(target, patch) {
  const out = { ...(target ?? {}) };
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(out[key], value) : value;
  });
  return out;
}

export function getFirestore() {
  return { kind: 'fake-db' };
}
export function collection(_db, name) {
  return { type: 'collection', name };
}
export function doc(_db, name, id) {
  if (id === undefined) return { type: 'doc', name: name.split('/')[0], id: name.split('/')[1] };
  return { type: 'doc', name, id };
}

export function onSnapshot(ref, next, _error) {
  const emit = () => {
    const all = readAll();
    if (ref.type === 'doc') {
      const value = all[ref.name]?.[ref.id];
      next({ id: ref.id, exists: () => value !== undefined, data: () => value });
    } else {
      const bucket = all[ref.name] ?? {};
      next({ docs: Object.keys(bucket).map((id) => ({ id, data: () => bucket[id] })) });
    }
  };
  listeners.add(emit);
  queueMicrotask(emit);
  return () => listeners.delete(emit);
}

export async function getDoc(ref) {
  const value = readAll()[ref.name]?.[ref.id];
  return { id: ref.id, exists: () => value !== undefined, data: () => value };
}

export async function getDocs(ref) {
  const bucket = readAll()[ref.name] ?? {};
  const docs = Object.keys(bucket).map((id) => ({ id, data: () => bucket[id] }));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

export async function setDoc(ref, data, options = {}) {
  const all = readAll();
  all[ref.name] = all[ref.name] ?? {};
  all[ref.name][ref.id] = options.merge ? deepMerge(all[ref.name][ref.id], data) : data;
  writeAll(all);
}

const DELETE_MARK = { __delete__: true };

/** Đánh dấu một trường cần xoá hẳn, y như deleteField() của Firestore thật. */
export function deleteField() {
  return DELETE_MARK;
}

/** Đường dẫn trường nhiều đoạn — dùng khi tên có dấu cách hoặc dấu chấm. */
export class FieldPath {
  constructor(...segments) {
    this.segments = segments;
  }
}

/**
 * Hai dạng gọi như Firestore thật:
 *   updateDoc(ref, { a: 1 })
 *   updateDoc(ref, new FieldPath('dues', 'Võ Lâm'), deleteField())
 */
export async function updateDoc(ref, dataOrPath, value) {
  if (!(dataOrPath instanceof FieldPath)) return setDoc(ref, dataOrPath, { merge: true });

  const all = readAll();
  all[ref.name] = all[ref.name] ?? {};
  all[ref.name][ref.id] = all[ref.name][ref.id] ?? {};
  let node = all[ref.name][ref.id];
  const path = dataOrPath.segments;
  path.slice(0, -1).forEach((key) => {
    node[key] = node[key] ?? {};
    node = node[key];
  });
  const last = path.at(-1);
  if (value === DELETE_MARK) delete node[last];
  else node[last] = value;
  writeAll(all);
}

export async function addDoc(ref, data) {
  const id = `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const all = readAll();
  all[ref.name] = all[ref.name] ?? {};
  all[ref.name][id] = data;
  writeAll(all);
  return { id };
}

export async function deleteDoc(ref) {
  const all = readAll();
  if (all[ref.name]) delete all[ref.name][ref.id];
  writeAll(all);
}

export function writeBatch() {
  const queued = [];
  return {
    set: (ref, data, options) => queued.push(['set', ref, data, options]),
    delete: (ref) => queued.push(['delete', ref]),
    commit: async () => {
      for (const [op, ref, data, options] of queued) {
        if (op === 'delete') await deleteDoc(ref);
        else await setDoc(ref, data, options);
      }
    },
  };
}
