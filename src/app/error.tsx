'use client';

import { ServiceUnavailable } from '@/components/shared/service-unavailable';

// Catches any error thrown while rendering a page (for example when the database cannot be
// reached half-way through loading it) and shows the friendly screen instead of the browser's
// generic "This page couldn't load".
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ServiceUnavailable onRetry={reset} digest={error.digest} />;
}
