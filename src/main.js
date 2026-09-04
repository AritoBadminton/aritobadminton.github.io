/**
 * Điểm khởi động ứng dụng.
 *
 * Nhiệm vụ: gắn các thành phần giao diện, tải dữ liệu chung, rồi vẽ lần đầu.
 * Mọi nghiệp vụ nằm ở services/, mọi thao tác DOM nằm ở components/.
 */

import { initDashboardView, renderDashboard } from './components/dashboard-view.js';
import { initLedgerView, renderLedger, renderLedgerFilters } from './components/ledger-view.js';
import { initLoginModal, restoreAuthState } from './components/login-modal.js';
import { initMembersView, renderMembers } from './components/members-view.js';
import { initMonthsView, renderMonthPicker, renderMonths } from './components/months-view.js';
import { initTabNav } from './components/tab-nav.js';
import { initThemeToggle } from './components/theme-toggle.js';
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
function showLoadError() {
  qs('#loading-state').innerHTML =
    'Không tải được <code>data.json</code>.<br>' +
    '<span class="text-muted">Nếu bạn mở file trực tiếp từ máy, hãy mở qua GitHub Pages ' +
    'hoặc chạy một máy chủ cục bộ.</span>';
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
    store.data = await fetchClubData();
  } catch {
    showLoadError();
    return;
  }

  buildDerivedState();
  restoreAuthState();
  setVisible(qs('#loading-state'), false);
  qs('#panel-dashboard').classList.add('is-active');
  requestRender();
}

bootstrap();
