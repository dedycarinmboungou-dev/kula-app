/* ─── Kula — Frontend Application ─────────────────────────────────────────── */

// ── Auth guard ────────────────────────────────────────────────────────────────
(function () {
  const token = localStorage.getItem('kula_token');
  if (!token) { window.location.href = '/auth.html'; return; }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('kula_token');
      localStorage.removeItem('kula_user');
      window.location.href = '/auth.html';
    }
  } catch (_) {
    localStorage.removeItem('kula_token');
    window.location.href = '/auth.html';
  }
})();

// ── Auth helpers ───────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('kula_token') || ''; }

function getUser() {
  try { return JSON.parse(localStorage.getItem('kula_user') || '{}'); }
  catch { return {}; }
}

function logout() {
  localStorage.removeItem('kula_token');
  localStorage.removeItem('kula_user');
  // Clear cached API data so the next user doesn't see stale data
  if ('caches' in window) caches.delete('kula-data-cache').catch(() => {});
  window.location.href = '/auth.html';
}

// ── Profile cache (loaded once at startup, used everywhere) ───────────────────
const profile = { photo: null, initial: 'K', name: '' };

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  currentTab: 'dashboard',
  currentMonth: new Date().toISOString().slice(0, 7),
  txFilter: 'all',
  txMonth: new Date().toISOString().slice(0, 7),
  chatHistory: [],
  pendingTransaction: null,
  charts: { category: null, trend: null },
  budgets:  {},        // {category: limite} for current month
  userCats: [],        // [{id, nom, icone, couleur, type}] loaded from API
  recentTransactions: [], // populated by loadDashboard(), read by initNotifications()
  // ── Multi-projects ──
  projects: [],        // [{id, name, type, role, owner_id}]
  currentProjectId: parseInt(localStorage.getItem('kula_project_id') || '0') || null,
};

// ── Project metadata (Lucide icons + labels per type) ────────────────────────
const PROJECT_TYPES = {
  perso:      { lucide: 'home',      labelKey: 'project_type_perso' },
  entreprise: { lucide: 'briefcase', labelKey: 'project_type_entreprise' },
  asso:       { lucide: 'heart',     labelKey: 'project_type_asso' },
  event:      { lucide: 'calendar',  labelKey: 'project_type_event' }
};

// Trigger Lucide to upgrade <i data-lucide> nodes into SVG. Call after dynamic renders.
function refreshIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons(); } catch { /* silent */ }
  }
}

// Returns the HTML for a Lucide icon. Optional size + class.
function icon(name, { size = 18, cls = '' } = {}) {
  return `<i data-lucide="${name}" class="lucide-icon ${cls}" style="width:${size}px;height:${size}px"></i>`;
}

// Returns the currently-active project or null.
function currentProject() {
  return state.projects.find(p => p.id === state.currentProjectId) || null;
}

