'use client';

import { useState, useEffect, useCallback } from 'react';

interface LookupOption {
  id: number;
  name: string;
  isActive?: number;
}

// Simple in-memory cache shared across all hook instances
const cache = new Map<string, { data: LookupOption[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch and cache lookup table data.
 * @param table - The lookup table slug (e.g. 'categories', 'unit-of-stock')
 * @param includeInactive - Whether to include inactive options (for edit forms)
 */
export function useLookup(table: string, includeInactive = false) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const cacheKey = `${table}:${includeInactive}`;

  const fetchData = useCallback(async () => {
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setOptions(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = `/api/lookup/${table}${includeInactive ? '?includeInactive=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: LookupOption[] = await res.json();
        cache.set(cacheKey, { data, ts: Date.now() });
        setOptions(data);
      }
    } catch (err) {
      console.error(`Failed to fetch lookup "${table}":`, err);
    } finally {
      setLoading(false);
    }
  }, [table, includeInactive, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cache.delete(cacheKey);
    fetchData();
  }, [cacheKey, fetchData]);

  return { options, loading, invalidate };
}

/**
 * Clear the entire lookup cache (used after admin edits master data).
 */
export function clearLookupCache() {
  cache.clear();
}
