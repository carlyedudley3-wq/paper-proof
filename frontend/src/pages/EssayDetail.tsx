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

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  grammar: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  spelling: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  style: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  clarity: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
};

export default function EssayDetail() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [essay, setEssay] = useState<Essay | null>(null);
  const [proofread, setProofread] = useState<ParagraphResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProofreading, setIsProofreading] = useState(false);
  const [proofreadError, setProofreadError] = useState("");
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
