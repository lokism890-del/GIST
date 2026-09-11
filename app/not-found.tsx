"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#0A111F] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-900/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-md"
      >
        <div className="flex items-center gap-3 mb-6 opacity-80">
          <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 12L12 22L22 12L12 2Z" />
          </svg>
        </div>

        <h1 className="text-6xl font-bold tracking-tight text-white mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          404
        </h1>
        
        <h2 className="text-xl font-semibold text-slate-200 mb-2">
          Page not found
        </h2>
        
        <p className="text-[13px] text-slate-400 mb-8 leading-relaxed">
          The intelligence you are looking for doesn't exist or has been moved to a different sector.
        </p>

        <Link 
          href="/"
          className="bg-[#121A2B] border border-[#23314A] text-white font-medium text-[13px] px-8 py-3.5 rounded-xl hover:bg-[#1A2438] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}