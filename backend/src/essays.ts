import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth";
import db from "./db";

const router = Router();

// --- Types ---
export interface Essay {
  id: number;
  user_id: number;
  title: string;
  content: string;
  word_count: number;
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
}

interface EssayRow {
  id: number;
  user_id: number;
  title: string;
  content: string;
  word_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// --- Helpers ---
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function rowToEssay(row: EssayRow): Essay {
  return {
    ...row,
    status: row.status as "draft" | "submitted",
  };
}

// --- Free tier middleware ---
// All users are on free tier for now. Limit: 3 essays per calendar month.
const FREE_TIER_MONTHLY_LIMIT = 3;

export function checkFreeTier(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;

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

  if (row.count >= FREE_TIER_MONTHLY_LIMIT) {
    return res.status(403).json({
      error: "Free tier limit reached (3 papers/month). Upgrade to continue.",
    });
  }

  next();
}

// --- Routes ---

// POST /api/essays — create a new essay
router.post("/", requireAuth, checkFreeTier, (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Essay content is required" });
    }

    const trimmedTitle = (typeof title === "string" ? title.trim() : "") || "Untitled Essay";
    const wordCount = countWords(content);
    const userId = req.user!.id;

    const result = db.run(
      `INSERT INTO essays (user_id, title, content, word_count, status)
       VALUES (?, ?, ?, ?, 'draft')`,
      [userId, trimmedTitle, content, wordCount]
    );

    const essay = db
      .query("SELECT * FROM essays WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as EssayRow;

    return res.status(201).json({ essay: rowToEssay(essay) });
  } catch (err) {
    console.error("Create essay error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/essays — list all essays for the authenticated user
router.get("/", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const essays = db
      .query(
        `SELECT id, title, word_count, status, created_at, updated_at
         FROM essays
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as Array<{
      id: number;
      title: string;
      word_count: number;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    return res.json({
      essays: essays.map((e) => ({
        ...e,
        status: e.status as "draft" | "submitted",
      })),
    });
  } catch (err) {
    console.error("List essays error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/essays/:id — get a single essay with full content
router.get("/:id", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const essayId = parseInt(req.params.id, 10);

    if (isNaN(essayId)) {
      return res.status(400).json({ error: "Invalid essay ID" });
    }

    const essay = db
      .query("SELECT * FROM essays WHERE id = ? AND user_id = ?")
      .get(essayId, userId) as EssayRow | null;

    if (!essay) {
      return res.status(404).json({ error: "Essay not found" });
    }

    return res.json({ essay: rowToEssay(essay) });
  } catch (err) {
    console.error("Get essay error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/essays/:id — update title and/or content
router.put("/:id", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const essayId = parseInt(req.params.id, 10);

    if (isNaN(essayId)) {
      return res.status(400).json({ error: "Invalid essay ID" });
    }

    const existing = db
      .query("SELECT * FROM essays WHERE id = ? AND user_id = ?")
      .get(essayId, userId) as EssayRow | null;

    if (!existing) {
      return res.status(404).json({ error: "Essay not found" });
    }

    const { title, content } = req.body;
    let newTitle = existing.title;
    let newContent = existing.content;
    let newWordCount = existing.word_count;

    if (typeof title === "string" && title.trim().length > 0) {
      newTitle = title.trim();
    }

    if (typeof content === "string" && content.trim().length > 0) {
      newContent = content;
      newWordCount = countWords(content);
    }

    db.run(
      `UPDATE essays
       SET title = ?, content = ?, word_count = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [newTitle, newContent, newWordCount, essayId, userId]
    );

    const updated = db
      .query("SELECT * FROM essays WHERE id = ?")
      .get(essayId) as EssayRow;

    return res.json({ essay: rowToEssay(updated) });
  } catch (err) {
    console.error("Update essay error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/essays/:id — delete an essay
router.delete("/:id", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const essayId = parseInt(req.params.id, 10);

    if (isNaN(essayId)) {
      return res.status(400).json({ error: "Invalid essay ID" });
    }

    const existing = db
      .query("SELECT id FROM essays WHERE id = ? AND user_id = ?")
      .get(essayId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Essay not found" });
    }

    db.run("DELETE FROM essays WHERE id = ? AND user_id = ?", [essayId, userId]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete essay error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
