import React, { useState, useEffect } from 'react';
import { 
  Clock, Search, Plus, User, CheckCircle2, ShieldAlert, Loader2, Calendar 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Theatre({ orgId }) {
  const [surgeries, setSurgeries] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [form, setForm] = useState({
    patient_name: '',
    procedure: 'Appendectomy',
    surgeon: 'Dr. Amina Yusuf',
    scheduled_time: '',
    theatre_room: 'OR Room 1'
  });

  useEffect(() => {
    fetchSurgeries();
    fetchPatients();
  }, [orgId]);

  const fetchSurgeries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/theatre/schedule?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSurgeries(data || []);
      }
    } catch (e) {
      console.error("Error loading surgeries:", e);
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

  const handleAddSurgery = async (e) => {
    e.preventDefault();
    if (!form.patient_name) return;
    setSubmitting(true);
    try {
      const patient = patients.find(p => p.display_label === form.patient_name);
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/theatre/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          patient_id: patient ? patient.id : `PAT-OP-${Math.floor(1000 + Math.random()*9000)}`,
          patient_name: form.patient_name,
          procedure: form.procedure,
          surgeon: form.surgeon,
          scheduled_time: form.scheduled_time || new Date().toISOString(),
          theatre_room: form.theatre_room,
          team: ["Nurse Bola", "Anaesthetist Dr. Chidi Obi"]
        })
      });

      if (res.ok) {
        setForm({ patient_name: '', procedure: 'Appendectomy', surgeon: 'Dr. Amina Yusuf', scheduled_time: '', theatre_room: 'OR Room 1' });
        setShowAddModal(false);
        await fetchSurgeries();
      }
    } catch (e) {
      console.error("Schedule surgery failed:", e);
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
            <Clock className="w-4 h-4" /> THEATRE MANAGEMENT
          </div>
          <h2 className="text-3xl font-extrabold text-white">Operating Theatre Scheduling</h2>
          <p className="text-slate-400 mt-1">Book operating rooms, assign surgical practitioner teams, and verify pre-surgery checklists.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> Book Surgery Slot
        </button>
      </div>

      {/* Schedule Table */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-rose-400" /> Surgical Operations Roster</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Procedure Description</th>
                <th className="p-4">Lead Surgeon</th>
                <th className="p-4">Scheduled Slot</th>
                <th className="p-4">OR Room</th>
                <th className="p-4">Practitioner Team</th>
                <th className="p-4 text-right">Equipment Pre-Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : surgeries.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-500 italic">No surgical procedures scheduled.</td></tr>
              ) : (
                surgeries.map(s => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white">{s.attributes?.patient_name}</td>
                    <td className="p-4 font-medium text-slate-300">{s.attributes?.procedure}</td>
                    <td className="p-4 text-slate-400">{s.attributes?.surgeon}</td>
                    <td className="p-4 font-mono text-rose-300">{new Date(s.attributes?.scheduled_time).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="p-4 text-slate-300">{s.attributes?.theatre_room}</td>
                    <td className="p-4 text-slate-400">{s.attributes?.surgical_team?.join(', ')}</td>
                    <td className="p-4 text-right">
                      {s.attributes?.equipment_precheck ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 justify-end"><CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED OK</span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1 justify-end"><ShieldAlert className="w-3.5 h-3.5" /> PENDING</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Surgery Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-rose-400" /> Book Operating Room Slot</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSurgery} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={form.patient_name}
                  onChange={(e) => setForm({...form, patient_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.display_label}>{p.display_label} ({p.attributes?.patient_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Surgical Procedure Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Appendectomy, Coronary Bypass Surgery"
                  value={form.procedure}
                  onChange={(e) => setForm({...form, procedure: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Lead Surgeon</label>
                  <select
                    value={form.surgeon}
                    onChange={(e) => setForm({...form, surgeon: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                  >
                    <option value="Dr. Amina Yusuf">Dr. Amina Yusuf</option>
                    <option value="Dr. Chidi Obi">Dr. Chidi Obi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Operating Theatre Room</label>
                  <select
                    value={form.theatre_room}
                    onChange={(e) => setForm({...form, theatre_room: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                  >
                    <option value="OR Room 1">OR Room 1 (Main)</option>
                    <option value="OR Room 2">OR Room 2 (Minor)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduled_time}
                  onChange={(e) => setForm({...form, scheduled_time: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
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
                  Confirm Surgery Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
