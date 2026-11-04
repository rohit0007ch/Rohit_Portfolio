import {
  methodNotAllowed,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import { expireStaleSessions, utcNowIso } from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { asTrimmedString, isUuid } from '../_lib/validate.js';

interface PageViewBody {
  visitorId?: unknown;
  sessionId?: unknown;
  pagePath?: unknown;
}

/**
 * POST /api/track/pageview
 * Records a page view for an active visitor session.
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
    const body = readJsonBody(req) as PageViewBody | null;
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

    await expireStaleSessions(supabase, nowIso);

    const { data: session, error: sessionError } = await supabase
      .from('visitor_sessions')
      .select('id, visitor_id, session_ended_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[api/track/pageview] lookup failed:', sessionError);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to look up session',
      });
    }

    if (!session || session.visitor_id !== visitorId) {
      return sendJson(res, 404, {
        success: false,
        message: 'Session not found',
      });
    }

    if (session.session_ended_at) {
      return sendJson(res, 409, {
        success: false,
        message: 'Session inactive',
        code: 'SESSION_EXPIRED',
      });
    }

    const { error: insertError } = await supabase.from('page_views').insert({
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pagePath,
      viewed_at: nowIso,
    });

    if (insertError) {
      console.error('[api/track/pageview] insert failed:', insertError);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to record page view',
      });
    }

    await Promise.all([
      supabase
        .from('visitors')
        .update({ last_seen_at: nowIso })
        .eq('id', visitorId),
      supabase
        .from('visitor_sessions')
        .update({ last_seen_at: nowIso })
        .eq('id', sessionId),
    ]);

    return sendJson(res, 201, {
      success: true,
      viewedAt: nowIso,
    });
  } catch (error) {
    console.error('[api/track/pageview] unexpected error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Unexpected server error',
    });
  }
}
