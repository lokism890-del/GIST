"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthPage() {
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // Because Confirm Email is OFF, Supabase instantly creates a session.
        // We catch it here and instantly drop them into the dashboard.
        if (data.session) {
          window.location.href = "/";
        } else {
          // Fallback just in case
          setError("Account created! Please log in.");
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setError("Password reset link sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset link.");
    } finally {
      setIsLoading(false);
    }
  };

 const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // This tells Supabase to send Google back to our new route
          redirectTo: `${window.location.origin}/auth/callback`, 
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed");
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.25, delayChildren: 0.15 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: "spring" as const, stiffness: 350, damping: 28 } 
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A111F] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* Animated Ambient Background Glows */}
      <motion.div
        animate={{ x: ["-5%", "5%", "-5%"], y: ["-5%", "5%", "-5%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-0 w-full h-200 bg-cyan-900/15 blur-[140px] rounded-full pointer-events-none z-0"
      />
      <motion.div
        animate={{ x: ["5%", "-5%", "5%"], y: ["5%", "-5%", "5%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-0 w-full h-150 bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none z-0"
      />

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-265 rounded-3xl bg-[#0F1626]/90 border border-white/5 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] grid grid-cols-1 lg:grid-cols-2 overflow-hidden"
      >
        
        {/* LEFT SECTION: Auth Panel */}
        <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-center relative bg-[#0D1322] z-10">
          
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-white">GIST</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
            {isForgotPassword 
              ? "Reset password" 
              : isSignUp 
                ? "Create account" 
                : "Welcome back"}
          </h2>
          <p className="text-[13px] text-slate-400 mb-8">
            {isForgotPassword
              ? "Enter your email to receive a secure reset link."
              : isSignUp 
                ? "Join today to unlock powerful voice intelligence." 
                : "Log in to access your intelligence dashboard."}
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error-box"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div
                  className={`p-3 text-xs rounded-xl border font-medium ${
                    error.includes("sent") || error.includes("confirmation")
                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  }`}
                >
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Handling (Login/Signup vs Forgot Password) */}
          <form onSubmit={isForgotPassword ? handleResetPassword : handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-[#121A2B] border border-[#23314A] rounded-xl pl-11 pr-4 py-3.5 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#121A2B_inset]"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-between mb-2 mt-4">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Password
                  </label>
                  {!isSignUp && (
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(true); setError(null); }}
                      className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
                    required={!isForgotPassword}
                    className="w-full bg-[#121A2B] border border-[#23314A] rounded-xl pl-11 pr-4 py-3.5 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#121A2B_inset]"
                  />
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-white text-[#03060D] font-semibold text-[13px] py-3.5 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin text-[#03060D]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isForgotPassword ? (
                "Send Reset Link"
              ) : (
                <>
                  {isSignUp ? "Sign Up" : "Log In"}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {isForgotPassword ? (
            <div className="mt-8 text-center">
              <button
                onClick={() => { setIsForgotPassword(false); setError(null); }}
                className="text-[12px] text-slate-400 hover:text-white transition-colors"
              >
                ← Back to Log in
              </button>
            </div>
          ) : (
            <>
              <div className="relative my-7 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1E293B]" />
                </div>
                <span className="relative bg-[#0D1322] px-4 text-[10px] uppercase tracking-wider text-slate-500">
                  OR
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full bg-[#121A2B] border border-[#23314A] text-white font-medium text-[13px] py-3.5 rounded-xl hover:bg-[#1A2438] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <div className="mt-8 text-center text-[12px] text-slate-400">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-white font-medium hover:text-cyan-400 transition-colors ml-1"
                >
                  {isSignUp ? "Log in" : "Sign up"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT SECTION: Live Product Preview (Premium Deep Navy) */}
        <div className="hidden lg:flex p-12 bg-[#121A2B] border-l border-[#1E293B] relative items-center justify-center overflow-hidden">
          
          {/* Animated Background Soundwaves (Subtle & Elegant) */}
          <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-[0.035] pointer-events-none z-0">
            {[140, 220, 180, 260, 200, 300, 240, 280, 160].map((baseHeight, i) => (
              <motion.div 
                key={i}
                animate={{ height: [`${baseHeight}px`, `${baseHeight * 1.35}px`, `${baseHeight}px`] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
                className="w-7 bg-white rounded-full" 
              />
            ))}
          </div>
          
          {/* Animated UI Mockup */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full max-w-sm flex flex-col gap-4 relative z-10"
          >
            {/* Step 1: Voice Recording Bubble */}
            <motion.div variants={itemVariants} className="self-end bg-[#162136] border border-[#23314A] rounded-2xl p-4 w-full flex items-center justify-between shadow-lg">
              <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#03060D]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <div className="flex-1 px-5 h-6 flex items-center gap-0.75 justify-center">
                {[4, 8, 5, 10, 6, 12, 5, 9, 4, 7, 3].map((h, i) => (
                  <motion.div 
                    key={i} 
                    animate={{ height: [`${h * 1.8}px`, `${h * 3.2}px`, `${h * 1.8}px`] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                    className="w-0.75 bg-cyan-400 rounded-full" 
                  />
                ))}
              </div>
              <span className="text-[11px] text-cyan-400 font-mono font-bold tracking-wide">0:55</span>
            </motion.div>

            {/* Step 2: Processing State */}
            <motion.div variants={itemVariants} className="self-start bg-[#162136] border border-[#23314A] rounded-2xl p-5 w-[85%] shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-4 h-4 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-[12px] text-white font-medium">Extracting intelligence...</span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1 w-full bg-[#1E293B] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "10%" }}
                  animate={{ width: "65%" }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="h-full bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)]" 
                />
              </div>
            </motion.div>

            {/* Step 3: Action Items */}
            <motion.div variants={itemVariants} className="self-start bg-[#162136] border border-[#23314A] rounded-2xl p-5 w-full shadow-lg">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#23314A]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
                  </svg>
                  Action Items
                </span>
                <span className="px-2 py-0.5 rounded border border-[#23314A] bg-[#0F1626] text-[9px] text-slate-400">
                  Just now
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded bg-cyan-500 mt-0.5 shrink-0 flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                    <svg className="w-2.5 h-2.5 text-[#03060D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[12px] text-white leading-relaxed">Send the Q3 marketing funnel report to Sarah by EOD.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded border border-slate-600 mt-0.5 shrink-0" />
                  <span className="text-[12px] text-slate-400 leading-relaxed">Schedule a sync with the backend engineering team for Tuesday.</span>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}