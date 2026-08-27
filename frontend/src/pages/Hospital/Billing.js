import React, { useState, useEffect } from 'react';
import { 
  Receipt, Search, Plus, User, DollarSign, CreditCard, Loader2, CheckCircle2, TrendingUp, ShieldAlert, Sparkles 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Billing({ orgId }) {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settle Payment Modal Form
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0.0,
    payment_method: 'POS Card',
    insurance_provider: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [orgId]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/billing/invoices?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
      }
    } catch (e) {
      console.error("Error loading invoices:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/billing/dashboard?org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Error loading billing stats:", e);
    }
  };

  const handleOpenPay = (inv) => {
    setSelectedInvoice(inv);
    setPaymentForm({
      amount: inv.attributes?.balance || 0.0,
      payment_method: 'POS Card',
      insurance_provider: inv.attributes?.insurance_provider || ''
    });
    setShowPayModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/billing/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          invoice_id: selectedInvoice.id,
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
          insurance_provider: paymentForm.insurance_provider
        })
      });

      if (res.ok) {
        setShowPayModal(false);
        await fetchInvoices();
        await fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "Payment failed");
      }
    } catch (e) {
      console.error("Payment error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter(i => 
    i.attributes?.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.attributes?.invoice_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Receipt className="w-4 h-4" /> REVENUE & POS CODES
          </div>
          <h2 className="text-3xl font-extrabold text-white">Billing, POS & HMO Reconciliation</h2>
          <p className="text-slate-400 mt-1">Review hospital treatment invoices, collect card/cash payments, and reconcile HMO claims.</p>
        </div>
      </div>

      {/* Revenue Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Invoiced Revenue</span>
            <h3 className="text-2xl font-black text-white mt-1">₦{stats.revenue_total?.toLocaleString()}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Total billing generated</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Reconciled Cash/POS</span>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">₦{stats.cash_reconciled?.toLocaleString()}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Settled balances</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Outstanding Balances</span>
            <h3 className="text-2xl font-black text-rose-400 mt-1">₦{stats.outstanding_debts?.toLocaleString()}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Awaiting settlement</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Reconciliation Rate</span>
            <h3 className="text-2xl font-black text-purple-400 mt-1">{stats.reconciliation_rate}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Audit success weight</span>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-rose-400" /> Patient Invoices Ledger</h3>
          <input
            type="text"
            placeholder="Search invoice number or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Invoice ID</th>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Billing Charge Items</th>
                <th className="p-4">Invoice Total</th>
                <th className="p-4">Paid Balance</th>
                <th className="p-4">Outstanding Balance</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="8" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="8" className="p-8 text-center text-slate-500 italic">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map(inv => {
                  const isPaid = inv.attributes?.status === 'PAID';
                  return (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono font-bold text-rose-300">{inv.attributes?.invoice_id}</td>
                      <td className="p-4 font-bold text-white">{inv.attributes?.patient_name}</td>
                      <td className="p-4 text-slate-400">
                        <ul className="list-disc pl-3 text-[10px]">
                          {inv.attributes?.items?.map((it, idx) => (
                            <li key={idx}>{it.desc} (₦{it.price?.toLocaleString()})</li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-4 font-bold text-white font-mono">₦{inv.attributes?.total_amount?.toLocaleString()}</td>
                      <td className="p-4 text-emerald-400 font-mono">₦{inv.attributes?.paid_amount?.toLocaleString()}</td>
                      <td className="p-4 text-rose-400 font-mono">₦{inv.attributes?.balance?.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          isPaid ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                        }`}>
                          {inv.attributes?.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {!isPaid ? (
                          <button
                            onClick={() => handleOpenPay(inv)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all shadow-md shadow-rose-500/15"
                          >
                            Collect POS Payment
                          </button>
                        ) : (
                          <span className="text-slate-500 font-bold text-[10px]">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-rose-400" /> Settle POS Billing Invoice</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs space-y-1">
                <div>Patient: <strong>{selectedInvoice.attributes?.patient_name}</strong></div>
                <div>Outstanding Balance: <strong className="text-rose-300 font-mono">₦{selectedInvoice.attributes?.balance?.toLocaleString()}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Settle Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.attributes?.balance}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value)})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                  >
                    <option value="POS Card">POS Debit Card</option>
                    <option value="Cash">Cash Handover</option>
                    <option value="Bank Transfer">Direct Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">HMO Insurance Provider (Optional)</label>
                  <input
                    type="text"
                    placeholder="AXA Mansard"
                    value={paymentForm.insurance_provider}
                    onChange={(e) => setPaymentForm({...paymentForm, insurance_provider: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
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
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
