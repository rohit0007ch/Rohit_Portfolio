import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLiveTelemetry } from '../lib/analytics/fetchLiveTelemetry';
import type {
  AnonymizedSession,
  LiveTelemetry,
} from '../lib/analytics/liveTypes';
import './styles/TelemetryModal.css';

/** Fast poll so live watcher counts feel real-time. */
const REFRESH_MS = 3_000;

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
  const name =
    session.browser === 'Unknown' ? 'Unknown Browser' : session.browser;
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
  if (region && country) return `${region} (${country})`;
  return region || country || 'Unavailable';
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

  const visibleSessions = data?.sessions.slice(0, 8) ?? [];
  const selected: AnonymizedSession | null =
    visibleSessions.find((session) => session.sessionKey === selectedKey) ??
    visibleSessions[0] ??
    null;

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
        <header className="telemetry-modal-header">
          <div className="telemetry-header-status">
            <span className="telemetry-pulse" aria-hidden="true" />
            <span className="telemetry-header-title">
              Real-Time Visitor Telemetry
            </span>
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
          <div className="telemetry-state">Syncing live signals…</div>
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
          <>
            <div className="telemetry-benchmark">
              <span aria-hidden="true">⚡</span>
              <span>
                Tracking Active Since:{' '}
                <strong>
                  {data.trackingStartedLabel ?? data.updatedAtLabel}
                </strong>
              </span>
            </div>

            <div className="telemetry-watching-banner">
              <div className="telemetry-watching-indicator" aria-hidden="true">
                <span className="telemetry-radar-wave" />
                <span className="telemetry-radar-core" />
              </div>
              <div className="telemetry-watching-details">
                <div className="telemetry-watching-title">
                  {data.watchingLabel}
                </div>
                <div className="telemetry-watching-meta">
                  Active Session: <strong>{activeSessionClock}</strong>
                  {' · '}
                  Server: <strong>{data.updatedAtLabel}</strong>
                </div>
              </div>
              <span className="telemetry-live-tag">Live Now</span>
            </div>

            <div className="telemetry-metrics">
              <article className="telemetry-metric">
                <span className="telemetry-metric-label">Total Visitor Count</span>
                <strong className="telemetry-metric-value">
                  {data.overview.totalVisitors}
                </strong>
                <span className="telemetry-metric-sub">Synced live sessions</span>
              </article>
              <article className="telemetry-metric">
                <span className="telemetry-metric-label">Unique Devices</span>
                <strong className="telemetry-metric-value">
                  {data.overview.uniqueDevices}
                </strong>
                <span className="telemetry-metric-sub">
                  Distinct hardware devices
                </span>
              </article>
              <article className="telemetry-metric is-live">
                <span className="telemetry-metric-label">Active Watchers</span>
                <strong className="telemetry-metric-value">
                  {data.overview.activeWatchers}{' '}
                  <em>Live</em>
                </strong>
                <span className="telemetry-metric-sub">Simultaneous users</span>
              </article>
            </div>

            <section className="telemetry-selector">
              <div className="telemetry-selector-header">
                <h3>Active &amp; Recorded Sessions</h3>
                <span>Click to inspect device</span>
              </div>
              {visibleSessions.length === 0 ? (
                <div className="telemetry-state compact">No sessions yet</div>
              ) : (
                <div className="telemetry-pills">
                  {visibleSessions.map((session) => (
                    <button
                      key={session.sessionKey}
                      type="button"
                      className={`telemetry-pill${
                        selected?.sessionKey === session.sessionKey
                          ? ' is-selected'
                          : ''
                      }${session.isLive ? ' is-live' : ''}`}
                      onClick={() => {
                        selectedKeyRef.current = session.sessionKey;
                        setSelectedKey(session.sessionKey);
                      }}
                    >
                      <span className="telemetry-pill-flag" aria-hidden="true">
                        {countryFlag(session.country)}
                      </span>
                      <span className="telemetry-pill-copy">
                        <strong>{session.label}</strong>
                        <em>{session.locationLabel}</em>
                      </span>
                      <span
                        className={`telemetry-pill-badge ${
                          session.isLive ? 'is-live' : 'is-idle'
                        }`}
                      >
                        {session.isLive ? 'LIVE' : 'SEEN'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="telemetry-inspect">
              <div className="telemetry-inspect-header">
                <h3>
                  Inspecting:{' '}
                  <span>{selected ? selected.label : '—'}</span>
                </h3>
              </div>
              {!selected ? (
                <div className="telemetry-state compact">Select a session</div>
              ) : (
                <div className="telemetry-detail-grid">
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      🌐
                    </span>
                    <div>
                      <span className="telemetry-detail-label">IPv4 Address</span>
                      <strong>Protected</strong>
                    </div>
                  </div>
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      📍
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        State / Region
                      </span>
                      <strong>{regionCountryLabel(selected)}</strong>
                    </div>
                  </div>
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      🏙️
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        City &amp; Postal
                      </span>
                      <strong>{cityPostalLabel(selected)}</strong>
                    </div>
                  </div>
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      💻
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        Browser &amp; Engine
                      </span>
                      <strong>{browserLabel(selected)}</strong>
                    </div>
                  </div>
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      📱
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        Device &amp; Operating System
                      </span>
                      <strong>
                        {selected.deviceType} ({selected.operatingSystem})
                      </strong>
                    </div>
                  </div>
                  <div className="telemetry-detail">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      🖥️
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        Resolution &amp; Timezone
                      </span>
                      <strong>
                        {selected.screenResolution} · {selected.timezone}
                      </strong>
                    </div>
                  </div>
                  <div className="telemetry-detail is-wide">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      ⚡
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        Network Provider &amp; ISP
                      </span>
                      <strong>Unavailable</strong>
                    </div>
                  </div>
                  <div className="telemetry-detail is-wide">
                    <span className="telemetry-detail-icon" aria-hidden="true">
                      🕒
                    </span>
                    <div>
                      <span className="telemetry-detail-label">
                        Session Timestamp &amp; Status
                      </span>
                      <strong>
                        {selected.startedAtLabel} (
                        {selected.isLive ? 'Active Now' : 'Completed'})
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <footer className="telemetry-modal-footer">
              🟢 Real-time synchronized telemetry · Asia/Kolkata
              {error ? ' · last refresh failed' : ''}
              {' · '}
              <a href="/analytics">Open full analytics</a>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default TelemetryModal;
