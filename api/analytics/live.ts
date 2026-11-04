import { buildLiveTelemetry } from '../_lib/liveTelemetry.js';
import {
  methodNotAllowed,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import { expireStaleSessions, utcNowIso } from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

/**
 * GET /api/analytics/live
 * Public anonymized live telemetry — no visitor/session UUIDs, IPs, or IP hashes.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();
    await expireStaleSessions(supabase, nowIso);

    const payload = await buildLiveTelemetry(supabase, nowIso);

    res.setHeader('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');

    return sendJson(res, 200, {
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[api/analytics/live] unexpected error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Failed to load live telemetry',
    });
  }
}
