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

// ── PayTech payments table ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS paytech_payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_command TEXT    NOT NULL UNIQUE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    amount      REAL    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    ipn_secret  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
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

// ── Projects table ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'perso',
    owner_id   INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// ── Project members table ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS project_members (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email      TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'editor',
    status     TEXT    NOT NULL DEFAULT 'pending',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(project_id, email)
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
if (!userColNames.includes('currency'))             db.exec("ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'XOF'");
if (!userColNames.includes('language'))             db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'fr'");
if (!userColNames.includes('last_seen_at'))         db.exec("ALTER TABLE users ADD COLUMN last_seen_at TEXT");

// Migration: add columns to transactions if missing
const cols = db.prepare('PRAGMA table_info(transactions)').all();
if (!cols.some(c => c.name === 'user_id'))      db.exec('ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)');
if (!cols.some(c => c.name === 'justificatif')) db.exec('ALTER TABLE transactions ADD COLUMN justificatif TEXT');
if (!cols.some(c => c.name === 'project_id'))   db.exec('ALTER TABLE transactions ADD COLUMN project_id INTEGER REFERENCES projects(id)');

// Migration: add project_id to poches_epargne if missing
const pocheCols = db.prepare('PRAGMA table_info(poches_epargne)').all();
if (!pocheCols.some(c => c.name === 'project_id'))
  db.exec('ALTER TABLE poches_epargne ADD COLUMN project_id INTEGER REFERENCES projects(id)');

