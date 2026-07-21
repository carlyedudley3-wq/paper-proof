import { Router, Request, Response } from "express";
import { requireAuth } from "./auth";
import db from "./db";

const router = Router();

// --- Config ---
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || "";
// Use a configurable search endpoint — supports SerpAPI, Google CSE, or similar
const SEARCH_API_URL =
  process.env.SEARCH_API_URL || "https://serpapi.com/search";

// --- Types ---
interface PlagiarismMatch {
  url: string;
  title: string;
  snippet: string;
  similarity: number; // 0-100
}

interface PlagiarismPhraseResult {
  phrase: string;
  matches: PlagiarismMatch[];
}

interface PlagiarismResult {
  results: PlagiarismPhraseResult[];
  overallScore: number;
  scannedAt: string;
  phrasesChecked: number;
}

// --- Simulated demo corpus (common academic phrases) ---
const DEMO_CORPUS: { phrase: string; sources: PlagiarismMatch[] }[] = [
  {
    phrase: "climate change is one of the most pressing issues of our time",
    sources: [
      {
        url: "https://www.un.org/en/climatechange",
        title: "United Nations Climate Action",
        snippet:
          "Climate change is one of the most pressing issues of our time, affecting every country on every continent.",
        similarity: 92,
      },
      {
        url: "https://www.ipcc.ch/reports/",
        title: "IPCC — Intergovernmental Panel on Climate Change",
        snippet:
          "The IPCC finds that climate change is one of the most pressing challenges facing humanity.",
        similarity: 78,
      },
    ],
  },
  {
    phrase: "according to recent studies the impact of social media on mental health",
    sources: [
      {
        url: "https://www.apa.org/monitor/social-media",
        title: "Social Media and Mental Health — APA",
        snippet:
          "According to recent studies, the impact of social media on mental health is significant, especially among adolescents.",
        similarity: 88,
      },
    ],
  },
  {
    phrase: "the industrial revolution marked a turning point in history",
    sources: [
      {
        url: "https://www.history.com/topics/industrial-revolution",
        title: "Industrial Revolution — History.com",
        snippet:
          "The Industrial Revolution marked a turning point in history, transforming almost every aspect of daily life.",
        similarity: 95,
      },
    ],
  },
  {
    phrase: "artificial intelligence has the potential to transform industries",
    sources: [
      {
        url: "https://www.mckinsey.com/featured-insights/artificial-intelligence",
        title: "AI and the Future of Work — McKinsey",
        snippet:
          "Artificial intelligence has the potential to transform industries and reshape the workforce.",
        similarity: 90,
      },
    ],
  },
  {
    phrase: "democracy requires active participation from citizens",
    sources: [
      {
        url: "https://www.britannica.com/topic/democracy",
        title: "Democracy — Britannica",
        snippet:
          "Democracy requires the active participation of citizens in political life and decision-making processes.",
        similarity: 76,
      },
    ],
  },
];

// --- Helpers ---

/**
 * Split text into sentences. Handles multiple punctuation marks.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract meaningful phrases from text:
 * - Sentences with 5+ words
 * - Additional 5-word n-grams
 */
function extractPhrases(text: string): string[] {
  const sentences = splitSentences(text);

  // Get sentences with 5+ words
  const sentencePhrases = sentences
    .filter((s) => s.split(/\s+/).length >= 5)
    .map((s) => s.trim());

  // Get 5-word n-grams from sentences
  const ngrams: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    if (words.length < 5) continue;
    for (let i = 0; i <= words.length - 5; i++) {
      ngrams.push(words.slice(i, i + 5).join(" "));
    }
  }

  // Deduplicate and combine — prioritize longer sentences
  const seen = new Set<string>();
  const allPhrases: string[] = [];

  for (const s of sentencePhrases) {
    const lower = s.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      allPhrases.push(s);
    }
  }

  for (const ng of ngrams) {
    const lower = ng.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      allPhrases.push(ng);
    }
  }

  return allPhrases;
}

/**
 * Score phrases by "richness" — longer phrases with more unique words rank higher.
 * This ensures we pick the most meaningful phrases to check.
 */
function scorePhrase(phrase: string): number {
  const words = phrase.split(/\s+/);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  return words.length * 2 + uniqueWords.size;
}

/**
 * Calculate similarity (0-100) between two text strings.
 * Uses a simple word-overlap Jaccard-like similarity plus substring match bonus.
 */
