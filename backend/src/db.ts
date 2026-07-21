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

export default db;