// Migration: budgets needs project_id AND a new UNIQUE constraint including project_id.
// Since SQLite cannot ALTER UNIQUE constraints, we use PRAGMA user_version to gate a one-time table rebuild.
const userVersion = db.prepare('PRAGMA user_version').get().user_version;
if (userVersion < 2) {
  console.log('[MIGRATION] Rebuilding budgets table to include project_id in UNIQUE constraint...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      category   TEXT    NOT NULL,
      limite     REAL    NOT NULL DEFAULT 0,
      mois       TEXT    NOT NULL,
      UNIQUE(user_id, project_id, category, mois)
    );
    INSERT INTO budgets_new (id, user_id, project_id, category, limite, mois)
      SELECT id, user_id, NULL, category, limite, mois FROM budgets;
    DROP TABLE budgets;
    ALTER TABLE budgets_new RENAME TO budgets;
    PRAGMA user_version = 2;
  `);
  console.log('[MIGRATION] budgets table rebuilt successfully.');
}

// Indexes (after migration)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tx_user_date     ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_tx_user_type     ON transactions(user_id, type);
  CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions(user_id, category);
  CREATE INDEX IF NOT EXISTS idx_tx_project       ON transactions(user_id, project_id, date);
  CREATE INDEX IF NOT EXISTS idx_bud_project      ON budgets(user_id, project_id, mois);
  CREATE INDEX IF NOT EXISTS idx_poche_project    ON poches_epargne(user_id, project_id);
  CREATE INDEX IF NOT EXISTS idx_chat_user        ON chat_history(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_proj_owner       ON projects(owner_id);
  CREATE INDEX IF NOT EXISTS idx_pm_email         ON project_members(email, status);
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
  getUserById:    db.prepare(`SELECT id, name, email, photo, currency, language, created_at FROM users WHERE id = $id`),
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
  updateUserCurrency: db.prepare(`
    UPDATE users SET currency = $currency WHERE id = $id
  `),
  updateUserLanguage: db.prepare(`
    UPDATE users SET language = $language WHERE id = $id
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
  grantPremiumById: db.prepare(`
    UPDATE users SET plan = 'premium', subscription_end = $subEnd WHERE id = $id
  `),

  // Last seen (throttled)
  updateLastSeen: db.prepare(`
    UPDATE users SET last_seen_at = $now
    WHERE id = $id AND (last_seen_at IS NULL OR last_seen_at < $threshold)
  `),

  // Admin overview
  getAdminOverview: db.prepare(`
    SELECT
      COUNT(*) AS total_users,
      SUM(CASE WHEN plan = 'free' AND trial_end >= date('now') THEN 1 ELSE 0 END) AS trials_active,
      SUM(CASE WHEN plan = 'premium' AND subscription_end >= date('now') THEN 1 ELSE 0 END) AS premium_active,
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS signups_7d,
      SUM(CASE WHEN last_seen_at >= date('now') THEN 1 ELSE 0 END) AS active_today
    FROM users
  `),

  // Admin users list with tx count
  getAdminUsersWithTx: db.prepare(`
    SELECT u.id, u.name, u.email, u.plan, u.trial_start, u.trial_end,
           u.subscription_end, u.created_at, u.last_seen_at, u.currency,
           COUNT(t.id) AS tx_count
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `),

  // Engagement: active users lists
  getActiveToday: db.prepare(`
    SELECT email FROM users WHERE last_seen_at >= date('now') ORDER BY last_seen_at DESC
  `),
  getActiveThisWeek: db.prepare(`
    SELECT email FROM users WHERE last_seen_at >= date('now', '-7 days') ORDER BY last_seen_at DESC
  `),
  countActiveThisMonth: db.prepare(`
    SELECT COUNT(*) AS cnt FROM users WHERE last_seen_at >= date('now', 'start of month')
  `),
  getInactive7d: db.prepare(`
    SELECT email FROM users
    WHERE (last_seen_at IS NULL OR last_seen_at < date('now', '-7 days'))
    ORDER BY last_seen_at ASC
  `),

  // Cohorts: users by signup week
  getCohorts: db.prepare(`
    SELECT
      CASE
        WHEN created_at >= date('now', 'weekday 0', '-7 days') THEN 0
        WHEN created_at >= date('now', 'weekday 0', '-14 days') THEN 1
        WHEN created_at >= date('now', 'weekday 0', '-21 days') THEN 2
        WHEN created_at >= date('now', 'weekday 0', '-28 days') THEN 3
        ELSE 4
      END AS week_offset,
      COUNT(*) AS signups,
      SUM(CASE WHEN last_seen_at >= date('now', '-7 days') THEN 1 ELSE 0 END) AS still_active
    FROM users
    WHERE created_at >= date('now', '-28 days')
    GROUP BY week_offset
    HAVING week_offset < 4
    ORDER BY week_offset ASC
  `),

  // Conversion
  getTrialsExpiringSoon: db.prepare(`
    SELECT id, email, trial_end FROM users
    WHERE plan = 'free' AND trial_end >= date('now') AND trial_end <= date('now', '+3 days')
    ORDER BY trial_end ASC
  `),
  getAvgDaysToPayment: db.prepare(`
    SELECT AVG(julianday(p.created_at) - julianday(u.created_at)) AS avg_days
    FROM paytech_payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'completed'
  `),

  // Revenue
  getRevenueThisMonth: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM paytech_payments
    WHERE status = 'completed' AND created_at >= date('now', 'start of month')
  `),
  getRevenueLastMonth: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM paytech_payments
    WHERE status = 'completed'
      AND created_at >= date('now', 'start of month', '-1 month')
      AND created_at < date('now', 'start of month')
  `),
  getRecentPayments: db.prepare(`
    SELECT p.created_at, u.email, p.amount, p.status, p.ref_command
    FROM paytech_payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 20
  `),

  // Export all users
  getAllUsersExport: db.prepare(`
    SELECT u.id, u.name, u.email, u.plan, u.trial_start, u.trial_end,
           u.subscription_end, u.created_at, u.last_seen_at, u.currency, u.language,
           COUNT(t.id) AS tx_count
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `),

  // Budgets (scoped per project)
  getBudgets: db.prepare(`
    SELECT category, limite FROM budgets
    WHERE user_id = $userId AND project_id = $projectId AND mois = $mois
  `),
  upsertBudget: db.prepare(`
    INSERT INTO budgets (user_id, project_id, category, limite, mois)
    VALUES ($userId, $projectId, $category, $limite, $mois)
    ON CONFLICT(user_id, project_id, category, mois) DO UPDATE SET limite = excluded.limite
  `),
  deleteBudget: db.prepare(`
    DELETE FROM budgets
    WHERE user_id = $userId AND project_id = $projectId AND category = $category AND mois = $mois
  `),

  // Transactions (scoped per project)
  insertTransaction: db.prepare(`
    INSERT INTO transactions (user_id, project_id, type, amount, category, description, date, justificatif)
    VALUES ($userId, $projectId, $type, $amount, $category, $description, $date, $justificatif)
  `),
  getTransactions: db.prepare(`
    SELECT * FROM transactions WHERE user_id = $userId AND project_id = $projectId
    ORDER BY date DESC, created_at DESC LIMIT $limit OFFSET $offset
  `),
  getTransactionsByMonth: db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = $userId AND project_id = $projectId AND strftime('%Y-%m', date) = $month
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

  // Poches Épargne (scoped per project)
  insertPoche: db.prepare(`
    INSERT INTO poches_epargne (user_id, project_id, nom, objectif_montant, date_echeance)
    VALUES ($userId, $projectId, $nom, $objectif, $echeance)
  `),
  getPoches: db.prepare(`
    SELECT * FROM poches_epargne WHERE user_id = $userId AND project_id = $projectId
    ORDER BY created_at DESC
  `),
  getPocheById: db.prepare(`
    SELECT * FROM poches_epargne WHERE id = $id AND user_id = $userId
  `),
  getPocheByNom: db.prepare(`
    SELECT * FROM poches_epargne
    WHERE user_id = $userId AND project_id = $projectId AND nom LIKE $pattern
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
  getPushSubscriptionsByUser: db.prepare(`
    SELECT * FROM push_subscriptions WHERE user_id = $userId
  `),
  deleteAllPushSubscriptions: db.prepare(`
    DELETE FROM push_subscriptions
  `),

  // PayTech payments
  insertPayment: db.prepare(`
    INSERT INTO paytech_payments (ref_command, user_id, amount, status, ipn_secret)
    VALUES ($ref_command, $user_id, $amount, $status, $ipn_secret)
  `),
  getPaymentByRef: db.prepare(`
    SELECT * FROM paytech_payments WHERE ref_command = $ref_command
  `),
  updatePaymentStatus: db.prepare(`
    UPDATE paytech_payments SET status = $status WHERE ref_command = $ref_command
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
    FROM transactions
    WHERE user_id = $userId AND project_id = $projectId AND strftime('%Y-%m', date) = $month
  `),
  getCategoryStats: db.prepare(`
    SELECT category, type, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    WHERE user_id = $userId AND project_id = $projectId AND strftime('%Y-%m', date) = $month
    GROUP BY category, type ORDER BY total DESC
  `),
  getAllTimeDashboard: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0      END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0      END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 0) AS balance
    FROM transactions WHERE user_id = $userId AND project_id = $projectId
  `),
  getRecentTransactions: db.prepare(`
    SELECT * FROM transactions WHERE user_id = $userId AND project_id = $projectId
    ORDER BY date DESC, created_at DESC LIMIT $limit
  `),
  getTxSince: db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = $userId AND project_id = $projectId AND date >= $since
    ORDER BY date DESC
  `),
  getMonthlyTrend: db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    WHERE user_id = $userId AND project_id = $projectId
      AND date >= date('now', '-5 months', 'start of month')
    GROUP BY month ORDER BY month ASC
  `),

  // ── Projects ───────────────────────────────────────────────────────────────
  insertProject: db.prepare(`
    INSERT INTO projects (name, type, owner_id) VALUES ($name, $type, $ownerId)
  `),
  getProjectById: db.prepare(`SELECT * FROM projects WHERE id = $id`),
  getOwnedProjects: db.prepare(`
    SELECT id, name, type, owner_id, created_at, 'owner' AS role
    FROM projects WHERE owner_id = $userId
    ORDER BY created_at ASC
  `),
  getMemberProjects: db.prepare(`
    SELECT p.id, p.name, p.type, p.owner_id, p.created_at, m.role
    FROM projects p
    JOIN project_members m ON m.project_id = p.id
    WHERE m.email = $email AND m.status = 'accepted' AND p.owner_id != $userId
    ORDER BY p.created_at ASC
  `),
  getPersonalProject: db.prepare(`
    SELECT id FROM projects WHERE owner_id = $userId AND type = 'perso'
    ORDER BY created_at ASC LIMIT 1
  `),
  updateProject: db.prepare(`
    UPDATE projects SET name = $name, type = $type WHERE id = $id AND owner_id = $ownerId
  `),
  deleteProject: db.prepare(`
    DELETE FROM projects WHERE id = $id AND owner_id = $ownerId AND type != 'perso'
  `),
  // Returns the project row only if user has access (owner OR accepted member)
  checkProjectAccess: db.prepare(`
    SELECT p.id, p.owner_id, p.type FROM projects p
    LEFT JOIN project_members m ON m.project_id = p.id AND m.email = $email AND m.status = 'accepted'
    WHERE p.id = $projectId AND (p.owner_id = $userId OR m.id IS NOT NULL)
    LIMIT 1
  `),

  // ── Project members ────────────────────────────────────────────────────────
  insertProjectMember: db.prepare(`
    INSERT INTO project_members (project_id, email, role, status)
    VALUES ($projectId, $email, $role, $status)
    ON CONFLICT(project_id, email) DO UPDATE SET role = excluded.role
  `),
  getProjectMembers: db.prepare(`
    SELECT id, project_id, email, role, status, created_at
    FROM project_members WHERE project_id = $projectId
    ORDER BY created_at ASC
  `),
  acceptInvitesForEmail: db.prepare(`
    UPDATE project_members SET status = 'accepted'
    WHERE email = $email AND status = 'pending'
  `),
  deleteProjectMember: db.prepare(`
    DELETE FROM project_members WHERE id = $id AND project_id = $projectId
  `),

  // ── Project migration helpers ──────────────────────────────────────────────
  listAllUsers: db.prepare(`SELECT id FROM users`),
  attachUserTxToProject: db.prepare(`
    UPDATE transactions SET project_id = $projectId
    WHERE user_id = $userId AND project_id IS NULL
  `),
  attachUserBudgetsToProject: db.prepare(`
    UPDATE budgets SET project_id = $projectId
    WHERE user_id = $userId AND project_id IS NULL
  `),
  attachUserPochesToProject: db.prepare(`
    UPDATE poches_epargne SET project_id = $projectId
    WHERE user_id = $userId AND project_id IS NULL
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
