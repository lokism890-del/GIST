'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthModal({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/upgrade` }
    });
    
    if (!error) {
      setStatus('sent');
      if (onSuccess) onSuccess();
    } else {
      setStatus('idle');
      alert(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center bg-white/90 backdrop-blur-xl border border-gray-200/60 shadow-2xl rounded-3xl p-10 w-full max-w-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Secure Access</h2>
      <p className="text-sm text-gray-500 text-center mb-8">
        Create an account to unlock Pro features and secure your history.
      </p>
      
      {status === 'sent' ? (
        <div className="text-emerald-600 font-medium text-center p-4 bg-emerald-50 rounded-xl w-full">
          Secure link sent! Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input 
            type="email" 
            placeholder="name@company.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            required
          />
          <button 
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 rounded-xl shadow-lg transition-colors"
          >
            {status === 'loading' ? 'Sending...' : 'Continue securely'}
          </button>
        </form>
      )}
    </div>
  );
}