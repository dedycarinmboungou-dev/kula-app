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

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  currentTab: 'dashboard',
  currentMonth: new Date().toISOString().slice(0, 7),
  txFilter: 'all',
  txMonth: new Date().toISOString().slice(0, 7),
  chatHistory: [],
  pendingTransaction: null,
  charts: { category: null, trend: null }
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

  const data = await res.json();
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

    // Category breakdown
    renderCategoryChart(data.categories, data.monthlyExpense);

    // Trend chart
    renderTrendChart(data.trend);

    // Recent transactions
    renderTransactionList('recent-tx-list', data.recentTransactions);
  } catch (err) {
    console.error('Dashboard error:', err.message, err);
    const balEl = document.getElementById('total-balance');
    if (balEl) balEl.textContent = 'Erreur';
    showToast('Erreur dashboard: ' + (err.message || 'réseau ?'), 'error');
  }
}

// ── Category chart ──────────────────────────────────────────────────────────────
function renderCategoryChart(categories, totalExpense) {
  const expenseCats = categories.filter(c => c.type === 'expense');
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

  // Category list
  const maxTotal = Math.max(...values, 1);
  listEl.innerHTML = expenseCats.slice(0, 6).map(c => {
    const meta = CATEGORIES[c.category] || { icon: '📦', color: '#6B7280' };
    const pct = Math.round(c.total / totalExpense * 100);
    return `
      <div class="category-item">
        <div class="category-dot" style="background:${meta.color}"></div>
        <div class="category-info">
          <div class="category-name">${meta.icon} ${c.category}</div>
          <div class="category-bar-wrap">
            <div class="category-bar" style="width:${(c.total/maxTotal)*100}%;background:${meta.color}"></div>
          </div>
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
function addChatMessage(role, content) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'user' : 'bot'}`;

  const avatarClass = 'msg-avatar';

  div.innerHTML = `
    <div class="${avatarClass}">${role === 'user' ? '👤' : 'K'}</div>
    <div class="msg-bubble">${content}</div>
  `;

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
  // Stop mic if recording
  if (voice && voice.isListening()) voice.toggle();

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
      const botMsg = addChatMessage('bot', escapeHtml(confirmMsg));
      response.transactions.forEach(tx => renderSavedTransaction(tx, botMsg));
      state.chatHistory.push({ role: 'assistant', content: confirmMsg });
      // Refresh dashboard silently
      if (state.currentTab === 'dashboard') loadDashboard();
    } else {
      const msg = response.message || "Je n'ai pas compris. Pouvez-vous reformuler ?";
      addChatMessage('bot', escapeHtml(msg));
      state.chatHistory.push({ role: 'assistant', content: msg });
    }
  } catch (err) {
    removeTypingIndicator();
    addChatMessage('bot', `❌ Erreur: ${escapeHtml(err.message)}`);
  } finally {
    document.getElementById('btn-send').disabled = false;
    input.focus();
  }
}

// ── Scheduled notifications (8h, 13h, 20h) ────────────────────────────────────
function scheduleNotifications() {
  if (Notification.permission !== 'granted') return;

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
      if (Notification.permission !== 'granted') return;
      const notif = new Notification('Kula 🌱', {
        body: slot.msg,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `kula-notif-${slot.key}`,

        renotify: false
      });
      notif.onclick = () => { window.focus(); switchTab('chat'); notif.close(); };
      localStorage.setItem(storageKey, Date.now().toString());
    }, target - now);
  });
}

// ── Voice recognition ──────────────────────────────────────────────────────────
const voice = (() => {
  try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let isListening = false;
  let baseText = '';   // text already in the field before recording started

  function setUI(listening) {
    const btn = document.getElementById('btn-mic');
    const status = document.getElementById('mic-status');
    const input = document.getElementById('chat-input');
    isListening = listening;
    btn.classList.toggle('recording', listening);
    btn.title = listening ? 'Arrêter' : 'Dicter un message';
    status.classList.toggle('visible', listening);
    if (listening) {
      baseText = input.value.trim();
      input.placeholder = 'Parlez maintenant…';
    } else {
      input.placeholder = 'Décris ta transaction…';
      autoResize(input);
    }
  }

  recognition.onresult = (e) => {
    const input = document.getElementById('chat-input');
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    const combined = [baseText, final || interim].filter(Boolean).join(' ');
    input.value = combined;
    if (final) baseText = combined;
    autoResize(input);
  };

  recognition.onerror = (e) => {
    const msgs = {
      'not-allowed': 'Accès au micro refusé. Autorisez le microphone dans votre navigateur.',
      'no-speech':   'Aucune parole détectée. Réessayez.',
      'network':     'Erreur réseau. Vérifiez votre connexion.',
    };
    showToast(msgs[e.error] || `Erreur micro: ${e.error}`, 'error');
    setUI(false);
  };

  recognition.onend = () => {
    if (isListening) setUI(false);
  };

  function toggle() {
    if (isListening) {
      recognition.stop();
      setUI(false);
    } else {
      recognition.start();
      setUI(true);
    }
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
  if (Notification.permission !== 'granted') return;
  const { text } = getReminderMessage(daysSince);
  const notif = new Notification('Kula 🌱 — Rappel budget', {
    body: text,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'kula-reminder',
    renotify: true
  });
  notif.onclick = () => { window.focus(); notif.close(); switchTab('chat'); };
}

async function initNotifications() {
  // Request permission once (don't re-ask if denied)
  if (Notification.permission === 'default') {
    setTimeout(async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') scheduleNotifications();
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

function init() {
  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
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

  // Load dashboard
  loadDashboard();

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

// Make deleteTransaction global for inline onclick
window.deleteTransaction = deleteTransaction;
window.switchTab = switchTab;

document.addEventListener('DOMContentLoaded', init);
