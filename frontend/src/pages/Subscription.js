import React, { useState, useEffect } from 'react';
import { Check, Zap, Shield, Rocket, ArrowRight, Loader2, Coins, Globe, MessageSquare, Cpu, BarChart3, Bot } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

const Subscription = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [initializingPlan, setInitializingPlan] = useState(null);
  const [buyingTokens, setBuyingTokens] = useState(false);
  const [tokenAmount, setTokenAmount] = useState(5000);
  const { currentUser } = useAuth();
  
  const businessId = currentUser?.business_id || currentUser?.email;
  const email = currentUser?.email || '';

  useEffect(() => {
    if (!businessId) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('ref');
    
    // PAYG logic check in URL
    if (params.get('status') === 'success') {
        // Just refresh data
        fetchData();
    }

    if (reference && !reference.startsWith('PAYG_')) {
        verifySubscription(reference);
    } else {
        fetchData();
    }
  }, [businessId]);

  const verifySubscription = async (reference) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/subscriptions/verify/${reference}`);
        const data = await response.json();
        if (data.status === 'success') {
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchData();
        }
    } catch (error) {
        console.error("Verification error:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, statusRes, balanceRes, usageRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/subscriptions/plans`),
        fetch(`${API_BASE_URL}/api/business-status?business_id=${businessId}`),
        fetch(`${API_BASE_URL}/api/tokens/balance?business_id=${businessId}`),
        fetch(`${API_BASE_URL}/api/usage/summary?business_id=${businessId}`)
      ]);
      
      const plansData = await plansRes.json();
      const statusData = await statusRes.json();
      const balanceData = await balanceRes.json();
      const usageData = await usageRes.json();
      
      setPlans(plansData);
      setSubStatus(statusData);
      setBalance(balanceData);
      // We can use balanceData.usage if updated, or a separate state
    } catch (error) {
        console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    setInitializingPlan(planId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscriptions/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          business_id: businessId,
          email: email
        })
      });

      const data = await response.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      alert('Payment initialization failed.');
    } finally {
      setInitializingPlan(null);
    }
  };

  const handleBuyTokens = async () => {
    setBuyingTokens(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tokens/buy-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          email: email,
          amount_tokens: tokenAmount
        })
      });
      const data = await response.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
        alert("Token purchase initialization failed.");
    } finally {
        setBuyingTokens(false);
    }
  };

  if (loading && !plans.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="mb-12 text-center">
          <h1 className="text-5xl font-black text-navy mb-4 tracking-tight">Conversational AI Plans</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Scale your business with high-volume automated conversations. No feature restrictions, just pure performance.
          </p>
      </div>

      {/* Current Usage Card */}
      {balance && (
          <div className="mb-12 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                  <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-200">
                      <MessageSquare className="w-8 h-8" />
                  </div>
                  <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Available Quota</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-navy">{balance.conversations_remaining?.toLocaleString()}</span>
                        <span className="text-gray-400 font-medium italic">conversations remaining</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        (Equivalent to {balance.total_balance?.toLocaleString()} tokens)
                      </div>
                  </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                   <div className="flex-1 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">Sub Balance</div>
                        <div className="text-lg font-bold text-blue-600">{balance.subscription_balance?.toLocaleString()} tokens</div>
                   </div>
                   <div className="flex-1 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">PAYG Balance</div>
                        <div className="text-lg font-bold text-indigo-600">{balance.payg_balance?.toLocaleString()} tokens</div>
                   </div>
              </div>
          </div>
      )}

      {/* Business Usage Overview (New Panel) */}
      {balance?.usage && (
          <div className="mb-12 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-xs font-black text-gray-400 uppercase mb-2">Total Conversations</div>
              <div className="text-2xl font-black text-navy">{balance.usage.total_conversations || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-xs font-black text-gray-400 uppercase mb-2">Tokens Consumed</div>
              <div className="text-2xl font-black text-navy">{balance.usage.total_tokens_used?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-xs font-black text-gray-400 uppercase mb-2">Operational Cost</div>
              <div className="text-2xl font-black text-red-600">₦{(balance.usage.estimated_cost || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-xs font-black text-gray-400 uppercase mb-2">Estimated Profit</div>
              <div className="text-2xl font-black text-green-600">₦{(balance.usage.estimated_profit || 0).toLocaleString()}</div>
            </div>
          </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        {plans.filter(p => p.is_public).sort((a, b) => (a.price || 0) - (b.price || 0)).map((plan) => (
          <div 
            key={plan.id}
            className={`flex flex-col relative p-10 bg-white rounded-[2.5rem] border-2 transition-all duration-500 hover:-translate-y-2 ${
              plan.id === 'growth' ? 'border-blue-600 ring-8 ring-blue-50 shadow-2xl z-10' : 'border-white shadow-xl'
            }`}
          >
            {plan.id === 'growth' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full text-sm font-black uppercase tracking-tighter">
                Most Popular
              </div>
            )}

            <div className="text-center mb-8">
              <h3 className="text-2xl font-black text-navy uppercase tracking-tight mb-4">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black text-navy">₦{(plan.price || 0).toLocaleString()}</span>
                <span className="text-gray-400 font-bold">/mo</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-6 mb-10 py-6 border-y border-gray-50">
              <div className="text-center">
                <div className="text-3xl font-black text-blue-600">≈ {plan.conversation_limit?.toLocaleString()}</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Conversations / month</div>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-gray-500 text-sm font-bold">
                <Zap className="w-4 h-4 fill-blue-500 text-blue-500" />
                {plan.token_allocation?.toLocaleString()} Tokens included
              </div>

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-bold">
                  <Check className="w-4 h-4" />
                  No Feature Restrictions
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-bold">
                  <Check className="w-4 h-4" />
                  Unlimited Workflows
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={initializingPlan !== null}
              className={`w-full py-5 rounded-2xl text-xl font-black flex items-center justify-center gap-3 transition-all duration-300 ${
                plan.id === 'growth' 
                  ? 'bg-blue-600 text-white hover:bg-navy shadow-xl shadow-blue-100' 
                  : 'bg-navy text-white hover:bg-blue-600 hover:shadow-lg'
              } disabled:opacity-50`}
            >
              {initializingPlan === plan.id ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {(subStatus?.plan_name === plan.id && subStatus?.status === 'active') ? 'Current Plan' : 'Select Plan'} <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Enterprise / Custom Section */}
      <div className="mb-20 bg-white rounded-[3rem] p-10 border border-gray-100 shadow-xl flex flex-col md:flex-row items-center gap-10">
          <div className="bg-navy p-6 rounded-[2rem] text-white">
              <Shield className="w-12 h-12" />
          </div>
          <div className="flex-1">
              <h2 className="text-3xl font-black text-navy mb-2">Enterprise Solutions</h2>
              <p className="text-gray-600 text-lg">
                  Dedicated infrastructure, high-volume conversation throughput, and custom SLA for scaling organizations.
              </p>
          </div>
          <div className="text-center md:text-right">
              <div className="text-gray-400 font-bold uppercase text-xs mb-1 tracking-widest">Pricing</div>
              <div className="text-3xl font-black text-navy mb-6">Custom Pricing</div>
              <a 
                href="mailto:contact@interacai.com?subject=Enterprise Plan Inquiry"
                className="inline-flex items-center gap-3 bg-navy text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-600 transition-all shadow-lg"
              >
                  Contact Sales <ArrowRight className="w-5 h-5" />
              </a>
          </div>
      </div>

      {/* PAYG Section */}
      <div className="mt-20 bg-gradient-to-r from-navy to-gray-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-blue-500/20 transition-all duration-1000" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="lg:w-1/2">
                  <div className="inline-flex items-center gap-2 px-4 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest mb-6">
                      Scale on Demand
                  </div>
                  <h2 className="text-4xl font-black mb-4">Exhausted your quota?</h2>
                  <p className="text-gray-400 text-lg leading-relaxed">
                      Add instant conversation power with **Pay-As-You-Go** tokens. These tokens are only used after your monthly plan is exhausted and they never expire.
                  </p>
              </div>

              <div className="lg:w-1/3 w-full bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10">
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-400 uppercase mb-3">Add Power-ups</label>
                    <select 
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(Number(e.target.value))}
                        className="w-full bg-navy border border-white/20 p-4 rounded-xl text-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value={5000}>5,000 Tokens (≈ 10 Convos) - ₦25,000</option>
                        <option value={10000}>10,000 Tokens (≈ 20 Convos) - ₦50,000</option>
                        <option value={50000}>50,000 Tokens (≈ 100 Convos) - ₦250,000</option>
                        <option value={100000}>100,000 Tokens (≈ 200 Convos) - ₦500,000</option>
                    </select>
                  </div>
                  
                  <button 
                    onClick={handleBuyTokens}
                    disabled={buyingTokens}
                    className="w-full py-5 bg-blue-600 rounded-2xl font-black text-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
                  >
                      {buyingTokens ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Instant Refill <Coins className="w-5 h-5" /></>}
                  </button>
              </div>
          </div>
      </div>
      <div className="mt-12 text-center text-gray-400 text-sm">
          <p>© 2026 InteracAI. Secure Payments via Paystack.</p>
      </div>
    </div>
  );
};

export default Subscription;
