'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useSearchParams, useRouter } from 'next/navigation';

// Custom SVG for the 4-point premium star
const StarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
  </svg>
);

// Google Social Icon
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'verified'>('idle');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('verified');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Handle standard email/password authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ 
        email,
        password,
        options: { 
          emailRedirectTo: `${typeof window !== 'undefined' ? location.origin : ''}/auth/callback?next=/` 
        }
      });
      
      if (!error) {
        setStatus('sent');
      } else {
        setStatus('idle');
        alert(error.message);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ 
        email,
        password
      });
      
      if (!error) {
        // The onAuthStateChange listener catches this and routes home
      } else {
        setStatus('idle');
        alert(error.message);
      }
    }
  };

  // Handle Google OAuth
  const handleGoogleLogin = async () => {
    setStatus('loading');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/`
      }
    });
    if (error) {
      setStatus('idle');
      alert(error.message);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 w-screen h-screen flex items-center justify-center p-4 font-sans overflow-y-auto overflow-x-hidden"
      style={{
        background: `
          radial-gradient(circle at 25% 20%, rgba(255,255,255,.9), transparent 32%),
          radial-gradient(circle at 80% 70%, rgba(210,214,220,.45), transparent 35%),
          #E7E7E4
        `
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full rounded-3xl p-8 sm:p-10 my-auto"
        style={{
          maxWidth: '620px',
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)', // Safari support
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: `
            0 25px 70px rgba(20, 25, 35, 0.08), 
            0 4px 12px rgba(20, 25, 35, 0.04), 
            inset 0 1px 0 rgba(255, 255, 255, 0.9)
          `
        }}
      >
        {/* Full Brand Lockup Logo */}
        <div className="flex flex-col items-center justify-center mb-10 mt-2">
          <div className="flex items-center gap-2 mb-1.5">
            <StarIcon className="w-5 h-5 text-slate-900" />
            <span className="text-[28px] font-black text-slate-900 tracking-tight">GIST</span>
          </div>
          <span className="text-[9px] font-extrabold tracking-[0.35em] text-slate-500 uppercase ml-1">
            Voice Intelligence
          </span>
        </div>

        {status === 'verified' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-4 py-8"
          >
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-2 relative">
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                className="absolute inset-0 bg-slate-900 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(15,23,42,0.2)]"
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-black text-slate-900">Verified!</h2>
            <p className="text-slate-500 text-sm font-medium">
              Authentication complete. Preparing your dashboard...
            </p>
          </motion.div>
        ) : status === 'sent' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-4 py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-slate-300 mb-2" />
            <h2 className="text-2xl font-black text-slate-900">Check your inbox</h2>
            <p className="text-slate-500 text-sm font-medium">
              We sent a secure verification link to <span className="font-bold text-slate-900">{email}</span>. Click it to complete sign up.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Welcome & Context Header */}
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-2">
                {mode === 'login' 
                  ? 'Log in to continue to your intelligence dashboard.' 
                  : 'Start transforming your voice notes into actionable intelligence.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              
              {/* Taller, Refined Email Input */}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-14 px-5 rounded-xl bg-slate-100/50 border border-slate-200/60 text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100/50 transition-all shadow-inner"
                />
              </div>

              {/* Taller, Refined Password Input */}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Password</label>
                <input
                  type="password"
                  placeholder="•••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-14 px-5 rounded-xl bg-slate-100/50 border border-slate-200/60 text-[15px] font-bold tracking-[0.2em] text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100/50 transition-all shadow-inner"
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full h-14 mt-8 flex items-center justify-center gap-2 bg-[#0F111A] hover:bg-[#1A1D2D] disabled:bg-slate-300 text-white font-extrabold uppercase tracking-widest text-[12px] rounded-xl shadow-[0_10px_20px_rgba(15,23,42,0.15)] transition-all active:scale-95"
              >
                {status === 'loading' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <span>{mode === 'login' ? 'Log in' : 'Create Account'}</span>
                )}
              </button>
            </form>

            {/* OR Divider */}
            <div className="mt-8 mb-6 relative flex items-center">
              <div className="grow border-t border-slate-200/80"></div>
              <span className="shrink-0 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                or continue with
              </span>
              <div className="grow border-t border-slate-200/80"></div>
            </div>

            {/* Fully Functional Single Google Button */}
            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-14 flex items-center justify-center gap-3 border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all bg-white/60 font-extrabold text-[12px] uppercase tracking-widest text-slate-700 shadow-sm active:scale-95"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Footer Links & Trust Line */}
            <div className="mt-10 flex flex-col items-center gap-6">
              <div className="flex items-center text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} 
                  className="text-slate-500 hover:text-slate-900 transition-colors"
                >
                  {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                </button>
                {mode === 'login' && (
                  <>
                    <span className="mx-3 text-slate-300">•</span>
                    <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors">
                      Forgot password?
                    </a>
                  </>
                )}
              </div>

              <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                Secure authentication &middot; Your data stays private
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-50 w-screen h-screen flex items-center justify-center bg-[#EAECEF]">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}