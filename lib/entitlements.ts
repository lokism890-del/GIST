import { createClient } from '@supabase/supabase-js';

export async function getUserEntitlements(userId: string) {
  // 1. Connect directly to Supabase using the Service Role to bypass row-level security
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Fetch the real Tier updated by your Paddle Webhook
  const { data: entitlement } = await supabase
    .from('user_entitlements')
    .select('tier')
    .eq('user_id', userId)
    .single();

  const tier = entitlement?.tier || 'FREE';
  const isPro = tier === 'PRO';

  // 3. Count real usage for the current month from Supabase
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('VoiceNote') // IMPORTANT: Change this if your Supabase table is named differently (e.g., 'voice_notes')
    .select('*', { count: 'exact', head: true })
    .eq('userId', userId) // IMPORTANT: Change to 'user_id' if that is your column name
    .gte('createdAt', startOfMonth.toISOString()); // IMPORTANT: Change to 'created_at' if needed

  return {
    tier: tier,
    usageCount: count || 0,
    usageLimit: isPro ? 100 : 5 // Pro users get 100, Free users get 5
  };
}