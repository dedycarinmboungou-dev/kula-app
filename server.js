require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const multer   = require('multer');
const webpush  = require('web-push');
const { stmts, VALID_CATEGORIES, DEFAULT_CATEGORIES } = require('./database');

// Unique build ID — changes on every server restart / deploy
const BUILD_ID = Date.now();

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET       = process.env.JWT_SECRET       || 'kula_fallback_secret';
const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY || '';
const ADMIN_EMAIL      = (process.env.ADMIN_EMAIL     || 'mindup05@gmail.com').toLowerCase();

const { FedaPay, Transaction: FedaTransaction } = require('fedapay');
if (FEDAPAY_SECRET_KEY) {
  FedaPay.setApiKey(FEDAPAY_SECRET_KEY);
  FedaPay.setEnvironment(process.env.FEDAPAY_ENV || 'live');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Multer — justificatif uploads (memory → base64, no disk dependency) ──────
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

// ── Category helpers ──────────────────────────────────────────────────────────
// Returns Set of valid category names for a user (static defaults + user's custom ones)
function getUserCatNames(userId) {
  const cats = stmts.getCategories.all({ userId });
  if (cats.length === 0) return new Set(VALID_CATEGORIES);
  return new Set([...VALID_CATEGORIES, ...cats.map(c => c.nom)]);
}

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:hello@kula.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('  Web Push : VAPID configured');
  } catch (e) {
    console.error('  Web Push : VAPID error —', e.message, '— push disabled');
  }
} else {
  console.warn('  Web Push : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push disabled');
}

// ── Brevo — email de bienvenue ────────────────────────────────────────────────
async function sendWelcomeEmail(toEmail, toName) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('  [Brevo] BREVO_API_KEY non défini — email ignoré');
    return;
  }
  console.log(`  [Brevo] Envoi email bienvenue → ${toEmail} (clé: ${apiKey.slice(0,8)}…)`);


  const firstName = toName.split(' ')[0];

  const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur Kula 🌱</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,122,74,0.10);">

          <!-- Header vert -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a7a4a 0%,#10B981 100%);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">🌱</div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Kula</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Fais grandir ton argent</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:40px;">

              <h2 style="margin:0 0 16px;color:#1a7a4a;font-size:22px;">
                Bienvenue, ${firstName} ! 👋
              </h2>
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
                Ton compte Kula est prêt. Tu as fait un pas important vers une meilleure
                maîtrise de tes finances. Kula t'accompagne chaque jour pour suivre tes
                revenus, contrôler tes dépenses et faire grandir ton argent — simplement,
                depuis ton téléphone.
              </p>

              <!-- 3 conseils -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background:#f0fdf4;border-left:4px solid #1a7a4a;border-radius:0 8px 8px 0;padding:16px 18px;margin-bottom:12px;">
                    <p style="margin:0 0 4px;color:#1a7a4a;font-weight:700;font-size:14px;">💬 1. Parle à Kula en langage naturel</p>
                    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">
                      Dis simplement « J'ai dépensé 5 000 FCFA en transport » et Kula
                      enregistre tout automatiquement — pas de formulaire, pas de prise de tête.
                    </p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="background:#f0fdf4;border-left:4px solid #10B981;border-radius:0 8px 8px 0;padding:16px 18px;">
                    <p style="margin:0 0 4px;color:#1a7a4a;font-weight:700;font-size:14px;">📊 2. Consulte ton tableau de bord chaque semaine</p>
                    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">
                      Tes revenus, dépenses et solde s'affichent en temps réel.
                      Identifie tes postes de dépenses et ajuste ton budget en connaissance de cause.
                    </p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="background:#f0fdf4;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:16px 18px;">
                    <p style="margin:0 0 4px;color:#1a7a4a;font-weight:700;font-size:14px;">🌟 3. Discute avec Kula Coach</p>
                    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">
                      Ton coach personnel analyse tes habitudes et te donne des conseils
                      personnalisés matin, après-midi et soir. L'argent se gère mieux
                      quand on y pense chaque jour.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin:32px 0 8px;">
                <a href="https://kula-app.onrender.com"
                   style="display:inline-block;background:linear-gradient(135deg,#1a7a4a,#10B981);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;">
                  Ouvrir Kula 🌱
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Tu reçois cet email car tu viens de créer un compte sur Kula.<br>
                © ${new Date().getFullYear()} Kula — Fais grandir ton argent 🌱
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  try {
    const brevo = require('@getbrevo/brevo');
    const { TransactionalEmailsApi, SendSmtpEmail } = brevo;

    const apiInstance = new TransactionalEmailsApi();
    apiInstance.authentications['apiKey'].apiKey = apiKey;

    const email = new SendSmtpEmail();
    email.subject = 'Bienvenue sur Kula 🌱 — Fais grandir ton argent !';
    email.htmlContent = htmlBody;
    email.sender = { name: 'Kula 🌱', email: 'mindup05@gmail.com' };
    email.to = [{ email: toEmail, name: toName }];

    const result = await apiInstance.sendTransacEmail(email);
    console.log(`  [Brevo] ✅ Email envoyé à ${toEmail} — messageId: ${result?.body?.messageId || '?'}`);
  } catch (err) {
    // Email failure is non-blocking — account already created
    const detail = err?.response?.body ? JSON.stringify(err.response.body) : (err.message || String(err));
    console.error(`  [Brevo] ❌ Erreur envoi email: ${detail}`);
  }
}

// ── Kula Coach — citations africaines ────────────────────────────────────────
const KOLA_QUOTES = [
  { text: "L'argent est un bon serviteur mais un mauvais maître.", author: "Proverbe africain" },
  { text: "Celui qui n'économise pas quand il gagne pleurera quand il vieillira.", author: "Sagesse africaine" },
  { text: "Une petite pluie quotidienne finit par remplir les grands fleuves.", author: "Proverbe congolais" },
  { text: "Construis ta maison avant que la pluie n'arrive.", author: "Proverbe africain" },
  { text: "La fourmi ne pleure pas en hiver car elle a travaillé en été.", author: "Sagesse africaine" },
  { text: "Ce que tu plantes aujourd'hui, tu le récoltes demain.", author: "Proverbe africain" },
  { text: "La richesse d'un homme se voit dans ce qu'il donne, pas dans ce qu'il garde.", author: "Sagesse africaine" },
  { text: "Un seul arbre ne fait pas une forêt, mais il en est le début.", author: "Proverbe africain" },
  { text: "Le sage construit sa maison, le fou mange ses briques.", author: "Proverbe africain" },
  { text: "La patience est le chemin le plus court vers l'objectif.", author: "Sagesse africaine" },
  { text: "Économiser n'est pas une privation, c'est une préparation.", author: "Kula 🌱" },
  { text: "Même une longue marche commence par un premier pas.", author: "Sagesse africaine" },
  { text: "Le cacao ne pousse pas en un jour, mais il vaut tout l'or.", author: "Proverbe africain" },
  { text: "Connais tes dépenses avant de connaître tes désirs.", author: "Sagesse financière" },
  { text: "Ce que tu surveilles, tu le contrôles. Ce que tu ignores te contrôle.", author: "Kula 🌱" },
  { text: "L'argent de demain se prépare avec les décisions d'aujourd'hui.", author: "Sagesse africaine" },
  { text: "Même le grand baobab a commencé comme une petite graine.", author: "Proverbe africain" },
  { text: "Ne laisse pas la dépense d'aujourd'hui voler la paix de demain.", author: "Kula 🌱" },
  { text: "La prospérité n'est pas ce que tu possèdes, mais ce que tu bâtis.", author: "Sagesse africaine" },
  { text: "Un budget bien tenu est une liberté bien méritée.", author: "Kula 🌱" },
  { text: "L'eau qui dort dans la rivière creuse aussi les rochers.", author: "Proverbe africain" },
  { text: "Ce qui est fait avec soin reste, ce qui est fait à la hâte se défait.", author: "Proverbe africain" },
  { text: "La rivière qui oublie ses sources se tarit.", author: "Sagesse africaine" },
  { text: "Chaque effort aujourd'hui est un soulagement demain.", author: "Sagesse africaine" },
  { text: "Qui garde sa main ouverte pour donner garde aussi son cœur ouvert pour recevoir.", author: "Proverbe africain" },
  { text: "Le courage c'est de commencer, la persévérance c'est de continuer.", author: "Sagesse africaine" },
  { text: "L'arbre qui donne des fruits se souvient qu'il fut un jour une graine.", author: "Sagesse africaine" },
  { text: "Un lion affamé chasse mieux qu'un lion rassasié.", author: "Proverbe africain" },
  { text: "Mieux vaut dépenser moins et vivre plus longtemps.", author: "Sagesse africaine" },
  { text: "Grandir, c'est apprendre à faire plus avec moins.", author: "Kula 🌱" }
];

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Serve sw.js dynamically so __BUILD_TIME__ is replaced on every deploy,
// which forces the browser to install a fresh Service Worker and bust old caches.
const SW_PATH = path.join(__dirname, 'public', 'sw.js');
app.get('/sw.js', (req, res) => {
  try {
    const raw = fs.readFileSync(SW_PATH, 'utf8');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(raw.replace('__BUILD_TIME__', BUILD_ID));
  } catch (e) {
    res.status(500).send('// sw.js unavailable');
  }
});

