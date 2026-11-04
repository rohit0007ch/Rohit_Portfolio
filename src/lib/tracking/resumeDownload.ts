import { RESUME_DOWNLOAD_NAME } from '../../constants/resume';
import { getOrCreateVisitorId, getSessionId } from './ids';

/**
 * Fire-and-forget resume download tracking. Never blocks the download.
 */
export function trackResumeDownload(
  filename: string = RESUME_DOWNLOAD_NAME
): void {
  try {
    const visitorId = getOrCreateVisitorId();
    const sessionId = getSessionId();

    void fetch('/api/track/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        sessionId,
        filename,
        downloadStatus: 'success',
      }),
      keepalive: true,
    }).catch(() => {
      // Swallow — portfolio UX must not break.
    });
  } catch {
    // Swallow storage / unexpected errors.
  }
}
