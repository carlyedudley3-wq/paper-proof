import { Router, Request, Response } from "express";
import { requireAuth } from "./auth";
import db from "./db";

const router = Router();

// --- Types ---
interface AIProofreadSuggestion {
  original: string;
  suggestion: string;
  type: "grammar" | "spelling" | "style" | "clarity";
  explanation: string;
}

interface ParagraphResult {
  paragraphIndex: number;
  suggestions: Array<AIProofreadSuggestion & { startIndex: number; endIndex: number }>;
}

// --- Config ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
const TEMPERATURE = 0.2;

const SYSTEM_PROMPT = `You are a writing tutor for students. Review the following text for grammar errors, spelling mistakes, awkward phrasing, and style improvements. Return ONLY a JSON object with a "suggestions" array — each entry must have:
- "original": the exact text that needs fixing (match character-for-character)
- "suggestion": the corrected text
- "type": one of "grammar", "spelling", "style", or "clarity"
- "explanation": brief reason for the change

Only include suggestions where there is an actual issue. If the text is perfectly fine, return { "suggestions": [] }.`;

// --- Helpers ---

/**
 * Split text into paragraphs (by double newline), preserving single newlines.
 */
function splitParagraphs(text: string): string[] {
  const raw = text.split(/\n\s*\n/);
  return raw.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Find start and end index of `search` within `haystack`, case-insensitive but with
 * a fallback: first try exact match, then case-insensitive.
 */
function findTextPosition(haystack: string, search: string): { start: number; end: number } | null {
  const idx = haystack.indexOf(search);
  if (idx !== -1) return { start: idx, end: idx + search.length };

  // Try case-insensitive
  const lowerHaystack = haystack.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const ciIdx = lowerHaystack.indexOf(lowerSearch);
  if (ciIdx !== -1) return { start: ciIdx, end: ciIdx + search.length };

  return null;
}

/**
 * Call the AI API with a single paragraph.
 */
async function proofreadParagraph(paragraph: string): Promise<AIProofreadSuggestion[]> {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: paragraph },
      ],
      temperature: TEMPERATURE,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";

  // Try to parse JSON from the response
  let parsed: { suggestions?: AIProofreadSuggestion[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Some models might wrap JSON in markdown code fences
    const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }
  }

  if (!Array.isArray(parsed.suggestions)) {
    return [];
  }

  // Validate and filter suggestions
  const validTypes = new Set(["grammar", "spelling", "style", "clarity"]);
  return parsed.suggestions.filter(
    (s): s is AIProofreadSuggestion =>
      typeof s.original === "string" &&
      s.original.length > 0 &&
      typeof s.suggestion === "string" &&
      typeof s.explanation === "string" &&
      validTypes.has(s.type)
  );
}

// --- Route ---

// POST /api/essays/:id/proofread
router.post("/:id/proofread", requireAuth, async (req: Request, res: Response) => {
  try {
    // Check AI key is configured
    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI proofreading not configured. Set OPENAI_API_KEY.",
      });
    }

    const userId = req.user!.id;
    const essayId = parseInt(req.params.id, 10);

    if (isNaN(essayId)) {
      return res.status(400).json({ error: "Invalid essay ID" });
    }

    // Fetch essay with ownership check
    interface EssayRow {
      id: number;
      user_id: number;
      content: string;
    }
    const essay = db
      .query("SELECT id, user_id, content FROM essays WHERE id = ? AND user_id = ?")
      .get(essayId, userId) as EssayRow | null;

    if (!essay) {
      return res.status(404).json({ error: "Essay not found" });
    }

    // Split into paragraphs
    const paragraphs = splitParagraphs(essay.content);

    if (paragraphs.length === 0) {
      return res.json({ results: [], paragraphs: [] });
    }

    // Process each paragraph (sequential to avoid rate limiting)
    const results: ParagraphResult[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      try {
        const suggestions = await proofreadParagraph(paragraph);

        // Attach position info within the paragraph
        const positioned = suggestions
          .map((s) => {
            const pos = findTextPosition(paragraph, s.original);
            return pos
              ? { ...s, startIndex: pos.start, endIndex: pos.end }
              : { ...s, startIndex: -1, endIndex: -1 };
          })
          .filter((s) => s.startIndex >= 0);

        if (positioned.length > 0) {
          results.push({ paragraphIndex: i, suggestions: positioned });
        }
      } catch (err: any) {
        console.error(`Error proofreading paragraph ${i}:`, err.message);
        // Continue with other paragraphs; include error note
        results.push({
          paragraphIndex: i,
          suggestions: [
            {
              original: "",
              suggestion: "",
              type: "style",
              explanation: `Proofreading failed for this paragraph: ${err.message}`,
              startIndex: 0,
              endIndex: 0,
            },
          ],
        });
      }
    }

    // Store results in DB
    const resultJson = JSON.stringify(results);
    db.run(
      "UPDATE essays SET proofread_result = ?, updated_at = datetime('now') WHERE id = ?",
      [resultJson, essayId]
    );

    return res.json({ results, paragraphs });
  } catch (err: any) {
    console.error("Proofread error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/essays/:id/proofread — retrieve cached proofread results
router.get("/:id/proofread", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const essayId = parseInt(req.params.id, 10);

    if (isNaN(essayId)) {
      return res.status(400).json({ error: "Invalid essay ID" });
    }

    interface EssayRow {
      proofread_result: string | null;
    }
    const essay = db
      .query("SELECT proofread_result FROM essays WHERE id = ? AND user_id = ?")
      .get(essayId, userId) as EssayRow | null;

    if (!essay) {
      return res.status(404).json({ error: "Essay not found" });
    }

    if (!essay.proofread_result) {
      return res.json({ results: null, paragraphs: [] });
    }

    const results = JSON.parse(essay.proofread_result);
    return res.json({ results, paragraphs: [] });
  } catch (err: any) {
    console.error("Get proofread error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
