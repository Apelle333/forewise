import Link from 'next/link';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Forewise home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <path d="M3 26V6h8v20M15 26V14h6V4h8" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M15 26l14-14" fill="none" stroke="var(--accent)" strokeWidth="3" />
      </svg>
      <span>
        forewise<span className="brand-punctuation">/</span>
      </span>
    </Link>
  );
}
