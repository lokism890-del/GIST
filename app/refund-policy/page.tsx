"use client";

import React, { useState, useEffect } from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function RefundPolicy() {
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
    <PolicyPage title="Refund Policy" isDarkMode={isDarkMode}>
      <p className={`text-sm mb-8 ${metaColor}`}>
        Last updated: {new Date().toLocaleDateString()}
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>1. Subscription Cancellations</h2>
      <p className={`mb-6 ${textColor}`}>
        You can cancel your GIST Pro subscription at any time. When you cancel, you will continue to have access to all Pro features until the end of your current billing period. No further charges will be applied after cancellation.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>2. Refunds</h2>
      <p className={`mb-6 ${textColor}`}>
        As GIST provides immediate access to digital processing resources and costly AI computing infrastructure, we generally do not offer refunds for partial subscription months or past usage. We offer a Free Tier specifically so users can test the accuracy and functionality of our service prior to upgrading.
      </p>
      
      <h2 className={`text-xl font-semibold mt-10 mb-4 ${headingColor}`}>3. Exceptions</h2>
      <p className={`mb-6 ${textColor}`}>
        Refunds may be granted on a case-by-case basis at our sole discretion, such as in the event of demonstrable billing errors or significant, prolonged service outages that prevented you from using the platform you paid for. Please contact support to initiate a review.
      </p>
    </PolicyPage>
  );
}