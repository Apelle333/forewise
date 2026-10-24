import Link from 'next/link';
import { Chart } from '@/components/chart';
const history = [48, 55, 51, 64, 61, 58, 70, 67, 75, 68, 82, 79, 88, 81, 95, 91, 99, 94].map(
  (value, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, value }),
);
const future = [103, 98, 110, 106, 116, 111, 121].map((value, i) => ({
  date: `2026-10-${i + 19}`,
  value,
}));
export default function Home() {
  return (
    <>
      <header className="nav shell">
        <Link className="brand" href="/">
          <span className="brand-icon">f</span>forewise<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#possibilities">Use cases</a>
          <Link className="nav-signin" href="/login">
            Sign in ↗
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero shell">
          <div className="eyebrow">
            <span className="live-dot" /> A clearer view of what comes next
          </div>
          <h1>
            Less guesswork.
            <br />
            More <span className="serif">foresight.</span>
          </h1>
          <p className="hero-description">
            Turn your business data into a clearer next move.
            <br className="desktop-break" /> Explore demand, revenue, and operations in one calm
            workspace.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/register">
              Explore your workspace <span>↗</span>
            </Link>
            <a className="text-link" href="#how-it-works">
              See how it works <span>↓</span>
            </a>
          </div>
          <p className="micro">Private development preview · No credit card · Mock forecasts</p>
          <div className="product-preview">
            <div className="preview-sidebar">
              <span className="mini-logo">f.</span>
              <span className="sidebar-active">◫ Overview</span>
              <span>▤ Datasets</span>
              <span>↗ Forecasts</span>
              <span className="sidebar-bottom">◉ Sample workspace</span>
            </div>
            <div className="preview-content">
              <div className="preview-top">
                <span>
                  Workspace <span className="muted">/ Overview</span>
                </span>
                <span className="small-badge">ILLUSTRATIVE DATA</span>
              </div>
              <div className="preview-heading">
                <div>
                  <p className="overline">A LITTLE CLARITY GOES A LONG WAY</p>
                  <h2>Your next chapter, in view.</h2>
                </div>
                <span className="avatar">FW</span>
              </div>
              <div className="preview-metrics">
                <div>
                  <span>Metric</span>
                  <strong>Daily demand</strong>
                  <small>One series. A clearer perspective.</small>
                </div>
                <div>
                  <span>Forecast horizon</span>
                  <strong>
                    7 days <span className="green">↗</span>
                  </strong>
                  <small>Look a little further ahead</small>
                </div>
                <div>
                  <span>Model status</span>
                  <strong>Demo preview</strong>
                  <small>No accuracy claims. No surprises.</small>
                </div>
              </div>
              <div className="chart-heading">
                <strong>See the direction. Explore the possibilities.</strong>
                <span>
                  <i /> Historical <i className="lime" /> Illustrative forecast
                </span>
              </div>
              <Chart history={history} future={future} />
            </div>
          </div>
        </section>
        <section className="possibilities shell" id="possibilities">
          <p className="overline">ONE WORKSPACE. MANY WHAT-IFS.</p>
          <div className="usecases">
            <span>Revenue & sales</span>
            <span>Demand & inventory</span>
            <span>Operations & capacity</span>
          </div>
          <p className="muted">Start with a daily time series. The business question is yours.</p>
        </section>
        <section className="steps shell" id="how-it-works">
          <div className="section-title">
            <p className="overline">FROM SPREADSHEET TO PERSPECTIVE</p>
            <h2>
              Complex data.
              <br />
              <span className="serif">Simple next steps.</span>
            </h2>
            <p>You bring the question. Forewise gives it a place to start.</p>
          </div>
          <div className="step-grid">
            {[
              [
                '01',
                'Bring your data',
                'Upload a simple CSV with dates and values. Check the format before you go further.',
              ],
              [
                '02',
                'Set your horizon',
                'Choose how far ahead to explore, from one day to ninety. Keep every run in your workspace.',
              ],
              [
                '03',
                'See what comes next',
                'Compare your history with a clearly marked mock forecast. Real model evaluation comes next.',
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span className="step-number">
                  {n} <span>↗</span>
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="closing shell">
          <span className="eyebrow">MAKE ROOM FOR A CLEARER TOMORROW</span>
          <h2>
            Your data has a story.
            <br />
            <span className="serif">See the next page.</span>
          </h2>
          <Link className="button primary" href="/register">
            Get started with Forewise ↗
          </Link>
          <p className="micro">Phase 01 preview. No billing enabled.</p>
        </section>
      </main>
      <footer className="footer shell">
        <Link className="brand" href="/">
          forewise.
        </Link>
        <span>A little less uncertainty.</span>
        <span>© {new Date().getFullYear()} Forewise · Development preview</span>
      </footer>
    </>
  );
}
