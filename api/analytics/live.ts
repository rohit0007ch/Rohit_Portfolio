import { buildLiveTelemetry } from '../_lib/liveTelemetry.js';
import {
  methodNotAllowed,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import { utcNowIso } from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

/**
 * GET /api/analytics/live
 * Public anonymized live telemetry — no visitor/session UUIDs, IPs, or IP hashes.
 *
 * Skips expireStaleSessions on this hot path so eye-button / modal polls stay fast.
 * Active counts already filter on last_seen_at within the inactivity window.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const debug =
    process.env.NODE_ENV !== 'production' ||
    process.env.ANALYTICS_DEBUG === '1';
  const startedAt = Date.now();

  try {
    if (debug) {
      console.log('[api/analytics/live] start');
    }

    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();
    const payload = await buildLiveTelemetry(supabase, nowIso);

    // Live feed must never be cached by browsers/CDNs.
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );
    res.setHeader('Pragma', 'no-cache');

    if (debug) {
      console.log('[api/analytics/live] ok', {
        ms: Date.now() - startedAt,
        overview: payload.overview,
        sessionCount: payload.sessions.length,
        liveCount: payload.sessions.filter((s) => s.isLive).length,
      });
    }

    return sendJson(res, 200, {
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[api/analytics/live] unexpected error:', error);
    if (debug) {
      console.log('[api/analytics/live] failed', {
        ms: Date.now() - startedAt,
      });
    }
    return sendJson(res, 500, {
      success: false,
      message: 'Failed to load live telemetry',
    });
  }
}