// Append project_id to API path (query string). Use for routes that need scoping.
function withProject(path) {
  if (!state.currentProjectId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}project_id=${state.currentProjectId}`;
}

// ── Category metadata ─────────────────────────────────────────────────────────
const CATEGORIES = {
  Salaire:          { icon: '💼', color: '#10B981' },
  Business:         { icon: '🏢', color: '#059669' },
  Famille:          { icon: '👨‍👩‍👧', color: '#34D399' },
  'Solde initial':  { icon: '🏦', color: '#0EA5E9' },
  Alimentation:     { icon: '🛒', color: '#EF4444' },
  Transport:        { icon: '🚌', color: '#F97316' },
  Loisirs:          { icon: '🎉', color: '#A855F7' },
  Vêtements:        { icon: '👗', color: '#EC4899' },
  Santé:            { icon: '🏥', color: '#14B8A6' },
  Éducation:        { icon: '📚', color: '#3B82F6' },
  Téléphone:        { icon: '📱', color: '#8B5CF6' },
  Logement:         { icon: '🏠', color: '#F59E0B' },
  Autre:            { icon: '📦', color: '#6B7280' }
};

// ── Offline data banner ───────────────────────────────────────────────────────
function showOfflineDataBanner(cachedAt) {
  const bar = document.getElementById('offline-data-bar');
  if (!bar) return;
  const when = cachedAt
    ? new Date(parseInt(cachedAt)).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : t('offline_last');
  bar.querySelector('.offline-data-text').textContent = `${t('offline_data')} ${when}`;
  bar.style.display = 'flex';
}
function hideOfflineDataBanner() {
  const bar = document.getElementById('offline-data-bar');
  if (bar) bar.style.display = 'none';
}

// ── Category meta helper (merges user custom cats + hardcoded defaults) ───────
function getCatMeta(nom) {
  const u = state.userCats.find(c => c.nom === nom);
  if (u) return { icon: u.icone, color: u.couleur };
  return CATEGORIES[nom] || { icon: '📦', color: '#6B7280' };
}

async function loadUserCategories() {
  try {
    const cats = await api('/api/categories');
    state.userCats = cats || [];
  } catch { /* silent — fall back to hardcoded CATEGORIES */ }
}

// ── Offline queue ─────────────────────────────────────────────────────────────
const OFFLINE_KEY = 'kula_offline_queue';

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); }
  catch { return []; }
}

function enqueueOffline(tx) {
  const q = getOfflineQueue();
  q.push({ ...tx, _queuedAt: Date.now() });
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
  renderOfflineBadge();
}

function renderOfflineBadge() {
  const q   = getOfflineQueue();
  const bar = document.getElementById('offline-sync-bar');
  if (!bar) return;
  if (q.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  document.getElementById('offline-sync-count').textContent =
    `${q.length} ${t('tx_pending')}`;
}

async function syncOfflineQueue() {
  const q = getOfflineQueue();
  if (!q.length || !navigator.onLine) return;
  let synced = 0;
  const remaining = [];
  for (const tx of q) {
    const { _queuedAt, ...txData } = tx; // eslint-disable-line no-unused-vars
    try {
      await api(withProject('/api/transactions'), { method: 'POST', body: JSON.stringify(txData) });
      synced++;
    } catch {
      remaining.push(tx);
    }
  }
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  renderOfflineBadge();
  if (synced > 0) {
    showToast(`${synced} ${t('synced_msg')}`, 'success');
    loadDashboard();
  }
}

// ── Notification safety helper (iOS Safari has no Notification API) ───────────
const notifGranted = () =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

// ── Currency ──────────────────────────────────────────────────────────────────
const CURRENCY_CONFIG = {
  XOF: { symbol: 'FCFA', rate: 1,       decimals: 0, prefix: false },
  USD: { symbol: '$',    rate: 1/655,    decimals: 2, prefix: true  },
  EUR: { symbol: '€',    rate: 1/655.957, decimals: 2, prefix: false }
};

function getUserCurrency() {
  return localStorage.getItem('kula_currency') || 'XOF';
}

function getCurrencySymbol() {
  return CURRENCY_CONFIG[getUserCurrency()]?.symbol || 'FCFA';
}

/** Convert a user-entered amount (in display currency) back to XOF for storage */
function toXOF(displayAmount) {
  const cur = getUserCurrency();
  const rate = CURRENCY_CONFIG[cur]?.rate || 1;
  return Math.round(displayAmount / rate);
}

/** Convert an XOF amount to display currency and format it with symbol */
function formatMoney(amountXOF) {
  if (typeof amountXOF !== 'number') amountXOF = parseFloat(amountXOF) || 0;
  const cur = getUserCurrency();
  const cfg = CURRENCY_CONFIG[cur] || CURRENCY_CONFIG.XOF;
  const converted = Math.abs(amountXOF) * cfg.rate;
  const formatted = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals
  }).format(cfg.decimals ? converted : Math.round(converted));
  if (cfg.prefix) return `${cfg.symbol}${formatted}`;
  return `${formatted} ${cfg.symbol}`;
}

// ── Formatting ────────────────────────────────────────────────────────────────
/** Format number only (no symbol) — still used internally */
function formatAmount(amount) {
  if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(Math.abs(amount)));
}

function getLocale() {
  return (localStorage.getItem('kula_lang') || 'fr') === 'en' ? 'en-US' : 'fr-FR';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function openExportModal() {
  const modal = document.getElementById('pdf-modal');
  const sel   = document.getElementById('pdf-month-select');
  const prev  = document.getElementById('pdf-preview-title');

  // Populate months
  const now = new Date();
  sel.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const lbl = d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }

  // Update preview title on change
  function updatePreview() {
    const lbl = sel.options[sel.selectedIndex]?.text || '';
    prev.textContent = `${t('report_kula')} — ${lbl}`;
  }
  sel.onchange = updatePreview;
  updatePreview();

  modal.style.display = 'flex';
}

async function downloadPDF() {
  const sel   = document.getElementById('pdf-month-select');
  const month = sel.value;
  const btn   = document.getElementById('btn-pdf-download');
  const label = document.getElementById('pdf-btn-label');

  btn.disabled = true;
  label.textContent = t('generating');

  try {
    const res = await fetch(withProject(`/api/report/pdf?month=${month}`), {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: t('unknown_error') }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const lbl  = sel.options[sel.selectedIndex]?.text || month;
    a.href     = url;
    a.download = `kula-rapport-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('pdf-modal').style.display = 'none';
    showToast(t('report_downloaded'), 'success');
  } catch (err) {
    showToast(`${t('error_prefix')} : ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = t('download_pdf');
  }
}

// ── Month calendar picker ─────────────────────────────────────────────────────
const monthCal = {
  target: null,       // 'dashboard' | 'transactions'
  year: new Date().getFullYear(),
  initialized: false
};

function getMonthShortNames() {
  const names = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(2026, m, 1);
    let lbl = d.toLocaleDateString(getLocale(), { month: 'short' });
    names.push(lbl.charAt(0).toUpperCase() + lbl.slice(1));
  }
  return names;
}

function updateMonthLabels() {
  const dashLabel = document.getElementById('month-picker-label');
  const txLabel   = document.getElementById('tx-month-picker-label');
  if (dashLabel) dashLabel.textContent = formatMonthLabel(state.currentMonth);
  if (txLabel)   txLabel.textContent   = formatMonthLabel(state.txMonth);
}

function openMonthCal(target) {
  monthCal.target = target;
  const selected = target === 'transactions' ? state.txMonth : state.currentMonth;
  monthCal.year = parseInt(selected.split('-')[0]);
  renderMonthCal(selected);
  document.getElementById('month-cal-overlay').style.display = 'flex';
}

function closeMonthCal() {
  document.getElementById('month-cal-overlay').style.display = 'none';
}

function renderMonthCal(selectedMonth) {
  const now       = new Date();
  const nowMonth  = now.toISOString().slice(0, 7);
  const names     = getMonthShortNames();
  const grid      = document.getElementById('month-cal-grid');
  const yearLabel = document.getElementById('month-cal-year');

  yearLabel.textContent = monthCal.year;

  grid.innerHTML = names.map((name, i) => {
    const val   = `${monthCal.year}-${String(i + 1).padStart(2, '0')}`;
    const isFuture   = val > nowMonth;
    const isCurrent  = val === nowMonth;
    const isSelected = val === selectedMonth;
    const cls = 'month-cal-cell'
      + (isSelected ? ' selected' : '')
      + (isCurrent && !isSelected ? ' current' : '')
      + (isFuture ? ' future' : '');
    return `<button class="${cls}" data-month="${val}">${name}</button>`;
  }).join('');

  grid.querySelectorAll('.month-cal-cell:not(.future)').forEach(btn => {
    btn.addEventListener('click', () => {
      const month = btn.dataset.month;
      if (monthCal.target === 'transactions') {
        state.txMonth = month;
        loadTransactions();
      } else {
        state.currentMonth = month;
        state.txMonth = month;
        loadDashboard();
      }
      updateMonthLabels();
      closeMonthCal();
    });
  });
}

function initMonthSelectors() {
  // Always sync to real current month on init
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  if (state.currentMonth > currentMonth || state.currentMonth < '2024-01') {
    state.currentMonth = currentMonth;
    state.txMonth = currentMonth;
  }

  updateMonthLabels();

  if (!monthCal.initialized) {
    monthCal.initialized = true;

    // Dashboard month picker button
    document.getElementById('month-picker-btn').addEventListener('click', () => openMonthCal('dashboard'));

    // Transactions month picker button
    document.getElementById('tx-month-picker-btn').addEventListener('click', () => openMonthCal('transactions'));

    // Close on overlay click
    document.getElementById('month-cal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeMonthCal();
    });

    // Year navigation
    document.getElementById('month-cal-prev').addEventListener('click', () => {
      monthCal.year--;
      const selected = monthCal.target === 'transactions' ? state.txMonth : state.currentMonth;
      renderMonthCal(selected);
    });
    document.getElementById('month-cal-next').addEventListener('click', () => {
      const maxYear = new Date().getFullYear();
      if (monthCal.year < maxYear) {
        monthCal.year++;
        const selected = monthCal.target === 'transactions' ? state.txMonth : state.currentMonth;
        renderMonthCal(selected);
      }
    });

    // Re-sync month labels when app returns to foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const fresh = new Date().toISOString().slice(0, 7);
        if (state.currentMonth > fresh) {
          state.currentMonth = fresh;
          state.txMonth = fresh;
        }
        updateMonthLabels();
        loadDashboard();
      }
    });
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };

  // Abort after 30 s — prevents infinite freeze on Railway cold start
  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30_000);

  let res;
  try {
    res = await fetch(path, { headers, signal: ctrl.signal, ...opts });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(t('error_timeout'));
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    logout();
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── Tab navigation ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.currentTab = tab;

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-fab').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add('active');

  const navBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (tab === 'dashboard') loadDashboard();
  if (tab === 'transactions') loadTransactions();
  if (tab === 'epargne') loadPoches();
  if (tab === 'chat') {
    setTimeout(() => {
      const cm = document.getElementById('chat-messages');
      cm.scrollTop = cm.scrollHeight;
      document.getElementById('chat-input').focus();
    }, 100);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS — multi-project selector, creation, management
// ══════════════════════════════════════════════════════════════════════════════

async function loadProjects() {
  try {
    const projects = await api('/api/projects');
    state.projects = projects || [];
    // If currentProjectId is invalid (not in list), pick the Personnel project or first
    if (!state.projects.find(p => p.id === state.currentProjectId)) {
      const perso = state.projects.find(p => p.type === 'perso' && p.role === 'owner');
      state.currentProjectId = (perso || state.projects[0])?.id || null;
      if (state.currentProjectId) localStorage.setItem('kula_project_id', String(state.currentProjectId));
    }
    renderProjectBar();
  } catch (e) {
    console.error('[projects] load failed:', e.message);
  }
}

function renderProjectBar() {
  const bar = document.getElementById('project-bar');
  if (!bar) return;
  const cur = currentProject();
  if (!cur) { bar.style.display = 'none'; return; }
  bar.style.display = 'inline-flex';
  // Per spec: no type icon in the pill, just the project name and a chevron-down on the right
  document.getElementById('project-bar-name').textContent = cur.name;
  refreshIcons();
  // Update the "Manage budgets" button label depending on project type
  const manageLabel = document.querySelector('#btn-budgets [data-i18n="manage_budgets"], #btn-budgets [data-i18n="manage_budget"]');
  if (manageLabel) {
    const key = cur.type === 'perso' ? 'manage_budgets' : 'manage_budget';
    manageLabel.setAttribute('data-i18n', key);
    manageLabel.textContent = t(key);
  }
}

function selectProject(id) {
  if (id === state.currentProjectId) { closeProjectSheet(); return; }
  state.currentProjectId = id;
  localStorage.setItem('kula_project_id', String(id));
  renderProjectBar();
  closeProjectSheet();
  // Refresh active tab data
  if (state.currentTab === 'dashboard') loadDashboard();
  if (state.currentTab === 'transactions') loadTransactions();
  if (state.currentTab === 'epargne') loadPoches();
  // Reset chat history (it's project-scoped contextually)
  state.chatHistory = [];
  showToast(t('project_switched'), 'success');
}

function openProjectSheet() {
  const overlay = document.getElementById('project-sheet-overlay');
  if (!overlay) return;
  renderProjectSheet();
  overlay.style.display = 'flex';
  // Hide create-form by default
  document.getElementById('project-create-form').style.display = 'none';
  document.getElementById('project-list-section').style.display = 'block';
}

function closeProjectSheet() {
  const overlay = document.getElementById('project-sheet-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderProjectSheet() {
  const list = document.getElementById('project-sheet-list');
  if (!list) return;
  list.innerHTML = state.projects.map(p => {
    const meta = PROJECT_TYPES[p.type] || PROJECT_TYPES.perso;
    const active = p.id === state.currentProjectId ? 'active' : '';
    const isOwner = p.role === 'owner';
    const memberBadge = !isOwner ? `<span class="project-item-badge">${icon('users', { size: 14 })}</span>` : '';
    const checkBadge  = active ? `<span class="project-item-check">${icon('check', { size: 16 })}</span>` : '';
    const settingsBtn = isOwner
      ? `<button class="project-icon-btn" onclick="event.stopPropagation();openProjectSettings(${p.id})" title="${t('project_manage')}" aria-label="${t('project_manage')}">${icon('settings', { size: 16 })}</button>`
      : '';
    return `
      <div class="project-item ${active}" role="button" tabindex="0" onclick="selectProject(${p.id})">
        <span class="project-item-icon">${icon(meta.lucide, { size: 18 })}</span>
        <span class="project-item-name">${escapeHtml(p.name)}</span>
        ${memberBadge}
        ${checkBadge}
        ${settingsBtn}
      </div>
    `;
  }).join('');
  refreshIcons();
}

function openProjectCreateForm() {
  document.getElementById('project-list-section').style.display = 'none';
  document.getElementById('project-create-form').style.display = 'block';
  document.getElementById('project-name-input').value = '';
  document.getElementById('project-budget-input').value = '';
  // Reflect current user currency in the budget field label
  const sym = getCurrencySymbol();
  document.getElementById('project-budget-currency').textContent = sym;
  document.getElementById('project-name-input').focus();
  // Default-select 'perso'
  document.querySelectorAll('.project-type-chip').forEach(c => c.classList.remove('selected'));
  document.querySelector('.project-type-chip[data-type="perso"]')?.classList.add('selected');
}

function getCurrencySymbol() {
  const cur = (localStorage.getItem('kula_currency') || 'XOF').toUpperCase();
  return CURRENCY_CONFIG[cur]?.symbol || 'FCFA';
}

function backToProjectList() {
  document.getElementById('project-create-form').style.display = 'none';
  document.getElementById('project-list-section').style.display = 'block';
}

async function submitNewProject() {
  const name = document.getElementById('project-name-input').value.trim();
  const type = document.querySelector('.project-type-chip.selected')?.dataset.type || 'perso';
  // Budget is in user-display currency — convert to XOF (storage currency) before sending
  const rawBudget = parseFloat(document.getElementById('project-budget-input').value) || 0;
  const totalBudgetXOF = rawBudget > 0 ? Math.round(toXOF(rawBudget)) : 0;
  if (!name) { showToast(t('project_name_required'), 'error'); return; }
  const btn = document.getElementById('btn-create-project');
  btn.disabled = true;
  try {
    const proj = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, type, total_budget: totalBudgetXOF })
    });
    // Append + select
    state.projects.push({ ...proj, role: 'owner' });
    selectProject(proj.id);
    showToast(t('project_created'), 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function openProjectSettings(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  closeProjectSheet();
  document.getElementById('project-settings-name').textContent = project.name;
  // Pre-fill editable fields
  document.getElementById('project-edit-name').value = project.name;
  document.querySelectorAll('#project-edit-type-chips .project-type-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === project.type);
  });
  // Show danger zone only for non-perso projects
  const danger = document.getElementById('project-settings-danger');
  if (danger) danger.style.display = (project.type === 'perso') ? 'none' : 'block';

  const overlay = document.getElementById('project-settings-overlay');
  overlay.style.display = 'flex';
  overlay.dataset.projectId = String(projectId);
  document.getElementById('project-invite-email').value = '';
  await loadProjectMembers(projectId);
}

async function saveProjectChanges() {
  const overlay = document.getElementById('project-settings-overlay');
  const projectId = parseInt(overlay.dataset.projectId);
  const name = document.getElementById('project-edit-name').value.trim();
  const type = document.querySelector('#project-edit-type-chips .project-type-chip.selected')?.dataset.type;
  if (!name) { showToast(t('project_name_required'), 'error'); return; }
  if (!type) { showToast(t('project_name_required'), 'error'); return; }
  const btn = document.getElementById('btn-save-project');
  btn.disabled = true;
  try {
    const updated = await api(`/api/projects/${projectId}`, {
      method: 'PUT', body: JSON.stringify({ name, type })
    });
    // Update local state
    const idx = state.projects.findIndex(p => p.id === projectId);
    if (idx !== -1) state.projects[idx] = { ...state.projects[idx], ...updated };
    document.getElementById('project-settings-name').textContent = updated.name;
    renderProjectBar();
    showToast(t('project_updated'), 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function confirmDeleteProject() {
  const overlay = document.getElementById('project-settings-overlay');
  const projectId = parseInt(overlay.dataset.projectId);
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  if (!confirm(t('confirm_delete_project').replace('{name}', project.name))) return;
  const btn = document.getElementById('btn-delete-project');
  btn.disabled = true;
  try {
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
    // Remove from local state, switch back to Personnel
    state.projects = state.projects.filter(p => p.id !== projectId);
    const perso = state.projects.find(p => p.type === 'perso' && p.role === 'owner');
    closeProjectSettings();
    if (perso) {
      state.currentProjectId = perso.id;
      localStorage.setItem('kula_project_id', String(perso.id));
      renderProjectBar();
      // Refresh current tab
      if (state.currentTab === 'dashboard') loadDashboard();
      if (state.currentTab === 'transactions') loadTransactions();
      if (state.currentTab === 'epargne') loadPoches();
      state.chatHistory = [];
    }
    showToast(t('project_deleted'), 'success');
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

function closeProjectSettings() {
  document.getElementById('project-settings-overlay').style.display = 'none';
}

async function loadProjectMembers(projectId) {
  const list = document.getElementById('project-members-list');
  list.innerHTML = `<div class="project-member-empty">${t('loading')}</div>`;
  try {
    const members = await api(`/api/projects/${projectId}/members`);
    if (!members.length) {
      list.innerHTML = `<div class="project-member-empty">${t('project_no_members')}</div>`;
      return;
    }
    list.innerHTML = members.map(m => `
      <div class="project-member-row">
        <div class="project-member-info">
          <span class="project-member-email">${escapeHtml(m.email)}</span>
          <span class="project-member-role">${m.role}</span>
        </div>
        <span class="project-member-status ${m.status}">${t('project_status_' + m.status)}</span>
      </div>
    `).join('');
    refreshIcons();
  } catch (e) {
    list.innerHTML = `<div class="project-member-empty">${escapeHtml(e.message)}</div>`;
  }
}

async function inviteProjectMember() {
  const overlay = document.getElementById('project-settings-overlay');
  const projectId = parseInt(overlay.dataset.projectId);
  const email = document.getElementById('project-invite-email').value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast(t('invalid_email'), 'error');
    return;
  }
  const btn = document.getElementById('btn-invite-member');
  btn.disabled = true;
  try {
    await api(`/api/projects/${projectId}/invite`, {
      method: 'POST', body: JSON.stringify({ email, role: 'editor' })
    });
    document.getElementById('project-invite-email').value = '';
    showToast(t('project_invite_sent'), 'success');
    await loadProjectMembers(projectId);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api(withProject(`/api/dashboard?month=${state.currentMonth}`));

    // Offline cached data — show banner
    if (data._kula_offline) {
      showOfflineDataBanner(data._cached_at);
    } else {
      hideOfflineDataBanner();
    }

    // Balance
    const balEl = document.getElementById('total-balance');
    balEl.textContent = formatMoney(data.balance);
    balEl.className = `balance-amount${data.balance < 0 ? ' negative' : ''}`;
    document.getElementById('balance-sub').textContent =
      `${t('this_month')}: ${data.monthlyBalance >= 0 ? '+' : '−'}${formatMoney(data.monthlyBalance)}`;

    // Budget alloué — visible only for non-perso projects with a positive total budget
    const cur = currentProject();
    const allocBox = document.getElementById('balance-allocated');
    if (allocBox) {
      if (cur && cur.type !== 'perso' && (cur.total_budget || 0) > 0) {
        document.getElementById('balance-allocated-amount').textContent = formatMoney(cur.total_budget);
        allocBox.style.display = 'block';
      } else {
        allocBox.style.display = 'none';
      }
    }

    // Monthly stats
    document.getElementById('monthly-income').textContent = formatMoney(data.monthlyIncome);
    document.getElementById('monthly-expense').textContent = formatMoney(data.monthlyExpense);

    // Budget state for this month (passed to renderCategoryChart)
    state.budgets = {};
    (data.budgets || []).forEach(b => { state.budgets[b.category] = b.limite; });

    // Category breakdown (with budgets)
    renderCategoryChart(data.categories || [], data.monthlyExpense || 0, state.budgets);

    // Trend chart
    renderTrendChart(data.trend || []);

    // Recent transactions
    state.recentTransactions = data.recentTransactions || [];
    renderTransactionList('recent-tx-list', state.recentTransactions);

    // Score Kula
    try { renderScoreKula(data.monthlyIncome || 0, data.monthlyExpense || 0, data.categories || [], state.budgets); } catch { /* silent */ }

    // Budget notifications — wrapped so any error never blocks the dashboard
    try { checkBudgetNotifications(data.categories || [], state.budgets); } catch { /* silent */ }
  } catch (err) {
    console.error('Dashboard error:', err.message, err);
    const balEl = document.getElementById('total-balance');
    if (balEl) balEl.textContent = t('error');
    showToast(t('error_dashboard') + ': ' + (err.message || ''), 'error');
  }
}

// ── Score Kula — financial health gauge (0–100) ────────────────────────────────
function renderScoreKula(income, expense, categories, budgets) {
  const card    = document.getElementById('score-card');
  const numEl   = document.getElementById('score-number');
  const fillEl  = document.getElementById('score-fill');
  const statEl  = document.getElementById('score-status');
  const detEl   = document.getElementById('score-detail');
  if (!card) return;

  // Not enough data yet
  if (income === 0 && expense === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'flex';

  // ── Component 1 / 50 pts : income/expense ratio ───────────────────────────
  let ratioScore = 0;
  if (income > 0) {
    const ratio = expense / income;
    if      (ratio <= 0.60) ratioScore = 50;
    else if (ratio <= 0.75) ratioScore = 40;
    else if (ratio <= 0.90) ratioScore = 28;
    else if (ratio <= 1.00) ratioScore = 15;
    else                    ratioScore = 0;
  } else if (expense > 0) {
    ratioScore = 0; // spending but no income recorded
  } else {
    ratioScore = 35; // zero activity — neutral
  }

  // ── Component 2 / 50 pts : budget adherence ──────────────────────────────
  const budgetKeys = Object.keys(budgets).filter(k => budgets[k] > 0);
  let budgetScore = 50; // full score if no budgets defined
  if (budgetKeys.length > 0) {
    const expCatMap = {};
    (categories || []).filter(c => c.type === 'expense').forEach(c => { expCatMap[c.category] = c.total; });
    let ok = 0;
    budgetKeys.forEach(cat => {
      const spent = expCatMap[cat] || 0;
      const lim   = budgets[cat];
      if (spent <= lim * 0.80)       ok += 1;
      else if (spent <= lim * 1.00)  ok += 0.5;
      // else: exceeded — 0
    });
    budgetScore = Math.round((ok / budgetKeys.length) * 50);
  }

  const score = Math.min(100, Math.max(0, ratioScore + budgetScore));

  // ── Gauge fill — circumference of r=18 circle ≈ 113.1 ───────────────────
  const circ = 2 * Math.PI * 18; // ≈ 113.1
  const dash = (score / 100) * circ;
  fillEl.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circ.toFixed(1)}`);

  numEl.textContent = score;

  // ── Status labels & level ─────────────────────────────────────────────────
  let level, status, detail;
  const saved = income > 0 ? Math.round(((income - expense) / income) * 100) : null;

  if (score >= 80) {
    level  = 'great';
    status = t('score_great_status');
    detail = saved !== null
      ? t('score_great_detail_savings').replace('{X}', saved)
      : t('score_great_detail_default');
  } else if (score >= 60) {
    level  = 'good';
    status = t('score_good_status');
    detail = saved !== null && saved > 0
      ? t('score_good_detail_savings').replace('{X}', saved)
      : t('score_good_detail_default');
  } else if (score >= 35) {
    level  = 'warn';
    status = t('score_warn_status');
    detail = expense > income
      ? t('score_warn_detail_over')
      : t('score_warn_detail_budget');
  } else {
    level  = 'bad';
    status = t('score_bad_status');
    detail = expense > income
      ? t('score_bad_detail_over')
      : t('score_bad_detail_budget');
  }

  card.setAttribute('data-level', level);
  statEl.textContent = status;
  detEl.textContent  = detail;
}

