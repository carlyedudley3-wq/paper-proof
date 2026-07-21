import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function NewEssay() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  const wordCount = countWords(content);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (content.trim().length === 0) {
      setError("Please enter some essay content.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/essays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim() || undefined, content }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create essay");
        setIsSubmitting(false);
        return;
      }

      navigate(`/essays/${data.essay.id}`);
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (file.name.endsWith(".txt")) {
      const text = await file.text();
      setContent(text);
    } else if (file.name.endsWith(".docx")) {
      setError(
        "DOCX upload is not supported yet. Please paste your content or upload a .txt file."
      );
    } else {
      setError("Unsupported file type. Please upload a .txt file.");
    }

    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">New Essay</h2>
          <p className="dashboard-subtitle">Paste or upload your paper below</p>
        </div>
        <Link to="/dashboard" className="nav-link">
          ← Back to Dashboard
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="essay-form">
        {error && <div className="auth-error">{error}</div>}

        <label className="auth-label">
          Title
          <input
            type="text"
            className="auth-input"
            placeholder="e.g., The Role of Irony in Austen's Persuasion"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="auth-label">
          Essay Content
          <textarea
            className="essay-textarea"
            placeholder="Paste your essay here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
          />
        </label>

        <div className="essay-form-footer">
          <div className="essay-word-count">
            {wordCount.toLocaleString()} word{wordCount !== 1 ? "s" : ""}
          </div>
          <div className="essay-form-actions">
            <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
              📎 Upload .txt
              <input
                type="file"
                accept=".txt,.docx"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Essay"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
