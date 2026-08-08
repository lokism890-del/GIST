import type { Metadata } from "next";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — Gist Tech",
};

export default function Terms() {
  return (
    <PolicyPage title="Terms & Conditions" updated="August 2026">
      <p>
        These terms govern your use of Gist, provided by Gist Tech (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By using Gist through our website or WhatsApp, you agree to
        these terms.
      </p>

      <h2>What Gist does</h2>
      <p>
        Gist is a software tool that transcribes and summarizes voice notes you submit,
        and provides key points, translations, and suggested replies. Results are
        generated automatically using AI and may occasionally contain errors — always
        review important content before relying on it.
      </p>

      <h2>Free and paid tiers</h2>
      <p>
        Gist offers a free tier with a limited number of voice notes per month, and a
        paid subscription tier (Gist Pro) with unlimited use and additional features,
        billed monthly. Pricing is shown on our website before you subscribe.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use Gist to:</p>
      <ul>
        <li>
          Process content that is illegal, abusive, or violates others&rsquo; privacy
          without consent
        </li>
        <li>Attempt to disrupt, reverse-engineer, or abuse the service</li>
        <li>Resell or redistribute Gist&rsquo;s output as your own product without permission</li>
      </ul>

      <h2>Account and billing</h2>
      <p>
        Subscription payments are processed by our payment gateway partner. By
        subscribing, you authorize recurring monthly charges until you cancel. See our{" "}
        <a href="/refund-policy">Refund Policy</a> for details on cancellations and
        billing corrections.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Gist is provided &ldquo;as is.&rdquo; We aren&rsquo;t liable for decisions made
        based on AI-generated summaries, transcripts, or suggested replies — these are
        aids, not guarantees of accuracy.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms occasionally. Continued use of Gist after changes
        means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a href="mailto:lokism890@gmail.com">lokism890@gmail.com</a>.
      </p>
    </PolicyPage>
  );
}