// ── Category chart ──────────────────────────────────────────────────────────────
function renderCategoryChart(categories, totalExpense, budgets = {}) {
  const expenseCats = (categories || []).filter(c => c.type === 'expense');
  const listEl = document.getElementById('category-list');
  const ctx = document.getElementById('category-chart');

  if (!expenseCats.length) {
    ctx.style.display = 'none';
    listEl.innerHTML = `<div class="chart-empty">${t('no_expense_month')}</div>`;
    if (state.charts.category) { state.charts.category.destroy(); state.charts.category = null; }
    return;
  }

  ctx.style.display = 'block';

  const labels = expenseCats.map(c => c.category);
  const values = expenseCats.map(c => c.total);
  const colors = labels.map(l => getCatMeta(l).color || '#6B7280');

  if (state.charts.category) state.charts.category.destroy();
  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatMoney(ctx.raw)} (${Math.round(ctx.raw / totalExpense * 100)}%)`
          }
        }
      }
    }
  });

  // Category list with optional budget progress
  const maxTotal = Math.max(...values, 1);
  listEl.innerHTML = expenseCats.slice(0, 6).map(c => {
    const meta   = getCatMeta(c.category);
    const pct    = Math.round(c.total / totalExpense * 100);
    const limite = budgets[c.category];
    let budgetHtml = '';
    if (limite > 0) {
      const bPct     = Math.min(100, Math.round(c.total / limite * 100));
      const barColor = bPct >= 100 ? '#EF4444' : bPct >= 80 ? '#F59E0B' : '#10B981';
      budgetHtml = `
        <div class="category-budget-wrap">
          <div class="category-budget-bar" style="width:${bPct}%;background:${barColor}"></div>
        </div>
        <div class="category-budget-label">${bPct}% ${t('of_budget')} (${formatMoney(limite)})</div>`;
    }
    return `
      <div class="category-item">
        <div class="category-dot" style="background:${meta.color}"></div>
        <div class="category-info">
          <div class="category-name">${meta.icon} ${c.category}</div>
          <div class="category-bar-wrap">
            <div class="category-bar" style="width:${(c.total/maxTotal)*100}%;background:${meta.color}"></div>
          </div>
          ${budgetHtml}
        </div>
        <div class="category-amount">${formatAmount(c.total)}<br><small style="font-size:10px;color:#6B7280">${pct}%</small></div>
      </div>`;
  }).join('');
}

// ── Trend chart ─────────────────────────────────────────────────────────────────
function renderTrendChart(trend) {
  const ctx = document.getElementById('trend-chart');
  if (!trend || !trend.length) return;

  const labels = trend.map(tr => {
    const [y, m] = tr.month.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(getLocale(), { month: 'short' });
  });

  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: t('monthly_income'),
          data: trend.map(tr => tr.income),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 6
        },
        {
          label: t('monthly_expense'),
          data: trend.map(tr => tr.expense),
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${formatMoney(ctx.raw)}` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { callback: v => formatAmount(v) }
        }
      }
    }
  });
}

// ── Transaction list rendering ──────────────────────────────────────────────────
function renderTransactionList(containerId, transactions) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!transactions || !transactions.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💫</div>
        <div class="empty-text">${t('no_transactions')}</div>
        <div class="empty-sub">${t('use_chat_hint')}</div>
      </div>`;
    return;
  }

  el.innerHTML = transactions.map(tx => {
    const meta = getCatMeta(tx.category);
    const sign = tx.type === 'income' ? '+' : '-';
    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon ${tx.type}">${meta.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${escapeHtml(tx.description)}</div>
          <div class="tx-meta">
            <span class="tx-category-badge">${tx.category}</span>
            ${formatDate(tx.date)}
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</div>
        <button class="tx-delete" onclick="deleteTransaction(${tx.id})" title="${t('delete_btn')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Load transactions tab ───────────────────────────────────────────────────────
async function loadTransactions() {
  try {
    const params = new URLSearchParams({ month: state.txMonth });
    let txs = await api(withProject(`/api/transactions?${params}`));

    if (state.txFilter !== 'all') {
      txs = txs.filter(t => t.type === state.txFilter);
    }

    renderTransactionList('all-tx-list', txs);
  } catch (err) {
    console.error('Load transactions error:', err);
    showToast(t('error_loading'), 'error');
  }
}

// ── Delete transaction ──────────────────────────────────────────────────────────
async function deleteTransaction(id) {
  if (!confirm(t('confirm_delete_tx'))) return;
  try {
    await api(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast(t('tx_deleted'), 'success');
    if (state.currentTab === 'transactions') loadTransactions();
    else loadDashboard();
  } catch (err) {
    showToast(t('error_prefix') + ' : ' + err.message, 'error');
  }
}

// ── Save a transaction ──────────────────────────────────────────────────────────
async function saveTransaction(tx) {
  if (!navigator.onLine) {
    enqueueOffline(tx);
    return { offline: true };
  }
  return await api(withProject('/api/transactions'), {
    method: 'POST',
    body: JSON.stringify(tx)
  });
}

// ── Chat ────────────────────────────────────────────────────────────────────────

// Convert plain bot text to light HTML: **bold**, bullet lists, line breaks
function formatBotContent(text) {
  // Escape raw HTML first (safety), then apply formatting
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split into lines to handle bullet detection
  const lines = escaped.split('\n');
  const out = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();
    const isBullet = /^[•\-\*]\s+/.test(line);

    if (isBullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${applyInline(line.replace(/^[•\-\*]\s+/, ''))}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      if (line === '') {
        out.push('<br>');
      } else {
        out.push(applyInline(line) + '<br>');
      }
    }
  }
  if (inList) out.push('</ul>');

  // Remove trailing <br> sequences
  return out.join('').replace(/(<br>)+$/, '');
}

function applyInline(text) {
  // **bold**
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function addChatMessage(role, content) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'user' : 'bot'}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'user') {
    bubble.textContent = content; // user text is already escaped upstream
  } else {
    bubble.innerHTML = formatBotContent(content);
  }

  const avatarHTML = role === 'user'
    ? (profile.photo
        ? `<div class="msg-avatar"><img src="${profile.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"></div>`
        : `<div class="msg-avatar msg-avatar-initial">${profile.initial}</div>`)
    : `<div class="msg-avatar">🌱</div>`;
  div.innerHTML = avatarHTML;
  div.appendChild(bubble);

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function showTypingIndicator() {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">K</div>
    <div class="msg-bubble">
      <div class="typing">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTypingIndicator() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

function renderTransactionPreview(tx, parentDiv) {
  const meta = getCatMeta(tx.category);
  const sign = tx.type === 'income' ? '+' : '-';
  const typeLabel = tx.type === 'income' ? t('income') : t('expense');

  const preview = document.createElement('div');
  preview.className = 'tx-preview';
  preview.innerHTML = `
    <div class="tx-preview-header">
      <span class="tx-preview-label">${t('tx_detected')}</span>
      <span class="tx-preview-type ${tx.type}">${typeLabel}</span>
    </div>
    <div class="tx-preview-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</div>
    <div class="tx-preview-details">
      ${meta.icon} ${tx.category} · ${escapeHtml(tx.description)}<br>
      📅 ${formatDate(tx.date)}
    </div>
    <div class="tx-preview-actions">
      <button class="btn-confirm" id="btn-confirm-tx">✅ ${t('save')}</button>
      <button class="btn-cancel" id="btn-cancel-tx">${t('cancel')}</button>
    </div>
  `;

  parentDiv.querySelector('.msg-bubble').appendChild(preview);

  preview.querySelector('#btn-confirm-tx').addEventListener('click', async () => {
    preview.querySelector('.tx-preview-actions').innerHTML = `<div style="text-align:center;color:#6B7280;font-size:13px">${t('saving')}</div>`;
    try {
      const result = await saveTransaction(tx);
      if (result.offline) {
        preview.querySelector('.tx-preview-actions').innerHTML =
          `<div style="text-align:center;color:#F59E0B;font-weight:600;font-size:13px">${t('saved_offline_msg')}</div>`;
        showToast(t('saved_offline_msg'), 'info');
      } else {
        preview.querySelector('.tx-preview-actions').innerHTML =
          `<div style="text-align:center;color:#10B981;font-weight:600;font-size:14px">✅ ${t('saved')} !</div>`;
        showToast(t('saved'), 'success');
      }
      state.pendingTransaction = null;
    } catch (err) {
      preview.querySelector('.tx-preview-actions').innerHTML =
        `<div style="text-align:center;color:#EF4444;font-size:13px">❌ ${err.message}</div>`;
    }
  });

  preview.querySelector('#btn-cancel-tx').addEventListener('click', () => {
    preview.innerHTML = `<div style="text-align:center;color:#6B7280;font-size:13px">${t('tx_cancelled')}</div>`;
    state.pendingTransaction = null;
  });
}

// Carte affichée après qu'une transaction a été sauvegardée par le backend
function renderSavedTransaction(tx, parentDiv) {
  const meta = getCatMeta(tx.category);
  const sign = tx.type === 'income' ? '+' : '-';
  const card = document.createElement('div');
  card.className = 'tx-saved-card';
  card.innerHTML = `
    <div class="tx-saved-icon">${meta.icon}</div>
    <div class="tx-saved-info">
      <div class="tx-saved-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-saved-cat">${escapeHtml(tx.category)}</div>
    </div>
    <div class="tx-saved-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</div>
    <div class="tx-saved-check">✅</div>
  `;
  parentDiv.querySelector('.msg-bubble').appendChild(card);
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('btn-send').disabled = true;

  // Add user message
  addChatMessage('user', escapeHtml(text));
  state.chatHistory.push({ role: 'user', content: text });

  // Show typing
  showTypingIndicator();

  try {
    const response = await api(withProject('/api/chat'), {
      method: 'POST',
      body: JSON.stringify({ message: text, history: state.chatHistory.slice(-10) })
    });

    removeTypingIndicator();

    if (response.type === 'transactions' && Array.isArray(response.transactions) && response.transactions.length) {
      // Transactions already saved by the backend — show saved cards
      const confirmMsg = response.message || `${response.transactions.length} ${t('tx_registered')}`;
      const botMsg = addChatMessage('bot', confirmMsg);
      response.transactions.forEach(tx => renderSavedTransaction(tx, botMsg));
      state.chatHistory.push({ role: 'assistant', content: confirmMsg });
      // Refresh data silently
      loadDashboard();
      if (state.currentTab === 'transactions') loadTransactions();
    } else {
      const msg = response.message || t('chat_not_understood');
      addChatMessage('bot', msg);
      state.chatHistory.push({ role: 'assistant', content: msg });
      // If Kula used a tool (delete/update/add_to_poche), refresh data
      if (response.refresh) {
        loadDashboard();
        loadTransactions();
        loadPoches();
      }
      // Notification si objectif de poche atteint
      if (response.poche_goal_reached) {
        const nom = response.poche_goal_reached.nom;
        showToast(`${t('goal_toast')} "${nom}"`, 'success');
        if ('serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(t('goal_congrats_title'), {
              body: `${t('goal_congrats_body')} "${nom}" !`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `poche-goal-${nom}`
            });
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    removeTypingIndicator();
    addChatMessage('bot', `❌ ${escapeHtml(err.message)}`);
  } finally {
    document.getElementById('btn-send').disabled = false;
    input.focus();
  }
}

// ── Scheduled notifications (8h, 13h, 20h) ────────────────────────────────────
const DAILY_QUOTES = {
  fr: [
  'L\'argent est un bon serviteur mais un mauvais maître. — Francis Bacon',
  'Ne remets pas à demain l\'épargne que tu peux faire aujourd\'hui.',
  'Petit à petit, l\'oiseau fait son nid. Petit à petit, l\'épargne grandit.',
  'Celui qui ne sait pas gérer peu ne saura pas gérer beaucoup.',
  'La richesse n\'est pas dans ce qu\'on gagne, mais dans ce qu\'on garde.',
  'Un budget n\'est pas une prison — c\'est une carte vers la liberté.',
  'L\'eau qui coule doucement creuse la roche. L\'épargne régulière bâtit la fortune.',
  'Dépenser sans compter, c\'est marcher sans regarder où l\'on va.',
  'La fourmi travaille en été pour ne pas avoir faim en hiver.',
  'Connais tes dépenses avant de connaître tes manques.',
  'Chaque franc économisé est un franc gagné deux fois.',
  'Le meilleur investissement que tu puisses faire, c\'est en toi-même.',
  'Une dépense imprévue ne ruine que celui qui n\'a rien prévu.',
  'L\'indépendance financière commence par une seule décision : épargner.',
  'Qui contrôle son argent contrôle son destin.',
  'Mieux vaut un revenu modeste bien géré qu\'une fortune mal maîtrisée.',
  'La discipline financière d\'aujourd\'hui est la liberté de demain.',
  'Ne confonds pas le prix et la valeur — ce n\'est pas la même chose.',
  'Ton futur se construit avec les habitudes d\'aujourd\'hui.',
  'Semer l\'épargne, c\'est récolter la sécurité.',
  'L\'argent est un outil — apprends à t\'en servir avant qu\'il ne te dirige.',
  'Compte ce que tu as avant de compter ce que tu veux.',
  'Une bonne gestion du budget, c\'est le respect de soi-même.',
  'Ce n\'est pas le revenu qui enrichit, c\'est la sagesse dans les dépenses.',
  'Le bonheur ne s\'achète pas, mais la tranquillité financière s\'épargne.',
  'Regarde où va ton argent — il te dira où va ta vie.',
  'Commence petit, reste constant : l\'épargne est une habitude, pas un montant.',
  'Celui qui plan son argent ne sera jamais pris au dépourvu.',
  'La générosité commence par avoir — et avoir commence par gérer.',
  'Chaque sou compte quand on sait pourquoi on l\'économise.'
  ],
  en: [
  `Money is a good servant but a bad master. — Francis Bacon`,
  `Don't put off until tomorrow the savings you can make today.`,
  `Little by little, the bird builds its nest. Little by little, savings grow.`,
  `Those who can't manage a little won't manage a lot.`,
  `Wealth is not in what you earn, but in what you keep.`,
  `A budget is not a prison — it's a map to freedom.`,
  `Water that flows gently carves the rock. Regular savings build fortune.`,
  `Spending without counting is walking without watching where you go.`,
  `The ant works in summer so it won't go hungry in winter.`,
  `Know your expenses before you know your shortcomings.`,
  `Every dollar saved is a dollar earned twice.`,
  `The best investment you can make is in yourself.`,
  `An unexpected expense only ruins those who planned for nothing.`,
  `Financial independence starts with one decision: to save.`,
  `Who controls their money controls their destiny.`,
  `A modest income well managed beats a fortune poorly handled.`,
  `Today's financial discipline is tomorrow's freedom.`,
  `Don't confuse price and value — they're not the same thing.`,
  `Your future is built with today's habits.`,
  `Sow savings, reap security.`,
  `Money is a tool — learn to use it before it controls you.`,
  `Count what you have before counting what you want.`,
  `Good budget management is self-respect.`,
  `It's not income that makes you rich, it's wisdom in spending.`,
  `Happiness can't be bought, but financial peace can be saved.`,
  `Watch where your money goes — it'll tell you where your life goes.`,
  `Start small, stay consistent: saving is a habit, not an amount.`,
  `Those who plan their money will never be caught off guard.`,
  `Generosity starts with having — and having starts with managing.`,
  `Every penny counts when you know why you're saving it.`
  ]
};

