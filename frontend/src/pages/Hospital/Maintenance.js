import React, { useState, useEffect } from 'react';
import { 
  Settings, Search, Plus, ShieldAlert, CheckCircle2, Loader2, Clock, Tool 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Maintenance({ orgId }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // New Ticket Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    device_name: 'GE Signa Pioneer 3T MRI',
    issue_description: '',
    severity: 'Medium'
  });

  useEffect(() => {
    fetchTickets();
  }, [orgId]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/maintenance/tickets?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data || []);
      }
    } catch (e) {
      console.error("Error loading tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!form.issue_description) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/maintenance/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          device_name: form.device_name,
          issue_description: form.issue_description,
          severity: form.severity
        })
      });

      if (res.ok) {
        setForm({ device_name: 'GE Signa Pioneer 3T MRI', issue_description: '', severity: 'Medium' });
        setShowAddModal(false);
        await fetchTickets();
      }
    } catch (e) {
      console.error("Submit ticket error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/hospital/maintenance/tickets/${ticketId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId })
      });
      await fetchTickets();
    } catch (e) {
      console.error("Resolve ticket failed:", e);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Settings className="w-4 h-4" /> BIOMEDICAL ENGINEERING
          </div>
          <h2 className="text-3xl font-extrabold text-white">Equipment Maintenance & Calibration Logs</h2>
          <p className="text-slate-400 mt-1">Log hardware malfunctions for MRI scanners, ICU ventilators, and backup power plants.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> File Outage Ticket
        </button>
      </div>

      {/* Tickets List */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">Active Engineering Job Tickets</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Ticket ID</th>
                <th className="p-4">Medical Device / Room</th>
                <th className="p-4">Reported Issue Description</th>
                <th className="p-4">Priority Severity</th>
                <th className="p-4">Rostered Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">All hospital devices are fully functional. No active tickets.</td></tr>
              ) : (
                tickets.map(t => {
                  const isPending = t.attributes?.status === 'PENDING';
                  const sev = t.attributes?.severity;
                  const isHigh = sev === 'High';
                  
                  return (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono font-bold text-rose-300">{t.attributes?.ticket_id}</td>
                      <td className="p-4 font-bold text-white">{t.attributes?.device_name}</td>
                      <td className="p-4 text-slate-300">{t.attributes?.issue_description}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isHigh ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>{sev}</span>
                      </td>
                      <td className="p-4 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isPending ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                        }`}>
                          {t.attributes?.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleResolveTicket(t.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all shadow-md shadow-rose-500/10"
                          >
                            Resolve / Calibrate
                          </button>
                        ) : (
                          <span className="text-slate-500 font-bold text-[10px]">Closed Ticket</span>
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

      {/* File Ticket Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-rose-400" /> Log Device Malfunction</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Medical Asset Device Name</label>
                <select
                  value={form.device_name}
                  onChange={(e) => setForm({...form, device_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                >
                  <option value="GE Signa Pioneer 3T MRI">GE Signa Pioneer 3T MRI (Radiology)</option>
                  <option value="Maquet FLOW-i Ventilator">Maquet FLOW-i Ventilator (ICU)</option>
                  <option value="Perkins 500kVA Standby Gen">Perkins 500kVA Standby Gen (Facilities)</option>
                  <option value="Olympus Visera Laparoscope">Olympus Visera Laparoscope (Theatre)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Priority Severity level</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({...form, severity: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                >
                  <option value="Low">Low - Schedule Routine Maintenance</option>
                  <option value="Medium">Medium - Out of spec calibration</option>
                  <option value="High">High - Outage (Critical Clinical Impact)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Issue Diagnostic Description</label>
                <textarea
                  required
                  placeholder="Scanner coil returns RF noise errors, preventing scan resolution..."
                  value={form.issue_description}
                  onChange={(e) => setForm({...form, issue_description: e.target.value})}
                  rows="4"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                  Dispatch Maintenance Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
