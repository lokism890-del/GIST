import { NextResponse } from 'next/server';
import { getUserEntitlements } from '@/lib/entitlements';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        }
      },
    }
  );

  // CRITICAL FIX: Use getUser() instead of getSession() for Next.js App Router
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user?.id) {
    console.error("Auth Error:", authError);
    return NextResponse.json({ tier: 'FREE', usageCount: 0, usageLimit: 5 });
  }

  const data = await getUserEntitlements(user.id);
  return NextResponse.json(data);
}