function getDailyQuote() {
  const lang = localStorage.getItem('kula_lang') || 'fr';
  const quotes = DAILY_QUOTES[lang] || DAILY_QUOTES.fr;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

// Show a notification via the Service Worker (works even when app is in background/PWA)
async function swNotify(title, body, tag) {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
        renotify: false,
        data: { tab: 'chat' }
      });
    } else if (typeof Notification !== 'undefined') {
      new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag });
    }
  } catch { /* silent */ }
}

function scheduleNotifications() {
  if (!notifGranted()) return;

  const SLOTS = [
    { hour: 8,  key: 'morning',   msg: null /* uses daily quote */ },
    { hour: 13, key: 'afternoon', msgKey: 'notif_afternoon' },
    { hour: 20, key: 'evening',   msgKey: 'notif_evening' }
  ];

  const today = new Date().toDateString();

  SLOTS.forEach(slot => {
    const storageKey = `kula_notif_${slot.key}`;
    const lastSent = localStorage.getItem(storageKey);
    if (lastSent && new Date(parseInt(lastSent)).toDateString() === today) return;

    const now = new Date();
    const target = new Date();
    target.setHours(slot.hour, 0, 0, 0);
    if (target <= now) return;

    setTimeout(async () => {
      if (!notifGranted()) return;
      const body = slot.msgKey ? t(slot.msgKey) : `${t('notif_quote')} : ${getDailyQuote()}`;
      await swNotify('Kula 🌱', body, `kula-notif-${slot.key}`);
      localStorage.setItem(storageKey, Date.now().toString());
    }, target - now);
  });
}

// ── Voice recording — Web Speech API ─────────────────────────────────────────
const voice = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  let isListening   = false;
  let recognition   = null;
  let cancelled     = false;
  let timerInterval = null;
  let timerSec      = 0;
  let animFrame     = null;
  let maxTimer      = null;

  const $ = id => document.getElementById(id);

  function showPanel() {
    $('chat-input-area').style.display = 'none';
    $('voice-rec-panel').classList.add('active');
    $('voice-rec-panel').setAttribute('aria-hidden', 'false');
    $('voice-processing').classList.remove('active');
  }

  function hidePanel() {
    $('chat-input-area').style.display = '';
    $('voice-rec-panel').classList.remove('active');
    $('voice-rec-panel').setAttribute('aria-hidden', 'true');
    $('voice-processing').classList.remove('active');
    $('voice-processing').setAttribute('aria-hidden', 'true');
    const barsEl = $('voice-bars');
    if (barsEl) barsEl.classList.remove('has-data');
  }

  // ── Timer ───────────────────────────────────────────────────────────────
  function startTimer() {
    timerSec = 0; _tick();
    timerInterval = setInterval(_tick, 1000);
  }
  function _tick() {
    const el = $('voice-timer');
    if (el) el.textContent = `${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, '0')}`;
    timerSec++;
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  // ── Bar visualiser (animated, no stream needed) ──────────────────────────
  function startBars() {
    const barsEl = $('voice-bars');
    if (!barsEl) return;
    barsEl.classList.add('has-data');
    const barEls = [...barsEl.querySelectorAll('.vb')];
    const maxH = 26, minH = 3;
    function loop() {
      animFrame = requestAnimationFrame(loop);
      barEls.forEach(bar => {
        bar.style.height = (minH + Math.round(Math.random() * (maxH - minH))) + 'px';
      });
    }
    loop();
  }

  function stopBars() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    document.querySelectorAll('.vb').forEach(b => { b.style.height = ''; });
  }

  function cleanup() {
    stopBars();
    stopTimer();
    clearTimeout(maxTimer); maxTimer = null;
    if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
    isListening = false;
    hidePanel();
  }

  function cancel() { cancelled = true; cleanup(); }

  function stopRecording() {
    if (!recognition) return;
    try { recognition.stop(); } catch {}
  }

  function toggle() {
    if (isListening) return;
    cancelled = false;

    recognition = new SpeechRecognition();
    recognition.lang = getLocale();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      showPanel();
      startTimer();
      startBars();
      maxTimer = setTimeout(() => stopRecording(), 60000);
    };

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() || '';
      if (text) {
        const input = $('chat-input');
        if (input) {
          input.value = input.value.trim()
            ? input.value.trim() + ' ' + text
            : text;
          autoResize(input);
          input.focus();
        }
      } else {
        showToast(t('no_speech'), 'error');
      }
    };

    recognition.onerror = (event) => {
      if (cancelled) return;
      if (event.error === 'not-allowed') {
        showToast(t('mic_denied'), 'error');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        showToast(t('voice_error') + ': ' + event.error, 'error');
      }
    };

    recognition.onend = () => {
      stopBars();
      stopTimer();
      clearTimeout(maxTimer);
      recognition = null;
      isListening = false;
      hidePanel();
    };

    try {
      recognition.start();
    } catch {
      showToast(t('voice_unavailable'), 'error');
      recognition = null;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('voice-stop-btn')
      ?.addEventListener('click', () => stopRecording());
    document.getElementById('voice-cancel-btn')
      ?.addEventListener('click', () => cancel());
  });

  return { toggle, cancel, isListening: () => isListening };
})();

// ── Auto-resize textarea ────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ── Init ────────────────────────────────────────────────────────────────────────
// ── Notifications & reminders ──────────────────────────────────────────────────
const REMINDER_MESSAGES = [
  { days: 1,  icon: '👀', key: 'reminder_1d' },
  { days: 2,  icon: '📝', key: 'reminder_2d' },
  { days: 3,  icon: '⏰', key: 'reminder_3d' },
  { days: 7,  icon: '🌱', key: 'reminder_7d' },
  { days: 999, icon: '💪', key: 'reminder_long' }
];

function getReminderMessage(daysSince) {
  for (const r of REMINDER_MESSAGES) {
    if (daysSince <= r.days) return r;
  }
  return REMINDER_MESSAGES[REMINDER_MESSAGES.length - 1];
}

function showReminderBanner(daysSince) {
  const banner  = document.getElementById('reminder-banner');
  const textEl  = document.getElementById('reminder-text');
  const { icon, key } = getReminderMessage(daysSince);
  textEl.textContent = t(key);
  document.querySelector('.reminder-icon').textContent = icon;
  banner.style.display = 'flex';
  setTimeout(() => banner.classList.add('visible'), 50);

  document.getElementById('reminder-action').onclick = () => {
    banner.classList.remove('visible');
    switchTab('chat');
  };
  document.getElementById('reminder-close').onclick = () => {
    banner.classList.remove('visible');
    localStorage.setItem('kula_reminder_dismissed', Date.now().toString());
  };
}

function sendBrowserNotification(daysSince) {
  if (!notifGranted()) return;
  const { text } = getReminderMessage(daysSince);
  if (typeof Notification !== 'undefined') {
    const notif = new Notification('Kula 🌱 — Rappel budget', {
      body: text,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'kula-reminder',
      renotify: true
    });
    notif.onclick = () => { window.focus(); notif.close(); switchTab('chat'); };
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const res = await fetch('/api/push/vapid-key');
    if (!res.ok) { console.warn('[Push] vapid-key endpoint returned', res.status); return; }
    const { publicKey } = await res.json();

    console.log('[PUSH DEBUG] VAPID key received:', publicKey);
    console.log('[PUSH DEBUG] VAPID key length:', publicKey?.length);

    if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 20) {
      console.warn('[Push] VAPID key missing or invalid, skip subscribe');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Already subscribed — send to server in case DB lost it
      console.log('[Push] Already subscribed, re-syncing with server');
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(existing.toJSON())
      });
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    console.log('[PUSH DEBUG] Converted Uint8Array length:', applicationServerKey?.length);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify(sub.toJSON())
    });
    console.log('[Push] Subscribed successfully');
  } catch (e) {
    console.warn('[Push] subscribe failed:', e.message);
  }
}

