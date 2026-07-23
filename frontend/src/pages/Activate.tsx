import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Activate() {
  const { token, user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Activating your subscription...");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const tier = searchParams.get("tier");
    const activationToken = searchParams.get("token");
    const papers = searchParams.get("papers");

    if (!tier || !activationToken) {
      setStatus("error");
      setMessage("Missing activation parameters. Please check your link and try again.");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("You must be logged in to activate a subscription.");
      return;
    }

    let url = `/api/subscription/activate?tier=${encodeURIComponent(tier)}&token=${encodeURIComponent(activationToken)}`;
    if (papers) {
      url += `&papers=${encodeURIComponent(papers)}`;
    }

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setResult(data);
          setMessage(
            data.tier === "student"
              ? `Your Student Plan is now active until ${new Date(data.subscriptionExpiresAt).toLocaleDateString()}!`
              : `You now have ${data.papersRemaining} paper${data.papersRemaining !== 1 ? "s" : ""} remaining.`
          );
          await refreshUser();
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Failed to activate subscription. Please try again.");
      });
  }, [searchParams, token]);

  return (
    <main className="auth-page">
      <div className="auth-card" style={{ textAlign: "center", maxWidth: "480px" }}>
        {status === "loading" && (
          <>
            <div className="activate-spinner">⏳</div>
            <h2 style={{ marginTop: "1rem" }}>Activating...</h2>
            <p style={{ color: "#64748b" }}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="activate-success">✅</div>
            <h2 style={{ marginTop: "1rem", color: "#16a34a" }}>Subscription Activated!</h2>
            <p style={{ color: "#64748b", marginTop: "0.5rem" }}>{message}</p>
            {result && (
              <div style={{ margin: "1.5rem 0", padding: "1rem", backgroundColor: "#f0fdf4", borderRadius: "8px", textAlign: "left" }}>
                <p><strong>Plan:</strong> {result.tier === "student" ? "Student Plan" : "Pay-Per-Paper"}</p>
                {result.papersRemaining != null && (
                  <p><strong>Papers Remaining:</strong> {result.papersRemaining}</p>
                )}
                {result.subscriptionExpiresAt && (
                  <p><strong>Expires:</strong> {new Date(result.subscriptionExpiresAt).toLocaleDateString()}</p>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
              <Link to="/dashboard" className="btn-primary">
                Go to Dashboard
              </Link>
              <Link to="/essays/new" className="btn-secondary">
                New Essay
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="activate-error">❌</div>
            <h2 style={{ marginTop: "1rem", color: "#dc2626" }}>Activation Failed</h2>
            <p style={{ color: "#64748b", marginTop: "0.5rem" }}>{message}</p>
            <div style={{ marginTop: "1.5rem" }}>
              <Link to="/pricing" className="btn-primary">
                View Plans
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
