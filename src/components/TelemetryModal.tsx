import { useEffect, useRef, useState } from 'react';
import { fetchLiveTelemetry } from '../lib/analytics/fetchLiveTelemetry';
import type {
  AnonymizedSession,
  LiveTelemetry,
} from '../lib/analytics/liveTypes';
import './styles/TelemetryModal.css';

const REFRESH_MS = 3_000;

interface TelemetryModalProps {
  open: boolean;
  onClose: () => void;
}

function browserLabel(session: AnonymizedSession): string {
  const name = session.browser === 'Unknown' ? 'Unknown Browser' : session.browser;
  if (session.browserVersion !== 'Unknown') {
    return `${name}`;
  }
  return name;
}

function cityPostalLabel(session: AnonymizedSession): string {
  const cityCountry = session.locationLabel;
  if (session.postalCode !== 'Unknown') {
    return `${cityCountry} (${session.postalCode})`;
  }
  return cityCountry;
}

const TelemetryModal = ({ open, onClose }: TelemetryModalProps) => {
  const [data, setData] = useState<LiveTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const selectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
    if (!open) return;

    let cancelled = false;
    let inFlight: AbortController | null = null;

    const load = async (isInitial: boolean) => {
      inFlight?.abort();
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
        if (!cancelled) setLoading(false);
      }
    };

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      inFlight?.abort();
      window.clearInterval(timer);
    };
  }, [open, retryToken]);

  if (!open) return null;

  const visibleSessions = data?.sessions.slice(0, 6) ?? [];
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
        <div className="telemetry-modal-scroll">
          <header className="telemetry-header">
            <h2 className="telemetry-title">
              <span className="telemetry-pulse" aria-hidden="true" />
              Real-Time Visitor Telemetry
            </h2>
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
              <div className="telemetry-banner">
                <p className="telemetry-banner-text">{data.watchingLabel}</p>
                <div className="telemetry-live-pill">
                  <span className="telemetry-live-pill-dot" aria-hidden="true" />
                  Live Now
                </div>
              </div>

              <div className="telemetry-stats">
                <article className="telemetry-stat">
                  <strong>{data.overview.totalVisitors}</strong>
                  <span>Total Visits</span>
                </article>
                <article className="telemetry-stat">
                  <strong>{data.overview.uniqueDevices}</strong>
                  <span>Unique Devices</span>
                </article>
                <article className="telemetry-stat is-live">
                  <strong>{data.overview.activeWatchers}</strong>
                  <span>Active Watchers</span>
                  <span className="telemetry-stat-live-sub">
                    {data.overview.activeWatchers} Live
                  </span>
                </article>
              </div>

              <div className="telemetry-body">
                <section className="telemetry-panel">
                  <h3>Active &amp; Recorded Sessions</h3>
                  {visibleSessions.length === 0 ? (
                    <div className="telemetry-state">No sessions yet</div>
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
                              <strong>{session.label}</strong>
                              <span>{session.deviceType}</span>
                            </div>
                            <span
                              className={`telemetry-badge ${
                                session.isLive ? 'is-live' : 'is-idle'
                              }`}
                            >
                              {session.isLive ? 'Live' : 'Idle'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="telemetry-panel">
                  <h3>
                    {selected
                      ? `Inspecting: ${selected.label}`
                      : 'Session details'}
                  </h3>
                  {!selected ? (
                    <div className="telemetry-state">Select a session</div>
                  ) : (
                    <>
                      <div className="telemetry-details-grid">
                        <div className="telemetry-detail">
                          <span>IPv4 Address</span>
                          <strong>Protected</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>City &amp; Postal</span>
                          <strong>{cityPostalLabel(selected)}</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>Device &amp; Operating System</span>
                          <strong>
                            {selected.deviceType} / {selected.operatingSystem}
                          </strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>Network Provider</span>
                          <strong>Unavailable</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>Browser</span>
                          <strong>{browserLabel(selected)}</strong>
                        </div>
                      </div>
                      <div className="telemetry-detail-footer">
                        <span
                          className={
                            selected.isLive
                              ? 'telemetry-status-live'
                              : 'telemetry-status-idle'
                          }
                        >
                          <span className="telemetry-pulse" aria-hidden="true" />
                          Current Status: {selected.isLive ? 'Live' : 'Idle'}
                        </span>
                        <span>
                          {selected.lastSeenRelative}
                          <span className="telemetry-footer-abs">
                            {' '}
                            · {selected.lastSeenAtLabel}
                          </span>
                        </span>
                      </div>
                    </>
                  )}
                </section>
              </div>

              <div className="telemetry-link-row">
                <span className="telemetry-updated">
                  Updated {data.updatedAtLabel} · live refresh 3s
                  {error ? ' · last refresh failed' : ''}
                </span>
                <a className="telemetry-full-link" href="/analytics">
                  Open full analytics →
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TelemetryModal;
