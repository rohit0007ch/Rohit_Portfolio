import { useEffect, useState } from 'react';
import { useVisitorTracking } from '../hooks/useVisitorTracking';
import { fetchLiveTelemetry } from '../lib/analytics/fetchLiveTelemetry';
import { fetchPublicAnalytics } from '../lib/analytics/fetchPublicAnalytics';
import type { AnalyticsRange, PublicAnalytics } from '../lib/analytics/types';
import { BarList, RankList, SparkLine } from './analytics/charts';
import './analytics/analytics.css';

const STATS_REFRESH_MS = 10_000;
const ACTIVE_REFRESH_MS = 5_000;

const RANGE_OPTIONS: Array<{ id: AnalyticsRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

const OVERVIEW_CARDS: Array<{
  key: keyof PublicAnalytics['overview'];
  label: string;
}> = [
  { key: 'totalVisitors', label: 'Total Visitors' },
  { key: 'uniqueVisitors', label: 'Unique Visitors' },
  { key: 'activeVisitors', label: 'Active Now' },
  { key: 'totalSessions', label: 'Sessions' },
  { key: 'totalPageViews', label: 'Page Views' },
  { key: 'resumeDownloads', label: 'Resume Downloads' },
];

function analyticsDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log('[AnalyticsDashboard]', ...args);
  }
}

