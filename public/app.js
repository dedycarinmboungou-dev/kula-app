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
  budgets: {}  // {category: limite} for current month
};

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

// ── Notification safety helper (iOS Safari has no Notification API) ───────────
const notifGranted = () =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

// ── Formatting ────────────────────────────────────────────────────────────────
function formatAmount(amount) {
  if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(Math.abs(amount)));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
    const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }

  // Update preview title on change
  function updatePreview() {
    const lbl = sel.options[sel.selectedIndex]?.text || '';
    prev.textContent = `Rapport Kula — ${lbl}`;
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
  label.textContent = 'Génération en cours…';

  try {
    const res = await fetch(`/api/report/pdf?month=${month}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
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
    showToast(`Rapport ${lbl} téléchargé ✅`, 'success');
  } catch (err) {
    showToast(`Erreur : ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Télécharger le PDF';
  }
}

// ── Month selector ────────────────────────────────────────────────────────────
function initMonthSelectors() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  [document.getElementById('month-select'), document.getElementById('tx-month-select')].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = months.map(m =>
      `<option value="${m}"${m === state.currentMonth ? ' selected' : ''}>${formatMonthLabel(m)}</option>`
    ).join('');
  });

  document.getElementById('month-select').addEventListener('change', e => {
    state.currentMonth = e.target.value;
    document.getElementById('tx-month-select').value = e.target.value;
    loadDashboard();
  });

  document.getElementById('tx-month-select').addEventListener('change', e => {
    state.txMonth = e.target.value;
    loadTransactions();
  });
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
  const res = await fetch(path, { headers, ...opts });

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

// ── Dashboard ──────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api(`/api/dashboard?month=${state.currentMonth}`);

    // Balance
    const balEl = document.getElementById('total-balance');
    balEl.innerHTML = `<span class="balance-currency">FCFA</span> ${formatAmount(data.balance)}`;
    balEl.className = `balance-amount${data.balance < 0 ? ' negative' : ''}`;
    document.getElementById('balance-sub').textContent =
      `Ce mois: ${data.monthlyBalance >= 0 ? '+' : ''}${formatAmount(data.monthlyBalance)} FCFA`;

    // Monthly stats
    document.getElementById('monthly-income').textContent = `${formatAmount(data.monthlyIncome)} FCFA`;
    document.getElementById('monthly-expense').textContent = `${formatAmount(data.monthlyExpense)} FCFA`;

    // Budget state for this month (passed to renderCategoryChart)
    state.budgets = {};
    (data.budgets || []).forEach(b => { state.budgets[b.category] = b.limite; });

    // Category breakdown (with budgets)
    renderCategoryChart(data.categories || [], data.monthlyExpense || 0, state.budgets);

    // Trend chart
    renderTrendChart(data.trend || []);

    // Recent transactions
    renderTransactionList('recent-tx-list', data.recentTransactions || []);

    // Budget notifications — wrapped so any error never blocks the dashboard
    try { checkBudgetNotifications(data.categories || [], state.budgets); } catch { /* silent */ }
  } catch (err) {
    console.error('Dashboard error:', err.message, err);
    const balEl = document.getElementById('total-balance');
    if (balEl) balEl.textContent = 'Erreur';
    showToast('Erreur dashboard: ' + (err.message || 'réseau ?'), 'error');
  }
}

