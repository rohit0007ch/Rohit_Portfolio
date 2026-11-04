import type { AnalyticsRange, PublicAnalytics } from './types';

export async function fetchPublicAnalytics(
  range: AnalyticsRange,
  signal?: AbortSignal
): Promise<PublicAnalytics> {
  const response = await fetch(
    `/api/analytics/public?range=${encodeURIComponent(range)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }
  );

  let payload: PublicAnalytics | null = null;
  try {
    payload = (await response.json()) as PublicAnalytics;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load analytics');
  }

  return payload;
}
