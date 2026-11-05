import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLiveTelemetry } from '../lib/analytics/fetchLiveTelemetry';
import type {
  AnonymizedSession,
  LiveTelemetry,
} from '../lib/analytics/liveTypes';
import './styles/TelemetryModal.css';

const REFRESH_MS = 5_000;

interface TelemetryModalProps {
  open: boolean;
  onClose: () => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  India: '🇮🇳',
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  Canada: '🇨🇦',
  Australia: '🇦🇺',
  Germany: '🇩🇪',
  France: '🇫🇷',
  'United Arab Emirates': '🇦🇪',
  Singapore: '🇸🇬',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  China: '🇨🇳',
  Brazil: '🇧🇷',
  Netherlands: '🇳🇱',
  Sweden: '🇸🇪',
  Switzerland: '🇨🇭',
  Ireland: '🇮🇪',
  'New Zealand': '🇳🇿',
  Pakistan: '🇵🇰',
  Bangladesh: '🇧🇩',
  Nepal: '🇳🇵',
  'Sri Lanka': '🇱🇰',
};

function browserLabel(session: AnonymizedSession): string {
  const name = session.browser === 'Unknown' ? 'Unknown' : session.browser;
  if (session.browserVersion !== 'Unknown') {
    return `${name} ${session.browserVersion}`;
  }
  return name;
}

function cityPostalLabel(session: AnonymizedSession): string {
  const city = session.city !== 'Unknown' ? session.city : null;
  const postal =
    session.postalCode !== 'Unknown' ? session.postalCode : null;
  if (city && postal) return `${city} (${postal})`;
  if (city) return city;
  if (postal) return postal;
  return session.locationLabel;
}

function regionCountryLabel(session: AnonymizedSession): string {
  const region = session.region !== 'Unknown' ? session.region : null;
  const country = session.country !== 'Unknown' ? session.country : null;
  if (region && country) return `${region}, ${country}`;
  return region || country || 'Unavailable';
}

function idleBadge(session: AnonymizedSession): string {
  if (session.isLive) return 'Live';
  const relative = session.lastSeenRelative;
  if (relative.endsWith('s ago')) return relative.replace(' ago', '');
  if (relative.endsWith('m ago')) {
    return `${relative.replace('m ago', '').padStart(2, '0')}m`;
  }
  if (relative.endsWith('h ago')) return relative.replace(' ago', '');
  return 'Idle';
}

function countryFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🌐';
}

