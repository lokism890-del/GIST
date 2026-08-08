import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You're on Gist Pro — Gist Tech",
};

export default function UpgradeSuccess() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md">
        <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase mb-4">
          Payment confirmed
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-paper mb-4">
          You&rsquo;re on <span className="italic text-signal">Gist Pro</span>.
        </h1>
        <p className="text-paper-dim text-base mb-8">
          Unlimited voice notes, longer recordings, and priority processing are
          now unlocked. Thanks for supporting Gist.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center justify-center px-6 !rounded-full text-sm font-medium">
          Back to Gist
        </Link>
      </div>
    </main>
  );
}