async function initNotifications() {
  if (typeof Notification === 'undefined') return; // iOS Safari — no API
  // Request permission once (don't re-ask if denied)
  if (Notification.permission === 'default') {
    setTimeout(async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        scheduleNotifications();
        subscribeToPush();
        // Notification de bienvenue via le Service Worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Kula 🌱', {
              body: "👋 Bienvenue sur Kula ! Je suis votre assistant budget. Je vous enverrai des conseils et rappels pour gérer simplement vos projets 🌱",
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'kula-welcome'
            });
          }).catch(() => {});
        }
      }
    }, 5000); // ask 5s after load, less intrusive
  } else if (Notification.permission === 'granted') {
    // Already granted — ensure push subscription is registered (e.g. after reinstall)
    subscribeToPush();
  }

  // Check last transaction date — reuse data already fetched by loadDashboard()
  // Wait 2s to ensure loadDashboard() has had time to populate state.recentTransactions
  setTimeout(() => {
    try {
      const recent = state.recentTransactions; // set by loadDashboard()
      if (!recent || !recent.length) {
        // No transactions at all — show gentle nudge after 1 day of account age
        const user = getUser();
        if (user && user.created_at) {
          const created = new Date(user.created_at);
          const daysSince = Math.floor((Date.now() - created) / 86400000);
          if (daysSince >= 1) showReminderBanner(daysSince);
        }
        return;
      }

      const lastDate  = new Date(recent[0].date + 'T12:00:00');
      const daysSince = Math.floor((Date.now() - lastDate) / 86400000);

      if (daysSince < 1) return; // active today — no reminder

      // Don't show if user dismissed the banner today
      const dismissed = localStorage.getItem('kula_reminder_dismissed');
      if (dismissed) {
        const dismissedToday = new Date(parseInt(dismissed)).toDateString() === new Date().toDateString();
        if (dismissedToday) return;
      }

      showReminderBanner(daysSince);
      sendBrowserNotification(daysSince);
    } catch { /* silent */ }
  }, 2000);
}

// ── Poches Épargne ────────────────────────────────────────────────────────────
async function loadPoches() {
  const list = document.getElementById('poches-list');
  if (!list) return;
  try {
    const poches = await api(withProject('/api/poches'));
    if (poches) renderPoches(poches);
  } catch {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${t('error_loading')}</div></div>`;
  }
}

function renderPoches(poches) {
  const list    = document.getElementById('poches-list');
  const summary = document.getElementById('epargne-summary');
  if (!list) return;

  // Update summary card
  if (summary) {
    const totalActuel  = poches.reduce((s, p) => s + p.montant_actuel, 0);
    const totalObjectif = poches.reduce((s, p) => s + p.objectif_montant, 0);
    document.getElementById('epargne-total-actuel').textContent    = formatMoney(totalActuel);
    document.getElementById('epargne-total-objectif').textContent  = `${t('objective')} : ${formatMoney(totalObjectif)}`;
    document.getElementById('epargne-nb-poches').textContent       = `${poches.length} ${poches.length > 1 ? t('pocket_unit_plural') : t('pocket_unit')}`;
    summary.style.display = poches.length ? 'flex' : 'none';
  }

  if (!poches.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🐷</div>
        <div class="empty-text">${t('no_pockets')}</div>
        <div class="empty-sub">${t('no_pockets_sub')}</div>
      </div>`;
    return;
  }

  list.innerHTML = '';
  poches.forEach(p => {
    const pct       = p.objectif_montant > 0 ? Math.min(100, Math.round(p.montant_actuel / p.objectif_montant * 100)) : 0;
    const completed = p.montant_actuel >= p.objectif_montant;
    const barColor  = completed ? '#059669' : pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B';
    const reste     = Math.max(0, p.objectif_montant - p.montant_actuel);

    let echeanceHtml = '';
    if (p.date_echeance) {
      const d = new Date(p.date_echeance + 'T12:00:00');
      const daysLeft = Math.ceil((d - Date.now()) / 86400000);
      const dateLabel = d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
      echeanceHtml = `<div class="poche-echeance">📅 ${dateLabel}${daysLeft > 0 ? ` · ${daysLeft}${t('days_short')}` : ` · ${t('deadline_passed')}`}</div>`;
    }

    const card = document.createElement('div');
    card.className = `poche-card${completed ? ' completed' : ''}`;
    card.innerHTML = `
      <div class="poche-card-header">
        <div>
          <div class="poche-nom">${escapeHtml(p.nom)}</div>
          ${echeanceHtml}
        </div>
        <button class="btn-poche-delete" data-id="${p.id}" title="${t('delete_btn')}">✕</button>
      </div>
      <div class="poche-amounts">
        <div class="poche-amount-current">${formatMoney(p.montant_actuel)}</div>
        <div class="poche-amount-objectif">/ ${formatMoney(p.objectif_montant)}</div>
      </div>
      <div class="poche-progress-bar">
        <div class="poche-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="poche-progress-meta">
        <span class="poche-pct" style="color:${barColor}">${pct}%</span>
        ${completed
          ? `<span class="poche-completed-badge">🎉 ${t('goal_reached')}</span>`
          : `<span class="poche-reste">${t('remaining')} ${formatMoney(reste)}</span>`}
      </div>
      <div class="poche-actions">
        <button class="btn-alimenter" data-id="${p.id}" data-nom="${escapeHtml(p.nom)}">${t('add_to_pocket')}</button>
      </div>`;

    card.querySelector('.btn-poche-delete').addEventListener('click', async () => {
      if (!confirm(`${t('confirm_delete_pocket')} "${p.nom}" ?`)) return;
      try {
        await api(`/api/poches/${p.id}`, { method: 'DELETE' });
        showToast(`${t('pocket_deleted')} — "${p.nom}"`, 'success');
        loadPoches();
      } catch (err) { showToast(t('error_prefix') + ' : ' + err.message, 'error'); }
    });

    card.querySelector('.btn-alimenter').addEventListener('click', () => {
      openAlimenterModal(p.id, p.nom);
    });

    list.appendChild(card);
  });
}

function initPocheHandlers() {
  const modal   = document.getElementById('poche-modal');
  const overlay = document.getElementById('poche-modal-overlay');
  const btnAdd  = document.getElementById('btn-add-poche');
  const btnClose  = document.getElementById('poche-modal-close');
  const btnCreate = document.getElementById('btn-create-poche');

  function openModal() {
    document.getElementById('poche-nom').value      = '';
    document.getElementById('poche-objectif').value = '';
    document.getElementById('poche-echeance').value = '';
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('poche-nom').focus(), 120);
  }
  function closeModal() {
    overlay.style.display = 'none';
  }

  btnAdd?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);
  // Clic sur le backdrop ferme — clic à l'intérieur de la modale ne ferme pas
  overlay?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => e.stopPropagation());

  btnCreate?.addEventListener('click', async () => {
    const nom             = document.getElementById('poche-nom').value.trim();
    const objectifDisplay = parseFloat(document.getElementById('poche-objectif').value);
    const echeance        = document.getElementById('poche-echeance').value || null;

    if (!nom)                        return showToast(t('name_required'), 'error');
    if (!objectifDisplay || objectifDisplay <= 0) return showToast(t('goal_invalid'), 'error');

    const objectif = toXOF(objectifDisplay); // convert to XOF for storage

    btnCreate.disabled    = true;
    btnCreate.textContent = t('creating');
    try {
      await api(withProject('/api/poches'), {
        method: 'POST',
        body: JSON.stringify({ nom, objectif_montant: objectif, date_echeance: echeance })
      });
      closeModal();
      showToast(`${t('pocket_created')} — "${nom}" 🐷`, 'success');
      loadPoches();
    } catch (err) {
      showToast(t('error_prefix') + ' : ' + err.message, 'error');
    } finally {
      btnCreate.disabled    = false;
      btnCreate.textContent = t('create_pocket_btn');
    }
  });
}

function initAlimenterHandlers() {
  const overlay  = document.getElementById('alimenter-modal-overlay');
  const modal    = document.getElementById('alimenter-modal');
  const btnClose = document.getElementById('alimenter-modal-close');
  const btnConfirm = document.getElementById('btn-alimenter-confirm');
  let currentPocheId = null;

  window.openAlimenterModal = function(id, nom) {
    currentPocheId = id;
    document.getElementById('alimenter-modal-nom').textContent = nom;
    document.getElementById('alimenter-montant').value = '';
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('alimenter-montant').focus(), 120);
  };

  function closeModal() {
    overlay.style.display = 'none';
    currentPocheId = null;
  }

  btnClose?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => e.stopPropagation());

  btnConfirm?.addEventListener('click', async () => {
    const montantDisplay = parseFloat(document.getElementById('alimenter-montant').value);
    if (!montantDisplay || montantDisplay <= 0) return showToast(t('invalid_amount'), 'error');
    if (!currentPocheId) return;

    const montant = toXOF(montantDisplay); // convert to XOF for storage

    btnConfirm.disabled = true;
    btnConfirm.textContent = t('adding');
    try {
      await api(`/api/poches/${currentPocheId}/alimenter`, {
        method: 'POST',
        body: JSON.stringify({ montant })
      });
      closeModal();
      showToast(t('amount_added'), 'success');
      loadPoches();
    } catch (err) {
      showToast(t('error_prefix') + ' : ' + err.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = t('add_funds_btn');
    }
  });
}

// ── Freemium / Plan ────────────────────────────────────────────────────────────

async function checkPlan() {
  try {
    const data = await api('/api/user/plan');
    if (!data) return;

    const trialBanner  = document.getElementById('trial-banner');
    const trialText    = document.getElementById('trial-banner-text');
    const paywallEl    = document.getElementById('paywall-overlay');

    if (data.plan === 'premium') {
      // Full access — nothing to show
      if (trialBanner) trialBanner.style.display = 'none';
      if (paywallEl)   paywallEl.style.display   = 'none';
      return;
    }

    if (data.plan === 'trial') {
      const d = data.days_left ?? 0;
      const label = d <= 0 ? t('trial_last_day') : `${d} ${d > 1 ? t('days_left') : t('day_left')}`;
      if (trialText)   trialText.innerHTML = `🌱 ${t('plan_trial')} — <strong>${label}</strong>`;
      if (trialBanner) trialBanner.style.display = 'flex';
      if (paywallEl)   paywallEl.style.display   = 'none';
      return;
    }

    // Expired — show paywall
    if (trialBanner) trialBanner.style.display = 'none';
    if (paywallEl)   paywallEl.style.display   = 'flex';
  } catch { /* silent — don't block app if plan check fails */ }
}

async function initiatePayment() {
  const btn     = document.getElementById('paywall-cta');
  const btnText = document.getElementById('paywall-cta-text');
  const spinner = document.getElementById('paywall-cta-spin');
  if (!btn) return;

  btn.disabled       = true;
  btnText.textContent = t('connecting_payment');
  if (spinner) spinner.style.display = 'inline';

  try {
    const data = await api('/api/payment/initiate', { method: 'POST', body: '{}' });
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      showToast(data?.error || t('error_payment'), 'error');
      btn.disabled        = false;
      btnText.textContent = t('subscribe_now');
      if (spinner) spinner.style.display = 'none';
    }
  } catch (err) {
    showToast(err.message || t('error_network'), 'error');
    btn.disabled        = false;
    btnText.textContent = t('subscribe_now');
    if (spinner) spinner.style.display = 'none';
  }
}

