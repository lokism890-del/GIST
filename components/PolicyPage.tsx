import React from 'react';

// The addition of isDarkMode?: boolean; here fixes the TypeScript error permanently.
interface PolicyPageProps {
  title: string;
  children: React.ReactNode;
  isDarkMode?: boolean; 
}

export default function PolicyPage({ title, children, isDarkMode = true }: PolicyPageProps) {
  return (
    <div className={`min-h-screen font-sans selection:bg-emerald-500/30 ${isDarkMode ? 'bg-[#0B0F18] text-[#F1F5F9]' : 'bg-white text-[#1D1D1F]'}`}>
      <header className={`py-6 px-8 flex justify-between items-center border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>
          Voice Intelligence
        </span>
        <a 
          href="/" 
          className={`text-sm font-medium flex items-center gap-2 transition-colors ${isDarkMode ? 'text-[#F1F5F9] hover:text-emerald-400' : 'text-[#1D1D1F] hover:text-emerald-600'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </a>
      </header>

      <main className="max-w-3xl mx-auto py-16 px-6 sm:px-8">
        <h1 className={`text-4xl font-bold tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}