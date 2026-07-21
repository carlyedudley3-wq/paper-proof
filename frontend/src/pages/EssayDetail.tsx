import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface Essay {
  id: number;
  user_id: number;
  title: string;
  content: string;
  word_count: number;
  status: "draft" | "submitted";
  proofread_result: string | null;
  plagiarism_result: string | null;
  created_at: string;
  updated_at: string;
}

interface ProofreadSuggestion {
  original: string;
  suggestion: string;
  type: "grammar" | "spelling" | "style" | "clarity";
  explanation: string;
  startIndex: number;
  endIndex: number;
}

interface ParagraphResult {
  paragraphIndex: number;
  suggestions: ProofreadSuggestion[];
}

interface PlagiarismMatch {
  url: string;
  title: string;
  snippet: string;
  similarity: number;
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
  demo?: boolean;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  grammar: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  spelling: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  style: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  clarity: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
};

function getPlagiarismColor(score: number): { bg: string; text: string; ring: string } {
  if (score < 20) return { bg: "#f0fdf4", text: "#16a34a", ring: "#16a34a" };
  if (score < 40) return { bg: "#fefce8", text: "#ca8a04", ring: "#ca8a04" };
  if (score < 60) return { bg: "#fff7ed", text: "#ea580c", ring: "#ea580c" };
  return { bg: "#fef2f2", text: "#dc2626", ring: "#dc2626" };
}

