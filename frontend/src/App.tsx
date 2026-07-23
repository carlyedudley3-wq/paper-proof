import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import NewEssay from "./pages/NewEssay";
import EssayDetail from "./pages/EssayDetail";
import Pricing from "./pages/Pricing";
import Activate from "./pages/Activate";
import ProtectedRoute from "./components/ProtectedRoute";

function TierBadge({ tier }: { tier: string }) {
  if (tier === "free") return null;

  const labels: Record<string, { text: string; className: string }> = {
    student: { text: "Student Plan", className: "tier-badge-student" },
    pay_per_paper: { text: "Pay-Per-Paper", className: "tier-badge-ppp" },
  };

  const info = labels[tier];
  if (!info) return null;

  return <span className={`tier-badge ${info.className}`}>{info.text}</span>;
}

function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <h1 className="logo">
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          📝 PaperProof
        </Link>
      </h1>
      <nav className="nav-links">
        {user ? (
          <>
            <Link to="/pricing" className="nav-link">
              Pricing
            </Link>
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <TierBadge tier={user.tier} />
            <span className="nav-user">{user.email}</span>
            <button onClick={logout} className="nav-link nav-btn">
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link to="/pricing" className="nav-link">
              Pricing
            </Link>
            <Link to="/login" className="nav-link">
              Log In
            </Link>
            <Link to="/signup" className="btn-primary btn-sm">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function LandingPage() {
      return (
        <div className="landing">
          <NavBar />
          <main className="landing-main">
            {/* Hero Section */}
            <section className="landing-hero">
              <div className="landing-hero-content">
                <h1 className="landing-hero-title">
                  Polish your essays
                  <br />
                  <span className="landing-hero-accent">before you submit</span>
                </h1>
                <p className="landing-hero-subtitle">
                  AI-powered proofreading and plagiarism detection built for students.
                  Catch what spellcheckers miss — awkward phrasing, citation gaps,
                  and uncited sources.
                </p>
                <div className="landing-hero-actions">
                  <Link to="/signup" className="btn-primary btn-lg">
                    Start Proofreading Free →
                  </Link>
                  <Link to="/pricing" className="btn-secondary btn-lg">
                    View Pricing
                  </Link>
                </div>
                <p className="landing-hero-note">
                  No credit card required. 3 free papers every month.
                </p>
              </div>
              <div className="landing-hero-visual">
                <div className="landing-hero-card">
                  <div className="landing-hero-card-bar">
                    <span className="landing-hero-dot" />
                    <span className="landing-hero-dot" />
                    <span className="landing-hero-dot" />
                  </div>
                  <div className="landing-hero-card-body">
                    <p className="landing-hero-sample-text">
                      <span className="landing-hero-highlight">The affects</span> of
                      climate change <span className="landing-hero-highlight">are</span>{" "}
                      becoming more
                      <span className="landing-hero-highlight"> prominant</span> each year.
                    </p>
                    <div className="landing-hero-correction">
                      <span className="landing-hero-correction-label">Suggestion:</span>
                      <span className="landing-hero-correction-text">
                        "The <strong>effects</strong> of climate change{" "}
                        <strong>have become</strong> more{" "}
                        <strong>prominent</strong> each year."
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Feature Highlights */}
            <section className="landing-features-section">
              <h2 className="landing-section-title">Everything you need to submit with confidence</h2>
              <div className="landing-features-grid">
                <div className="landing-feature-card">
                  <div className="landing-feature-icon">✨</div>
                  <h3>AI Proofreading</h3>
                  <p>
                    Advanced grammar, spelling, style, and clarity suggestions.
                    Beyond spellcheck — we catch awkward phrasing and structural issues.
                  </p>
                </div>
                <div className="landing-feature-card">
                  <div className="landing-feature-icon">🔍</div>
                  <h3>Plagiarism Detection</h3>
                  <p>
                    Scan your essays against web sources. Get similarity scores and
                    source links so you can cite properly before submission.
                  </p>
                </div>
                <div className="landing-feature-card">
                  <div className="landing-feature-icon">💸</div>
                  <h3>Affordable for Students</h3>
                  <p>
                    Start free with 3 papers per month. Student Plan is just $8/month
                    for unlimited papers, style suggestions, and plagiarism scans.
                  </p>
                </div>
              </div>
            </section>

            {/* Pricing Preview */}
            <section className="landing-pricing-section">
              <h2 className="landing-section-title">Simple, student-friendly pricing</h2>
              <div className="landing-pricing-cards">
                <div className="landing-pricing-card">
                  <h3>Free</h3>
                  <div className="landing-pricing-amount">$0</div>
                  <p className="landing-pricing-desc">3 papers/month, basic grammar checks</p>
                </div>
                <div className="landing-pricing-card landing-pricing-card-featured">
                  <span className="landing-pricing-badge">Most Popular</span>
                  <h3>Student Plan</h3>
                  <div className="landing-pricing-amount">$8<span className="landing-pricing-period">/mo</span></div>
                  <p className="landing-pricing-desc">Unlimited papers, style suggestions, plagiarism detection</p>
                </div>
                <div className="landing-pricing-card">
                  <h3>Pay-Per-Paper</h3>
                  <div className="landing-pricing-amount">$3<span className="landing-pricing-period">/paper</span></div>
                  <p className="landing-pricing-desc">Full features for a single paper — no subscription</p>
                </div>
              </div>
              <Link to="/pricing" className="btn-secondary btn-lg" style={{marginTop: "1.5rem", display: "inline-flex"}}>
                See full pricing details →
              </Link>
            </section>
          </main>

          <footer className="footer landing-footer">
            <div className="footer-content">
              <div className="footer-col">
                <h4 className="footer-col-title">PaperProof</h4>
                <p>AI-powered proofreading and plagiarism detection built for students.</p>
              </div>
              <div className="footer-col">
                <h4 className="footer-col-title">Product</h4>
                <Link to="/pricing" className="footer-link">Pricing</Link>
                <Link to="/signup" className="footer-link">Sign Up</Link>
                <Link to="/login" className="footer-link">Log In</Link>
              </div>
              <div className="footer-col">
                <h4 className="footer-col-title">Legal</h4>
                <span className="footer-link">Privacy Policy</span>
                <span className="footer-link">Terms of Service</span>
              </div>
            </div>
            <div className="footer-bottom">
              <p>&copy; 2026 PaperProof. Built for students.</p>
            </div>
          </footer>
        </div>
      );
    }

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing">
      <NavBar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/pricing"
            element={
              <AuthLayout>
                <Pricing />
              </AuthLayout>
            }
          />
          <Route
            path="/activate"
            element={
              <AuthLayout>
                <Activate />
              </AuthLayout>
            }
          />
          <Route
            path="/login"
            element={
              <AuthLayout>
                <Login />
              </AuthLayout>
            }
          />
          <Route
            path="/signup"
            element={
              <AuthLayout>
                <Signup />
              </AuthLayout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <>
                  <NavBar />
                  <Dashboard />
                  <footer className="footer">
                    <p>&copy; 2026 PaperProof. Built for students.</p>
                  </footer>
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/essays/new"
            element={
              <ProtectedRoute>
                <>
                  <NavBar />
                  <NewEssay />
                  <footer className="footer">
                    <p>&copy; 2026 PaperProof. Built for students.</p>
                  </footer>
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/essays/:id"
            element={
              <ProtectedRoute>
                <>
                  <NavBar />
                  <EssayDetail />
                  <footer className="footer">
                    <p>&copy; 2026 PaperProof. Built for students.</p>
                  </footer>
                </>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
