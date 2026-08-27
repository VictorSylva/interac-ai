import React, { useState, useEffect } from 'react';
import { Activity, Plus, Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduClinicPage({ orgId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    student_id: 'EDU-STUD-5541',
    student_name: 'Daniel Nnamdi',
    symptoms: 'Mild fever and seasonal allergy symptoms.',
    medication_administered: 'Paracetamol 500mg'
  });

  useEffect(() => {
    fetchVisits();
  }, [orgId]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/clinic/visits?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setVisits(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/clinic/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ student_id: 'EDU-STUD-5541', student_name: 'Daniel Nnamdi', symptoms: 'Mild fever.', medication_administered: 'Paracetamol' });
        fetchVisits();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Activity className="w-4 h-4" /> HEALTH & CLINIC
          </div>
          <h2 className="text-3xl font-extrabold text-white">Campus Medical Logs & Vitals</h2>
          <p className="text-slate-400 mt-1">Record clinic consults, check child vitals, and automatically alert parents for critical incidents.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Log Clinic Visit
        </button>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Medical Logs Timeline</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Student ID</th>
                <th className="p-4">Symptoms / Diagnosis</th>
                <th className="p-4">Medication Administered</th>
                <th className="p-4">Visited At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading logs...</td></tr>
              ) : visits.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No medical visits logged. Click Log Clinic Visit to start.</td></tr>
              ) : visits.map(v => (
                <tr key={v.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white">{v.attributes?.student_name}</td>
                  <td className="p-4 font-mono text-cyan-300">{v.attributes?.student_id}</td>
                  <td className="p-4 text-slate-300">{v.attributes?.symptoms}</td>
                  <td className="p-4 text-slate-400">{v.attributes?.medication}</td>
                  <td className="p-4 font-mono text-slate-500">{new Date(v.attributes?.visited_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Log Clinic Visit</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.student_name}
                  onChange={(e) => setFormData({...formData, student_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Symptoms / Incident</label>
                <textarea
                  required
                  placeholder="e.g. Mild headache, temperature 38.2 C"
                  value={formData.symptoms}
                  onChange={(e) => setFormData({...formData, symptoms: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 h-20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Treatment / Medication administered</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg and 1hr bed rest"
                  value={formData.medication_administered}
                  onChange={(e) => setFormData({...formData, medication_administered: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
