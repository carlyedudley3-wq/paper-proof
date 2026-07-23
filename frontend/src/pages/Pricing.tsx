import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface PlanFeature {
  text: string;
  included: boolean;
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tier: "free",
    description: "Basic proofreading for occasional papers",
    features: [
      { text: "3 papers per month", included: true },
      { text: "Basic grammar checking", included: true },
      { text: "Spelling corrections", included: true },
      { text: "Advanced style suggestions", included: false },
      { text: "Plagiarism detection", included: false },
      { text: "Unlimited papers", included: false },
    ] as PlanFeature[],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Student Plan",
    price: "$8",
    period: "per month",
    tier: "student",
    description: "Full proofreading & plagiarism for serious students",
    features: [
      { text: "Unlimited papers", included: true },
      { text: "Advanced grammar & style", included: true },
      { text: "Spelling corrections", included: true },
      { text: "Clarity improvements", included: true },
      { text: "Full plagiarism detection", included: true },
      { text: "Priority support", included: true },
    ] as PlanFeature[],
    cta: "Upgrade to Student",
    highlight: true,
    comingSoon: true,
  },
  {
    name: "Pay-Per-Paper",
    price: "$3",
    period: "per paper",
    tier: "pay_per_paper",
    description: "One-off full check when you need it",
    features: [
      { text: "Full proofreading for 1 paper", included: true },
      { text: "Advanced grammar & style", included: true },
      { text: "Spelling corrections", included: true },
      { text: "Plagiarism detection for 1 paper", included: true },
      { text: "No subscription required", included: true },
      { text: "Papers roll over", included: true },
    ] as PlanFeature[],
    cta: "Buy Papers",
    highlight: false,
    comingSoon: true,
  },
];

export default function Pricing() {
  const { user } = useAuth();

  return (
    <main className="pricing-page">
      <div className="pricing-header">
        <h2>Simple, Student-Friendly Pricing</h2>
        <p>Start free, upgrade when you're ready for the full toolkit.</p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => {
          const isCurrentTier = user?.tier === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`pricing-card ${plan.highlight ? "pricing-card-highlight" : ""} ${isCurrentTier ? "pricing-card-current" : ""}`}
            >
              {isCurrentTier && (
                <span className="pricing-current-badge">Current Plan</span>
              )}
              {plan.highlight && !isCurrentTier && (
                <span className="pricing-popular-badge">Most Popular</span>
              )}

              <div className="pricing-card-header">
                <h3>{plan.name}</h3>
                <div className="pricing-price">
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-period">/{plan.period}</span>
                </div>
                <p className="pricing-description">{plan.description}</p>
              </div>

              <ul className="pricing-features">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className={feature.included ? "feature-included" : "feature-excluded"}
                  >
                    <span className="feature-icon">
                      {feature.included ? "✓" : "✗"}
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <div className="pricing-cta">
                {isCurrentTier ? (
                  <div className="pricing-current-label">
                    ✓ You're on this plan
                  </div>
                ) : plan.tier === "free" ? (
                  <Link to="/signup" className="btn-primary btn-full">
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    className={`btn-primary btn-full ${plan.comingSoon ? "btn-disabled" : ""}`}
                    disabled={!!plan.comingSoon}
                    title={plan.comingSoon ? "Coming soon — payment links will be available shortly" : undefined}
                  >
                    {plan.comingSoon ? "Coming Soon" : plan.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pricing-footer">
        <h3>Frequently Asked Questions</h3>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>Can I switch plans anytime?</h4>
            <p>
              Yes! You can upgrade or downgrade at any time. Your remaining papers
              carry over when you switch from Pay-Per-Paper.
            </p>
          </div>
          <div className="faq-item">
            <h4>What counts as a "paper"?</h4>
            <p>
              Any essay, research paper, lab report, or assignment you submit
              for proofreading. Each submission counts as one paper.
            </p>
          </div>
          <div className="faq-item">
            <h4>Is my data secure?</h4>
            <p>
              Absolutely. We never share your essays with third parties or use
              them to train AI models. Your work stays private.
            </p>
          </div>
          <div className="faq-item">
            <h4>Do unused papers expire?</h4>
            <p>
              Pay-Per-Paper credits never expire. Use them whenever you need —
              next week, next month, or next semester.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
