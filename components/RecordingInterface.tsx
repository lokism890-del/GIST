'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Sparkles } from 'lucide-react';
import { useUsage } from '../lib/useUsage';
import AuthModal from './AuthModal';

export default function RecordingInterface() {
  const { usageCount, incrementUsage, isLimitReached, MAX_FREE_USES } = useUsage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (!isRecording && isLimitReached) {
      // Gatekeeper: Prevent recording and show Auth Modal
      setShowAuth(true);
      return;
    }

    setIsRecording(!isRecording);
    
    if (isRecording) {
      // Stopped recording: process the audio and increment the free tier count
      incrementUsage();
      setRecordingTime(0);
    } else {
      setRecordingTime(0); 
    }
  };

  if (showAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 w-full bg-gray-50/50 p-6">
        <AuthModal onSuccess={() => setShowAuth(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-100 w-full bg-gray-50/50 p-6">
      <div className="relative flex flex-col items-center bg-white/80 backdrop-blur-xl border border-gray-200/60 shadow-2xl rounded-3xl p-10 w-full max-w-sm transition-all duration-500">
        
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold tracking-widest text-emerald-600 uppercase">
            AI Voice Intelligence
          </span>
        </div>

        {/* Free Tier Indicator */}
        {!isLimitReached && (
          <div className="text-xs text-gray-400 font-medium mb-4">
            {MAX_FREE_USES - usageCount} free summaries remaining
          </div>
        )}

        <div className="text-5xl font-mono font-bold text-gray-900 mb-2 tracking-tight">
          {formatTime(recordingTime)}
        </div>
        
        <p className="text-sm text-gray-500 font-medium mb-8">
          {isRecording ? "Listening closely..." : "Tap the mic to process."}
        </p>

        <div className="h-12 flex items-center justify-center gap-1 mb-6 w-full">
          {isRecording ? (
            [...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-indigo-500 rounded-full"
                animate={{ height: ["20%", "100%", "20%"] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
              />
            ))
          ) : (
            <div className="h-1.5 w-16 bg-gray-200 rounded-full transition-all duration-500" />
          )}
        </div>

        <div className="relative flex justify-center items-center mt-2">
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.3, 1] }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl z-0"
              />
            )}
          </AnimatePresence>

          <button
            onClick={toggleRecording}
            className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
              isRecording ? 'bg-gray-900 hover:bg-gray-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isRecording ? 'stop' : 'record'}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                {isRecording ? <Square className="w-8 h-8" fill="currentColor" /> : <Mic className="w-8 h-8" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
}