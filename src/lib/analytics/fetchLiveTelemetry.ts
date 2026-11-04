import type { LiveTelemetry } from './liveTypes';

export async function fetchLiveTelemetry(
  signal?: AbortSignal
): Promise<LiveTelemetry> {
  const response = await fetch('/api/analytics/live', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  let payload: LiveTelemetry | null = null;
  try {
    payload = (await response.json()) as LiveTelemetry;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load live telemetry');
  }

  return payload;
}
