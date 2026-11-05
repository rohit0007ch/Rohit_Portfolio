import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sessions without a heartbeat for this long are marked inactive.
 * Aligned with reference telemetry (60s lastSeen window) so browser timer
 * throttling does not falsely zero out active visitors.
 */
export const SESSION_INACTIVITY_MS = 60_000;

export function utcNowIso(): string {
  return new Date().toISOString();
}

export function inactivityCutoffIso(now = new Date()): string {
  return new Date(now.getTime() - SESSION_INACTIVITY_MS).toISOString();
}

/**
 * Marks sessions inactive when they have not received a heartbeat
 * within SESSION_INACTIVITY_MS. Uses session_ended_at (no is_active column).
 */
export async function expireStaleSessions(
  supabase: SupabaseClient,
  nowIso = utcNowIso()
): Promise<void> {
  const cutoff = inactivityCutoffIso(new Date(nowIso));

  const { error } = await supabase
    .from('visitor_sessions')
    .update({ session_ended_at: nowIso })
    .is('session_ended_at', null)
    .lt('last_seen_at', cutoff);

  if (error) {
    console.error('[track] expireStaleSessions failed:', {
      code: error.code,
      message: error.message,
    });
  }
}

export async function upsertVisitor(
  supabase: SupabaseClient,
  visitorId: string,
  nowIso: string
): Promise<{ error: { code?: string; message: string } | null }> {
  const { data: existing, error: selectError } = await supabase
    .from('visitors')
    .select('id')
    .eq('id', visitorId)
    .maybeSingle();

  if (selectError) {
    return { error: selectError };
  }

  if (existing) {
    const { error } = await supabase
      .from('visitors')
      .update({ last_seen_at: nowIso })
      .eq('id', visitorId);
    return { error };
  }

  const { error } = await supabase.from('visitors').insert({
    id: visitorId,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
  });

  // Concurrent first-visit inserts: treat unique violation as success, then touch last_seen.
  if (error?.code === '23505') {
    const { error: updateError } = await supabase
      .from('visitors')
      .update({ last_seen_at: nowIso })
      .eq('id', visitorId);
    return { error: updateError };
  }

  return { error };
}
