import Groq from "groq-sdk";

export type GistResult = {
  transcript: string;
  language: string | null;
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  suggestedReply?: any | null;
};

/**
 * Takes an audio file and user tier, and returns strictly gated data.
 * Defaults to 'FREE' if no tier is passed from the API route for maximum security.
 */
export async function summarizeAudio(file: Blob & { name?: string }, tier: 'FREE' | 'PRO' = 'FREE'): Promise<GistResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    temperature: 0.0,
    prompt: "Hello, this is a voice note. یہ ایک وائس نوٹ ہے۔", 
  });

  const transcript = transcription.text?.trim();
  const rawLang = (transcription as unknown as { language?: string }).language ?? null;
  const detectedLanguage = languageName(rawLang);

  if (!transcript) {
    throw new Error("Couldn't make out any speech in that recording.");
  }

  // --- STRICT SERVER-SIDE ENTITLEMENT ENFORCEMENT ---
  let systemPrompt = "";

  if (tier === 'PRO') {
    systemPrompt =
      "You summarize voice note transcripts for a personal assistant app. Respond in the SAME language as the transcript. " +
      "Return strict JSON with exactly four fields:\n\n" +
      `"summary" — ONE sharp, specific sentence capturing what the voice note was actually about.\n\n` +
      `"keyPoints" — an array of 3-6 short bullet strings with the concrete points or asks.\n\n` +
      `"actionItems" — an array of short strings representing clear tasks, deadlines, or responsibilities mentioned in the audio. If there are none, return an empty array [].\n\n` +
      `"suggestedReply" — a JSON object containing exactly 4 different versions of a ready-to-send reply (keys: "professional", "friendly", "short", "assertive"). Return null if no reply makes sense.\n\n` +
      "Every field must be valid JSON — every string value wrapped in double quotes. No preamble, no markdown, just the JSON object.";
  } else {
    // FREE TIER PROMPT: Only generates the Gist. Cheaper, faster, and perfectly secure.
    systemPrompt =
      "You summarize voice note transcripts for a personal assistant app. Respond in the SAME language as the transcript. " +
      "Return strict JSON with exactly ONE field:\n\n" +
      `"summary" — ONE sharp, specific sentence capturing what the voice note was actually about.\n\n` +
      "Every field must be valid JSON — every string value wrapped in double quotes. No preamble, no markdown, just the JSON object.";
  }

  const completion = await createGistCompletionWithRetry(groq, systemPrompt, transcript);

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { summary?: string; keyPoints?: string[]; actionItems?: string[]; suggestedReply?: any | null };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: raw };
  }

  return {
    transcript,
    language: detectedLanguage,
    summary: parsed.summary ?? "",
    // Only map Pro fields to the response if the user is explicitly PRO
    ...(tier === 'PRO' && {
      keyPoints: parsed.keyPoints ?? [],
      actionItems: parsed.actionItems ?? [],
      suggestedReply: parsed.suggestedReply ?? null,
    })
  };
}

async function createGistCompletionWithRetry(
  groq: Groq,
  systemPrompt: string,
  transcript: string
) {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: transcript },
  ];

  try {
    return await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
  } catch (err) {
    return groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: systemPrompt + "\n\nIMPORTANT: your previous response had invalid JSON. Double-check every string value is wrapped in double quotes before responding.",
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    });
  }
}

export async function translateAudioToEnglish(file: Blob & { name?: string }): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured.");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const translation = await groq.audio.translations.create({ file, model: "whisper-large-v3", temperature: 0.0 });
  return translation.text?.trim() ?? "";
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", ur: "Urdu", hi: "Hindi", ar: "Arabic", ru: "Russian", es: "Spanish", fr: "French", de: "German", zh: "Chinese", ja: "Japanese",
  ko: "Korean", pt: "Portuguese", tr: "Turkish", fa: "Persian", bn: "Bengali", pa: "Punjabi", ps: "Pashto", id: "Indonesian", it: "Italian", nl: "Dutch",
  pl: "Polish", uk: "Ukrainian", vi: "Vietnamese", th: "Thai", sw: "Swahili",
};

export function languageName(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase().split("-")[0];
  return LANGUAGE_NAMES[normalized] ?? code;
}