import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function RefundPolicy() {
  return (
    <PolicyPage title="Refund Policy">
      <p className="text-sm text-stone-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">1. Subscription Cancellations</h2>
      <p className="mb-6">You can cancel your GIST Pro subscription at any time. When you cancel, you will continue to have access to all Pro features until the end of your current billing period. No further charges will be applied after cancellation.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">2. Refunds</h2>
      <p className="mb-6">As GIST provides immediate access to digital processing resources and costly AI computing infrastructure, we generally do not offer refunds for partial subscription months or past usage. We offer a Free Tier specifically so users can test the accuracy and functionality of our service prior to upgrading.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">3. Exceptions</h2>
      <p className="mb-6">Refunds may be granted on a case-by-case basis at our sole discretion, such as in the event of demonstrable billing errors or significant, prolonged service outages that prevented you from using the platform you paid for. Please contact support to initiate a review.</p>
    </PolicyPage>
  );
}