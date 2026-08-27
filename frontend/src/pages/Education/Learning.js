import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Loader2, Sparkles, AlertCircle, FileText, Video, MessageSquare } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduLearningPage({ orgId }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: 'Computer Science',
    due_date: '2026-08-15',
    materials_url: 'https://storage.googleapis.com/interac-lms/comp-sci-notes.pdf'
  });

  useEffect(() => {
    fetchMaterials();
  }, [orgId]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/learning/materials?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data || []);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/education/learning/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ title: '', subject: 'Computer Science', due_date: '2026-08-15', materials_url: 'https://storage.googleapis.com/interac-lms/comp-sci-notes.pdf' });
        fetchMaterials();
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
            <Book className="w-4 h-4" /> LEARNING MANAGEMENT SYSTEM (LMS)
          </div>
          <h2 className="text-3xl font-extrabold text-white">Course Materials & Video Lessons</h2>
          <p className="text-slate-400 mt-1">Publish lecture handouts, manage student assignments, and track submission progress.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Add Lecture Notes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Course Materials Directory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-2 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto" /></div>
              ) : materials.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-slate-500 italic">No notes or handouts uploaded. Click Add Lecture Notes.</div>
              ) : materials.map(mat => (
                <div key={mat.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl space-y-4 hover:bg-white/10 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{mat.display_label}</h4>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{mat.attributes?.subject}</span>
                    </div>
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="text-[11px] text-slate-400 flex justify-between items-center border-t border-white/5 pt-3">
                    <span>Due Date: {mat.attributes?.due_date || 'N/A'}</span>
                    <a
                      href={mat.attributes?.materials_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-300 font-bold hover:underline"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Video Resources & Forums */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Video className="w-5 h-5 text-cyan-400" /> Video Class Library</h3>
            <div className="space-y-3">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                <div className="font-bold text-xs text-white">Intro to Algebra Functions</div>
                <div className="text-[10px] text-slate-500 font-mono">14m 20s | Dr. Alao Yusuf</div>
                <a href="#play" className="text-cyan-300 font-bold text-[10px] hover:underline block">Watch Video</a>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                <div className="font-bold text-xs text-white">Acid Titration Lab Walkthrough</div>
                <div className="text-[10px] text-slate-500 font-mono">18m 45s | Mr. Kassim</div>
                <a href="#play" className="text-cyan-300 font-bold text-[10px] hover:underline block">Watch Video</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Upload Notes / Assignments</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Lecture / Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4: Algebraic Equations"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subject</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Chemistry">Chemistry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Deadline Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Material Storage URL</label>
                <input
                  type="text"
                  value={formData.materials_url}
                  onChange={(e) => setFormData({...formData, materials_url: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
