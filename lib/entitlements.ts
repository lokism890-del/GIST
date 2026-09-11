import { db } from './db'; 
import { createClient } from '@supabase/supabase-js';

export async function getUserEntitlements(userId: string) {
  // 1. Fetch Paddle Subscription Data directly from the new Supabase table
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Uses the service role to guarantee read access
  );

  const { data: entitlement } = await supabase
    .from('user_entitlements')
    .select('tier')
    .eq('user_id', userId)
    .single();

  const isPro = entitlement?.tier === 'PRO';

  // 2. Count Usage for Current Month (Keeping your existing Prisma logic)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageCount = await db.voiceNote.count({
    where: {
      userId: userId,
      createdAt: { gte: startOfMonth }
    }
  });

  return {
    tier: isPro ? 'PRO' : 'FREE',
    usageCount,
    usageLimit: isPro ? 100 : 5 // You can adjust the PRO usage limit here
  };
}