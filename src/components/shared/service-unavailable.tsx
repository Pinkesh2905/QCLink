'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ServiceUnavailableProps {
  /** Called when the user (or the timer) retries. Error boundaries pass their reset(); server pages just refresh. */
  onRetry?: () => void;
  /** Digest of the server error, shown small so support can find it in the logs. */
  digest?: string;
}

const RETRY_SECONDS = 20;
const MAX_AUTO_RETRIES = 15; // about five minutes, then wait for the user

/**
 * Friendly screen shown when the page cannot be loaded, most often because the database is
 * unreachable. It retries by itself every 20 seconds, so the screen clears on its own once the
 * database is back. Plain inline styles on purpose: it must still render if the stylesheet or a
 * provider is part of what failed.
 */
export function ServiceUnavailable({ onRetry, digest }: ServiceUnavailableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seconds, setSeconds] = useState(RETRY_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);

  const retry = useCallback(() => {
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    setSeconds(RETRY_SECONDS);
    startTransition(() => {
      router.refresh();
      onRetry?.();
    });
  }, [router, onRetry]);

  useEffect(() => {
    if (attempts >= MAX_AUTO_RETRIES) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          retry();
          return RETRY_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempts, retry]);

  const gaveUp = attempts >= MAX_AUTO_RETRIES;

  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
          ⏳
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '16px 0 8px' }}>QCLink is temporarily unavailable</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#d4d4d8', margin: 0 }}>
          We can&apos;t reach the database right now. This is usually brief and nothing you entered has been lost.
        </p>
        <p style={{ fontSize: 14, color: '#a1a1aa', margin: '16px 0 20px' }}>
          {gaveUp
            ? 'Still not reachable. Please try again in a few minutes.'
            : pending
            ? 'Checking again…'
            : `Trying again automatically in ${seconds}s`}
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          style={{
            background: '#fafafa',
            color: '#0a0a0a',
            border: 0,
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: pending ? 'default' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          Try again now
        </button>
        <p style={{ fontSize: 12, color: '#71717a', marginTop: 28 }}>
          If this keeps happening, contact Vezapp support.
          {digest ? <> Reference: {digest}</> : null}
        </p>
      </div>
    </div>
  );
}
