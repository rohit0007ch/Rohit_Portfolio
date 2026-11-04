import { getRequestGeo } from '../_lib/geo.js';
import {
  methodNotAllowed,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import {
  expireStaleSessions,
  inactivityCutoffIso,
  utcNowIso,
} from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { isUuid } from '../_lib/validate.js';

interface HeartbeatBody {
  visitorId?: unknown;
  sessionId?: unknown;
}

/**
 * POST /api/track/heartbeat
 * Updates last_seen_at and expires sessions idle for 45+ seconds.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  try {
    const body = readJsonBody(req) as HeartbeatBody | null;
    if (body == null || typeof body !== 'object') {
      return sendJson(res, 400, {
        success: false,
        message: 'Invalid JSON body',
      });
    }

    const { visitorId, sessionId } = body;
    if (!isUuid(visitorId) || !isUuid(sessionId)) {
      return sendJson(res, 400, {
        success: false,
        message: 'visitorId and sessionId must be UUIDs',
      });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();

    await expireStaleSessions(supabase, nowIso);

    const { data: session, error: sessionError } = await supabase
      .from('visitor_sessions')
      .select(
        'id, visitor_id, last_seen_at, session_ended_at, country, region, city, postal_code, ip_hash'
      )
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[api/track/heartbeat] lookup failed:', sessionError);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to look up session',
      });
    }

    if (!session || session.visitor_id !== visitorId) {
      return sendJson(res, 404, {
        success: false,
        active: false,
        message: 'Session not found',
      });
    }

    if (session.session_ended_at) {
      return sendJson(res, 200, {
        success: true,
        active: false,
        message: 'Session inactive',
      });
    }

    // This session itself went stale between heartbeats.
    if (
      session.last_seen_at &&
      new Date(session.last_seen_at).getTime() <
        new Date(inactivityCutoffIso(new Date(nowIso))).getTime()
    ) {
      await supabase
        .from('visitor_sessions')
        .update({ session_ended_at: nowIso })
        .eq('id', sessionId)
        .is('session_ended_at', null);

      return sendJson(res, 200, {
        success: true,
        active: false,
        message: 'Session expired due to inactivity',
      });
    }

    const geo = getRequestGeo(req.headers ?? {});
    const sessionPatch: Record<string, string> = {
      last_seen_at: nowIso,
    };

    // Backfill location/network hash if the session was created without geo.
    if (!session.country && geo.country) sessionPatch.country = geo.country;
    if (!session.region && geo.region) sessionPatch.region = geo.region;
    if (!session.city && geo.city) sessionPatch.city = geo.city;
    if (!session.postal_code && geo.postalCode) {
      sessionPatch.postal_code = geo.postalCode;
    }
    if (!session.ip_hash && geo.ipHash) sessionPatch.ip_hash = geo.ipHash;

    const [{ error: visitorUpdateError }, { error: sessionUpdateError }] =
      await Promise.all([
        supabase
          .from('visitors')
          .update({ last_seen_at: nowIso })
          .eq('id', visitorId),
        supabase
          .from('visitor_sessions')
          .update(sessionPatch)
          .eq('id', sessionId)
          .is('session_ended_at', null),
      ]);

    if (visitorUpdateError || sessionUpdateError) {
      console.error('[api/track/heartbeat] update failed:', {
        visitorUpdateError,
        sessionUpdateError,
      });
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to update heartbeat',
      });
    }

    return sendJson(res, 200, {
      success: true,
      active: true,
      lastSeenAt: nowIso,
    });
  } catch (error) {
    console.error('[api/track/heartbeat] unexpected error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Unexpected server error',
    });
  }
}
