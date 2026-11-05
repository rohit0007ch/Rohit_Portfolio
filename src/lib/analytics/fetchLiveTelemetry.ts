import type { LiveTelemetry } from './liveTypes';

function analyticsDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log('[analytics]', ...args);
  }
}

export async function fetchLiveTelemetry(
  signal?: AbortSignal
): Promise<LiveTelemetry> {
  const startedAt = performance.now();
  analyticsDebug('request', { endpoint: '/api/analytics/live' });

  const response = await fetch(`/api/analytics/live?t=${Date.now()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal,
  });

  let payload: LiveTelemetry | null = null;
  try {
    payload = (await response.json()) as LiveTelemetry;
  } catch {
    payload = null;
  }

  analyticsDebug('response', {
    endpoint: '/api/analytics/live',
    status: response.status,
    ms: Math.round(performance.now() - startedAt),
    overview: payload?.overview,
    sessions: payload?.sessions?.length,
  });

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load live telemetry');
  }

  return payload;
}
