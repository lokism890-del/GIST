"use client";

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';

interface SummarizeResult {
  summary?: string;
  keyPoints?: string | string[];
  actionItems?: string | string[];
  suggestedReply?: any;
  transcript?: string;
  language?: string;
}

interface UserEntitlements {
  tier: 'FREE' | 'PRO';
  usageCount: number;
  usageLimit: number;
}

const PROCESSING_STAGES = ["Recording complete", "Uploading", "Transcribing", "Understanding", "Preparing Intelligence"];

const springTransition = { type: "spring" as const, stiffness: 350, damping: 26 };
const snappyEase = [0.2, 0.8, 0.2, 1] as const;
const buttonSpring = { type: "spring" as const, stiffness: 400, damping: 25 };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: snappyEase } } };
const bgTextReveal = { hidden: { opacity: 0, y: 50, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: snappyEase } } };
const fadeUpBlur = { hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: snappyEase } } };

export default function Page() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [user, setUser] = useState<any>(null);
  const [justVerified, setJustVerified] = useState(false);
  
  // Track previous session state to prevent loop on tab switch
  const prevUserRef = useRef<any>(null);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SummarizeResult | null>(null);
  const [lastAudioData, setLastAudioData] = useState<Blob | File | null>(null);
  
  const [activeTone, setActiveTone] = useState<string>('Professional');
  const [isRegeneratingReply, setIsRegeneratingReply] = useState(false);
  
  const [activeSection, setActiveSection] = useState('home');
  const [entitlements, setEntitlements] = useState<UserEntitlements>({ tier: 'FREE', usageCount: 0, usageLimit: 5 });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const visualizerRef = useRef<HTMLDivElement>(null); 
  const bgRef = useRef<HTMLDivElement>(null);
  
  const prefersReducedMotion = useReducedMotion();

  // Bulletproof Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      prevUserRef.current = currentUser;
      setUser(currentUser);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' && !prevUserRef.current && currentUser) {
        setJustVerified(true);
        setTimeout(() => setJustVerified(false), 2000); 
      }
      
      prevUserRef.current = currentUser;
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('gist_theme');
    if (storedTheme === 'light') setIsDarkMode(false);
  }, []);

  const handleThemeToggle = () => {
    setIsDarkMode((prevTheme) => {
      const newTheme = !prevTheme;
      localStorage.setItem('gist_theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  useEffect(() => {
    if (!isDarkMode) return;
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (!bgRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      rafId = requestAnimationFrame(() => {
        bgRef.current?.style.setProperty('--mouse-x', `${x}px`);
        bgRef.current?.style.setProperty('--mouse-y', `${y}px`);
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [isDarkMode]);

  useEffect(() => {
    // 1. Check local storage for anonymous users
    const localUsage = parseInt(localStorage.getItem('gist_free_usage') || '0', 10);

    if (user) {
      // 2. If logged in, fetch from the database
      fetch('/api/user/entitlements')
        .then(res => res.ok ? res.json() : null)
        .then(data => { 
          if (data && typeof data.usageCount === 'number') {
            setEntitlements(data); 
          }
        })
        .catch(() => setEntitlements({ tier: 'FREE', usageCount: localUsage, usageLimit: 5 }));
    } else {
      // 3. If NOT logged in, use the browser's local memory
      setEntitlements({ tier: 'FREE', usageCount: localUsage, usageLimit: 5 });
    }
  }, [user]); // This re-runs automatically when someone logs in or out

  useEffect(() => {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); });
    }, { threshold: 0.3 });
    ['home', 'features', 'faq', 'pricing'].forEach(id => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
    return () => sectionObserver.disconnect();
  }, [results]);

  useEffect(() => {
    if (!isProcessing) { setProcessingStageIndex(0); return; }
    const interval = setInterval(() => setProcessingStageIndex(prev => prev < PROCESSING_STAGES.length - 1 ? prev + 1 : prev), 450); 
    return () => clearInterval(interval);
  }, [isProcessing]);

  const startRecording = async () => {
    if (entitlements.tier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
      setError("Monthly Free tier limit reached (5/5). Please upgrade to Pro for unlimited processing.");
      return;
    }
    setError(null); setResults(null); setActiveTone('Professional');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        if (visualizerRef.current) {
          visualizerRef.current.style.transform = `scale(${1 + (average / 255) * 0.45})`;
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => processAudio(new Blob(audioChunksRef.current, { type: 'audio/webm' }));

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

    } catch (err) {
      setError('Microphone access is required to record. Please check permissions.');
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(console.error);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    stopRecordingCleanup();
  };

  const processAudio = async (audioData: Blob | File) => {
    if (entitlements.tier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
      setError("Monthly Free limit reached (5/5). Upgrade to Pro to process this voice note.");
      return;
    }

    const isFile = 'name' in audioData;
    setLastAudioData(audioData); setIsProcessing(true); setProcessingStageIndex(isFile ? 1 : 0); setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', isFile ? audioData : new File([audioData], 'recording.webm'));

      const [response] = await Promise.all([
        fetch('/api/summarize', { method: 'POST', body: formData }),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Processing failed (Status ${response.status})`);
      }

      const data: SummarizeResult = await response.json();
      setProcessingStageIndex(PROCESSING_STAGES.length - 1);
      setTimeout(() => {
        setResults(data); 
        setIsProcessing(false);
        
        // Increase the usage count and save it locally if anonymous
        if (entitlements.tier === 'FREE') {
          setEntitlements(prev => {
            const newCount = Math.min(prev.usageLimit, prev.usageCount + 1);
            if (!user) {
              localStorage.setItem('gist_free_usage', newCount.toString());
            }
            return { ...prev, usageCount: newCount };
          });
        }
      }, 250);
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing your audio.');
      setIsProcessing(false);
    }
  };

  const handleChangeTone = (tone: string) => {
    setActiveTone(tone); setIsRegeneratingReply(true);
    setTimeout(() => setIsRegeneratingReply(false), 400);
  };

  const handleCopyEverything = () => {
    if (!results) return;
    const currentReply = typeof results.suggestedReply === 'object' && results.suggestedReply !== null ? results.suggestedReply[activeTone.toLowerCase()] : results.suggestedReply;
    const textToCopy = `GIST SUMMARY\n\n${results.summary || ''}\n\nKEY POINTS\n${Array.isArray(results.keyPoints) ? results.keyPoints.join('\n') : results.keyPoints || ''}\n\nACTION ITEMS\n${Array.isArray(results.actionItems) ? results.actionItems.join('\n') : results.actionItems || ''}\n\nSUGGESTED REPLY (${activeTone})\n${currentReply || ''}\n\nTRANSCRIPT\n${results.transcript || ''}`;
    navigator.clipboard.writeText(textToCopy);
  };

  const handleDownloadTXT = () => {
    if (!results) return;
    const currentReply = typeof results.suggestedReply === 'object' && results.suggestedReply !== null ? results.suggestedReply[activeTone.toLowerCase()] : results.suggestedReply;
    const textToCopy = `GIST SUMMARY\n\n${results.summary || ''}\n\nKEY POINTS\n${Array.isArray(results.keyPoints) ? results.keyPoints.join('\n') : results.keyPoints || ''}\n\nACTION ITEMS\n${Array.isArray(results.actionItems) ? results.actionItems.join('\n') : results.actionItems || ''}\n\nSUGGESTED REPLY (${activeTone})\n${currentReply || ''}\n\nTRANSCRIPT\n${results.transcript || ''}`;
    const blob = new Blob([textToCopy], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Gist_Export_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!results) return;
    const currentReply = typeof results.suggestedReply === 'object' && results.suggestedReply !== null ? results.suggestedReply[activeTone.toLowerCase()] : results.suggestedReply;
    const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;
    const csvContent = [
      ['Category', 'Content'],
      ['Summary', escapeCSV(results.summary || '')],
      ['Key Points', escapeCSV(Array.isArray(results.keyPoints) ? results.keyPoints.join('; ') : results.keyPoints || '')],
      ['Action Items', escapeCSV(Array.isArray(results.actionItems) ? results.actionItems.join('; ') : results.actionItems || '')],
      ['Suggested Reply', escapeCSV(currentReply || '')],
      ['Transcript', escapeCSV(results.transcript || '')]
    ].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Gist_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) validateAndProcessFile(file);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (file) validateAndProcessFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateAndProcessFile = (file: File) => {
    if (entitlements.tier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
      setError("Monthly Free tier limit reached (5/5). Upgrade to Pro to continue uploading."); return;
    }
    if (!file.type.startsWith('audio/')) { setError('Please upload a valid audio file.'); return; }
    processAudio(file);
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const resetState = () => { setResults(null); setError(null); setRecordingTime(0); setLastAudioData(null); setActiveTone('Professional'); };

  const isNonEnglish = Boolean(results?.language && !['english', 'en'].includes(results.language.toLowerCase()));
  const remainingFreeUses = Math.max(0, entitlements.usageLimit - entitlements.usageCount);
  
  const hasActionItems = Boolean(
    results?.actionItems && Array.isArray(results.actionItems) && results.actionItems.length > 0 && 
    !results.actionItems.join('').toLowerCase().includes('none') && !results.actionItems.join('').toLowerCase().includes('no action')
  );

  return (
    <div className={`min-h-screen font-sans flex flex-col overflow-x-hidden relative ${isDarkMode ? 'text-[#F1F5F9] selection:bg-[#1E293B]/50' : 'text-[#1D1D1F] selection:bg-emerald-500/30'}`}>
      
      {/* VERIFIED OVERLAY */}
      <AnimatePresence>
        {justVerified && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-100 flex items-center justify-center backdrop-blur-md ${isDarkMode ? 'bg-[#0B0F18]/80' : 'bg-white/80'}`}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              className={`p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center ${isDarkMode ? 'bg-[#12151C] border border-white/10' : 'bg-white border border-black/10'}`}
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 relative">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                  className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </motion.div>
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Verified!</h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Proceeding to your dashboard...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PERFORMANCE OPTIMIZED GPU BACKGROUND ARCHITECTURE */}
      <div className="fixed inset-0 -z-20 bg-[#F5F5F7]" />
      
      <AnimatePresence>
        {isDarkMode && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 -z-10 overflow-hidden bg-[#0B0F18]"
          >
            <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['-2%', '3%', '-2%'], y: ['-3%', '2%', '-3%'] }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} className="absolute top-[-20%] -left-10 w-[120vw] h-[120vh] bg-[radial-gradient(ellipse_at_center,rgba(11,19,43,0.35)_0%,transparent_50%)]" />
            <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['3%', '-2%', '3%'], y: ['2%', '-3%', '2%'] }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }} className="absolute top-10 -right-10 w-screen h-screen bg-[radial-gradient(ellipse_at_center,rgba(26,24,50,0.25)_0%,transparent_50%)]" />
            <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['-1%', '2%', '-1%'], y: ['2%', '-1%', '2%'] }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} className="absolute -bottom-10 left-[20%] w-screen h-screen bg-[radial-gradient(ellipse_at_center,rgba(42,38,51,0.2)_0%,transparent_50%)]" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.04] mix-blend-overlay pointer-events-none" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#noiseFilter)" /></svg>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F18_130%)] pointer-events-none" />
            <div ref={bgRef} className="absolute inset-0 opacity-[0.035] pointer-events-none" style={{ background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,1), transparent 40%)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING CAPSULE HEADER */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: snappyEase }} 
        className={`fixed top-3 left-1/2 -translate-x-1/2 w-[92%] max-w-350 z-50 rounded-2xl backdrop-blur-xl border transition-colors duration-300 shadow-sm ${
          isDarkMode ? 'bg-[#0B0F18]/85 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]' : 'bg-white/85 border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-3 relative">
          
          {/* LOGO */}
          <div className="flex flex-1 items-center justify-start">
            <motion.a href="#home" className="flex items-center gap-2.5 group" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={buttonSpring}>
              <svg className={`w-5 h-5 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-[#1D1D1F]'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1.5L1.5 12L12 22.5L22.5 12L12 1.5ZM12 4.5L19.5 12L12 19.5L4.5 12L12 4.5Z" />
              </svg>
              <span className={`text-[19px] font-extrabold tracking-tight transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-[#1D1D1F]'}`}>GIST</span>
            </motion.a>
          </div>
          
          {/* CENTER NAVIGATION */}
          <nav className={`hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 text-[11px] font-bold uppercase tracking-widest transition-colors duration-300`}>
            {['home', 'features', 'faq', 'pricing'].map((id) => {
              const isActive = activeSection === id;
              return (
                <a key={id} href={`#${id}`} className={`relative group py-2 transition-colors duration-200 ease-out ${
                  isActive 
                    ? (isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]') 
                    : (isDarkMode ? 'text-[#64748B] hover:text-[#F1F5F9]' : 'text-[#86868B] hover:text-[#1D1D1F]')
                }`}>
                  {id}
                  {isActive && (
                    <motion.div layoutId="navIndicator" className={`absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full ${isDarkMode ? 'bg-[#F1F5F9]' : 'bg-[#1D1D1F]'}`} />
                  )}
                </a>
              );
            })}
          </nav>
          
          {/* RIGHT ACTION CLUSTER */}
          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-5">
            
            {/* PREMIUM PILL THEME TOGGLE */}
            <button
              onClick={handleThemeToggle}
              className={`relative flex items-center h-6.5 w-13 shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out focus:outline-none overflow-hidden shadow-inner ${
                isDarkMode ? 'bg-[#0F172A] border border-white/5' : 'bg-[#E2E8F0] border border-black/5'
              }`}
              aria-label="Toggle Theme"
            >
              <span
                className={`pointer-events-none absolute left-0.75 h-5 w-5 transform rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-transform duration-500 ease-in-out flex items-center justify-center overflow-hidden z-10 bg-white ${
                  isDarkMode ? 'translate-x-6.5' : 'translate-x-0'
                }`}
              >
                <AnimatePresence mode="wait">
                  {isDarkMode ? (
                    <motion.svg key="moon" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.2 }} className="w-3 h-3 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </motion.svg>
                  ) : (
                    <motion.svg key="sun" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.2 }} className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </motion.svg>
                  )}
                </AnimatePresence>
              </span>
            </button>

            {/* HEADER AUTHENTICATION & TIERS - STRICTLY SIGN OUT ONLY IF LOGGED IN */}
            <div className={`hidden sm:flex items-center gap-3 pl-3 border-l transition-colors duration-200 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
              
              {entitlements.tier === 'PRO' ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-sm ${isDarkMode ? 'bg-[#0B0F18] border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkMode ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-emerald-500'}`} /><span>Pro Active</span>
                </motion.div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`hidden md:flex items-center px-3 py-1.5 rounded-full border text-[10px] font-semibold tracking-widest ${isDarkMode ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-gray-50 border-black/5 text-gray-500'}`}>
                    FREE &middot; <strong className={`ml-1 ${isDarkMode ? 'text-white' : 'text-[#1D1D1F]'}`}>{remainingFreeUses}/5 LEFT</strong>
                  </div>
                  
                  <form action="/api/checkout" method="POST">
                    <input type="hidden" name="plan" value="pro" />
                    <motion.button 
                      whileHover={{ y: -1 }} 
                      whileTap={{ scale: 0.97 }} 
                      transition={buttonSpring} 
                      type="submit" 
                      className={`relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-shadow ${
                        isDarkMode 
                          ? 'bg-[#F8FAFC] text-[#0B0F18] shadow-[0_0_20px_rgba(255,255,255,0.1),inset_0_-2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]' 
                          : 'bg-[#1D1D1F] text-white shadow-[0_8px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.2)]'
                      }`}
                    >
                      <span className={isDarkMode ? "text-emerald-600" : "text-amber-400"}>✦</span> 
                      <span>Upgrade</span>
                      <motion.div 
                        animate={{ x: ['-100%', '200%'] }} 
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }} 
                        className="absolute top-0 bottom-0 w-1/2 bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none" 
                      />
                    </motion.button>
                  </form>
                </div>
              )}

              {/* Show Sign Out ONLY when logged in */}
              {user && (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors px-4 py-1.5 rounded-full border ${
                    isDarkMode ? 'bg-white/10 text-white border-white/5 hover:bg-white/20' : 'bg-black/5 text-black border-black/5 hover:bg-black/10'
                  }`}
                >
                  Sign out
                </button>
              )}
            </div>

          </div>
        </div>
      </motion.header>

      <main id="home" className="relative flex-1 w-full max-w-4xl mx-auto pt-36 pb-24 px-5 sm:px-8 flex flex-col items-center justify-center min-h-screen">
        
        {/* SLEEK FLOATING ACTION BUTTONS (Right Center) - Shown ONLY when NOT signed in */}
     {/* SLEEK FLOATING ACTION BUTTONS (Right Center) - Shown ONLY when NOT signed in */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, type: 'spring', damping: 20 }}
            className="fixed right-4 sm:right-8 md:right-12 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-4 z-40"
          >
            {/* Primary Action: Sign Up */}
            <div className="relative group">
              {/* Vibrant ambient glow acting like a light source behind the glass */}
              <div className={`absolute -inset-1 blur-xl rounded-2xl pointer-events-none transition-opacity duration-500 opacity-30 group-hover:opacity-60 ${isDarkMode ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
              
              <a
                href="/auth?mode=signup"
                className={`relative flex items-center justify-center px-6 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-center transition-all duration-300 outline-none ${
                  isDarkMode 
                    ? 'bg-linear-to-b from-white/10 to-white/5 backdrop-blur-xl text-white shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:from-white/15 hover:to-white/10 hover:shadow-[0_8px_32px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95' 
                    : 'bg-linear-to-b from-white/60 to-white/30 backdrop-blur-xl text-gray-900 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:from-white/80 hover:to-white/50 hover:shadow-[0_8px_32px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,1)] hover:scale-105 active:scale-95'
                }`}
              >
                Sign up free
              </a>
            </div>
            
            {/* Secondary Action: Log In */}
            <a
              href="/auth?mode=login"
              className={`relative px-6 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-center transition-all duration-300 outline-none ${
                isDarkMode 
                  ? 'bg-white/5 backdrop-blur-md text-[#94A3B8] hover:text-white hover:bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95' 
                  : 'bg-white/20 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:scale-105 active:scale-95'
              }`}
            >
              Log in
            </a>
          </motion.div>
        )}

        <AnimatePresence>
          {error && !isProcessing && (
            <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} className="absolute top-28 w-full max-w-md p-4 bg-red-950/40 backdrop-blur-md border border-red-500/40 text-white text-xs rounded-xl flex items-center justify-between shadow-lg z-20">
              <div className="flex items-center gap-2.5"><svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>{error}</span></div>
              <button onClick={() => setError(null)} className="p-1 hover:opacity-70 transition-opacity ml-2 outline-none text-base">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {!isProcessing && !results && (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col items-center justify-center w-full max-w-lg mx-auto relative z-10 pt-10 pb-6">
            
            <AnimatePresence>
              {isDarkMode && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.9, 1.1, 0.9] }} exit={{ opacity: 0 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-1/4 left-1/2 -translate-x-1/2 w-125 h-125 bg-emerald-500/20 blur-[150px] rounded-full pointer-events-none z-[-1]" 
                />
              )}
            </AnimatePresence>

            {/* TYPOGRAPHY */}
            <div className="text-center flex flex-col items-center mb-10 mt-4 w-full">
              <motion.div variants={fadeUpBlur} className={`mb-6 relative group px-4 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-200 ${isDarkMode ? 'bg-[#0F172A]/80 border-emerald-500/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-white/80 border-emerald-200 text-emerald-600 shadow-sm'}`}>
                <span className="mr-2">✨</span>AI Voice Intelligence
              </motion.div>
              
              <motion.h2 variants={fadeUpBlur} className={`text-3xl sm:text-4xl font-bold tracking-tight mb-5 transition-colors duration-200 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>
                {isRecording ? formatTime(recordingTime) : "Ready to listen"}
              </motion.h2>
              
              <motion.p variants={fadeUpBlur} className={`text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed transition-colors duration-200 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>
                {isRecording ? "Listening closely... Tap the mic to process." : "Tap the microphone to start recording your thoughts."}
              </motion.p>
            </div>

            {/* THE MIC SECTION */}
            <motion.div variants={fadeUpBlur} className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56 mb-10 group">
              
              {!isRecording && (
                <motion.div 
                  animate={{ opacity: [0.3, 0.5, 0.3] }} 
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} 
                  className={`absolute inset-8 rounded-full blur-2xl pointer-events-none transition-colors duration-200 ${isDarkMode ? 'bg-emerald-500/30' : 'bg-emerald-400/20'}`}
                />
              )}

              {isRecording && (
                <motion.div 
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-4 bg-rose-500/30 blur-2xl rounded-full pointer-events-none"
                />
              )}
              {isRecording && <div ref={visualizerRef} className="absolute inset-0 bg-rose-500/20 rounded-full transition-transform duration-75 ease-out shadow-[0_0_60px_rgba(244,63,94,0.4)] pointer-events-none" aria-hidden="true" style={{ willChange: 'transform' }} />}

              <motion.button 
                whileHover={isRecording ? {} : { scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                transition={buttonSpring} 
                onClick={isRecording ? stopRecording : startRecording} 
                aria-label={isRecording ? "Stop recording" : "Start recording"} 
                className={`relative z-10 flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/50 
                  ${isRecording 
                    ? 'bg-rose-600 text-white shadow-[0_0_50px_rgba(244,63,94,0.8),inset_0_4px_10px_rgba(255,255,255,0.3)]' 
                    : isDarkMode 
                      ? 'bg-[#0B0F18]/90 backdrop-blur-2xl text-[#F1F5F9] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-[#161A23] hover:text-emerald-400 hover:border-emerald-500/20'
                      : 'bg-white text-[#1D1D1F] border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,1)] hover:bg-gray-50 hover:text-emerald-500 hover:border-emerald-500/20'
                  }`}
              >
                {!isRecording ? 
                  <svg className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors duration-300 ${isDarkMode ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] group-hover:drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> 
                  : 
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                }
              </motion.button>
            </motion.div>

            {/* UPLOAD SECTION */}
            {!isRecording && (
              <motion.div variants={fadeUpBlur} className="w-full relative group max-w-sm">
                <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <motion.button 
                  whileHover={{ y: -2 }} 
                  whileTap={{ scale: 0.98 }} 
                  transition={buttonSpring} 
                  onDragOver={handleDragOver} 
                  onDragLeave={handleDragLeave} 
                  onDrop={handleDrop} 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`relative w-full p-4 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer focus:outline-none border 
                    ${isDragging 
                      ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_40px_rgba(16,185,129,0.3)]' 
                      : isDarkMode 
                        ? 'border-white/5 bg-[#12151C]/40 backdrop-blur-sm hover:border-white/10 hover:bg-[#12151C]/80'
                        : 'border-black/5 bg-white/60 backdrop-blur-sm hover:border-emerald-500/30 hover:bg-white hover:shadow-md'
                    }`}
                >
                  <motion.svg animate={isDragging ? { y: -3 } : { y: 0 }} transition={buttonSpring} className={`w-5 h-5 transition-colors duration-300 ${isDragging ? 'text-emerald-400' : isDarkMode ? 'text-[#64748B] group-hover:text-emerald-400' : 'text-[#86868B] group-hover:text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></motion.svg>
                  <span className={`text-xs font-semibold tracking-wide transition-colors duration-300 ${isDragging ? 'text-emerald-400' : isDarkMode ? 'text-[#64748B] group-hover:text-[#F1F5F9]' : 'text-[#86868B] group-hover:text-[#1D1D1F]'}`}>Click to upload or drag audio here</span>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {isProcessing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: snappyEase }} className="w-full flex flex-col items-center justify-center">
            <div className="w-full max-w-sm mb-12 flex flex-col space-y-6">
              <div className="flex items-center justify-center gap-3 mb-2"><MiniWaveform isDarkMode={isDarkMode} /><h2 className={`text-lg font-semibold ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Processing audio</h2></div>
              <div className="flex flex-col gap-4 pl-8 relative">
                <div className={`absolute left-10 top-2 bottom-2 w-px -z-10 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
                {PROCESSING_STAGES.map((stage, idx) => {
                  if (stage === "Recording complete" && ('name' in (lastAudioData || {}))) return null;
                  return <ProcessingStep key={stage} label={stage} isActive={idx === processingStageIndex} isDone={idx < processingStageIndex} isDarkMode={isDarkMode} />;
                })}
              </div>
            </div>
          </motion.div>
        )}

        {results && !isProcessing && (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="w-full max-w-4xl mx-auto" aria-live="polite">
            
            <motion.div variants={fadeUp} className={`flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-6 pb-5 border-b ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
              <div>
                <h2 className={`text-3xl font-bold tracking-tight mb-2 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Analysis Complete</h2>
                <p className={`text-xs ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Review your transcription and intelligence summary below.</p>
              </div>
              <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }} transition={buttonSpring} onClick={resetState} className={`w-full sm:w-auto px-5 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 ${isDarkMode ? 'bg-[#F1F5F9] text-[#0B0F18] shadow-[0_0_15px_rgba(241,245,249,0.15)]' : 'bg-[#1D1D1F] text-white shadow-md'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg> New Voice Note
              </motion.button>
            </motion.div>

            {results.summary && (
              <motion.div variants={fadeUp} className="mb-4">
                <ResultCard title="The Gist" content={results.summary} variant="summary" isPrimary showTranslate={isNonEnglish && entitlements.tier === 'PRO'} isDarkMode={isDarkMode} />
              </motion.div>
            )}

            {results.transcript && (
              <motion.div variants={fadeUp} className="mb-8 relative">
                {results.language && (
                  <div className={`mb-3 inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-medium shadow-sm ${isDarkMode ? 'bg-[#12151C] border-white/10 text-[#F1F5F9]' : 'bg-white border-black/5 text-[#1D1D1F]'}`}>
                    Detected Language: <span className="ml-1 capitalize font-bold">{results.language}</span>
                    <span className={`ml-2 font-normal ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>· Detected automatically</span>
                  </div>
                )}
                <ResultCard title="Full Transcript" content={results.transcript} variant="transcript" fullWidth scrollable showTranslate={isNonEnglish && entitlements.tier === 'PRO'} isDarkMode={isDarkMode} />
              </motion.div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
              {entitlements.tier === 'PRO' ? (
                <>
                  {results.keyPoints && results.keyPoints.length > 0 && (
                    <motion.div variants={fadeUp}><ResultCard title="Key Points" content={results.keyPoints} variant="keyPoints" showTranslate={isNonEnglish} isDarkMode={isDarkMode} /></motion.div>
                  )}
                  {hasActionItems && (
                    <motion.div variants={fadeUp}><ResultCard title="Action Items" content={results.actionItems} variant="actionItems" showTranslate={isNonEnglish} isDarkMode={isDarkMode} /></motion.div>
                  )}
                  {results.suggestedReply && (
                    <motion.div variants={fadeUp} className={`${hasActionItems ? 'md:col-span-2' : ''}`}>
                      <ResultCard title="Smart Reply Generator" content={results.suggestedReply} variant="reply" fullWidth={hasActionItems} activeTone={activeTone} onChangeTone={handleChangeTone} isRegenerating={isRegeneratingReply} showTranslate={isNonEnglish} isDarkMode={isDarkMode} />
                    </motion.div>
                  )}
                </>
              ) : (
                <motion.div variants={fadeUp} className={`md:col-span-2 relative border rounded-3xl overflow-hidden ${isDarkMode ? 'border-white/5 bg-[#12151C]/20' : 'border-black/5 bg-white/40'}`}>
                   <div className={`absolute inset-0 z-10 backdrop-blur-[6px] flex flex-col items-center justify-center text-center p-8 ${isDarkMode ? 'bg-[#0B0F18]/75' : 'bg-[#F5F5F7]/80'}`}>
                      <div className="w-12 h-12 bg-emerald-500/5 text-emerald-500 rounded-full flex items-center justify-center mb-5 border border-emerald-500/20 shadow-lg">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <h4 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-[#1D1D1F]'}`}>Unlock Advanced Intelligence</h4>
                      <p className={`text-sm max-w-md mb-6 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Free tier includes your Gist and Transcript. Upgrade to Pro to unlock Key Points, Action Items, Smart Replies, and Translations.</p>
                      <form action="/api/checkout" method="POST">
                        <input type="hidden" name="plan" value="pro" />
                        <button type="submit" className={`px-6 py-2.5 text-xs font-bold rounded-full transition-transform hover:scale-105 ${isDarkMode ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'bg-[#1D1D1F] text-white shadow-md'}`}>Upgrade to Pro</button>
                      </form>
                   </div>
                   <div className="grid md:grid-cols-2 gap-4 opacity-30 pointer-events-none select-none blur-[2px] p-4">
                      <MockResultCard title="Key Points" isDarkMode={isDarkMode} /><MockResultCard title="Action Items" isDarkMode={isDarkMode} />
                      <div className="md:col-span-2"><MockResultCard title="Smart Reply Generator" isDarkMode={isDarkMode} /></div>
                   </div>
                </motion.div>
              )}
            </div>

            {entitlements.tier === 'PRO' && (
              <motion.div variants={fadeUp} className={`flex flex-col md:flex-row gap-4 items-center justify-between p-4 backdrop-blur-md border rounded-2xl shadow-sm ${isDarkMode ? 'bg-[#12151C]/70 border-white/5' : 'bg-white/70 border-black/5'}`}>
                 <div className={`flex items-center gap-3 text-xs font-medium ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}><svg className={`w-4 h-4 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Export Intelligence</div>
                 <div className="flex flex-wrap items-center gap-3">
                   <button onClick={handleCopyEverything} className={`px-4 py-1.5 border text-xs font-medium rounded-full transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-[#F1F5F9]' : 'border-black/10 hover:bg-black/5 text-[#1D1D1F]'}`}>Copy Everything</button>
                   <button onClick={handleDownloadTXT} className={`px-4 py-1.5 border text-xs font-medium rounded-full transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-[#F1F5F9]' : 'border-black/10 hover:bg-black/5 text-[#1D1D1F]'}`}>Download .TXT</button>
                   <button onClick={handleDownloadCSV} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors shadow-sm ${isDarkMode ? 'bg-[#F1F5F9] text-[#0B0F18] hover:opacity-90' : 'bg-[#1D1D1F] text-white hover:opacity-90'}`}>Download .CSV</button>
                 </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </main>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="features" className={`relative w-full max-w-5xl mx-auto pt-28 pb-24 px-5 sm:px-8 border-t transition-colors duration-200 ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className={`text-[8rem] md:text-[14rem] lg:text-[18rem] font-bold tracking-[0.15em] leading-none pl-10 relative z-10 transition-colors duration-200 ${isDarkMode ? 'text-white/5' : 'text-black/3'}`}>FEATURES</h2>
            <AnimatePresence>
              {isDarkMode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} exit={{ opacity: 0 }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-11/12 h-[60%] bg-white blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" style={{ willChange: 'transform' }} />
              )}
            </AnimatePresence>
            {!isDarkMode && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-11/12 h-1/2 bg-black/5 blur-[80px] rounded-full pointer-events-none z-0" />
            )}
          </div>
        </motion.div>

        <div className="relative z-10 text-center max-w-2xl mx-auto mb-14 mt-8">
          <motion.h2 variants={fadeUp} className={`text-3xl md:text-4xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Everything you need to understand voice</motion.h2>
          <motion.p variants={fadeUp} className={`text-sm mt-3 transition-colors duration-200 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>GIST transforms your scattered audio thoughts into structured, actionable intelligence instantly.</motion.p>
        </div>
        <motion.div variants={staggerContainer} className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-stretch">
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="The Gist" desc="Instantly get the core message of any voice note without listening to the whole thing." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />} isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Action Items" desc="Automatically extracts tasks, deadlines, and responsibilities so nothing slips through the cracks." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />} isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Smart Replies" desc="Generate context-aware replies in Professional, Friendly, Short, or Assertive tones instantly." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />} isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Data Export" desc="One-click copy or download your summaries and transcripts directly to TXT or CSV formats." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />} isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="File Uploads" desc="Drag and drop existing audio files (.mp3, .wav, .webm) straight into the dashboard." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />} isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Global Translation" desc="Instantly translate foreign language transcripts and summaries directly into English." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />} isDarkMode={isDarkMode} /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="faq" className={`relative w-full max-w-4xl mx-auto pt-28 pb-24 px-5 sm:px-8 border-t transition-colors duration-200 ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className={`text-[10rem] md:text-[16rem] lg:text-[20rem] font-bold tracking-[0.15em] leading-none pl-12 relative z-10 transition-colors duration-200 ${isDarkMode ? 'text-white/5' : 'text-black/3'}`}>FAQ</h2>
            <AnimatePresence>
              {isDarkMode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} exit={{ opacity: 0 }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-4/5 h-[60%] bg-white blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" style={{ willChange: 'transform' }} />
              )}
            </AnimatePresence>
            {!isDarkMode && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-4/5 h-1/2 bg-black/5 blur-[80px] rounded-full pointer-events-none z-0" />
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="relative z-10 text-center mb-14 mt-8">
          <h2 className={`text-3xl md:text-4xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Frequently Asked Questions</h2>
        </motion.div>
        <motion.div variants={staggerContainer} className="relative z-10 space-y-6 max-w-3xl mx-auto">
          <motion.div variants={fadeUp}><FAQItem question="What is GIST?" answer="GIST is a Voice Intelligence tool designed to instantly transcribe and summarize your voice notes, extracting key points, action items, and generating suggested replies." isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="How does GIST work?" answer="You can record directly in your browser or upload an audio file. Our underlying AI model securely processes the audio to generate a highly accurate transcript and intelligent summaries." isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Can I upload an audio file?" answer="Yes, you can easily drag and drop standard audio files directly into the dashboard for processing." isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Does GIST support multiple languages?" answer="Yes, GIST automatically detects and transcribes multiple languages supported by our core AI models. Pro users can also translate them instantly." isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Is my audio private?" answer="Yes. Your audio is securely processed solely for generating your transcript and summary, and we do not use your personal voice data to train public models." isDarkMode={isDarkMode} /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Can I export the data?" answer="Yes! Pro users can one-click copy all intelligence, or download perfectly formatted TXT and CSV files directly from the dashboard." isDarkMode={isDarkMode} /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="pricing" className={`relative w-full max-w-5xl mx-auto pt-28 pb-24 px-4 flex flex-col items-center justify-center mb-16 border-t transition-colors duration-200 ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className={`text-[8rem] md:text-[12rem] lg:text-[14rem] font-bold tracking-widest leading-none pl-8 relative z-10 transition-colors duration-200 ${isDarkMode ? 'text-white/5' : 'text-black/3'}`}>Pricing</h2>
            <AnimatePresence>
              {isDarkMode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} exit={{ opacity: 0 }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-4/5 h-[60%] bg-white blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" style={{ willChange: 'transform' }} />
              )}
            </AnimatePresence>
            {!isDarkMode && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-4/5 h-1/2 bg-black/5 blur-[80px] rounded-full pointer-events-none z-0" />
            )}
          </div>
        </motion.div>

        <motion.div variants={staggerContainer} className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-20">
          <motion.div variants={fadeUp} className={`flex flex-col backdrop-blur-xl border rounded-4xl p-8 hover:-translate-y-1.5 transition-all duration-300 ${isDarkMode ? 'bg-[#12151C]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Free Plan</p>
            <h3 className={`text-4xl font-bold tracking-tight mb-8 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Free</h3>
            <ul className={`flex flex-col gap-3.5 mb-10 grow text-xs ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>
              <li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> 5 free uses per month</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Core AI transcription</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Basic summaries</li>
            </ul>
            <button type="button" disabled className={`w-full mt-auto py-3 rounded-full border font-medium text-xs cursor-default ${isDarkMode ? 'border-white/10 text-[#94A3B8] bg-white/5' : 'border-black/10 text-[#86868B] bg-black/5'}`}>{entitlements.tier === 'FREE' ? 'Current Plan' : 'Free Tier Included'}</button>
          </motion.div>
          
          <motion.div variants={fadeUp} className={`flex flex-col backdrop-blur-2xl border rounded-4xl p-8 transform md:scale-105 z-20 hover:-translate-y-1.5 transition-all duration-300 relative ${isDarkMode ? 'bg-[#161823]/95 border-white/10 shadow-[0_0_60px_rgba(11,15,24,0.8)]' : 'bg-white border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]'}`}>
            <div className={`absolute inset-0 rounded-4xl pointer-events-none ${isDarkMode ? 'bg-linear-to-b from-white/5 to-transparent' : ''}`}></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Pro Plan</p>
              {entitlements.tier === 'PRO' && <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>Active</span>}
            </div>
            <div className="flex items-end gap-1 mb-8 relative z-10">
              <h3 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>$4.99</h3>
              <span className={`mb-1 text-sm font-medium ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>/month</span>
            </div>
            <ul className={`flex flex-col gap-3.5 mb-10 grow text-xs relative z-10 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>
              <li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Unlimited voice processing</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Task & Deadline Extraction</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Smart Tone Reply Generator</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> 1-Click TXT & CSV Exports</li><li className="flex items-center gap-3"><CheckIcon isDarkMode={isDarkMode} /> Global Language Translations</li>
            </ul>
            {entitlements.tier === 'PRO' ? (
              <button type="button" disabled className={`w-full mt-auto py-3 rounded-full border font-bold text-xs cursor-default flex items-center justify-center gap-2 ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}><span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500'}`} />Current Active Subscription</button>
            ) : (
              <form action="/api/checkout" method="POST" className="mt-auto relative z-10">
                <input type="hidden" name="plan" value="pro" />
                <motion.button 
                  whileHover={{ y: -1 }} 
                  whileTap={{ scale: 0.97 }} 
                  transition={buttonSpring} 
                  type="submit" 
                  className={`relative overflow-hidden w-full py-3 flex items-center justify-center gap-2 rounded-full font-bold text-[11px] uppercase tracking-widest transition-shadow ${
                    isDarkMode 
                      ? 'bg-[#F8FAFC] text-[#0B0F18] shadow-[0_0_20px_rgba(255,255,255,0.1),inset_0_-2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]' 
                      : 'bg-[#1D1D1F] text-white shadow-[0_8px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.2)]'
                  }`}
                >
                  <span className={isDarkMode ? "text-emerald-600" : "text-amber-400"}>✦</span> 
                  Upgrade to Pro
                  <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }} className="absolute top-0 bottom-0 w-1/2 bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none" />
                </motion.button>
              </form>
            )}
          </motion.div>
        </motion.div>
      </motion.section>
      
      {/* SUPPORT SECTION */}
      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="support" className={`relative w-full max-w-5xl mx-auto pt-24 pb-28 px-4 flex flex-col items-center justify-center border-t transition-colors duration-200 ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        <motion.div variants={fadeUp} className="relative z-10 text-center mb-10">
          <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Support</h2>
          <p className={`text-sm mt-3 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Need help with GIST? We're here for you.</p>
        </motion.div>

        <motion.div variants={staggerContainer} className="relative z-10 w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-5">
          <motion.a href="mailto:nasir.ah.khan99@gmail.com" variants={fadeUp} className={`flex flex-col items-center text-center p-6 border rounded-2xl transition-all group shadow-sm hover:shadow-md ${isDarkMode ? 'bg-[#12151C] border-white/5 hover:border-white/10' : 'bg-white border-black/5 hover:border-black/10'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${isDarkMode ? 'bg-white/5 text-[#F1F5F9]' : 'bg-black/5 text-[#1D1D1F]'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h4 className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Email</h4>
            <span className={`text-sm break-all transition-colors ${isDarkMode ? 'text-[#94A3B8] group-hover:text-[#F1F5F9]' : 'text-[#86868B] group-hover:text-[#1D1D1F]'}`}>nasir.ah.khan99<br/>@gmail.com</span>
          </motion.a>

          <motion.a href="tel:03357333789" variants={fadeUp} className={`flex flex-col items-center text-center p-6 border rounded-2xl transition-all group shadow-sm hover:shadow-md ${isDarkMode ? 'bg-[#12151C] border-white/5 hover:border-white/10' : 'bg-white border-black/5 hover:border-black/10'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${isDarkMode ? 'bg-white/5 text-[#F1F5F9]' : 'bg-black/5 text-[#1D1D1F]'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <h4 className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Phone</h4>
            <span className={`text-sm transition-colors ${isDarkMode ? 'text-[#94A3B8] group-hover:text-[#F1F5F9]' : 'text-[#86868B] group-hover:text-[#1D1D1F]'}`}>03357333789</span>
          </motion.a>

          <motion.div variants={fadeUp} className={`flex flex-col items-center text-center p-6 border rounded-2xl shadow-sm ${isDarkMode ? 'bg-[#12151C] border-white/5' : 'bg-white border-black/5'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-white/5 text-[#F1F5F9]' : 'bg-black/5 text-[#1D1D1F]'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h4 className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>Location</h4>
            <span className={`text-sm ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>Islamabad Capital Territory, Pakistan</span>
          </motion.div>
        </motion.div>
      </motion.section>
      
      <style dangerouslySetInnerHTML={{__html: `
        html, body { scroll-behavior: smooth; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${isDarkMode ? '#1A1D27' : '#D1D5DB'}; border-radius: 20px; }
        .wrap-break-word { overflow-wrap: break-word; word-wrap: break-word; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
      `}} />
    </div>
  );
}

// --- Subcomponents ---

function MockResultCard({ title, isDarkMode }: { title: string, isDarkMode: boolean }) {
  return (
    <div className={`p-5 border rounded-2xl flex flex-col min-h-24 ${isDarkMode ? 'bg-[#12151C]/50 border-white/5' : 'bg-white/50 border-black/5'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>{title}</h3>
      <div className="space-y-3 opacity-40">
        <div className={`h-2.5 rounded-full w-full ${isDarkMode ? 'bg-white/20' : 'bg-black/10'}`}></div>
        <div className={`h-2.5 rounded-full w-4/5 ${isDarkMode ? 'bg-white/20' : 'bg-black/10'}`}></div>
        <div className={`h-2.5 rounded-full w-3/4 ${isDarkMode ? 'bg-white/20' : 'bg-black/10'}`}></div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, icon, isDarkMode }: { title: string, desc: string, icon: React.ReactNode, isDarkMode: boolean }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`h-full flex flex-col p-7 backdrop-blur-xl border rounded-3xl transition-all duration-300 ${isDarkMode ? 'bg-[#12151C]/80 border-white/5 shadow-sm hover:border-white/15 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]' : 'bg-white/80 border-black/5 shadow-sm hover:border-black/10 hover:shadow-md'}`}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-5 shrink-0 ${isDarkMode ? 'bg-white/5 border-white/5 text-[#F1F5F9]' : 'bg-black/5 border-black/5 text-[#1D1D1F]'}`} aria-hidden="true"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg></div>
      <h3 className={`text-base font-bold mb-2 tracking-wide ${isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]'}`}>{title}</h3>
      <p className={`text-xs leading-relaxed grow ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>{desc}</p>
    </motion.div>
  );
}

function FAQItem({ question, answer, isDarkMode }: { question: string, answer: string, isDarkMode: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div layout className={`border rounded-2xl backdrop-blur-xl overflow-hidden transition-colors ${isDarkMode ? 'bg-[#12151C]/80 border-white/5 shadow-sm hover:border-white/10' : 'bg-white/80 border-black/5 shadow-sm hover:border-black/10'}`}>
      <motion.button layout onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className="w-full flex items-center justify-between p-6 text-left focus:outline-none group">
        <span className={`font-medium text-sm transition-colors pr-4 ${isDarkMode ? 'text-[#F1F5F9] group-hover:text-white' : 'text-[#1D1D1F] group-hover:text-black'}`}>{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 350, damping: 22 }} className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-[#1E293B] text-[#94A3B8] group-hover:text-[#F1F5F9]' : 'bg-black/5 group-hover:bg-gray-200 text-[#86868B] group-hover:text-[#1D1D1F]'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div layout initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: snappyEase }} className="px-6 overflow-hidden"><p className={`text-xs leading-relaxed pb-6 pt-1 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>{answer}</p></motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProcessingStep({ label, isActive, isDone, isDarkMode }: { label: string, isActive: boolean, isDone: boolean, isDarkMode: boolean }) {
  return (
    <div className={`flex items-center gap-4 transition-all duration-300 ease-out ${isActive || isDone ? 'opacity-100' : 'opacity-30'}`}>
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {isDone ? (
          <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className={`w-4 h-4 text-emerald-500 relative z-10 ${isDarkMode ? 'bg-[#0B0F18]' : 'bg-[#F5F5F7]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></motion.svg>
        ) : isActive ? (
          <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} className={`w-2.5 h-2.5 rounded-full relative z-10 ${isDarkMode ? 'bg-[#F1F5F9]' : 'bg-emerald-500'}`} />
        ) : (
          <div className={`w-2 h-2 rounded-full relative z-10 ${isDarkMode ? 'bg-[#272A35]' : 'bg-gray-300'}`}></div>
        )}
      </div>
      <span className={`text-xs font-medium transition-colors duration-200 ${isActive ? (isDarkMode ? 'text-[#F1F5F9]' : 'text-[#1D1D1F]') : (isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]')}`}>{label}</span>
    </div>
  );
}

function MiniWaveform({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
      {[0.4, 0.8, 0.3, 1, 0.5].map((h, i) => <motion.div key={i} animate={{ scaleY: [h, 1, h] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }} className={`w-0.5 rounded-full origin-bottom ${isDarkMode ? 'bg-[#F1F5F9]' : 'bg-emerald-500'}`} style={{ height: '100%' }} />)}
    </div>
  );
}

type CardVariant = 'summary' | 'keyPoints' | 'actionItems' | 'reply' | 'transcript';

interface ResultCardProps {
  title: string;
  content: string | string[] | any;
  variant: CardVariant;
  fullWidth?: boolean;
  isPrimary?: boolean;
  scrollable?: boolean;
  activeTone?: string;
  onChangeTone?: (tone: string) => void;
  isRegenerating?: boolean;
  showTranslate?: boolean;
  isDarkMode: boolean;
}

function ResultCard({ title, content, variant, fullWidth = false, isPrimary = false, scrollable = false, activeTone, onChangeTone, isRegenerating, showTranslate, isDarkMode }: ResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => { setTranslatedText(null); }, [activeTone, content]);

  const rawStringContent = variant === 'reply' && typeof content === 'object' && content !== null && activeTone
    ? content[activeTone.toLowerCase()] || Object.values(content)[0] || ''
    : Array.isArray(content) ? content.join('\n') : String(content || '');

  const displayContent = translatedText !== null ? translatedText : rawStringContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawStringContent }) });
      if (res.ok) { const data = await res.json(); setTranslatedText(data.translation); }
    } catch (e) { console.error(e); } finally { setIsTranslating(false); }
  };

  let containerStyles = isDarkMode ? "bg-[#12151C] border-white/5 shadow-sm" : "bg-white border-black/5 shadow-sm";
  let titleStyles = isDarkMode ? "text-[#94A3B8]" : "text-[#86868B]";
  let contentStyles = isDarkMode ? "text-[#F1F5F9]" : "text-[#1D1D1F]";

  if (variant === 'summary') {
    containerStyles = isDarkMode ? "bg-linear-to-br from-[#161922] to-[#0B0F18] border border-white/5 shadow-[0_0_20px_rgba(22,25,34,0.3)] ring-1 ring-white/5" : "bg-white border border-emerald-100 shadow-md ring-1 ring-black/5";
    titleStyles = isDarkMode ? "text-emerald-400" : "text-emerald-600";
    contentStyles = isPrimary ? (isDarkMode ? "text-[#F1F5F9] font-medium text-lg leading-relaxed" : "text-[#1D1D1F] font-medium text-lg leading-relaxed") : (isDarkMode ? "text-[#F1F5F9] font-medium text-sm" : "text-[#1D1D1F] font-medium text-sm");
  } else if (variant === 'reply') {
    containerStyles = isDarkMode ? "bg-[#12151C]/70 border-white/5 shadow-sm" : "bg-gray-50 border-black/5 shadow-inner";
    titleStyles = isDarkMode ? "text-[#94A3B8]" : "text-[#86868B]";
    contentStyles = isDarkMode ? "text-[#F1F5F9] text-sm leading-relaxed" : "text-[#1D1D1F] text-sm leading-relaxed";
  } else if (variant === 'transcript') {
    containerStyles = isDarkMode ? "bg-[#080B12]/60 border-white/5 shadow-inner" : "bg-gray-100 border-black/5 shadow-inner";
    contentStyles = isDarkMode ? "text-[#94A3B8] font-mono text-sm leading-relaxed tracking-wide" : "text-[#4B5563] font-mono text-sm leading-relaxed tracking-wide";
  }

  const renderContent = () => {
    if (variant === 'keyPoints') {
      return displayContent.split('\n').filter(Boolean).map((line: string, i: number) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0 text-sm">
          <svg className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className={contentStyles}>{line.replace(/^[•-]\s*/, '')}</span>
        </div>
      ));
    }
    if (variant === 'actionItems') {
      return displayContent.split('\n').filter(Boolean).map((line: string, i: number) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0 text-sm">
          <svg className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className={contentStyles}>{line.replace(/^\[[x ]?\]\s*/i, '')}</span>
        </div>
      ));
    }
    if (variant === 'reply' && isRegenerating) {
       return (
         <div className={`flex items-center gap-3 h-full py-4 text-sm ${isDarkMode ? 'text-[#94A3B8]' : 'text-[#86868B]'}`}>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Generating {activeTone?.toLowerCase()} reply...
         </div>
       );
    }
    return <div className="whitespace-pre-wrap wrap-break-word">{displayContent}</div>;
  };

  return (
    <motion.div whileHover={{ y: -2 }} className={`p-5 border rounded-2xl transition-all duration-200 flex flex-col min-h-24 hover:border-white/10 backdrop-blur-sm ${fullWidth ? 'md:col-span-2' : ''} ${containerStyles}`}>
      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
           <h3 className={`text-xs font-bold uppercase tracking-widest ${titleStyles}`}>{title}</h3>
           {variant === 'reply' && onChangeTone && (
              <div className="flex flex-wrap gap-2 mt-3.5">
                 {['Professional', 'Friendly', 'Short', 'Assertive'].map(tone => (
                    <button key={tone} onClick={() => onChangeTone(tone)} disabled={isRegenerating} className={`px-3 py-1 text-xs rounded-full transition-colors font-medium border ${activeTone === tone ? (isDarkMode ? 'bg-[#F1F5F9] text-[#0B0F18] border-[#F1F5F9]' : 'bg-[#1D1D1F] text-white border-[#1D1D1F]') : (isDarkMode ? 'bg-transparent text-[#94A3B8] border-white/10 hover:border-white/20' : 'bg-transparent text-[#86868B] border-black/10 hover:border-black/20')}`}>{tone}</button>
                 ))}
              </div>
           )}
        </div>
        
        <div className="flex items-center gap-2">
          {showTranslate && !translatedText && (
             <button onClick={handleTranslate} disabled={isTranslating} className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors flex items-center gap-1.5 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-[#F1F5F9] border-white/10' : 'bg-black/5 hover:bg-black/10 text-[#86868B] hover:text-[#1D1D1F] border-black/5'}`}>
                {isTranslating ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Translate'}
             </button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCopy} disabled={isRegenerating} className={`rounded-lg p-1.5 transition-colors flex items-center justify-center w-8 h-8 relative group shrink-0 ${isDarkMode ? 'text-[#94A3B8] hover:text-[#F1F5F9]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} title="Copy to clipboard">
            {copied ? <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className={`w-4 h-4 absolute ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></motion.svg> : <svg className="w-4 h-4 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </motion.button>
        </div>
      </div>
      <div className={`flex-1 ${contentStyles} ${scrollable ? 'max-h-80 overflow-y-auto pr-3 custom-scrollbar' : ''} ${variant === 'reply' ? 'mt-2' : ''}`}>
        {renderContent()}
      </div>
    </motion.div>
  );
}

function CheckIcon({ isDarkMode }: { isDarkMode: boolean }) {
  return <div className={`shrink-0 w-4 h-4 flex items-center justify-center rounded-full border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>;
}