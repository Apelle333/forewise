import Link from 'next/link';
import { Brand } from '@/components/brand';
import { ForecastDemo } from '@/components/forecast-demo';
import { HorizonExperience } from '@/components/horizon-experience';
import { HorizonStory } from '@/components/horizon-story';
import './horizon.css';

export default function Home() {
  return (
    <div className="horizon-page">
      <header className="h-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works" className="h-nav-story">
            How it works
          </a>
          <a href="#horizon-lab" className="h-nav-scenarios">
            Explore scenarios
          </a>
          <a href="#demo" className="h-nav-demo">
            Try demo <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main id="main">
        <HorizonExperience />
        <section className="h-story" id="how-it-works">
          <div className="h-story-sticky">
            <span className="h-small">
              FROM THE KNOWN
              <br />
              TO THE POSSIBLE
            </span>
            <h2>
              The future isn’t
              <br />a single <em>line.</em>
            </h2>
            <p>
              From daily observations to planning questions.
              <br />
              Explore the idea. Understand its limits.
            </p>
            <HorizonStory />
            <span className="h-story-foot">SCROLL TO UNFOLD THE SCENARIOS ↓</span>
          </div>
          <div className="h-chapters">
            <article>
              <span>01 / OBSERVE</span>
              <h3>
                Every signal
                <br />
                has a history.
              </h3>
              <p>
                The intended input is a CSV with one date and one value per day: units sold, revenue
                or capacity hours. This public demo uses synthetic examples.
              </p>
              <span className="h-chapter-detail">28 observations → a point of departure</span>
            </article>
            <article>
              <span>02 / EXPLORE</span>
              <h3>
                Give uncertainty
                <br />
                some space.
              </h3>
              <p>
                Compare 7–28 days of constructed scenarios. Ask what a different path could mean for
                stock, budgets or staffing. The width is adjustable, not a measure of likelihood.
              </p>
              <span className="h-chapter-detail">One history → multiple possible paths</span>
            </article>
            <article>
              <span>03 / UNDERSTAND</span>
              <h3>
                Inspect the values.
                <br />
                <em>Know the limits.</em>
              </h3>
              <p>
                Read exact values in the chart or table. The mock repeats the last observed week; it
                is not a validated prediction and must not guide business decisions.
              </p>
              <a href="#demo">
                Try the interactive demo <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>
        </section>
        <section className="h-working" aria-labelledby="working-title">
          <div className="h-working-head">
            <span className="h-small">THE WORKING EXAMPLE / 02</span>
            <h2 id="working-title">Explore a planning scenario.</h2>
            <p>
              Choose demand, revenue or capacity. Adjust the horizon and inspect each synthetic
              value.
            </p>
          </div>
          <ForecastDemo />
        </section>
        <section className="h-end">
          <span className="h-small">A LITTLE HISTORY. A NEW PERSPECTIVE.</span>
          <h2>
            What’s on
            <br />
            <em>your horizon?</em>
          </h2>
          <a href="#demo" className="h-action">
            Try interactive demo <span aria-hidden="true">↗</span>
          </a>
          <p>Phase 01 · Synthetic examples only · No uploads or live forecasting in this preview</p>
        </section>
      </main>
      <footer className="h-footer">
        <Brand />
        <span>Past observed. Next explored.</span>
        <Link href="/explorations">View the three visual studies ↗</Link>
      </footer>
    </div>
  );
}
