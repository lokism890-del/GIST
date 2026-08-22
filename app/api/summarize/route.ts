import { NextRequest, NextResponse } from "next/server";
import { summarizeAudio } from "@/lib/gist";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Check for API Key
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        message: "Server isn't configured with a GROQ_API_KEY yet. Add one to .env.local and restart.",
      },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json(
        { message: "No audio file was received. Try recording or uploading again." },
        { status: 400 }
      );
    }

    // Process the audio
    const result = await summarizeAudio(file);
    return NextResponse.json(result);

  } catch (err: any) {
    // Log the full stack trace to your terminal for debugging
    console.error("Summarize route error:", err);
    
    // Safely extract the exact error message
    const errorMessage = err instanceof Error 
      ? err.message 
      : "Something went wrong processing that voice note.";
    
    // Pass it back as 'message' so the frontend can display it in the red box
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}