import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Search, Plus, Activity, Clock, ShieldAlert, Heart, Plaster, Sparkles, CheckCircle2, FileText, Loader2 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Nursing({ orgId }) {
  const [beds, setBeds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Nurse rounds logs form
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [form, setForm] = useState({
    action_taken: 'Rounds Check',
    systolic: 120,
    diastolic: 80,
    heart_rate: 72,
    temperature: 36.8,
    spo2: 98,
    notes: ''
  });

  useEffect(() => {
    fetchBeds();
    fetchLogs();
  }, [orgId]);

  const fetchBeds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/wards/beds?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setBeds(data.filter(b => b.attributes?.status === 'OCCUPIED') || []);
      }
    } catch (e) {
      console.error("Error loading beds:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/nursing/logs?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (e) {
      console.error("Error loading logs:", e);
    }
  };

  const handleOpenLogModal = (bed) => {
    setSelectedBed(bed);
    setShowLogModal(true);
  };

  const handleLogRound = async (e) => {
    e.preventDefault();
    if (!selectedBed) return;
    setSubmitting(true);
    try {
      const payload = {
        org_id: orgId,
        patient_id: selectedBed.attributes?.patient_id,
        patient_name: selectedBed.attributes?.patient_name,
        action_taken: form.action_taken,
        vitals: {
          systolic: form.systolic,
          diastolic: form.diastolic,
          heart_rate: form.heart_rate,
          temperature: form.temperature,
          spo2: form.spo2
        },
        notes: form.notes
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/nursing/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setForm({
          action_taken: 'Rounds Check',
          systolic: 120,
          diastolic: 80,
          heart_rate: 72,
          temperature: 36.8,
          spo2: 98,
          notes: ''
        });
        setShowLogModal(false);
        await fetchLogs();
      }
    } catch (e) {
      console.error("Error submitting nurse round:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Activity className="w-4 h-4" /> NURSING WORKSPACE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Nurses Station & Handover Logs</h2>
          <p className="text-slate-400 mt-1">Monitor assigned beds, schedule medication routines, check vitals, and log handovers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Occupied Bed Listings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Heart className="w-5 h-5 text-rose-400" /> Active Patients Ward Roster</h3>
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></div>
            ) : beds.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs">No patients admitted in ICU or general wards.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {beds.map(bed => (
                  <div key={bed.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 uppercase tracking-wider">{bed.attributes?.bed_number}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{bed.attributes?.ward}</span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-2">{bed.attributes?.patient_name}</h4>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold">Occupied Since: {new Date(bed.attributes?.occupied_at).toLocaleDateString()}</span>
                      <button
                        onClick={() => handleOpenLogModal(bed)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log Round Check
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Round Logs History */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-rose-400" /> Recent Round logs</h3>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">No rounds logged.</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-white">{log.attributes?.patient_name}</h4>
                      <span className="text-[9px] text-rose-300 font-mono block mt-0.5">{log.attributes?.action_taken}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-medium">{new Date(log.attributes?.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed italic">"{log.attributes?.notes || 'No observations recorded'}"</p>
                  
                  {log.attributes?.vitals && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>BP: {log.attributes.vitals.systolic}/{log.attributes.vitals.diastolic}</span>
                      <span>HR: {log.attributes.vitals.heart_rate}</span>
                      <span>SpO2: {log.attributes.vitals.spo2}%</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Log Round Modal */}
      {showLogModal && selectedBed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-rose-400" /> Log Vitals & Round Check</h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleLogRound} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs">
                Patient: <strong>{selectedBed.attributes?.patient_name}</strong> ({selectedBed.attributes?.bed_number})
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Action Code / Operation</label>
                <select
                  value={form.action_taken}
                  onChange={(e) => setForm({...form, action_taken: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Rounds Check">Standard Ward Round Check</option>
                  <option value="Administer Meds">Medication Dispensation Check</option>
                  <option value="Shift Handover">Shift Handover Brief</option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Sys BP</label>
                  <input type="number" value={form.systolic} onChange={(e)=>setForm({...form, systolic: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Dia BP</label>
                  <input type="number" value={form.diastolic} onChange={(e)=>setForm({...form, diastolic: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">HR (bpm)</label>
                  <input type="number" value={form.heart_rate} onChange={(e)=>setForm({...form, heart_rate: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Temp (°C)</label>
                  <input type="number" step="0.1" value={form.temperature} onChange={(e)=>setForm({...form, temperature: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">SpO2 (%)</label>
                  <input type="number" value={form.spo2} onChange={(e)=>setForm({...form, spo2: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observations / Handover Notes</label>
                <textarea
                  required
                  placeholder="Patient reports improvement, pain level is 2/10. Administered prescribed dosage..."
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  rows="3"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
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
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
