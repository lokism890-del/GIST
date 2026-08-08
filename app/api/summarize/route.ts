import { NextRequest, NextResponse } from "next/server";
import { summarizeAudio } from "@/lib/gist";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Server isn't configured with a GROQ_API_KEY yet. Add one to .env.local and restart.",
      },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file was received. Try recording or uploading again." },
        { status: 400 }
      );
    }

    const result = await summarizeAudio(file);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Summarize route error:", err);
    const message =
      err instanceof Error ? err.message : "Something went wrong processing that voice note.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
