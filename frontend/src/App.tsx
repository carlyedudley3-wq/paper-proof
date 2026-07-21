import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import NewEssay from "./pages/NewEssay";
import EssayDetail from "./pages/EssayDetail";
import ProtectedRoute from "./components/ProtectedRoute";

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
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <span className="nav-user">{user.email}</span>
            <button onClick={logout} className="nav-link nav-btn">
              Log Out
            </button>
          </>
        ) : (
          <>
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
      <main className="hero">
        <div className="hero-card">
          <h2>AI-Powered Proofreading &amp; Plagiarism Detection</h2>
          <p className="hero-desc">
            Catch what spellcheckers miss — awkward phrasing, citation gaps,
            and uncited sources. Submit cleaner, more original work with
            confidence.
          </p>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">✨</span>
              <span>Grammar &amp; style suggestions</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🔍</span>
              <span>Plagiarism detection</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📄</span>
              <span>3 free papers / month</span>
            </div>
          </div>

          <div className="cta">
            <Link to="/signup" className="btn-primary">
              Get Started — Sign Up Free
            </Link>
            <p className="cta-note">
              Student plans start at $8/month. No credit card required for free tier.
            </p>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2026 PaperProof. Built for students.</p>
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
