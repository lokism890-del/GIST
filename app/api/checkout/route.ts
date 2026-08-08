import { NextRequest, NextResponse } from "next/server";
import { getPolar } from "@/lib/polar";

export const runtime = "nodejs";

/**
 * Redirects the user into a Polar-hosted checkout session for Gist Pro.
 * The actual product/price is configured in the Polar dashboard, not
 * here — this route just needs the product ID to start a session.
 */
export async function GET(req: NextRequest) {
  const productId = process.env.POLAR_GIST_PRO_PRODUCT_ID;

  if (!productId) {
    return NextResponse.json(
      { error: "POLAR_GIST_PRO_PRODUCT_ID is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const polar = getPolar();
    const { searchParams, origin } = new URL(req.url);

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${origin}/upgrade/success?checkout_id={CHECKOUT_ID}`,
      // Pass through an optional customer email if the app ever collects
      // one (e.g. from a future login system) — harmless to omit for now.
      customerEmail: searchParams.get("email") ?? undefined,
    });

    return NextResponse.redirect(checkout.url);
  } catch (err) {
    console.error("Polar checkout creation error:", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Try again in a moment." },
      { status: 500 }
    );
  }
}
