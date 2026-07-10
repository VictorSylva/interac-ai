import React, { useState } from 'react';
import { 
  Wrench, 
  Coins, 
  Mail, 
  RefreshCw, 
  Send, 
  ShieldCheck,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export default function SupportToolsModule() {
  const [targetBusinessId, setTargetBusinessId] = useState('');
  const [tokenAmount, setTokenAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleCreditTokens = async () => {
    if (!targetBusinessId) return;
    setLoading(true);
    setMessage(null);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    try {
      const res = await fetch(`${apiUrl}/api/super-admin/businesses/${targetBusinessId}/credit-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: tokenAmount })
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully credited ${tokenAmount} tokens to ${targetBusinessId}` });
        setTargetBusinessId('');
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to credit tokens' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error or server unavailable' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Wrench size={24} className="text-blue-600" />
          Support & Maintenance
        </h2>
        <p className="text-grey-600 text-sm">Escalated actions and manual system overrides.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Token Management Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-grey-medium overflow-hidden flex flex-col">
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
             <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                <Coins size={20} />
             </div>
             <div>
                <h3 className="font-bold text-navy">Token Override</h3>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Manual Credit System</p>
             </div>
          </div>
          
          <div className="p-8 flex-1">
             <p className="text-sm text-grey-600 mb-6">Manually inject tokens into a business's PAYG wallet. This bypasses the payment gateway.</p>
             
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-grey-500 uppercase mb-2 ml-1">Business ID or Email</label>
                   <input 
                      type="text" 
                      placeholder="e.g. business_uuid or user@email.com"
                      value={targetBusinessId}
                      onChange={(e) => setTargetBusinessId(e.target.value)}
                      className="w-full px-5 py-3 bg-grey-50 border border-grey-medium rounded-2xl text-navy font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                   />
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-grey-500 uppercase mb-2 ml-1">Token Amount</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
                        className="w-full px-5 py-3 bg-grey-50 border border-grey-medium rounded-2xl text-navy font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600">TOKENS</div>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="p-6 bg-grey-50/50 border-t border-grey-medium">
             <button 
                disabled={loading || !targetBusinessId}
                onClick={handleCreditTokens}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                  loading || !targetBusinessId 
                    ? 'bg-blue-200 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                }`}
             >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {loading ? 'Processing...' : 'Authorize Manual Credit'}
             </button>
          </div>
        </div>

        {/* Email & Webhook Tools */}
        <div className="space-y-8">
           <div className="bg-white rounded-3xl shadow-sm border border-grey-medium p-8">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                    <Mail size={20} />
                 </div>
                 <h3 className="font-bold text-navy text-lg">Email Recovery</h3>
              </div>
              <p className="text-sm text-grey-600 mb-6">Manually resend the latest system email (OTP, Receipt, or Alert) to a specific user.</p>
              <button className="w-full py-3 bg-white border border-purple-200 text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition-all flex items-center justify-center gap-2">
                 <Send size={18} />
                 Trigger Manual Resend
              </button>
           </div>

           <div className="bg-white rounded-3xl shadow-sm border border-grey-medium p-8">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                    <RefreshCw size={20} />
                 </div>
                 <h3 className="font-bold text-navy text-lg">Webhook Replay</h3>
              </div>
              <p className="text-sm text-grey-600 mb-6">Re-trigger the last failed webhook event from Paystack or WhatsApp.</p>
              <button className="w-full py-3 bg-white border border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-all flex items-center justify-center gap-2">
                 <RefreshCw size={18} />
                 Replay Failed Event
              </button>
           </div>
        </div>
      </div>

      {/* Global Notifications */}
      {message && (
        <div className={`mt-8 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}
    </div>
  );
}
