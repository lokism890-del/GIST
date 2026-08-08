import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-stone-50 border-t border-stone-200 text-stone-500 py-12 px-6 transition-colors duration-300 d-header d-border d-text-secondary">
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
        
        {/* Left Side: Branding & Copyright */}
        <div className="flex flex-col items-center sm:items-start gap-2">
          <Link href="/" className="flex flex-col text-center sm:text-left hover:opacity-70 transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
            <span className="text-xl font-bold tracking-tight text-stone-900 leading-none d-text-primary">GIST</span>
            <span className="text-[9px] font-bold tracking-[0.25em] text-stone-400 uppercase mt-1 d-text-secondary">
              Voice Intelligence
            </span>
          </Link>
          <p className="text-xs text-stone-400 mt-3 d-text-secondary">
            © {new Date().getFullYear()} GIST. All rights reserved.
          </p>
        </div>

        {/* Right Side: Links & Support */}
        <div className="flex flex-col items-center sm:items-end gap-4">
          <div className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-3 text-sm font-medium">
            <Link href="/privacy-policy" className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 d-hover-text">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 d-hover-text">Terms of Service</Link>
            <Link href="/refund-policy" className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 d-hover-text">Refund Policy</Link>
            <a href="mailto:lokism890@gmail.com" className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 d-hover-text">Support</a>
          </div>
        </div>

      </div>
    </footer>
  );
}