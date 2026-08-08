# Gist — the fastest way to understand any voice note

Forward a voice note, get back everything you actually need: a summary,
the key points, the full transcript, a translation if it's not in
English, and a ready-to-send reply.

## Free vs Pro

**Free tier** (5 voice notes/month): full transcript only.

**Gist Pro** ($4.99/month): everything unlocked —

1. **AI Summary** — a short paragraph capturing what the voice note was
   about
2. **Key points** — 3-6 concrete bullets: the decisions, asks, or facts
   that matter
3. **Translate** — one-tap English translation, shown automatically only
   when the note isn't already in English
4. **AI Suggested reply** — a ready-to-send response when the voice note
   asked something or needs a reply, ready to copy and send
5. Language detection badges, unlimited notes, longer recordings,
   priority processing

The web app's results screen always shows the transcript and a "time
saved" estimate for free; the summary, key points, and quick reply
sections render blurred with an unlock prompt until upgraded.

### Dashboard styling

The idle screen shows a real progress bar for free notes remaining
(with an honestly-computed "resets in N days" based on the calendar
month boundary, not a fabricated number), trust indicators, and a
Premium card with pricing details as part of the page layout rather
than just a floating button. The top nav only links to sections that
actually exist on the page (Pricing anchor) — no placeholder
Dashboard/History/Docs links, since those pages don't exist yet and
dead links would undercut the trust this redesign is going for.

## Two front doors, same engine

- **Web app** — record or upload right in the browser
- **WhatsApp bot** — send a voice note to your WhatsApp Business number,
  get the summary + buttons back automatically

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
GROQ_API_KEY=gsk_your_key_here

WHATSAPP_ACCESS_TOKEN=your_token_from_meta_api_setup
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose
```

Run it:

```bash
npm run dev
```

Web app is now at http://localhost:3000.

## Deploy

```bash
npm i -g vercel
vercel --prod
```

Add all four env vars above in Vercel's dashboard (Project → Settings →
Environment Variables, Production scope checked), then redeploy.

## Connect WhatsApp

1. developers.facebook.com → your app → WhatsApp → Configuration →
   Webhook → Edit
2. Callback URL: `https://your-app.vercel.app/api/whatsapp/webhook`
3. Verify token: the exact same string as `WHATSAPP_VERIFY_TOKEN`
4. Click **Verify and save**
5. Subscribe to the `messages` field

**Important extra step** that's easy to miss: subscribing to `messages`
in the Configuration screen isn't always enough on its own. Also
subscribe your WhatsApp Business Account to the app directly:

1. developers.facebook.com/tools/explorer
2. Select your app, use your access token
3. POST request to: `YOUR_WABA_ID/subscribed_apps` (empty body)
4. Should return `{"success": true}`

Send a voice note to your WhatsApp Business number from your phone — you
should get the summary back with buttons within a few seconds.

## How it works

- `lib/gist.ts` — the whole engine: transcription (Whisper), the
  combined summary + key points + suggested reply call (Llama 3.3), and
  a separate translation call (Whisper's dedicated translation endpoint)
- `lib/whatsapp.ts` — WhatsApp Cloud API wrapper: send message, send up
  to 3 quick-action buttons, download voice media, mark as read
- `app/api/summarize/route.ts` — web app's backend endpoint
- `app/api/whatsapp/webhook/route.ts` — WhatsApp's webhook: verification
  handshake (GET), and incoming voice notes / button taps (POST)
- `app/page.tsx` — the web app UI

### A real WhatsApp API constraint worth knowing

Button titles are capped at 20 characters — going over this fails the
**entire** message silently (not just that button), which cost real
debugging time during development. `lib/whatsapp.ts` now truncates
titles defensively so this can't happen again.

Also, WhatsApp's API can only send messages **to** whoever messaged the
bot — it can't send a message as the user to a third party. So
"Suggested reply" delivers the text back to the user to copy into their
own chat, rather than auto-sending it.

## Notes on cost

Each voice note costs two Groq calls (transcription + the combined
summary/keypoints/reply call), plus one more only if Translate gets
tapped. Still a fraction of a cent per note.

## Payments (Polar)

Gist Pro ($4.99/month) checkout is handled by Polar (polar.sh), which acts
as Merchant of Record — it handles international card payments and
pays out to Pakistan via Stripe Connect Express.

### Setup

1. Create a Polar account and organization at polar.sh
2. Test everything in sandbox mode first: sandbox.polar.sh, test card
   `4242 4242 4242 4242`
3. Create a "Gist Pro" product, $4.99/month recurring
4. Settings → Developers → create an access token
5. Add to `.env.local`:
   ```
   POLAR_ACCESS_TOKEN=your_sandbox_or_production_token
   POLAR_ENVIRONMENT=sandbox
   POLAR_GIST_PRO_PRODUCT_ID=the_product_id_from_step_3
   ```
6. Add the same three vars in Vercel's dashboard, redeploy

### Going live

Polar requires a manual merchant review (~2 weeks) before real payouts
work. Once approved:

1. Get a production access token from Polar (separate from your
   sandbox token)
2. Update `POLAR_ACCESS_TOKEN` and set `POLAR_ENVIRONMENT=production`
   in Vercel
3. Redeploy

### How it works

- `lib/polar.ts` — Polar SDK client, defaults to sandbox unless
  `POLAR_ENVIRONMENT=production` is explicitly set
- `app/api/checkout/route.ts` — creates a Polar checkout session and
  redirects the user to Polar's hosted checkout page
- `app/upgrade/success/page.tsx` — shown after a successful payment
- The "Upgrade to Gist Pro" button (shown when someone hits the free
  monthly limit) links straight to `/api/checkout`

### Next steps (real gap to know about)

**Also worth knowing**: only the web app enforces the free/Pro feature
split right now. The WhatsApp bot (`app/api/whatsapp/webhook/route.ts`)
still gives every voice note the full experience — summary, key points,
transcript, translate, quick reply — with no gating. Bringing the two
in line is worth doing before a wider WhatsApp push, but wasn't part of
this round of changes.

Right now, paying via this checkout flow does NOT automatically remove
the 5-notes-per-month limit — there's no accounts/login system yet to
know who paid, so there's nothing to unlock usage against. Closing this
gap needs one of:

- A lightweight login system (even just "enter your email" tied to a
  Polar customer record), so the app can check subscription status
- A Polar webhook (`checkout.updated` / subscription events) that marks
  a customer as active somewhere the app can check

Worth building once you're validating that people will actually pay —
no need to build accounts before that's proven.



Cut on purpose, to keep the product sharp and the failure surface small
for launch:

- Relationship memory / contact history
- Action item tracking with persistent status
- Weekly digests
- Search across past voice notes
- Any database at all

These are reasonable v2/premium ideas once the core five features are
proven and paying users ask for them — see your own launch roadmap
notes for the plan there (unlimited notes, longer notes, multi-language
translation, search, priority processing as paid tier candidates).
