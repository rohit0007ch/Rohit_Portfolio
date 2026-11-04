import { useEffect, useState } from 'react';
import { useVisitorTracking } from '../hooks/useVisitorTracking';
import { fetchPublicAnalytics } from '../lib/analytics/fetchPublicAnalytics';
import type { AnalyticsRange, PublicAnalytics } from '../lib/analytics/types';
import { BarList, RankList, SparkLine } from './analytics/charts';
import './analytics/analytics.css';

const REFRESH_MS = 10_000;

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

function AnalyticsDashboard() {
  useVisitorTracking();

  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [data, setData] = useState<PublicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async (isInitial: boolean) => {
      if (isInitial) {
        setLoading(true);
      }
      try {
        const payload = await fetchPublicAnalytics(range, controller.signal);
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
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
              Public Telemetry
            </div>
            <h1>Visitor Analytics</h1>
            <p>Live portfolio signals · Asia/Kolkata · no login required</p>
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
                <h2>Live Analytics</h2>
                <span>Auto-refresh 10s</span>
              </div>
              <div className="analytics-live-grid">
                <div className="analytics-live-count">
                  <strong>{data.live.activeVisitors}</strong>
                  <span>Live visitors</span>
                </div>
                <div className="analytics-chart-card">
                  <h3>Visitors over time</h3>
                  <SparkLine data={data.live.visitorsOverTime} color="#00f0ff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Page views over time</h3>
                  <SparkLine data={data.live.pageViewsOverTime} color="#b44dff" />
                </div>
              </div>
            </section>

            <section className="analytics-panel">
              <div className="analytics-panel-header">
                <h2>Visitor Demographics</h2>
                <span>Aggregated only</span>
              </div>
              <div className="analytics-demo-grid">
                <div className="analytics-chart-card">
                  <h3>Country</h3>
                  <BarList items={data.demographics.countries} />
                </div>
                <div className="analytics-chart-card">
                  <h3>City</h3>
                  <BarList items={data.demographics.cities} color="#00f0ff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Browser</h3>
                  <BarList items={data.demographics.browsers} />
                </div>
                <div className="analytics-chart-card">
                  <h3>Operating system</h3>
                  <BarList items={data.demographics.operatingSystems} color="#00f0ff" />
                </div>
                <div className="analytics-chart-card">
                  <h3>Device type</h3>
                  <BarList items={data.demographics.deviceTypes} />
                </div>
                <div className="analytics-chart-card">
                  <h3>Screen resolution</h3>
                  <BarList items={data.demographics.screenResolutions} color="#00f0ff" />
                </div>
              </div>
            </section>

            <div className="analytics-lower-grid">
              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Page Analytics</h2>
                  <span>{data.pages.totalViews.toLocaleString('en-IN')} views</span>
                </div>
                <RankList items={data.pages.top} />
              </section>

              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Resume Analytics</h2>
                  <span>
                    {data.resume.totalSuccessful.toLocaleString('en-IN')} successful
                  </span>
                </div>
                <div className="analytics-chart-card" style={{ marginBottom: 12 }}>
                  <h3>Download trends</h3>
                  <SparkLine data={data.resume.overTime} color="#3dff9a" />
                </div>
                <div className="analytics-chart-card">
                  <h3>By filename</h3>
                  <BarList items={data.resume.byFilename} color="#3dff9a" />
                </div>
              </section>

              <section className="analytics-panel">
                <div className="analytics-panel-header">
                  <h2>Signal Health</h2>
                  <span>Public feed</span>
                </div>
                <div className="analytics-chart-card">
                  <h3>Privacy</h3>
                  <p className="analytics-empty-inline" style={{ textAlign: 'left' }}>
                    This dashboard exposes aggregated counts only. Visitor IDs,
                    session IDs, IP hashes, and individual browsing histories are
                    never returned by the public API.
                  </p>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        <p className="analytics-footer-note">
          TELEMETRY NODE · REAL SUPABASE AGGREGATES · RANGE {range.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
