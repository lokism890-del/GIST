export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ tier: 'FREE', usageCount: 0, usageLimit: 5 });
    }

    // Querying the 'profiles' table using the user's ID
    const { data, error: dbError } = await supabase
      .from('profiles') 
      .select('tier, usage_count')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError || !data) {
      return NextResponse.json({ tier: 'FREE', usageCount: 0, usageLimit: 5 });
    }

    return NextResponse.json({
      tier: (data.tier || 'FREE').toUpperCase(),
      usageCount: data.usage_count ?? 0,
      usageLimit: data.tier?.toUpperCase() === 'PRO' ? 999999 : 5,
    });
  } catch (err: any) {
    return NextResponse.json({ tier: 'FREE', usageCount: 0, usageLimit: 5 });
  }
}