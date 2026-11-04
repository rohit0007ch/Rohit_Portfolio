import {
  methodNotAllowed,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from '../_lib/http.js';
import { utcNowIso } from '../_lib/sessions.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import {
  asOptionalString,
  asTrimmedString,
  isUuid,
} from '../_lib/validate.js';

interface ResumeBody {
  visitorId?: unknown;
  sessionId?: unknown;
  filename?: unknown;
  downloadStatus?: unknown;
}

/**
 * POST /api/track/resume
 * Records a resume download event (defaults to success).
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
    const body = readJsonBody(req) as ResumeBody | null;
    if (body == null || typeof body !== 'object') {
      return sendJson(res, 400, {
        success: false,
        message: 'Invalid JSON body',
      });
    }

    const filename = asTrimmedString(body.filename, 255);
    if (!filename) {
      return sendJson(res, 400, {
        success: false,
        message: 'filename is required',
      });
    }

    const visitorId = isUuid(body.visitorId) ? body.visitorId : null;
    const sessionId = isUuid(body.sessionId) ? body.sessionId : null;
    const statusRaw = asOptionalString(body.downloadStatus, 32);
    const downloadStatus =
      statusRaw === 'failed' || statusRaw === 'success' ? statusRaw : 'success';

    const supabase = getSupabaseAdmin();
    const nowIso = utcNowIso();

    const { error } = await supabase.from('resume_downloads').insert({
      visitor_id: visitorId,
      session_id: sessionId,
      filename,
      downloaded_at: nowIso,
      download_status: downloadStatus,
    });

    if (error) {
      console.error('[api/track/resume] insert failed:', error);
      return sendJson(res, 500, {
        success: false,
        message: 'Failed to record resume download',
      });
    }

    return sendJson(res, 201, {
      success: true,
      downloadedAt: nowIso,
    });
  } catch (error) {
    console.error('[api/track/resume] unexpected error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Unexpected server error',
    });
  }
}
