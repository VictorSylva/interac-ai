import React, { useState, useEffect } from 'react';
import { 
  Crosshair, Search, Plus, User, Clock, AlertCircle, Play, Loader2, CheckCircle2, Eye 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Radiology({ orgId }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedScan, setSelectedScan] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [form, setForm] = useState({
    report_details: '',
    image_pacs_url: ''
  });

  useEffect(() => {
    fetchScans();
  }, [orgId]);

  const fetchScans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/radiology/scans?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setScans(data || []);
      }
    } catch (e) {
      console.error("Error loading radiology scans:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = (s) => {
    setSelectedScan(s);
    setShowReportModal(true);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!selectedScan) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/radiology/scans/${selectedScan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          status: 'COMPLETED',
          report_details: form.report_details,
          image_pacs_url: form.image_pacs_url || 'https://imaging-archive.interac.ai/dicom/study-889012.png'
        })
      });

      if (res.ok) {
        setForm({ report_details: '', image_pacs_url: '' });
        setShowReportModal(false);
        await fetchScans();
      }
    } catch (e) {
      console.error("Error updating scan report:", e);
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
            <Crosshair className="w-4 h-4" /> IMAGING OPERATIONS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Radiology & PACS Imaging Wing</h2>
          <p className="text-slate-400 mt-1">Review X-Ray/CT/MRI scan orders, compile diagnostic reports, and link PACS file references.</p>
        </div>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Active Imaging Queue</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Scan Type</th>
                <th className="p-4">Sync Status</th>
                <th className="p-4">PACS Image Reference</th>
                <th className="p-4">Radiologist Diagnostic Findings</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : scans.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No imaging requests pending.</td></tr>
              ) : (
                scans.map(s => {
                  const isCompleted = s.attributes?.status === 'COMPLETED';
                  return (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{s.attributes?.patient_name}</td>
                      <td className="p-4 font-medium text-slate-300">{s.attributes?.imaging_type}</td>
                      <td className="p-4 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isCompleted ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {s.attributes?.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {isCompleted ? (
                          <a href={s.attributes?.image_pacs_url} target="_blank" rel="noreferrer" className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> View PACS DICOM File
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">No image file linked</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isCompleted ? (
                          <p className="text-xs text-slate-300 truncate max-w-[200px]" title={s.attributes?.report_details}>
                            {s.attributes?.report_details}
                          </p>
                        ) : (
                          <span className="text-slate-500 italic">Awaiting findings...</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!isCompleted ? (
                          <button
                            onClick={() => handleOpenReport(s)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all"
                          >
                            Compile Report
                          </button>
                        ) : (
                          <span className="text-slate-500 font-bold text-[10px]">Report Dispatched</span>
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

      {/* Enter Report Modal */}
      {showReportModal && selectedScan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Crosshair className="w-5 h-5 text-rose-400" /> Compile Radiology Diagnostic Findings</h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmitReport} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
                Patient: <strong className="text-white">{selectedScan.attributes?.patient_name}</strong> <br />
                Requested Imaging: <strong className="text-white">{selectedScan.attributes?.imaging_type}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">PACS Image Link URL (DICOM)</label>
                <input
                  type="text"
                  placeholder="https://imaging-archive.interac.ai/dicom/study-889012.png"
                  value={form.image_pacs_url}
                  onChange={(e) => setForm({...form, image_pacs_url: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Diagnostic Findings Notes</label>
                <textarea
                  required
                  placeholder="Chest CT shows consolidated opacity in the right lower lobe, indicative of lobar pneumonia..."
                  value={form.report_details}
                  onChange={(e) => setForm({...form, report_details: e.target.value})}
                  rows="4"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
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
