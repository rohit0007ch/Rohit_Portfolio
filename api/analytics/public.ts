import { buildPublicAnalytics } from '../_lib/analyticsAggregate.js';
import {
  formatKolkataTimestamp,
  parseAnalyticsRange,
} from '../_lib/analyticsRange.js';
import {
  methodNotAllowed,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import { expireStaleSessions, utcNowIso } from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

/**
 * GET /api/analytics/public?range=today|7d|30d|all
 * Returns only aggregated public statistics — no visitor/session UUIDs or IP data.
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
    const rangeParam =
      typeof req.query?.range === 'string'
        ? req.query.range
        : Array.isArray(req.query?.range)
          ? req.query.range[0]
          : '7d';

    const range = parseAnalyticsRange(rangeParam);
    if (debug) {
      console.log('[api/analytics/public] start', { range });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();

    await expireStaleSessions(supabase, nowIso);

    const payload = await buildPublicAnalytics(
      supabase,
      range,
      formatKolkataTimestamp(new Date(nowIso))
    );

    // Dashboard polls frequently — never let browsers/CDNs serve stale aggregates.
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );
    res.setHeader('Pragma', 'no-cache');

    if (debug) {
      console.log('[api/analytics/public] ok', {
        range,
        ms: Date.now() - startedAt,
        overview: payload.overview,
      });
    }

    return sendJson(res, 200, {
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[api/analytics/public] unexpected error:', error);
    if (debug) {
      console.log('[api/analytics/public] failed', {
        ms: Date.now() - startedAt,
      });
    }
    return sendJson(res, 500, {
      success: false,
      message: 'Failed to load public analytics',
    });
  }
}
