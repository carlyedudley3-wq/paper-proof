import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth";
import db from "./db";
import crypto from "node:crypto";

const router = Router();

// --- Tier types ---
export type Tier = "free" | "student" | "pay_per_paper";

// --- Tier-specific limits ---
const FREE_TIER_MONTHLY_LIMIT = 3;

/**
 * Check if the current month's essay count is at/over the monthly limit.
 * Returns the count of essays this month.
 */
function getMonthlyEssayCount(userId: number): number {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfMonthStr = startOfMonth.toISOString().replace("T", " ").slice(0, 19);

  const row = db
    .query(
      `SELECT COUNT(*) AS count FROM essays
       WHERE user_id = ? AND created_at >= ?`
    )
    .get(userId, startOfMonthStr) as { count: number };

  return row.count;
}

// --- Tier enforcement middleware ---

/**
 * Middleware that enforces tier limits on essay creation.
 * - Free: 3 essays/month
 * - Student: unlimited
 * - Pay-per-paper: decrements papers_remaining, blocks at 0
 */
export function checkTierEssayLimit(req: Request, res: Response, next: NextFunction) {
  const user = req.user!;

  if (user.tier === "student") {
    return next();
  }

  if (user.tier === "pay_per_paper") {
    // Refresh from DB
    const row = db
      .query("SELECT papers_remaining FROM users WHERE id = ?")
      .get(user.id) as { papers_remaining: number | null } | null;

    const remaining = row?.papers_remaining ?? 0;

    if (remaining <= 0) {
      return res.status(403).json({
        error: "No papers remaining. Purchase more to continue.",
        tier: "pay_per_paper",
        papersRemaining: 0,
      });
    }

    // Decrement papers_remaining
    db.run("UPDATE users SET papers_remaining = papers_remaining - 1 WHERE id = ?", [user.id]);
    user.papers_remaining = remaining - 1;
    return next();
  }

  // Free tier
  const count = getMonthlyEssayCount(user.id);

  if (count >= FREE_TIER_MONTHLY_LIMIT) {
    return res.status(403).json({
      error: "Free tier limit reached (3 papers/month). Upgrade to Student Plan for unlimited essays.",
      tier: "free",
      limit: FREE_TIER_MONTHLY_LIMIT,
      used: count,
    });
  }

  next();
}

/**
 * Middleware that blocks free users from plagiarism detection.
 */
export function requirePaidForPlagiarism(req: Request, res: Response, next: NextFunction) {
  const user = req.user!;

  if (user.tier === "free") {
    return res.status(403).json({
      error: "Upgrade to Student Plan for plagiarism detection.",
      tier: "free",
    });
  }

  next();
}

/**
 * Middleware that determines proofreading level:
 * - Free: basic only (grammar/spelling)
 * - Student/pay_per_paper: full (grammar, spelling, style, clarity)
 * Sets req.query.basic accordingly so the proofread route can read it.
 */
export function setProofreadLevel(req: Request, _res: Response, next: NextFunction) {
  const user = req.user!;

  if (user.tier === "free") {
    // Force basic-only proofreading for free users
    (req.query as any).basic = "true";
  }
  // For paid users, don't set basic — full mode

  next();
}

// --- Routes ---

