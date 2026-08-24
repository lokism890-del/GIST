import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { summarizeAudio } from "@/lib/gist";
import { getUserEntitlements } from "@/lib/entitlements";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided in the request." }, 
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    // Default to FREE tier for anonymous frontend usage
    let userTier: 'FREE' | 'PRO' = 'FREE';

    // Verify Logged-In User Entitlements
    if (session?.user && !authError) {
      const entitlements = await getUserEntitlements(session.user.id);
      
      // Set tier dynamically based on your database return
      userTier = entitlements.tier as 'FREE' | 'PRO';

      // STRICT ENFORCEMENT: Block authenticated Free users who exceed their limit
      if (userTier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
        return NextResponse.json(
          { error: "Free usage limit reached. Please upgrade to Pro to continue processing voice notes." }, 
          { status: 403 }
        );
      }
    }

    // Process the audio with the verified tier
    const result = await summarizeAudio(file, userTier);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Summarize API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process the voice note." }, 
      { status: 500 }
    );
  }
}