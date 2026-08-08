import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-hairline mt-16">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <FooterLink href="/privacy-policy">Privacy Policy</FooterLink>
          <FooterLink href="/refund-policy">Refund Policy</FooterLink>
          <FooterLink href="/terms">Terms &amp; Conditions</FooterLink>
          <FooterLink href="/shipping-policy">Shipping Policy</FooterLink>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate border-t border-hairline pt-6">
          <div className="flex flex-col gap-1">
            <span>
              Email:{" "}
              <a href="mailto:lokism890@gmail.com" className="text-paper-dim hover:text-signal">
                lokism890@gmail.com
              </a>
            </span>
            <span>
              Phone:{" "}
              <a href="tel:+923357333789" className="text-paper-dim hover:text-signal">
                +92 335 7333789
              </a>
            </span>
            <span className="text-paper-dim">
              Address: Dk Mehdi, Burhan, Hassan Abdal, Pakistan
            </span>
          </div>
          <span>© 2026 Gist Tech. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-slate hover:text-signal transition-colors">
      {children}
    </Link>
  );
}
