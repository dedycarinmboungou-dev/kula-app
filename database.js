const path = require('path');
const fs   = require('fs');

function resolveDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    const dir = path.dirname(envPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  DB dir "${dir}" created`);
      } catch (e) {
        console.warn(`  Cannot create DB dir "${dir}": ${e.message} — falling back to ./kula.db`);
        return '/data/kula.db';
      }
    }
    console.log(`  DB path : ${envPath}`);
    return envPath;
  }
  const fallback = '/data/kula.db';
  console.log(`  DB path : ${fallback} (no DB_PATH set)`);
  return fallback;
}

const DB_PATH =  resolveDbPath();

// ── DB driver: better-sqlite3 (Railway/prod) ou node:sqlite (local fallback) ──
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  console.log('  SQLite driver : better-sqlite3');
} catch {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  console.log('  SQLite driver : node:sqlite (built-in)');
}

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = OFF'); // OFF during migration

// ── Users table ───────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// ── Transactions: create if absent, then migrate ──────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL CHECK(type IN ('income', 'expense')),
    amount      REAL    NOT NULL CHECK(amount > 0),
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    date        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// ── Budgets table ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    category   TEXT    NOT NULL,
    limite     REAL    NOT NULL DEFAULT 0,
    mois       TEXT    NOT NULL,
    UNIQUE(user_id, category, mois)
  );
`);

// ── Poches Épargne table ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS poches_epargne (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    nom              TEXT    NOT NULL,
    objectif_montant REAL    NOT NULL CHECK(objectif_montant > 0),
    montant_actuel   REAL    NOT NULL DEFAULT 0,
    date_echeance    TEXT,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// ── User categories table ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    nom        TEXT    NOT NULL,
    icone      TEXT    NOT NULL DEFAULT '📦',
    couleur    TEXT    NOT NULL DEFAULT '#6B7280',
    type       TEXT    NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'both')),
    UNIQUE(user_id, nom)
  );
`);

// ── Push subscriptions table ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    endpoint   TEXT    NOT NULL UNIQUE,
    p256dh     TEXT    NOT NULL,
    auth       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// ── Chat history table ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    role       TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// Migration: add photo + freemium columns to users if missing
const userCols = db.prepare('PRAGMA table_info(users)').all();
const userColNames = userCols.map(c => c.name);
if (!userColNames.includes('photo'))                db.exec("ALTER TABLE users ADD COLUMN photo TEXT");
if (!userColNames.includes('plan'))                 db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
if (!userColNames.includes('trial_start'))          db.exec("ALTER TABLE users ADD COLUMN trial_start TEXT");
if (!userColNames.includes('trial_end'))            db.exec("ALTER TABLE users ADD COLUMN trial_end TEXT");
if (!userColNames.includes('subscription_end'))     db.exec("ALTER TABLE users ADD COLUMN subscription_end TEXT");
if (!userColNames.includes('moneroo_customer_id'))  db.exec("ALTER TABLE users ADD COLUMN moneroo_customer_id TEXT");

// Migration: add user_id column if missing
const cols = db.prepare('PRAGMA table_info(transactions)').all();
if (!cols.some(c => c.name === 'user_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)');
}

// Indexes (after migration)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tx_user_date     ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_tx_user_type     ON transactions(user_id, type);
  CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions(user_id, category);
  CREATE INDEX IF NOT EXISTS idx_chat_user        ON chat_history(user_id, created_at);
`);

db.exec('PRAGMA foreign_keys = ON');

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'Salaire', 'Business', 'Famille', 'Solde initial',
  'Alimentation', 'Transport', 'Loisirs',
  'Vêtements', 'Santé', 'Éducation',
  'Téléphone', 'Logement', 'Autre'
];

