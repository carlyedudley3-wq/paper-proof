export default function App() {
  return (
    <div className="landing">
      <header className="header">
        <h1 className="logo">📝 PaperProof</h1>
        <p className="tagline">Polish your essays before submission</p>
      </header>

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
            <button className="btn-primary" disabled>
              Coming Soon — Sign Up
            </button>
            <p className="cta-note">
              We're launching soon. Student plans start at $8/month.
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
