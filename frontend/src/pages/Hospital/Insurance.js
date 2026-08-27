import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Plus, User, CheckCircle2, ShieldAlert, Loader2, ArrowRight, Activity 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Insurance({ orgId }) {
  const [claims, setClaims] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // New Claim Form
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [form, setForm] = useState({
    patient_name: '',
    provider: 'AXA Mansard',
    policy_no: '',
    claim_amount: 0.0,
    pre_auth_code: ''
  });

  // Verification Form
  const [verifyPolicyNo, setVerifyPolicyNo] = useState('');

  useEffect(() => {
    fetchClaims();
    fetchPatients();
  }, [orgId]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/insurance/claims?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setClaims(data || []);
      }
    } catch (e) {
      console.error("Error loading claims:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data || []);
      }
    } catch (e) {
      console.error("Error loading patients:", e);
    }
  };

  const handleValidatePolicy = async (e) => {
    e.preventDefault();
    if (!verifyPolicyNo) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/insurance/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_no: verifyPolicyNo })
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      }
    } catch (e) {
      console.error("Policy validation failed:", e);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!form.patient_name || !form.policy_no) return;
    setSubmitting(true);
    try {
      const patient = patients.find(p => p.display_label === form.patient_name);
      const payload = {
        org_id: orgId,
        patient_id: patient ? patient.id : `PAT-HMO-${Math.floor(1000 + Math.random()*9000)}`,
        patient_name: form.patient_name,
        provider: form.provider,
        policy_no: form.policy_no,
        claim_amount: form.claim_amount,
        pre_auth_code: form.pre_auth_code
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/insurance/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setForm({ patient_name: '', provider: 'AXA Mansard', policy_no: '', claim_amount: 0.0, pre_auth_code: '' });
        setShowClaimModal(false);
        await fetchClaims();
      }
    } catch (e) {
      console.error("Claim submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Shield className="w-4 h-4" /> HMO PORTAL
          </div>
          <h2 className="text-3xl font-extrabold text-white">Insurance Claims & Pre-Authorizations</h2>
          <p className="text-slate-400 mt-1">Submit insurance claims directly, review HMO policies, and check pre-auth codes.</p>
        </div>
        <button 
          onClick={() => setShowClaimModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> Submit Claim
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Validation Simulator */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-6 h-fit">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5"><Shield className="w-5 h-5 text-rose-400" /> Policy Validator</h3>
          
          <form onSubmit={handleValidatePolicy} className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Enter Card Policy Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="AXA-990-21"
                value={verifyPolicyNo}
                onChange={(e) => setVerifyPolicyNo(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={validating}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
              >
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">Tip: Policy numbers ending in "99" simulate invalid/expired state.</p>
          </form>

          {validationResult && (
            <div className={`p-5 rounded-2xl border text-xs space-y-3 ${
              validationResult.valid ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
            }`}>
              <div className="flex justify-between items-center pb-2 border-b border-white/5 font-bold">
                <span className="text-slate-400">Card Status:</span>
                <span className={validationResult.valid ? 'text-emerald-400' : 'text-rose-400'}>
                  {validationResult.status}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Authorized HMO:</span><span className="text-white font-medium">{validationResult.provider}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Coverage Limit:</span><span className="text-white font-mono">₦{validationResult.authorized_limit?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Patient Co-Pay:</span><span className="text-white font-mono">{validationResult.copay_percent}%</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Submitted Claims list */}
        <div className="lg:col-span-2 glass rounded-3xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-rose-400" /> HMO Claims Log</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">Claim ID</th>
                  <th className="p-4">Patient Name</th>
                  <th className="p-4">Insurance HMO</th>
                  <th className="p-4">Claim Value</th>
                  <th className="p-4">Pre-Auth Reference</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
                ) : claims.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No submitted HMO claims found.</td></tr>
                ) : (
                  claims.map(c => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono font-bold text-rose-300">{c.attributes?.claim_id}</td>
                      <td className="p-4 font-bold text-white">{c.attributes?.patient_name}</td>
                      <td className="p-4 text-slate-300">{c.attributes?.provider}</td>
                      <td className="p-4 font-bold text-white font-mono">₦{c.attributes?.claim_amount?.toLocaleString()}</td>
                      <td className="p-4 text-slate-400 font-mono">{c.attributes?.pre_auth_code || 'N/A'}</td>
                      <td className="p-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-300">
                          {c.attributes?.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Submit Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-rose-400" /> Submit HMO Claim</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmitClaim} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={form.patient_name}
                  onChange={(e) => setForm({...form, patient_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose HMO Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.display_label}>{p.display_label} ({p.attributes?.patient_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Insurance HMO</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({...form, provider: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                  >
                    <option value="AXA Mansard">AXA Mansard</option>
                    <option value="Leadway Health">Leadway Health</option>
                    <option value="Reliance HMO">Reliance HMO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">HMO Policy Code</label>
                  <input
                    type="text"
                    required
                    placeholder="POL-8820"
                    value={form.policy_no}
                    onChange={(e) => setForm({...form, policy_no: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Claim Amount (₦)</label>
                  <input
                    type="number"
                    required
                    value={form.claim_amount}
                    onChange={(e) => setForm({...form, claim_amount: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">HMO Pre-Auth Code</label>
                  <input
                    type="text"
                    placeholder="AUTH-990-BC"
                    value={form.pre_auth_code}
                    onChange={(e) => setForm({...form, pre_auth_code: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit HMO Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
