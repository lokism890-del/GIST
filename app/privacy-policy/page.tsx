import type { Metadata } from "next";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Gist Tech",
};

export default function PrivacyPolicy() {
  return (
    <PolicyPage title="Privacy Policy" updated="August 2026">
      <p>
        Gist Tech (&ldquo;we&rdquo;, &ldquo;us&rdquo;) builds Gist, a voice-note assistant
        available through WhatsApp and the web. This policy explains what
        information we handle and how.
      </p>

      <h2>What we process</h2>
      <ul>
        <li>Voice notes you send to Gist, solely to transcribe, summarize, and translate them</li>
        <li>Your WhatsApp phone number, to send replies back to the correct chat</li>
        <li>
          The text and audio content of your voice notes, sent to our transcription and
          language-processing provider (Groq) to generate results
        </li>
        <li>
          Payment information when you subscribe to Gist Pro, collected and processed
          directly by our payment gateway partner — Gist Tech does not store full card
          numbers
        </li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>We don&rsquo;t sell or share your voice notes or phone number with advertisers</li>
        <li>We don&rsquo;t use your voice notes to train any AI models</li>
        <li>We don&rsquo;t read or process messages you haven&rsquo;t sent directly to Gist</li>
      </ul>

      <h2>How long we keep data</h2>
      <p>
        Voice notes and transcripts are processed to generate your summary and are not
        stored permanently by Gist Tech beyond what&rsquo;s needed to complete that
        request.
      </p>

      <h2>Third parties</h2>
      <p>
        We use Groq for audio transcription and language processing, Meta&rsquo;s
        WhatsApp Business Platform to send and receive messages, and a licensed
        Pakistani payment gateway to process Gist Pro subscription payments. Each
        handles data under their own privacy terms in addition to this policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data can be sent to{" "}
        <a href="mailto:lokism890@gmail.com">lokism890@gmail.com</a>.
      </p>
    </PolicyPage>
  );
}
