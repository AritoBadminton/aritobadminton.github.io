/**
 * Điểm khởi động ứng dụng.
 *
 * Nhiệm vụ: gắn các thành phần giao diện, tải dữ liệu chung, rồi vẽ lần đầu.
 * Mọi nghiệp vụ nằm ở services/, mọi thao tác DOM nằm ở components/.
 */

import { initDashboardView, renderDashboard } from './components/dashboard-view.js';
import { initLedgerView, renderLedger, renderLedgerFilters } from './components/ledger-view.js';
import { applyAuthState, initLoginModal, restoreAuthState } from './components/login-modal.js';
import { initMembersView, renderMembers } from './components/members-view.js';
import { initMonthsView, renderMonthPicker, renderMonths } from './components/months-view.js';
import { initTabNav } from './components/tab-nav.js';
import { initThemeToggle } from './components/theme-toggle.js';
import { isFirebaseMode, loadFirebase } from './services/data-source.js';
import { fetchClubData } from './services/data-service.js';
import { buildDerivedState } from './services/sync-service.js';
import { registerRenderer, requestRender } from './state/render-bus.js';
import { store } from './state/store.js';
import { qs, setVisible } from './utils/dom.js';

/** Vẽ lại các ô lọc rồi vẽ lại bảng tương ứng. */
function renderLedgerWithFilters() {
  renderLedgerFilters();
  renderLedger();
}

/** Vẽ lại ô chọn tháng rồi vẽ lại bảng tháng. */
function renderMonthsWithPicker() {
  renderMonthPicker();
  renderMonths();
}

/** Đăng ký các hàm vẽ để service có thể yêu cầu vẽ lại mà không cần import view. */
function registerRenderers() {
  registerRenderer('dashboard', renderDashboard);
  registerRenderer('ledger', renderLedgerWithFilters);
  registerRenderer('members', renderMembers);
  registerRenderer('months', renderMonthsWithPicker);
}

/** Hiện thông báo khi không tải được dữ liệu. */
function showLoadError(error) {
  qs('#loading-state').innerHTML = isFirebaseMode()
    ? 'Không kết nối được Firebase.<br>' +
      `<span class="text-muted">${String(error?.message ?? error)}</span>`
    : 'Không tải được <code>data.json</code>.<br>' +
      '<span class="text-muted">Nếu bạn mở file trực tiếp từ máy, hãy mở qua GitHub Pages ' +
      'hoặc chạy một máy chủ cục bộ.</span>';
}

/** Hiện dữ liệu lần đầu và tắt màn hình chờ. */
function finishFirstPaint() {
  setVisible(qs('#loading-state'), false);
  if (!qs('.tab-panel.is-active')) qs('#panel-dashboard').classList.add('is-active');
}

/** Báo khi mất kết nối tới Firebase. */
function showSyncError(message) {
  qs('#sync-error').textContent = message;
  setVisible(qs('#sync-error'), true, 'flex');
}

/** Chế độ Firebase: nghe dữ liệu và trạng thái đăng nhập theo thời gian thực. */
async function startFirebaseMode() {
  document.body.classList.add('is-live');
  const firebase = await loadFirebase();

  firebase.watchAuth((state) => {
    store.isAdmin = Boolean(state?.isAdmin);
    store.authEmail = state?.email ?? '';
    applyAuthState();
  });

  firebase.watchClubData((data) => {
    setVisible(qs('#sync-error'), false);
    store.data = data;
    buildDerivedState();

    if (!data.months.length && !store.transactions.length) {
      qs('#loading-state').innerHTML =
        'Firestore chưa có dữ liệu.<br><span class="text-muted">Mở ' +
        '<a href="migrate.html">migrate.html</a> để chuyển số liệu từ <code>data.json</code> sang.</span>';
      setVisible(qs('#loading-state'), true);
      return;
    }

    finishFirstPaint();
    requestRender();
  }, showSyncError);
}

/** Chế độ data.json: tải một lần rồi vẽ. */
async function startStaticMode() {
  store.data = await fetchClubData();
  buildDerivedState();
  restoreAuthState();
  finishFirstPaint();
  requestRender();
}

/** Khởi động ứng dụng. */
async function bootstrap() {
  initThemeToggle();
  initTabNav();
  initDashboardView();
  initLoginModal();
  initLedgerView();
  initMembersView();
  initMonthsView();
  registerRenderers();

  try {
    if (isFirebaseMode()) await startFirebaseMode();
    else await startStaticMode();
  } catch (error) {
    showLoadError(error);
  }
}

bootstrap();