function AnalyticsDashboard() {
  useVisitorTracking();

  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [data, setData] = useState<PublicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let statsInFlight: AbortController | null = null;
    let activeInFlight: AbortController | null = null;
    let statsTimer: number | null = null;
    let activeTimer: number | null = null;

    const clearTimers = () => {
      if (statsTimer != null) {
        window.clearInterval(statsTimer);
        statsTimer = null;
      }
      if (activeTimer != null) {
        window.clearInterval(activeTimer);
        activeTimer = null;
      }
    };

    const loadStats = async (isInitial: boolean) => {
      if (statsInFlight) {
        analyticsDebug('stats refresh skipped — request already in flight');
        return;
      }

      const controller = new AbortController();
      statsInFlight = controller;
      const startedAt = performance.now();
      analyticsDebug('stats refresh start', { range, isInitial });

      if (isInitial) {
        setLoading(true);
      }

      try {
        const payload = await fetchPublicAnalytics(range, controller.signal);
        if (cancelled) return;
        setData(payload);
        setError(null);
        analyticsDebug('stats refresh complete', {
          ms: Math.round(performance.now() - startedAt),
          overview: payload.overview,
        });
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        analyticsDebug('stats refresh error', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (statsInFlight === controller) {
          statsInFlight = null;
        }
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const loadActive = async () => {
      if (activeInFlight) {
        analyticsDebug('active refresh skipped — request already in flight');
        return;
      }

      const controller = new AbortController();
      activeInFlight = controller;
      const startedAt = performance.now();
      analyticsDebug('active refresh start');

      try {
        const live = await fetchLiveTelemetry(controller.signal);
        if (cancelled) return;

        const active = live.overview.activeWatchers;
        setData((prev) => {
          if (!prev) return prev;
          if (
            prev.overview.activeVisitors === active &&
            prev.live.activeVisitors === active &&
            prev.updatedAtLabel === live.updatedAtLabel
          ) {
            return prev;
          }
          return {
            ...prev,
            updatedAt: live.updatedAt,
            updatedAtLabel: live.updatedAtLabel,
            overview: {
              ...prev.overview,
              activeVisitors: active,
            },
            live: {
              ...prev.live,
              activeVisitors: active,
            },
          };
        });
        analyticsDebug('active refresh complete', {
          ms: Math.round(performance.now() - startedAt),
          activeWatchers: active,
        });
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        analyticsDebug('active refresh error', err);
        // Keep last good stats cards; active poll failures are non-fatal.
      } finally {
        if (activeInFlight === controller) {
          activeInFlight = null;
        }
      }
    };

    const startPolling = () => {
      clearTimers();
      statsTimer = window.setInterval(() => {
        void loadStats(false);
      }, STATS_REFRESH_MS);
      activeTimer = window.setInterval(() => {
        void loadActive();
      }, ACTIVE_REFRESH_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        analyticsDebug('tab hidden — pausing refresh');
        clearTimers();
        statsInFlight?.abort();
        activeInFlight?.abort();
        statsInFlight = null;
        activeInFlight = null;
        return;
      }

      analyticsDebug('tab visible — refreshing');
      void loadStats(false);
      void loadActive();
      startPolling();
    };

    void loadStats(true);
    void loadActive();
    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimers();
      statsInFlight?.abort();
      activeInFlight?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [range, refreshToken]);

  const isEmpty =
    !!data &&
    data.overview.totalVisitors === 0 &&
    data.overview.totalSessions === 0 &&
    data.overview.totalPageViews === 0 &&
    data.overview.resumeDownloads === 0;

  return (
    <div className="analytics-root">
      <div className="analytics-shell">
        <header className="analytics-topbar">
          <div className="analytics-brand">
            <div className="analytics-brand-kicker">
              <span className="analytics-live-dot" aria-hidden="true" />
              Public
            </div>
            <h1>Visitor analytics</h1>
            <p>Live portfolio traffic · Asia/Kolkata · no login</p>
          </div>
          <div className="analytics-top-actions">
            <a className="analytics-back" href="/">
              ← Back to portfolio
            </a>
            <div className="analytics-updated">
              Last updated:{' '}
              {data?.updatedAtLabel ?? '—'}
            </div>
          </div>
        </header>

        <div className="analytics-filters" role="tablist" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`analytics-filter${range === option.id ? ' is-active' : ''}`}
              onClick={() => setRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="analytics-loading-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="analytics-skeleton" />
            ))}
          </div>
        ) : null}

        {error && !data ? (
          <div className="analytics-state is-error">
            <div>{error}</div>
            <button type="button" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {error && data ? (
          <div className="analytics-state is-error" style={{ marginBottom: 16 }}>
            Live refresh issue: {error}
            <button type="button" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {data ? (
          <div className="analytics-grid">
            {isEmpty ? (
              <div className="analytics-state">
                No visitor activity recorded for this range yet.
              </div>
            ) : null}

            <section className="analytics-overview" aria-label="Overview">
              {OVERVIEW_CARDS.map((card) => (
                <article key={card.key} className="analytics-stat">
                  <span className="analytics-stat-label">{card.label}</span>
                  <div className="analytics-stat-value">
                    {data.overview[card.key].toLocaleString('en-IN')}
                  </div>
                </article>
              ))}
            </section>

            <section className="analytics-panel">
              <div className="analytics-panel-header">
                <h2>Live activity</h2>
                <span>Stats 10s · Active 5s</span>
              </div>
              <div className="analytics-live-grid">
                <div className="analytics-live-count">
                  <strong>{data.live.activeVisitors}</strong>
                  <span>Live now</span>
                </div>
                <div className="analytics-chart-card">
                  <h3>Visitors over time</h3>
                  <SparkLine data={data.live.visitorsOverTime} color="#c2a4ff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Page views over time</h3>
                  <SparkLine data={data.live.pageViewsOverTime} color="#fb8dff" />
                </div>
              </div>
            </section>

            <section className="analytics-panel">
              <div className="analytics-panel-header">
                <h2>Demographics</h2>
                <span>Aggregated only</span>
              </div>
              <div className="analytics-demo-grid">
                <div className="analytics-chart-card">
                  <h3>Country</h3>
                  <BarList items={data.demographics.countries} />
                </div>
                <div className="analytics-chart-card">
                  <h3>City</h3>
                  <BarList items={data.demographics.cities} color="#fb8dff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Browser</h3>
                  <BarList items={data.demographics.browsers} />
                </div>
                <div className="analytics-chart-card">
                  <h3>Operating system</h3>
                  <BarList items={data.demographics.operatingSystems} color="#fb8dff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Device type</h3>
                  <BarList items={data.demographics.deviceTypes} />
                </div>
                <div className="analytics-chart-card">
                  <h3>Screen resolution</h3>
                  <BarList
                    items={data.demographics.screenResolutions}
                    color="#fb8dff"
                  />
                </div>
              </div>
            </section>

            <div className="analytics-lower-grid">
              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Pages</h2>
                  <span>{data.pages.totalViews.toLocaleString('en-IN')} views</span>
                </div>
                <RankList items={data.pages.top} />
              </section>

              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Resume downloads</h2>
                  <span>
                    {data.resume.totalSuccessful.toLocaleString('en-IN')} successful
                  </span>
                </div>
                <div className="analytics-chart-card" style={{ marginBottom: 12 }}>
                  <h3>Download trends</h3>
                  <SparkLine data={data.resume.overTime} color="#7dffa6" />
                </div>
                <div className="analytics-chart-card">
                  <h3>By filename</h3>
                  <BarList items={data.resume.byFilename} color="#7dffa6" />
                </div>
              </section>

              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Privacy</h2>
                  <span>Public feed</span>
                </div>
                <p className="analytics-empty-inline" style={{ textAlign: 'left', padding: 0 }}>
                  Aggregated counts only. Visitor IDs, session IDs, IP hashes,
                  and browsing histories are never exposed.
                </p>
              </section>
            </div>
          </div>
        ) : null}

        <p className="analytics-footer-note">
          Live Supabase aggregates · Asia/Kolkata · {range.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
