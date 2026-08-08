import type { Metadata } from "next";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Refund Policy — Gist Tech",
};

export default function RefundPolicy() {
  return (
    <PolicyPage title="Refund Policy" updated="August 2026">
      <p>This policy applies to Gist Pro, the paid monthly subscription tier of Gist.</p>

      <h2>No-refund policy</h2>
      <p>
        Gist Tech operates a no-refund policy for Gist Pro subscription payments.
        Because access to paid features is granted immediately upon payment and usage
        is metered per billing cycle, subscription charges are non-refundable once
        processed.
      </p>

      <h2>Cancelling your subscription</h2>
      <p>
        You can cancel your Gist Pro subscription at any time from within the app, or
        by emailing us. Cancelling stops all future billing — it does not refund the
        current billing period you&rsquo;ve already paid for. You&rsquo;ll continue to
        have Gist Pro access until the end of the period you&rsquo;ve already paid for.
      </p>

      <h2>Billing errors</h2>
      <p>
        If you believe you were charged in error — for example, charged twice for the
        same period, or charged after you cancelled — contact us and we&rsquo;ll
        investigate and correct genuine billing mistakes.
      </p>

      <h2>Contact</h2>
      <p>
        For billing questions, email{" "}
        <a href="mailto:lokism890@gmail.com">lokism890@gmail.com</a>.
      </p>
    </PolicyPage>
  );
}
