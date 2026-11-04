export type AnalyticsRange = 'today' | '7d' | '30d' | 'all';

export const ANALYTICS_TIMEZONE = 'Asia/Kolkata';

const VALID_RANGES: AnalyticsRange[] = ['today', '7d', '30d', 'all'];

export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  if (typeof value === 'string' && VALID_RANGES.includes(value as AnalyticsRange)) {
    return value as AnalyticsRange;
  }
  return '7d';
}

/** Calendar date YYYY-MM-DD in Asia/Kolkata. */
export function kolkataDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Start of "today" in Asia/Kolkata as a UTC Date. */
export function startOfTodayKolkata(now = new Date()): Date {
  const day = kolkataDateString(now);
  return new Date(`${day}T00:00:00+05:30`);
}

/**
 * Inclusive lower bound for the selected range in UTC, or null for all-time.
 */
export function rangeStartUtc(
  range: AnalyticsRange,
  now = new Date()
): Date | null {
  if (range === 'all') {
    return null;
  }

  const todayStart = startOfTodayKolkata(now);

  if (range === 'today') {
    return todayStart;
  }

  const days = range === '7d' ? 6 : 29;
  return new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
}

export type TimeBucket = 'hour' | 'day';

export function bucketGranularity(range: AnalyticsRange): TimeBucket {
  return range === 'today' ? 'hour' : 'day';
}

/** Bucket key in Asia/Kolkata local time. */
export function timeBucketKey(iso: string, bucket: TimeBucket): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  if (bucket === 'hour') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: ANALYTICS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`;
  }

  return kolkataDateString(date);
}

export function buildEmptyBuckets(
  range: AnalyticsRange,
  now = new Date()
): string[] {
  const keys: string[] = [];

  if (range === 'today') {
    const day = kolkataDateString(now);
    const currentHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: ANALYTICS_TIMEZONE,
        hour: 'numeric',
        hour12: false,
      }).format(now)
    );
    for (let h = 0; h <= currentHour; h += 1) {
      keys.push(`${day}T${String(h).padStart(2, '0')}:00`);
    }
    return keys;
  }

  if (range === 'all') {
    return keys;
  }

  const days = range === '7d' ? 7 : 30;
  const today = startOfTodayKolkata(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(kolkataDateString(d));
  }
  return keys;
}

export function formatKolkataTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}
