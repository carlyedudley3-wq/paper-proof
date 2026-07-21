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
  created_at: string;
  updated_at: string;
}

export default function EssayDetail() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [essay, setEssay] = useState<Essay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [token, id]);

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

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <Link to="/dashboard" className="nav-link">
          ← Back to Dashboard
        </Link>
        <div className="essay-detail-actions">
          <button
            className="btn-secondary btn-sm"
            disabled
            title="Coming soon"
          >
            ✨ Proofread
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            🗑 Delete
          </button>
        </div>
      </div>

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
          </div>
        </div>

        <div className="essay-content">
          {essay.content}
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