async function init() {
  // Service worker — auto-reload when a new version activates
  if ('serviceWorker' in navigator) {
    // Capture BEFORE register() so first-install doesn't trigger a reload.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('/sw.js').then(reg => {
      // A new SW is already waiting (e.g. page was open during deploy) — skip it now.
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // A new SW found during this session — skip as soon as it finishes installing.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});

    // When the new SW takes control, reload silently (< 3 s after app open).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Handle notification click — SW tells us to open a specific tab
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'NOTIF_CLICK' && e.data.tab) {
        switchTab(e.data.tab);
      }
    });
  }

  // Month selectors
  initMonthSelectors();

  // Show user info in header
  const user = getUser();
  if (user.name) {
    const initial = user.name.charAt(0).toUpperCase();
    document.getElementById('user-initial').textContent = initial;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_afternoon') : t('greeting_evening');
    document.getElementById('user-greeting').textContent = `${greeting}, ${user.name.split(' ')[0]} 👋`;
  }

  // Apply saved currency & language on load
  updateCurrencyLabels();
  if (typeof applyI18n === 'function') applyI18n(localStorage.getItem('kula_lang') || 'fr');

  // Logout button
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm(t('logout_confirm'))) logout();
  });

  // Welcome popup — show once per browser (key: kula_welcome_shown)
  const overlay = document.getElementById('welcome-overlay');
  if (!localStorage.getItem('kula_welcome_shown')) {
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
  document.getElementById('btn-welcome-close').addEventListener('click', () => {
    overlay.style.display = 'none';
    localStorage.setItem('kula_welcome_shown', '1');
    // After closing welcome, show currency onboarding if not set yet, then tour
    if (!localStorage.getItem('kula_currency')) {
      const currencyOverlay = document.getElementById('currency-onboarding');
      if (currencyOverlay) currencyOverlay.style.display = 'flex';
    } else {
      setTimeout(startTour, 400);
    }
  });

  // Currency onboarding popup — show if no currency chosen and welcome already dismissed
  if (localStorage.getItem('kula_welcome_shown') && !localStorage.getItem('kula_currency')) {
    const currencyOverlay = document.getElementById('currency-onboarding');
    if (currencyOverlay) currencyOverlay.style.display = 'flex';
  }
  document.querySelectorAll('.currency-onboard-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const currency = btn.dataset.currency;
      localStorage.setItem('kula_currency', currency);
      updateCurrencyLabels();
      applyCurrency();
      const currencyOverlay = document.getElementById('currency-onboarding');
      if (currencyOverlay) currencyOverlay.style.display = 'none';
      // Start tour after currency choice
      setTimeout(startTour, 400);
      // Sync to server
      try {
        await api('/api/user/currency', { method: 'PATCH', body: JSON.stringify({ currency }) });
      } catch { /* saved locally */ }
    });
  });

  // Show tour for users who already passed the welcome/currency steps
  if (localStorage.getItem('kula_welcome_shown') && localStorage.getItem('kula_currency')) {
    setTimeout(startTour, 1200);
  }

  // Notifications & reminders
  initNotifications();

  // Check plan status (freemium gate)
  checkPlan();

  // Wire up paywall CTA and trial upgrade button
  document.getElementById('paywall-cta')?.addEventListener('click', initiatePayment);
  document.getElementById('trial-upgrade-btn')?.addEventListener('click', initiatePayment);

  // Handle ?payment=success redirect from PayTech
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    history.replaceState({}, '', '/');
    showToast(t('payment_success'), 'success');
    setTimeout(() => checkPlan(), 3000); // webhook may take a moment
  } else if (urlParams.get('payment') === 'cancel') {
    history.replaceState({}, '', '/');
    showToast(t('payment_cancel'), 'error');
  }

  // Load projects FIRST so currentProjectId is set before any data fetch
  await loadProjects();

  // Wire up project bar + sheet
  document.getElementById('project-bar')?.addEventListener('click', openProjectSheet);
  document.getElementById('project-sheet-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'project-sheet-overlay') closeProjectSheet();
  });
  document.getElementById('btn-project-sheet-close')?.addEventListener('click', closeProjectSheet);
  document.getElementById('btn-new-project')?.addEventListener('click', openProjectCreateForm);
  document.getElementById('btn-back-project-list')?.addEventListener('click', backToProjectList);
  document.getElementById('btn-create-project')?.addEventListener('click', submitNewProject);
  document.querySelectorAll('.project-type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.project-type-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
  document.getElementById('btn-project-settings-close')?.addEventListener('click', closeProjectSettings);
  document.getElementById('project-settings-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'project-settings-overlay') closeProjectSettings();
  });
  document.getElementById('btn-invite-member')?.addEventListener('click', inviteProjectMember);
  document.getElementById('btn-save-project')?.addEventListener('click', saveProjectChanges);
  document.getElementById('btn-delete-project')?.addEventListener('click', confirmDeleteProject);
  document.querySelectorAll('#project-edit-type-chips .project-type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#project-edit-type-chips .project-type-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // Handle manifest shortcut ?tab=chat
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab) switchTab(urlTab);
  else loadDashboard();

  // Final pass to upgrade any <i data-lucide> nodes inserted during init
  refreshIcons();

  // Nav buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.txFilter = btn.dataset.filter;
      loadTransactions();
    });
  });

  // Mic button
  const micBtn = document.getElementById('btn-mic');
  if (voice) {
    micBtn.addEventListener('click', () => voice.toggle());
  } else {
    micBtn.disabled = true;
    micBtn.title = 'Reconnaissance vocale non supportée par ce navigateur';
  }

  // Chat send button
  document.getElementById('btn-send').addEventListener('click', sendChatMessage);

  // Chat input keyboard shortcuts
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  document.getElementById('chat-input').addEventListener('input', function () {
    autoResize(this);
  });

  // Schedule notifications after permission is obtained
  setTimeout(() => scheduleNotifications(), 6000);

  // Budget panel
  initBudgetHandlers();

  // Profile panel
  initProfileHandlers();

  // Offline queue — badge + auto-sync on reconnect
  renderOfflineBadge();
  window.addEventListener('online', () => {
    showToast(t('connection_restored'), 'success');
    syncOfflineQueue();
  });
  document.getElementById('btn-sync-offline')?.addEventListener('click', syncOfflineQueue);

  // User categories (non-blocking — fallback to hardcoded CATEGORIES)
  loadUserCategories();

  // Poches Épargne
  initPocheHandlers();
  initAlimenterHandlers();

  // Load profile at startup — syncs photo to header badge, chat avatars, and profile cache
  (async () => {
    try {
      const data = await api('/api/profile');
      if (!data) return;
      profile.name    = data.name  || '';
      profile.initial = (data.name || 'K').charAt(0).toUpperCase();
      setProfilePhoto(data.photo || null);
    } catch { /* silent — user still works without photo */ }
  })();

  // PDF export modal
  document.getElementById('pdf-modal-close')?.addEventListener('click', () => {
    document.getElementById('pdf-modal').style.display = 'none';
  });
  document.getElementById('pdf-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pdf-modal'))
      document.getElementById('pdf-modal').style.display = 'none';
  });
  document.getElementById('btn-pdf-download')?.addEventListener('click', downloadPDF);
}

// ── PWA Install ────────────────────────────────────────────────────────────────
(function initPWA() {
  // Already installed (running in standalone mode) → nothing to do
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;

  const ua    = navigator.userAgent;
  const isIOS    = /iphone|ipad|ipod/i.test(ua);
  const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  let deferredPrompt = null;

  function showInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    if (prompt) prompt.style.display = 'flex';
  }

  function hideInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    if (prompt) prompt.style.display = 'none';
  }

  // Android/Chrome: capture the native install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPrompt();
  });

  // iOS: always show the banner (no beforeinstallprompt on Safari)
  if (isIOS) showInstallPrompt();

  // App installed → hide banner
  window.addEventListener('appinstalled', () => {
    hideInstallPrompt();
    document.getElementById('pwa-modal')?.style && (document.getElementById('pwa-modal').style.display = 'none');
  });

  // Banner "Installer" button
  document.getElementById('btn-install')?.addEventListener('click', () => {
    if (deferredPrompt) {
      // Android native dialog
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choice => {
        deferredPrompt = null;
        if (choice.outcome === 'accepted') hideInstallPrompt();
      });
    } else {
      // iOS or no prompt: show guide modal
      openPWAModal(isIOS ? 'ios' : 'android');
    }
  });

  // Banner close
  document.getElementById('btn-install-close')?.addEventListener('click', hideInstallPrompt);

  // Modal "Installer maintenant" button (Android only)
  document.getElementById('btn-install-modal')?.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choice => {
        deferredPrompt = null;
        if (choice.outcome === 'accepted') {
          hideInstallPrompt();
          document.getElementById('pwa-modal').style.display = 'none';
        }
      });
    }
  });

  // Modal close
  document.getElementById('pwa-modal-close')?.addEventListener('click', () => {
    document.getElementById('pwa-modal').style.display = 'none';
  });
  document.getElementById('pwa-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pwa-modal'))
      document.getElementById('pwa-modal').style.display = 'none';
  });

  function openPWAModal() {
    const modal = document.getElementById('pwa-modal');
    if (!modal) return;

    // Auto-detect which guide to show
    let guideId, browserLabel;
    if (isSafari) {
      guideId      = 'guide-ios-safari';
      browserLabel = '🧭 Safari sur iPhone';
    } else if (isIOSChrome) {
      guideId      = 'guide-ios-chrome';
      browserLabel = '🟡 Chrome sur iPhone';
    } else if (isIOS) {
      guideId      = 'guide-ios-safari'; // fallback for other iOS browsers
      browserLabel = '📱 iPhone';
    } else {
      guideId      = 'guide-android';
      browserLabel = null;
    }

    // Show correct guide only
    document.querySelectorAll('.pwa-guide').forEach(g => g.classList.remove('active'));
    document.getElementById(guideId)?.classList.add('active');

    // Show detected browser badge
    const badge = document.getElementById('pwa-detected-badge');
    if (badge) {
      if (browserLabel) {
        badge.textContent = `Détecté : ${browserLabel}`;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
  }
})();

// ── Budget panel ──────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'Alimentation','Transport','Loisirs','Vêtements','Santé',
  'Éducation','Téléphone','Logement','Autre'
];

// Track which alerts have already fired this session {category: pct_notified}
const budgetAlertsSent = {};

function checkBudgetNotifications(categories, budgets) {
  if (!notifGranted()) return;
  (categories || []).filter(c => c.type === 'expense').forEach(c => {
    const limite = budgets[c.category];
    if (!limite || limite <= 0) return;
    const pct = c.total / limite * 100;
    const key = c.category;

    if (pct >= 100 && budgetAlertsSent[key] !== 100) {
      budgetAlertsSent[key] = 100;
      if (typeof Notification !== 'undefined') {
        new Notification(`🚨 Budget ${c.category} dépassé !`, {
          body: `${formatMoney(c.total)} / ${formatMoney(limite)}`,
          icon: '/icon-192.png', tag: `budget-over-${key}`, renotify: true
        });
      }
    } else if (pct >= 80 && pct < 100 && !budgetAlertsSent[key]) {
      budgetAlertsSent[key] = 80;
      if (typeof Notification !== 'undefined') {
        new Notification(`⚠️ Budget ${c.category} à ${Math.round(pct)}%`, {
          body: `${formatMoney(c.total)} / ${formatMoney(limite)}`,
          icon: '/icon-192.png', tag: `budget-warn-${key}`, renotify: true
        });
      }
    }
  });
}

function openBudgets() {
  const overlay = document.getElementById('budget-overlay');
  const panel   = document.getElementById('budget-panel');
  if (!overlay || !panel) return;

  const month = state.currentMonth;
  document.getElementById('budget-month-label').textContent =
    new Date(month + '-01').toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });

  overlay.style.display = 'block';
  setTimeout(() => { panel.style.transform = 'translateY(0)'; }, 0);

  // Load categories then budgets + spending
  loadUserCategories().then(() => {
    renderBudgetList(state.budgets, {});
    api(withProject(`/api/budgets?month=${month}`)).then(rows => {
      const map = {};
      rows.forEach(r => { map[r.category] = r.limite; });
      api(withProject(`/api/dashboard?month=${month}`)).then(data => {
        const spending = {};
        (data.categories || []).filter(c => c.type === 'expense').forEach(c => { spending[c.category] = c.total; });
        renderBudgetList(map, spending);
      }).catch(() => renderBudgetList(map, {}));
    }).catch(() => {});
  });
}

function renderBudgetList(budgetMap, spending) {
  const list = document.getElementById('budget-list');
  if (!list) return;
  const month = state.currentMonth;

  // Use user's expense + both categories; fall back to hardcoded if not loaded yet
  const expenseCats = state.userCats.length
    ? state.userCats.filter(c => c.type !== 'income')
    : EXPENSE_CATEGORIES.map(nom => ({ id: null, nom, icone: CATEGORIES[nom]?.icon || '📦', couleur: CATEGORIES[nom]?.color || '#6B7280', type: 'expense' }));

  list.innerHTML = `
    <div class="cat-manage-header">
      <span class="cat-manage-title">${t('cat_expenses_title')}</span>
      <button class="btn-add-cat" id="btn-add-cat">${t('new_cat_btn')}</button>
    </div>` +
    expenseCats.map(cat => {
      const limite   = budgetMap[cat.nom] || 0;
      const spent    = spending[cat.nom]  || 0;
      const bPct     = limite > 0 ? Math.min(100, Math.round(spent / limite * 100)) : 0;
      const barColor = bPct >= 100 ? '#EF4444' : bPct >= 80 ? '#F59E0B' : cat.couleur;
      const progressHtml = limite > 0
        ? `<div class="budget-progress-wrap">
             <div class="budget-progress-bar" style="width:${bPct}%;background:${barColor}"></div>
           </div>
           <div class="budget-progress-label">${formatMoney(spent)} / ${formatMoney(limite)} (${bPct}%)</div>`
        : '';
      const catActions = cat.id
        ? `<button class="btn-cat-edit" data-cat-id="${cat.id}" title="${t('edit_name')}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
             </svg>
           </button>
           <button class="btn-cat-delete" data-cat-id="${cat.id}" data-cat-nom="${escapeHtml(cat.nom)}" title="${t('delete_btn')}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="3 6 5 6 21 6"/>
               <path d="M19 6l-1 14H6L5 6"/>
               <path d="M10 11v6M14 11v6"/>
               <path d="M9 6V4h6v2"/>
             </svg>
           </button>`
        : '';
      return `
        <div class="budget-row">
          <div class="budget-row-icon">${escapeHtml(cat.icone)}</div>
          <div class="budget-row-info">
            <div class="budget-row-name">${escapeHtml(cat.nom)}</div>
            ${progressHtml}
          </div>
          <div class="budget-row-right">
            <div class="budget-input-wrap">
              <input class="budget-input" type="number" inputmode="numeric" min="0" step="500"
                placeholder="—" value="${limite > 0 ? limite : ''}"
                data-cat="${escapeHtml(cat.nom)}" data-month="${month}"
                onchange="saveBudget(this)">
              <span class="budget-input-unit currency-label">${getCurrencySymbol()}</span>
            </div>
            <div class="budget-cat-actions">${catActions}</div>
          </div>
        </div>`;
    }).join('');

  // Attach category management listeners
  list.querySelector('#btn-add-cat')?.addEventListener('click', () => openCatModal(null));
  list.querySelectorAll('.btn-cat-edit').forEach(btn => {
    btn.addEventListener('click', () => openCatModal(parseInt(btn.dataset.catId)));
  });
  list.querySelectorAll('.btn-cat-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCat(parseInt(btn.dataset.catId), btn.dataset.catNom));
  });
}

