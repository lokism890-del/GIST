import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function TermsOfService() {
  return (
    <PolicyPage title="Terms of Service">
      <p className="text-sm text-stone-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">1. Agreement to Terms</h2>
      <p className="mb-6">By accessing or using GIST, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">2. Use of Service</h2>
      <p className="mb-6">You agree to use GIST only for lawful purposes. You are strictly prohibited from uploading audio that contains illegal material, violates intellectual property rights, or is otherwise highly sensitive or unauthorized by the recorded parties.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">3. Intellectual Property</h2>
      <p className="mb-6">The original audio, transcripts, and summaries generated from your usage belong to you. The GIST application, underlying code, visual design, and original content remain the exclusive property of GIST and its licensors.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">4. Subscriptions and Payments</h2>
      <p className="mb-6">Certain premium features of GIST are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis depending on the subscription plan you select. You can manage or cancel your subscription at any time.</p>

      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">5. Limitation of Liability</h2>
      <p className="mb-6">GIST provides AI-generated transcripts and summaries. While we utilize industry-leading models, we do not guarantee that the output will be 100% error-free. You are solely responsible for reviewing the output before relying on it for professional, legal, or personal decisions.</p>
    </PolicyPage>
  );
}