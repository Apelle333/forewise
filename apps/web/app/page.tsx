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
          <a href="#how-it-works">The perspective</a>
          <a href="#demo">The working demo</a>
          <Link href="/login">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
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
              A useful forecast starts with perspective.
              <br />A responsible one keeps its limits in view.
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
                Start with daily observations. Look for patterns, interruptions and the context
                behind the numbers.
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
                Change the horizon and compare constructed scenarios. A wider shape invites
                questions; it does not establish their likelihood.
              </p>
              <span className="h-chapter-detail">One history → multiple possible paths</span>
            </article>
            <article>
              <span>03 / UNDERSTAND</span>
              <h3>
                Keep the wonder.
                <br />
                <em>Read the values.</em>
              </h3>
              <p>
                Step from the spatial illustration into a precise, accessible chart. Inspect the
                mock, read its method and decide what still needs evidence.
              </p>
              <a href="#demo">
                Go to the working example <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>
        </section>
        <section className="h-working" aria-labelledby="working-title">
          <div className="h-working-head">
            <span className="h-small">THE WORKING EXAMPLE / 02</span>
            <h2 id="working-title">Back on solid ground.</h2>
            <p>Demand, revenue or capacity. The same transparent mock, down to the last value.</p>
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
          <Link href="/register" className="h-action">
            Explore your workspace <span aria-hidden="true">↗</span>
          </Link>
          <p>Phase 01 · Local mock preview · No billing</p>
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