// index.html — never cache: ensures the latest version is always fetched
app.get(['/index.html', '/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.user   = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function dateAddDays(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function today() { return new Date().toISOString().slice(0, 10); }

// ── Access check middleware (freemium gate) ───────────────────────────────────
// Admin (ADMIN_EMAIL) → always granted.
// Others → granted if trial_end >= today OR (plan='premium' AND subscription_end >= today)
function checkAccess(req, res, next) {
  const row = stmts.getUserPlan.get({ id: req.userId });
  if (!row) return res.status(403).json({ error: 'Accès refusé', code: 'NO_PLAN' });

  // Admin bypass
  if (row.email.toLowerCase() === ADMIN_EMAIL) return next();

  const now = today();

  // Active premium subscription
  if (row.plan === 'premium' && row.subscription_end && row.subscription_end >= now) return next();

  // Trial still valid
  if (row.trial_end && row.trial_end >= now) return next();

  // Expired
  return res.status(402).json({
    error: 'Abonnement requis',
    code:  'TRIAL_EXPIRED',
    plan:  row.plan,
    trial_end: row.trial_end
  });
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Kula', version: '1.0.0' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || name.trim().length < 2)
      return res.status(400).json({ error: 'Le nom doit faire au moins 2 caractères' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Adresse email invalide' });
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });

    const existing = stmts.getUserByEmail.get({ email: email.toLowerCase().trim() });
    if (existing)
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const result = stmts.insertUser.run({
      name:  name.trim(),
      email: email.toLowerCase().trim(),
      hash
    });

    const userId = result.lastInsertRowid;
    const emailNorm = email.toLowerCase().trim();

    // Set trial window (3 days) — or permanent premium for admin
    if (emailNorm === ADMIN_EMAIL) {
      stmts.activatePremium.run({ subEnd: '2099-12-31', id: userId });
    } else {
      stmts.setUserTrial.run({ trialStart: today(), trialEnd: dateAddDays(3), id: userId });
    }

    const user = { id: userId, name: name.trim(), email: emailNorm };
    const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Insert default categories for new user
    DEFAULT_CATEGORIES.forEach(cat => {
      stmts.insertCategory.run({ userId: user.id, nom: cat.nom, icone: cat.icone, couleur: cat.couleur, type: cat.type });
    });

    // Non-blocking: send welcome email in background
    sendWelcomeEmail(user.email, user.name).catch(() => {});

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const userRow = stmts.getUserByEmail.get({ email: email.toLowerCase().trim() });
    if (!userRow)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const user = { id: userRow.id, name: userRow.name, email: userRow.email };
    const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Me (verify token + return profile)
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = stmts.getUserById.get({ id: req.userId });
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  res.json(user);
});

// ── Plan / freemium routes ────────────────────────────────────────────────────

// GET /api/user/plan — return current plan status
app.get('/api/user/plan', requireAuth, (req, res) => {
  const row = stmts.getUserPlan.get({ id: req.userId });
  if (!row) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  const isAdmin   = row.email.toLowerCase() === ADMIN_EMAIL;
  const now       = today();
  const isPremium = isAdmin || (row.plan === 'premium' && row.subscription_end >= now);
  const inTrial   = !isPremium && row.trial_end && row.trial_end >= now;

  // Auto-downgrade: premium expired → reset plan to 'free' in DB
  if (!isAdmin && row.plan === 'premium' && row.subscription_end < now) {
    stmts.resetPlanToFree.run({ id: req.userId });
  }

  let daysLeft = null;
  if (inTrial && row.trial_end) {
    const ms = new Date(row.trial_end + 'T23:59:59Z') - new Date();
    daysLeft = Math.max(0, Math.ceil(ms / 86400000));
  }

  let premiumDaysLeft = null;
  if (isPremium && !isAdmin && row.subscription_end) {
    const ms = new Date(row.subscription_end + 'T23:59:59Z') - new Date();
    premiumDaysLeft = Math.max(0, Math.ceil(ms / 86400000));
  }

  res.json({
    plan:              isPremium ? 'premium' : (inTrial ? 'trial' : 'expired'),
    trial_end:         row.trial_end,
    subscription_end:  row.subscription_end,
    days_left:         daysLeft,
    premium_days_left: premiumDaysLeft,
    is_admin:          isAdmin
  });
});

// POST /api/payment/initiate — create FedaPay transaction, return checkout URL
app.post('/api/payment/initiate', requireAuth, async (req, res) => {
  if (!FEDAPAY_SECRET_KEY) return res.status(503).json({ error: 'Paiement non configuré' });

  const row = stmts.getUserPlan.get({ id: req.userId });
  if (!row) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  try {
    const returnUrl = `${req.protocol}://${req.get('host')}/?payment=success`;

    const transaction = await FedaTransaction.create({
      description:  'Kula Premium — abonnement mensuel',
      amount:       3000,
      currency:     { iso: 'XOF' },
      callback_url: returnUrl,
      customer: {
        email:     row.email,
        firstname: row.email.split('@')[0],
        lastname:  'User'
      }
    });

    const token = await transaction.generateToken();
    console.log('[FedaPay] transaction created id=%s url=%s', transaction.id, token.url);

    res.json({ checkout_url: token.url });
  } catch (err) {
    console.error('[FedaPay] initiate error:', err.message);
    res.status(500).json({ error: err.message || 'Erreur paiement' });
  }
});

// POST /api/payment/webhook — FedaPay confirms payment
app.post('/api/payment/webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body;
    console.log('[FedaPay] webhook:', JSON.stringify(payload));

    // FedaPay event: { name: 'transaction.approved', data: { object: { status, customer: { email } } } }
    const txData  = payload?.data?.object || payload?.entity || payload;
    const status  = (txData?.status || '').toLowerCase();
    const email   = txData?.customer?.email || '';

    const isApproved = ['approved', 'success', 'successful', 'completed'].includes(status);

    if (isApproved && email) {
      const user = stmts.getUserByEmail.get({ email });
      if (user) {
        const subEnd = dateAddDays(30);
        stmts.activatePremium.run({ subEnd, id: user.id });
        console.log('[FedaPay] user %d activated premium until %s', user.id, subEnd);
      } else {
        console.warn('[FedaPay] webhook: no user found for email', email);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[FedaPay] webhook error:', err.message);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// ── Profile routes ─────────────────────────────────────────────────────────────
app.get('/api/profile', requireAuth, (req, res) => {
  const user = stmts.getUserById.get({ id: req.userId });
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  res.json(user);
});

app.put('/api/profile/name', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2)
    return res.status(400).json({ error: 'Le nom doit faire au moins 2 caractères' });
  stmts.updateUserName.run({ name: name.trim(), id: req.userId });
  res.json({ name: name.trim() });
});

app.put('/api/profile/photo', requireAuth, (req, res) => {
  try {
    const { photo } = req.body;
    console.log('[photo upload] userId=%s bodyKeys=%s photoLen=%s',
      req.userId,
      req.body ? Object.keys(req.body).join(',') : 'null',
      photo ? photo.length : 'missing'
    );
    if (!photo || !photo.startsWith('data:image/'))
      return res.status(400).json({ error: 'Format photo invalide' });
    if (photo.length > 3_800_000)
      return res.status(400).json({ error: 'Photo trop grande (max 2 Mo)' });
    const result = stmts.updateUserPhoto.run({ photo, id: req.userId });
    console.log('[photo upload] done changes=%s', result?.changes ?? '?');
    res.json({ ok: true });
  } catch (e) {
    console.error('[photo upload] ERROR', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/budgets?month=YYYY-MM  → [{category, limite}]
app.get('/api/budgets', requireAuth, (req, res) => {
  const mois = req.query.month || new Date().toISOString().slice(0, 7);
  const rows = stmts.getBudgets.all({ userId: req.userId, mois });
  res.json(rows);
});

// PUT /api/budgets  body: {category, limite, month}
// limite=0 → delete
app.put('/api/budgets', requireAuth, (req, res) => {
  try {
    const { category, limite, month } = req.body;
    const mois = month || new Date().toISOString().slice(0, 7);
    if (!category || !getUserCatNames(req.userId).has(category))
      return res.status(400).json({ error: 'Catégorie invalide' });
    const lim = parseFloat(limite);
    if (isNaN(lim) || lim < 0)
      return res.status(400).json({ error: 'Limite invalide' });
    if (lim === 0) {
      stmts.deleteBudget.run({ userId: req.userId, category, mois });
    } else {
      stmts.upsertBudget.run({ userId: req.userId, category, limite: lim, mois });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/dashboard', requireAuth, checkAccess, (req, res) => {
  try {
    const month   = req.query.month || new Date().toISOString().slice(0, 7);
    const userId  = req.userId;

    const stats      = stmts.getDashboard.get({ userId, month });
    const allTime    = stmts.getAllTimeDashboard.get({ userId });
    const categories = stmts.getCategoryStats.all({ userId, month });
    const recent     = stmts.getRecentTransactions.all({ userId, limit: 5 });
    const trend      = stmts.getMonthlyTrend.all({ userId });
    const budgets    = stmts.getBudgets.all({ userId, mois: month }) || [];

    res.json({
      month,
      balance:        allTime.balance,
      monthlyIncome:  stats.total_income,
      monthlyExpense: stats.total_expense,
      monthlyBalance: stats.balance,
      categories,
      budgets,
      recentTransactions: recent,
      trend
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/transactions', requireAuth, checkAccess, (req, res) => {
  try {
    const { month, limit = 50, offset = 0 } = req.query;
    const userId = req.userId;
    const txs = month
      ? stmts.getTransactionsByMonth.all({ userId, month })
      : stmts.getTransactions.all({ userId, limit: parseInt(limit), offset: parseInt(offset) });
    res.json(txs);
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/transactions/upload — receive image, return base64 data URL
app.post('/api/transactions/upload', requireAuth, checkAccess, receiptUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const mime    = req.file.mimetype || 'image/jpeg';
  const b64     = req.file.buffer.toString('base64');
  const dataUrl = `data:${mime};base64,${b64}`;
  res.json({ url: dataUrl });
});

app.post('/api/transactions', requireAuth, checkAccess, (req, res) => {
  try {
    const { type, amount, category, description, date, justificatif } = req.body;

    if (!type || !['income', 'expense'].includes(type))
      return res.status(400).json({ error: 'Type invalide' });
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Montant invalide' });
    if (!category || !getUserCatNames(req.userId).has(category))
      return res.status(400).json({ error: 'Catégorie invalide' });
    if (!description || !description.trim())
      return res.status(400).json({ error: 'Description requise' });

    const txDate  = date || new Date().toISOString().slice(0, 10);
    const result  = stmts.insertTransaction.run({
      userId:       req.userId,
      type,
      amount:       parseFloat(amount),
      category,
      description:  description.trim(),
      date:         txDate,
      justificatif: justificatif || null
    });

    res.status(201).json({ id: result.lastInsertRowid, type, amount: parseFloat(amount), category, description: description.trim(), date: txDate });
  } catch (err) {
    console.error('Create tx error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/transactions/:id', requireAuth, (req, res) => {
  try {
    const result = stmts.deleteTransaction.run({ id: parseInt(req.params.id), userId: req.userId });
    if (result.changes === 0)
      return res.status(404).json({ error: 'Transaction non trouvée' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete tx error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PDF REPORT
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/report/pdf', requireAuth, async (req, res) => {
  const month  = (req.query.month || new Date().toISOString().slice(0, 7)).trim();
  const userId = req.userId;
  console.log(`[PDF] Request — userId=${userId} month=${month}`);

  try {
    // ── Validate month ──────────────────────────────────────────────────────
    if (!/^\d{4}-\d{2}$/.test(month))
      return res.status(400).json({ error: 'Paramètre month invalide (attendu YYYY-MM)' });

    const user = stmts.getUserById.get({ id: userId });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.log(`[PDF] User: ${user.name}`);

    // ── Fetch data ──────────────────────────────────────────────────────────
    const stats   = stmts.getDashboard.get({ userId, month }) || { total_income: 0, total_expense: 0, balance: 0 };
    const allTime = stmts.getAllTimeDashboard.get({ userId }) || { balance: 0 };
    const cats    = stmts.getCategoryStats.all({ userId, month }) || [];
    const txs     = stmts.getTransactionsByMonth.all({ userId, month }) || [];
    console.log(`[PDF] Data: income=${stats.total_income} expense=${stats.total_expense} cats=${cats.length} txs=${txs.length}`);

    // toLocaleString('fr-FR') uses non-breaking space (\u00A0) which pdfkit renders as "/"
    const fmt = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const [year, mon] = month.split('-');
    const monthLabel = new Date(parseInt(year), parseInt(mon) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // ── Coach tip via Claude (non-blocking) ─────────────────────────────────
    let coachTip = 'Continuez à suivre vos finances avec régularité — chaque transaction enregistrée est un pas vers la liberté financière.';
    try {
      const topCat = cats.filter(c => c.type === 'expense').sort((a, b) => b.total - a.total)[0];
      const aiResp = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 160,
        system: 'Tu es Kula, conseiller financier bienveillant. Génère un seul conseil pratique en français (2-3 lignes max, pas de JSON, pas de titre).',
        messages: [{
          role: 'user',
          content: `Conseil pour ${user.name.split(' ')[0]}, mois de ${monthLabel}. Revenus : ${fmt(stats.total_income)} FCFA. Dépenses : ${fmt(stats.total_expense)} FCFA.${topCat ? ` Top dépense : ${topCat.category}.` : ''}`
        }]
      });
      const tip = aiResp.content[0]?.text?.trim();
      if (tip) coachTip = tip;
      console.log('[PDF] Coach tip generated');
    } catch (e) {
      console.warn('[PDF] Coach tip fallback:', e.message);
    }

    // ── Generate PDF in memory (buffer before sending) ───────────────────────
    console.log('[PDF] Starting PDF generation…');
    const PDFDocument = require('pdfkit');
    const doc    = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data',  c => chunks.push(c));

    await new Promise((resolve, reject) => {
      doc.on('end',   resolve);
      doc.on('error', reject);

      // ── Constants ─────────────────────────────────────────────────────────
      const GREEN       = '#1a7a4a';
      const GREEN_MID   = '#10B981';
      const GREEN_LIGHT = '#e8f5ee';
      const GREEN_DIM   = '#a8d5bb';   // replaces rgba white on green bg
      const WHITE_DIM   = '#cce8d8';   // replaces rgba(255,255,255,0.8)
      const WHITE_FAINT = '#a0ccb5';   // replaces rgba(255,255,255,0.6)
      const DARK        = '#111827';
      const GRAY        = '#6B7280';
      const WHITE       = '#FFFFFF';
      const RED         = '#EF4444';
      const PAGE_W      = 595.28;
      const PAGE_H      = 841.89;
      const M           = 40;           // margin
      const CW          = PAGE_W - M * 2; // content width

      // ── HEADER ────────────────────────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 110).fill(GREEN);

      // Logo circle + K
      doc.circle(M + 22, 55, 22).fill(GREEN_MID);
      doc.fontSize(20).fillColor(WHITE).font('Helvetica-Bold').text('K', M + 14, 45);

      // App name + tagline
      doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold').text('Kula', M + 54, 34);
      doc.fontSize(10).fillColor(GREEN_DIM).font('Helvetica').text('Fais grandir ton argent', M + 54, 61);

      // Right side: report label, month, date
      doc.fontSize(11).fillColor(WHITE).font('Helvetica-Bold')
         .text('RAPPORT FINANCIER', 0, 34, { align: 'right', width: PAGE_W - M });
      doc.fontSize(10).fillColor(WHITE_DIM).font('Helvetica')
         .text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 0, 53, { align: 'right', width: PAGE_W - M });
      doc.fontSize(9).fillColor(WHITE_FAINT).font('Helvetica')
         .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 0, 69, { align: 'right', width: PAGE_W - M });

      // ── USER BANNER ───────────────────────────────────────────────────────
      doc.rect(0, 110, PAGE_W, 36).fill(GREEN_LIGHT);
      doc.fontSize(11).fillColor(GREEN).font('Helvetica-Bold').text(user.name, M, 121);
      doc.fontSize(9).fillColor(GRAY).font('Helvetica').text(user.email, M, 134);

      let y = 166;

      // ── SUMMARY CARDS ─────────────────────────────────────────────────────
      const cardW = (CW - 16) / 3;
      const income  = stats.total_income  || 0;
      const expense = stats.total_expense || 0;
      const balance = stats.balance       || 0;

      function summaryCard(x, cy, label, value, valColor, bg) {
        doc.roundedRect(x, cy, cardW, 70, 7).fill(bg);
        doc.fontSize(8).fillColor(GRAY).font('Helvetica').text(label, x + 12, cy + 10);
        doc.fontSize(15).fillColor(valColor).font('Helvetica-Bold')
           .text(fmt(value), x + 12, cy + 25, { width: cardW - 20 });
        doc.fontSize(8).fillColor(GRAY).font('Helvetica').text('FCFA', x + 12, cy + 50);
      }

      summaryCard(M,               y, 'Revenus du mois',  income,  '#059669', '#f0fdf4');
      summaryCard(M + cardW + 8,   y, 'Dépenses du mois', expense, RED,       '#fef2f2');
      summaryCard(M + (cardW+8)*2, y, 'Solde du mois',    balance,
        balance >= 0 ? '#059669' : RED,
        balance >= 0 ? '#f0fdf4' : '#fef2f2');
      y += 82;

      // All-time balance strip
      doc.roundedRect(M, y, CW, 32, 6).fill(GREEN);
      doc.fontSize(9).fillColor(WHITE).font('Helvetica')
         .text('Solde total (tous les temps) :', M + 14, y + 10);
      doc.fontSize(11).fillColor(WHITE).font('Helvetica-Bold')
         .text(`${fmt(allTime.balance || 0)} FCFA`, 0, y + 10, { align: 'right', width: PAGE_W - M - 14 });
      y += 46;

      // ── CATEGORY SECTION ──────────────────────────────────────────────────
      const expenseCats = cats.filter(c => c.type === 'expense');

      if (expenseCats.length > 0) {
        doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text('Dépenses par catégorie', M, y);
        doc.moveTo(M, y + 18).lineTo(PAGE_W - M, y + 18).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        y += 26;

        const CAT_COLORS = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6',
                            '#F97316','#EC4899','#14B8A6','#6366F1','#84CC16'];
        const totalExp = expenseCats.reduce((s, c) => s + c.total, 0);

        // ── Donut chart (pdfkit native path API) ───────────────────────────
        const CX = M + 70;
        const CY = y + 68;
        const OR = 54;   // outer radius
        const IR = 31;   // inner radius

        let angle = -Math.PI / 2;
        expenseCats.forEach((cat, i) => {
          const slice = (cat.total / totalExp) * 2 * Math.PI;
          // Avoid degenerate single-slice (full circle)
          const end = slice >= 2 * Math.PI - 0.001 ? angle + 2 * Math.PI - 0.001 : angle + slice;
          doc.save()
             .moveTo(CX + OR * Math.cos(angle), CY + OR * Math.sin(angle))
             .arc(CX, CY, OR, angle, end, false)
             .lineTo(CX + IR * Math.cos(end), CY + IR * Math.sin(end))
             .arc(CX, CY, IR, end, angle, true)
             .closePath()
             .fill(CAT_COLORS[i % CAT_COLORS.length]);
          doc.restore();
          angle += slice;
        });
        // Center white hole
        doc.circle(CX, CY, IR - 1).fill(WHITE);

        // ── Legend ─────────────────────────────────────────────────────────
        const LX   = M + 152;
        let   legY = y + 6;
        expenseCats.slice(0, 9).forEach((cat, i) => {
          const col  = CAT_COLORS[i % CAT_COLORS.length];
          const pct  = Math.round(cat.total / totalExp * 100);
          const barW = Math.max(3, (cat.total / totalExp) * 130);

          doc.rect(LX, legY + 3, 8, 8).fill(col);
          doc.fontSize(9).fillColor(DARK).font('Helvetica')
             .text(cat.category, LX + 13, legY + 2, { width: 85 });
          doc.fontSize(8).fillColor(GRAY).font('Helvetica')
             .text(`${fmt(cat.total)} FCFA (${pct}%)`, LX + 105, legY + 2);
          doc.rect(LX + 13, legY + 13, 130, 2).fill('#F3F4F6');
          doc.rect(LX + 13, legY + 13, barW, 2).fill(col);
          legY += 19;
        });

        y = Math.max(CY + OR + 14, legY + 6);
      }

      // ── TRANSACTION LIST ──────────────────────────────────────────────────
      if (txs.length > 0) {
        if (y > PAGE_H - 180) { doc.addPage({ margin: 0 }); y = 44; }

        doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text('Transactions du mois', M, y);
        doc.moveTo(M, y + 18).lineTo(PAGE_W - M, y + 18).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        y += 26;

        // Header row
        doc.rect(M, y, CW, 19).fill(GREEN_LIGHT);
        doc.fontSize(7.5).fillColor(GREEN).font('Helvetica-Bold')
           .text('DATE',        M + 8,   y + 5)
           .text('DESCRIPTION', M + 66,  y + 5)
           .text('CATÉGORIE',   M + 268, y + 5)
           .text('TYPE',        M + 388, y + 5)
           .text('MONTANT',     0,        y + 5, { align: 'right', width: PAGE_W - M - 8 });
        y += 19;

        txs.forEach((tx, idx) => {
          if (y > PAGE_H - 70) { doc.addPage({ margin: 0 }); y = 44; }
          const rowH = 17;
          if (idx % 2 === 0) doc.rect(M, y, CW, rowH).fill('#F9FAFB');

          const sign    = tx.type === 'income' ? '+' : '-';
          const amtCol  = tx.type === 'income' ? '#059669' : RED;
          const dateStr = new Date(tx.date + 'T12:00:00')
            .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          const desc = tx.description.length > 28
            ? tx.description.slice(0, 26) + '…' : tx.description;

          doc.fontSize(7.5).fillColor(DARK).font('Helvetica')
             .text(dateStr,     M + 8,   y + 4, { width: 53 })
             .text(desc,        M + 66,  y + 4, { width: 196 })
             .text(tx.category, M + 268, y + 4, { width: 114 });
          doc.fontSize(7.5).fillColor(tx.type === 'income' ? '#059669' : GRAY).font('Helvetica')
             .text(tx.type === 'income' ? 'Revenu' : 'Dépense', M + 388, y + 4, { width: 52 });
          doc.fontSize(7.5).fillColor(amtCol).font('Helvetica-Bold')
             .text(`${sign}${fmt(tx.amount)}`, 0, y + 4, { align: 'right', width: PAGE_W - M - 8 });
          y += rowH;
        });
      }

      // ── COACH TIP ─────────────────────────────────────────────────────────
      if (y > PAGE_H - 110) { doc.addPage({ margin: 0 }); y = 44; }
      y += 18;
      const tipHeight = 24 + Math.ceil(coachTip.length / 90) * 14 + 16;
      doc.roundedRect(M, y, CW, tipHeight, 8).fillAndStroke(GREEN_LIGHT, GREEN);
      doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
         .text('Conseil de Kula', M + 16, y + 12);
      doc.fontSize(10).fillColor(DARK).font('Helvetica')
         .text(coachTip, M + 16, y + 26, { width: CW - 32, lineGap: 3 });
      y += tipHeight + 14;

      // ── FOOTER ────────────────────────────────────────────────────────────
      doc.rect(0, PAGE_H - 32, PAGE_W, 32).fill(GREEN_LIGHT);
      doc.fontSize(8).fillColor(GRAY).font('Helvetica')
         .text(
           `Kula · Fais grandir ton argent · ${new Date().toLocaleDateString('fr-FR')} · © ${new Date().getFullYear()} Kula`,
           0, PAGE_H - 19, { align: 'center', width: PAGE_W }
         );

      doc.end();
    });

    // ── Send buffered PDF ────────────────────────────────────────────────────
    const buf = Buffer.concat(chunks);
    console.log(`[PDF] Done — ${buf.length} bytes`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kula-rapport-${month}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);

  } catch (err) {
    console.error('[PDF] Error:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ error: `Erreur PDF : ${err.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POCHES ÉPARGNE
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/poches', requireAuth, (req, res) => {
  try {
    res.json(stmts.getPoches.all({ userId: req.userId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/poches', requireAuth, (req, res) => {
  try {
    const { nom, objectif_montant, date_echeance } = req.body;
    if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    const objectif = parseFloat(objectif_montant);
    if (!objectif || objectif <= 0) return res.status(400).json({ error: 'Objectif invalide' });
    const result = stmts.insertPoche.run({ userId: req.userId, nom: nom.trim(), objectif, echeance: date_echeance || null });
    res.status(201).json(stmts.getPocheById.get({ id: result.lastInsertRowid, userId: req.userId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/poches/:id', requireAuth, (req, res) => {
  try {
    const { nom, objectif_montant, date_echeance } = req.body;
    const id = parseInt(req.params.id);
    if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    const objectif = parseFloat(objectif_montant);
    if (!objectif || objectif <= 0) return res.status(400).json({ error: 'Objectif invalide' });
    const r = stmts.updatePoche.run({ id, userId: req.userId, nom: nom.trim(), objectif, echeance: date_echeance || null });
    if (r.changes === 0) return res.status(404).json({ error: 'Poche non trouvée' });
    res.json(stmts.getPocheById.get({ id, userId: req.userId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/poches/:id', requireAuth, (req, res) => {
  try {
    const r = stmts.deletePoche.run({ id: parseInt(req.params.id), userId: req.userId });
    if (r.changes === 0) return res.status(404).json({ error: 'Poche non trouvée' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/poches/:id/alimenter', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const montant = parseFloat(req.body.montant);
    if (!montant || montant <= 0) return res.status(400).json({ error: 'Montant invalide' });
    const before = stmts.getPocheById.get({ id, userId: req.userId });
    if (!before) return res.status(404).json({ error: 'Poche non trouvée' });
    stmts.alimenterPoche.run({ id, userId: req.userId, montant });
    const after = stmts.getPocheById.get({ id, userId: req.userId });

    // Virement : déduire le montant du solde principal (transaction négative)
    stmts.insertTransaction.run({
      userId:      req.userId,
      type:        'expense',
      amount:      montant,
      category:    'Autre',
      description: `💰 Épargne : ${before.nom}`,
      date:        new Date().toISOString().slice(0, 10),
      justificatif: null
    });

    const goal_reached = before.montant_actuel < before.objectif_montant && after.montant_actuel >= after.objectif_montant;
    res.json({ ...after, goal_reached });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// KOLA COACH
// ═══════════════════════════════════════════════════════════════════════════════

function buildFinancialContext(userId) {
  const today   = new Date().toISOString().slice(0, 10);
  const day3ago = new Date(Date.now() - 3  * 86400000).toISOString().slice(0, 10);
  const day7ago = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
  const day30ago= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const txToday = stmts.getTxSince.all({ userId, since: today });
  const tx7     = stmts.getTxSince.all({ userId, since: day7ago });
  const tx30    = stmts.getTxSince.all({ userId, since: day30ago });

  const sum = (txs, type) => txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

  // Category breakdown over last 7 days (expenses)
  const catMap = {};
  tx7.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `${cat}: ${Math.round(amt).toLocaleString('fr-FR')} FCFA`);

  // 3-day trend
  const tx3 = stmts.getTxSince.all({ userId, since: day3ago });

  return {
    todayCount:    txToday.length,
    todayExpense:  sum(txToday, 'expense'),
    todayIncome:   sum(txToday, 'income'),
    week: {
      income:  sum(tx7, 'income'),
      expense: sum(tx7, 'expense'),
      balance: sum(tx7, 'income') - sum(tx7, 'expense'),
      txCount: tx7.length
    },
    month: {
      income:  sum(tx30, 'income'),
      expense: sum(tx30, 'expense'),
      balance: sum(tx30, 'income') - sum(tx30, 'expense')
    },
    day3: {
      income:  sum(tx3, 'income'),
      expense: sum(tx3, 'expense')
    },
    topCategories: topCats
  };
}

// GET /api/coach/analysis — daily briefing
app.get('/api/coach/analysis', requireAuth, async (req, res) => {
  try {
    const user   = stmts.getUserById.get({ id: req.userId });
    const ctx    = buildFinancialContext(req.userId);
    const hour   = new Date().getHours();
    const moment = hour < 12 ? 'matin' : hour < 17 ? 'après-midi' : 'soir';
    const dayIdx = new Date().getDate() - 1;
    const quote  = KOLA_QUOTES[dayIdx % KOLA_QUOTES.length];
    const fmt    = n => Math.round(n).toLocaleString('fr-FR');

    const systemPrompt = `Tu es Kula, le coach financier personnel de l'application Kula. Tu es comme un grand frère africain bienveillant, direct, motivant et chaleureux. Tu utilises des emojis. Tu parles en français, style familier mais respectueux. Ton objectif : que ${user.name.split(' ')[0]} réussisse financièrement. Réponds UNIQUEMENT avec du JSON valide : {"message":"<ton message>"}.`;

    const userPrompt = `Il est ${hour}h (${moment}). Génère un message de coaching personnalisé pour ${user.name.split(' ')[0]}.

Données financières :
- Aujourd'hui : ${ctx.todayCount} transaction(s), dépenses ${fmt(ctx.todayExpense)} FCFA, revenus ${fmt(ctx.todayIncome)} FCFA
- 3 derniers jours : dépenses ${fmt(ctx.day3.expense)} FCFA, revenus ${fmt(ctx.day3.income)} FCFA
- Cette semaine : revenus ${fmt(ctx.week.income)} FCFA, dépenses ${fmt(ctx.week.expense)} FCFA, solde ${fmt(ctx.week.balance)} FCFA (${ctx.week.txCount} transactions)
- Ce mois : revenus ${fmt(ctx.month.income)} FCFA, dépenses ${fmt(ctx.month.expense)} FCFA
- Top dépenses 7j : ${ctx.topCategories.length ? ctx.topCategories.join(', ') : 'aucune encore'}

Instructions selon le moment :
- Matin : motive pour bien commencer la journée, donne un objectif simple
- Après-midi : vérifie comment se passe la journée, conseil pratique
- Soir : bilan de la journée, félicite ou encourage, prépare demain

Sois précis avec les vrais chiffres. Max 4 phrases. Personnalise selon les données.`;

    const aiResp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    let message = '';
    try {
      const parsed = JSON.parse(aiResp.content[0]?.text?.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim() || '{}');
      message = parsed.message || '';
    } catch { message = aiResp.content[0]?.text || ''; }

    res.json({ message, quote, week: ctx.week, topCategories: ctx.topCategories, moment });
  } catch (err) {
    console.error('Coach analysis error:', err);
    res.status(500).json({ error: 'Erreur coach' });
  }
});

// POST /api/coach/chat — conversation with Kula
app.post('/api/coach/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message requis' });

    const user = stmts.getUserById.get({ id: req.userId });
    const ctx  = buildFinancialContext(req.userId);
    const fmt  = n => Math.round(n).toLocaleString('fr-FR');
    const name = user.name.split(' ')[0];

    const systemPrompt = `Tu es Kula, le coach financier personnel de ${name} dans l'application Kula. Tu es comme un grand frère africain — bienveillant, direct, motivant, avec de l'humour. Tu utilises des emojis. Tu parles en français familier mais respectueux.

Données financières actuelles de ${name} :
- Cette semaine : revenus ${fmt(ctx.week.income)} FCFA, dépenses ${fmt(ctx.week.expense)} FCFA, solde ${fmt(ctx.week.balance)} FCFA
- Ce mois : revenus ${fmt(ctx.month.income)} FCFA, dépenses ${fmt(ctx.month.expense)} FCFA
- Top dépenses 7j : ${ctx.topCategories.length ? ctx.topCategories.join(', ') : 'aucune encore'}

Ton rôle : conseiller financier personnel. Réponds aux questions, donne des conseils pratiques basés sur les vraies données, encourage les bonnes habitudes. Sois concis (max 3 paragraphes). Réponds en texte pur (pas de JSON).`;

    const messages = history.slice(-10)
      .filter(h => h.role && h.content)
      .concat([{ role: 'user', content: message }]);

    const aiResp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages
    });

    res.json({ message: aiResp.content[0]?.text || 'Je suis là pour toi 💪' });
  } catch (err) {
    console.error('Coach chat error:', err);
    res.status(500).json({ error: 'Erreur coach' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT (AI)
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/chat', requireAuth, checkAccess, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message requis' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ type: 'message', message: "Clé API Anthropic manquante." });
    }

    const today = new Date().toISOString().slice(0, 10);

    // ── Load conversation history from DB (last 20 messages, chronological) ──
    const dbHistory = stmts.getChatHistory.all({ userId: req.userId, limit: 20 });
    dbHistory.reverse(); // DESC → ASC

    // ── Fetch live financial context ──────────────────────────────────────────
    const currentMonth = today.slice(0, 7);
    const user         = stmts.getUserById.get({ id: req.userId });
    const firstName    = user?.name?.split(' ')[0] || 'toi';
    const dashStats    = stmts.getDashboard.get({ userId: req.userId, month: currentMonth }) || {};
    const allTime      = stmts.getAllTimeDashboard.get({ userId: req.userId }) || {};
    const recentTx     = stmts.getRecentTransactions.all({ userId: req.userId, limit: 50 });
    const catStats     = stmts.getCategoryStats.all({ userId: req.userId, month: currentMonth });
    const poches       = stmts.getPoches.all({ userId: req.userId });
    const budgets      = stmts.getBudgets.all({ userId: req.userId, mois: currentMonth });
    const userCatsList = stmts.getCategories.all({ userId: req.userId });
    const fmtN = n => Math.round(n || 0).toLocaleString('fr-FR');

    // Top 3 expense categories this month
    const topExpCats = catStats
      .filter(c => c.type === 'expense')
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(c => `${c.category} : ${fmtN(c.total)} FCFA`)
      .join(', ') || 'aucune';

    // Recent transactions summary (last 10)
    const recentTxLines = recentTx.length
      ? recentTx.map(t =>
          `  #${t.id} | ${t.date} | ${t.type === 'income' ? '+' : '-'}${fmtN(t.amount)} FCFA | ${t.category} | ${t.description}`
        ).join('\n')
      : '  Aucune transaction récente';

    // Poches d'épargne (avec IDs explicites pour les outils)
    const pochesLines = poches.length
      ? poches.map(p => {
          const pct  = p.objectif_montant > 0 ? Math.round(p.montant_actuel / p.objectif_montant * 100) : 0;
          const rest = Math.max(0, p.objectif_montant - p.montant_actuel);
          return `  [ID:${p.id}] "${p.nom}" — actuel:${fmtN(p.montant_actuel)} FCFA / objectif:${fmtN(p.objectif_montant)} FCFA (${pct}%, reste ${fmtN(rest)} FCFA)`;
        }).join('\n')
      : '  Aucune poche créée';

    // Budgets du mois
    const budgetsLines = budgets.length
      ? budgets.map(b => {
          const spent  = catStats.find(c => c.category === b.category && c.type === 'expense')?.total || 0;
          const pct    = Math.round(spent / b.limite * 100);
          return `  ${b.category} : budget ${fmtN(b.limite)} FCFA, dépensé ${fmtN(spent)} FCFA (${pct}%)`;
        }).join('\n')
      : '  Aucun budget défini';

    // Catégories personnalisées de l'utilisateur
    const incomeCats  = userCatsList.filter(c => c.type === 'income'  || c.type === 'both').map(c => c.nom);
    const expenseCats = userCatsList.filter(c => c.type === 'expense' || c.type === 'both').map(c => c.nom);
    const catsLine    = userCatsList.length
      ? `Revenus : ${incomeCats.join(', ') || 'aucune'}\nDépenses : ${expenseCats.join(', ') || 'aucune'}`
      : 'Revenus : Salaire, Business, Famille, Solde initial\nDépenses : Alimentation, Transport, Loisirs, Vêtements, Santé, Éducation, Téléphone, Logement, Autre';

    const systemPrompt = `Tu es Kula, un conseiller financier personnel de confiance. Kula signifie "grandir" en kituba — et c'est exactement ce que tu aides les gens à faire : grandir financièrement.

Ta personnalité : chaleureux, bienveillant et professionnel. Tu t'exprimes avec clarté et élégance, comme un conseiller qui respecte son client. Tu es ancré dans la réalité africaine francophone — tu connais le contexte, tu comprends les défis du quotidien — mais tu apportes la rigueur d'un vrai professionnel de la finance. Tu utilises quelques emojis choisis pour humaniser tes messages, jamais en excès.

Ton ton : encourageant sans être familier. Tu tutoies naturellement mais avec respect. Pas de "mon frère / chef / boss" — plutôt "je vous invite à…", "je vous encourage à…", "c'est une bonne décision". Tu motives avec des faits et des perspectives concrètes, pas avec de l'enthousiasme creux.

Aujourd'hui nous sommes le ${today}. Tu parles à ${firstName}.

── SITUATION FINANCIÈRE ACTUELLE DE ${firstName.toUpperCase()} ──
Solde total (tous les temps) : ${fmtN(allTime.balance)} FCFA
Mois en cours (${currentMonth}) :
  Revenus    : ${fmtN(dashStats.total_income)} FCFA
  Dépenses   : ${fmtN(dashStats.total_expense)} FCFA
  Solde mois : ${fmtN(dashStats.balance)} FCFA
Top dépenses ce mois : ${topExpCats}

Transactions récentes — 50 dernières (IDs à utiliser avec les outils) :
${recentTxLines}

Poches d'épargne (utilise TOUJOURS poche_id avec l'ID [ID:x] ci-dessous pour add_to_poche — ne pas deviner le nom) :
${pochesLines}

Budgets du mois ${currentMonth} :
${budgetsLines}
────────────────────────────────────────────────

CATÉGORIES DE ${firstName.toUpperCase()} :
${catsLine}

TES RÔLES :
A) ENREGISTRER DES TRANSACTIONS — quand l'utilisateur décrit des dépenses ou revenus
B) MODIFIER / SUPPRIMER DES TRANSACTIONS — via les outils disponibles quand l'utilisateur le demande
C) CONSEILLER FINANCIÈREMENT — budget, épargne, investissement, gestion de l'argent
D) COACHER ET MOTIVER — analyser les habitudes, valoriser les progrès, fixer des objectifs réalistes

RÈGLES TRANSACTIONS :
1. Détecte TOUTES les transactions dans le message (il peut y en avoir plusieurs).
2. Chaque transaction doit avoir un montant explicite — sinon, demande poliment une précision.
3. Adapte la catégorie au contexte local (ex : "manioc/foufou" → Alimentation, "moto-taxi/wewa" → Transport).
4. Pour modifier ou supprimer une transaction, utilise les outils delete_transaction et update_transaction.

RÈGLES CONSEILS :
- Conseils pratiques, chiffrés en FCFA, adaptés à la réalité africaine francophone.
- Mentionne des outils concrets : règle 50/30/20, tontines, fonds d'urgence, épargne progressive.
- Reste positif même face à une situation difficile — propose toujours une voie d'amélioration.
- Pour un bilan ou une analyse, sois précis, structuré et personnalisé.

FORMAT TRANSACTIONS (une ou plusieurs) :
{"type":"transactions","transactions":[{"type":"expense"|"income","amount":<number>,"category":"<catégorie>","description":"<description courte>","date":"${today}"},...],"message":"<confirmation professionnelle et chaleureuse>"}

FORMAT MESSAGE (conseil / analyse / clarification / résultat d'outil) :
{"type":"message","message":"<réponse en français, claire et structurée, max 3 paragraphes>"}

EXEMPLES DE RÉPONSES ATTENDUES :
- "Acheté du pain 500 et payé wewa 300" → 2 transactions expense, message de confirmation sobre
- "Reçu salaire 200 000 et remboursé un ami 15 000" → 1 income + 1 expense
- "Comment économiser ?" → conseil structuré avec étapes concrètes
- "Supprime la transaction 42" → utilise delete_transaction, puis réponds en JSON message
- "Change le montant de la transaction 7 à 5000" → utilise update_transaction, puis réponds en JSON message
- "J'ai dépensé de l'argent" → demande poliment le montant et la nature

Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour. Sauf quand tu utilises un outil.`;

    // ── Tools ──────────────────────────────────────────────────────────────────
    const tools = [
      {
        name: 'delete_transaction',
        description: "Supprime définitivement une transaction de l'historique de l'utilisateur.",
        input_schema: {
          type: 'object',
          properties: {
            transaction_id: { type: 'integer', description: "L'ID de la transaction à supprimer" }
          },
          required: ['transaction_id']
        }
      },
      {
        name: 'add_to_poche',
        description: "Alimente une poche d'épargne de l'utilisateur avec un montant donné.",
        input_schema: {
          type: 'object',
          properties: {
            poche_id:  { type: 'integer', description: "ID numérique de la poche d'épargne (prioritaire — utilise-le si disponible depuis la liste)" },
            nom_poche: { type: 'string', description: "Nom de la poche d'épargne (utilisé seulement si poche_id absent)" },
            montant:   { type: 'number', description: 'Montant en FCFA à ajouter à la poche' }
          },
          required: ['montant']
        }
      },
      {
        name: 'update_transaction',
        description: "Modifie une transaction existante (type, montant, catégorie, description ou date).",
        input_schema: {
          type: 'object',
          properties: {
            transaction_id: { type: 'integer', description: "L'ID de la transaction à modifier" },
            type:        { type: 'string', enum: ['income', 'expense'], description: 'Nouveau type' },
            amount:      { type: 'number', description: 'Nouveau montant positif en FCFA' },
            category:    { type: 'string', enum: [...getUserCatNames(req.userId)], description: 'Nouvelle catégorie' },
            description: { type: 'string', description: 'Nouvelle description courte' },
            date:        { type: 'string', description: 'Nouvelle date au format YYYY-MM-DD' }
          },
          required: ['transaction_id']
        }
      }
    ];

    // ── Save user message to DB ───────────────────────────────────────────────
    stmts.insertChatMessage.run({ userId: req.userId, role: 'user', content: message.trim() });

    let goalReachedPoche = null; // set when add_to_poche reaches the goal

    // ── Agentic loop (handles tool_use rounds) ────────────────────────────────
    const messages = [
      ...dbHistory,
      { role: 'user', content: message.trim() }
    ];

    let raw = '';
    let toolsUsed = false;

    while (true) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages
      });

      if (response.stop_reason === 'tool_use') {
        toolsUsed = true;
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

        // Add assistant turn with tool_use blocks
        messages.push({ role: 'assistant', content: response.content });

        // Execute each tool and collect results
        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
          let result;
          if (toolUse.name === 'delete_transaction') {
            const { transaction_id } = toolUse.input;
            const r = stmts.deleteTransaction.run({ id: transaction_id, userId: req.userId });
            result = r.changes > 0
              ? `Transaction #${transaction_id} supprimée avec succès.`
              : `Transaction #${transaction_id} introuvable ou accès refusé.`;
          } else if (toolUse.name === 'update_transaction') {
            const { transaction_id, ...updates } = toolUse.input;
            const existing = stmts.getTransactionById.get({ id: transaction_id, userId: req.userId });
            if (!existing) {
              result = `Transaction #${transaction_id} introuvable ou accès refusé.`;
            } else {
              const newType   = updates.type        || existing.type;
              const newAmt    = updates.amount      ? parseFloat(updates.amount) : existing.amount;
              const newCat    = updates.category    || existing.category;
              const newDesc   = updates.description || existing.description;
              const newDate   = updates.date        || existing.date;
              if (!['income', 'expense'].includes(newType)) {
                result = 'Type invalide.';
              } else if (isNaN(newAmt) || newAmt <= 0) {
                result = 'Montant invalide.';
              } else if (!getUserCatNames(req.userId).has(newCat)) {
                result = `Catégorie invalide : "${newCat}".`;
              } else {
                stmts.updateTransaction.run({
                  id: transaction_id, userId: req.userId,
                  type: newType, amount: newAmt,
                  category: newCat, description: newDesc, date: newDate
                });
                result = `Transaction #${transaction_id} mise à jour avec succès.`;
              }
            }
          } else if (toolUse.name === 'add_to_poche') {
            const { poche_id, nom_poche, montant: toolMontant } = toolUse.input;
            if (!toolMontant || toolMontant <= 0) {
              result = 'Montant positif requis.';
            } else {
              let poche = null;
              if (poche_id) {
                poche = stmts.getPocheById.get({ id: poche_id, userId: req.userId });
              } else if (nom_poche) {
                poche = stmts.getPocheByNom.get({ userId: req.userId, pattern: `%${nom_poche}%` });
              } else {
                // No identifier — pick the first/only poche if there's exactly one
                const allPoches = stmts.getPoches.all({ userId: req.userId });
                if (allPoches.length === 1) poche = allPoches[0];
              }
              if (!poche) {
                const allPoches = stmts.getPoches.all({ userId: req.userId });
                const list = allPoches.length
                  ? allPoches.map(p => `  [ID:${p.id}] "${p.nom}"`).join('\n')
                  : '  Aucune poche';
                result = `Poche introuvable. Voici les poches disponibles :\n${list}\nUtilise poche_id avec l'ID correct.`;
              } else {
                const wasComplete = poche.montant_actuel >= poche.objectif_montant;
                const m = parseFloat(toolMontant);
                stmts.alimenterPoche.run({ id: poche.id, userId: req.userId, montant: m });
                // Virement : déduire du solde principal
                stmts.insertTransaction.run({
                  userId: req.userId, type: 'expense', amount: m,
                  category: 'Autre',
                  description: `💰 Épargne : ${poche.nom}`,
                  date: new Date().toISOString().slice(0, 10),
                  justificatif: null
                });
                const updated = stmts.getPocheById.get({ id: poche.id, userId: req.userId });
                const pct = Math.round(updated.montant_actuel / updated.objectif_montant * 100);
                result = `Poche "${poche.nom}" alimentée de ${fmtN(m)} FCFA. Solde : ${fmtN(updated.montant_actuel)} / ${fmtN(updated.objectif_montant)} FCFA (${pct}%). Une dépense de ${fmtN(m)} FCFA a été déduite de ton solde principal.`;
                if (!wasComplete && updated.montant_actuel >= updated.objectif_montant) {
                  result += ` 🎉 OBJECTIF ATTEINT !`;
                  goalReachedPoche = { nom: poche.nom };
                }
              }
            }
          } else {
            result = 'Outil inconnu.';
          }
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
        }

        messages.push({ role: 'user', content: toolResults });
        continue; // next iteration — get final text response
      }

      // stop_reason === 'end_turn' (or max_tokens)
      raw = response.content.find(b => b.type === 'text')?.text || '';
      break;
    }

    // ── Parse response ────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      parsed = { type: 'message', message: raw };
    }

    // Normalise single transaction → array
    if (parsed.type === 'transaction' && parsed.transaction) {
      parsed.type = 'transactions';
      parsed.transactions = [parsed.transaction];
    }

    // If tools were used, signal the frontend to refresh its data
    if (toolsUsed) parsed.refresh = true;
    if (goalReachedPoche) parsed.poche_goal_reached = goalReachedPoche;

    // ── Auto-insert new transactions into SQLite ───────────────────────────────
    if (parsed.type === 'transactions' && Array.isArray(parsed.transactions)) {
      const saved = [];
      const errors = [];

      for (const tx of parsed.transactions) {
        try {
          if (!tx.type || !['income', 'expense'].includes(tx.type))
            throw new Error(`type invalide: ${tx.type}`);
          if (!tx.amount || isNaN(tx.amount) || parseFloat(tx.amount) <= 0)
            throw new Error(`montant invalide: ${tx.amount}`);
          if (!tx.category || !getUserCatNames(req.userId).has(tx.category))
            throw new Error(`catégorie inconnue: "${tx.category}"`);
          if (!tx.description?.trim())
            throw new Error('description manquante');

          const txDate = tx.date || today;
          const result = stmts.insertTransaction.run({
            userId: req.userId, type: tx.type,
            amount: parseFloat(tx.amount), category: tx.category,
            description: tx.description.trim(), date: txDate,
            justificatif: null
          });
          saved.push({ id: result.lastInsertRowid, ...tx, amount: parseFloat(tx.amount), date: txDate });
        } catch (e) {
          console.error('Chat tx insert error:', e.message, tx);
          errors.push({ tx, error: e.message });
        }
      }

      parsed.transactions = saved;
      if (errors.length) {
        const errMsg = errors.map(e => `"${e.tx.description || '?'}" (${e.error})`).join(', ');
        parsed.message = (parsed.message || '') + ` ⚠️ Non enregistré : ${errMsg}`;
      }
    }

    // ── Save assistant response to DB ─────────────────────────────────────────
    const assistantContent = parsed.message || raw;
    if (assistantContent) {
      stmts.insertChatMessage.run({ userId: req.userId, role: 'assistant', content: String(assistantContent) });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Chat error:', err);
    const msg = err.status === 401 ? 'Clé API invalide.' : "Erreur, réessayez.";
    res.status(500).json({ type: 'message', message: msg });
  }
});

// ── Categories CRUD ───────────────────────────────────────────────────────────

app.get('/api/categories', requireAuth, (req, res) => {
  let cats = stmts.getCategories.all({ userId: req.userId });
  // Seed defaults for existing users who have no categories yet
  if (cats.length === 0) {
    DEFAULT_CATEGORIES.forEach(cat => {
      stmts.insertCategory.run({ userId: req.userId, nom: cat.nom, icone: cat.icone, couleur: cat.couleur, type: cat.type });
    });
    cats = stmts.getCategories.all({ userId: req.userId });
  }
  res.json(cats);
});

app.post('/api/categories', requireAuth, (req, res) => {
  const { nom, icone = '📦', couleur = '#6B7280', type = 'expense' } = req.body;
  if (!nom?.trim()) return res.status(400).json({ error: 'Nom requis' });
  if (!['income', 'expense', 'both'].includes(type))
    return res.status(400).json({ error: 'Type invalide' });
  try {
    const r = stmts.insertCategory.run({ userId: req.userId, nom: nom.trim(), icone, couleur, type });
    if (r.changes === 0) return res.status(409).json({ error: 'Cette catégorie existe déjà' });
    const cat = stmts.getCategoryById.get({ id: r.lastInsertRowid, userId: req.userId });
    res.status(201).json(cat);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const { nom, icone, couleur, type } = req.body;
  if (!nom?.trim()) return res.status(400).json({ error: 'Nom requis' });
  const existing = stmts.getCategoryById.get({ id: parseInt(req.params.id), userId: req.userId });
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });
  if (type && !['income', 'expense', 'both'].includes(type))
    return res.status(400).json({ error: 'Type invalide' });
  try {
    stmts.updateCategory.run({
      id: parseInt(req.params.id), userId: req.userId,
      nom:     nom.trim(),
      icone:   icone   ?? existing.icone,
      couleur: couleur ?? existing.couleur,
      type:    type    ?? existing.type
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ce nom est déjà utilisé' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  stmts.deleteCategory.run({ id: parseInt(req.params.id), userId: req.userId });
  res.json({ ok: true });
});


// ── Web Push routes ───────────────────────────────────────────────────────────

// Return the VAPID public key so the frontend can subscribe
app.get('/api/push/vapid-key', (req, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ error: 'Push non configuré' });
  res.json({ publicKey: VAPID_PUBLIC });
});

// Save a push subscription for the authenticated user
app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'Subscription invalide' });

  stmts.upsertPushSubscription.run({
    userId:   req.userId,
    endpoint,
    p256dh:   keys.p256dh,
    auth:     keys.auth
  });
  res.json({ ok: true });
});

// Remove a push subscription (called on unsubscribe / logout)
app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) stmts.deletePushSubscription.run({ endpoint });
  res.json({ ok: true });
});

// ── Scheduled push notifications — 3 slots per day (UTC) ─────────────────────
// UTC times: 08h ≈ 8-9h local for West/Central Africa, 20h ≈ 20-21h local
const PUSH_SLOTS = [
  {
    utcHour: 8,
    payload: { title: 'Kula 🌱', body: '🌅 Bonne journée ! Pense à noter tes dépenses et revenus du matin.', tag: 'kula-morning', icon: '/icon-192.png', badge: '/icon-192.png', data: { tab: 'dashboard' } }
  },
  {
    utcHour: 13,
    payload: { title: 'Kula 🌱', body: '☀️ Pause déjeuner ! Quelques dépenses à enregistrer dans Kula ?', tag: 'kula-midday', icon: '/icon-192.png', badge: '/icon-192.png', data: { tab: 'dashboard' } }
  },
  {
    utcHour: 20,
    payload: { title: 'Kula 🌱', body: '🌙 Bonsoir ! Prends 2 minutes pour faire le bilan financier de ta journée.', tag: 'kula-evening', icon: '/icon-192.png', badge: '/icon-192.png', data: { tab: 'chat' } }
  }
];

async function sendPushToAll(payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = stmts.getAllPushSubscriptions.all();
  if (!subs.length) return;
  const payloadStr = JSON.stringify(payload);
  let ok = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      );
      ok++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        stmts.deletePushSubscription.run({ endpoint: sub.endpoint });
      }
    }
  }
  console.log(`[Push] "${payload.tag}" sent to ${ok}/${subs.length} subscribers`);
}

function schedulePushSlot(slot) {
  const now  = new Date();
  const next = new Date(now);
  next.setUTCHours(slot.utcHour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1); // already past today
  const delay = next - now;
  setTimeout(() => {
    sendPushToAll(slot.payload);
    setInterval(() => sendPushToAll(slot.payload), 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`  Push slot ${slot.utcHour}h UTC scheduled in ${Math.round(delay / 60000)} min`);
}

PUSH_SLOTS.forEach(schedulePushSlot);

// ── Widget page (lightweight, for PWA shortcut / home screen pin) ────────────
app.get('/widget', requireAuth, (req, res) => {
  try {
    const month   = new Date().toISOString().slice(0, 7);
    const userId  = req.userId;
    const stats   = stmts.getDashboard.get({ userId, month });
    const allTime = stmts.getAllTimeDashboard.get({ userId });
    const budgets = stmts.getBudgets.all({ userId, mois: month });

    const totalBudget  = budgets.reduce((s, b) => s + b.limite, 0);
    const expense      = stats.total_expense || 0;
    const pct          = totalBudget > 0 ? Math.min(100, Math.round(expense / totalBudget * 100)) : null;
    const barColor     = pct === null ? '#10B981' : pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

    const fmt = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

    res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Kula Widget</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#064E3B;color:#fff;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:rgba(255,255,255,.08);border-radius:20px;padding:24px 28px;width:100%;max-width:340px}
  .logo{font-size:13px;opacity:.6;margin-bottom:16px;letter-spacing:.05em}
  .label{font-size:11px;opacity:.55;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em}
  .amount{font-size:32px;font-weight:700;letter-spacing:-.5px;margin-bottom:18px}
  .amount.expense{color:#FCA5A5}
  .amount.balance{color:#6EE7B7}
  .budget-row{margin-top:4px}
  .budget-bar-bg{height:8px;background:rgba(255,255,255,.15);border-radius:99px;overflow:hidden;margin-top:6px}
  .budget-bar-fill{height:100%;border-radius:99px;transition:width .4s}
  .budget-pct{font-size:12px;opacity:.7;margin-top:5px}
</style>
</head><body>
<div class="card">
  <div class="logo">🌱 Kula</div>
  <div class="label">Solde total</div>
  <div class="amount balance">${fmt(allTime.balance)} <small style="font-size:14px">FCFA</small></div>
  <div class="label">Dépenses ce mois</div>
  <div class="amount expense">${fmt(expense)} <small style="font-size:14px">FCFA</small></div>
  ${pct !== null ? `
  <div class="budget-row">
    <div class="label">Budget global utilisé</div>
    <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
    <div class="budget-pct">${pct}% de ${fmt(totalBudget)} FCFA</div>
  </div>` : ''}
</div>
</body></html>`);
  } catch (e) {
    res.status(500).send('Erreur');
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const row = stmts.getUserById.get({ id: req.userId });
  console.log('[Admin] check userId=%s email=%s ADMIN=%s', req.userId, row?.email, ADMIN_EMAIL);
  if (!row || row.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = stmts.getAdminStats.get();
    console.log('[Admin] stats:', stats);
    res.json(stats);
  } catch (e) {
    console.error('[Admin] stats error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const now   = today();
    const rows  = stmts.getAllUsers.all();
    console.log('[Admin] users count:', rows.length);
    const users = rows.map(u => {
      const isPremium = u.plan === 'premium' && u.subscription_end >= now;
      const inTrial   = u.plan === 'free' && u.trial_end && u.trial_end >= now;
      return { ...u, effective_plan: isPremium ? 'premium' : (inTrial ? 'trial' : 'free') };
    });
    res.json(users);
  } catch (e) {
    console.error('[Admin] users error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/set-premium', requireAuth, requireAdmin, (req, res) => {
  const { email, days } = req.body;
  if (!email || !days || isNaN(days) || days < 1)
    return res.status(400).json({ error: 'email et days (≥1) requis' });
  const subEnd = dateAddDays(parseInt(days));
  const result = stmts.activatePremiumByEmail.run({ subEnd, email: email.toLowerCase() });
  if (!result.changes) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  console.log('[Admin] set-premium email=%s until=%s', email, subEnd);
  res.json({ ok: true, subscription_end: subEnd });
});

app.post('/api/admin/revoke-premium', requireAuth, requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email requis' });
  const result = stmts.revokePremiumByEmail.run({ email: email.toLowerCase() });
  if (!result.changes) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  console.log('[Admin] revoke email=%s', email);
  res.json({ ok: true });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler (must be last) ───────────────────────────────────────
// Catches errors from middleware (express.json parse errors, etc.) and returns JSON
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Express error]', err.status, err.message, err.type || '');
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur serveur';
  if (!res.headersSent) res.status(status).json({ error: message });
});


// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌱 Kula démarré sur http://localhost:${PORT}`);
  console.log(`   API Claude : ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ ANTHROPIC_API_KEY manquante'}`);
  console.log(`   JWT secret : ${process.env.JWT_SECRET ? '✅' : '⚠️  fallback (définir JWT_SECRET)'}`);
});
