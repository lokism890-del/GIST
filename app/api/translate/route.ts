import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ message: "Server isn't configured with a GROQ_API_KEY yet." }, { status: 500 });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ message: "No text was provided for translation." }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are an expert translator. Translate the following text into English. Respond ONLY with the translated English text. Do not add any conversational filler, introductory text, explanations, or quotes. Preserve the exact original pacing, bullet points, and paragraph breaks.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.1,
    });

    const translation = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ translation });

  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to generate translation." }, { status: 500 });
  }
}