async function saveBudget(input) {
  const category = input.dataset.cat;
  const month    = input.dataset.month;
  const limite   = parseFloat(input.value) || 0;
  try {
    await api(withProject('/api/budgets'), {
      method: 'PUT',
      body: JSON.stringify({ category, limite, month })
    });
    // Update local state and re-render dashboard category list
    if (limite > 0) {
      state.budgets[category] = limite;
    } else {
      delete state.budgets[category];
    }
    // Refresh dashboard category list with new budgets
    loadDashboard();
    showToast(`${category} — ${limite > 0 ? t('budget_saved') : t('budget_removed')}`, 'success');
  } catch (err) {
    showToast(t('error_prefix') + ' : ' + err.message, 'error');
  }
}

function closeBudgets() {
  document.getElementById('budget-panel').style.transform = 'translateY(100%)';
  setTimeout(() => { document.getElementById('budget-overlay').style.display = 'none'; }, 300);
}

function openCatModal(catId) {
  const overlay = document.getElementById('cat-modal-overlay');
  if (!overlay) return;
  document.getElementById('cat-modal-id').value      = catId || '';
  document.getElementById('cat-modal-nom').value     = '';
  document.getElementById('cat-modal-icone').value   = '📦';
  document.getElementById('cat-modal-couleur').value = '#6B7280';
  document.getElementById('cat-modal-type').value    = 'expense';
  document.getElementById('cat-modal-title').textContent = catId ? t('edit_category') : t('new_category');
  document.getElementById('btn-cat-save').textContent = catId ? t('save') : t('cat_create');

  if (catId) {
    const cat = state.userCats.find(c => c.id === catId);
    if (cat) {
      document.getElementById('cat-modal-nom').value     = cat.nom;
      document.getElementById('cat-modal-icone').value   = cat.icone;
      document.getElementById('cat-modal-couleur').value = cat.couleur;
      document.getElementById('cat-modal-type').value    = cat.type;
    }
  }
  overlay.style.display = 'flex';
  setTimeout(() => document.getElementById('cat-modal-nom').focus(), 120);
}

async function deleteCat(catId, nom) {
  if (!confirm(`${t('confirm_delete_cat')} "${nom}" ?`)) return;
  try {
    await api(`/api/categories/${catId}`, { method: 'DELETE' });
    showToast(`${t('cat_deleted')} — "${nom}"`, 'success');
    await loadUserCategories();
    openBudgets();
  } catch (err) {
    showToast(t('error_prefix') + ' : ' + err.message, 'error');
  }
}

function initCatModalHandlers() {
  const overlay  = document.getElementById('cat-modal-overlay');
  const modal    = document.getElementById('cat-modal');
  const btnClose = document.getElementById('cat-modal-close');
  const btnSave  = document.getElementById('btn-cat-save');
  if (!overlay) return;

  function closeModal() { overlay.style.display = 'none'; }
  btnClose?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => e.stopPropagation());

  btnSave?.addEventListener('click', async () => {
    const catId   = document.getElementById('cat-modal-id').value;
    const nom     = document.getElementById('cat-modal-nom').value.trim();
    const icone   = document.getElementById('cat-modal-icone').value.trim() || '📦';
    const couleur = document.getElementById('cat-modal-couleur').value || '#6B7280';
    const type    = document.getElementById('cat-modal-type').value;
    if (!nom) return showToast(t('name_required_err'), 'error');

    btnSave.disabled = true;
    const origLabel = btnSave.textContent;
    btnSave.textContent = '…';
    try {
      if (catId) {
        await api(`/api/categories/${catId}`, { method: 'PUT', body: JSON.stringify({ nom, icone, couleur, type }) });
        showToast(`${t('cat_updated')} — "${nom}"`, 'success');
      } else {
        await api('/api/categories', { method: 'POST', body: JSON.stringify({ nom, icone, couleur, type }) });
        showToast(`${t('cat_created')} — "${nom}"`, 'success');
      }
      closeModal();
      await loadUserCategories();
      openBudgets();
    } catch (err) {
      showToast(t('error_prefix') + ' : ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = origLabel;
    }
  });
}

function initBudgetHandlers() {
  document.getElementById('budget-back')?.addEventListener('click', closeBudgets);
  document.getElementById('budget-overlay')?.addEventListener('click', closeBudgets);
  initCatModalHandlers();
}

// ── Profile panel ──────────────────────────────────────────────────────────────
// Update all static currency labels in the DOM
function updateCurrencyLabels() {
  const sym = getCurrencySymbol();
  document.querySelectorAll('.currency-label').forEach(el => { el.textContent = sym; });
}

// Refresh all visible data with current currency — called on currency change
function applyCurrency() {
  updateCurrencyLabels();
  // Re-render the active tab so amounts update immediately
  if (state.currentTab === 'dashboard') loadDashboard();
  else if (state.currentTab === 'transactions') loadTransactions();
  else if (state.currentTab === 'epargne') loadPoches();
}

function openProfile() {
  const overlay = document.getElementById('profile-overlay');
  const panel   = document.getElementById('profile-panel');
  if (!overlay || !panel) return;

  // ── 1. Pre-fill with cached localStorage data immediately ────────────────
  const cached = getUser();
  if (cached.name) {
    document.getElementById('profile-name').textContent        = cached.name;
    document.getElementById('profile-name-input').value        = cached.name;
    document.getElementById('profile-avatar-initial').textContent =
      cached.name.charAt(0).toUpperCase();
  }
  if (cached.email) {
    document.getElementById('profile-email').textContent = cached.email;
  }

  // ── 2. Show overlay + slide panel up ────────────────────────────────────
  overlay.style.display = 'block';
  // setTimeout(0) guarantees the browser paints display:block before the
  // transform change, so the CSS transition always fires.
  setTimeout(() => { panel.style.transform = 'translateY(0)'; }, 0);

  // ── 3. Refresh with fresh API data in the background ────────────────────
  api('/api/profile').then(data => {
    if (!data) return;
    document.getElementById('profile-name').textContent        = data.name || '—';
    document.getElementById('profile-name-input').value        = data.name || '';
    document.getElementById('profile-avatar-initial').textContent =
      (data.name || 'K').charAt(0).toUpperCase();
    document.getElementById('profile-email').textContent       = data.email || '—';
    if (data.created_at) {
      const d = new Date(data.created_at);
      document.getElementById('profile-since').textContent =
        t('member_since') + ' ' + d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
    }
    if (data.photo) {
      setProfilePhoto(data.photo);
    } else {
      document.getElementById('profile-avatar-img').style.display  = 'none';
      document.getElementById('profile-avatar-initial').style.display = '';
    }
    // Sync currency from server
    if (data.currency) {
      localStorage.setItem('kula_currency', data.currency);
      document.querySelectorAll('#currency-options .currency-btn').forEach(b => {
        const active = b.dataset.currency === data.currency;
        b.classList.toggle('active', active);
        b.textContent = active ? '✓ ' + b.dataset.label : b.dataset.label;
      });
      updateCurrencyLabels();
    }
    // Sync language from server
    if (data.language) {
      localStorage.setItem('kula_lang', data.language);
      document.querySelectorAll('#lang-options .lang-btn').forEach(b => {
        const active = b.dataset.lang === data.language;
        b.classList.toggle('active', active);
        b.textContent = active ? '✓ ' + b.dataset.label : b.dataset.label;
      });
    }
  }).catch(() => { /* panel already open — silent fail on data refresh */ });

  // Also refresh plan info
  api('/api/user/plan').then(renderProfilePlan).catch(() => {});

  // Highlight saved language with checkmark
  const lang = localStorage.getItem('kula_lang') || 'fr';
  document.querySelectorAll('#lang-options .lang-btn').forEach(b => {
    const active = b.dataset.lang === lang;
    b.classList.toggle('active', active);
    b.textContent = active ? '✓ ' + b.dataset.label : b.dataset.label;
  });

  // Highlight saved currency with checkmark
  const cur = getUserCurrency();
  document.querySelectorAll('#currency-options .currency-btn').forEach(b => {
    const active = b.dataset.currency === cur;
    b.classList.toggle('active', active);
    b.textContent = active ? '✓ ' + b.dataset.label : b.dataset.label;
  });
}

function renderProfilePlan(data) {
  const nameEl  = document.getElementById('profile-plan-name');
  const descEl  = document.getElementById('profile-plan-desc');
  const badgeEl = document.getElementById('profile-plan-badge');
  const cardEl  = document.getElementById('profile-plan-card');
  if (!nameEl || !descEl || !badgeEl) return;

  const fmt = iso => iso
    ? new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  if (data.plan === 'premium') {
    nameEl.textContent  = data.is_admin ? `${t('plan_admin')} ⭐` : `${t('plan_premium')} ⭐`;
    const nextDate      = data.subscription_end ? fmt(data.subscription_end) : null;
    const daysLeft      = data.premium_days_left;
    descEl.textContent  = nextDate
      ? `${t('next_payment')} ${nextDate}${daysLeft != null ? ` · ${daysLeft} ${t('days_left')}` : ''}`
      : t('unlimited_access');
    badgeEl.textContent = 'Premium';
    badgeEl.className   = 'profile-plan-badge badge-premium';
    if (cardEl) cardEl.className = 'profile-plan-card card-premium';
  } else if (data.plan === 'trial') {
    const d             = data.days_left ?? 0;
    const label         = d <= 0 ? t('trial_last_day') : `${d} ${d > 1 ? t('days_left') : t('day_left')}`;
    nameEl.textContent  = t('plan_trial');
    descEl.textContent  = `${label} · ${t('expires_on')} ${fmt(data.trial_end)}`;
    badgeEl.textContent = t('plan_trial_badge');
    badgeEl.className   = 'profile-plan-badge badge-trial';
    if (cardEl) cardEl.className = 'profile-plan-card card-trial';
  } else {
    nameEl.textContent  = t('plan_free');
    descEl.textContent  = t('plan_free_desc');
    badgeEl.textContent = t('plan_inactive');
    badgeEl.className   = 'profile-plan-badge badge-expired';
    if (cardEl) cardEl.className = 'profile-plan-card card-expired';
  }
}

function closeProfile() {
  document.getElementById('profile-panel').style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('profile-overlay').style.display = 'none';
    document.getElementById('profile-name-edit').style.display = 'none';
  }, 300);
}

function setProfilePhoto(src) {
  // Keep module cache in sync
  profile.photo = src || null;

  // Profile panel avatar
  const img     = document.getElementById('profile-avatar-img');
  const initial = document.getElementById('profile-avatar-initial');
  if (img && initial) {
    if (src) {
      img.src = src; img.style.display = 'block';
      initial.style.display = 'none';
    } else {
      img.style.display = 'none';
      initial.style.display = '';
    }
  }

  // Header badge
  const badge = document.querySelector('.user-badge');
  if (badge) {
    let badgeImg = badge.querySelector('img');
    if (src) {
      if (!badgeImg) {
        badgeImg = document.createElement('img');
        badgeImg.alt = '';
        badge.appendChild(badgeImg);
      }
      badgeImg.src = src;
      badgeImg.style.display = 'block';
      const initialEl = badge.querySelector('#user-initial');
      if (initialEl) initialEl.style.display = 'none';
    } else if (badgeImg) {
      badgeImg.style.display = 'none';
      const initialEl = badge.querySelector('#user-initial');
      if (initialEl) initialEl.style.display = '';
    }
  }
}

