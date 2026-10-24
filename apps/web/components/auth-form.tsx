'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand } from './brand';
export function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push('/workspace');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page" id="main">
      <header className="auth-nav">
        <Brand />
        <Link className="back-link" href="/">
          ← Back to Forewise
        </Link>
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="overline">PAST OBSERVED. NEXT EXPLORED.</span>
          <h2>
            A little history.
            <br />
            <span className="serif">A new perspective.</span>
          </h2>
          <svg viewBox="0 0 500 220" aria-hidden="true">
            <path
              d="M0 180H500M0 100H500M0 20H500M100 0V220M300 0V220"
              fill="none"
              stroke="var(--line)"
            />
            <path
              d="M0 170L70 160L140 100L210 120L280 70L310 85"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2"
            />
            <path
              d="M310 85L380 45L440 70L500 25"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          </svg>
          <p>
            Bring a CSV, or start with sample data.
            <br />
            Your first view ahead is a few steps away.
          </p>
          <span className="auth-story-note">
            A private development preview.
            <br />
            Mock forecasts. No billing enabled.
          </span>
        </section>
        <div className="auth-card">
          <span className="eyebrow">A LITTLE MORE CLARITY</span>
          <h1>{register ? 'Start your next chapter.' : 'Welcome back.'}</h1>
          <p>
            {register
              ? 'Create a private workspace and explore your data.'
              : 'Your next move starts here.'}
          </p>
          <form onSubmit={submit}>
            {register ? (
              <>
                <label>
                  Your name
                  <input name="name" autoComplete="name" maxLength={80} required />
                </label>
                <label>
                  Workspace name
                  <input
                    name="workspace"
                    placeholder="e.g. Acme Operations"
                    maxLength={80}
                    required
                  />
                </label>
              </>
            ) : null}
            <label>
              Work email
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <span className="field-hint">At least 12 characters.</span>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary full" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create workspace ↗' : 'Sign in ↗'}
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have a workspace?' : 'New to Forewise?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <p className="micro">
            Local development preview · No billing enabled.
            <br />
            Use sample data. Do not upload sensitive information.
          </p>
        </div>
      </div>
      <footer className="auth-footer">
        Forewise / Phase 01 <span>Clarity begins with a little history.</span>
      </footer>
    </main>
  );
}
