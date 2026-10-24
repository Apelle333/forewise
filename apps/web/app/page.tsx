import Link from 'next/link';
import { Brand } from '@/components/brand';
import { ForecastDemo } from '@/components/forecast-demo';
export default function Home() {
  return (
    <>
      <header className="nav shell">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">The process</a>
          <a href="#possibilities">The possibilities</a>
          <Link href="/login" className="nav-signin">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero shell">
          <div className="hero-folio">
            <span className="overline">BUSINESS FORECASTING, IN PERSPECTIVE</span>
            <span className="edition">FIELD NOTES / 001</span>
          </div>
          <div className="hero-lead">
            <h1>
              Yesterday is data.
              <br />
              <span className="serif">Tomorrow is a decision.</span>
            </h1>
            <div className="hero-aside">
              <p>
                A clearer way to explore what comes next. Bring your daily business data. See the
                history, set a horizon, and explore a forecast.
              </p>
              <Link className="button primary" href="/register">
                Explore your workspace <span aria-hidden="true">↗</span>
              </Link>
              <span className="micro">Phase 01 preview · Mock forecasts · No billing</span>
            </div>
          </div>
          <ForecastDemo />
          <div className="hero-caption">
            <span>01 / A WORKING EXAMPLE, NOT A PROMISE</span>
            <span>Adjust the horizon. Inspect a day. See the idea in motion.</span>
          </div>
        </section>
        <section className="possibilities shell" id="possibilities">
          <div className="section-label">
            <span>02 / THE POSSIBILITIES</span>
            <span>ONE SERIES. YOUR BUSINESS QUESTION.</span>
          </div>
          <div className="possibilities-heading">
            <h2>
              Different questions.
              <br />
              <span className="serif">A shared starting point.</span>
            </h2>
            <p>
              Demand, revenue or capacity: start with a daily date and a value. Keep the context
              yours.
            </p>
          </div>
          <div className="usecase-rows">
            {[
              [
                '01',
                'What might demand look like?',
                'Daily orders, bookings or product demand.',
                'Demand',
              ],
              [
                '02',
                'What could revenue do next?',
                'A daily record of sales or recurring activity.',
                'Revenue',
              ],
              [
                '03',
                'Where might capacity be needed?',
                'Daily volumes, workloads or service hours.',
                'Operations',
              ],
            ].map(([n, title, body, tag]) => (
              <article key={n}>
                <span className="row-number">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className="usecase-tag">
                  {tag} <span aria-hidden="true">↗</span>
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="process shell" id="how-it-works">
          <div className="section-label">
            <span>03 / FROM DATA TO A VIEW AHEAD</span>
            <span>NOTHING EXTRA TO LEARN</span>
          </div>
          <div className="process-layout">
            <div>
              <h2>
                A small beginning.
                <br />
                <span className="serif">A useful perspective.</span>
              </h2>
              <p>
                Try a synthetic dataset first. Then bring a CSV when you’re ready to test your own
                workflow.
              </p>
              <Link href="/register" className="text-link">
                Start with sample data <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <ol className="process-list">
              <li>
                <span>01</span>
                <div>
                  <h3>Bring a little history.</h3>
                  <p>Two columns: date and value. We check the format before you go further.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Give tomorrow a horizon.</h3>
                  <p>Choose 1–90 days ahead. Generate a clearly labeled weekly-repeat mock.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Read the result. Keep the context.</h3>
                  <p>Inspect every value, compare it with history, and export the mock result.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className="truth-section shell">
          <span className="overline">A NOTE ON CERTAINTY</span>
          <h2>
            Clarity begins
            <br />
            with <span className="serif">honesty.</span>
          </h2>
          <div>
            <p>
              This preview proves the workflow. Its forecasts repeat the last observed week; they
              aren’t validated predictions.
            </p>
            <p>
              No invented accuracy. No pretend confidence bands. Real model evaluation comes after
              this phase.
            </p>
          </div>
        </section>
        <section className="closing shell">
          <span className="overline">YOUR NEXT MOVE STARTS WITH A LITTLE HISTORY</span>
          <h2>
            Let’s see
            <br />
            <span className="serif">what comes next.</span>
          </h2>
          <Link className="button primary" href="/register">
            Create your workspace <span aria-hidden="true">↗</span>
          </Link>
          <p className="micro">Private development preview. No credit card or billing enabled.</p>
        </section>
      </main>
      <footer className="footer shell">
        <Brand />
        <span>Past observed. Next explored.</span>
        <span>© {new Date().getFullYear()} Forewise / Phase 01</span>
      </footer>
    </>
  );
}
