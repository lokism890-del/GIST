const GRAPH_API_VERSION = "v21.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// WhatsApp hard-caps interactive button titles at 20 characters — going
// over this causes the ENTIRE message to fail silently (error 131009),
// not just that one button. Keep every title comfortably under this.
const BUTTON_TITLE_MAX = 20;

function accessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured on the server.");
  return token;
}

function phoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured on the server.");
  return id;
}

async function callGraphApi(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH_API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`WhatsApp API error (${path}):`, errText);
  }
  return res;
}

/** Send a plain text message. */
export async function sendTextMessage(to: string, text: string) {
  return callGraphApi(`${phoneNumberId()}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

/** Mark an incoming message as read (shows the blue ticks). */
export async function markAsRead(messageId: string) {
  return callGraphApi(`${phoneNumberId()}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

/**
 * WhatsApp media downloads are two-step: resolve the media_id to a
 * temporary URL, then fetch that URL with the same bearer token.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<Blob> {
  const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  const meta = await metaRes.json();
  const mediaUrl = meta?.url;
  if (!mediaUrl) throw new Error("Could not resolve WhatsApp media URL.");

  const fileRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!fileRes.ok) throw new Error("Failed to download voice note from WhatsApp.");
  return fileRes.blob();
}

/** Format the summary + key points into a readable WhatsApp message. */
export function formatGistMessage(
  summary: string,
  keyPoints: string[],
  languageLabel: string | null
): string {
  const points = keyPoints.map((p) => `• ${p}`).join("\n");
  const langLine = languageLabel ? `🗣️ _Detected: ${languageLabel}_\n\n` : "";
  return `${langLine}*The gist*\n_${summary}_` + (points ? `\n\n*Key points*\n${points}` : "");
}

type QuickButton = { id: string; title: string };

/**
 * Send the summary with up to 3 quick-action buttons (WhatsApp's limit):
 * full transcript, translate (only shown for non-English notes), and a
 * suggested reply (only shown when one was generated). Titles are
 * truncated defensively so a long/emoji-heavy label can never silently
 * break the whole message the way it did during testing.
 */
export async function sendGistWithButtons(to: string, gistText: string, buttons: QuickButton[]) {
  const safeButtons = buttons.slice(0, 3).map((b) => ({
    type: "reply",
    reply: { id: b.id, title: b.title.slice(0, BUTTON_TITLE_MAX) },
  }));

  return callGraphApi(`${phoneNumberId()}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: gistText },
      action: { buttons: safeButtons },
    },
  });
}

/**
 * WhatsApp text messages cap at 4096 characters. Long transcripts need to
 * be split across multiple sequential messages rather than sent as one.
 */
const WHATSAPP_TEXT_LIMIT = 4000; // small buffer under the real 4096 cap

export function splitForWhatsApp(text: string): string[] {
  if (text.length <= WHATSAPP_TEXT_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, WHATSAPP_TEXT_LIMIT));
    remaining = remaining.slice(WHATSAPP_TEXT_LIMIT);
  }
  return chunks;
}