function initProfileHandlers() {
  // Back button
  document.getElementById('profile-back')?.addEventListener('click', closeProfile);

  // Backdrop click
  document.getElementById('profile-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('profile-overlay')) closeProfile();
  });

  // Camera button → trigger file input
  document.getElementById('profile-camera-btn')?.addEventListener('click', () => {
    document.getElementById('profile-photo-input').click();
  });

  // File input → resize → show immediately → upload
  document.getElementById('profile-photo-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(t('photo_too_large'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        // Resize to max 400×400 via canvas to keep base64 small
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.82);

        // ── Show immediately, don't wait for server ──
        setProfilePhoto(base64);

        // ── Upload in background ──
        try {
          await api('/api/profile/photo', {
            method: 'PUT',
            body: JSON.stringify({ photo: base64 })
          });
          showToast(t('photo_updated'), 'success');
        } catch (err) {
          console.error('[photo upload]', err);
          showToast(t('error_save_prefix') + ' : ' + err.message, 'error');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Edit name button
  document.getElementById('profile-edit-name-btn')?.addEventListener('click', () => {
    document.getElementById('profile-name-edit').style.display = 'flex';
    document.getElementById('profile-name-input').focus();
  });

  // Cancel name edit
  document.getElementById('btn-profile-cancel-name')?.addEventListener('click', () => {
    document.getElementById('profile-name-edit').style.display = 'none';
  });

  // Save name
  document.getElementById('btn-profile-save-name')?.addEventListener('click', async () => {
    const input = document.getElementById('profile-name-input');
    const newName = input.value.trim();
    if (!newName) { showToast(t('name_empty'), 'error'); return; }

    try {
      const res = await api('/api/profile/name', {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
      });
      // Update display
      document.getElementById('profile-name').textContent = res.name;
      document.getElementById('profile-avatar-initial').textContent =
        res.name.charAt(0).toUpperCase();
      document.getElementById('profile-name-edit').style.display = 'none';

      // Update localStorage + header
      const user = getUser();
      user.name = res.name;
      localStorage.setItem('kula_user', JSON.stringify(user));
      document.getElementById('user-initial').textContent = res.name.charAt(0).toUpperCase();
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
      document.getElementById('user-greeting').textContent =
        `${greeting}, ${res.name.split(' ')[0]} 👋`;

      showToast(t('name_updated'), 'success');
    } catch (err) {
      showToast(t('error_prefix') + ' : ' + err.message, 'error');
    }
  });

  // Save on Enter in name input
  document.getElementById('profile-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-profile-save-name').click();
    if (e.key === 'Escape') document.getElementById('btn-profile-cancel-name').click();
  });

  // ── Currency selector ──────────────────────────────────────────────────────
  document.querySelectorAll('#currency-options .currency-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const currency = btn.dataset.currency;
      document.querySelectorAll('#currency-options .currency-btn').forEach(b => {
        b.classList.remove('active');
        b.textContent = b.dataset.label;
      });
      btn.classList.add('active');
      btn.textContent = '✓ ' + btn.dataset.label;
      localStorage.setItem('kula_currency', currency);
      updateCurrencyLabels();
      applyCurrency();
      try {
        await api('/api/user/currency', { method: 'PATCH', body: JSON.stringify({ currency }) });
      } catch { /* saved locally, will sync later */ }
    });
  });

  // ── Language selector ──────────────────────────────────────────────────────
  document.querySelectorAll('#lang-options .lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      document.querySelectorAll('#lang-options .lang-btn').forEach(b => {
        b.classList.remove('active');
        b.textContent = b.dataset.label;
      });
      btn.classList.add('active');
      btn.textContent = '✓ ' + btn.dataset.label;
      localStorage.setItem('kula_lang', lang);
      if (typeof applyI18n === 'function') applyI18n(lang);
      showToast(t('lang_changed'), 'success');
      // Refresh current tab so translated dynamic strings (score, charts, dates) update
      if (state.currentTab === 'dashboard') loadDashboard();
      else if (state.currentTab === 'transactions') loadTransactions();
      else if (state.currentTab === 'epargne') loadPoches();
      try {
        await api('/api/user/language', { method: 'PATCH', body: JSON.stringify({ language: lang }) });
      } catch { /* saved locally */ }
    });
  });

  // ── Feedback (stars + WhatsApp) ────────────────────────────────────────────
  let feedbackRating = 0;
  document.querySelectorAll('#feedback-stars .feedback-star').forEach(star => {
    star.addEventListener('click', () => {
      feedbackRating = parseInt(star.dataset.star);
      document.querySelectorAll('#feedback-stars .feedback-star').forEach((s, i) => {
        s.textContent = i < feedbackRating ? '★' : '☆';
        s.classList.toggle('active', i < feedbackRating);
      });
    });
  });

  document.getElementById('btn-feedback-send')?.addEventListener('click', () => {
    if (!feedbackRating) { showToast(t('feedback_pick'), 'error'); return; }
    const message = document.getElementById('feedback-text').value.trim();
    const email = getUser().email || '';
    const stars = '⭐'.repeat(feedbackRating);
    const text = `⭐ Avis Kula\nNote: ${stars} (${feedbackRating}/5)\nMessage: ${message || '—'}\nUtilisateur: ${email}`;
    window.open(`https://wa.me/+221767424309?text=${encodeURIComponent(text)}`, '_blank');
    showToast(t('feedback_thanks'), 'success');
    feedbackRating = 0;
    document.querySelectorAll('#feedback-stars .feedback-star').forEach(s => { s.textContent = '☆'; s.classList.remove('active'); });
    document.getElementById('feedback-text').value = '';
  });

  // ── About: load version ────────────────────────────────────────────────────
  api('/api/version').then(d => {
    if (d?.version) document.getElementById('about-version').textContent = `v${d.version}`;
  }).catch(() => {});
}

// Make deleteTransaction global for inline onclick
window.deleteTransaction = deleteTransaction;
window.openExportModal  = openExportModal;
window.openProfile      = openProfile;
window.openBudgets      = openBudgets;
window.saveBudget       = saveBudget;
window.switchTab        = switchTab;

// ── Guided Tour ───────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { target: '.balance-card',           titleKey: 'tour_step1_title', descKey: 'tour_step1_desc' },
  { target: '#fab-add-tx',             titleKey: 'tour_step2_title', descKey: 'tour_step2_desc' },
  { target: '[data-tab="epargne"]',    titleKey: 'tour_step3_title', descKey: 'tour_step3_desc' },
  { target: '#nav-chat',               titleKey: 'tour_step4_title', descKey: 'tour_step4_desc' },
  { target: '#user-badge',             titleKey: 'tour_step5_title', descKey: 'tour_step5_desc' }
];

let _tourStep = 0;

function startTour() {
  if (localStorage.getItem('kula_tour_done')) return;
  const overlay = document.getElementById('tour-overlay');
  if (!overlay) return;
  overlay.style.display = 'block';
  _tourStep = 0;
  _showTourStep(0);
}

function _showTourStep(index) {
  const steps = TOUR_STEPS;
  if (index >= steps.length) { _endTour(); return; }
  const step = steps[index];

  const badge   = document.getElementById('tour-step-badge');
  const title   = document.getElementById('tour-title');
  const desc    = document.getElementById('tour-desc');
  const btnNext = document.getElementById('tour-btn-next');
  const btnSkip = document.getElementById('tour-btn-skip');
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip   = document.getElementById('tour-tooltip');
  if (!badge || !title || !desc || !btnNext) return;

  badge.textContent   = `${index + 1}/${steps.length}`;
  title.textContent   = t(step.titleKey);
  desc.textContent    = t(step.descKey);
  btnNext.textContent = index === steps.length - 1 ? t('tour_done') : t('tour_next');
  btnSkip.textContent = t('tour_skip');

  btnNext.onclick = () => _showTourStep(index + 1);
  btnSkip.onclick = _endTour;

  // Position spotlight on the target element
  const target = document.querySelector(step.target);
  if (target) {
    const rect = target.getBoundingClientRect();
    const pad  = 8;
    spotlight.style.display  = 'block';
    spotlight.style.left     = `${rect.left   - pad}px`;
    spotlight.style.top      = `${rect.top    - pad}px`;
    spotlight.style.width    = `${rect.width  + pad * 2}px`;
    spotlight.style.height   = `${rect.height + pad * 2}px`;

    // Place tooltip above or below the spotlight
    const tooltipHeight = 200;
    const viewH = window.innerHeight;
    const spaceBelow = viewH - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
      tooltip.style.top    = `${rect.bottom + pad + 12}px`;
      tooltip.style.bottom = 'auto';
    } else {
      tooltip.style.bottom = `${viewH - rect.top + pad + 12}px`;
      tooltip.style.top    = 'auto';
    }
  } else {
    // Fallback: center of screen, no spotlight
    spotlight.style.display = 'none';
    tooltip.style.top    = '50%';
    tooltip.style.bottom = 'auto';
    tooltip.style.transform = 'translateY(-50%)';
  }
}

function _endTour() {
  const overlay = document.getElementById('tour-overlay');
  if (overlay) overlay.style.display = 'none';
  localStorage.setItem('kula_tour_done', '1');
}

document.addEventListener('DOMContentLoaded', init);

// ── Add Transaction FAB & Bottom-Sheet ───────────────────────────────────────
const addTxModal = (() => {
  let currentType     = 'expense';
  let selectedCat     = '';
  let justificatifB64 = '';
  let allCats         = [];

  const overlay  = () => document.getElementById('add-tx-overlay');
  const sheet    = () => document.getElementById('add-tx-sheet');
  const catsEl   = () => document.getElementById('add-tx-cats');
  const autreEl  = () => document.getElementById('add-tx-autre');
  const amountEl = () => document.getElementById('add-tx-amount');
  const descEl   = () => document.getElementById('add-tx-desc');
  const dateEl   = () => document.getElementById('add-tx-date');
  const photoIn  = () => document.getElementById('add-tx-photo-input');
  const photoNm  = () => document.getElementById('add-tx-photo-name');
  const preview  = () => document.getElementById('add-tx-preview');
  const submitEl = () => document.getElementById('add-tx-submit');
  const submitTx = () => document.getElementById('add-tx-submit-text');
  const spinEl   = () => document.getElementById('add-tx-spin');

  function open() {
    // Default date = today
    dateEl().value = new Date().toISOString().slice(0, 10);
    // Refresh currency label in form
    updateCurrencyLabels();
    overlay().classList.add('open');
    overlay().setAttribute('aria-hidden', 'false');
    amountEl().focus();
    loadCats();
  }

  function close() {
    overlay().classList.remove('open');
    overlay().setAttribute('aria-hidden', 'true');
    reset();
  }

  function reset() {
    currentType = 'expense';
    selectedCat = '';
    justificatifB64 = '';
    amountEl().value = '';
    descEl().value   = '';
    autreEl().value  = '';
    autreEl().style.display = 'none';
    if (photoIn()) photoIn().value = '';
    if (photoNm()) photoNm().textContent = '';
    if (preview()) { preview().src = ''; preview().style.display = 'none'; }
    setType('expense');
  }

  function setType(type) {
    currentType = type;
    selectedCat = '';
    document.getElementById('atab-expense').classList.toggle('active', type === 'expense');
    document.getElementById('atab-income').classList.toggle('active', type === 'income');
    submitEl()?.classList.toggle('expense', type === 'expense');
    renderCats();
  }

  async function loadCats() {
    try {
      const data = await api('/api/categories');
      allCats = data || [];
    } catch { allCats = []; }
    renderCats();
  }

  function renderCats() {
    const el = catsEl();
    if (!el) return;

    // Filter by type
    const filtered = allCats.filter(c =>
      c.type === currentType || c.type === 'both'
    );

    el.innerHTML = filtered.map(c => `
      <button class="cat-chip${selectedCat === c.nom ? (currentType === 'expense' ? ' selected-expense' : ' selected') : ''}"
              data-cat="${c.nom}" data-icone="${c.icone || ''}">
        <span>${c.icone || ''}</span>${c.nom}
      </button>
    `).join('');

    el.querySelectorAll('.cat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCat = btn.dataset.cat;
        renderCats();
        const isAutre = selectedCat === 'Autre';
        autreEl().style.display = isAutre ? 'block' : 'none';
        if (!isAutre) autreEl().value = '';
      });
    });
  }

  async function handlePhoto(file) {
    if (!file) return;
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        justificatifB64 = e.target.result;
        if (preview()) { preview().src = justificatifB64; preview().style.display = 'block'; }
        if (photoNm()) photoNm().textContent = file.name;
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  async function submit() {
    const displayAmount = parseFloat(amountEl().value);
    if (!displayAmount || displayAmount <= 0) { showToast(t('invalid_amount'), 'error'); return; }
    if (!selectedCat)                         { showToast(t('select_category'), 'error'); return; }

    let category = selectedCat;
    if (selectedCat === 'Autre') {
      const txt = autreEl().value.trim();
      if (!txt) { showToast(t('specify_cat'), 'error'); return; }
      category = txt;
    }

    const description = descEl().value.trim() || category;
    const date        = dateEl().value || new Date().toISOString().slice(0, 10);
    const amount      = toXOF(displayAmount); // convert to XOF for storage

    // Disable submit
    submitEl().disabled = true;
    submitTx().textContent = t('registering');
    spinEl().style.display = 'inline';

    try {
      await api(withProject('/api/transactions'), {
        method: 'POST',
        body: JSON.stringify({
          type:          currentType,
          amount,
          category:      selectedCat === 'Autre' ? 'Autre' : selectedCat,
          description,
          date,
          justificatif:  justificatifB64 || null
        })
      });

      showToast(currentType === 'expense' ? t('expense_added') : t('income_added'), 'success');
      close();

      // Refresh dashboard data
      loadDashboard();
      if (document.getElementById('tab-transactions')?.classList.contains('active')) {
        loadTransactions();
      }
    } catch (err) {
      showToast(err.message || t('error_saving'), 'error');
    } finally {
      submitEl().disabled = false;
      submitTx().textContent = t('save');
      spinEl().style.display = 'none';
    }
  }

  // Wire up once DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fab-add-tx')?.addEventListener('click', open);

    // Close on overlay click (outside sheet)
    overlay()?.addEventListener('click', e => {
      if (e.target === overlay()) close();
    });

    // Type tab clicks
    document.getElementById('atab-expense')?.addEventListener('click', () => setType('expense'));
    document.getElementById('atab-income')?.addEventListener('click',  () => setType('income'));

    // Photo input
    photoIn()?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) handlePhoto(file);
    });

    // Submit
    document.getElementById('add-tx-submit')?.addEventListener('click', submit);

    // Hide FAB on non-dashboard tabs
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        const fab = document.getElementById('fab-add-tx');
        if (fab) fab.classList.toggle('hidden', tab !== 'dashboard');
      });
    });
    // Also hide FAB when chat opens
    document.getElementById('nav-chat')?.addEventListener('click', () => {
      document.getElementById('fab-add-tx')?.classList.add('hidden');
    });
  });

  return { open, close };
})();
