"use client";

import React, { useState, useEffect } from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function TermsOfService() {
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
    <PolicyPage title="Terms of Service" isDarkMode={isDarkMode}>
      <p className={`text-sm mb-8 ${metaColor}`}>
        Last updated: {new Date().toLocaleDateString()}
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>1. Agreement to Terms</h2>
      <p className={`mb-6 ${textColor}`}>
        By accessing or using GIST, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>2. Use of Service</h2>
      <p className={`mb-6 ${textColor}`}>
        You agree to use GIST only for lawful purposes. You are strictly prohibited from uploading audio that contains illegal material, violates intellectual property rights, or is otherwise highly sensitive or unauthorized by the recorded parties.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>3. Intellectual Property</h2>
      <p className={`mb-6 ${textColor}`}>
        The original audio, transcripts, and summaries generated from your usage belong to you. The GIST application, underlying code, visual design, and original content remain the exclusive property of GIST and its licensors.
      </p>

      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>4. Subscriptions and Payments</h2>
      <p className={`mb-6 ${textColor}`}>
        Certain premium features of GIST are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis depending on the subscription plan you select. You can manage or cancel your subscription at any time.
      </p>

      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>5. Limitation of Liability</h2>
      <p className={`mb-6 ${textColor}`}>
        In no event shall GIST, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
      </p>
    </PolicyPage>
  );
}