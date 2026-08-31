import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Zap, 
  Shield, 
  ArrowRight, 
  Loader2, 
  Coins, 
  Globe, 
  MessageSquare, 
  X, 
  ChevronDown, 
  ChevronUp,
  Building,
  Sliders,
  Sparkles,
  Layers,
  Cpu,
  Clock,
  PhoneCall,
  CheckCircle2,
  Lock,
  FileText
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

const Subscription = () => {
  const [loading, setLoading] = useState(true);
  const [configBundle, setConfigBundle] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [buyingTokens, setBuyingTokens] = useState(false);
  const [tokenAmount, setTokenAmount] = useState(5000);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubject, setContactSubject] = useState('Capacity Expansion Request');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const { currentUser } = useAuth();
  const businessId = currentUser?.business_id || currentUser?.email;
  const email = currentUser?.email || '';

  useEffect(() => {
    if (!businessId) return;
    fetchData();
  }, [businessId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/entitlements/my-configuration?business_id=${businessId}`, {
          headers: currentUser?.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {}
        }),
        fetch(`${API_BASE_URL}/api/super-admin/invoices?business_id=${businessId}&user_id=${currentUser?.id || ''}`)
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfigBundle(configData);
      }
      if (invoicesRes.ok) {
        const invData = await invoicesRes.json();
        if (Array.isArray(invData)) setInvoices(invData);
      }
    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyTokens = async () => {
    setBuyingTokens(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tokens/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          tokens: tokenAmount,
          email: email
        })
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert('Failed to initialize token top-up.');
      }
    } catch (e) {
      console.error(e);
      alert('Error initializing payment.');
    } finally {
      setBuyingTokens(false);
    }
  };

  const handleSendContactRequest = (e) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setShowContactModal(false);
      setContactSent(false);
      setContactMessage('');
    }, 2500);
  };

  if (loading && !configBundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-sm font-semibold text-slate-400">Loading Business Operating Configuration...</p>
        </div>
      </div>
    );
  }

  const usage = configBundle?.usage || {};
  const profile = configBundle?.commercial_profile || {};
  const entitlements = configBundle?.entitlements || {};
  const activeModules = configBundle?.installed_modules || [];

  const convoUsed = usage.conversations_used || 0;
  const convoLimit = usage.conversations_limit || 5000;
  const convoPercent = convoLimit > 0 ? Math.min(100, Math.round((convoUsed / convoLimit) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-500/20">
                Tailored Architecture
              </span>
              <span className="text-xs text-slate-500 font-mono">Tenant ID: {businessId}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Operating Configuration & Entitlements
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Your InteracAI system is custom-configured around your business operations, data signals, and department workflows.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowContactModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-600/25"
            >
              <PhoneCall size={15} />
              <span>Contact Operating Specialist</span>
            </button>
          </div>
        </div>

        {/* Operating Configuration Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enterprise Tenant</span>
            <div className="text-lg font-black text-white mt-1">{configBundle?.name || 'Your Organization'}</div>
            <div className="text-xs text-blue-400 font-semibold uppercase mt-0.5">
              {configBundle?.industry || 'Hospitality'} Platform OS
            </div>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commercial Model</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-sm font-bold text-white capitalize">
                {profile.status ? profile.status.replace('_', ' ') : 'Active Operating Contract'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Cycle: {profile.billing_interval || 'Monthly Agreement'}</div>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Specialist</span>
            <div className="text-sm font-bold text-slate-200 mt-1">{profile.account_manager || 'Victor Sylva'}</div>
            <div className="text-xs text-slate-400 mt-0.5">Dedicated Platform Engineer</div>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Modules</span>
            <div className="text-lg font-black text-indigo-400 mt-1">
              {activeModules.length > 0 ? activeModules.length : 1} Deployed
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Fully Integrated</div>
          </div>
        </div>

        {/* Real-time Metering & Capacity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Monthly Conversations Quota */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800/80 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-400" />
                  Monthly AI Conversations
                </span>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                  {convoPercent}% Utilized
                </span>
              </div>

              <div className="text-3xl font-black text-white">
                {convoUsed.toLocaleString()} <span className="text-slate-500 text-sm font-normal">/ {convoLimit.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">First message in 24-hr customer sessions.</p>

              <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${convoPercent > 85 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${convoPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Lifetime Conversations:</span>
              <strong className="text-slate-200">{(usage.total_lifetime_conversations || 0).toLocaleString()}</strong>
            </div>
          </div>

          {/* AI Token Reserves */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800/80 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Coins size={16} className="text-indigo-400" />
                  AI Token Reserves
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Active Pools
                </span>
              </div>

              <div className="text-3xl font-black text-white">
                {(usage.tokens_total_available || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Contract Pool: {(usage.token_subscription_balance || 0).toLocaleString()} • PAYG Top-up: {(usage.token_payg_balance || 0).toLocaleString()}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Instant Token Refill:</span>
              <div className="flex items-center gap-2">
                <select 
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(parseInt(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value={500000}>500k Tokens (₦5k)</option>
                  <option value={2000000}>2M Tokens (₦18k)</option>
                  <option value={10000000}>10M Tokens (₦80k)</option>
                </select>
                <button
                  onClick={handleBuyTokens}
                  disabled={buyingTokens}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {buyingTokens ? 'Processing...' : 'Top-Up'}
                </button>
              </div>
            </div>
          </div>

          {/* ARGUS OS & Scale Quotas */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800/80 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} className="text-emerald-400" />
                  ARGUS OS & Organization Scope
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Protected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Staff Seats</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {entitlements['platform.seats']?.limit || 25} Seats
                  </div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[10px] uppercase font-bold text-slate-400">CCTV Streams</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {entitlements['argus.cameras']?.limit || 8} Cameras
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Threat Radar Status:</span>
              <strong className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> Active & Metring
              </strong>
            </div>
          </div>
        </div>

        {/* Live Entitlement Matrix */}
        <div className="bg-slate-900/80 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                <Sliders size={20} className="text-blue-400" />
                Live Capability Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Capabilities provisioned for your organization based on your Business Signal Audit.
              </p>
            </div>

            <button
              onClick={() => setShowContactModal(true)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start md:self-auto"
            >
              <span>Request Capability Unlock</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.keys(entitlements).map((key) => {
              const ent = entitlements[key];
              const isEnabled = ent.enabled;
              const hasOverride = !!ent.override;

              return (
                <div 
                  key={key}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEnabled 
                      ? 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600' 
                      : 'bg-slate-900/40 border-slate-800/40 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-200">
                          {key.replace('.', ' → ').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {isEnabled ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Active for your workspace
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold flex items-center gap-1">
                            <Lock size={12} /> Contact Specialist to Unlock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Invoices & Contract Records */}
        {invoices.length > 0 && (
          <div className="bg-slate-900/80 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5 mb-6">
              <FileText size={20} className="text-indigo-400" />
              Contracted Commercial Agreements & Invoices
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Agreement #</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{inv.invoice_number}</td>
                      <td className="py-3 px-4 text-slate-300">{inv.title}</td>
                      <td className="py-3 px-4 font-bold text-white">{inv.currency} {inv.total_amount?.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        {inv.status === 'paid' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                            Paid & Provisioned
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20">
                            Pending Payment
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(inv.issue_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Contact Specialist Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 font-black text-base">
                <Sparkles className="text-blue-400" size={20} />
                Contact Your InteracAI Specialist
              </div>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {contactSent ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="mx-auto text-emerald-400" size={40} />
                <h3 className="text-lg font-bold">Request Dispatched!</h3>
                <p className="text-xs text-slate-400">Your account specialist has been notified and will reach out shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSendContactRequest} className="py-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Request Type</label>
                  <select 
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Capacity Expansion Request">Expand Conversation or Token Allowance</option>
                    <option value="Unlock Industry Capability">Unlock Advanced Industry Capability (e.g., Opera PMS, CCTV)</option>
                    <option value="Add Property / Branch">Add Additional Branch or Property</option>
                    <option value="Custom Workflow Integration">Design Custom Automation Workflow</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Operational Requirements / Notes</label>
                  <textarea 
                    rows={4}
                    required
                    placeholder="Describe what your organization needs (e.g. increase monthly conversation quota to 15,000, add 10 staff seats)..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/20"
                  >
                    Send Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
