'use client';

import { ServiceUnavailable } from '@/components/shared/service-unavailable';

// Last line of defence: replaces the whole page (root layout included) if even that fails.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ServiceUnavailable onRetry={reset} digest={error.digest} />
      </body>
    </html>
  );
}
