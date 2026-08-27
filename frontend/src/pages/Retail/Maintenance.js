import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Loader2, RefreshCw, Clock, AlertTriangle, ShieldCheck, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailMaintenance({ orgId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ asset: 'Lane 2 POS Receipt Printer', issue: 'Receipt paper feed sensor mismatch', severity: 'Low' });

  useEffect(() => {
    fetchJobs();
  }, [orgId]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/maintenance?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate job registration in list
    setTimeout(() => {
      const newJob = {
        id: `job_${Math.floor(1000 + Math.random() * 9000)}`,
        org_id: orgId,
        display_label: `${formData.asset} Maintenance Request`,
        attributes: {
          asset: formData.asset,
          reported_by: 'Staff Operator',
          issue: formData.issue,
          status: 'Scheduled',
          severity: formData.severity,
          created_at: new Date().toISOString()
        }
      };
      setJobs(prev => [newJob, ...prev]);
      setSubmitting(false);
      setShowModal(false);
      alert("Maintenance service request logged successfully.");
    }, 800);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Wrench className="w-4 h-4" /> Equipment Maintenance Desk
          </div>
          <h2 className="text-3xl font-extrabold text-white">POS Terminal & Cold Storage Repairs</h2>
          <p className="text-slate-400 mt-1">Submit terminal diagnostics requests, monitor cold room refrigerator temps, and audit equipment downtime logs.</p>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Log Repair Request
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs flex justify-center items-center gap-2">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> Fetching maintenance logs...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div key={job.id} className="glass p-6 rounded-3xl border border-white/10 space-y-4 hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <Wrench className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{job.attributes?.asset}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Reported: {job.attributes?.reported_by}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  job.attributes?.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300 animate-pulse'
                }`}>
                  {job.attributes?.status}
                </span>
              </div>

              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-300">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Fault Diagnostics</p>
                <p className="font-bold text-slate-200 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  {job.attributes?.issue}
                </p>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Date: {new Date(job.attributes?.created_at).toLocaleDateString()}</span>
                <span className={`font-bold ${job.attributes?.severity === 'High' ? 'text-rose-400' : 'text-slate-400'}`}>Severity: {job.attributes?.severity}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REPAIR REQUEST MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-sm w-full space-y-6 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Log Repair Request</h3>
            <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Asset Name / ID</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Supermarket Refrigerator #3"
                  value={formData.asset}
                  onChange={(e) => setFormData(prev => ({ ...prev, asset: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Fault Description</label>
                <textarea 
                  rows="3"
                  required
                  placeholder="Describe the failure and operational impact..."
                  value={formData.issue}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Criticality / Severity</label>
                <select 
                  value={formData.severity}
                  onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Low">Low - Cosmetic / Auxiliary printer jam</option>
                  <option value="Medium">Medium - Standard POS Lane down</option>
                  <option value="High">High - Cold chain failure / Power generator down</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  {submitting ? 'Submitting...' : 'Log Fault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