// ── Category chart ──────────────────────────────────────────────────────────────
function renderCategoryChart(categories, totalExpense, budgets = {}) {
  const expenseCats = (categories || []).filter(c => c.type === 'expense');
  const listEl = document.getElementById('category-list');
  const ctx = document.getElementById('category-chart');

  if (!expenseCats.length) {
    ctx.style.display = 'none';
    listEl.innerHTML = '<div class="chart-empty">Aucune dépense ce mois</div>';
    if (state.charts.category) { state.charts.category.destroy(); state.charts.category = null; }
    return;
  }

  ctx.style.display = 'block';

  const labels = expenseCats.map(c => c.category);
  const values = expenseCats.map(c => c.total);
  const colors = labels.map(l => CATEGORIES[l]?.color || '#6B7280');

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
            label: ctx => ` ${formatAmount(ctx.raw)} FCFA (${Math.round(ctx.raw / totalExpense * 100)}%)`
          }
        }
      }
    }
  });

  // Category list with optional budget progress
  const maxTotal = Math.max(...values, 1);
  listEl.innerHTML = expenseCats.slice(0, 6).map(c => {
    const meta   = CATEGORIES[c.category] || { icon: '📦', color: '#6B7280' };
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
        <div class="category-budget-label">${bPct}% du budget (${formatAmount(limite)} FCFA)</div>`;
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

  const labels = trend.map(t => {
    const [y, m] = t.month.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'short' });
  });

  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenus',
          data: trend.map(t => t.income),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 6
        },
        {
          label: 'Dépenses',
          data: trend.map(t => t.expense),
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
          callbacks: { label: ctx => ` ${formatAmount(ctx.raw)} FCFA` }
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
        <div class="empty-text">Aucune transaction</div>
        <div class="empty-sub">Utilisez le chat pour ajouter vos dépenses et revenus</div>
      </div>`;
    return;
  }

  el.innerHTML = transactions.map(tx => {
    const meta = CATEGORIES[tx.category] || { icon: '📦', color: '#6B7280' };
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
        <div class="tx-amount ${tx.type}">${sign}${formatAmount(tx.amount)} FCFA</div>
        <button class="tx-delete" onclick="deleteTransaction(${tx.id})" title="Supprimer">
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
    let txs = await api(`/api/transactions?${params}`);

    if (state.txFilter !== 'all') {
      txs = txs.filter(t => t.type === state.txFilter);
    }

    renderTransactionList('all-tx-list', txs);
  } catch (err) {
    console.error('Load transactions error:', err);
    showToast('Erreur lors du chargement', 'error');
  }
}

// ── Delete transaction ──────────────────────────────────────────────────────────
async function deleteTransaction(id) {
  if (!confirm('Supprimer cette transaction ?')) return;
  try {
    await api(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast('Transaction supprimée', 'success');
    if (state.currentTab === 'transactions') loadTransactions();
    else loadDashboard();
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
  }
}

// ── Save a transaction ──────────────────────────────────────────────────────────
async function saveTransaction(tx) {
  const saved = await api('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(tx)
  });
  return saved;
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
  const meta = CATEGORIES[tx.category] || { icon: '📦', color: '#6B7280' };
  const sign = tx.type === 'income' ? '+' : '-';
  const typeLabel = tx.type === 'income' ? 'Revenu' : 'Dépense';

  const preview = document.createElement('div');
  preview.className = 'tx-preview';
  preview.innerHTML = `
    <div class="tx-preview-header">
      <span class="tx-preview-label">Transaction détectée</span>
      <span class="tx-preview-type ${tx.type}">${typeLabel}</span>
    </div>
    <div class="tx-preview-amount ${tx.type}">${sign}${formatAmount(tx.amount)} <small>FCFA</small></div>
    <div class="tx-preview-details">
      ${meta.icon} ${tx.category} · ${escapeHtml(tx.description)}<br>
      📅 ${formatDate(tx.date)}
    </div>
    <div class="tx-preview-actions">
      <button class="btn-confirm" id="btn-confirm-tx">✅ Enregistrer</button>
      <button class="btn-cancel" id="btn-cancel-tx">Annuler</button>
    </div>
  `;

  parentDiv.querySelector('.msg-bubble').appendChild(preview);

  preview.querySelector('#btn-confirm-tx').addEventListener('click', async () => {
    preview.querySelector('.tx-preview-actions').innerHTML = '<div style="text-align:center;color:#6B7280;font-size:13px">Enregistrement…</div>';
    try {
      await saveTransaction(tx);
      preview.querySelector('.tx-preview-actions').innerHTML =
        '<div style="text-align:center;color:#10B981;font-weight:600;font-size:14px">✅ Enregistré !</div>';
      showToast('Transaction enregistrée !', 'success');
      state.pendingTransaction = null;
    } catch (err) {
      preview.querySelector('.tx-preview-actions').innerHTML =
        `<div style="text-align:center;color:#EF4444;font-size:13px">❌ ${err.message}</div>`;
    }
  });

  preview.querySelector('#btn-cancel-tx').addEventListener('click', () => {
    preview.innerHTML = '<div style="text-align:center;color:#6B7280;font-size:13px">Transaction annulée</div>';
    state.pendingTransaction = null;
  });
}

// Carte affichée après qu'une transaction a été sauvegardée par le backend
function renderSavedTransaction(tx, parentDiv) {
  const meta = CATEGORIES[tx.category] || { icon: '📦', color: '#6B7280' };
  const sign = tx.type === 'income' ? '+' : '-';
  const card = document.createElement('div');
  card.className = 'tx-saved-card';
  card.innerHTML = `
    <div class="tx-saved-icon">${meta.icon}</div>
    <div class="tx-saved-info">
      <div class="tx-saved-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-saved-cat">${escapeHtml(tx.category)}</div>
    </div>
    <div class="tx-saved-amount ${tx.type}">${sign}${formatAmount(tx.amount)} FCFA</div>
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
    const response = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text, history: state.chatHistory.slice(-10) })
    });

    removeTypingIndicator();

    if (response.type === 'transactions' && Array.isArray(response.transactions) && response.transactions.length) {
      // Transactions already saved by the backend — show saved cards
      const confirmMsg = response.message || `${response.transactions.length} transaction(s) enregistrée(s) ✅`;
      const botMsg = addChatMessage('bot', confirmMsg);
      response.transactions.forEach(tx => renderSavedTransaction(tx, botMsg));
      state.chatHistory.push({ role: 'assistant', content: confirmMsg });
      // Refresh data silently
      loadDashboard();
      if (state.currentTab === 'transactions') loadTransactions();
    } else {
      const msg = response.message || "Je n'ai pas compris. Pouvez-vous reformuler ?";
      addChatMessage('bot', msg);
      state.chatHistory.push({ role: 'assistant', content: msg });
      // If Kola used a tool (delete/update/add_to_poche), refresh data
      if (response.refresh) {
        loadDashboard();
        loadTransactions();
        loadPoches();
      }
      // Notification si objectif de poche atteint
      if (response.poche_goal_reached) {
        const nom = response.poche_goal_reached.nom;
        showToast(`🎉 Objectif "${nom}" atteint !`, 'success');
        if ('serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Kula 🌱 — Félicitations !', {
              body: `🎉 Félicitations ! Tu as atteint ton objectif "${nom}" !`,
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
const DAILY_QUOTES = [
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
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

function scheduleNotifications() {
  if (!notifGranted()) return;

  const SLOTS = [
    { hour: 8,  key: 'morning',   msg: '🌅 Bonjour ! Note tes dépenses et revenus du matin dans Kula.' },
    { hour: 13, key: 'afternoon', msg: '☀️ Pause déjeuner ! Quelques dépenses à enregistrer dans Kula ?' },
    { hour: 20, key: 'evening',   msg: '🌙 Bonsoir ! Prends 2 minutes pour faire le bilan de ta journée.' }
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

    setTimeout(() => {
      if (!notifGranted()) return;
      const body = slot.key === 'morning'
        ? `💡 Citation du jour : ${getDailyQuote()}`
        : slot.msg;
      if (typeof Notification !== 'undefined') {
        const notif = new Notification('Kula 🌱', {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `kula-notif-${slot.key}`,
          renotify: false
        });
        notif.onclick = () => { window.focus(); switchTab('chat'); notif.close(); };
      }
      localStorage.setItem(storageKey, Date.now().toString());
    }, target - now);
  });
}

// ── Voice recognition + waveform visualiser ───────────────────────────────────
const voice = (() => {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    let isListening   = false;
    let audioCtx      = null;
    let analyser      = null;
    let mediaStream   = null;
    let animFrame     = null;

    // ── UI helpers ────────────────────────────────────────────────────────
    function showWave() {
      document.getElementById('chat-input').style.display  = 'none';
      document.getElementById('voice-wave').classList.add('active');
    }

    function hideWave() {
      document.getElementById('voice-wave').classList.remove('active');
      document.getElementById('chat-input').style.display  = '';
    }

    function setBtn(active) {
      const btn = document.getElementById('btn-mic');
      if (!btn) return;
      btn.classList.toggle('recording', active);
      btn.title = active ? 'Arrêter' : 'Dicter un message';
    }

    // ── Waveform drawing loop ─────────────────────────────────────────────
    function drawWave() {
      const canvas = document.getElementById('voice-wave');
      if (!canvas || !analyser) return;

      // Match canvas resolution to its CSS size
      const dpr = window.devicePixelRatio || 1;
      const W   = canvas.offsetWidth;
      const H   = canvas.offsetHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx    = canvas.getContext('2d');
      const bufLen = analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);

      function loop() {
        animFrame = requestAnimationFrame(loop);
        analyser.getByteTimeDomainData(data);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Gradient stroke
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        grad.addColorStop(0,   '#10B981');
        grad.addColorStop(0.5, '#1a7a4a');
        grad.addColorStop(1,   '#10B981');

        ctx.lineWidth   = 2.5 * dpr;
        ctx.strokeStyle = grad;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.beginPath();

        const sliceW = canvas.width / bufLen;
        let   x      = 0;

        for (let i = 0; i < bufLen; i++) {
          const v = data[i] / 128.0;
          const y = (v * canvas.height) / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          x += sliceW;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
      loop();
    }

    function stopWave() {
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx  = null;
        analyser  = null;
      }
    }

    // ── Main toggle ───────────────────────────────────────────────────────
    async function toggle() {
      if (isListening) return; // one session at a time

      const recognition = new SpeechRecognition();
      recognition.lang            = 'fr-FR';
      recognition.interimResults  = false;
      recognition.continuous      = false;
      recognition.maxAlternatives = 1;

      // Start audio visualiser
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
        analyser    = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(mediaStream).connect(analyser);
        showWave();
        drawWave();
      } catch {
        // getUserMedia failed (denied or unavailable) — still run speech without wave
        showWave();
      }

      isListening = true;
      setBtn(true);
      recognition.start();

      // ── Result: fill textarea, stop visualiser, DON'T auto-send ─────────
      recognition.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript?.trim();
        stopWave();
        hideWave();
        isListening = false;
        setBtn(false);

        const input = document.getElementById('chat-input');
        if (transcript) {
          input.value = input.value.trim()
            ? input.value.trim() + ' ' + transcript
            : transcript;
          autoResize(input);
        }
        input.focus();
        recognition.stop();
      };

      // ── End (no result / aborted) ─────────────────────────────────────
      recognition.onend = () => {
        if (!isListening) return; // already handled by onresult
        stopWave();
        hideWave();
        isListening = false;
        setBtn(false);
      };

      // ── Errors ────────────────────────────────────────────────────────
      recognition.onerror = (e) => {
        stopWave();
        hideWave();
        isListening = false;
        setBtn(false);
        if (e.error === 'aborted' || e.error === 'no-speech') return;
        if (e.error === 'not-allowed') {
          showToast('Accès au micro refusé. Autorisez-le dans votre navigateur.', 'error');
        } else {
          showToast(`Erreur micro : ${e.error}`, 'error');
        }
      };
    }

    return { toggle, isListening: () => isListening };
  } catch (e) {
    console.warn('Voice recognition init error:', e);
    return null;
  }
})();

// ── Auto-resize textarea ────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ── Init ────────────────────────────────────────────────────────────────────────
// ── Notifications & reminders ──────────────────────────────────────────────────
const REMINDER_MESSAGES = [
  { days: 1,  icon: '👀', text: 'Tu n\'as rien enregistré aujourd\'hui. Une petite dépense oubliée ?' },
  { days: 2,  icon: '📝', text: 'Ça fait 2 jours sans transaction. Ton budget attend une mise à jour !' },
  { days: 3,  icon: '⏰', text: '3 jours sans mise à jour — prends 2 minutes pour noter tes dépenses.' },
  { days: 7,  icon: '🌱', text: 'Une semaine sans suivi ! Pour bien grandir, Kula a besoin de tes transactions.' },
  { days: 999, icon: '💪', text: 'Ça fait longtemps ! Reviens noter tes finances, tu es le patron de ton argent.' }
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
  const { icon, text } = getReminderMessage(daysSince);
  textEl.textContent = text;
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

async function initNotifications() {
  if (typeof Notification === 'undefined') return; // iOS Safari — no API
  // Request permission once (don't re-ask if denied)
  if (Notification.permission === 'default') {
    setTimeout(async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        scheduleNotifications();
        // Notification de bienvenue via le Service Worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Kula 🌱', {
              body: "👋 Bienvenue sur Kula ! Je suis Kola, ton coach financier. Je t'enverrai des conseils et rappels pour faire grandir ton argent 🌱",
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'kula-welcome'
            });
          }).catch(() => {});
        }
      }
    }, 5000); // ask 5s after load, less intrusive
  }

  // Check last transaction date after dashboard loads
  // We'll hook into loadDashboard's result via a small delay
  setTimeout(async () => {
    try {
      const data = await api(`/api/dashboard?month=${state.currentMonth}`);
      if (!data) return;

      // Find the most recent transaction date
      const recent = data.recentTransactions;
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

      const lastDate   = new Date(recent[0].date + 'T12:00:00');
      const daysSince  = Math.floor((Date.now() - lastDate) / 86400000);

      if (daysSince < 1) return; // active today — no reminder

      // Don't show if user dismissed recently (same day)
      const dismissed = localStorage.getItem('kula_reminder_dismissed');
      if (dismissed) {
        const dismissedToday = new Date(parseInt(dismissed)).toDateString() === new Date().toDateString();
        if (dismissedToday) return;
      }

      showReminderBanner(daysSince);
      sendBrowserNotification(daysSince);
    } catch { /* silent */ }
  }, 1500);
}

// ── Poches Épargne ────────────────────────────────────────────────────────────
async function loadPoches() {
  const list = document.getElementById('poches-list');
  if (!list) return;
  try {
    const poches = await api('/api/poches');
    if (poches) renderPoches(poches);
  } catch {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Erreur de chargement</div></div>`;
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
    document.getElementById('epargne-total-actuel').textContent    = `${formatAmount(totalActuel)} FCFA`;
    document.getElementById('epargne-total-objectif').textContent  = `Objectif : ${formatAmount(totalObjectif)} FCFA`;
    document.getElementById('epargne-nb-poches').textContent       = `${poches.length} poche${poches.length > 1 ? 's' : ''}`;
    summary.style.display = poches.length ? 'flex' : 'none';
  }

  if (!poches.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🐷</div>
        <div class="empty-text">Aucune poche d'épargne</div>
        <div class="empty-sub">Crée ta première poche pour commencer à épargner !</div>
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
      const dateLabel = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      echeanceHtml = `<div class="poche-echeance">📅 ${dateLabel}${daysLeft > 0 ? ` · ${daysLeft}j` : ' · Échéance dépassée'}</div>`;
    }

    const card = document.createElement('div');
    card.className = `poche-card${completed ? ' completed' : ''}`;
    card.innerHTML = `
      <div class="poche-card-header">
        <div>
          <div class="poche-nom">${escapeHtml(p.nom)}</div>
          ${echeanceHtml}
        </div>
        <button class="btn-poche-delete" data-id="${p.id}" title="Supprimer">✕</button>
      </div>
      <div class="poche-amounts">
        <div class="poche-amount-current">${formatAmount(p.montant_actuel)} <span class="currency">FCFA</span></div>
        <div class="poche-amount-objectif">/ ${formatAmount(p.objectif_montant)} FCFA</div>
      </div>
      <div class="poche-progress-bar">
        <div class="poche-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="poche-progress-meta">
        <span class="poche-pct" style="color:${barColor}">${pct}%</span>
        ${completed
          ? `<span class="poche-completed-badge">🎉 Objectif atteint !</span>`
          : `<span class="poche-reste">Reste ${formatAmount(reste)} FCFA</span>`}
      </div>`;

    card.querySelector('.btn-poche-delete').addEventListener('click', async () => {
      if (!confirm(`Supprimer la poche "${p.nom}" ?`)) return;
      try {
        await api(`/api/poches/${p.id}`, { method: 'DELETE' });
        showToast(`Poche "${p.nom}" supprimée`, 'success');
        loadPoches();
      } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
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
    const nom      = document.getElementById('poche-nom').value.trim();
    const objectif = parseFloat(document.getElementById('poche-objectif').value);
    const echeance = document.getElementById('poche-echeance').value || null;

    if (!nom)              return showToast('Le nom est requis', 'error');
    if (!objectif || objectif <= 0) return showToast('Objectif invalide', 'error');

    btnCreate.disabled    = true;
    btnCreate.textContent = 'Création…';
    try {
      await api('/api/poches', {
        method: 'POST',
        body: JSON.stringify({ nom, objectif_montant: objectif, date_echeance: echeance })
      });
      closeModal();
      showToast(`Poche "${nom}" créée 🐷`, 'success');
      loadPoches();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      btnCreate.disabled    = false;
      btnCreate.textContent = 'Créer la poche 🐷';
    }
  });
}

