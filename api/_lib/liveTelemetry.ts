import type { SupabaseClient } from '@supabase/supabase-js';
import { formatKolkataTimestamp } from './analyticsRange.js';
import { inactivityCutoffIso } from './sessions.js';

interface SessionRow {
  visitor_id: string | null;
  session_started_at: string | null;
  last_seen_at: string | null;
  session_ended_at: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  browser: string | null;
  browser_version: string | null;
  operating_system: string | null;
  device_type: string | null;
  screen_resolution: string | null;
  timezone: string | null;
}

export interface AnonymizedSession {
  displayIndex: number;
  label: string;
  isLive: boolean;
  deviceType: string;
  operatingSystem: string;
  browser: string;
  browserVersion: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  screenResolution: string;
  timezone: string;
  startedAtLabel: string;
  lastSeenAtLabel: string;
}

export interface LiveTelemetryPayload {
  timezone: string;
  updatedAt: string;
  updatedAtLabel: string;
  overview: {
    totalVisitors: number;
    uniqueDevices: number;
    activeWatchers: number;
  };
  watchingLabel: string;
  sessions: AnonymizedSession[];
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function displayOrUnknown(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'Unknown';
  return decodeMaybe(trimmed);
}

function deviceLabel(deviceType: string): string {
  const normalized = deviceType.toLowerCase();
  if (normalized === 'desktop') return 'Desktop PC';
  if (normalized === 'mobile') return 'Mobile';
  if (normalized === 'tablet') return 'Tablet';
  return deviceType === 'Unknown' ? 'Device' : deviceType;
}

function isSessionLive(row: SessionRow, activeCutoff: string): boolean {
  if (row.session_ended_at) return false;
  if (!row.last_seen_at) return false;
  return new Date(row.last_seen_at).getTime() >= new Date(activeCutoff).getTime();
}

export async function buildLiveTelemetry(
  supabase: SupabaseClient,
  nowIso: string
): Promise<LiveTelemetryPayload> {
  const activeCutoff = inactivityCutoffIso(new Date(nowIso));

  const [
    { count: totalVisitors, error: visitorsError },
    { data: sessionRows, error: sessionsError },
  ] = await Promise.all([
    supabase.from('visitors').select('id', { count: 'exact', head: true }),
    supabase
      .from('visitor_sessions')
      .select(
        [
          'visitor_id',
          'session_started_at',
          'last_seen_at',
          'session_ended_at',
          'country',
          'region',
          'city',
          'postal_code',
          'browser',
          'browser_version',
          'operating_system',
          'device_type',
          'screen_resolution',
          'timezone',
        ].join(',')
      )
      .order('last_seen_at', { ascending: false })
      .limit(40),
  ]);

  if (visitorsError) throw visitorsError;
  if (sessionsError) throw sessionsError;

  const rows = (sessionRows ?? []) as unknown as SessionRow[];

  const sorted = [...rows].sort((a, b) => {
    const aLive = isSessionLive(a, activeCutoff) ? 1 : 0;
    const bLive = isSessionLive(b, activeCutoff) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  const limited = sorted.slice(0, 20);

  const sessions: AnonymizedSession[] = limited.map((row, index) => {
    const deviceType = displayOrUnknown(row.device_type);
    const displayIndex = index + 1;
    const live = isSessionLive(row, activeCutoff);

    return {
      displayIndex,
      label: `Visitor #${displayIndex}`,
      isLive: live,
      deviceType: deviceLabel(deviceType),
      operatingSystem: displayOrUnknown(row.operating_system),
      browser: displayOrUnknown(row.browser),
      browserVersion: displayOrUnknown(row.browser_version),
      country: displayOrUnknown(row.country),
      region: displayOrUnknown(row.region),
      city: displayOrUnknown(row.city),
      postalCode: displayOrUnknown(row.postal_code),
      screenResolution: displayOrUnknown(row.screen_resolution),
      timezone: displayOrUnknown(row.timezone),
      startedAtLabel: row.session_started_at
        ? formatKolkataTimestamp(new Date(row.session_started_at))
        : 'Unknown',
      lastSeenAtLabel: row.last_seen_at
        ? formatKolkataTimestamp(new Date(row.last_seen_at))
        : 'Unknown',
    };
  });

  const activeWatchers = sessions.filter((s) => s.isLive).length;
  const uniqueDevices = new Set(
    rows
      .map((r) => r.visitor_id)
      .filter((id): id is string => Boolean(id))
  ).size;

  const watchingCount = activeWatchers;
  const watchingLabel =
    watchingCount === 1
      ? '1 DEVICE CURRENTLY WATCHING'
      : `${watchingCount} DEVICES CURRENTLY WATCHING`;

  return {
    timezone: 'Asia/Kolkata',
    updatedAt: nowIso,
    updatedAtLabel: formatKolkataTimestamp(new Date(nowIso)),
    overview: {
      totalVisitors: totalVisitors ?? 0,
      uniqueDevices,
      activeWatchers,
    },
    watchingLabel,
    sessions,
  };
}
