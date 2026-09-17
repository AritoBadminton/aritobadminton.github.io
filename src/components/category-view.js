/** Trang Danh mục giao dịch (chỉ admin): bảng danh mục, form thêm/sửa, xác nhận xoá. */

import {
  addCategory,
  canManageCategories,
  deleteCategory,
  findCategoryByName,
  getAllCategories,
  isCategoryInUse,
  updateCategory,
} from '../services/category-service.js';
import { requestRender } from '../state/render-bus.js';
import { escapeHtml, qs, qsa, setVisible, showToast } from '../utils/dom.js';
import { formatCurrency, formatNumber, parseAmount } from '../utils/format.js';

/** Biểu tượng cây bút, dùng chung với nút "Cập nhật" ở Sổ thu chi. */
const EDIT_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>`;

/* ---------- Trạng thái riêng của trang ---------- */

let filterType = 'all';

/** Id danh mục đang sửa, rỗng khi hộp thoại đang ở chế độ thêm mới hoặc đang đóng. */
let editingCategoryId = '';

/** Id danh mục đang chờ xác nhận xoá, rỗng khi hộp thoại đang đóng. */
let deleteTargetId = '';

/* ---------- Form thêm/sửa ---------- */

/** Mở hộp thoại ở chế độ thêm mới, ô trống, loại theo bộ lọc đang chọn. */
function openNewCategoryModal() {
  editingCategoryId = '';
  qs('#category-heading').textContent = 'Thêm danh mục';
  qs('#category-message').textContent = '';
  qs('#category-name').value = '';
  qs('#category-name').disabled = false;
  qs('#category-color').value = '#2a78d6';
  qs('#category-amount').value = '';
  qs('#category-desc').value = '';
  setVisible(qs('#category-protected-note'), false);

  const type = filterType === 'thu' ? 'thu' : 'chi';
  qsa('#category-type-toggle .segmented__item').forEach((item) => {
    item.setAttribute('aria-pressed', String(item.dataset.type === type));
  });
  qs('#category-modal').hidden = false;
}

/**
 * Mở hộp thoại ở chế độ sửa, điền sẵn dữ liệu của danh mục đang chọn.
 *
 * Danh mục đánh dấu `protected` (khoản quỹ công ty hàng tháng) khoá cứng ô
 * Tên — công thức "Tiền quỹ công ty cấp" so khớp theo đúng tên này.
 * @param {string} id
 */
function openEditCategoryModal(id) {
  const category = getAllCategories().find((item) => item.id === id);
  if (!category) return;

  editingCategoryId = id;
  qs('#category-heading').textContent = 'Sửa danh mục';
  qs('#category-message').textContent = '';
  qs('#category-name').value = category.name;
  qs('#category-name').disabled = Boolean(category.protected);
  qs('#category-color').value = category.color;
  qs('#category-amount').value = category.defaultAmount ? formatNumber(category.defaultAmount) : '';
  qs('#category-desc').value = category.defaultDesc ?? '';
  setVisible(qs('#category-protected-note'), Boolean(category.protected), 'block');

  qsa('#category-type-toggle .segmented__item').forEach((item) => {
    item.setAttribute('aria-pressed', String(item.dataset.type === category.type));
  });
  qs('#category-modal').hidden = false;
}

/** Đóng hộp thoại thêm/sửa. */
function closeCategoryModal() {
  editingCategoryId = '';
  qs('#category-modal').hidden = true;
}

/** Lưu nội dung form: sửa danh mục đang sửa, hoặc tạo danh mục mới. */
async function handleSaveCategory() {
  const type = qs('#category-type-toggle .segmented__item[aria-pressed="true"]').dataset.type;
  const name = qs('#category-name').value.trim();
  const color = qs('#category-color').value;
  const defaultAmount = parseAmount(qs('#category-amount').value);
  const defaultDesc = qs('#category-desc').value.trim();
  const message = qs('#category-message');

  if (!name) {
    message.textContent = 'Cần điền tên danh mục.';
    message.style.color = 'var(--crit)';
    return;
  }
  const clash = findCategoryByName(name);
  if (clash && clash.id !== editingCategoryId) {
    message.textContent = 'Đã có danh mục khác trùng tên này.';
    message.style.color = 'var(--crit)';
    return;
  }

  const fields = { type, name, color, defaultAmount, defaultDesc };
  if (editingCategoryId) await updateCategory(editingCategoryId, fields);
  else await addCategory(fields);

  closeCategoryModal();
  requestRender('categories');
  showToast('Đã thực hiện xong');
}

/* ---------- Xoá ---------- */

/**
 * Mở hộp thoại hỏi xác nhận trước khi xoá. Danh mục đã có giao dịch dùng thì
 * chặn hẳn ở đây — nút xoá của dòng đó vốn đã không hiện ra
 * (`renderCategoryGrid`), hàm này chỉ là chốt chặn thứ hai.
 * @param {string} id
 */
function openDeleteConfirm(id) {
  const category = getAllCategories().find((item) => item.id === id);
  if (!category || isCategoryInUse(category.name)) return;

  deleteTargetId = id;
  qs('#category-delete-text').textContent =
    `Bạn có chắc muốn xoá danh mục "${category.name}" không? Không thể hoàn tác.`;
  qs('#category-delete-modal').hidden = false;
}

/** Đóng hộp thoại xác nhận xoá mà không làm gì cả. */
function closeDeleteConfirm() {
  deleteTargetId = '';
  qs('#category-delete-modal').hidden = true;
}

/** Xác nhận xoá: xoá danh mục, vẽ lại bảng, rồi báo thành công bằng toast tự ẩn. */
async function handleConfirmDelete() {
  if (!deleteTargetId) return;
  await deleteCategory(deleteTargetId);
  closeDeleteConfirm();
  requestRender('categories');
  showToast('Đã xoá thành công');
}

/* ---------- Vẽ giao diện ---------- */

/** Vẽ lại bảng danh mục giao dịch. */
export function renderCategoryGrid() {
  const canManage = canManageCategories();
  setVisible(qs('#category-add-toggle'), canManage, 'inline-flex');

  const showCode = qs('#category-show-code').checked;
  qsa('.category-code-col').forEach((cell) => setVisible(cell, showCode, 'table-cell'));

  const rows = getAllCategories()
    .filter((item) => filterType === 'all' || item.type === filterType)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  qs('#category-table').innerHTML = rows.length
    ? rows
        .map((row) => {
          const inUse = isCategoryInUse(row.name);
          return `<tr>
        <td><i class="color-dot" style="background:${row.color}"></i></td>
        <td class="category-code-col" style="display:${showCode ? 'table-cell' : 'none'}">${escapeHtml(row.code ?? '')}</td>
        <td class="cell-name">${escapeHtml(row.name)}
          ${row.protected ? '<span class="pill pill--merged" title="Gắn với công thức Tiền quỹ công ty cấp">khoá tên</span>' : ''}
        </td>
        <td><span class="pill ${row.type === 'thu' ? 'pill--income' : 'pill--expense'}">${row.type === 'thu' ? 'Thu' : 'Chi'}</span></td>
        <td class="cell-num">${row.defaultAmount ? formatCurrency(row.defaultAmount) : '—'}</td>
        <td>${escapeHtml(row.defaultDesc || '—')}</td>
        <td style="white-space:nowrap">
          ${
            canManage
              ? `<button class="btn--row-action js-category-edit" data-id="${row.id}" type="button"
                  title="Sửa danh mục này" aria-label="Sửa danh mục ${escapeHtml(row.name)}">${EDIT_ICON}</button>
                ${
                  inUse
                    ? ''
                    : `<button class="btn--delete js-category-delete" data-id="${row.id}" type="button"
                        title="Xoá danh mục này" aria-label="Xoá danh mục ${escapeHtml(row.name)}">×</button>`
                }`
              : ''
          }
        </td>
      </tr>`;
        })
        .join('')
    : '<tr><td colspan="7" class="table-empty text-muted">Chưa có danh mục nào</td></tr>';

  qsa('#category-table .js-category-edit').forEach((button) => {
    button.addEventListener('click', () => openEditCategoryModal(button.dataset.id));
  });
  qsa('#category-table .js-category-delete').forEach((button) => {
    button.addEventListener('click', () => openDeleteConfirm(button.dataset.id));
  });

  qs('#category-count').textContent = `${rows.length} danh mục`;
}

/* ---------- Khởi tạo ---------- */

/** Gắn toàn bộ sự kiện cho trang Danh mục giao dịch. */
export function initCategoryView() {
  qsa('#category-filter-type .segmented__item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('#category-filter-type .segmented__item').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      filterType = button.dataset.type;
      renderCategoryGrid();
    });
  });

  qs('#category-show-code').addEventListener('change', renderCategoryGrid);
  qs('#category-amount').addEventListener('input', () => {
    const digits = parseAmount(qs('#category-amount').value);
    qs('#category-amount').value = digits ? formatNumber(digits) : '';
  });

  qs('#category-add-toggle').addEventListener('click', openNewCategoryModal);
  qs('#category-cancel').addEventListener('click', closeCategoryModal);
  qs('#category-save').addEventListener('click', handleSaveCategory);
  qs('#category-delete-cancel').addEventListener('click', closeDeleteConfirm);
  qs('#category-delete-ok').addEventListener('click', handleConfirmDelete);

  [
    ['#category-modal', closeCategoryModal],
    ['#category-delete-modal', closeDeleteConfirm],
  ].forEach(([selector, close]) => {
    qs(selector).addEventListener('click', (event) => {
      if (event.target.id === selector.slice(1)) close();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!qs('#category-modal').hidden) closeCategoryModal();
    if (!qs('#category-delete-modal').hidden) closeDeleteConfirm();
  });
}
