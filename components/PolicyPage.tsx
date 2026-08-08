import Link from "next/link";

export default function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-6 py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-xs font-mono text-slate hover:text-signal transition-colors inline-flex items-center gap-1 mb-10"
        >
          ← Back to Gist
        </Link>

        <h1 className="font-display text-3xl sm:text-4xl text-paper mb-2">{title}</h1>
        <p className="text-xs text-slate mb-10">Last updated: {updated}</p>

        <div className="policy-content flex flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
