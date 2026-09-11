import { NextRequest, NextResponse } from "next/server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { createClient } from "@supabase/supabase-js";

// Initialize Paddle Server SDK
const paddle = new Paddle(process.env.PADDLE_API_KEY || "", {
  environment:
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? Environment.production
      : Environment.sandbox,
});

// Initialize Supabase Admin (Bypasses RLS to update user entitlement)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const signature = req.headers.get("paddle-signature");
  const rawBody = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    // 1. Verify the signature with your Paddle secret key
    const event = (await paddle.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET_KEY || "",
      signature
    )) as any;

    const eventType = event.eventType;
    const customData = event.data?.customData || {};
    const userId = customData.supabase_user_id;

    // 2. Handle successful payment / subscription activation
    if (
      eventType === "transaction.completed" ||
      eventType === "subscription.activated" ||
      eventType === "subscription.created"
    ) {
      if (userId) {
        // Update user tier in your Supabase database table
        await supabaseAdmin
          .from("user_entitlements")
          .upsert({
            user_id: userId,
            tier: "PRO",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
      }
    }

    // 3. Handle cancellation or expiration
    if (
      eventType === "subscription.canceled" ||
      eventType === "subscription.past_due"
    ) {
      if (userId) {
        await supabaseAdmin
          .from("user_entitlements")
          .update({
            tier: "FREE",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Paddle Webhook Error:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
}