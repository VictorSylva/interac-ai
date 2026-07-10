import React from 'react';
import { Clock, AlertTriangle, Shield, Check } from 'lucide-react';

export default function SubscriptionBanner({ status, trialEnd }) {
  // Bypass the banner entirely so users don't see any subscription warnings
  return null;

  if (!status) return null;

  if (status === 'active') {
      return (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 mx-4 md:mx-8 mt-4 rounded shadow-sm flex justify-between items-center animate-fade-in">
            <div className="flex items-center">
                <div className="bg-green-100 p-2 rounded-full mr-3">
                    <Shield className="text-green-600" size={20} />
                </div>
                <div>
                    <p className="font-bold text-green-700">Active Subscription</p>
                    <p className="text-sm text-green-600">Your account is fully verified. All features are unlocked.</p>
                </div>
            </div>
            <div className="flex items-center text-green-700 font-medium text-sm bg-green-100 px-3 py-1 rounded-full">
                <Check size={16} className="mr-1" /> Verified Business
            </div>
        </div>
      );
  }

  // If status is expired directly from DB
  const isExpired = status === 'expired';

  if (isExpired) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 mx-4 md:mx-8 mt-4 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-3" size={24} />
            <div>
                <p className="font-bold text-red-700 uppercase text-xs tracking-wider">Subscription Required</p>
                <p className="text-sm text-red-600 font-medium">Your account is currently inactive. Automations and AI responses are paused.</p>
            </div>
        </div>
        <button 
            onClick={() => window.location.href = '/dashboard/subscription'}
            className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-red-700 transition shadow-lg hover:shadow-red-200 whitespace-nowrap active:scale-95"
        >
            ACTIVATE PRO
        </button>
      </div>
    );
  }

  return null;
}
