"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#F8F9FA] dark:bg-[#0B0F18] border-t border-black/5 dark:border-[rgba(255,255,255,0.04)] py-12 px-6 relative overflow-hidden z-10 transition-colors duration-300">
      {/* Extremely subtle footer glow matching the premium platinum/graphite theme */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-150px bg-black/5 dark:bg-[#1A2235]/30 blur-[100px] pointer-events-none -z-10"></div>

      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left Side: Brand */}
        <div className="flex flex-col items-center md:items-start gap-1.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111827] dark:bg-[#F3F1EC] flex items-center justify-center shadow-sm transition-colors">
              <svg className="w-4 h-4 text-white dark:text-[#0B0F18]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 10v4m4-8v12m4-10v8m4-12v16m4-10v4" />
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight text-[#111827] dark:text-[#F3F1EC] transition-colors">GIST</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest text-[#6B7280] dark:text-[#8B95A5] uppercase ml-1 transition-colors">
            Voice Intelligence
          </span>
        </div>

        {/* Right Side: Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#98A0B2]">
          {[
            { name: 'Privacy Policy', path: '/privacy-policy' },
            { name: 'Terms of Service', path: '/terms' },
            { name: 'Refund Policy', path: '/refund-policy' },
            { name: 'Support', path: '#support' } // Correctly targeting the new Support section
          ].map((link) => (
            <motion.div key={link.name} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Link href={link.path} className="hover:text-[#111827] dark:hover:text-[#F3F1EC] transition-colors duration-300">
                {link.name}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-10 text-center md:text-left text-[10px] font-bold tracking-widest uppercase text-[#6B7280]/70 dark:text-[#98A0B2]/70 transition-colors">
        &copy; {currentYear} GIST. All rights reserved.
      </div>
    </footer>
  );
}