// ── Prepared statements ───────────────────────────────────────────────────────
const stmts = {
  // Users
  insertUser:     db.prepare(`INSERT INTO users (name, email, password_hash) VALUES ($name, $email, $hash)`),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = $email`),
  getUserById:    db.prepare(`SELECT id, name, email, photo, created_at FROM users WHERE id = $id`),
  updateUserName:  db.prepare(`UPDATE users SET name = $name WHERE id = $id`),
  updateUserPhoto: db.prepare(`UPDATE users SET photo = $photo WHERE id = $id`),
  setUserTrial: db.prepare(`
    UPDATE users SET trial_start = $trialStart, trial_end = $trialEnd WHERE id = $id
  `),
  getUserPlan: db.prepare(`
    SELECT plan, trial_start, trial_end, subscription_end, email FROM users WHERE id = $id
  `),
  activatePremium: db.prepare(`
    UPDATE users SET plan = 'premium', subscription_end = $subEnd WHERE id = $id
  `),
  resetPlanToFree: db.prepare(`
    UPDATE users SET plan = 'free' WHERE id = $id
  `),
  setMonerooCustomer: db.prepare(`
    UPDATE users SET moneroo_customer_id = $customerId WHERE id = $id
  `),

  // Admin
  getAllUsers: db.prepare(`
    SELECT id, name, email, plan, trial_start, trial_end, subscription_end, created_at
    FROM users ORDER BY created_at DESC
  `),
  getAdminStats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN plan = 'premium' THEN 1 ELSE 0 END) AS premium,
      SUM(CASE WHEN plan = 'free' AND trial_end >= date('now') THEN 1 ELSE 0 END) AS trial,
      SUM(CASE WHEN plan = 'free' AND (trial_end IS NULL OR trial_end < date('now')) THEN 1 ELSE 0 END) AS free_expired
    FROM users
  `),
  activatePremiumByEmail: db.prepare(`
    UPDATE users SET plan = 'premium', subscription_end = $subEnd WHERE email = $email
  `),
  revokePremiumByEmail: db.prepare(`
    UPDATE users SET plan = 'free', subscription_end = NULL WHERE email = $email
  `),

  // Budgets
  getBudgets: db.prepare(`SELECT category, limite FROM budgets WHERE user_id = $userId AND mois = $mois`),
  upsertBudget: db.prepare(`
    INSERT INTO budgets (user_id, category, limite, mois) VALUES ($userId, $category, $limite, $mois)
    ON CONFLICT(user_id, category, mois) DO UPDATE SET limite = excluded.limite
  `),
  deleteBudget: db.prepare(`DELETE FROM budgets WHERE user_id = $userId AND category = $category AND mois = $mois`),

  // Transactions (scoped to user_id)
  insertTransaction: db.prepare(`
    INSERT INTO transactions (user_id, type, amount, category, description, date)
    VALUES ($userId, $type, $amount, $category, $description, $date)
  `),
  getTransactions: db.prepare(`
    SELECT * FROM transactions WHERE user_id = $userId
    ORDER BY date DESC, created_at DESC LIMIT $limit OFFSET $offset
  `),
  getTransactionsByMonth: db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = $userId AND strftime('%Y-%m', date) = $month
    ORDER BY date DESC, created_at DESC
  `),
  deleteTransaction: db.prepare(`
    DELETE FROM transactions WHERE id = $id AND user_id = $userId
  `),
  getTransactionById: db.prepare(`
    SELECT * FROM transactions WHERE id = $id AND user_id = $userId
  `),
  updateTransaction: db.prepare(`
    UPDATE transactions
    SET type = $type, amount = $amount, category = $category,
        description = $description, date = $date
    WHERE id = $id AND user_id = $userId
  `),

  // Poches Épargne
  insertPoche: db.prepare(`
    INSERT INTO poches_epargne (user_id, nom, objectif_montant, date_echeance)
    VALUES ($userId, $nom, $objectif, $echeance)
  `),
  getPoches: db.prepare(`
    SELECT * FROM poches_epargne WHERE user_id = $userId ORDER BY created_at DESC
  `),
  getPocheById: db.prepare(`
    SELECT * FROM poches_epargne WHERE id = $id AND user_id = $userId
  `),
  getPocheByNom: db.prepare(`
    SELECT * FROM poches_epargne WHERE user_id = $userId AND nom LIKE $pattern
    ORDER BY created_at DESC LIMIT 1
  `),
  updatePoche: db.prepare(`
    UPDATE poches_epargne SET nom = $nom, objectif_montant = $objectif, date_echeance = $echeance
    WHERE id = $id AND user_id = $userId
  `),
  deletePoche: db.prepare(`
    DELETE FROM poches_epargne WHERE id = $id AND user_id = $userId
  `),
  alimenterPoche: db.prepare(`
    UPDATE poches_epargne SET montant_actuel = montant_actuel + $montant
    WHERE id = $id AND user_id = $userId
  `),

  // Categories
  insertCategory: db.prepare(`
    INSERT OR IGNORE INTO categories (user_id, nom, icone, couleur, type)
    VALUES ($userId, $nom, $icone, $couleur, $type)
  `),
  getCategories: db.prepare(`
    SELECT * FROM categories WHERE user_id = $userId ORDER BY
      CASE type WHEN 'income' THEN 0 WHEN 'both' THEN 1 ELSE 2 END, nom ASC
  `),
  getCategoryById: db.prepare(`
    SELECT * FROM categories WHERE id = $id AND user_id = $userId
  `),
  updateCategory: db.prepare(`
    UPDATE categories SET nom = $nom, icone = $icone, couleur = $couleur, type = $type
    WHERE id = $id AND user_id = $userId
  `),
  deleteCategory: db.prepare(`
    DELETE FROM categories WHERE id = $id AND user_id = $userId
  `),
  countUserCategories: db.prepare(`
    SELECT COUNT(*) as cnt FROM categories WHERE user_id = $userId
  `),

  // Push subscriptions
  upsertPushSubscription: db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ($userId, $endpoint, $p256dh, $auth)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id
  `),
  deletePushSubscription: db.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = $endpoint
  `),
  getAllPushSubscriptions: db.prepare(`
    SELECT * FROM push_subscriptions
  `),

  // Chat history
  insertChatMessage: db.prepare(`
    INSERT INTO chat_history (user_id, role, content) VALUES ($userId, $role, $content)
  `),
  getChatHistory: db.prepare(`
    SELECT role, content FROM chat_history
    WHERE user_id = $userId ORDER BY created_at DESC LIMIT $limit
  `),
  getDashboard: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0      END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0      END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 0) AS balance
    FROM transactions WHERE user_id = $userId AND strftime('%Y-%m', date) = $month
  `),
  getCategoryStats: db.prepare(`
    SELECT category, type, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    WHERE user_id = $userId AND strftime('%Y-%m', date) = $month
    GROUP BY category, type ORDER BY total DESC
  `),
  getAllTimeDashboard: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0      END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0      END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 0) AS balance
    FROM transactions WHERE user_id = $userId
  `),
  getRecentTransactions: db.prepare(`
    SELECT * FROM transactions WHERE user_id = $userId
    ORDER BY date DESC, created_at DESC LIMIT $limit
  `),
  getTxSince: db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = $userId AND date >= $since
    ORDER BY date DESC
  `),
  getMonthlyTrend: db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    WHERE user_id = $userId AND date >= date('now', '-5 months', 'start of month')
    GROUP BY month ORDER BY month ASC
  `)
};

const DEFAULT_CATEGORIES = [
  { nom: 'Salaire',        icone: '💼', couleur: '#10B981', type: 'income'  },
  { nom: 'Business',       icone: '🏢', couleur: '#059669', type: 'income'  },
  { nom: 'Famille',        icone: '👨‍👩‍👧', couleur: '#34D399', type: 'income'  },
  { nom: 'Solde initial',  icone: '🏦', couleur: '#0EA5E9', type: 'income'  },
  { nom: 'Alimentation',   icone: '🛒', couleur: '#EF4444', type: 'expense' },
  { nom: 'Transport',      icone: '🚌', couleur: '#F97316', type: 'expense' },
  { nom: 'Loisirs',        icone: '🎉', couleur: '#A855F7', type: 'expense' },
  { nom: 'Vêtements',      icone: '👗', couleur: '#EC4899', type: 'expense' },
  { nom: 'Santé',          icone: '🏥', couleur: '#14B8A6', type: 'expense' },
  { nom: 'Éducation',      icone: '📚', couleur: '#3B82F6', type: 'expense' },
  { nom: 'Téléphone',      icone: '📱', couleur: '#8B5CF6', type: 'expense' },
  { nom: 'Logement',       icone: '🏠', couleur: '#F59E0B', type: 'expense' },
  { nom: 'Autre',          icone: '📦', couleur: '#6B7280', type: 'both'    },
];

module.exports = { db, stmts, VALID_CATEGORIES, DEFAULT_CATEGORIES };
