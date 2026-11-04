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

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      'Server configuration missing: SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY'
    );
  }

  cachedClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
