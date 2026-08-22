"use client";

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

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

  // Handle premium mouse-following light
  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (!bgRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      
      // Use RAF to natively update CSS variables for the mouse light, zero react lag
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
  }, []);

  useEffect(() => {
    fetch('/api/user/entitlements')
      .then(res => res.ok ? res.json() : { tier: 'FREE', usageCount: 0, usageLimit: 5 })
      .then(data => { if (data && typeof data.usageCount === 'number') setEntitlements(data); })
      .catch(() => setEntitlements({ tier: 'FREE', usageCount: 0, usageLimit: 5 }));
  }, []);

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
      formData.append('audio', isFile ? audioData : new File([audioData], 'recording.webm'));

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
        setResults(data); setIsProcessing(false);
        if (entitlements.tier === 'FREE') setEntitlements(prev => ({ ...prev, usageCount: Math.min(prev.usageLimit, prev.usageCount + 1) }));
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
    <div className="min-h-screen font-sans flex flex-col overflow-x-hidden relative bg-[#0B0F18] text-[#F1F5F9] selection:bg-[#1E293B]/50">
      
      <div ref={bgRef} className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#0B0F18]">
        <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['-2%', '3%', '-2%'], y: ['-3%', '2%', '-3%'] }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} className="absolute top-[-20%] left-[-10%] w-[120vw] h-[120vh] bg-[radial-gradient(ellipse_at_center,rgba(11,19,43,0.35)_0%,transparent_50%)]" />
        <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['3%', '-2%', '3%'], y: ['2%', '-3%', '2%'] }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }} className="absolute top-[10%] right-[-10%] w-screen h-screen bg-[radial-gradient(ellipse_at_center,rgba(26,24,50,0.25)_0%,transparent_50%)]" />
        <motion.div style={{ willChange: 'transform' }} animate={prefersReducedMotion ? {} : { x: ['-1%', '2%', '-1%'], y: ['2%', '-1%', '2%'] }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} className="absolute bottom-[-10%] left-[20%] w-screen h-screen bg-[radial-gradient(ellipse_at_center,rgba(42,38,51,0.2)_0%,transparent_50%)]" />
        
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] mix-blend-overlay pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F18_130%)] pointer-events-none" />

        <div className="absolute inset-0 opacity-[0.035] transition-opacity duration-300 pointer-events-none" style={{ background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,1), transparent 40%)' }} />
      </div>

      <motion.header initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: snappyEase }} className="fixed top-0 left-0 w-full z-50 bg-[#0B0F18]/80 backdrop-blur-xl border-b border-white/5 pt-4 pb-4">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 flex items-center justify-between relative">
          
          <div className="flex flex-1 items-center justify-start">
            <motion.a href="#home" className="flex items-center gap-4 group" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={buttonSpring}>
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] flex items-center justify-center transition-all duration-300 shadow-[0_0_15px_rgba(241,245,249,0.08)] group-hover:shadow-[0_0_20px_rgba(241,245,249,0.15)]"><svg className="w-5 h-5 text-[#0B0F18]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 10v4m4-8v12m4-10v8m4-12v16m4-10v4" /></svg></div>
              <span className="text-[22px] font-black tracking-wide text-[#F1F5F9]">GIST</span>
            </motion.a>
          </div>
          
          <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-10 text-[11px] font-bold uppercase tracking-[0.15em]">
            {['home', 'features', 'faq', 'pricing'].map((id) => <a key={id} href={`#${id}`} className={`transition-colors duration-200 ${activeSection === id ? 'text-[#F1F5F9]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}>{id}</a>)}
          </nav>
          
          <div className="flex flex-1 items-center justify-end gap-5">
            {entitlements.tier === 'PRO' ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-widest shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" /><span>Pro Active</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-[#94A3B8] shadow-inner">
                  <span className={`w-1.5 h-1.5 rounded-full ${remainingFreeUses > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} /> <span>Trial: <strong className="text-[#F1F5F9] font-bold">{remainingFreeUses}/5</strong></span>
                </div>
                <form action="/api/checkout" method="POST">
                  <input type="hidden" name="plan" value="pro" />
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={buttonSpring} type="submit" className="px-5 py-2 rounded-full bg-[#F1F5F9] text-[#0B0F18] text-[11px] font-bold uppercase tracking-widest shadow-[0_4px_14px_rgba(241,245,249,0.15)] hover:shadow-[0_6px_20px_rgba(241,245,249,0.25)] transition-all">Upgrade to Pro</motion.button>
                </form>
              </div>
            )}
          </div>

        </div>
      </motion.header>

      <main id="home" className="relative flex-1 w-full max-w-4xl mx-auto pt-36 pb-24 px-5 sm:px-8 flex flex-col items-center justify-center min-h-screen">
        <AnimatePresence>
          {error && !isProcessing && (
            <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} className="absolute top-28 w-full max-w-md p-4 bg-red-950/40 backdrop-blur-md border border-red-500/40 text-[#F1F5F9] text-xs rounded-xl flex items-center justify-between shadow-lg z-20">
              <div className="flex items-center gap-2.5"><svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>{error}</span></div>
              <button onClick={() => setError(null)} className="p-1 hover:opacity-70 transition-opacity ml-2 outline-none text-base">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {!isProcessing && !results && (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col items-center justify-center w-full max-w-md mx-auto gap-12 sm:gap-14">
            <div className="text-center space-y-3">
              <motion.h2 variants={fadeUpBlur} className="text-4xl sm:text-5xl font-bold tracking-tight text-[#F1F5F9]">{isRecording ? formatTime(recordingTime) : "Ready to listen"}</motion.h2>
              <motion.p variants={fadeUpBlur} className="text-[#94A3B8] text-sm font-medium">{isRecording ? "Listening... Tap mic to process" : "Tap the microphone to start recording."}</motion.p>
            </div>
            <motion.div variants={fadeUpBlur} className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56">
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-36 bg-[#E4D5C7] rounded-full blur-[45px] opacity-[0.09]" />
              </div>
              
              {isRecording && <div ref={visualizerRef} className="absolute inset-0 bg-red-500/20 rounded-full transition-transform duration-75 ease-out" aria-hidden="true" />}
              
              <motion.button whileHover={isRecording ? {} : { scale: 1.05, y: -3, boxShadow: "0px 15px 35px rgba(11,15,24,0.7)" }} whileTap={{ scale: 0.95 }} transition={buttonSpring} onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "Stop recording" : "Start recording"} className={`relative z-10 flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1E293B] ${isRecording ? 'bg-rose-500 text-[#F1F5F9] shadow-lg' : 'bg-[#12151C] text-[#F1F5F9] border border-white/10 shadow-xl'}`}>
                {!isRecording ? <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> : <svg className="w-12 h-12 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>}
              </motion.button>
            </motion.div>
            {!isRecording && (
              <motion.div variants={fadeUpBlur} className="w-full">
                <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <motion.button whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={buttonSpring} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`w-full p-5 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-colors duration-200 cursor-pointer group focus:outline-none border border-dashed hover:shadow-lg ${isDragging ? 'border-[#94A3B8] bg-[#0F172A]' : 'border-white/10 bg-[#12151C]/70 backdrop-blur-md hover:border-white/20'}`}>
                  <motion.svg animate={isDragging ? { y: -4 } : { y: 0 }} transition={buttonSpring} className={`w-5 h-5 transition-colors duration-200 ${isDragging ? 'text-[#F1F5F9]' : 'text-[#94A3B8] group-hover:text-[#F1F5F9]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></motion.svg>
                  <span className="text-xs font-medium text-[#94A3B8] group-hover:text-[#F1F5F9] transition-colors">Click to upload or drag audio here</span>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {isProcessing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: snappyEase }} className="w-full flex flex-col items-center justify-center">
            <div className="w-full max-w-sm mb-12 flex flex-col space-y-6">
              <div className="flex items-center justify-center gap-3 mb-2"><MiniWaveform /><h2 className="text-lg font-semibold text-[#F1F5F9]">Processing audio</h2></div>
              <div className="flex flex-col gap-4 pl-8 relative">
                <div className="absolute left-10 top-2 bottom-2 w-px bg-white/10 -z-10" />
                {PROCESSING_STAGES.map((stage, idx) => {
                  if (stage === "Recording complete" && ('name' in (lastAudioData || {}))) return null;
                  return <ProcessingStep key={stage} label={stage} isActive={idx === processingStageIndex} isDone={idx < processingStageIndex} />;
                })}
              </div>
            </div>
          </motion.div>
        )}

        {results && !isProcessing && (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="w-full max-w-4xl mx-auto" aria-live="polite">
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-6 pb-5 border-b border-white/10">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#F1F5F9] mb-2">Analysis Complete</h2>
                <p className="text-xs text-[#94A3B8]">Review your transcription and intelligence summary below.</p>
              </div>
              <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }} transition={buttonSpring} onClick={resetState} className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-[#0B0F18] bg-[#F1F5F9] rounded-full shadow-[0_0_15px_rgba(241,245,249,0.15)] flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg> New Voice Note
              </motion.button>
            </motion.div>

            {results.summary && (
              <motion.div variants={fadeUp} className="mb-4">
                <ResultCard title="The Gist" content={results.summary} variant="summary" isPrimary showTranslate={isNonEnglish && entitlements.tier === 'PRO'} />
              </motion.div>
            )}

            {results.transcript && (
              <motion.div variants={fadeUp} className="mb-8 relative">
                {results.language && (
                  <div className="mb-3 inline-flex items-center px-3 py-1 rounded-full bg-[#12151C] border border-white/10 text-[#F1F5F9] text-[11px] font-medium shadow-sm">
                    Detected Language: <span className="ml-1 capitalize text-[#F1F5F9] font-bold">{results.language}</span>
                    <span className="ml-2 text-[#94A3B8] font-normal">· Detected automatically</span>
                  </div>
                )}
                <ResultCard title="Full Transcript" content={results.transcript} variant="transcript" fullWidth scrollable showTranslate={isNonEnglish && entitlements.tier === 'PRO'} />
              </motion.div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
              {entitlements.tier === 'PRO' ? (
                <>
                  {results.keyPoints && results.keyPoints.length > 0 && (
                    <motion.div variants={fadeUp}><ResultCard title="Key Points" content={results.keyPoints} variant="keyPoints" showTranslate={isNonEnglish} /></motion.div>
                  )}
                  {hasActionItems && (
                    <motion.div variants={fadeUp}><ResultCard title="Action Items" content={results.actionItems} variant="actionItems" showTranslate={isNonEnglish} /></motion.div>
                  )}
                  {results.suggestedReply && (
                    <motion.div variants={fadeUp} className={`${hasActionItems ? 'md:col-span-2' : ''}`}>
                      <ResultCard title="Smart Reply Generator" content={results.suggestedReply} variant="reply" fullWidth={hasActionItems} activeTone={activeTone} onChangeTone={handleChangeTone} isRegenerating={isRegeneratingReply} showTranslate={isNonEnglish} />
                    </motion.div>
                  )}
                </>
              ) : (
                <motion.div variants={fadeUp} className="md:col-span-2 relative border border-white/5 rounded-3xl overflow-hidden bg-[#12151C]/20">
                   <div className="absolute inset-0 z-10 backdrop-blur-[6px] bg-[#0B0F18]/75 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-12 h-12 bg-emerald-500/5 text-emerald-400 rounded-full flex items-center justify-center mb-5 border border-emerald-500/20 shadow-lg">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Unlock Advanced Intelligence</h4>
                      <p className="text-sm text-[#94A3B8] max-w-md mb-6">Free tier includes your Gist and Transcript. Upgrade to Pro to unlock Key Points, Action Items, Smart Replies, and Translations.</p>
                      <form action="/api/checkout" method="POST">
                        <input type="hidden" name="plan" value="pro" />
                        <button type="submit" className="px-6 py-2.5 bg-white text-black text-xs font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform">Upgrade to Pro</button>
                      </form>
                   </div>
                   <div className="grid md:grid-cols-2 gap-4 opacity-30 pointer-events-none select-none blur-[2px] p-4">
                      <MockResultCard title="Key Points" /><MockResultCard title="Action Items" />
                      <div className="md:col-span-2"><MockResultCard title="Smart Reply Generator" /></div>
                   </div>
                </motion.div>
              )}
            </div>

            {entitlements.tier === 'PRO' && (
              <motion.div variants={fadeUp} className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-[#12151C]/70 backdrop-blur-md border border-white/5 rounded-2xl shadow-sm">
                 <div className="flex items-center gap-3 text-xs text-[#94A3B8] font-medium"><svg className="w-4 h-4 text-[#F1F5F9]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Export Intelligence</div>
                 <div className="flex flex-wrap items-center gap-3">
                   <button onClick={handleCopyEverything} className="px-4 py-1.5 border border-white/10 hover:bg-white/5 text-[#F1F5F9] text-xs font-medium rounded-full transition-colors">Copy Everything</button>
                   <button onClick={handleDownloadTXT} className="px-4 py-1.5 border border-white/10 hover:bg-white/5 text-[#F1F5F9] text-xs font-medium rounded-full transition-colors">Download .TXT</button>
                   <button onClick={handleDownloadCSV} className="px-4 py-1.5 bg-[#F1F5F9] text-[#0B0F18] hover:opacity-90 text-xs font-bold rounded-full transition-colors shadow-sm">Download .CSV</button>
                 </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </main>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="features" className="relative w-full max-w-5xl mx-auto pt-28 pb-24 px-5 sm:px-8 border-t border-white/5">
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className="text-[8rem] md:text-[14rem] lg:text-[18rem] font-bold text-white/5 tracking-[0.15em] leading-none pl-10 relative z-10">FEATURES</h2>
            <motion.div 
              animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} 
              className="absolute bottom-[-25%] left-1/2 -translate-x-1/2 w-[90%] h-[60%] bg-white blur-[120px] rounded-[100%] pointer-events-none z-0 mix-blend-screen" 
              style={{ willChange: 'transform, opacity' }} 
            />
          </div>
        </motion.div>

        <div className="relative z-10 text-center max-w-2xl mx-auto mb-14 mt-8"><motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight text-[#F1F5F9]">Everything you need to understand voice</motion.h2><motion.p variants={fadeUp} className="text-sm text-[#94A3B8] mt-3">GIST transforms your scattered audio thoughts into structured, actionable intelligence instantly.</motion.p></div>
        <motion.div variants={staggerContainer} className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-stretch">
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="The Gist" desc="Instantly get the core message of any voice note without listening to the whole thing." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Action Items" desc="Automatically extracts tasks, deadlines, and responsibilities so nothing slips through the cracks." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Smart Replies" desc="Generate context-aware replies in Professional, Friendly, Short, or Assertive tones instantly." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Data Export" desc="One-click copy or download your summaries and transcripts directly to TXT or CSV formats." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="File Uploads" desc="Drag and drop existing audio files (.mp3, .wav, .webm) straight into the dashboard." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />} /></motion.div>
          <motion.div variants={fadeUp} className="h-full"><FeatureCard title="Global Translation" desc="Instantly translate foreign language transcripts and summaries directly into English." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />} /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="faq" className="relative w-full max-w-4xl mx-auto pt-28 pb-24 px-5 sm:px-8 border-t border-white/5">
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className="text-[10rem] md:text-[16rem] lg:text-[20rem] font-bold text-white/5 tracking-[0.15em] leading-none pl-12 relative z-10">FAQ</h2>
            <motion.div 
              animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} 
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} 
              className="absolute bottom-[-25%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-white blur-[120px] rounded-[100%] pointer-events-none z-0 mix-blend-screen" 
              style={{ willChange: 'transform, opacity' }} 
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="relative z-10 text-center mb-14 mt-8"><h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F1F5F9]">Frequently Asked Questions</h2></motion.div>
        <motion.div variants={staggerContainer} className="relative z-10 space-y-6 max-w-3xl mx-auto">
          <motion.div variants={fadeUp}><FAQItem question="What is GIST?" answer="GIST is a Voice Intelligence tool designed to instantly transcribe and summarize your voice notes, extracting key points, action items, and generating suggested replies." /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="How does GIST work?" answer="You can record directly in your browser or upload an audio file. Our underlying AI model securely processes the audio to generate a highly accurate transcript and intelligent summaries." /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Can I upload an audio file?" answer="Yes, you can easily drag and drop standard audio files directly into the dashboard for processing." /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Does GIST support multiple languages?" answer="Yes, GIST automatically detects and transcribes multiple languages supported by our core AI models. Pro users can also translate them instantly." /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Is my audio private?" answer="Yes. Your audio is securely processed solely for generating your transcript and summary, and we do not use your personal voice data to train public models." /></motion.div>
          <motion.div variants={fadeUp}><FAQItem question="Can I export the data?" answer="Yes! Pro users can one-click copy all intelligence, or download perfectly formatted TXT and CSV files directly from the dashboard." /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="pricing" className="relative w-full max-w-5xl mx-auto pt-28 pb-24 px-4 flex flex-col items-center justify-center mb-16 border-t border-white/5">
        
        <motion.div variants={bgTextReveal} className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none w-full text-center select-none flex justify-center">
          <div className="relative inline-block">
            <h2 className="text-[8rem] md:text-[12rem] lg:text-[14rem] font-bold text-white/5 tracking-widest leading-none pl-8 relative z-10">Pricing</h2>
            <motion.div 
              animate={{ opacity: [0.08, 0.18, 0.08], scaleY: [0.7, 1.1, 0.7] }} 
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }} 
              className="absolute bottom-[-25%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-white blur-[120px] rounded-[100%] pointer-events-none z-0 mix-blend-screen" 
              style={{ willChange: 'transform, opacity' }} 
            />
          </div>
        </motion.div>

        <motion.div variants={staggerContainer} className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-20">
          <motion.div variants={fadeUp} className="flex flex-col bg-[#12151C]/80 backdrop-blur-xl border border-white/5 rounded-4xl p-8 hover:-translate-y-1.5 transition-transform duration-300">
            <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Free Plan</p><h3 className="text-[#F1F5F9] text-4xl font-bold tracking-tight mb-8">Free</h3>
            <ul className="flex flex-col gap-3.5 mb-10 grow text-xs text-[#94A3B8]">
              <li className="flex items-center gap-3"><CheckIcon /> 5 free uses per month</li><li className="flex items-center gap-3"><CheckIcon /> Core AI transcription</li><li className="flex items-center gap-3"><CheckIcon /> Basic summaries</li>
            </ul>
            <button type="button" disabled className="w-full mt-auto py-3 rounded-full border border-white/10 text-[#94A3B8] font-medium text-xs bg-white/5 cursor-default">{entitlements.tier === 'FREE' ? 'Current Plan' : 'Free Tier Included'}</button>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-col bg-[#161823]/95 backdrop-blur-2xl border border-white/10 rounded-4xl p-8 transform md:scale-105 shadow-[0_0_60px_rgba(11,15,24,0.8)] z-20 hover:-translate-y-1.5 transition-transform duration-300 relative">
            <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent rounded-4xl pointer-events-none"></div>
            <div className="flex items-center justify-between mb-3 relative z-10"><p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider">Pro Plan</p>{entitlements.tier === 'PRO' && <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">Active</span>}</div>
            <div className="flex items-end gap-1 mb-8 relative z-10"><h3 className="text-[#F1F5F9] text-4xl font-bold tracking-tight">$9.99</h3><span className="text-[#94A3B8] mb-1 text-sm font-medium">/month</span></div>
            <ul className="flex flex-col gap-3.5 mb-10 grow text-xs text-[#94A3B8] relative z-10">
              <li className="flex items-center gap-3"><CheckIcon /> Unlimited voice processing</li><li className="flex items-center gap-3"><CheckIcon /> Task & Deadline Extraction</li><li className="flex items-center gap-3"><CheckIcon /> Smart Tone Reply Generator</li><li className="flex items-center gap-3"><CheckIcon /> 1-Click TXT & CSV Exports</li><li className="flex items-center gap-3"><CheckIcon /> Global Language Translations</li>
            </ul>
            {entitlements.tier === 'PRO' ? (
              <button type="button" disabled className="w-full mt-auto py-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs cursor-default flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Current Active Subscription</button>
            ) : (
              <form action="/api/checkout" method="POST" className="mt-auto relative z-10"><input type="hidden" name="plan" value="pro" /><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={buttonSpring} type="submit" className="w-full py-3 rounded-full bg-[#F1F5F9] text-[#0B0F18] font-bold text-xs shadow-[0_0_20px_rgba(241,245,249,0.15)] hover:shadow-[0_0_30px_rgba(241,245,249,0.25)] transition-shadow">Upgrade to Pro</motion.button></form>
            )}
          </motion.div>
        </motion.div>
      </motion.section>
      
      {/* SUPPORT SECTION */}
      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={staggerContainer} id="support" className="relative w-full max-w-5xl mx-auto pt-24 pb-28 px-4 flex flex-col items-center justify-center border-t border-black/5 dark:border-[rgba(255,255,255,0.03)]">
        <motion.div variants={fadeUp} className="relative z-10 text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F3F1EC]">Support</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#98A0B2] mt-3">Need help with GIST? We're here for you.</p>
        </motion.div>

        <motion.div variants={staggerContainer} className="relative z-10 w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Email Card */}
          <motion.a href="mailto:nasir.ah.khan99@gmail.com" variants={fadeUp} className="flex flex-col items-center text-center p-6 bg-white dark:bg-[#12151C] border border-black/5 dark:border-[rgba(255,255,255,0.04)] rounded-2xl hover:border-black/10 dark:hover:border-white/10 transition-colors group shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4 text-[#111827] dark:text-[#F3F1EC] group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#111827] dark:text-[#F3F1EC] mb-1">Email</h4>
            <span className="text-sm text-[#6B7280] dark:text-[#98A0B2] group-hover:text-[#111827] dark:group-hover:text-[#F3F1EC] transition-colors break-all">nasir.ah.khan99<br/>@gmail.com</span>
          </motion.a>

          {/* Phone Card */}
          <motion.a href="tel:03357333789" variants={fadeUp} className="flex flex-col items-center text-center p-6 bg-white dark:bg-[#12151C] border border-black/5 dark:border-[rgba(255,255,255,0.04)] rounded-2xl hover:border-black/10 dark:hover:border-white/10 transition-colors group shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4 text-[#111827] dark:text-[#F3F1EC] group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#111827] dark:text-[#F3F1EC] mb-1">Phone</h4>
            <span className="text-sm text-[#6B7280] dark:text-[#98A0B2] group-hover:text-[#111827] dark:group-hover:text-[#F3F1EC] transition-colors">03357333789</span>
          </motion.a>

          {/* Location Card */}
          <motion.div variants={fadeUp} className="flex flex-col items-center text-center p-6 bg-white dark:bg-[#12151C] border border-black/5 dark:border-[rgba(255,255,255,0.04)] rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4 text-[#111827] dark:text-[#F3F1EC]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#111827] dark:text-[#F3F1EC] mb-1">Location</h4>
            <span className="text-sm text-[#6B7280] dark:text-[#98A0B2]">Islamabad Capital Territory, Pakistan</span>
          </motion.div>
        </motion.div>
      </motion.section>
      
      <style dangerouslySetInnerHTML={{__html: `
        html, body { background-color: #0B0F18 !important; color: #F1F5F9; scroll-behavior: smooth; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #1A1D27; border-radius: 20px; }
        .wrap-break-word { overflow-wrap: break-word; word-wrap: break-word; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
      `}} />
    </div>
  );
}

// --- Subcomponents ---

function MockResultCard({ title }: { title: string }) {
  return (
    <div className="p-5 border border-white/5 rounded-2xl bg-[#12151C]/50 flex flex-col min-h-24">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-4">{title}</h3>
      <div className="space-y-3 opacity-40">
        <div className="h-2.5 bg-white/20 rounded-full w-full"></div>
        <div className="h-2.5 bg-white/20 rounded-full w-4/5"></div>
        <div className="h-2.5 bg-white/20 rounded-full w-3/4"></div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="h-full flex flex-col p-7 bg-[#12151C]/80 backdrop-blur-xl border border-white/5 rounded-3xl shadow-sm transition-all duration-300 hover:border-white/15 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)] hover:-translate-y-1">
      <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center mb-5 text-[#F1F5F9] shadow-sm shrink-0" aria-hidden="true"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg></div>
      <h3 className="text-base font-bold text-[#F1F5F9] mb-2 tracking-wide">{title}</h3>
      <p className="text-xs text-[#94A3B8] leading-relaxed grow">{desc}</p>
    </motion.div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div layout className="border border-white/5 rounded-2xl bg-[#12151C]/80 backdrop-blur-xl shadow-sm overflow-hidden hover:border-white/10 transition-colors">
      <motion.button layout onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className="w-full flex items-center justify-between p-6 text-left focus:outline-none group">
        <span className="font-medium text-sm text-[#F1F5F9] group-hover:text-white transition-colors pr-4">{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 350, damping: 22 }} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#1E293B] transition-colors"><svg className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F1F5F9] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div layout initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: snappyEase }} className="px-6 overflow-hidden"><p className="text-[#94A3B8] text-xs leading-relaxed pb-6 pt-1">{answer}</p></motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProcessingStep({ label, isActive, isDone }: { label: string, isActive: boolean, isDone: boolean }) {
  return (
    <div className={`flex items-center gap-4 transition-all duration-300 ease-out ${isActive || isDone ? 'opacity-100' : 'opacity-30'}`}>
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {isDone ? (
          <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-emerald-400 relative z-10 bg-[#0B0F18]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></motion.svg>
        ) : isActive ? (
          <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} className="w-2.5 h-2.5 rounded-full bg-[#F1F5F9] relative z-10" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-[#272A35] relative z-10"></div>
        )}
      </div>
      <span className={`text-xs font-medium transition-colors duration-200 ${isActive ? 'text-[#F1F5F9]' : 'text-[#94A3B8]'}`}>{label}</span>
    </div>
  );
}

function MiniWaveform() {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
      {[0.4, 0.8, 0.3, 1, 0.5].map((h, i) => <motion.div key={i} animate={{ scaleY: [h, 1, h] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }} className="w-0.5 bg-[#F1F5F9] rounded-full origin-bottom" style={{ height: '100%' }} />)}
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
}

function ResultCard({ title, content, variant, fullWidth = false, isPrimary = false, scrollable = false, activeTone, onChangeTone, isRegenerating, showTranslate }: ResultCardProps) {
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

  let containerStyles = "bg-[#12151C] border-white/5 shadow-sm";
  let titleStyles = "text-[#94A3B8]";
  let contentStyles = "text-[#F1F5F9]";

  if (variant === 'summary') {
    containerStyles = "bg-linear-to-br from-[#161922] to-[#0B0F18] border border-white/5 shadow-[0_0_20px_rgba(22,25,34,0.3)] ring-1 ring-white/5";
    titleStyles = "text-emerald-400";
    contentStyles = isPrimary ? "text-[#F1F5F9] font-medium text-lg leading-relaxed" : "text-[#F1F5F9] font-medium text-sm";
  } else if (variant === 'reply') {
    containerStyles = "bg-[#12151C]/70 border-white/5 shadow-sm";
    titleStyles = "text-[#94A3B8]";
    contentStyles = "text-[#F1F5F9] text-sm leading-relaxed";
  } else if (variant === 'transcript') {
    containerStyles = "bg-[#080B12]/60 border-white/5 shadow-inner";
    contentStyles = "text-[#94A3B8] font-mono text-sm leading-relaxed tracking-wide";
  }

  const renderContent = () => {
    if (variant === 'keyPoints') {
      return displayContent.split('\n').filter(Boolean).map((line: string, i: number) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0 text-sm">
          <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className={contentStyles}>{line.replace(/^[•-]\s*/, '')}</span>
        </div>
      ));
    }
    if (variant === 'actionItems') {
      return displayContent.split('\n').filter(Boolean).map((line: string, i: number) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0 text-sm">
          <svg className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className={contentStyles}>{line.replace(/^\[[x ]?\]\s*/i, '')}</span>
        </div>
      ));
    }
    if (variant === 'reply' && isRegenerating) {
       return (
         <div className="flex items-center gap-3 text-[#94A3B8] h-full py-4 text-sm">
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
                    <button key={tone} onClick={() => onChangeTone(tone)} disabled={isRegenerating} className={`px-3 py-1 text-xs rounded-full transition-colors font-medium border ${activeTone === tone ? 'bg-[#F1F5F9] text-[#0B0F18] border-[#F1F5F9]' : 'bg-transparent text-[#94A3B8] border-white/10 hover:border-white/20'}`}>{tone}</button>
                 ))}
              </div>
           )}
        </div>
        
        <div className="flex items-center gap-2">
          {showTranslate && !translatedText && (
             <button onClick={handleTranslate} disabled={isTranslating} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-[#F1F5F9] rounded border border-white/10 transition-colors flex items-center gap-1.5">
                {isTranslating ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Translate'}
             </button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCopy} disabled={isRegenerating} className="text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg p-1.5 transition-colors flex items-center justify-center w-8 h-8 relative group shrink-0" title="Copy to clipboard">
            {copied ? <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-emerald-400 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></motion.svg> : <svg className="w-4 h-4 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </motion.button>
        </div>
      </div>
      <div className={`flex-1 ${contentStyles} ${scrollable ? 'max-h-80 overflow-y-auto pr-3 custom-scrollbar' : ''} ${variant === 'reply' ? 'mt-2' : ''}`}>
        {renderContent()}
      </div>
    </motion.div>
  );
}

function CheckIcon() {
  return <div className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-white/5 border border-white/10"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>;
}