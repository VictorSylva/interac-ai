import React, { useState, useEffect } from 'react';
import { Check, Zap, Shield, ArrowRight, Loader2, Coins, Globe, MessageSquare, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [activeFaq, setActiveFaq] = useState(null);
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
  }, [businessId]); // eslint-disable-next-line react-hooks/exhaustive-deps

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
      const usageData = await usageRes.json(); // eslint-disable-next-line no-unused-vars
      
      setPlans(plansData);
      setSubStatus(statusData);
      setBalance(balanceData);
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

  const handleSelectPlan = (plan) => {
    setSelectedPlanForCheckout(plan);
    setShowCheckoutModal(true);
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

  const planFeatures = {
    starter: [
      { text: "No Website Included", highlight: false },
      { text: "Standard AI Receptionist", highlight: false },
      { text: "Lead Capture & CRM Integration", highlight: false },
      { text: "Unlimited Custom Workflows", highlight: false },
      { text: "No Feature Restrictions", highlight: false }
    ],
    growth: [
      { text: "Includes Everything in Starter", highlight: false },
      { text: "Professional Presence Included", highlight: true },
      { text: "Up to 6 Pages, Responsive Design", highlight: false },
      { text: "WhatsApp & Maps Integrated", highlight: false },
      { text: "Admin-Managed Deployment", highlight: false },
      { text: "Unlimited Custom Workflows", highlight: false }
    ],
    pro: [
      { text: "Includes Everything in Growth", highlight: false },
      { text: "Premium Presence Included", highlight: true },
      { text: "Bespoke UI/UX & up to 12 Pages", highlight: false },
      { text: "Blog & Portfolio Layouts", highlight: false },
      { text: "Online Booking Calendar Setup", highlight: true },
      { text: "CRM Sync & API Integrations", highlight: false },
      { text: "Hosting & SSL Security Included", highlight: false }
    ],
    enterprise: [
      { text: "Unlimited AI Conversations & Agents", highlight: true },
      { text: "Enterprise CRM & Intelligence Graph", highlight: false },
      { text: "Multi-Location Workspaces", highlight: false },
      { text: "Dedicated Private Cloud Infrastructure", highlight: false },
      { text: "ARGUS Security Surveillance Suite", highlight: true },
      { text: "Investigation Workspace & SLA Support", highlight: false }
    ],
    custom: [
      { text: "Unlimited AI Conversations & Agents", highlight: true },
      { text: "Dedicated Private Infrastructure", highlight: false },
      { text: "Bespoke System Integrations", highlight: false },
      { text: "Investigations Workspace Access", highlight: false },
      { text: "Dedicated Success Manager & SLA", highlight: true },
      { text: "Custom APIs & Integrations", highlight: false }
    ]
  };

  const comparisonFeatures = [
    { category: "Pricing & Quotas", name: "Monthly Price", custom: "Custom Quote", enterprise: "₦750,000", pro: "₦250,000", growth: "₦120,000", starter: "₦60,000" },
    { category: "Pricing & Quotas", name: "AI Conversations", custom: "Unlimited", enterprise: "Unlimited", pro: "≈ 10,000 / mo", growth: "≈ 2,000 / mo", starter: "≈ 500 / mo" },
    { category: "Pricing & Quotas", name: "Tokens Included", custom: "Custom / Dedicated", enterprise: "50,000,000", pro: "5,000,000", growth: "1,000,000", starter: "250,000" },
    { category: "AI Receptionist Capabilities", name: "AI Web Chat & Receptionist", custom: "✓ Included", enterprise: "✓ Included", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { category: "AI Receptionist Capabilities", name: "WhatsApp Bot Integration", custom: "✓ Unlimited", enterprise: "✓ Unlimited", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { category: "AI Receptionist Capabilities", name: "Advanced CRM & Lead qualification", custom: "✓ Dedicated CRM", enterprise: "✓ Enterprise CRM", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { category: "AI Receptionist Capabilities", name: "Unlimited Custom Workflows", custom: "✓ Included", enterprise: "✓ Included", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { category: "Website Development", name: "Digital Presence", custom: "Bespoke Portals", enterprise: "Tailored Custom Portals", pro: "✓ Premium Presence (up to 12 pages)", growth: "✓ Professional Presence (up to 6 pages)", starter: "❌ No" },
    { category: "Website Development", name: "Online Booking Calendar", custom: "✓ Custom Rules", enterprise: "✓ Advanced Setup", pro: "✓ Included", growth: "❌ No", starter: "❌ No" },
    { category: "Website Development", name: "Hosting & SSL Certificate", custom: "✓ Private Hosting", enterprise: "✓ Private Hosting", pro: "✓ Included", growth: "❌ No", starter: "❌ No" },
    { category: "Security & Surveillance", name: "Video Feed Monitoring", custom: "✓ Private Servers", enterprise: "✓ Unlimited Feeds", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { category: "Security & Surveillance", name: "Intelligent Graph & Risk Center", custom: "✓ Private Infrastructure", enterprise: "✓ Included", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { category: "Support & Customizations", name: "Technical Support", custom: "Custom Dedicated Support", enterprise: "Dedicated SLA & Success Manager", pro: "Priority 24/7", growth: "Standard", starter: "Standard" }
  ];

  const faqItems = [
    {
      q: "What is the included Website offering in the Growth and Pro plans?",
      a: "Growth and Pro plans include professional website development to launch your business online. Growth includes a standard 6-page responsive site, contact forms, and WhatsApp integration. Pro includes a premium, custom UI/UX site with up to 12 pages, booking system, blog, portfolio, advanced CRM/API integrations, and fully managed hosting and SSL security."
    },
    {
      q: "Are there revision limits on the website design?",
      a: "We build a premium digital presence customized for your business. We do not promise infinite revisions, but future content updates, pricing additions, and text tweaks are handled directly and seamlessly through your InteracAI subscription platform."
    },
    {
      q: "Why is a website not included in the Starter plan?",
      a: "The Starter plan is designed for businesses that already have an online presence or only require AI receptionist and workflow automation. If you require a website, you can upgrade to the Growth or Pro plan at any time."
    },
    {
      q: "How are hosting and SSL security handled?",
      a: "Standard cloud hosting and SSL encryption certificates are fully included in your monthly Pro subscription. For the Growth plan, users host their website externally or upgrade to Pro for managed hosting. If you cancel your subscription, managed hosting will be deactivated."
    },
    {
      q: "Can I connect my custom domain?",
      a: "Yes! Custom domains are fully supported. If you own a domain (e.g. yourbusiness.com), our support team will assist in setting up DNS records to point it to your new professional site."
    },
    {
      q: "What happens if I exceed my AI conversation limits?",
      a: "If you exceed your plan's monthly conversation limits, your AI receptionists will temporarily stop responding. You can purchase Pay-As-You-Go (PAYG) token refills at any time to instantly add capacity. PAYG tokens never expire."
    }
  ];

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

      {/* Business Usage Overview */}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-20">
        {[
          {
            id: 'custom',
            name: 'Custom',
            priceFormatted: 'Custom',
            conversation_limit: 'Unlimited',
            token_allocation: 'Custom Quota',
            is_custom: true
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            priceFormatted: '₦750,000',
            conversation_limit: 'Unlimited',
            token_allocation: 50000000,
            is_custom: true
          },
          ...(Array.isArray(plans) ? plans : []).filter(p => p.is_public).sort((a, b) => (b.price || 0) - (a.price || 0))
        ].map((plan) => {
          const feats = planFeatures[plan.id] || [];
          const isEnterpriseOrCustom = plan.id === 'enterprise' || plan.id === 'custom';
          const priceText = plan.id === 'custom' ? 'Custom' : plan.id === 'enterprise' ? '₦750,000' : `₦${(plan.price || 0).toLocaleString()}`;
          const isCurrentPlan = subStatus?.plan_name === plan.id && subStatus?.status === 'active';

          return (
            <div 
              key={plan.id}
              className={`flex flex-col relative p-6 bg-white rounded-[2.5rem] border-2 transition-all duration-500 hover:-translate-y-2 ${
                plan.id === 'pro' ? 'border-blue-600 ring-8 ring-blue-50 shadow-2xl z-10' : 'border-white shadow-xl'
              }`}
            >
              {plan.id === 'pro' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter">
                  Best Value
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-navy uppercase tracking-tight mb-4">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-black text-navy">{priceText}</span>
                  {plan.id !== 'custom' && <span className="text-gray-400 font-bold">/mo</span>}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center space-y-6 mb-10 py-6 border-y border-gray-50">
                <div className="text-center">
                  <div className="text-2xl font-black text-blue-600">
                    {isEnterpriseOrCustom ? 'Unlimited' : `≈ ${plan.conversation_limit?.toLocaleString()}`}
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conversations / month</div>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-gray-500 text-xs font-bold">
                  <Zap className="w-4 h-4 fill-blue-500 text-blue-500" />
                  {plan.id === 'custom' ? 'Custom Quota' : plan.id === 'enterprise' ? '50,000,000 Tokens included' : `${plan.token_allocation?.toLocaleString()} Tokens included`}
                </div>

                <div className="text-center space-y-2 w-full">
                  {feats.map((f, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-center gap-2 text-xs ${
                        f.highlight ? 'text-blue-600 font-black' : f.text.startsWith('No Website') || f.text.startsWith('❌') ? 'text-gray-400 font-medium' : 'text-green-600 font-bold'
                      }`}
                    >
                      {f.text.startsWith('No Website') || f.text.startsWith('❌') ? (
                        <span className="text-xs">✕</span>
                      ) : (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (isEnterpriseOrCustom) {
                    window.location.href = `mailto:contact@interacai.com?subject=${plan.id === 'custom' ? 'Custom' : 'Enterprise'} Plan Inquiry`;
                  } else {
                    handleSelectPlan(plan);
                  }
                }}
                disabled={initializingPlan !== null}
                className={`w-full py-4 rounded-2xl text-lg font-black flex items-center justify-center gap-3 transition-all duration-300 ${
                  plan.id === 'pro' 
                    ? 'bg-blue-600 text-white hover:bg-navy shadow-xl shadow-blue-100' 
                    : 'bg-navy text-white hover:bg-blue-600 hover:shadow-lg'
                } disabled:opacity-50`}
              >
                {initializingPlan === plan.id ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {isCurrentPlan ? 'Current Plan' : isEnterpriseOrCustom ? 'Contact Sales' : 'Select Plan'} <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
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

      {/* Detailed Feature Comparison */}
      <div className="mb-20 bg-white rounded-[3rem] p-8 md:p-12 border border-gray-100 shadow-xl overflow-hidden">
        <h2 className="text-3xl font-black text-navy mb-8 text-center tracking-tight">Detailed Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-black uppercase text-gray-400 tracking-wider">
                <th className="py-5 pr-4">Feature</th>
                <th className="py-5 px-4 text-center text-blue-600 bg-blue-50/30 rounded-t-2xl">Custom</th>
                <th className="py-5 px-4 text-center text-amber-600 bg-amber-50/30">Enterprise</th>
                <th className="py-5 px-4 text-center">Pro</th>
                <th className="py-5 px-4 text-center">Growth</th>
                <th className="py-5 pl-4 text-center">Starter</th>
              </tr>
            </thead>
            <tbody className="text-sm font-semibold text-navy">
              {comparisonFeatures.map((feat, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 pr-4 font-bold">
                    <div>{feat.name}</div>
                    <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">{feat.category}</span>
                  </td>
                  <td className="py-4 px-4 text-center bg-blue-50/10 font-bold text-blue-800">{feat.custom}</td>
                  <td className="py-4 px-4 text-center bg-amber-50/10 font-bold text-amber-800">{feat.enterprise}</td>
                  <td className="py-4 px-4 text-center font-bold text-navy">{feat.pro}</td>
                  <td className="py-4 px-4 text-center text-gray-500 font-medium">{feat.growth}</td>
                  <td className="py-4 pl-4 text-center font-medium text-gray-400">{feat.starter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-navy mb-10 text-center tracking-tight font-extrabold">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqItems.map((item, i) => {
            const isOpen = activeFaq === i;
            return (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
                <button
                  onClick={() => setActiveFaq(isOpen ? null : i)}
                  className="w-full px-8 py-5 text-left font-bold text-navy flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors focus:outline-none"
                >
                  <span className="text-base md:text-lg">{item.q}</span>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                </button>
                <div 
                  className={`transition-all duration-300 overflow-hidden ${
                    isOpen ? 'max-h-96 border-t border-gray-50' : 'max-h-0'
                  }`}
                >
                  <div className="p-8 text-gray-600 leading-relaxed text-sm font-medium bg-gray-50/30">
                    {item.a}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Checkout Summary Modal */}
      {showCheckoutModal && selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-8 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-2xl font-black text-navy mb-2 flex items-center gap-2">
                <Shield className="text-blue-600 w-6 h-6" /> Confirm Subscription
              </h3>
              <p className="text-sm text-gray-500 mb-6 font-medium">Review your plan details before proceeding to our secure checkout.</p>
              
              {/* Plan Header */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-gray-400 tracking-wider">Selected Plan</div>
                  <div className="text-xl font-bold text-navy">{selectedPlanForCheckout.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black uppercase text-gray-400 tracking-wider">Price</div>
                  <div className="text-2xl font-black text-blue-600">₦{(selectedPlanForCheckout.price || 0).toLocaleString()}<span className="text-xs font-bold text-gray-400">/mo</span></div>
                </div>
              </div>

              {/* AI Features Summary */}
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">AI & Automation Limits</h4>
                <div className="space-y-3 bg-gray-50 rounded-2xl p-5 border border-gray-100 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Conversations Limit</span>
                    <span className="font-bold text-navy">{selectedPlanForCheckout.conversation_limit?.toLocaleString()} / mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Token Allocation</span>
                    <span className="font-bold text-navy">{selectedPlanForCheckout.token_allocation?.toLocaleString()} Tokens</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Workflow Automations</span>
                    <span className="font-bold text-green-600">Unlimited Workflows</span>
                  </div>
                </div>
              </div>

              {/* Website Benefit Summary */}
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">Website Offering</h4>
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-sm">
                  {selectedPlanForCheckout.id === 'starter' ? (
                    <div className="text-gray-500 font-medium leading-relaxed">
                      ✕ <span className="font-bold">No Website Included.</span> Designed for businesses that already have an online presence or only require AI receptionist and workflow automation.
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-blue-600 mb-2 flex items-center gap-1.5">
                        <Globe className="w-4 h-4" /> 
                        {selectedPlanForCheckout.id === 'growth' ? 'Professional Website Included' : 'Premium Custom Website Included'}
                      </div>
                      <p className="text-xs text-gray-500 mb-3 italic">
                        {selectedPlanForCheckout.id === 'growth' 
                          ? '"Launch your business online with a professional website included."'
                          : '"A premium digital presence built specifically for your business."'}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 mt-2">
                        {selectedPlanForCheckout.id === 'growth' ? (
                          <>
                            <div className="flex items-center gap-1">✓ Responsive Design</div>
                            <div className="flex items-center gap-1">✓ Up to 6 Pages</div>
                            <div className="flex items-center gap-1">✓ Contact Forms</div>
                            <div className="flex items-center gap-1">✓ WhatsApp Link</div>
                            <div className="flex items-center gap-1">✓ SEO-Ready Setup</div>
                            <div className="flex items-center gap-1">✓ Google Maps</div>
                            <div className="flex items-center gap-1">✓ Admin Deployment</div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 font-bold text-blue-600">✓ Custom UI/UX</div>
                            <div className="flex items-center gap-1 font-bold text-blue-600">✓ Up to 12 Pages</div>
                            <div className="flex items-center gap-1">✓ Business Blog</div>
                            <div className="flex items-center gap-1">✓ Project Portfolio</div>
                            <div className="flex items-center gap-1 font-bold text-blue-600">✓ Booking System</div>
                            <div className="flex items-center gap-1">✓ Advanced Forms</div>
                            <div className="flex items-center gap-1">✓ CRM & API Sync</div>
                            <div className="flex items-center gap-1">✓ Analytics Panel</div>
                            <div className="flex items-center gap-1">✓ Speed Optimized</div>
                            <div className="flex items-center gap-1">✓ Priority Design</div>
                            <div className="flex items-center gap-1 font-bold text-blue-600">✓ Hosting & SSL Included</div>
                          </>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-gray-400 mt-4 leading-normal">
                        * Disclaimer: Content updates are managed via InteracAI. Unlimited design revisions are not promised.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4">
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors text-sm focus:outline-none"
              >
                Go Back
              </button>
              <button 
                onClick={() => {
                  setShowCheckoutModal(false);
                  handleSubscribe(selectedPlanForCheckout.id);
                }}
                className="flex-1 py-4 bg-blue-600 hover:bg-navy text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-100 hover:shadow-none flex items-center justify-center gap-2 text-sm focus:outline-none"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
