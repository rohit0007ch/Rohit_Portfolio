import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AnalyticsRange,
  type TimeBucket,
  buildEmptyBuckets,
  bucketGranularity,
  rangeStartUtc,
  timeBucketKey,
} from './analyticsRange.js';
import { normalizeGeoLabel } from './geo.js';
import { inactivityCutoffIso } from './sessions.js';

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;
const TOP_LIMIT = 12;

interface VisitorRow {
  first_seen_at: string | null;
  last_seen_at: string | null;
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
  applyFilters: (query: any) => any,
  orderColumn: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (from < MAX_ROWS) {
    const to = from + PAGE_SIZE - 1;
    // ORDER BY is required for deterministic range pagination.
    let query = supabase
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, to);
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
  limit = TOP_LIMIT,
  normalize = false
): NamedCount[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = normalize
      ? normalizeGeoLabel(raw) || 'Unknown'
      : (raw ?? '').trim() || 'Unknown';
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

/** Distinct visitor IDs per time bucket (not sessions / page views). */
function seriesFromUniqueVisitors(
  rows: Array<{ visitorId: string | null; at: string | null }>,
  range: AnalyticsRange,
  bucket: TimeBucket,
  now: Date
): TimePoint[] {
  const sets = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.at || !row.visitorId) continue;
    const key = timeBucketKey(row.at, bucket);
    let set = sets.get(key);
    if (!set) {
      set = new Set<string>();
      sets.set(key, set);
    }
    set.add(row.visitorId);
  }

  const empty = buildEmptyBuckets(range, now);
  if (empty.length > 0) {
    return empty.map((t) => ({ t, count: sets.get(t)?.size ?? 0 }));
  }

  return [...sets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, set]) => ({ t, count: set.size }));
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

  // Visitors active in-range: last_seen_at (NOT first_seen_at).
  // first_seen_at undercounts returning visitors (e.g. today=0 while sessions>0).
  const visitorFilter = (q: any) =>
    startIso ? q.gte('last_seen_at', startIso) : q;

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
        'first_seen_at,last_seen_at',
        visitorFilter,
        'id'
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
        sessionFilter,
        'id'
      ),
      fetchPaged<PageViewRow>(
        supabase,
        'page_views',
        'page_path,viewed_at',
        pageFilter,
        'id'
      ),
      fetchPaged<ResumeRow>(
        supabase,
        'resume_downloads',
        'filename,downloaded_at,download_status',
        resumeFilter,
        'id'
      ),
      // Live active is always current (not filtered by dashboard date range).
      // Ended sessions excluded; 60s inactivity via last_seen_at.
      supabase
        .from('visitor_sessions')
        .select('visitor_id')
        .is('session_ended_at', null)
        .gte('last_seen_at', activeCutoff)
        .order('id', { ascending: true })
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

  // Unique visitors = distinct visitor IDs with sessions in range.
  const totalVisitors = uniqueVisitorIds.size;

  const pathCounts = new Map<string, number>();
  for (const row of pageViews) {
    const path = (row.page_path || '/').trim() || '/';
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }

  const topPages = [...pathCounts.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, TOP_LIMIT);

  const visitorSeries = seriesFromUniqueVisitors(
    sessions.map((s) => ({
      visitorId: s.visitor_id,
      at: s.session_started_at,
    })),
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

  const payload: PublicAnalyticsPayload = {
    range,
    timezone: 'Asia/Kolkata',
    updatedAt: now.toISOString(),
    updatedAtLabel,
    overview: {
      totalVisitors,
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
      countries: countBy(
        rangedSessions.map((s) => s.country),
        TOP_LIMIT,
        true
      ),
      cities: countBy(rangedSessions.map((s) => s.city), TOP_LIMIT, true),
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

  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ANALYTICS_DEBUG === '1'
  ) {
    console.log('[analyticsAggregate] computed', {
      range,
      startIso,
      activeCutoff,
      rows: {
        visitors: visitors.length,
        sessions: sessions.length,
        pageViews: pageViews.length,
        resumes: resumes.length,
        activeSessionRows: activeSessions.data?.length ?? 0,
      },
      overview: payload.overview,
    });
  }

  return payload;
}