function calculateSimilarity(textA: string, textB: string): number {
  const a = textA.toLowerCase().replace(/[^\w\s]/g, "");
  const b = textB.toLowerCase().replace(/[^\w\s]/g, "");

  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 1));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const jaccardScore = (intersection / Math.min(wordsA.size, wordsB.size)) * 70;

  // Bonus for substring overlap
  let substringBonus = 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;

  for (let i = 0; i < shorter.length - 4; i++) {
    const chunk = shorter.slice(i, i + 5);
    if (longer.includes(chunk)) {
      substringBonus += 1;
    }
  }
  substringBonus = Math.min(substringBonus * 2, 30);

  return Math.min(100, Math.round(jaccardScore + substringBonus));
}

/**
 * Search for a phrase using the configured search API.
 */
async function searchPhrase(phrase: string): Promise<PlagiarismMatch[]> {
  const query = `"${phrase.slice(0, 150)}"`; // Wrap in quotes for exact match

  const url = new URL(SEARCH_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", SEARCH_API_KEY);
  url.searchParams.set("num", "5");
  url.searchParams.set("engine", "google");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Search API error ${response.status} for phrase: ${phrase.slice(0, 80)}`);
      return [];
    }

    const data = await response.json();

    // Handle SerpAPI format
    const organicResults = data.organic_results || [];
    const matches: PlagiarismMatch[] = [];

    for (const result of organicResults) {
      const snippet = result.snippet || "";
      const similarity = calculateSimilarity(phrase, snippet);

      if (similarity >= 20) {
        // Only include reasonable matches
        matches.push({
          url: result.link || "",
          title: result.title || "Untitled",
          snippet,
          similarity,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`Search timeout for phrase: ${phrase.slice(0, 80)}`);
    } else {
      console.error(`Search error for phrase: ${phrase.slice(0, 80)}:`, err.message);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Demo/simulated plagiarism detection — no API key needed.
 * Uses self-comparison against the essay and demo corpus.
 */
function simulatePlagiarismCheck(
  content: string,
  phrases: string[]
): PlagiarismPhraseResult[] {
  const results: PlagiarismPhraseResult[] = [];

  // 1. Check against built-in corpus
  for (const phrase of phrases) {
    const corpusMatches: PlagiarismMatch[] = [];

    for (const corpusEntry of DEMO_CORPUS) {
      const similarity = calculateSimilarity(phrase, corpusEntry.phrase);
      if (similarity >= 30) {
        corpusMatches.push(
          ...corpusEntry.sources.map((s) => ({
            ...s,
            similarity: Math.min(100, similarity + 5),
          }))
        );
      }
    }

    if (corpusMatches.length > 0) {
      results.push({ phrase, matches: corpusMatches });
    }
  }

  // 2. Self-plagiarism check: split content in half, see if second half borrows from first
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 4) {
    const mid = Math.floor(paragraphs.length / 2);
    const firstHalf = paragraphs.slice(0, mid).join(" ");
    const secondHalfPhrases = extractPhrases(
      paragraphs.slice(mid).join(". ")
    );

    for (const phrase of secondHalfPhrases.slice(0, 5)) {
      const similarity = calculateSimilarity(phrase, firstHalf);
      if (similarity >= 40) {
        results.push({
          phrase,
          matches: [
            {
              url: "#",
              title: "[Self-plagiarism] Similar content found earlier in your essay",
              snippet: "This phrase closely matches content from the first half of your essay.",
              similarity,
            },
          ],
        });
      }
    }
  }

  return results;
}

/**
 * Calculate overall plagiarism score from individual results.
 */
function calculateOverallScore(
  results: PlagiarismPhraseResult[],
  totalPhrasesChecked: number
): number {
  if (results.length === 0 || totalPhrasesChecked === 0) return 0;

  // Weight: more matches with higher similarity = higher score
  const totalSimilaritySum = results.reduce((sum, r) => {
    const maxSim = r.matches.reduce((max, m) => Math.max(max, m.similarity), 0);
    return sum + maxSim;
  }, 0);

  // Normalize: fraction of phrases that had matches, scaled by average similarity
  const matchRatio = results.length / totalPhrasesChecked;
  const avgSimilarity = totalSimilaritySum / results.length;

  return Math.min(100, Math.round(matchRatio * avgSimilarity));
}

// --- Routes ---

// POST /api/essays/:id/plagiarism — scan essay for plagiarism
router.post(
  "/:id/plagiarism",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      // Check if search API key is configured
      if (!SEARCH_API_KEY) {
        return res.status(503).json({
          error: "Plagiarism detection not configured.",
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
        .query(
          "SELECT id, user_id, content FROM essays WHERE id = ? AND user_id = ?"
        )
        .get(essayId, userId) as EssayRow | null;

      if (!essay) {
        return res.status(404).json({ error: "Essay not found" });
      }

      // Extract phrases and pick top 10
      const allPhrases = extractPhrases(essay.content);

      if (allPhrases.length === 0) {
        const result: PlagiarismResult = {
          results: [],
          overallScore: 0,
          scannedAt: new Date().toISOString(),
          phrasesChecked: 0,
        };
        const resultJson = JSON.stringify(result);
        db.run(
          "UPDATE essays SET plagiarism_result = ?, updated_at = datetime('now') WHERE id = ?",
          [resultJson, essayId]
        );
        return res.json(result);
      }

      // Score and pick the best 10
      const sortedPhrases = allPhrases
        .map((p) => ({ phrase: p, score: scorePhrase(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      // Check each phrase (sequential to avoid rate limiting)
      const results: PlagiarismPhraseResult[] = [];

      for (const { phrase } of sortedPhrases) {
        try {
          const matches = await searchPhrase(phrase);
          if (matches.length > 0) {
            results.push({ phrase, matches });
          }
        } catch (err: any) {
          console.error(
            `Error searching phrase "${phrase.slice(0, 80)}":`,
            err.message
          );
          // Continue with other phrases
        }
      }

      const overallScore = calculateOverallScore(
        results,
        sortedPhrases.length
      );

      const result: PlagiarismResult = {
        results,
        overallScore,
        scannedAt: new Date().toISOString(),
        phrasesChecked: sortedPhrases.length,
      };

      // Store in DB
      const resultJson = JSON.stringify(result);
      db.run(
        "UPDATE essays SET plagiarism_result = ?, updated_at = datetime('now') WHERE id = ?",
        [resultJson, essayId]
      );

      return res.json(result);
    } catch (err: any) {
      console.error("Plagiarism scan error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/essays/:id/plagiarism/demo — simulated plagiarism scan (no API key needed)
router.post(
  "/:id/plagiarism/demo",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const essayId = parseInt(req.params.id, 10);

      if (isNaN(essayId)) {
        return res.status(400).json({ error: "Invalid essay ID" });
      }

      interface EssayRow {
        id: number;
        user_id: number;
        content: string;
      }
      const essay = db
        .query(
          "SELECT id, user_id, content FROM essays WHERE id = ? AND user_id = ?"
        )
        .get(essayId, userId) as EssayRow | null;

      if (!essay) {
        return res.status(404).json({ error: "Essay not found" });
      }

      // Extract phrases and pick top 10
      const allPhrases = extractPhrases(essay.content);
      const sortedPhrases = allPhrases
        .map((p) => ({ phrase: p, score: scorePhrase(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      const phrasesToCheck = sortedPhrases.map((p) => p.phrase);

      // Simulate a brief processing delay for UX
      await new Promise((r) => setTimeout(r, 1200));

      // Run simulated check
      const results = simulatePlagiarismCheck(essay.content, phrasesToCheck);

      const overallScore = calculateOverallScore(
        results,
        phrasesToCheck.length
      );

      const result: PlagiarismResult = {
        results,
        overallScore,
        scannedAt: new Date().toISOString(),
        phrasesChecked: phrasesToCheck.length,
      };

      // Store in DB
      const resultJson = JSON.stringify(result);
      db.run(
        "UPDATE essays SET plagiarism_result = ?, updated_at = datetime('now') WHERE id = ?",
        [resultJson, essayId]
      );

      return res.json({ ...result, demo: true });
    } catch (err: any) {
      console.error("Demo plagiarism scan error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/essays/:id/plagiarism — retrieve cached plagiarism results
router.get(
  "/:id/plagiarism",
  requireAuth,
  (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const essayId = parseInt(req.params.id, 10);

      if (isNaN(essayId)) {
        return res.status(400).json({ error: "Invalid essay ID" });
      }

      interface EssayRow {
        plagiarism_result: string | null;
      }
      const essay = db
        .query(
          "SELECT plagiarism_result FROM essays WHERE id = ? AND user_id = ?"
        )
        .get(essayId, userId) as EssayRow | null;

      if (!essay) {
        return res.status(404).json({ error: "Essay not found" });
      }

      if (!essay.plagiarism_result) {
        return res.json(null);
      }

      return res.json(JSON.parse(essay.plagiarism_result));
    } catch (err: any) {
      console.error("Get plagiarism error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
