import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiClock,
  FiGlobe,
  FiMapPin,
  FiMonitor,
  FiNavigation,
  FiShield,
  FiWifi,
} from 'react-icons/fi';
import { HiOutlineDesktopComputer } from 'react-icons/hi';
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
  const name = session.browser === 'Unknown' ? 'Unknown Browser' : session.browser;
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
  if (region) return region;
  if (country) return country;
  return 'Unavailable';
}

function idleBadge(session: AnonymizedSession): string {
  if (session.isLive) return 'LIVE';
  const relative = session.lastSeenRelative;
  if (relative.endsWith('s ago')) {
    return relative.replace(' ago', '');
  }
  if (relative.endsWith('m ago')) {
    const mins = relative.replace('m ago', '');
    return `${mins.padStart(2, '0')}m`;
  }
  if (relative.endsWith('h ago')) {
    return relative.replace(' ago', '');
  }
  return 'Idle';
}

function countryFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🌐';
}

function formatClock(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
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
      if (inFlight) {
        return;
      }

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
        if (inFlight === controller) {
          inFlight = null;
        }
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
    if (document.visibilityState === 'visible') {
      startPolling();
    }
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
            <div className="telemetry-header-copy">
              <h2 className="telemetry-title">Real-Time Visitor Telemetry</h2>
              <p className="telemetry-tracking">
                <span className="telemetry-pulse" aria-hidden="true" />
                Tracking Active · Asia/Kolkata
              </p>
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
              <div className="telemetry-banner">
                <div className="telemetry-banner-main">
                  <p className="telemetry-banner-text">{data.watchingLabel}</p>
                  <p className="telemetry-banner-sub">
                    Active Session: {activeSessionClock} |{' '}
                    {formatClock(data.updatedAt)} IST
                  </p>
                </div>
                <div className="telemetry-live-pill">
                  <span className="telemetry-live-pill-dot" aria-hidden="true" />
                  Live Now
                </div>
              </div>

              <div className="telemetry-stats">
                <article className="telemetry-stat">
                  <strong>{data.overview.totalVisitors}</strong>
                  <span>Total Visitor Count</span>
                </article>
                <article className="telemetry-stat">
                  <strong>{data.overview.uniqueDevices}</strong>
                  <span>Unique Devices</span>
                </article>
                <article className="telemetry-stat is-live">
                  <strong>
                    {data.overview.activeWatchers}
                    <em> Live</em>
                  </strong>
                  <span>Active Watchers</span>
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
                              <strong>
                                {session.label}{' '}
                                <span className="telemetry-session-device">
                                  ({session.deviceType})
                                </span>
                              </strong>
                              <span className="telemetry-session-place">
                                <span aria-hidden="true">
                                  {countryFlag(session.country)}
                                </span>
                                {session.locationLabel}
                              </span>
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
                  <h3>
                    {selected
                      ? `Inspecting: ${selected.label} (${selected.deviceType})`
                      : 'Session details'}
                  </h3>
                  {!selected ? (
                    <div className="telemetry-state">Select a session</div>
                  ) : (
                    <>
                      <div className="telemetry-details-grid">
                        <div className="telemetry-detail">
                          <span>
                            <FiShield aria-hidden="true" /> IP Address
                          </span>
                          <strong>Protected</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiMapPin aria-hidden="true" /> City &amp; Postal
                          </span>
                          <strong>{cityPostalLabel(selected)}</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <HiOutlineDesktopComputer aria-hidden="true" />{' '}
                            Device &amp; Operating System
                          </span>
                          <strong>
                            {selected.deviceType} ({selected.operatingSystem})
                          </strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiWifi aria-hidden="true" /> Network Provider &amp;
                            ISP
                          </span>
                          <strong>Unavailable</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiNavigation aria-hidden="true" /> State &amp;
                            Region
                          </span>
                          <strong>{regionCountryLabel(selected)}</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiGlobe aria-hidden="true" /> Browser &amp; Engine
                          </span>
                          <strong>{browserLabel(selected)}</strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiMonitor aria-hidden="true" /> Resolution &amp;
                            Timezone
                          </span>
                          <strong>
                            {selected.screenResolution} | {selected.timezone}
                          </strong>
                        </div>
                        <div className="telemetry-detail">
                          <span>
                            <FiClock aria-hidden="true" /> Session Timestamp
                            &amp; Status
                          </span>
                          <strong>
                            {selected.startedAtLabel}{' '}
                            <em className={selected.isLive ? 'is-live' : ''}>
                              ({selected.isLive ? 'Active Now' : 'Idle'})
                            </em>
                          </strong>
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
                          <FiActivity aria-hidden="true" />
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
                  Updated {data.updatedAtLabel} · live refresh 5s
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
