import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // 1. Initialize INSIDE the function to prevent Vercel build crashes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    // 2. Listen for successful transactions
    if (
      event.event_type === 'transaction.completed' || 
      event.event_type === 'subscription.activated'
    ) {
      const supabaseUserId = event.data?.custom_data?.supabase_user_id;

      if (supabaseUserId) {
        // 3. Update the specific user's tier in the profiles table
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ tier: 'PRO' })
          .eq('id', supabaseUserId);

        if (error) {
          console.error('Supabase update error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}