import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, Plus, User, CheckCircle2, ShieldAlert, Loader2, Clock, Activity 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Emergency({ orgId }) {
  const [triageQueue, setTriageQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [congestion, setCongestion] = useState(null);

  // Intake / Triage update modal
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [form, setForm] = useState({
    patient_id: '',
    triage_level: 'Urgent'
  });

  useEffect(() => {
    fetchTriageQueue();
    fetchPatients();
    fetchCongestion();
  }, [orgId]);

  const fetchTriageQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/emergency/triage?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setTriageQueue(data || []);
      }
    } catch (e) {
      console.error("Error loading triage queue:", e);
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

  const fetchCongestion = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/emergency/congestion?org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setCongestion(data);
      }
    } catch (e) {
      console.error("Error loading congestion details:", e);
    }
  };

  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.triage_level) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/emergency/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          patient_id: form.patient_id,
          triage_level: form.triage_level
        })
      });

      if (res.ok) {
        setForm({ patient_id: '', triage_level: 'Urgent' });
        setShowTriageModal(false);
        await fetchTriageQueue();
        await fetchCongestion();
      }
    } catch (e) {
      console.error("Triage update error:", e);
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
            <AlertTriangle className="w-4 h-4" /> EMERGENCY ROOM (ER) Triages
          </div>
          <h2 className="text-3xl font-extrabold text-white">Emergency Department Intake</h2>
          <p className="text-slate-400 mt-1">Classify patient priorities using the South African/Standard Triage Scale, monitor wait-times.</p>
        </div>
        <button 
          onClick={() => setShowTriageModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> Triage Check-in
        </button>
      </div>

      {/* Congestion stats */}
      {congestion && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Average ER Wait Time</span>
            <h3 className="text-2xl font-black text-white mt-1">{congestion.avg_waiting_time_mins} mins</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Check-in to Practitioner call</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">ER Occupancy</span>
            <h3 className="text-2xl font-black text-rose-400 mt-1">{congestion.er_occupancy}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Bed capacity index</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Critical (Red Code) Cases</span>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{congestion.red_priority_count}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Immediate resuscitation needed</span>
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Emergency (Orange Code)</span>
            <h3 className="text-2xl font-black text-indigo-400 mt-1">{congestion.orange_priority_count}</h3>
            <span className="text-[9px] text-slate-500 block mt-1">Needs treatment within 10m</span>
          </div>
        </div>
      )}

      {/* Triage Queue Table */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-rose-400" /> Priority Triage Queue</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Patient File ID</th>
                <th className="p-4">Triage Priority Class</th>
                <th className="p-4">Admissions Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : triageQueue.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No patients in ER queue.</td></tr>
              ) : (
                triageQueue.map(pat => {
                  const level = pat.attributes?.triage_level;
                  const isCritical = level === 'Critical';
                  const isEmergency = level === 'Emergency';
                  
                  return (
                    <tr key={pat.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{pat.display_label}</td>
                      <td className="p-4 font-mono text-slate-400">{pat.attributes?.patient_id}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : isEmergency
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {level}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">Checked-in Triage Bay</td>
                      <td className="p-4 text-right">
                        <span className="text-rose-400 font-bold text-xs uppercase tracking-wider">Awaiting Practitioner Call</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Triage Check-in Modal */}
      {showTriageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-400" /> Emergency Triage Intake</h3>
              <button onClick={() => setShowTriageModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleTriageSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={form.patient_id}
                  onChange={(e) => setForm({...form, patient_id: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.display_label} ({p.attributes?.patient_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Triage Level (Severity)</label>
                <select
                  value={form.triage_level}
                  onChange={(e) => setForm({...form, triage_level: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                >
                  <option value="Critical">Critical (Red - Immediate Resuscitation)</option>
                  <option value="Emergency">Emergency (Orange - Needs treatment within 10m)</option>
                  <option value="Urgent">Urgent (Yellow - Needs treatment within 60m)</option>
                  <option value="Normal">Routine Outpatient (Green)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowTriageModal(false)}
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
                  Confirm Emergency Triage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
