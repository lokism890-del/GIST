import React from 'react';
import Link from 'next/link';

export default function PolicyPage({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      
      {/* Sticky Legal Header */}
      <header className="w-full px-6 py-4 border-b border-stone-200 bg-stone-50/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col text-left hover:opacity-70 transition-opacity">
            <span className="text-xl font-bold tracking-tight text-stone-900 leading-none">GIST</span>
            <span className="text-[9px] font-bold tracking-[0.25em] text-stone-500 uppercase mt-1">
              Voice Intelligence
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5 active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-12">{title}</h1>
        <div className="text-stone-700 leading-relaxed">
          {children}
        </div>
      </main>
    </div>
  );
}