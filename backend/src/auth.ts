import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "./db";

const router = Router();

// --- Config ---
const JWT_SECRET = process.env.JWT_SECRET || "paperproof-dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

// --- Types ---
export interface User {
  id: number;
  email: string;
  created_at: string;
  tier: string;
  papers_remaining: number | null;
  subscription_expires_at: string | null;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// --- Helpers ---
function generateToken(user: User): string {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Middleware ---
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    req.user = { id: payload.id, email: payload.email, created_at: "" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// --- Routes ---

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existing = db.query("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    // Hash password and create user
    const passwordHash = await Bun.password.hash(password);
    const result = db.run(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash]
    );

    const user: User = {
      id: Number(result.lastInsertRowid),
      email,
      created_at: new Date().toISOString(),
      tier: "free",
      papers_remaining: null,
      subscription_expires_at: null,
    };

    const token = generateToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const row = db.query(
      "SELECT id, email, password_hash, created_at, tier, papers_remaining, subscription_expires_at FROM users WHERE email = ?"
    ).get(email) as { id: number; email: string; password_hash: string; created_at: string; tier: string; papers_remaining: number | null; subscription_expires_at: string | null } | null;

    if (!row) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const valid = await Bun.password.verify(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user: User = {
      id: row.id,
      email: row.email,
      created_at: row.created_at,
      tier: row.tier,
      papers_remaining: row.papers_remaining,
      subscription_expires_at: row.subscription_expires_at,
    };

    const token = generateToken(user);
    return res.json({ user, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me — protected
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const row = db.query(
      "SELECT id, email, created_at, tier, papers_remaining, subscription_expires_at FROM users WHERE id = ?"
    ).get(req.user!.id) as User | null;

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: row });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
