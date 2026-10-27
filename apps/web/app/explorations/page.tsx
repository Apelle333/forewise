import Link from 'next/link';
import { Brand } from '@/components/brand';
import { HorizonExperience } from '@/components/horizon-experience';
import type { Direction } from '@/lib/horizon-data';
import '../horizon.css';

export default async function Explorations({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string }>;
}) {
  const { direction: requested } = await searchParams;
  const direction: Direction =
    requested === 'observatory' || requested === 'atlas' ? requested : 'horizon';
  return (
    <div className={`horizon-page study-${direction}`}>
      <header className="h-nav">
        <Brand />
        <Link href="/">Back to selected design ↗</Link>
      </header>
      <main id="main">
        <nav className="h-study-nav" aria-label="Visual directions">
          {[
            ['horizon', '01 / Forecast Horizon'],
            ['observatory', '02 / Signal Observatory'],
            ['atlas', '03 / Tidal Atlas'],
          ].map(([key, name]) => (
            <Link
              key={key}
              href={`/explorations?direction=${key}`}
              aria-current={key === direction ? 'page' : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <HorizonExperience key={direction} direction={direction} exploration />
        <p className="h-study-rationale">
          {direction === 'horizon'
            ? 'Selected: the passage from observed history into open scenarios is immediately legible. The strongest fit for a forecasting product.'
            : direction === 'observatory'
              ? 'Alternative: a radial instrument with a compact, technical identity. Angular time is less immediate than a left-to-right timeline. Prototype only; 2D mode uses the canonical timeline.'
              : 'Alternative: a topographic scenario surface. More tactile and architectural; depth can obscure comparisons. Prototype only; 2D mode uses the canonical timeline.'}
        </p>
      </main>
    </div>
  );
}
