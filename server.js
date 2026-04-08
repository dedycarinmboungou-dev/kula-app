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

    const systemPrompt = `Tu es Kula, un assistant financier bienveillant pour une application de gestion de budget personnel. Kula signifie "grandir" en kituba. Tu parles en français, avec un ton chaleureux et encourageant, adapté au contexte africain francophone.

Aujourd'hui nous sommes le ${today}.

CATÉGORIES DISPONIBLES:
- Revenus (income): Salaire, Business, Famille, Solde initial
- Dépenses (expense): Alimentation, Transport, Loisirs, Vêtements, Santé, Éducation, Téléphone, Logement, Autre

TES RÔLES:
A) ENREGISTRER DES TRANSACTIONS — quand l'utilisateur décrit des dépenses ou revenus
B) DONNER DES CONSEILS FINANCIERS — quand l'utilisateur pose une question sur son budget, ses dépenses, comment économiser, investir, gérer son argent, etc.
C) MOTIVER ET ENCOURAGER — féliciter les bonnes habitudes, encourager à tenir le budget

RÈGLES TRANSACTIONS:
1. Détecte TOUTES les transactions dans le message (il peut y en avoir plusieurs).
2. Chaque transaction doit avoir un montant explicite — sinon demande clarification.
3. Adapte la catégorie au contexte africain (ex: "manioc/foufou" → Alimentation, "moto-taxi/wewa" → Transport).

RÈGLES CONSEILS:
- Donne des conseils pratiques, adaptés à la réalité africaine francophone.
- Utilise des exemples concrets en FCFA.
- Encourage l'épargne, la règle 50/30/20, les tontines, les fonds d'urgence.
- Sois positif même si la situation financière est difficile.

FORMAT TRANSACTIONS (une ou plusieurs) :
{"type":"transactions","transactions":[{"type":"expense"|"income","amount":<number>,"category":"<catégorie>","description":"<description courte>","date":"${today}"},...],"message":"<confirmation chaleureuse en français>"}

FORMAT MESSAGE (conseil / question / clarification) :
{"type":"message","message":"<réponse en français, max 3 paragraphes, bienveillante et pratique>"}

EXEMPLES:
- "Acheté du pain 500 et payé wewa 300" → 2 transactions expense
- "Reçu salaire 200000 et remboursé ami 15000" → 1 income + 1 expense
- "Comment économiser ?" → conseil sur l'épargne
- "Est-ce que je dépense trop en transport ?" → conseil + encouragement
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
