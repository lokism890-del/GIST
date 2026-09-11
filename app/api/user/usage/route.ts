import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { usageCount } = await req.json();
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert targeting the 'profiles' table and resolving conflicts via the 'id' Primary Key
    const { error: dbError } = await supabaseAdmin
      .from('profiles') 
      .upsert({
        id: user.id,
        email: user.email,
        usage_count: usageCount,
        tier: 'FREE' // Acts as a fallback if the profile didn't exist yet
      }, { onConflict: 'id' });

    if (dbError) {
      console.error("Database sync failed:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, newCount: usageCount });
  } catch (err: any) {
    console.error("Usage Route Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}