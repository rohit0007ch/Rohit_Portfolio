import { collectDeviceInfo } from './deviceInfo';
import {
  clearSessionId,
  getOrCreateSessionId,
  getOrCreateVisitorId,
  rotateSessionId,
} from './ids';

/** Faster heartbeats keep last_seen fresh so live counts update quickly. */
const HEARTBEAT_INTERVAL_MS = 5_000;

interface TrackApiResponse {
  success?: boolean;
  active?: boolean;
  reused?: boolean;
  code?: string;
  message?: string;
}

let started = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let currentVisitorId: string | null = null;
let currentSessionId: string | null = null;
let lastRecordedPath: string | null = null;

function currentPagePath(): string {
  const path = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  return path || '/';
}

async function postJson(
  endpoint: string,
  body: Record<string, unknown>
): Promise<TrackApiResponse | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });

    try {
      return (await response.json()) as TrackApiResponse;
    } catch {
      return { success: response.ok };
    }
  } catch (error) {
    console.warn('[tracking] request failed:', endpoint, error);
    return null;
  }
}

async function createSession(pagePath: string): Promise<boolean> {
  const visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSessionId();
  const device = collectDeviceInfo();

  let result = await postJson('/api/track/session', {
    visitorId,
    sessionId,
    pagePath,
    browser: device.browser,
    browserVersion: device.browserVersion,
    operatingSystem: device.operatingSystem,
    deviceType: device.deviceType,
    screenResolution: device.screenResolution,
    timezone: device.timezone,
    referrer: document.referrer || null,
  });

  if (result?.code === 'SESSION_EXPIRED') {
    clearSessionId();
    sessionId = rotateSessionId();
    result = await postJson('/api/track/session', {
      visitorId,
      sessionId,
      pagePath,
      browser: device.browser,
      browserVersion: device.browserVersion,
      operatingSystem: device.operatingSystem,
      deviceType: device.deviceType,
      screenResolution: device.screenResolution,
      timezone: device.timezone,
      referrer: document.referrer || null,
    });
  }

  if (!result?.success) {
    return false;
  }

  currentVisitorId = visitorId;
  currentSessionId = sessionId;
  lastRecordedPath = pagePath;
  return true;
}

async function sendHeartbeat(): Promise<void> {
  if (!currentVisitorId || !currentSessionId) {
    return;
  }

  const result = await postJson('/api/track/heartbeat', {
    visitorId: currentVisitorId,
    sessionId: currentSessionId,
  });

  if (!result) {
    return;
  }

  if (result.active === false) {
    clearSessionId();
    currentSessionId = null;
    const ok = await createSession(currentPagePath());
    if (!ok) {
      stopHeartbeat();
    }
  }
}

async function recordPageView(pagePath: string): Promise<void> {
  if (!currentVisitorId || !currentSessionId) {
    return;
  }

  if (lastRecordedPath === pagePath) {
    return;
  }

  const result = await postJson('/api/track/pageview', {
    visitorId: currentVisitorId,
    sessionId: currentSessionId,
    pagePath,
  });

  if (result?.code === 'SESSION_EXPIRED') {
    clearSessionId();
    currentSessionId = null;
    await createSession(pagePath);
    return;
  }

  if (result?.success) {
    lastRecordedPath = pagePath;
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  void sendHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function onHashChange(): void {
  void recordPageView(currentPagePath());
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void sendHeartbeat();
  }
}

/**
 * Starts anonymous visitor tracking. Safe to call multiple times.
 * Failures are swallowed so the portfolio UI is unaffected.
 */
export function startVisitorTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (started) {
    return;
  }
  started = true;

  initPromise = (async () => {
    try {
      const ok = await createSession(currentPagePath());
      if (!ok) {
        started = false;
        return;
      }

      startHeartbeat();
      window.addEventListener('hashchange', onHashChange);
      document.addEventListener('visibilitychange', onVisibilityChange);
    } catch (error) {
      console.warn('[tracking] failed to start:', error);
      started = false;
    }
  })();
}

export function stopVisitorTracking(): void {
  stopHeartbeat();
  window.removeEventListener('hashchange', onHashChange);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  started = false;
  initPromise = null;
}

/** Exposed for tests / debugging — not required by the UI. */
export function getTrackingInitPromise(): Promise<void> | null {
  return initPromise;
}
