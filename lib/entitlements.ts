import { createClient } from '@supabase/supabase-js';

export async function getUserEntitlements(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch the tier from user_entitlements
  const { data: entitlement, error: entError } = await supabase
    .from('user_entitlements')
    .select('tier')
    .eq('user_id', userId)
    .single();

  if (entError) {
    console.error("Entitlement fetch error:", entError);
  }

  const tier = entitlement?.tier || 'FREE';
  const isPro = tier === 'PRO';

  // 2. Count usage using the exact 'voice_notes' table name and 'user_id' column
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from('voice_notes') 
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId) 
    .gte('created_at', startOfMonth.toISOString()); 

  if (countError) {
    console.error("Voice notes count error:", countError);
  }

  return {
    tier: tier,
    usageCount: count || 0,
    usageLimit: isPro ? 100 : 5
  };
}