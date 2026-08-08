import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function ShippingPolicy() {
  return (
    <PolicyPage title="Shipping Policy">
      <p className="text-sm text-stone-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">1. Digital Delivery</h2>
      <p className="mb-6">GIST is entirely a digital Software-as-a-Service (SaaS) product. All services, including transcriptions, API access, and summaries, are delivered digitally via your web browser or connected integrations.</p>
      
      <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-4">2. Physical Goods</h2>
      <p className="mb-6">We do not sell, distribute, or ship any physical goods. Therefore, no shipping fees, delivery times, customs duties, or physical fulfillment policies apply to your use of GIST or your Pro subscription.</p>
    </PolicyPage>
  );
}