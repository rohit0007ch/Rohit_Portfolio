import { getRequestGeo } from '../_lib/geo.js';
import {
  methodNotAllowed,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import {
  expireStaleSessions,
  upsertVisitor,
  utcNowIso,
} from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import {
  asOptionalString,
  asTrimmedString,
  isUuid,
} from '../_lib/validate.js';

interface SessionBody {
  visitorId?: unknown;
  sessionId?: unknown;
  pagePath?: unknown;
  browser?: unknown;
  browserVersion?: unknown;
  operatingSystem?: unknown;
  deviceType?: unknown;
  screenResolution?: unknown;
  timezone?: unknown;
  referrer?: unknown;
}

/**
 * POST /api/track/session
 * Creates (or reuses) a visitor + session and records the initial page view.
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
    const body = readJsonBody(req) as SessionBody | null;
    if (body == null || typeof body !== 'object') {
      return sendJson(res, 400, {
        success: false,
        message: 'Invalid JSON body',
      });
    }

    const visitorId = body.visitorId;
    const sessionId = body.sessionId;
    const pagePath = asTrimmedString(body.pagePath, 2048);

    if (!isUuid(visitorId) || !isUuid(sessionId) || !pagePath) {
      return sendJson(res, 400, {
        success: false,
        message:
          'visitorId and sessionId must be UUIDs; pagePath is required',
      });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();
    const geo = getRequestGeo(req.headers ?? {});

    await expireStaleSessions(supabase, nowIso);

    const { error: visitorError } = await upsertVisitor(
      supabase,
      visitorId,
      nowIso
    );
    if (visitorError) {
      console.error('[api/track/session] visitor upsert failed:', visitorError);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to create visitor',
      });
    }

    const { data: existingSession, error: existingError } = await supabase
      .from('visitor_sessions')
      .select('id, visitor_id, session_ended_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (existingError) {
      console.error(
        '[api/track/session] session lookup failed:',
        existingError
      );
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to look up session',
      });
    }

    if (existingSession) {
      if (existingSession.visitor_id !== visitorId) {
        return sendJson(res, 409, {
          success: false,
          message: 'Session already belongs to another visitor',
        });
      }

      if (!existingSession.session_ended_at) {
        await supabase
          .from('visitor_sessions')
          .update({ last_seen_at: nowIso })
          .eq('id', sessionId);

        return sendJson(res, 200, {
          success: true,
          visitorId,
          sessionId,
          reused: true,
        });
      }

      // Ended session id still in client storage — ask client for a fresh id.
      return sendJson(res, 409, {
        success: false,
        message: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    const sessionRow = {
      id: sessionId,
      visitor_id: visitorId,
      session_started_at: nowIso,
      last_seen_at: nowIso,
      session_ended_at: null as string | null,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      postal_code: geo.postalCode,
      browser: asOptionalString(body.browser, 100),
      browser_version: asOptionalString(body.browserVersion, 50),
      operating_system: asOptionalString(body.operatingSystem, 100),
      device_type: asOptionalString(body.deviceType, 50),
      screen_resolution: asOptionalString(body.screenResolution, 50),
      timezone: asOptionalString(body.timezone, 100),
      ip_hash: geo.ipHash,
      referrer: asOptionalString(body.referrer, 2048),
    };

    const { error: sessionError } = await supabase
      .from('visitor_sessions')
      .insert(sessionRow);

    if (sessionError) {
      // Concurrent create with same session id — treat as reuse.
      if (sessionError.code === '23505') {
        return sendJson(res, 200, {
          success: true,
          visitorId,
          sessionId,
          reused: true,
        });
      }

      console.error('[api/track/session] session insert failed:', sessionError);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to create session',
      });
    }

    const { error: pageViewError } = await supabase.from('page_views').insert({
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pagePath,
      viewed_at: nowIso,
    });

    if (pageViewError) {
      console.error(
        '[api/track/session] page_view insert failed:',
        pageViewError
      );
      // Session already created — still return success so client can heartbeat.
      return sendJson(res, 200, {
        success: true,
        visitorId,
        sessionId,
        reused: false,
        pageViewRecorded: false,
      });
    }

    return sendJson(res, 201, {
      success: true,
      visitorId,
      sessionId,
      reused: false,
      pageViewRecorded: true,
    });
  } catch (error) {
    console.error('[api/track/session] unexpected error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Unexpected server error',
    });
  }
}
