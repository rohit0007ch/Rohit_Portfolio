import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatKolkataTimestamp } from './analyticsRange.js';
import { inactivityCutoffIso } from './sessions.js';

interface SessionRow {
  id: string;
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
  sessionKey: string;
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
  locationLabel: string;
  screenResolution: string;
  timezone: string;
  startedAt: string | null;
  lastSeenAt: string | null;
  startedAtLabel: string;
  lastSeenAtLabel: string;
  lastSeenRelative: string;
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

const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  AE: 'United Arab Emirates',
  SG: 'Singapore',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  BR: 'Brazil',
  NL: 'Netherlands',
  SE: 'Sweden',
  CH: 'Switzerland',
  IE: 'Ireland',
  NZ: 'New Zealand',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  NP: 'Nepal',
  LK: 'Sri Lanka',
};

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

function countryLabel(code: string): string {
  if (code === 'Unknown') return 'Unknown';
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

function deviceLabel(deviceType: string): string {
  const normalized = deviceType.toLowerCase();
  if (normalized === 'desktop') return 'Desktop PC';
  if (normalized === 'mobile') return 'Mobile';
  if (normalized === 'tablet') return 'Tablet';
  return deviceType === 'Unknown' ? 'Device' : deviceType;
}

function normalizeTimezone(value: string): string {
  if (value === 'Asia/Calcutta') return 'Asia/Kolkata';
  return value;
}

function stableSessionKey(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
}

function relativeFromNow(iso: string | null, nowMs: number): string {
  if (!iso) return 'Unknown';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';
  const diffSec = Math.max(0, Math.round((nowMs - then) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return formatKolkataTimestamp(new Date(iso));
}

function isSessionLive(row: SessionRow, activeCutoffMs: number): boolean {
  if (row.session_ended_at) return false;
  if (!row.last_seen_at) return false;
  const lastSeen = new Date(row.last_seen_at).getTime();
  return !Number.isNaN(lastSeen) && lastSeen >= activeCutoffMs;
}

function buildLocationLabel(
  city: string,
  region: string,
  country: string
): string {
  const niceCountry = countryLabel(country);
  const parts = [city !== 'Unknown' ? city : null, niceCountry !== 'Unknown' ? niceCountry : null].filter(
    Boolean
  );
  if (parts.length) return parts.join(', ');
  if (region !== 'Unknown') return region;
  return 'Location unavailable';
}

function toAnonymized(
  row: SessionRow,
  nowMs: number,
  activeCutoffMs: number,
  ordinal: number
): AnonymizedSession {
  const deviceType = displayOrUnknown(row.device_type);
  const city = displayOrUnknown(row.city);
  const region = displayOrUnknown(row.region);
  const country = displayOrUnknown(row.country);
  const live = isSessionLive(row, activeCutoffMs);
  const sessionKey = stableSessionKey(row.id);

  return {
    sessionKey,
    label: `Visitor #${ordinal}`,
    isLive: live,
    deviceType: deviceLabel(deviceType),
    operatingSystem: displayOrUnknown(row.operating_system),
    browser: displayOrUnknown(row.browser),
    browserVersion: displayOrUnknown(row.browser_version),
    country: countryLabel(country),
    region,
    city,
    postalCode: displayOrUnknown(row.postal_code),
    locationLabel: buildLocationLabel(city, region, country),
    screenResolution: displayOrUnknown(row.screen_resolution),
    timezone: normalizeTimezone(displayOrUnknown(row.timezone)),
    startedAt: row.session_started_at,
    lastSeenAt: row.last_seen_at,
    startedAtLabel: row.session_started_at
      ? formatKolkataTimestamp(new Date(row.session_started_at))
      : 'Unknown',
    lastSeenAtLabel: row.last_seen_at
      ? formatKolkataTimestamp(new Date(row.last_seen_at))
      : 'Unknown',
    lastSeenRelative: relativeFromNow(row.last_seen_at, nowMs),
  };
}

export async function buildLiveTelemetry(
  supabase: SupabaseClient,
  nowIso: string
): Promise<LiveTelemetryPayload> {
  const nowMs = new Date(nowIso).getTime();
  const activeCutoffIso = inactivityCutoffIso(new Date(nowIso));
  const activeCutoffMs = new Date(activeCutoffIso).getTime();

  const sessionColumns = [
    'id',
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
  ].join(',');

  const [
    { count: totalVisitors, error: visitorsError },
    { data: liveRows, error: liveError },
    { data: recentRows, error: recentError },
  ] = await Promise.all([
    supabase.from('visitors').select('id', { count: 'exact', head: true }),
    supabase
      .from('visitor_sessions')
      .select(sessionColumns)
      .is('session_ended_at', null)
      .gte('last_seen_at', activeCutoffIso)
      .order('last_seen_at', { ascending: false })
      .limit(50),
    supabase
      .from('visitor_sessions')
      .select(sessionColumns)
      .order('last_seen_at', { ascending: false })
      .limit(40),
  ]);

  if (visitorsError) throw visitorsError;
  if (liveError) throw liveError;
  if (recentError) throw recentError;

  const byId = new Map<string, SessionRow>();
  for (const row of (liveRows ?? []) as unknown as SessionRow[]) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of (recentRows ?? []) as unknown as SessionRow[]) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }

  const merged = [...byId.values()].sort((a, b) => {
    const aLive = isSessionLive(a, activeCutoffMs) ? 1 : 0;
    const bLive = isSessionLive(b, activeCutoffMs) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  const limited = merged.slice(0, 24);

  // Stable ordinals by start time among the visible list (not reshuffled by live sort).
  const chronological = [...limited].sort((a, b) => {
    const aTime = a.session_started_at
      ? new Date(a.session_started_at).getTime()
      : 0;
    const bTime = b.session_started_at
      ? new Date(b.session_started_at).getTime()
      : 0;
    return aTime - bTime;
  });
  const ordinalById = new Map<string, number>();
  chronological.forEach((row, index) => {
    ordinalById.set(row.id, index + 1);
  });

  const sessions = limited.map((row) =>
    toAnonymized(row, nowMs, activeCutoffMs, ordinalById.get(row.id) ?? 1)
  );

  const activeWatchers = ((liveRows ?? []) as unknown as SessionRow[]).filter(
    (row) => isSessionLive(row, activeCutoffMs)
  ).length;
  const watchingLabel =
    activeWatchers === 1
      ? '1 DEVICE CURRENTLY WATCHING'
      : `${activeWatchers} DEVICES CURRENTLY WATCHING`;

  // In this schema one visitor UUID ~= one anonymous device.
  const visitorTotal = totalVisitors ?? 0;

  return {
    timezone: 'Asia/Kolkata',
    updatedAt: nowIso,
    updatedAtLabel: formatKolkataTimestamp(new Date(nowIso)),
    overview: {
      totalVisitors: visitorTotal,
      uniqueDevices: visitorTotal,
      activeWatchers,
    },
    watchingLabel,
    sessions,
  };
}
