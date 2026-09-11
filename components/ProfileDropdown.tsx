"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { User } from "@supabase/supabase-js";

export default function ProfileDropdown() {
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch the current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (!user) return null; // Or a loading skeleton

  const userInitial = user.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Unique Diamond Avatar Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-9 h-9 focus:outline-none ml-2"
        aria-label="User menu"
      >
        <div className={`absolute inset-0 bg-[#0D1322] border transition-all duration-300 rounded-lg transform rotate-45 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] ${isOpen ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-[#1E293B] group-hover:border-cyan-500/30'}`} />
        <span className="relative z-10 transform -rotate-45 text-cyan-400 font-bold text-sm tracking-widest">
          {userInitial}
        </span>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute right-0 mt-4 w-64 bg-[#0A111F]/95 backdrop-blur-xl border border-[#1E293B] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden z-50"
          >
            {/* User Info Header */}
            <div className="p-4 border-b border-[#1E293B] bg-[#0D1322]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#121A2B] border border-[#23314A] rounded-lg transform rotate-45 flex items-center justify-center shrink-0">
                  <span className="transform -rotate-45 text-cyan-400 font-bold text-lg">
                    {userInitial}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-white font-medium text-sm truncate" title={user.email}>
                    {user.email}
                  </p>
                  <p className="text-cyan-500/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    Free Plan
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Links */}
            <div className="p-2 space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-[#121A2B] rounded-xl transition-colors">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Account Settings
              </button>
            </div>

            {/* Sign Out Action */}
            <div className="p-2 border-t border-[#1E293B]">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}