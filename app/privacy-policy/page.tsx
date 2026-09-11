"use client";

import React, { useState, useEffect } from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function PrivacyPolicy() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); 
    const storedTheme = localStorage.getItem('gist_theme');
    if (storedTheme === 'light') {
      setIsDarkMode(false);
    }
  }, []);

  if (!mounted) return null;

  const textColor = isDarkMode ? "text-[#94A3B8]" : "text-stone-600";
  const headingColor = isDarkMode ? "text-[#F1F5F9]" : "text-stone-900";
  const metaColor = isDarkMode ? "text-[#64748B]" : "text-stone-500";

  return (
    <PolicyPage title="Privacy Policy" isDarkMode={isDarkMode}>
      <p className={`text-sm mb-8 ${metaColor}`}>
        Last updated: {new Date().toLocaleDateString()}
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>1. Introduction</h2>
      <p className={`mb-6 ${textColor}`}>
        Welcome to GIST. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you use our voice intelligence services and tell you about your privacy rights.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>2. Data We Collect</h2>
      <p className={`mb-6 ${textColor}`}>
        As an AI processing service, we temporarily collect audio recordings you submit strictly for the purpose of generating transcripts and summaries. <strong className={headingColor}>We do not use your personal audio data to train public AI models.</strong> We also collect basic account, billing, and usage information necessary to provide the service.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>3. How We Use Your Data</h2>
      <p className={`mb-4 ${textColor}`}>We use your data exclusively to:</p>
      <ul className={`list-disc pl-5 space-y-2 mb-6 ${textColor}`}>
        <li>Provide, operate, and maintain our core transcription and summarization services.</li>
        <li>Process subscription transactions via our billing provider.</li>
        <li>Send you technical notices, updates, and security alerts.</li>
      </ul>

      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>4. Data Security</h2>
      <p className={`mb-6 ${textColor}`}>
        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. Audio processing is handled securely, and transient files are routinely cleared from active processing environments.
      </p>

      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>5. Contact Us</h2>
      <p className={`mb-6 ${textColor}`}>
        If you have any questions about this privacy policy or our privacy practices, please contact us via our designated support email found in the footer of our website.
      </p>
    </PolicyPage>
  );
}