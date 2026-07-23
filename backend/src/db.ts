import { Database } from "bun:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../paperproof.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read perf
db.run("PRAGMA journal_mode = WAL;");

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Create index on email for fast lookups
db.run(`
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Create essays table
db.run(`
  CREATE TABLE IF NOT EXISTS essays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Create index on user_id for fast per-user queries
db.run(`
  CREATE INDEX IF NOT EXISTS idx_essays_user_id ON essays(user_id);
`);

// Create index on created_at for monthly tier counting
db.run(`
  CREATE INDEX IF NOT EXISTS idx_essays_user_created ON essays(user_id, created_at);
`);

// Add proofread_result column if it doesn't exist (migration)
try {
  db.run(`ALTER TABLE essays ADD COLUMN proofread_result TEXT`);
} catch {
  // Column already exists — safe to ignore
}

// Add plagiarism_result column if it doesn't exist (migration)
try {
  db.run(`ALTER TABLE essays ADD COLUMN plagiarism_result TEXT`);
} catch {
  // Column already exists — safe to ignore
}

// Add subscription columns to users table (migration)
try {
  db.run(`ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'`);
} catch { /* already exists */ }
try {
  db.run(`ALTER TABLE users ADD COLUMN papers_remaining INTEGER`);
} catch { /* already exists */ }
try {
  db.run(`ALTER TABLE users ADD COLUMN subscription_expires_at TEXT`);
} catch { /* already exists */ }

export default db;
