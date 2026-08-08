import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function PrivacyPolicy() {
  return (
    <PolicyPage title="Privacy Policy">
      <p className="text-sm text-stone-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">1. Introduction</h2>
      <p className="mb-6">Welcome to GIST. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you use our voice intelligence services and tell you about your privacy rights.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">2. Data We Collect</h2>
      <p className="mb-6">As an AI processing service, we temporarily collect audio recordings you submit strictly for the purpose of generating transcripts and summaries. <strong>We do not use your personal audio data to train public AI models.</strong> We also collect basic account, billing, and usage information necessary to provide the service.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">3. How We Use Your Data</h2>
      <p className="mb-4">We use your data exclusively to:</p>
      <ul className="list-disc pl-5 space-y-2 mb-6 text-stone-600">
        <li>Provide, operate, and maintain our core transcription and summarization services.</li>
        <li>Process subscription transactions via our billing provider.</li>
        <li>Send you technical notices, updates, and security alerts.</li>
      </ul>

      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">4. Data Security</h2>
      <p className="mb-6">We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. Audio processing is handled securely, and transient files are routinely cleared from active processing environments.</p>

      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">5. Contact Us</h2>
      <p className="mb-6">If you have any questions about this privacy policy or our privacy practices, please contact us via our designated support email found in the footer of our website.</p>
    </PolicyPage>
  );
}