export default function EssayDetail() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [essay, setEssay] = useState<Essay | null>(null);
  const [proofread, setProofread] = useState<ParagraphResult[] | null>(null);
  const [plagiarism, setPlagiarism] = useState<PlagiarismResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isPlagiarismChecking, setIsPlagiarismChecking] = useState(false);
  const [proofreadError, setProofreadError] = useState("");
  const [plagiarismError, setPlagiarismError] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token || !id) return;

    fetch(`/api/essays/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Essay not found");
        return res.json();
      })
      .then((data) => {
        setEssay(data.essay);
        setProofread(data.proofread);
        setPlagiarism(data.plagiarism);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [token, id]);

  async function handleProofread() {
    if (!token || !id) return;

    setIsProofreading(true);
    setProofreadError("");

    try {
      const res = await fetch(`/api/essays/${id}/proofread`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Proofreading failed");
      }

      setProofread(data.results);
    } catch (err: any) {
      setProofreadError(err.message);
    } finally {
      setIsProofreading(false);
    }
  }

  async function handlePlagiarismCheck() {
    if (!token || !id) return;

    setIsPlagiarismChecking(true);
    setPlagiarismError("");

    try {
      // Try the real endpoint first; if it returns 503 (not configured), fall back to demo
      let res = await fetch(`/api/essays/${id}/plagiarism`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 503) {
        // Fall back to demo mode
        res = await fetch(`/api/essays/${id}/plagiarism/demo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Plagiarism check failed");
      }

      setPlagiarism(data);
    } catch (err: any) {
      setPlagiarismError(err.message);
    } finally {
      setIsPlagiarismChecking(false);
    }
  }

  function handleApplySuggestion(suggestionKey: string) {
    setAppliedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(suggestionKey);
      return next;
    });
  }

  async function handleDelete() {
    if (!token || !id) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/essays/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Build paragraph-indexed suggestion map
  const suggestionsByParagraph = new Map<number, ProofreadSuggestion[]>();
  if (proofread) {
    for (const pr of proofread) {
      suggestionsByParagraph.set(pr.paragraphIndex, pr.suggestions);
    }
  }

  // Split content into paragraphs for rendering
  function renderContentWithHighlights() {
    if (!essay) return null;

    const paragraphs = essay.content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    return paragraphs.map((paragraph, pIdx) => {
      const suggestions = suggestionsByParagraph.get(pIdx) || [];

      if (suggestions.length === 0) {
        return (
          <p key={pIdx} className="essay-paragraph">
            {paragraph}
          </p>
        );
      }

      // Build highlighted text with spans
      const elements: React.ReactNode[] = [];
      let lastIdx = 0;

      // Sort suggestions by startIndex
      const sorted = [...suggestions].sort((a, b) => a.startIndex - b.startIndex);

      for (const s of sorted) {
        // Skip invalid positions
        if (s.startIndex < 0 || s.startIndex < lastIdx) continue;

        // Add text before this suggestion
        if (s.startIndex > lastIdx) {
          elements.push(
            <span key={`t-${pIdx}-${lastIdx}`}>{paragraph.slice(lastIdx, s.startIndex)}</span>
          );
        }

        const colors = TYPE_COLORS[s.type] || TYPE_COLORS.style;
        const sugKey = `${pIdx}-${s.startIndex}-${s.original}`;
        const isApplied = appliedSuggestions.has(sugKey);

        elements.push(
          <span
            key={`h-${pIdx}-${s.startIndex}`}
            className={`proofread-highlight ${isApplied ? "proofread-applied" : ""}`}
            style={{
              backgroundColor: colors.bg,
              borderBottom: `2px solid ${colors.border}`,
              cursor: "pointer",
              borderRadius: "2px",
              position: "relative",
            }}
            title={`${s.type}: ${s.explanation}`}
          >
            {paragraph.slice(s.startIndex, s.endIndex)}
          </span>
        );

        lastIdx = s.endIndex;
      }

      // Add remaining text
      if (lastIdx < paragraph.length) {
        elements.push(
          <span key={`t-${pIdx}-end`}>{paragraph.slice(lastIdx)}</span>
        );
      }

      return (
        <div key={pIdx} className="essay-paragraph-block">
          <p className="essay-paragraph">{elements}</p>
          <div className="proofread-suggestions">
            {sorted.map((s, sIdx) => {
              const sugKey = `${pIdx}-${s.startIndex}-${s.original}`;
              const isApplied = appliedSuggestions.has(sugKey);
              const colors = TYPE_COLORS[s.type] || TYPE_COLORS.style;

              return (
                <div
                  key={sIdx}
                  className={`proofread-suggestion ${isApplied ? "suggestion-applied" : ""}`}
                  style={{ borderLeftColor: colors.text }}
                >
                  <div className="suggestion-header">
                    <span
                      className="suggestion-type-badge"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {s.type}
                    </span>
                    <span className="suggestion-original">
                      &ldquo;{s.original}&rdquo;
                    </span>
                    <span className="suggestion-arrow">→</span>
                    <span className="suggestion-corrected">
                      &ldquo;{s.suggestion}&rdquo;
                    </span>
                  </div>
                  <p className="suggestion-explanation">{s.explanation}</p>
                  <button
                    className={`btn-apply ${isApplied ? "btn-applied" : ""}`}
                    onClick={() => handleApplySuggestion(sugKey)}
                    disabled={isApplied}
                  >
                    {isApplied ? "✓ Applied" : "Apply"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p>Loading essay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#dc2626" }}>{error}</p>
          <Link to="/dashboard" className="nav-link" style={{ marginTop: "1rem", display: "inline-block" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!essay) return null;

  const totalSuggestions = proofread
    ? proofread.reduce((sum, pr) => sum + pr.suggestions.length, 0)
    : 0;

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <Link to="/dashboard" className="nav-link">
          ← Back to Dashboard
        </Link>
        <div className="essay-detail-actions">
          <button
            className={`btn-secondary btn-sm ${isProofreading ? "btn-loading" : ""}`}
            onClick={handleProofread}
            disabled={isProofreading}
          >
            {isProofreading ? (
              <span className="proofread-spinner">⏳ Proofreading...</span>
            ) : (
              "✨ Proofread"
            )}
          </button>
          <button
            className={`btn-secondary btn-sm ${isPlagiarismChecking ? "btn-loading" : ""}`}
            onClick={handlePlagiarismCheck}
            disabled={isPlagiarismChecking}
          >
            {isPlagiarismChecking ? (
              <span className="proofread-spinner">🔍 Scanning...</span>
            ) : (
              "🔍 Check Plagiarism"
            )}
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {proofreadError && (
        <div className="auth-error" style={{ marginBottom: "1rem" }}>
          {proofreadError}
        </div>
      )}

      {plagiarismError && (
        <div className="auth-error" style={{ marginBottom: "1rem" }}>
          {plagiarismError}
        </div>
      )}

      {isPlagiarismChecking && (
        <div className="proofread-loading-banner">
          <span className="proofread-spinner-large">🔍</span>
          <span>Scanning your essay for plagiarism... This may take a moment.</span>
        </div>
      )}

      <div className="essay-detail">
        <div className="essay-detail-header">
          <h2 className="essay-detail-title">{essay.title}</h2>
          <div className="essay-detail-meta">
            <span>{essay.word_count.toLocaleString()} words</span>
            <span className="essay-meta-sep">·</span>
            <span>Created {formatDate(essay.created_at)}</span>
            {essay.updated_at !== essay.created_at && (
              <>
                <span className="essay-meta-sep">·</span>
                <span>Updated {formatDate(essay.updated_at)}</span>
              </>
            )}
            <span className="essay-meta-sep">·</span>
            <span className={`essay-status essay-status-${essay.status}`}>
              {essay.status}
            </span>
            {totalSuggestions > 0 && (
              <>
                <span className="essay-meta-sep">·</span>
                <span style={{ color: "#2563eb", fontWeight: 600 }}>
                  {totalSuggestions} suggestion{totalSuggestions !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {isProofreading && (
          <div className="proofread-loading-banner">
            <span className="proofread-spinner-large">⏳</span>
            <span>AI is reviewing your essay... This may take a moment.</span>
          </div>
        )}

        <div className="essay-content">
          {renderContentWithHighlights()}
        </div>

        {/* --- Plagiarism Results Section --- */}
        {plagiarism && (
          <div className="plagiarism-results">
            <div className="plagiarism-score-section">
              {(() => {
                const colors = getPlagiarismColor(plagiarism.overallScore);
                return (
                  <div
                    className="plagiarism-score-circle"
                    style={{
                      borderColor: colors.ring,
                      background: `conic-gradient(${colors.ring} ${plagiarism.overallScore * 3.6}deg, #f1f5f9 ${plagiarism.overallScore * 3.6}deg)`,
                    }}
                  >
                    <div className="plagiarism-score-inner">
                      <span className="plagiarism-score-number" style={{ color: colors.text }}>
                        {plagiarism.overallScore}
                      </span>
                      <span className="plagiarism-score-label">% similar</span>
                    </div>
                  </div>
                );
              })()}
              <div className="plagiarism-score-details">
                <h3 className="plagiarism-score-title">
                  {plagiarism.overallScore < 20
                    ? "✅ Looks Original"
                    : plagiarism.overallScore < 40
                    ? "⚠️ Some Similarities Found"
                    : plagiarism.overallScore < 60
                    ? "🟠 Notable Matches"
                    : "🔴 High Similarity Detected"}
                </h3>
                <p className="plagiarism-score-meta">
                  {plagiarism.results.length} of {plagiarism.phrasesChecked} phrases matched
                  {plagiarism.demo && " (demo mode)"}
                </p>
                <p className="plagiarism-score-meta" style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Scanned {new Date(plagiarism.scannedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {plagiarism.results.length > 0 && (
              <div className="plagiarism-matches">
                <h4 className="plagiarism-matches-title">Matched Phrases & Sources</h4>
                {plagiarism.results.map((phraseResult, idx) => (
                  <div key={idx} className="plagiarism-match-card">
                    <div className="plagiarism-match-phrase">
                      <span className="plagiarism-match-quote">❝</span>
                      {phraseResult.phrase}
                      <span className="plagiarism-match-quote">❞</span>
                    </div>
                    {phraseResult.matches.map((match, mIdx) => (
                      <div key={mIdx} className="plagiarism-match-source">
                        <div className="plagiarism-match-source-header">
                          <span
                            className="plagiarism-similarity-badge"
                            style={{
                              backgroundColor: getPlagiarismColor(match.similarity).bg,
                              color: getPlagiarismColor(match.similarity).text,
                            }}
                          >
                            {match.similarity}%
                          </span>
                          <a
                            href={match.url === "#" ? undefined : match.url}
                            target={match.url === "#" ? undefined : "_blank"}
                            rel="noopener noreferrer"
                            className="plagiarism-match-url"
                            onClick={(e) => {
                              if (match.url === "#") e.preventDefault();
                            }}
                          >
                            {match.title}
                          </a>
                        </div>
                        <p className="plagiarism-match-snippet">
                          {match.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {plagiarism.results.length === 0 && (
              <div className="plagiarism-no-matches">
                <p>🎉 No matching sources found. Your essay appears to be original!</p>
              </div>
            )}
          </div>
        )}

        {!plagiarism && !isPlagiarismChecking && (
          <div className="plagiarism-prompt">
            <p>💡 Not sure if your essay contains unoriginal content? Run a plagiarism check to be safe.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Essay?</h3>
            <p>
              Are you sure you want to delete <strong>"{essay.title}"</strong>?
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
