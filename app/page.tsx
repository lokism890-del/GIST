"use client";

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';

interface SummarizeResult {
  gist?: string;
  keyPoints?: string | string[];
  actionItems?: string | string[];
  suggestedReply?: string;
  transcript?: string;
  language?: string;
  translation?: string;
}

interface UserEntitlements {
  tier: 'FREE' | 'PRO';
  usageCount: number;
  usageLimit: number;
}

const PROCESSING_STAGES = [
  "Recording complete",
  "Uploading",
  "Transcribing",
  "Understanding",
  "Preparing Gist"
];

export default function Page() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SummarizeResult | null>(null);
  const [lastAudioData, setLastAudioData] = useState<Blob | File | null>(null);
  
  // Translation States
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch('/api/user/entitlements')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch entitlements');
        return res.json();
      })
      .then(data => setEntitlements(data))
      .catch(() => {
        setEntitlements({ tier: 'FREE', usageCount: 0, usageLimit: 5 });
      });
  }, []);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
      if (!savedTheme) localStorage.setItem('theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [results]);

  useEffect(() => {
    return () => stopRecordingCleanup();
  }, []);

  useEffect(() => {
    if (!isProcessing) {
      setProcessingStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setProcessingStageIndex((prev) => (prev < PROCESSING_STAGES.length - 1 ? prev + 1 : prev));
    }, 600); 
    return () => clearInterval(interval);
  }, [isProcessing]);

  const startRecording = async () => {
    if (entitlements?.tier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
      setError("You have reached your monthly Free tier limit. Please upgrade to Pro to continue processing voice notes.");
      return;
    }

    setError(null);
    setResults(null);
    setTranslationError(null);
    
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
        const level = 1 + (average / 255) * 0.5;
        setAudioLevel(level);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setError('Microphone access is required to record. Please check your permissions.');
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setAudioLevel(1);
    setIsRecording(false);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopRecordingCleanup();
  };

  const processAudio = async (audioData: Blob | File) => {
    const isFile = 'name' in audioData;
    
    setLastAudioData(audioData);
    setIsProcessing(true);
    setProcessingStageIndex(isFile ? 1 : 0);
    setError(null);
    setTranslationError(null);
    
    try {
      const formData = new FormData();
      if (isFile) {
        formData.append('audio', audioData);
      } else {
        formData.append('audio', audioData, 'recording.webm');
      }

      const [response] = await Promise.all([
        fetch('/api/summarize', {
          method: 'POST',
          body: formData,
        }),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Processing failed (Status ${response.status})`);
      }

      const data: SummarizeResult = await response.json();
      
      setProcessingStageIndex(PROCESSING_STAGES.length - 1);
      
      setTimeout(() => {
        setResults(data);
        setIsProcessing(false);
        if (entitlements && entitlements.tier === 'FREE') {
          setEntitlements(prev => prev ? { ...prev, usageCount: prev.usageCount + 1 } : prev);
        }
      }, 300);

    } catch (err: any) {
      console.error('Error processing audio:', err);
      setError(err.message || 'An error occurred while processing your audio.');
      setIsProcessing(false);
    }
  };

  const handleTranslate = async () => {
    if (!results?.transcript) return;
    setIsTranslating(true);
    setTranslationError(null);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: results.transcript, 
          sourceLanguage: results.language 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate translation. Please try again.');
      }

      const data = await response.json();
      setResults(prev => prev ? { ...prev, translation: data.translation } : prev);
    } catch (err: any) {
      setTranslationError(err.message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) validateAndProcessFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateAndProcessFile = (file: File) => {
    if (entitlements?.tier === 'FREE' && entitlements.usageCount >= entitlements.usageLimit) {
      setError("You have reached your monthly Free tier limit. Please upgrade to Pro to continue.");
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setError('Please upload a valid audio file.');
      return;
    }
    processAudio(file);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const resetState = () => {
    setResults(null);
    setError(null);
    setTranslationError(null);
    setRecordingTime(0);
    setLastAudioData(null);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  // Check if translation UI is needed
  const isNonEnglish = results?.language && !['english', 'en'].includes(results.language.toLowerCase());

  return (
    <div className="min-h-screen font-sans flex flex-col overflow-x-hidden transition-colors duration-300 relative">
      
      {/* HEADER */}
      <header className="w-full px-5 py-4 flex items-center justify-between border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 fade-in d-header transition-colors duration-300">
        <div className="flex-1 flex items-center justify-start">
          <button onClick={scrollToTop} className="flex flex-col text-left hover:opacity-70 transition-opacity duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 leading-none d-text-primary">GIST</h1>
            <span className="text-xs font-bold tracking-widest text-stone-400 uppercase mt-1 d-text-secondary">
              Voice Intelligence
            </span>
          </button>
        </div>
        
        <nav className="hidden md:flex flex-1 items-center justify-center gap-8 text-sm font-medium text-stone-500 d-text-secondary">
          <a href="#features" className="hover:text-stone-900 transition-colors duration-200 d-hover-text">Features</a>
          <a href="#faq" className="hover:text-stone-900 transition-colors duration-200 d-hover-text">FAQ</a>
          <a href="#pricing" className="hover:text-stone-900 transition-colors duration-200 d-hover-text">Pricing</a>
        </nav>
        
        <div className="flex-1 flex items-center justify-end gap-5">
          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 d-text-secondary d-hover transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 w-10 h-10 flex items-center justify-center overflow-hidden"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && (
              <>
                <svg className={`absolute w-5 h-5 transition-all duration-300 ease-in-out ${isDarkMode ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <svg className={`absolute w-5 h-5 transition-all duration-300 ease-in-out ${isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </>
            )}
          </button>

          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-semibold text-stone-700 d-text-primary">
              {entitlements?.tier === 'PRO' ? 'Pro Plan' : 'Free Tier'}
            </span>
            {entitlements?.tier !== 'PRO' && (
              <span className="text-xs text-stone-400 d-text-secondary">
                {entitlements ? `${entitlements.usageCount}/${entitlements.usageLimit} uses left` : '...'}
              </span>
            )}
          </div>
          
          <a href="/api/checkout" className="hidden sm:flex px-5 py-2 text-sm font-medium text-white bg-stone-900 rounded-full hover:bg-stone-800 active:scale-95 transition-all duration-200 shadow-sm d-accent-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            Upgrade to Pro
          </a>

          <button 
            className="md:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100 d-text-secondary d-hover transition-colors focus-visible:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden w-full bg-white border-b border-stone-200 d-header px-6 py-5 flex flex-col gap-5 fade-in z-40 absolute top-73px">
          <nav className="flex flex-col gap-4 text-base font-medium text-stone-600 d-text-primary">
            <a href="#features" onClick={closeMenu} className="hover:text-stone-900 d-hover-text">Features</a>
            <a href="#faq" onClick={closeMenu} className="hover:text-stone-900 d-hover-text">FAQ</a>
            <a href="#pricing" onClick={closeMenu} className="hover:text-stone-900 d-hover-text">Pricing</a>
          </nav>
          <div className="pt-4 border-t border-stone-100 d-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-700 d-text-primary">
                {entitlements?.tier === 'PRO' ? 'Pro Plan' : 'Free Tier'}
              </span>
              {entitlements?.tier !== 'PRO' && (
                <span className="text-sm text-stone-500 d-text-secondary">
                  {entitlements ? `${entitlements.usageCount}/${entitlements.usageLimit} uses left` : '...'}
                </span>
              )}
            </div>
            <a href="/api/checkout" className="w-full text-center px-5 py-3 text-sm font-medium text-white bg-stone-900 d-accent-bg rounded-xl active:scale-95 transition-all shadow-sm">
              Upgrade to Pro
            </a>
          </div>
        </div>
      )}

      {/* DASHBOARD HERO */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-5 sm:p-8 flex flex-col items-center justify-center transition-all duration-500 min-h-[80vh]">
        
        {error && !isProcessing && !lastAudioData && (
          <div className="w-full max-w-md mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl flex items-center justify-between fade-in shadow-sm d-card d-border d-text-primary">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-2 text-red-500 hover:text-red-700 font-bold ml-2 active:scale-95 outline-none">&times;</button>
          </div>
        )}

        {!isProcessing && !results && !error && (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-10 fade-in">
            <div className="text-center space-y-2 h-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 d-text-primary">
                {isRecording ? formatTime(recordingTime) : "Ready to listen"}
              </h2>
              <p className="text-stone-500 text-sm font-medium d-text-secondary">
                {isRecording ? "Listening... Tap to stop" : "Tap the microphone to start recording."}
              </p>
            </div>

            <div className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56 my-4">
              {isRecording && (
                <div 
                  className="absolute inset-0 bg-red-100 rounded-full transition-transform duration-75 ease-out"
                  style={{ transform: `scale(${audioLevel})` }}
                  aria-hidden="true"
                />
              )}
              
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                className={`relative z-10 flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 rounded-full transition-all duration-300 ease-out shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 
                  ${isRecording ? 'mic-recording' : 'bg-white text-stone-700 hover:shadow-xl hover:scale-105 hover:text-stone-900 border border-stone-200 d-card d-border d-text-primary d-hover'}`}
              >
                {!isRecording ? (
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2.5" />
                  </svg>
                )}
              </button>
            </div>

            {!isRecording && (
              <div className="w-full">
                <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                    ${isDragging ? 'border-indigo-400 bg-indigo-50/50' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 active:scale-95 shadow-sm hover:shadow-md d-card d-border d-hover'}`}
                >
                  <svg className={`w-6 h-6 transition-colors duration-300 ${isDragging ? 'text-indigo-600 animate-bounce' : 'text-stone-400 group-hover:text-stone-600 d-text-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium text-stone-500 group-hover:text-stone-700 transition-colors d-text-secondary">
                    Click to upload or drag audio here
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="w-full flex flex-col items-center justify-center fade-in">
            <div className="w-full max-w-sm mb-12 flex flex-col space-y-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <MiniWaveform />
                <h2 className="text-xl font-semibold text-stone-900 d-text-primary">Processing audio...</h2>
              </div>
              <div className="flex flex-col gap-4 pl-6">
                {PROCESSING_STAGES.map((stage, idx) => {
                  const isUploadAndFirstStage = stage === "Recording complete" && ('name' in (lastAudioData || {}));
                  if (isUploadAndFirstStage) return null;
                  return <ProcessingStep key={stage} label={stage} isActive={idx === processingStageIndex} isDone={idx < processingStageIndex} />;
                })}
              </div>
            </div>
            <div className="w-full max-w-4xl" aria-hidden="true">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            </div>
          </div>
        )}

        {error && lastAudioData && !isProcessing && (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-8 fade-in">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-sm d-card d-border">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-stone-900 d-text-primary">Analysis Failed</h2>
              <p className="text-sm text-stone-500 d-text-secondary px-4">{error}</p>
            </div>
            <div className="flex gap-4">
              <button onClick={resetState} className="px-6 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-full hover:bg-stone-50 active:scale-95 shadow-sm d-card d-border d-text-primary d-hover">Cancel</button>
              <button onClick={() => processAudio(lastAudioData)} className="px-6 py-2.5 text-sm font-medium text-white bg-stone-900 rounded-full hover:bg-stone-800 active:scale-95 shadow-sm d-accent-bg">Try Again</button>
            </div>
          </div>
        )}

        {results && !isProcessing && (
          <div className="w-full" aria-live="polite">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-8 pb-6 border-b border-stone-200 d-border fade-in-up">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-stone-900 d-text-primary flex items-center gap-3">
                  Analysis Complete
                </h2>
                <p className="text-sm text-stone-500 d-text-secondary mt-2">Review your transcription and insights below.</p>
              </div>
              <button onClick={resetState} className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-stone-900 rounded-full hover:bg-stone-800 active:scale-95 shadow-md flex items-center justify-center gap-2 d-accent-bg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Voice Note
              </button>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {results.gist && (
                <div className="fade-in-up opacity-0 md:col-span-2" style={{ animationDelay: '100ms' }}>
                  <ResultCard title="The Gist" content={results.gist} variant="summary" isPrimary />
                </div>
              )}
              
              {entitlements?.tier === 'PRO' ? (
                <>
                  {results.keyPoints && (
                    <div className="fade-in-up opacity-0" style={{ animationDelay: '200ms' }}>
                      <ResultCard title="Key Points" content={results.keyPoints} variant="keyPoints" />
                    </div>
                  )}
                  {results.actionItems && (
                    <div className="fade-in-up opacity-0" style={{ animationDelay: '300ms' }}>
                      <ResultCard title="Action Items" content={results.actionItems} variant="actionItems" />
                    </div>
                  )}
                  {results.suggestedReply && (
                    <div className="fade-in-up opacity-0" style={{ animationDelay: '400ms' }}>
                      <ResultCard title="Suggested Reply" content={results.suggestedReply} variant="reply" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="fade-in-up opacity-0" style={{ animationDelay: '200ms' }}>
                    <LockedProCard title="Key Points" desc="Unlock detailed bullet points." />
                  </div>
                  <div className="fade-in-up opacity-0" style={{ animationDelay: '300ms' }}>
                    <LockedProCard title="Action Items" desc="Unlock automatic task extraction." />
                  </div>
                  <div className="fade-in-up opacity-0" style={{ animationDelay: '400ms' }}>
                    <LockedProCard title="Suggested Reply" desc="Unlock AI-generated smart replies." />
                  </div>
                </>
              )}
            </div>

            {/* Transcription with Language Badge */}
            {results.transcript && (
              <div className="mt-8 fade-in-up opacity-0 relative" style={{ animationDelay: '500ms' }}>
                {results.language && (
                  <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full bg-stone-200 text-stone-700 text-xs font-semibold shadow-sm d-card d-border d-text-primary">
                    Detected Language: <span className="ml-1 capitalize text-indigo-600 d-accent">{results.language}</span>
                  </div>
                )}
                <ResultCard title="Full Transcript" content={results.transcript} variant="transcript" fullWidth scrollable />
              </div>
            )}

            {/* Pro Translation Feature */}
            {isNonEnglish && (
              <div className="mt-6 fade-in-up opacity-0" style={{ animationDelay: '600ms' }}>
                {entitlements?.tier === 'PRO' ? (
                  results.translation ? (
                    <ResultCard title="English Translation" content={results.translation} variant="transcript" fullWidth scrollable />
                  ) : (
                    <div className="p-6 border rounded-2xl bg-white border-stone-200 shadow-sm flex flex-col items-center justify-center min-h-120px d-card d-border">
                      {isTranslating ? (
                        <div className="flex items-center gap-3 text-stone-500 d-text-primary">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Translating to English...
                        </div>
                      ) : (
                        <>
                          <button onClick={handleTranslate} className="px-6 py-2.5 bg-stone-900 text-stone-50 rounded-full text-sm font-medium hover:scale-105 transition-transform active:scale-95 shadow-sm d-accent-bg">
                            Translate to English
                          </button>
                          {translationError && <p className="text-red-500 text-xs mt-3">{translationError}</p>}
                        </>
                      )}
                    </div>
                  )
                ) : (
                  <LockedProCard title="English Translation" desc="Unlock automatic English translations for foreign language voice notes." />
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* FEATURES SECTION */}
      <section id="features" className="scroll-animate opacity-0 translate-y-8 transition-all duration-700 ease-out w-full max-w-5xl mx-auto px-5 sm:px-8 py-20 border-t border-stone-200 d-border">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 d-text-primary">Everything you need to understand voice</h2>
          <p className="text-base text-stone-500 d-text-secondary mt-4">GIST transforms your scattered audio thoughts into structured, actionable text instantly.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <FeatureCard title="The Gist" desc="Instantly get the core message of any voice note without listening to the whole thing." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />} />
          <FeatureCard title="Action Items" desc="Automatically extract to-dos and follow-ups so nothing slips through the cracks." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />} />
          <FeatureCard title="AI Suggested Replies" desc="Generate professional, context-aware replies ready to be sent to your team or clients." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />} />
          <FeatureCard title="Full Transcripts" desc="Highly accurate, readable transcripts of your entire audio for deep-dive reference." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />} />
          <FeatureCard title="File Uploads" desc="Drag and drop existing audio files (.mp3, .wav, .webm) straight into the dashboard." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />} />
          <FeatureCard title="WhatsApp Integration" desc="Forward your voice notes directly to GIST via WhatsApp and get summaries instantly." icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />} />
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="scroll-animate opacity-0 translate-y-8 transition-all duration-700 ease-out w-full max-w-3xl mx-auto px-5 sm:px-8 py-20 border-t border-stone-200 d-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 d-text-primary">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-4">
          <FAQItem question="What is GIST?" answer="GIST is a Voice Intelligence tool designed to instantly transcribe and summarize your voice notes, extracting key points, action items, and generating suggested replies." />
          <FAQItem question="How does GIST work?" answer="You can record directly in your browser or upload an audio file. Our underlying AI model securely processes the audio to generate a highly accurate transcript and intelligent summaries." />
          <FAQItem question="Can I upload an audio file?" answer="Yes, you can easily drag and drop standard audio files directly into the dashboard for processing." />
          <FAQItem question="Does GIST support multiple languages?" answer="Yes, GIST automatically detects and transcribes multiple languages supported by our core AI models." />
          <FAQItem question="Is my audio private?" answer="Yes. Your audio is securely processed solely for generating your transcript and summary, and we do not use your personal voice data to train public models." />
          <FAQItem question="Can I use GIST with WhatsApp?" answer="Yes, GIST features a WhatsApp webhook integration allowing you to seamlessly process voice notes directly from your phone." />
          <FAQItem question="What does Pro include?" answer="Pro includes extended usage limits, full access to advanced structured insights, and priority processing." />
          <FAQItem question="How does billing work?" answer="We offer a straightforward subscription billed securely through our payment provider (Polar), which you can manage at any time." />
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="scroll-animate opacity-0 translate-y-8 transition-all duration-700 ease-out w-full max-w-5xl mx-auto px-5 sm:px-8 py-20 border-t border-stone-200 d-border mb-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 d-text-primary">Simple, transparent pricing</h2>
          <p className="text-base text-stone-500 d-text-secondary mt-4">Start for free, upgrade when you need more power.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch">
          <div className="p-8 bg-white border border-stone-200 rounded-3xl shadow-sm flex flex-col hover:shadow-md transition-shadow duration-300 d-card d-border">
            <h3 className="text-xl font-bold text-stone-900 d-text-primary mb-2">Free</h3>
            <p className="text-stone-500 d-text-secondary text-sm mb-6">Perfect for trying out GIST.</p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-stone-900 d-text-primary">$0</span>
              <span className="text-stone-400 d-text-secondary">/mo</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-stone-700 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-400 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>5 free uses per month</li>
              <li className="flex items-center gap-3 text-stone-700 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-400 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Core AI transcription</li>
              <li className="flex items-center gap-3 text-stone-700 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-400 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Basic summaries</li>
            </ul>
            <button className="w-full py-3 px-4 bg-stone-100 border border-stone-200 text-stone-600 font-medium rounded-xl hover:bg-stone-200 active:scale-95 transition-all d-elevated d-border d-text-primary d-hover">Current Plan</button>
          </div>

          <div className="p-8 bg-stone-900 border border-transparent rounded-3xl shadow-xl flex flex-col relative overflow-hidden hover:shadow-2xl transition-shadow duration-300 transform md:-translate-y-2 d-elevated d-border">
            <div className="absolute top-0 right-0 bg-stone-700 text-stone-50 text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-bl-xl shadow-sm d-card">Popular</div>
            <h3 className="text-xl font-bold text-white d-text-primary mb-2">Pro</h3>
            <p className="text-stone-400 d-text-secondary text-sm mb-6">For professionals who rely on voice.</p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-white d-text-primary">$9.99</span>
              <span className="text-stone-500 d-text-secondary">/mo</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-stone-200 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-500 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Unlimited voice processing</li>
              <li className="flex items-center gap-3 text-stone-200 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-500 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Advanced Action Items & Replies</li>
              <li className="flex items-center gap-3 text-stone-200 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-500 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>WhatsApp Bot Integration</li>
              <li className="flex items-center gap-3 text-stone-200 d-text-primary text-sm"><svg className="w-5 h-5 text-stone-500 d-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Priority processing speed</li>
            </ul>
            <form action="/api/checkout" method="POST" className="w-full mt-auto">
              <button type="submit" className="w-full py-3 px-4 bg-white text-stone-900 font-medium rounded-xl hover:bg-stone-100 active:scale-95 transition-all shadow-sm d-accent-bg">Upgrade to Pro</button>
            </form>
          </div>
        </div>
      </section>
      
      {/* GLOBAL STYLES FOR ANIMATIONS AND THEME OVERRIDES */}
      <style dangerouslySetInnerHTML={{__html: `
        /* --- Premium Light Mode --- */
        html, body {
          background-color: #F8F9FA; 
          color: #1c1917; 
          scroll-behavior: smooth;
          overscroll-behavior-y: none;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* --- Premium Graphite Dark Mode --- */
        html.dark, html.dark body { 
          background-color: #111110 !important; 
          color: #F2F0EB !important; 
        }
        html.dark .d-header { background-color: rgba(22, 22, 21, 0.85) !important; border-color: #302F2B !important; }
        html.dark .d-card { background-color: #1C1B19 !important; border-color: #302F2B !important; }
        html.dark .d-elevated { background-color: #22211F !important; border-color: #302F2B !important; }
        html.dark .d-text-primary { color: #F2F0EB !important; }
        html.dark .d-text-secondary { color: #A8A6A0 !important; }
        html.dark .d-border { border-color: #302F2B !important; }
        html.dark .d-accent-bg { background-color: #C9C3B8 !important; color: #111110 !important; border-color: #C9C3B8 !important; }
        html.dark .d-accent-bg:hover { background-color: #F2F0EB !important; color: #111110 !important; }
        html.dark .d-success { color: #7FC8A0 !important; }
        html.dark .d-accent { color: #C9C3B8 !important; }
        html.dark .d-reply-card { background-color: #1C1B19 !important; border-color: #302F2B !important; }
        html.dark .d-reply-text { color: #9FB7D1 !important; }
        html.dark .d-hover:hover { background-color: #22211F !important; }
        html.dark .d-hover-text:hover { color: #F2F0EB !important; }
        html.dark .d-icon-bg { background-color: #22211F !important; border-color: #302F2B !important; }
        html.dark .d-skeleton { background-color: #302F2B !important; }
        html.dark .d-blur-overlay { background-color: rgba(17, 17, 16, 0.7) !important; }

        /* --- Animations --- */
        @keyframes micPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .mic-recording {
          animation: micPulse 2s infinite;
          background-color: #ef4444 !important;
          color: white !important;
          border-color: #ef4444 !important;
        }

        @keyframes waveform {
          0% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
          100% { transform: scaleY(0.4); }
        }
        .animate-waveform {
          animation: waveform 1s ease-in-out infinite;
          transform-origin: bottom;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d6d3d1; border-radius: 20px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #302F2B; }
        
        .wrap-break-word { overflow-wrap: break-word; word-wrap: break-word; }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}} />
    </div>
  );
}

// Subcomponents

function LockedProCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="p-6 sm:p-8 border rounded-2xl transition-all duration-300 flex flex-col min-h-36 relative overflow-hidden bg-white border-stone-200 d-card d-border group">
      {/* Blurred Overlay */}
      <div className="absolute inset-0 bg-stone-50/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 transition-all duration-300 group-hover:backdrop-blur-md d-blur-overlay">
        <svg className="w-8 h-8 text-stone-400 mb-3 d-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h4 className="text-sm font-bold text-stone-900 mb-1 d-text-primary">Pro Feature</h4>
        <p className="text-xs text-stone-500 mb-4 text-center d-text-secondary">{desc}</p>
        <a href="/api/checkout" className="px-5 py-2 bg-stone-900 text-stone-50 text-xs font-medium rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm d-accent-bg">
          Unlock Pro
        </a>
      </div>
      
      {/* Background skeleton */}
      <div className="flex justify-between items-center mb-6 opacity-40">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 d-text-secondary">{title}</h3>
      </div>
      <div className="space-y-3 opacity-30">
        <div className="h-3 bg-stone-200 rounded w-full d-skeleton"></div>
        <div className="h-3 bg-stone-200 rounded w-5/6 d-skeleton"></div>
        <div className="h-3 bg-stone-200 rounded w-4/6 d-skeleton"></div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 d-card d-border">
      <div className="w-11 h-11 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-center mb-5 text-stone-700 shadow-sm transition-transform duration-300 group-hover:scale-110 d-icon-bg d-text-primary" aria-hidden="true">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <h3 className="text-base font-semibold text-stone-900 mb-2 d-text-primary">{title}</h3>
      <p className="text-sm text-stone-500 leading-relaxed d-text-secondary">{desc}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-stone-200 rounded-2xl bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md d-card d-border">
      <button 
        onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-stone-50 transition-colors active:bg-stone-100 d-hover"
      >
        <span className="font-medium text-stone-900 pr-4 d-text-primary">{question}</span>
        <svg className={`w-5 h-5 text-stone-400 transition-transform duration-300 shrink-0 d-text-secondary ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`px-5 transition-all duration-400 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`} aria-hidden={!isOpen}>
        <p className="text-stone-600 text-sm leading-relaxed d-text-secondary">{answer}</p>
      </div>
    </div>
  );
}

function ProcessingStep({ label, isActive, isDone }: { label: string, isActive: boolean, isDone: boolean }) {
  return (
    <div className={`flex items-center gap-4 transition-all duration-400 ease-out ${isActive || isDone ? 'opacity-100 translate-x-0' : 'opacity-40 -translate-x-2'}`}>
      <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
        {isDone ? (
          <svg className="w-5 h-5 text-stone-900 fade-in d-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        ) : isActive ? (
          <svg className="w-5 h-5 text-stone-900 animate-spin d-text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <div className="w-2 h-2 rounded-full bg-stone-200 transition-all duration-300 d-skeleton"></div>
        )}
      </div>
      <span className={`text-sm font-medium transition-colors duration-300 ${isActive ? 'text-stone-900 d-text-primary' : 'text-stone-400 d-text-secondary'}`}>{label}</span>
    </div>
  );
}

function MiniWaveform() {
  return (
    <div className="flex items-end gap-2px h-5" aria-hidden="true">
      <div className="w-1 bg-stone-400 rounded-full animate-waveform d-text-secondary" style={{ height: '60%', animationDelay: '0.0s' }} />
      <div className="w-1 bg-stone-600 rounded-full animate-waveform d-text-secondary" style={{ height: '100%', animationDelay: '0.2s' }} />
      <div className="w-1 bg-stone-900 rounded-full animate-waveform d-text-primary" style={{ height: '40%', animationDelay: '0.4s' }} />
      <div className="w-1 bg-stone-500 rounded-full animate-waveform d-text-secondary" style={{ height: '80%', animationDelay: '0.1s' }} />
    </div>
  );
}

function SkeletonCard({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <div className={`p-6 bg-white border border-stone-200 rounded-2xl shadow-sm flex flex-col min-h-36 d-card d-border ${fullWidth ? 'md:col-span-2' : ''}`} aria-hidden="true">
      <div className="flex justify-between items-center mb-6">
        <div className="h-3 w-24 bg-stone-100 rounded animate-pulse d-skeleton"></div>
        <div className="h-5 w-5 bg-stone-100 rounded animate-pulse d-skeleton"></div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-stone-100 rounded w-full animate-pulse d-skeleton"></div>
        <div className="h-3 bg-stone-100 rounded w-5/6 animate-pulse d-skeleton"></div>
        <div className="h-3 bg-stone-100 rounded w-4/6 animate-pulse d-skeleton"></div>
      </div>
    </div>
  );
}

type CardVariant = 'summary' | 'keyPoints' | 'actionItems' | 'reply' | 'transcript';

function ResultCard({ title, content, variant, fullWidth = false, isPrimary = false, scrollable = false }: { title: string, content: string | string[], variant: CardVariant, fullWidth?: boolean, isPrimary?: boolean, scrollable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const safeContent = Array.isArray(content) ? content.join('\n') : String(content || '');

  const handleCopy = () => {
    navigator.clipboard.writeText(safeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let containerStyles = "bg-white border-stone-200 shadow-sm d-card d-border";
  let titleStyles = "text-stone-400 d-text-secondary";
  let contentStyles = "text-stone-700 d-text-primary";

  if (variant === 'summary') {
    containerStyles = "bg-stone-50 border-stone-200 shadow-md d-elevated d-border";
    titleStyles = "text-stone-900 d-text-primary";
    contentStyles = isPrimary ? "text-stone-900 font-medium text-lg leading-relaxed d-text-primary" : "text-stone-800 font-medium d-text-primary";
  } else if (variant === 'reply') {
    containerStyles = "bg-indigo-50/50 border-indigo-100 shadow-sm d-reply-card d-border";
    titleStyles = "text-indigo-800/60 d-text-secondary";
    contentStyles = "text-indigo-900 d-reply-text";
  } else if (variant === 'transcript') {
    containerStyles = "bg-stone-50 border-stone-200 shadow-inner d-card d-border";
    contentStyles = "text-stone-600 font-mono text-sm leading-relaxed d-text-secondary";
  }

  const renderContent = () => {
    if (variant === 'keyPoints') {
      return safeContent.split('\n').filter(Boolean).map((line, i) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
          <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 d-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className={contentStyles}>{line.replace(/^[•-]\s*/, '')}</span>
        </div>
      ));
    }
    if (variant === 'actionItems') {
      return safeContent.split('\n').filter(Boolean).map((line, i) => (
        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
          <svg className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 d-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className={contentStyles}>{line.replace(/^\[[x ]?\]\s*/i, '')}</span>
        </div>
      ));
    }
    return <div className="whitespace-pre-wrap wrap-break-word">{safeContent}</div>;
  };

  return (
    <div className={`p-6 sm:p-8 border rounded-2xl transition-all duration-300 flex flex-col min-h-36 hover:shadow-md ${fullWidth ? 'md:col-span-2' : ''} ${containerStyles}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-xs font-bold uppercase tracking-widest ${titleStyles}`}>{title}</h3>
        <button onClick={handleCopy} className="text-stone-400 hover:text-stone-800 hover:bg-stone-100 active:bg-stone-200 rounded-lg p-2 transition-all flex items-center justify-center w-9 h-9 relative group shrink-0 active:scale-95 d-text-secondary d-hover" title="Copy to clipboard">
          {copied ? (
            <svg className="w-4 h-4 text-emerald-600 absolute fade-in d-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 absolute transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          )}
        </button>
      </div>
      <div className={`flex-1 ${contentStyles} ${scrollable ? 'max-h-96 overflow-y-auto pr-4 custom-scrollbar' : ''}`}>
        {renderContent()}
      </div>
    </div>
  );
}