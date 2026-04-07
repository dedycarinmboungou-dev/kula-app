/* ─── Kula — Auth Page ────────────────────────────────────────────────────── */

// If already logged in, redirect to app
(function () {
  const token = localStorage.getItem('kula_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        window.location.href = '/';
        return;
      }
    } catch (_) {}
    localStorage.removeItem('kula_token');
    localStorage.removeItem('kula_user');
  }
})();

// ── Tab switching ─────────────────────────────────────────────────────────────
let currentTab = 'login';
const indicator = document.getElementById('tab-indicator');

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.toggle('active', form.id === `form-${tab}`);
  });
  indicator.style.left  = tab === 'login' ? '0%' : '50%';
  clearAllErrors();
}

document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.form-switch-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    switchTab(link.dataset.switch);
  });
});

// ── Password visibility toggle ────────────────────────────────────────────────
function toggleEye(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type   = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? '🙈' : '👁️';
  });
}
toggleEye('login-password', 'eye-login');
toggleEye('reg-password',   'eye-reg');

// ── Error helpers ─────────────────────────────────────────────────────────────
function setFieldError(fieldId, errId, msg) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(errId);
  if (!field || !err) return;
  if (msg) {
    field.classList.add('error');
    err.textContent = msg;
  } else {
    field.classList.remove('error');
    err.textContent = '';
  }
}

function setGlobalError(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.add('visible');
    // Replace emoji prefix that's in CSS
    el.style.display = 'flex';
  } else {
    el.classList.remove('visible');
    el.style.display = '';
  }
}

function clearAllErrors() {
  ['login-email','login-password','reg-name','reg-email','reg-password','reg-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('error');
  });
  ['err-login-email','err-login-password','err-reg-name','err-reg-email',
   'err-reg-password','err-reg-confirm','err-login-global','err-reg-global'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });
}

// ── Loading state ─────────────────────────────────────────────────────────────
function setLoading(prefix, loading) {
  const btn     = document.getElementById(`btn-${prefix}`);
  const spinner = document.getElementById(`spinner-${prefix}`);
  const text    = btn?.querySelector('.btn-submit-text');
  if (!btn) return;
  btn.disabled = loading;
  spinner?.classList.toggle('visible', loading);
  if (text) text.style.opacity = loading ? '0.6' : '1';
}

// ── API call ──────────────────────────────────────────────────────────────────
async function authRequest(endpoint, body) {
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur'), { status: res.status });
  return data;
}

// ── Login ─────────────────────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  clearAllErrors();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  let valid = true;

  if (!email) { setFieldError('login-email', 'err-login-email', 'Email requis'); valid = false; }
  if (!password) { setFieldError('login-password', 'err-login-password', 'Mot de passe requis'); valid = false; }
  if (!valid) return;

  setLoading('login', true);
  try {
    const { token, user } = await authRequest('/api/auth/login', { email, password });
    localStorage.setItem('kula_token', token);
    localStorage.setItem('kula_user',  JSON.stringify(user));
    window.location.href = '/';
  } catch (err) {
    setGlobalError('err-login-global', err.message);
    setLoading('login', false);
  }
});

// ── Register ──────────────────────────────────────────────────────────────────
document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  clearAllErrors();

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  let valid = true;

  if (name.length < 2)
    { setFieldError('reg-name', 'err-reg-name', 'Nom trop court (min 2 caractères)'); valid = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    { setFieldError('reg-email', 'err-reg-email', 'Email invalide'); valid = false; }
  if (password.length < 6)
    { setFieldError('reg-password', 'err-reg-password', 'Minimum 6 caractères'); valid = false; }
  if (password !== confirm)
    { setFieldError('reg-confirm', 'err-reg-confirm', 'Les mots de passe ne correspondent pas'); valid = false; }
  if (!valid) return;

  setLoading('register', true);
  try {
    const { token, user } = await authRequest('/api/auth/register', { name, email, password });
    localStorage.setItem('kula_token', token);
    localStorage.setItem('kula_user',  JSON.stringify(user));
    window.location.href = '/';
  } catch (err) {
    if (err.status === 409) setFieldError('reg-email', 'err-reg-email', err.message);
    else setGlobalError('err-reg-global', err.message);
    setLoading('register', false);
  }
});

// ── Input: clear error on type ────────────────────────────────────────────────
['login-email','login-password'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById(id).classList.remove('error');
    document.getElementById(`err-${id}`)?.textContent && (document.getElementById(`err-${id}`).textContent = '');
    document.getElementById('err-login-global')?.classList.remove('visible');
  });
});

['reg-name','reg-email','reg-password','reg-confirm'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById(id).classList.remove('error');
    const errEl = document.getElementById(`err-${id}`);
    if (errEl) errEl.textContent = '';
    document.getElementById('err-reg-global')?.classList.remove('visible');
  });
});
