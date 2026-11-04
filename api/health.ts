import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { loadLocalEnv } from './loadLocalEnv.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET.',
    });
  }

  try {
    loadLocalEnv();

    const envConfigured = {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
      SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    };

    console.log('[api/health] env configured:', envConfigured);

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('visitors').select('id').limit(1);

    if (error) {
      console.error('[api/health] visitors query failed:', {
        code: error.code,
        message: error.message,
      });

      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase backend connection successful',
    });
  } catch (error) {
    console.error('[api/health] unexpected error:', error);

    const message =
      error instanceof Error && error.message.includes('Server configuration')
        ? error.message
        : 'Invalid credentials or unexpected server error';

    return res.status(500).json({
      success: false,
      message,
    });
  }
}
