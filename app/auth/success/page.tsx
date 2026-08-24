'use client';

import React, { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle2 } from 'lucide-react';

export default function AuthSuccessPage() {
  // Initializing the client here drops the session into localStorage,
  // which instantly triggers the listener in your original tab!
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Attempt to automatically close this tab after a few seconds
    const timer = setTimeout(() => {
      window.close();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/50">
      <div className="bg-white p-10 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-sm border border-gray-100 mx-4">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Your account is secure. You can now close this tab and return to your original window.
        </p>
        <button 
          onClick={() => window.close()}
          className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors w-full shadow-md"
        >
          Close this tab
        </button>
      </div>
    </div>
  );
}