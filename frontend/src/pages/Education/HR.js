import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Loader2, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduHRPage({ orgId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    staff_id: 'EMP-9081',
    staff_name: 'Mrs. Funmi Oshin'
  });

  useEffect(() => {
    fetchStaff();
  }, [orgId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/hr/staff?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStaff(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/hr/clockin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        fetchStaff();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" /> STAFF & HR OFFICE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Staff Registry & Attendance Logs</h2>
          <p className="text-slate-400 mt-1">Audit employee profiles, track leaves, verify qualifications, and manage biometric clock-ins.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Staff Registry & Clock-In History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Staff ID</th>
                    <th className="p-4">Total Clock-ins</th>
                    <th className="p-4">Last Clock-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading registry...</td></tr>
                  ) : staff.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No staff logs found. Trigger a simulator to register clock-ins.</td></tr>
                  ) : staff.map(s => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${s.display_label}`} className="w-8 h-8 rounded-full bg-white/10" alt="Avatar" />
                        {s.display_label}
                      </td>
                      <td className="p-4 font-mono text-cyan-300">{s.attributes?.staff_id}</td>
                      <td className="p-4 font-mono">{s.attributes?.clock_in_logs?.length || 0} times</td>
                      <td className="p-4 text-slate-400 font-mono">
                        {s.attributes?.clock_in_logs?.length > 0 
                          ? new Date(s.attributes.clock_in_logs[s.attributes.clock_in_logs.length - 1]).toLocaleString()
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Biometric Fingerprint Clock-In Simulator</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1.5">Select Staff Member</label>
                <select
                  value={formData.staff_id}
                  onChange={(e) => {
                    const name = e.target.value === 'EMP-9081' ? 'Mrs. Funmi Oshin' : 'Mr. Kassim Bello';
                    setFormData({ staff_id: e.target.value, staff_name: name });
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="EMP-9081">Mrs. Funmi Oshin (Science)</option>
                  <option value="EMP-1024">Mr. Kassim Bello (Lab Tech)</option>
                </select>
              </div>

              <button
                onClick={handleClockIn}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Trigger Fingerprint Clock-In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
