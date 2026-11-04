import { useEffect, useState } from 'react';
import { fetchLiveTelemetry } from '../lib/analytics/fetchLiveTelemetry';
import type {
  AnonymizedSession,
  LiveTelemetry,
} from '../lib/analytics/liveTypes';
import './styles/TelemetryModal.css';

const REFRESH_MS = 8_000;

interface TelemetryModalProps {
  open: boolean;
  onClose: () => void;
}

function locationLabel(session: AnonymizedSession): string {
  const city = session.city !== 'Unknown' ? session.city : null;
  const country = session.country !== 'Unknown' ? session.country : null;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return 'Location unavailable';
}

const TelemetryModal = ({ open, onClose }: TelemetryModalProps) => {
  const [data, setData] = useState<LiveTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

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

    const controller = new AbortController();
    let cancelled = false;

    const load = async (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      try {
        const payload = await fetchLiveTelemetry(controller.signal);
        if (cancelled) return;
        setData(payload);
        setError(null);
        setSelectedIndex((current) => {
          if (!payload.sessions.length) return 0;
          return Math.min(current, payload.sessions.length - 1);
        });
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
      controller.abort();
      window.clearInterval(timer);
    };
  }, [open, retryToken]);

  if (!open) return null;

  const selected: AnonymizedSession | null =
    data?.sessions[selectedIndex] ?? data?.sessions[0] ?? null;

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
              </article>
            </div>

            <div className="telemetry-body">
              <section className="telemetry-panel">
                <h3>Active &amp; Recorded Sessions</h3>
                {data.sessions.length === 0 ? (
                  <div className="telemetry-state">No sessions yet</div>
                ) : (
                  <ul className="telemetry-session-list">
                    {data.sessions.map((session, index) => (
                      <li key={session.displayIndex}>
                        <button
                          type="button"
                          className={`telemetry-session-item${
                            index === selectedIndex ? ' is-selected' : ''
                          }`}
                          onClick={() => setSelectedIndex(index)}
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
                        <span>Network Address</span>
                        <strong>Protected</strong>
                      </div>
                      <div className="telemetry-detail">
                        <span>City &amp; Region</span>
                        <strong>
                          {locationLabel(selected)}
                          {selected.postalCode !== 'Unknown'
                            ? ` · ${selected.postalCode}`
                            : ''}
                        </strong>
                      </div>
                      <div className="telemetry-detail">
                        <span>Device &amp; OS</span>
                        <strong>
                          {selected.deviceType} / {selected.operatingSystem}
                        </strong>
                      </div>
                      <div className="telemetry-detail">
                        <span>Browser</span>
                        <strong>
                          {selected.browser}
                          {selected.browserVersion !== 'Unknown'
                            ? ` ${selected.browserVersion}`
                            : ''}
                        </strong>
                      </div>
                      <div className="telemetry-detail">
                        <span>Screen</span>
                        <strong>{selected.screenResolution}</strong>
                      </div>
                      <div className="telemetry-detail">
                        <span>Timezone</span>
                        <strong>{selected.timezone}</strong>
                      </div>
                    </div>
                    <div className="telemetry-detail-footer">
                      <span>Started {selected.startedAtLabel}</span>
                      <span>
                        {selected.isLive ? 'Live signal' : 'Last seen'}{' '}
                        {selected.lastSeenAtLabel}
                      </span>
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="telemetry-link-row">
              <span className="telemetry-updated">
                Updated {data.updatedAtLabel} · Asia/Kolkata
              </span>
              <a className="telemetry-full-link" href="/analytics">
                Open full analytics →
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default TelemetryModal;
