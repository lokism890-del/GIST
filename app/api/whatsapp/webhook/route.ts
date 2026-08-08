import { NextRequest, NextResponse } from "next/server";
import { languageName, summarizeAudio, translateAudioToEnglish } from "@/lib/gist";
import {
  downloadWhatsAppMedia,
  formatGistMessage,
  markAsRead,
  sendGistWithButtons,
  sendTextMessage,
  splitForWhatsApp,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const TRANSCRIPT_PREFIX = "transcript:";
const TRANSLATE_PREFIX = "translate:";
const SEND_REPLY_PREFIX = "sendreply:";

/**
 * Meta calls this once when you register the webhook URL in the App
 * Dashboard, to prove you control the endpoint. It sends a challenge
 * value that must be echoed back verbatim, and a verify token that must
 * match what you configured.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          voice?: { id: string };
          audio?: { id: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
          };
        }>;
      };
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  let body: WhatsAppWebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

    for (const message of messages) {
      const from = message.from;

      // Case 1: a voice note (or audio file) arrived — run the full
      // analysis immediately and reply with summary + buttons.
      const voice = message.voice ?? message.audio;
      if (voice) {
        await markAsRead(message.id);
        await handleIncomingVoiceNote(from, voice.id);
        continue;
      }

      const buttonId = message.interactive?.button_reply?.id;

      // Case 2: "Full transcript" button.
      if (message.interactive?.type === "button_reply" && buttonId?.startsWith(TRANSCRIPT_PREFIX)) {
        const mediaId = buttonId.slice(TRANSCRIPT_PREFIX.length);
        await markAsRead(message.id);
        await handleTranscriptRequest(from, mediaId);
        continue;
      }

      // Case 3: "Translate" button.
      if (message.interactive?.type === "button_reply" && buttonId?.startsWith(TRANSLATE_PREFIX)) {
        const mediaId = buttonId.slice(TRANSLATE_PREFIX.length);
        await markAsRead(message.id);
        await handleTranslateRequest(from, mediaId);
        continue;
      }

      // Case 4: "Send this reply" button — delivers the reply text back
      // to the user, ready to copy into their chat with that contact
      // (WhatsApp's API can't send messages on the user's behalf to a
      // third party, so this is the closest equivalent to "one-tap send").
      if (message.interactive?.type === "button_reply" && buttonId?.startsWith(SEND_REPLY_PREFIX)) {
        const replyText = decodeButtonPayload(buttonId.slice(SEND_REPLY_PREFIX.length));
        await markAsRead(message.id);
        await sendTextMessage(from, `📋 Copy and send this:\n\n"${replyText}"`);
        continue;
      }

      // Case 5: a plain text message — reply with a short hint.
      if (message.type === "text") {
        await sendTextMessage(from, "Send me a voice note and I'll get it ready to summarize 🎙️");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    // Always 200 back to Meta so it doesn't retry-storm us; log for debugging.
    return NextResponse.json({ ok: true });
  }
}

async function handleIncomingVoiceNote(from: string, mediaId: string) {
  if (!process.env.GROQ_API_KEY) {
    await sendTextMessage(from, "⚠️ Server isn't configured with a GROQ_API_KEY yet.");
    return;
  }

  await sendTextMessage(from, "⏳ Listening and pulling out the key points…");

  // Vercel's Hobby plan hard-kills this function at 60s with no chance to
  // reply. Racing against a slightly shorter internal timeout lets us send
  // a clear message instead of the user just hearing nothing back.
  const INTERNAL_TIMEOUT_MS = 45_000;

  try {
    await withTimeout(processAndReplyToVoiceNote(from, mediaId), INTERNAL_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof TimeoutError) {
      await sendTextMessage(
        from,
        "⏱️ That one's taking longer than expected — probably a bit long for right now. Shorter voice notes (under 2-3 min) work best today."
      );
    } else {
      console.error("WhatsApp voice note analysis error:", err);
      await sendTextMessage(from, "⚠️ Couldn't process that voice note. Try sending it again.");
    }
  }
}

async function processAndReplyToVoiceNote(from: string, mediaId: string) {
  const audioBlob = await downloadWhatsAppMedia(mediaId);
  const gist = await summarizeAudio(Object.assign(audioBlob, { name: "voice.ogg" }));

  const langLabel = languageName(gist.detectedLanguage);
  const gistText = formatGistMessage(gist.summary, gist.keyPoints, langLabel);
  const isEnglish = (gist.detectedLanguage ?? "").toLowerCase().startsWith("en");

  const buttons = [{ id: `${TRANSCRIPT_PREFIX}${mediaId}`, title: "📄 Transcript" }];
  if (!isEnglish) {
    buttons.push({ id: `${TRANSLATE_PREFIX}${mediaId}`, title: "🌐 Translate" });
  }
  if (gist.suggestedReply) {
    buttons.push({
      id: `${SEND_REPLY_PREFIX}${encodeButtonPayload(gist.suggestedReply)}`,
      title: "💬 Suggested reply",
    });
  }

  await sendGistWithButtons(from, gistText, buttons);
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`Timed out after ${ms}ms`)), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function handleTranscriptRequest(from: string, mediaId: string) {
  if (!process.env.GROQ_API_KEY) {
    await sendTextMessage(from, "⚠️ Server isn't configured with a GROQ_API_KEY yet.");
    return;
  }

  await sendTextMessage(from, "⏳ Pulling up the full transcript…");

  try {
    const audioBlob = await downloadWhatsAppMedia(mediaId);
    const result = await summarizeAudio(Object.assign(audioBlob, { name: "voice.ogg" }));
    const chunks = splitForWhatsApp(`*Full transcript*\n\n${result.transcript}`);
    for (const chunk of chunks) {
      await sendTextMessage(from, chunk);
    }
  } catch (err) {
    console.error("WhatsApp transcript error:", err);
    await sendTextMessage(from, "⚠️ Couldn't pull up that transcript. Try again.");
  }
}

async function handleTranslateRequest(from: string, mediaId: string) {
  if (!process.env.GROQ_API_KEY) {
    await sendTextMessage(from, "⚠️ Server isn't configured with a GROQ_API_KEY yet.");
    return;
  }

  await sendTextMessage(from, "⏳ Translating to English…");

  try {
    const audioBlob = await downloadWhatsAppMedia(mediaId);
    const translatedText = await translateAudioToEnglish(
      Object.assign(audioBlob, { name: "voice.ogg" })
    );
    const chunks = splitForWhatsApp(`*English translation*\n\n${translatedText}`);
    for (const chunk of chunks) {
      await sendTextMessage(from, chunk);
    }
  } catch (err) {
    console.error("WhatsApp translate error:", err);
    await sendTextMessage(from, "⚠️ Couldn't translate that voice note. Try again.");
  }
}

// WhatsApp button ids must be plain strings without certain characters
// causing issues in practice; base64url keeps arbitrary reply text safe
// to round-trip through a button id.
function encodeButtonPayload(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

function decodeButtonPayload(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf-8");
}
