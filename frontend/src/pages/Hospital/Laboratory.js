import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Plus, User, Clock, AlertTriangle, Play, Loader2, CheckCircle2, FlaskConical 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Laboratory({ orgId }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedTest, setSelectedTest] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [form, setForm] = useState({
    status: 'COMPLETED',
    results: '',
    is_critical: false
  });

  useEffect(() => {
    fetchTests();
  }, [orgId]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/laboratory/tests?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data || []);
      }
    } catch (e) {
      console.error("Error loading lab tests:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResults = (t) => {
    setSelectedTest(t);
    setShowResultModal(true);
  };

  const handleEnterResults = async (e) => {
    e.preventDefault();
    if (!selectedTest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/laboratory/tests/${selectedTest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          status: form.status,
          results: form.results,
          is_critical: form.is_critical
        })
      });

      if (res.ok) {
        setForm({ status: 'COMPLETED', results: '', is_critical: false });
        setShowResultModal(false);
        await fetchTests();
      }
    } catch (e) {
      console.error("Error updating lab test:", e);
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
            <FlaskConical className="w-4 h-4" /> LAB OPERATIONS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Diagnostic Laboratory Portal</h2>
          <p className="text-slate-400 mt-1">Review diagnostic orders, collect blood/fluid samples, and submit pathology reports.</p>
        </div>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Pending Lab Request Queue</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Diagnostic Test Required</th>
                <th className="p-4">Ordered By</th>
                <th className="p-4">Turnaround Status</th>
                <th className="p-4">Lab Findings Result</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : tests.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No lab tests requested.</td></tr>
              ) : (
                tests.map(t => {
                  const isCompleted = t.attributes?.status === 'COMPLETED';
                  const isCritical = t.attributes?.is_critical;
                  return (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{t.attributes?.patient_name}</td>
                      <td className="p-4 font-medium text-slate-300">{t.attributes?.test_type}</td>
                      <td className="p-4 text-slate-400">{t.attributes?.doctor_name}</td>
                      <td className="p-4 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isCompleted ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {t.attributes?.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {isCompleted ? (
                          <span className={`font-mono text-xs font-bold ${isCritical ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                            {t.attributes?.results} {isCritical && '(CRITICAL)'}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Awaiting findings...</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!isCompleted ? (
                          <button
                            onClick={() => handleOpenResults(t)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all"
                          >
                            Enter Results
                          </button>
                        ) : (
                          <span className="text-slate-500 font-bold text-[10px]">Submitted</span>
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

      {/* Enter Result Modal */}
      {showResultModal && selectedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-rose-400" /> Enter Diagnostic Lab Results</h3>
              <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleEnterResults} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
                Patient: <strong className="text-white">{selectedTest.attributes?.patient_name}</strong> <br />
                Requested Test: <strong className="text-white">{selectedTest.attributes?.test_type}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Lab Findings Values / Result Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PCV 34%, Blood Culture Negative, HbA1c 8.4%"
                  value={form.results}
                  onChange={(e) => setForm({...form, results: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="critical"
                  checked={form.is_critical}
                  onChange={(e) => setForm({...form, is_critical: e.target.checked})}
                  className="w-4 h-4 rounded border-white/10 bg-black/30 text-rose-600 focus:ring-0"
                />
                <label htmlFor="critical" className="text-xs font-bold text-rose-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" /> Flag as Critical Value Alert
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
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
                  Submit Findings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
