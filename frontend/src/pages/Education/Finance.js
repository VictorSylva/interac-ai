import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduFeesPage({ orgId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState({
    student_id: '',
    student_name: '',
    amount: 120000,
    scholarship: 20000
  });

  const [aiResult, setAiResult] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchStudents();
  }, [orgId]);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
        if (data && data.length > 0) {
          const first = data[0];
          setFormData(prev => ({
            ...prev,
            student_id: first.attributes?.student_id || first.id,
            student_name: first.display_label
          }));
        }
      }
    } catch (e) {
      console.error("Error loading students for invoice creation:", e);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/fees/invoices?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.student_id) {
      alert("Please select a student to issue invoice to.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/fees/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        const defaultStudent = students[0];
        setFormData({
          student_id: defaultStudent ? (defaultStudent.attributes?.student_id || defaultStudent.id) : '',
          student_name: defaultStudent ? defaultStudent.display_label : '',
          amount: 120000,
          scholarship: 20000
        });
        fetchInvoices();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const runDefaultPrediction = async () => {
    setRunningAI(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:predict_fee_defaults',
          params: { org_id: orgId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningAI(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Receipt className="w-4 h-4" /> BILS & FINANCE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Student Invoicing & School Fees</h2>
          <p className="text-slate-400 mt-1">Manage term invoices, issue scholarship discounts, track receipts, and forecast payment defaults.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Issue Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Invoices Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Scholarship</th>
                    <th className="p-4">Balance</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" /></td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No invoices issued. Click Issue Invoice to start.</td></tr>
                  ) : invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono font-bold text-white">{inv.attributes?.invoice_no}</td>
                      <td className="p-4">{inv.attributes?.student_name}</td>
                      <td className="p-4 font-mono">₦{inv.attributes?.total_amount?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-green-300">₦{inv.attributes?.scholarship?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-rose-300">₦{inv.attributes?.balance?.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          inv.attributes?.status === 'PAID' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {inv.attributes?.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-amber-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" /> AI Payment Default Forecasting
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates past payment delays and family balance outstanding logs to calculate parent payment default probabilities.
            </p>
            <button
              onClick={runDefaultPrediction}
              disabled={runningAI}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningAI && <Loader2 className="w-4 h-4 animate-spin" />}
              Analyze Default Probability
            </button>

            {aiResult && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-amber-500/20 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Default Forecast Rate:</span>
                  <span className="font-bold text-white font-mono">{aiResult.default_forecast_rate}</span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">High Risk Folios:</div>
                  {aiResult.high_risk_folios?.map((fol, idx) => (
                    <div key={idx} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl space-y-1">
                      <div className="font-bold text-rose-300">{fol.parent_name}</div>
                      <div className="text-[10px] text-slate-400">Outstanding: {fol.outstanding_balance} | Risk: {fol.default_risk}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-amber-950/20 px-6 py-4 border-b border-amber-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create School Fee Invoice</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Student to Bill</label>
                <select
                  required
                  value={formData.student_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const found = students.find(s => (s.attributes?.student_id || s.id) === selId);
                    setFormData({
                      ...formData,
                      student_id: selId,
                      student_name: found ? found.display_label : ''
                    });
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {students.length === 0 ? (
                    <option value="">No students onboarded yet</option>
                  ) : (
                    students.map(s => {
                      const sId = s.attributes?.student_id || s.id;
                      return (
                        <option key={sId} value={sId}>{s.display_label} ({sId})</option>
                      );
                    })
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Billed Amount (₦)</label>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Scholarship Discount (₦)</label>
                  <input
                    type="number"
                    required
                    value={formData.scholarship}
                    onChange={(e) => setFormData({...formData, scholarship: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
