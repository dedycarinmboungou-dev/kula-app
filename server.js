require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const { stmts, VALID_CATEGORIES } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kula_fallback_secret';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ── Kola Coach — citations africaines ────────────────────────────────────────
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
  { text: "Économiser n'est pas une privation, c'est une préparation.", author: "Kola 🌱" },
  { text: "Même une longue marche commence par un premier pas.", author: "Sagesse africaine" },
  { text: "Le cacao ne pousse pas en un jour, mais il vaut tout l'or.", author: "Proverbe africain" },
  { text: "Connais tes dépenses avant de connaître tes désirs.", author: "Sagesse financière" },
  { text: "Ce que tu surveilles, tu le contrôles. Ce que tu ignores te contrôle.", author: "Kola 🌱" },
  { text: "L'argent de demain se prépare avec les décisions d'aujourd'hui.", author: "Sagesse africaine" },
  { text: "Même le grand baobab a commencé comme une petite graine.", author: "Proverbe africain" },
  { text: "Ne laisse pas la dépense d'aujourd'hui voler la paix de demain.", author: "Kola 🌱" },
  { text: "La prospérité n'est pas ce que tu possèdes, mais ce que tu bâtis.", author: "Sagesse africaine" },
  { text: "Un budget bien tenu est une liberté bien méritée.", author: "Kola 🌱" },
  { text: "L'eau qui dort dans la rivière creuse aussi les rochers.", author: "Proverbe africain" },
  { text: "Ce qui est fait avec soin reste, ce qui est fait à la hâte se défait.", author: "Proverbe africain" },
  { text: "La rivière qui oublie ses sources se tarit.", author: "Sagesse africaine" },
  { text: "Chaque effort aujourd'hui est un soulagement demain.", author: "Sagesse africaine" },
  { text: "Qui garde sa main ouverte pour donner garde aussi son cœur ouvert pour recevoir.", author: "Proverbe africain" },
  { text: "Le courage c'est de commencer, la persévérance c'est de continuer.", author: "Sagesse africaine" },
  { text: "L'arbre qui donne des fruits se souvient qu'il fut un jour une graine.", author: "Sagesse africaine" },
  { text: "Un lion affamé chasse mieux qu'un lion rassasié.", author: "Proverbe africain" },
  { text: "Mieux vaut dépenser moins et vivre plus longtemps.", author: "Sagesse africaine" },
  { text: "Grandir, c'est apprendre à faire plus avec moins.", author: "Kola 🌱" }
];

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
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

    const user = { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim() };
    const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

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

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const month   = req.query.month || new Date().toISOString().slice(0, 7);
    const userId  = req.userId;

    const stats      = stmts.getDashboard.get({ userId, month });
    const allTime    = stmts.getAllTimeDashboard.get({ userId });
    const categories = stmts.getCategoryStats.all({ userId, month });
    const recent     = stmts.getRecentTransactions.all({ userId, limit: 5 });
    const trend      = stmts.getMonthlyTrend.all({ userId });

    res.json({
      month,
      balance:        allTime.balance,
      monthlyIncome:  stats.total_income,
      monthlyExpense: stats.total_expense,
      monthlyBalance: stats.balance,
      categories,
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
app.get('/api/transactions', requireAuth, (req, res) => {
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

app.post('/api/transactions', requireAuth, (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    if (!type || !['income', 'expense'].includes(type))
      return res.status(400).json({ error: 'Type invalide' });
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Montant invalide' });
    if (!category || !VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: 'Catégorie invalide' });
    if (!description || !description.trim())
      return res.status(400).json({ error: 'Description requise' });

    const txDate  = date || new Date().toISOString().slice(0, 10);
    const result  = stmts.insertTransaction.run({
      userId: req.userId,
      type,
      amount:      parseFloat(amount),
      category,
      description: description.trim(),
      date:        txDate
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

    const systemPrompt = `Tu es Kola, le coach financier personnel de l'application Kula. Tu es comme un grand frère africain bienveillant, direct, motivant et chaleureux. Tu utilises des emojis. Tu parles en français, style familier mais respectueux. Ton objectif : que ${user.name.split(' ')[0]} réussisse financièrement. Réponds UNIQUEMENT avec du JSON valide : {"message":"<ton message>"}.`;

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

// POST /api/coach/chat — conversation with Kola
app.post('/api/coach/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message requis' });

    const user = stmts.getUserById.get({ id: req.userId });
    const ctx  = buildFinancialContext(req.userId);
    const fmt  = n => Math.round(n).toLocaleString('fr-FR');
    const name = user.name.split(' ')[0];

    const systemPrompt = `Tu es Kola, le coach financier personnel de ${name} dans l'application Kula. Tu es comme un grand frère africain — bienveillant, direct, motivant, avec de l'humour. Tu utilises des emojis. Tu parles en français familier mais respectueux.

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
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message requis' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ type: 'message', message: "Clé API Anthropic manquante." });
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Tu es Kula, un coach financier personnel bienveillant. Kula signifie "grandir" en kituba. Tu es comme un grand frère africain — bienveillant, direct, motivant, avec de l'humour. Tu parles en français familier mais respectueux, tu utilises des emojis. Adapté au contexte africain francophone.

Aujourd'hui nous sommes le ${today}.

CATÉGORIES DISPONIBLES:
- Revenus (income): Salaire, Business, Famille, Solde initial
- Dépenses (expense): Alimentation, Transport, Loisirs, Vêtements, Santé, Éducation, Téléphone, Logement, Autre

TES RÔLES:
A) ENREGISTRER DES TRANSACTIONS — quand l'utilisateur décrit des dépenses ou revenus
B) DONNER DES CONSEILS FINANCIERS — quand l'utilisateur pose une question sur son budget, ses habitudes, comment économiser, investir, gérer son argent
C) COACHER ET MOTIVER — analyser les habitudes, féliciter les progrès, donner des objectifs concrets

RÈGLES TRANSACTIONS:
1. Détecte TOUTES les transactions dans le message (il peut y en avoir plusieurs).
2. Chaque transaction doit avoir un montant explicite — sinon demande clarification.
3. Adapte la catégorie au contexte africain (ex: "manioc/foufou" → Alimentation, "moto-taxi/wewa" → Transport).

RÈGLES CONSEILS ET COACHING:
- Donne des conseils pratiques, adaptés à la réalité africaine francophone.
- Utilise des exemples concrets en FCFA.
- Encourage l'épargne, la règle 50/30/20, les tontines, les fonds d'urgence.
- Sois positif même si la situation financière est difficile.
- Pour les bilans et analyses, sois précis et personnalisé.

FORMAT TRANSACTIONS (une ou plusieurs) :
{"type":"transactions","transactions":[{"type":"expense"|"income","amount":<number>,"category":"<catégorie>","description":"<description courte>","date":"${today}"},...],"message":"<confirmation chaleureuse en français>"}

FORMAT MESSAGE (conseil / coaching / clarification) :
{"type":"message","message":"<réponse en français, max 3 paragraphes, bienveillante et concrète>"}

EXEMPLES:
- "Acheté du pain 500 et payé wewa 300" → 2 transactions expense
- "Reçu salaire 200000 et remboursé ami 15000" → 1 income + 1 expense
- "Comment économiser ?" → conseil sur l'épargne
- "Analyse mes dépenses" → coaching personnalisé
- "Est-ce que je dépense trop ?" → conseil + encouragement
- "J'ai dépensé de l'argent" → demande le montant

Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour.`;

    const messages = history.slice(-10)
      .filter(h => h.role && h.content)
      .concat([{ role: 'user', content: message }]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    const raw = response.content[0]?.text || '';
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

    // Auto-insert all detected transactions into SQLite
    if (parsed.type === 'transactions' && Array.isArray(parsed.transactions)) {
      const saved = [];
      const errors = [];

      for (const tx of parsed.transactions) {
        try {
          if (!tx.type || !['income', 'expense'].includes(tx.type))
            throw new Error(`type invalide: ${tx.type}`);
          if (!tx.amount || isNaN(tx.amount) || parseFloat(tx.amount) <= 0)
            throw new Error(`montant invalide: ${tx.amount}`);
          if (!tx.category || !VALID_CATEGORIES.includes(tx.category))
            throw new Error(`catégorie inconnue: "${tx.category}"`);
          if (!tx.description?.trim())
            throw new Error('description manquante');

          const txDate = tx.date || today;
          const result = stmts.insertTransaction.run({
            userId:      req.userId,
            type:        tx.type,
            amount:      parseFloat(tx.amount),
            category:    tx.category,
            description: tx.description.trim(),
            date:        txDate
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

    res.json(parsed);
  } catch (err) {
    console.error('Chat error:', err);
    const msg = err.status === 401 ? 'Clé API invalide.' : "Erreur, réessayez.";
    res.status(500).json({ type: 'message', message: msg });
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌱 Kula démarré sur http://localhost:${PORT}`);
  console.log(`   API Claude : ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ ANTHROPIC_API_KEY manquante'}`);
  console.log(`   JWT secret : ${process.env.JWT_SECRET ? '✅' : '⚠️  fallback (définir JWT_SECRET)'}`);
});
