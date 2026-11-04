import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AnalyticsRange,
  type TimeBucket,
  buildEmptyBuckets,
  bucketGranularity,
  rangeStartUtc,
  timeBucketKey,
} from './analyticsRange.js';
import { inactivityCutoffIso } from './sessions.js';

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;
const TOP_LIMIT = 12;

interface VisitorRow {
  first_seen_at: string | null;
}

interface SessionRow {
  visitor_id: string | null;
  session_started_at: string | null;
  last_seen_at: string | null;
  session_ended_at: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  screen_resolution: string | null;
}

interface PageViewRow {
  page_path: string;
  viewed_at: string | null;
}

interface ResumeRow {
  filename: string | null;
  downloaded_at: string | null;
  download_status: string | null;
}

export interface NamedCount {
  label: string;
  count: number;
}

export interface TimePoint {
  t: string;
  count: number;
}

export interface PublicAnalyticsPayload {
  range: AnalyticsRange;
  timezone: string;
  updatedAt: string;
  updatedAtLabel: string;
  overview: {
    totalVisitors: number;
    uniqueVisitors: number;
    activeVisitors: number;
    totalSessions: number;
    totalPageViews: number;
    resumeDownloads: number;
  };
  live: {
    activeVisitors: number;
    visitorsOverTime: TimePoint[];
    pageViewsOverTime: TimePoint[];
  };
  demographics: {
    countries: NamedCount[];
    cities: NamedCount[];
    browsers: NamedCount[];
    operatingSystems: NamedCount[];
    deviceTypes: NamedCount[];
    screenResolutions: NamedCount[];
  };
  pages: {
    totalViews: number;
    top: Array<{ path: string; views: number }>;
  };
  resume: {
    totalSuccessful: number;
    byFilename: NamedCount[];
    overTime: TimePoint[];
  };
}

async function fetchPaged<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  applyFilters: (query: any) => any
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (from < MAX_ROWS) {
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from(table).select(columns).range(from, to);
    query = applyFilters(query);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

function countBy(
  values: Array<string | null | undefined>,
  limit = TOP_LIMIT
): NamedCount[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = (raw ?? '').trim() || 'Unknown';
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function seriesFromTimestamps(
  timestamps: string[],
  range: AnalyticsRange,
  bucket: TimeBucket,
  now: Date
): TimePoint[] {
  const counts = new Map<string, number>();
  for (const iso of timestamps) {
    const key = timeBucketKey(iso, bucket);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const empty = buildEmptyBuckets(range, now);
  if (empty.length > 0) {
    return empty.map((t) => ({ t, count: counts.get(t) ?? 0 }));
  }

  // all-time: only buckets that have data, sorted
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, count]) => ({ t, count }));
}

function inRange(iso: string | null | undefined, start: Date | null): boolean {
  if (!iso) return false;
  if (!start) return true;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= start.getTime();
}

export async function buildPublicAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  updatedAtLabel: string
): Promise<PublicAnalyticsPayload> {
  const now = new Date();
  const start = rangeStartUtc(range, now);
  const startIso = start?.toISOString() ?? null;
  const bucket = bucketGranularity(range);
  const activeCutoff = inactivityCutoffIso(now);

  const visitorFilter = (q: any) =>
    startIso ? q.gte('first_seen_at', startIso) : q;

  const sessionFilter = (q: any) =>
    startIso ? q.gte('session_started_at', startIso) : q;

  const pageFilter = (q: any) =>
    startIso ? q.gte('viewed_at', startIso) : q;

  const resumeFilter = (q: any) => {
    let next = q.eq('download_status', 'success');
    if (startIso) {
      next = next.gte('downloaded_at', startIso);
    }
    return next;
  };

  const [visitors, sessions, pageViews, resumes, activeSessions] =
    await Promise.all([
      fetchPaged<VisitorRow>(
        supabase,
        'visitors',
        'first_seen_at',
        visitorFilter
      ),
      fetchPaged<SessionRow>(
        supabase,
        'visitor_sessions',
        [
          'visitor_id',
          'session_started_at',
          'last_seen_at',
          'session_ended_at',
          'country',
          'city',
          'browser',
          'operating_system',
          'device_type',
          'screen_resolution',
        ].join(','),
        sessionFilter
      ),
      fetchPaged<PageViewRow>(
        supabase,
        'page_views',
        'page_path,viewed_at',
        pageFilter
      ),
      fetchPaged<ResumeRow>(
        supabase,
        'resume_downloads',
        'filename,downloaded_at,download_status',
        resumeFilter
      ),
      // Live active is always current (not filtered by dashboard date range).
      supabase
        .from('visitor_sessions')
        .select('visitor_id')
        .is('session_ended_at', null)
        .gte('last_seen_at', activeCutoff)
        .limit(PAGE_SIZE),
    ]);

  if (activeSessions.error) {
    throw activeSessions.error;
  }

  const activeVisitorIds = new Set(
    (activeSessions.data ?? [])
      .map((row) => row.visitor_id)
      .filter((id): id is string => Boolean(id))
  );

  const uniqueVisitorIds = new Set(
    sessions
      .map((s) => s.visitor_id)
      .filter((id): id is string => Boolean(id))
  );

  const pathCounts = new Map<string, number>();
  for (const row of pageViews) {
    const path = (row.page_path || '/').trim() || '/';
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }

  const topPages = [...pathCounts.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, TOP_LIMIT);

  const visitorSeries = seriesFromTimestamps(
    sessions
      .map((s) => s.session_started_at)
      .filter((v): v is string => Boolean(v)),
    range,
    bucket,
    now
  );

  const pageSeries = seriesFromTimestamps(
    pageViews
      .map((p) => p.viewed_at)
      .filter((v): v is string => Boolean(v)),
    range,
    bucket,
    now
  );

  const resumeSeries = seriesFromTimestamps(
    resumes
      .map((r) => r.downloaded_at)
      .filter((v): v is string => Boolean(v)),
    range,
    bucket,
    now
  );

  // Guard: only count in-range rows (extra safety if filters drift).
  const rangedSessions = sessions.filter((s) =>
    inRange(s.session_started_at, start)
  );

  return {
    range,
    timezone: 'Asia/Kolkata',
    updatedAt: now.toISOString(),
    updatedAtLabel,
    overview: {
      totalVisitors: visitors.length,
      uniqueVisitors: uniqueVisitorIds.size,
      activeVisitors: activeVisitorIds.size,
      totalSessions: rangedSessions.length,
      totalPageViews: pageViews.length,
      resumeDownloads: resumes.length,
    },
    live: {
      activeVisitors: activeVisitorIds.size,
      visitorsOverTime: visitorSeries,
      pageViewsOverTime: pageSeries,
    },
    demographics: {
      countries: countBy(rangedSessions.map((s) => s.country)),
      cities: countBy(rangedSessions.map((s) => s.city)),
      browsers: countBy(rangedSessions.map((s) => s.browser)),
      operatingSystems: countBy(rangedSessions.map((s) => s.operating_system)),
      deviceTypes: countBy(rangedSessions.map((s) => s.device_type)),
      screenResolutions: countBy(rangedSessions.map((s) => s.screen_resolution)),
    },
    pages: {
      totalViews: pageViews.length,
      top: topPages,
    },
    resume: {
      totalSuccessful: resumes.length,
      byFilename: countBy(resumes.map((r) => r.filename)),
      overTime: resumeSeries,
    },
  };
}