// GET /api/subscription — returns current user's tier info
router.get("/", requireAuth, (req: Request, res: Response) => {
  try {
    // Refresh from DB to get latest state
    const row = db
      .query(
        "SELECT tier, papers_remaining, subscription_expires_at FROM users WHERE id = ?"
      )
      .get(req.user!.id) as {
      tier: string;
      papers_remaining: number | null;
      subscription_expires_at: string | null;
    } | null;

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    // Free tier: include monthly usage
    let monthlyUsed = 0;
    let monthlyLimit = FREE_TIER_MONTHLY_LIMIT;

    if (row.tier === "free") {
      monthlyUsed = getMonthlyEssayCount(req.user!.id);
    }

    return res.json({
      tier: row.tier,
      papersRemaining: row.papers_remaining,
      subscriptionExpiresAt: row.subscription_expires_at,
      monthlyUsed: row.tier === "free" ? monthlyUsed : undefined,
      monthlyLimit: row.tier === "free" ? monthlyLimit : undefined,
    });
  } catch (err) {
    console.error("Get subscription error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/subscription/activate — activate a subscription via token
// Query params: ?tier=student&token=... (for student plan)
//               ?tier=pay_per_paper&papers=5&token=... (for pay-per-paper)
router.get("/activate", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tier, token, papers } = req.query;

    if (!tier || !token || typeof tier !== "string" || typeof token !== "string") {
      return res.status(400).json({ error: "tier and token query parameters are required" });
    }

    if (tier !== "student" && tier !== "pay_per_paper") {
      return res.status(400).json({ error: "Invalid tier. Must be 'student' or 'pay_per_paper'." });
    }

    // Verify activation token exists and hasn't been used
    const activationRow = db
      .query("SELECT * FROM activation_tokens WHERE token = ?")
      .get(token) as {
      id: number;
      token: string;
      tier: string;
      papers: number | null;
      duration_days: number | null;
      used_by: number | null;
    } | null;

    if (!activationRow) {
      return res.status(400).json({ error: "Invalid activation token." });
    }

    if (activationRow.used_by !== null) {
      return res.status(400).json({ error: "This activation token has already been used." });
    }

    if (activationRow.tier !== tier) {
      return res.status(400).json({
        error: `This token is for tier '${activationRow.tier}', not '${tier}'.`,
      });
    }

    // Apply the subscription
    if (tier === "student") {
      const durationDays = activationRow.duration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      const expiresAtStr = expiresAt.toISOString().replace("T", " ").slice(0, 19);

      db.run(
        "UPDATE users SET tier = ?, subscription_expires_at = ?, papers_remaining = NULL WHERE id = ?",
        ["student", expiresAtStr, userId]
      );
    } else if (tier === "pay_per_paper") {
      const numPapers =
        papers && typeof papers === "string"
          ? parseInt(papers, 10)
          : activationRow.papers || 5;

      if (isNaN(numPapers) || numPapers < 1) {
        return res.status(400).json({ error: "Invalid papers count." });
      }

      // Add papers to existing remaining (or set if first time)
      const userRow = db
        .query("SELECT papers_remaining FROM users WHERE id = ?")
        .get(userId) as { papers_remaining: number | null } | null;

      const newRemaining = (userRow?.papers_remaining ?? 0) + numPapers;

      db.run(
        "UPDATE users SET tier = ?, papers_remaining = ?, subscription_expires_at = NULL WHERE id = ?",
        ["pay_per_paper", newRemaining, userId]
      );
    }

    // Mark token as used
    db.run("UPDATE activation_tokens SET used_by = ? WHERE id = ?", [userId, activationRow.id]);

    // Refresh and return updated user data
    const updated = db
      .query(
        "SELECT tier, papers_remaining, subscription_expires_at FROM users WHERE id = ?"
      )
      .get(userId) as {
      tier: string;
      papers_remaining: number | null;
      subscription_expires_at: string | null;
    };

    return res.json({
      success: true,
      tier: updated.tier,
      papersRemaining: updated.papers_remaining,
      subscriptionExpiresAt: updated.subscription_expires_at,
    });
  } catch (err) {
    console.error("Activate subscription error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/subscription/generate-token — generate an activation token (admin/dev use)
// Protected but for dev: allows creating tokens for testing
router.post("/generate-token", requireAuth, (req: Request, res: Response) => {
      try {
        // Accept params from both body (JSON) and query string for dev convenience
        const tier = req.body?.tier || req.query.tier;
        const papers = req.body?.papers || req.query.papers;
        const durationDays = req.body?.durationDays || req.query.durationDays;

        if (!tier || (tier !== "student" && tier !== "pay_per_paper")) {
          return res.status(400).json({ error: "tier must be 'student' or 'pay_per_paper'" });
        }

        const token = crypto.randomBytes(16).toString("hex");

        const numPapers = tier === "pay_per_paper" ? (Number(papers) || 5) : null;
        const numDays = tier === "student" ? (Number(durationDays) || 30) : null;

        db.run(
          "INSERT INTO activation_tokens (token, tier, papers, duration_days) VALUES (?, ?, ?, ?)",
          [token, tier, numPapers, numDays]
        );

    return res.status(201).json({
      token,
      tier,
      papers: numPapers,
      durationDays: numDays,
      activateUrl: `/activate?tier=${tier}&token=${token}${numPapers ? `&papers=${numPapers}` : ""}`,
    });
  } catch (err) {
    console.error("Generate token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
