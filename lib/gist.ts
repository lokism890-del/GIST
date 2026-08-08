import Groq from "groq-sdk";

export type GistResult = {
  transcript: string;
  detectedLanguage: string | null;
  summary: string;
  keyPoints: string[];
  suggestedReply: string | null;
};

/**
 * Takes an audio file and returns everything the v1 product needs in one
 * pass: transcript, summary, key points, and a single suggested reply for
 * the whole voice note (or null if nothing warrants a reply — e.g. the
 * note was just FYI, not a question or request).
 */
export async function summarizeAudio(file: Blob & { name?: string }): Promise<GistResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    temperature: 0.0,
  });

  const transcript = transcription.text?.trim();
  const detectedLanguage = (transcription as unknown as { language?: string }).language ?? null;

  if (!transcript) {
    throw new Error("Couldn't make out any speech in that recording.");
  }

  const systemPrompt =
    "You summarize voice note transcripts for a personal assistant app. Respond in the SAME language as the transcript. " +
    "Return strict JSON with three fields:\n\n" +
    `"summary" — ONE sharp, specific sentence capturing what the voice note was actually about — not a generic description like "the speaker discusses X". ` +
    `Name the real subject and the real point. Example of the right level of specificity: "The client approved the proposal but wants the homepage delivered by Friday instead." ` +
    `As a JSON string.\n\n` +
    `"keyPoints" — an array of 3-6 short bullet strings with the concrete points, decisions, or asks.\n\n` +
    `"suggestedReply" — a short, natural, ready-to-send reply the listener could send back, in the SAME language as the transcript, ` +
    `as a JSON string, or the JSON value null if no reply makes sense (e.g. the note is just FYI/casual conversation, not a question or request needing a response).\n\n` +
    "Every field must be valid JSON — every string value wrapped in double quotes. No preamble, no markdown, just the JSON object.";

  const completion = await createGistCompletionWithRetry(groq, systemPrompt, transcript);

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { summary?: string; keyPoints?: string[]; suggestedReply?: string | null };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: raw, keyPoints: [], suggestedReply: null };
  }

  return {
    transcript,
    detectedLanguage,
    summary: parsed.summary ?? "",
    keyPoints: parsed.keyPoints ?? [],
    suggestedReply: parsed.suggestedReply ?? null,
  };
}

/**
 * Groq occasionally returns malformed JSON from the model itself (e.g. an
 * unquoted string value), which fails server-side validation with a 400
 * before we ever see a response to parse. This retries once with a
 * lower temperature and a more explicit reminder about quoting — cheap
 * insurance against an otherwise-successful transcription going to waste.
 */
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
      model: "llama-3.3-70b-versatile",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
  } catch (err) {
    console.error("Gist completion failed, retrying once:", err);
    return groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nIMPORTANT: your previous response had invalid JSON. Double-check every string value is wrapped in double quotes before responding.",
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    });
  }
}

/**
 * Translates audio directly to English using Groq's dedicated translation
 * endpoint (separate from transcription) — built specifically for this,
 * so it tends to do better than routing a transcript through a chat model.
 */
export async function translateAudioToEnglish(file: Blob & { name?: string }): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const translation = await groq.audio.translations.create({
    file,
    model: "whisper-large-v3",
    temperature: 0.0,
  });

  return translation.text?.trim() ?? "";
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  hi: "Hindi",
  ar: "Arabic",
  ru: "Russian",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  tr: "Turkish",
  fa: "Persian",
  bn: "Bengali",
  pa: "Punjabi",
  ps: "Pashto",
  id: "Indonesian",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  th: "Thai",
  sw: "Swahili",
};

/** Convert a language code (e.g. "ru") to a readable name (e.g. "Russian"). */
export function languageName(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase().split("-")[0];
  return LANGUAGE_NAMES[normalized] ?? code;
}
