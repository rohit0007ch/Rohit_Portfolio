import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadLocalEnv } from '../loadLocalEnv.js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  loadLocalEnv();

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const urlSource = process.env.SUPABASE_URL
    ? 'SUPABASE_URL'
    : process.env.VITE_SUPABASE_URL
      ? 'VITE_SUPABASE_URL'
      : null;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      'Server configuration missing: SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY'
    );
  }

  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ANALYTICS_DEBUG === '1'
  ) {
    let host = 'unknown';
    try {
      host = new URL(supabaseUrl).host;
    } catch {
      host = 'invalid-url';
    }
    console.log('[supabaseAdmin] client init', {
      urlSource,
      host,
      secretKeyConfigured: true,
    });
  }

  cachedClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
