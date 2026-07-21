import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface EssaySummary {
  id: number;
  title: string;
  word_count: number;
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const { token } = useAuth();
  const [essays, setEssays] = useState<EssaySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    fetch("/api/essays", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load essays");
        return res.json();
      })
      .then((data) => {
        setEssays(data.essays);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [token]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p>Loading your essays...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#dc2626" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">My Essays</h2>
          <p className="dashboard-subtitle">
            {essays.length} paper{essays.length !== 1 ? "s" : ""} this month
          </p>
        </div>
        <Link to="/essays/new" className="btn-primary">
          + New Essay
        </Link>
      </div>

      {essays.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No essays yet</h3>
          <p>
            You haven't submitted any essays yet. Upload your first paper to get
            started!
          </p>
          <Link to="/essays/new" className="btn-primary" style={{ marginTop: "1rem" }}>
            Write Your First Essay
          </Link>
        </div>
      ) : (
        <div className="essay-list">
          {essays.map((essay) => (
            <Link
              to={`/essays/${essay.id}`}
              key={essay.id}
              className="essay-card"
            >
              <div className="essay-card-main">
                <h3 className="essay-card-title">{essay.title}</h3>
                <div className="essay-card-meta">
                  <span className="essay-meta-item">
                    {essay.word_count.toLocaleString()} words
                  </span>
                  <span className="essay-meta-sep">·</span>
                  <span className="essay-meta-item">
                    {formatDate(essay.created_at)}
                  </span>
                  <span className="essay-meta-sep">·</span>
                  <span
                    className={`essay-status essay-status-${essay.status}`}
                  >
                    {essay.status}
                  </span>
                </div>
              </div>
              <div className="essay-card-arrow">→</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
