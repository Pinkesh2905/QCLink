'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Debounce a value by the specified delay in milliseconds.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Debounce a callback function.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timer) clearTimeout(timer);
      const newTimer = setTimeout(() => callback(...args), delay);
      setTimer(newTimer);
    },
    [callback, delay, timer]
  ) as T;

  return debouncedFn;
}