const TelemetryModal = ({ open, onClose }: TelemetryModalProps) => {
  const [data, setData] = useState<LiveTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [openedAtMs, setOpenedAtMs] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const selectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    if (!open) {
      setOpenedAtMs(null);
      setElapsedSec(0);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setOpenedAtMs(Date.now());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || openedAtMs == null) return;
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - openedAtMs) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [open, openedAtMs]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let inFlight: AbortController | null = null;
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const load = async (isInitial: boolean) => {
      if (inFlight) return;

      const controller = new AbortController();
      inFlight = controller;
      if (isInitial) setLoading(true);

      try {
        const payload = await fetchLiveTelemetry(controller.signal);
        if (cancelled) return;

        setData(payload);
        setError(null);

        const currentKey = selectedKeyRef.current;
        const stillExists = payload.sessions.some(
          (session) => session.sessionKey === currentKey
        );
        if (!stillExists) {
          const nextKey =
            payload.sessions.find((session) => session.isLive)?.sessionKey ??
            payload.sessions[0]?.sessionKey ??
            null;
          selectedKeyRef.current = nextKey;
          setSelectedKey(nextKey);
        }
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load telemetry');
      } finally {
        if (inFlight === controller) inFlight = null;
        if (!cancelled) setLoading(false);
      }
    };

    const startPolling = () => {
      clearTimer();
      timer = window.setInterval(() => {
        void load(false);
      }, REFRESH_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer();
        inFlight?.abort();
        inFlight = null;
        return;
      }
      void load(false);
      startPolling();
    };

    void load(true);
    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      inFlight?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [open, retryToken]);

  const activeSessionClock = useMemo(() => {
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }, [elapsedSec]);

  if (!open) return null;

  const visibleSessions = data?.sessions.slice(0, 6) ?? [];
  const selected: AnonymizedSession | null =
    visibleSessions.find((session) => session.sessionKey === selectedKey) ??
    visibleSessions[0] ??
    null;

  const detailRows = selected
    ? [
        { label: 'IP address', value: 'Protected' },
        { label: 'City & postal', value: cityPostalLabel(selected) },
        {
          label: 'Device & OS',
          value: `${selected.deviceType} · ${selected.operatingSystem}`,
        },
        { label: 'State & region', value: regionCountryLabel(selected) },
        { label: 'Browser', value: browserLabel(selected) },
        {
          label: 'Display & timezone',
          value: `${selected.screenResolution} · ${selected.timezone}`,
        },
        {
          label: 'Session status',
          value: `${selected.startedAtLabel} · ${
            selected.isLive ? 'Active now' : 'Idle'
          }`,
        },
      ]
    : [];

  return (
    <div
      className="telemetry-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="telemetry-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Real-time visitor telemetry"
        data-cursor="disable"
      >
        <header className="telemetry-topbar">
          <div className="telemetry-brand">
            <div className="telemetry-brand-kicker">
              <span className="telemetry-live-dot" aria-hidden="true" />
              Public
            </div>
            <h2>Visitor telemetry</h2>
            <p>Live portfolio traffic · Asia/Kolkata</p>
          </div>
          <button
            type="button"
            className="telemetry-close"
            aria-label="Close telemetry"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {loading && !data ? (
          <div className="telemetry-state">Loading…</div>
        ) : null}

        {error && !data ? (
          <div className="telemetry-state is-error">
            <div>{error}</div>
            <button type="button" onClick={() => setRetryToken((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {data ? (
          <div className="telemetry-grid">
            <section className="telemetry-panel telemetry-watch-panel">
              <div className="telemetry-panel-header">
                <h3>Live activity</h3>
                <span>Refresh 5s</span>
              </div>
              <div className="telemetry-watch-row">
                <div className="telemetry-live-count">
                  <strong>{data.overview.activeWatchers}</strong>
                  <span>Live now</span>
                </div>
                <div className="telemetry-watch-copy">
                  <strong>{data.watchingLabel}</strong>
                  <span>
                    Session {activeSessionClock} · {data.updatedAtLabel}
                  </span>
                </div>
              </div>
            </section>

            <section className="telemetry-overview" aria-label="Overview">
              <article className="telemetry-stat">
                <span className="telemetry-stat-label">Total visitors</span>
                <div className="telemetry-stat-value">
                  {data.overview.totalVisitors.toLocaleString('en-IN')}
                </div>
              </article>
              <article className="telemetry-stat">
                <span className="telemetry-stat-label">Unique devices</span>
                <div className="telemetry-stat-value">
                  {data.overview.uniqueDevices.toLocaleString('en-IN')}
                </div>
              </article>
              <article className="telemetry-stat is-live">
                <span className="telemetry-stat-label">Active watchers</span>
                <div className="telemetry-stat-value">
                  {data.overview.activeWatchers.toLocaleString('en-IN')}
                </div>
              </article>
            </section>

            <section className="telemetry-panel">
              <div className="telemetry-panel-header">
                <h3>Sessions</h3>
                <span>Aggregated only</span>
              </div>
              {visibleSessions.length === 0 ? (
                <div className="telemetry-state compact">No sessions yet</div>
              ) : (
                <ul className="telemetry-session-list">
                  {visibleSessions.map((session) => (
                    <li key={session.sessionKey}>
                      <button
                        type="button"
                        className={`telemetry-session-item${
                          selected?.sessionKey === session.sessionKey
                            ? ' is-selected'
                            : ''
                        }`}
                        onClick={() => {
                          selectedKeyRef.current = session.sessionKey;
                          setSelectedKey(session.sessionKey);
                        }}
                      >
                        <div className="telemetry-session-meta">
                          <strong>
                            {session.label}
                            <span> · {session.deviceType}</span>
                          </strong>
                          <em>
                            {countryFlag(session.country)} {session.locationLabel}
                          </em>
                        </div>
                        <span
                          className={`telemetry-badge ${
                            session.isLive ? 'is-live' : 'is-idle'
                          }`}
                        >
                          {idleBadge(session)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="telemetry-panel">
              <div className="telemetry-panel-header">
                <h3>
                  {selected ? `${selected.label} details` : 'Session details'}
                </h3>
                <span>Public feed</span>
              </div>
              {!selected ? (
                <div className="telemetry-state compact">Select a session</div>
              ) : (
                <div className="telemetry-details-grid">
                  {detailRows.map((row) => (
                    <article key={row.label} className="telemetry-detail-card">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <footer className="telemetry-footer">
              <span>
                Live Supabase aggregates
                {error ? ' · refresh failed' : ''}
              </span>
              <a className="telemetry-full-link" href="/analytics">
                Full analytics →
              </a>
            </footer>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TelemetryModal;
