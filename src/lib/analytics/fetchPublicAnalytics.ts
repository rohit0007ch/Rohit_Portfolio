import type { AnalyticsRange, PublicAnalytics } from './types';

function analyticsDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log('[analytics]', ...args);
  }
}

export async function fetchPublicAnalytics(
  range: AnalyticsRange,
  signal?: AbortSignal
): Promise<PublicAnalytics> {
  const startedAt = performance.now();
  const url = `/api/analytics/public?range=${encodeURIComponent(range)}&t=${Date.now()}`;
  analyticsDebug('request', { endpoint: '/api/analytics/public', range });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal,
  });

  let payload: PublicAnalytics | null = null;
  try {
    payload = (await response.json()) as PublicAnalytics;
  } catch {
    payload = null;
  }

  analyticsDebug('response', {
    endpoint: '/api/analytics/public',
    status: response.status,
    ms: Math.round(performance.now() - startedAt),
    overview: payload?.overview,
  });

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load analytics');
  }

  return payload;
}