function init() {
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
  }

  // Month selectors
  initMonthSelectors();

  // Show user info in header
  const user = getUser();
  if (user.name) {
    const initial = user.name.charAt(0).toUpperCase();
    document.getElementById('user-initial').textContent = initial;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    document.getElementById('user-greeting').textContent = `${greeting}, ${user.name.split(' ')[0]} 👋`;
  }

  // Logout button
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Se déconnecter de Kula ?')) logout();
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
  });

  // Notifications & reminders
  initNotifications();

  // Handle manifest shortcut ?tab=chat
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab) switchTab(urlTab);
  else loadDashboard();

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

  // Poches Épargne
  initPocheHandlers();

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

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
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

  // OS tabs
  document.querySelectorAll('.pwa-os-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pwa-os-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.pwa-guide').forEach(g => g.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`guide-${tab.dataset.os}`)?.classList.add('active');
    });
  });

  function openPWAModal(os = 'android') {
    const modal = document.getElementById('pwa-modal');
    if (!modal) return;
    // Activate correct OS tab
    document.querySelectorAll('.pwa-os-tab').forEach(t => t.classList.toggle('active', t.dataset.os === os));
    document.querySelectorAll('.pwa-guide').forEach(g => g.classList.remove('active'));
    document.getElementById(`guide-${os}`)?.classList.add('active');
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
          body: `Tu as dépensé ${formatAmount(c.total)} FCFA sur ${formatAmount(limite)} FCFA prévu.`,
          icon: '/icon-192.png', tag: `budget-over-${key}`, renotify: true
        });
      }
    } else if (pct >= 80 && pct < 100 && !budgetAlertsSent[key]) {
      budgetAlertsSent[key] = 80;
      if (typeof Notification !== 'undefined') {
        new Notification(`⚠️ Budget ${c.category} à ${Math.round(pct)}%`, {
          body: `Tu as dépensé ${formatAmount(c.total)} FCFA sur ${formatAmount(limite)} FCFA prévu.`,
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
    new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  overlay.style.display = 'block';
  setTimeout(() => { panel.style.transform = 'translateY(0)'; }, 0);

  // Render rows immediately with cached budgets, then refresh
  renderBudgetList(state.budgets, {});
  api(`/api/budgets?month=${month}`).then(rows => {
    const map = {};
    rows.forEach(r => { map[r.category] = r.limite; });
    // Also get current spending for progress
    api(`/api/dashboard?month=${month}`).then(data => {
      const spending = {};
      (data.categories || []).filter(c => c.type === 'expense').forEach(c => { spending[c.category] = c.total; });
      renderBudgetList(map, spending);
    }).catch(() => renderBudgetList(map, {}));
  }).catch(() => {});
}

function renderBudgetList(budgetMap, spending) {
  const list = document.getElementById('budget-list');
  if (!list) return;
  const month = state.currentMonth;

  list.innerHTML = EXPENSE_CATEGORIES.map(cat => {
    const meta    = CATEGORIES[cat] || { icon: '📦', color: '#6B7280' };
    const limite  = budgetMap[cat] || 0;
    const spent   = spending[cat] || 0;
    const bPct    = limite > 0 ? Math.min(100, Math.round(spent / limite * 100)) : 0;
    const barColor= bPct >= 100 ? '#EF4444' : bPct >= 80 ? '#F59E0B' : meta.color;
    const progressHtml = limite > 0
      ? `<div class="budget-progress-wrap">
           <div class="budget-progress-bar" style="width:${bPct}%;background:${barColor}"></div>
         </div>
         <div class="budget-progress-label">${formatAmount(spent)} / ${formatAmount(limite)} FCFA (${bPct}%)</div>`
      : '';
    return `
      <div class="budget-row">
        <div class="budget-row-icon">${meta.icon}</div>
        <div class="budget-row-info">
          <div class="budget-row-name">${cat}</div>
          ${progressHtml}
        </div>
        <div class="budget-input-wrap">
          <input class="budget-input" type="number" inputmode="numeric" min="0" step="500"
            placeholder="—" value="${limite > 0 ? limite : ''}"
            data-cat="${cat}" data-month="${month}"
            onchange="saveBudget(this)">
          <span class="budget-input-unit">FCFA</span>
        </div>
      </div>`;
  }).join('');
}

async function saveBudget(input) {
  const category = input.dataset.cat;
  const month    = input.dataset.month;
  const limite   = parseFloat(input.value) || 0;
  try {
    await api('/api/budgets', {
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
    showToast(`Budget ${category} ${limite > 0 ? 'enregistré' : 'supprimé'}`, 'success');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

function closeBudgets() {
  document.getElementById('budget-panel').style.transform = 'translateY(100%)';
  setTimeout(() => { document.getElementById('budget-overlay').style.display = 'none'; }, 300);
}

function initBudgetHandlers() {
  document.getElementById('budget-back')?.addEventListener('click', closeBudgets);
  document.getElementById('budget-overlay')?.addEventListener('click', closeBudgets);
}

// ── Profile panel ──────────────────────────────────────────────────────────────
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
        'Membre depuis ' + d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (data.photo) {
      setProfilePhoto(data.photo);
    } else {
      document.getElementById('profile-avatar-img').style.display  = 'none';
      document.getElementById('profile-avatar-initial').style.display = '';
    }
  }).catch(() => { /* panel already open — silent fail on data refresh */ });
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
      showToast('Image trop grande (max 5 Mo)', 'error');
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
          showToast('Photo mise à jour ✓', 'success');
        } catch (err) {
          console.error('[photo upload]', err);
          showToast('Erreur sauvegarde : ' + err.message, 'error');
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
    if (!newName) { showToast('Le nom ne peut pas être vide', 'error'); return; }

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

      showToast('Nom mis à jour', 'success');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });

  // Save on Enter in name input
  document.getElementById('profile-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-profile-save-name').click();
    if (e.key === 'Escape') document.getElementById('btn-profile-cancel-name').click();
  });
}

// Make deleteTransaction global for inline onclick
window.deleteTransaction = deleteTransaction;
window.openExportModal  = openExportModal;
window.openProfile      = openProfile;
window.openBudgets      = openBudgets;
window.saveBudget       = saveBudget;
window.switchTab        = switchTab;

document.addEventListener('DOMContentLoaded', init);
