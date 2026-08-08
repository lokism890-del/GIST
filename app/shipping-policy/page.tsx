import type { Metadata } from "next";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Shipping Policy — Gist Tech",
};

export default function ShippingPolicy() {
  return (
    <PolicyPage title="Shipping Policy" updated="August 2026">
      <h2>No physical shipping</h2>
      <p>
        Gist is a fully digital software service. We do not sell, ship, or deliver any
        physical products. There is no shipping process, shipping cost, or delivery
        time involved in using Gist.
      </p>

      <h2>How access is delivered</h2>
      <p>
        When you subscribe to Gist Pro, access to paid features is granted immediately
        and automatically upon successful payment — there is no waiting period, and
        nothing is mailed or physically delivered to you. You can start using your
        upgraded account right away through the Gist web app or WhatsApp.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href="mailto:lokism890@gmail.com">lokism890@gmail.com</a>.
      </p>
    </PolicyPage>
  );
}
