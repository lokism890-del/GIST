"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";

export default function UpdatePasswordPage() {
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      
      setIsSuccess(true);
      
      // Send them to the dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A111F] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-cyan-900/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md p-8 sm:p-12 rounded-3xl bg-[#0D1322]/95 border border-[#1E293B] shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 12L12 22L22 12L12 2Z" />
          </svg>
          <span className="text-xl font-bold tracking-tight text-white">GIST</span>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
          Set new password
        </h2>
        <p className="text-[13px] text-slate-400 mb-8">
          Please enter your new password below. Make it secure.
        </p>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-3 text-xs rounded-xl border font-medium bg-rose-500/10 border-rose-500/20 text-rose-300">
                {error}
              </div>
            </motion.div>
          )}
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-3 text-xs rounded-xl border font-medium bg-cyan-500/10 border-cyan-500/20 text-cyan-300">
                Password updated successfully! Redirecting...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-2">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={isSuccess}
                className="w-full bg-[#121A2B] border border-[#23314A] rounded-xl pl-11 pr-4 py-3.5 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#121A2B_inset]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full mt-4 bg-white text-[#03060D] font-semibold text-[13px] py-3.5 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin text-[#03060D]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              "Update Password"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}