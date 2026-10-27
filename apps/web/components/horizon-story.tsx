'use client';
import { useEffect, useRef, useState } from 'react';
import type { mountHorizon } from './horizon-renderer';

export function HorizonStory() {
  const host = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = host.current!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 901px)');
    let engine: ReturnType<typeof mountHorizon> | undefined;
    let cancelled = false;
    let loading = false;
    function update() {
      if (motion.matches || !desktop.matches) {
        engine?.dispose();
        engine = undefined;
        setReady(false);
        return;
      }
      const section = node.closest('.h-story')!;
      const rect = section.getBoundingClientRect();
      if (rect.top > innerHeight || rect.bottom < 0) return;
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight * 0.4 - rect.top) / (rect.height - innerHeight * 0.4)),
      );
      setChapter(progress < 0.25 ? 0 : progress < 0.7 ? 1 : 2);
      if (engine) {
        engine.setStoryProgress(progress);
        return;
      }
      if (loading) return;
      loading = true;
      import('./horizon-renderer')
        .then(({ mountHorizon }) => {
          if (cancelled || motion.matches || !desktop.matches) return;
          try {
            engine = mountHorizon(
              node,
              { days: 28, spread: 55, direction: 'horizon', reduced: false },
              () => {
                engine?.dispose();
                engine = undefined;
                setReady(false);
              },
            );
            engine.setStoryProgress(progress);
            setReady(true);
          } catch {
            setReady(false);
          }
        })
        .catch(() => setReady(false))
        .finally(() => {
          loading = false;
        });
    }
    window.addEventListener('scroll', update, { passive: true });
    motion.addEventListener('change', update);
    desktop.addEventListener('change', update);
    update();
    return () => {
      cancelled = true;
      engine?.dispose();
      window.removeEventListener('scroll', update);
      motion.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);
  return (
    <div className={`h-narrative ${ready ? 'is-ready' : ''}`} data-chapter={chapter}>
      <div ref={host} className="h-narrative-canvas" aria-hidden="true" />
      <span>
        {
          ['01 / HISTORY, OBSERVED', '02 / SCENARIOS, UNFOLDED', '03 / A WIDER PERSPECTIVE'][
            chapter
          ]
        }
      </span>
      <small>Synthetic illustration · no probabilities assigned</small>
    </div>
  );
}
