import React, { useState, useEffect } from 'react';
import { Users, Clock, Plus, Loader2, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailHR({ orgId }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [punchAction, setPunchAction] = useState('IN');
  const [selectedStaff, setSelectedStaff] = useState('Blessing Okon');

  useEffect(() => {
    fetchAttendance();
  }, [orgId]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/hr/attendance?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAttendance(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/hr/attendance/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          employee_name: selectedStaff,
          action: punchAction
        })
      });
      if (res.ok) {
        alert(`Attendance card registered successfully: ${selectedStaff} clocked ${punchAction.toLowerCase()}.`);
        fetchAttendance();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" /> HR & Shift Scheduling
          </div>
          <h2 className="text-3xl font-extrabold text-white">Employee Rota & Attendance Logs</h2>
          <p className="text-slate-400 mt-1">Audit employee scheduling timesheets, punch attendance cards, and trigger staffing optimization radar.</p>
        </div>
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SHIFT ATTENDANCE DIRECTORY */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> Live Timesheet Log
          </h3>

          {loading ? (
            <div className="py-12 text-center text-slate-400 flex justify-center items-center gap-2">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> Fetching timesheets...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="p-3">Employee Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Shift Date</th>
                    <th className="p-3">Clock-In Time</th>
                    <th className="p-3">Clock-Out Time</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {attendance.map(a => (
                    <tr key={a.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{a.attributes?.employee_name || a.display_label}</td>
                      <td className="p-3">{a.attributes?.role}</td>
                      <td className="p-3 font-mono text-slate-400">{a.attributes?.date}</td>
                      <td className="p-3 font-mono text-slate-400">{a.attributes?.clock_in}</td>
                      <td className="p-3 font-mono text-slate-400">{a.attributes?.clock_out || 'Active Shift'}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          a.attributes?.status === 'Active' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' : 'bg-white/5 text-slate-400'
                        }`}>
                          {a.attributes?.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CLOCK-IN SIMULATION PANEL */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" /> Attendance Simulator
            </h3>
            <p className="text-xs text-slate-400">Punch digital attendance cards into the shift tracker. This logs signals to the Observation Bus.</p>

            <form onSubmit={handlePunchSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Select Staff Member</label>
                <select 
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Blessing Okon">Blessing Okon (Cashier)</option>
                  <option value="Abigail Udoh">Abigail Udoh (Cashier)</option>
                  <option value="Uche Kalu">Uche Kalu (Inventory Manager)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPunchAction('IN')}
                  className={`py-2 rounded-xl border text-xs font-bold ${punchAction === 'IN' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                  Clock-In (IN)
                </button>
                <button
                  type="button"
                  onClick={() => setPunchAction('OUT')}
                  className={`py-2 rounded-xl border text-xs font-bold ${punchAction === 'OUT' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                  Clock-Out (OUT)
                </button>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                {submitting ? 'Registering...' : 'Punch Card'}
              </button>
            </form>
          </div>

          {/* STAFFING OPTIMIZATION NOTIFICATION */}
          <div className="glass p-6 rounded-3xl border border-amber-500/30 bg-amber-500/[0.02] space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Staffing Advisory</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong>Saturday Peak (12:00 - 18:00)</strong> requires 10 cashiers due to high customer arrivals. Currently only 7 scheduled. Recommending shift adjustments to prevent queue congestion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
