import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Clock, CheckCircle2, ShieldAlert, Loader2 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function HR({ orgId }) {
  const [staff, setStaff] = useState([]);
  const [clocks, setClocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Clock simulation
  const [showClockModal, setShowClockModal] = useState(false);
  const [form, setForm] = useState({
    staff_name: 'Dr. Amina Yusuf',
    action: 'CLOCK_IN'
  });

  useEffect(() => {
    fetchStaff();
    fetchClocks();
  }, [orgId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/hr/staff?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStaff(data || []);
      }
    } catch (e) {
      console.error("Error loading staff:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClocks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/hr/clockings?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setClocks(data || []);
      }
    } catch (e) {
      console.error("Error loading clockings:", e);
    }
  };

  const handleClockSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const member = staff.find(s => s.display_label === form.staff_name);
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/hr/clock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          staff_id: member ? member.id : `STF-${Math.floor(1000 + Math.random()*9000)}`,
          staff_name: form.staff_name,
          action: form.action
        })
      });

      if (res.ok) {
        setShowClockModal(false);
        await fetchClocks();
        await fetchStaff();
      }
    } catch (e) {
      console.error("Clocking error:", e);
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
            <Users className="w-4 h-4" /> HUMAN RESOURCES (HR)
          </div>
          <h2 className="text-3xl font-extrabold text-white">Practitioner Rosters & Shift Clocks</h2>
          <p className="text-slate-400 mt-1">Review active medical officer shifts, dispatch roster rotations, and track clockings.</p>
        </div>
        <button 
          onClick={() => setShowClockModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
        >
          <Clock className="w-4 h-4" /> Simulate Clock In/Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Staff Listings */}
        <div className="lg:col-span-2 glass rounded-3xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Rostered Personnel</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">Practitioner Name</th>
                  <th className="p-4">Department Role</th>
                  <th className="p-4">Rostered Shift</th>
                  <th className="p-4 text-right">Workplace Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan="4" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
                ) : staff.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No personnel registered.</td></tr>
                ) : (
                  staff.map(s => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{s.display_label}</td>
                      <td className="p-4 text-slate-400">{s.attributes?.role} ({s.attributes?.department})</td>
                      <td className="p-4 text-rose-300 font-medium">{s.attributes?.shift}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          s.attributes?.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {s.attributes?.status === 'ACTIVE' ? 'CLOCKED IN' : 'OFF SHIFT'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Clock Event Logs */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5"><Clock className="w-5 h-5 text-rose-400" /> Recent Clock Logs</h3>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
            {clocks.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">No clockings recorded today.</div>
            ) : (
              clocks.map(c => (
                <div key={c.id} className="bg-black/30 border border-white/5 p-4 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <h4 className="text-xs font-bold text-white">{c.attributes?.staff_name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-1 inline-block ${
                      c.attributes?.action === 'CLOCK_IN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>{c.attributes?.action?.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(c.attributes?.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Clock Modal */}
      {showClockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-rose-400" /> Staff Shift Simulation</h3>
              <button onClick={() => setShowClockModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleClockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Practitioner</label>
                <select
                  value={form.staff_name}
                  onChange={(e) => setForm({...form, staff_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.display_label}>{s.display_label} ({s.attributes?.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Action</label>
                <select
                  value={form.action}
                  onChange={(e) => setForm({...form, action: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                >
                  <option value="CLOCK_IN">Shift Clock In</option>
                  <option value="CLOCK_OUT">Shift Clock Out</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowClockModal(false)}
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
                  Confirm Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
