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
        return path.join(__dirname, 'kula.db');
      }
    }
    console.log(`  DB path : ${envPath}`);
    return envPath;
  }
  const fallback = path.join(__dirname, 'kula.db');
  console.log(`  DB path : ${fallback} (no DB_PATH set)`);
  return fallback;
}

const DB_PATH =  /data/kula.db();

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
  getUserById:    db.prepare(`SELECT id, name, email, created_at FROM users WHERE id = $id`),

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

module.exports = { db, stmts, VALID_CATEGORIES };
