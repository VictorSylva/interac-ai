import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Loader2, Sparkles, Calendar, Layers, MapPin } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduAcademicPage({ orgId }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    teacher_name: '',
    stream: 'Stream A',
    curriculum: 'National WAEC Spec'
  });

  const [aiResult, setAiResult] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [orgId]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/academic/courses?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data || []);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/education/academic/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ title: '', teacher_name: '', stream: 'Stream A', curriculum: 'National WAEC Spec' });
        fetchCourses();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const runPerformanceAnalysis = async () => {
    setRunningAI(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:analyze_class_performance',
          params: { org_id: orgId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningAI(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Book className="w-4 h-4" /> ACADEMIC OPERATIONS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Class & Departmental Registry</h2>
          <p className="text-slate-400 mt-1">Configure departments, classes, option streams, faculties, and assigned advisors.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Add Class / Department
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-cyan-400" /> Active Class & Department Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Class / Department</th>
                    <th className="p-4">Assigned Advisor / Head</th>
                    <th className="p-4">Stream / Option</th>
                    <th className="p-4">Faculty / Division</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="4" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto" /></td></tr>
                  ) : courses.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No courses indexed. Click Add Subject.</td></tr>
                  ) : courses.map(c => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{c.display_label}</td>
                      <td className="p-4 text-cyan-300">{c.attributes?.teacher_name}</td>
                      <td className="p-4 font-mono">{c.attributes?.stream}</td>
                      <td className="p-4 text-slate-400">{c.attributes?.curriculum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-cyan-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" /> AI Departmental Analytics
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates departmental registrations and GPA metrics to identify performance improvements.
            </p>
            <button
              onClick={runPerformanceAnalysis}
              disabled={runningAI}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningAI && <Loader2 className="w-4 h-4 animate-spin" />}
              Analyze Departmental Performance
            </button>

            {aiResult && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-cyan-500/20 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">School GPA Average:</span>
                  <span className="font-bold text-white font-mono">{aiResult.school_gpa_average}</span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Department Performance Rankings:</div>
                  {aiResult.subject_rankings?.map((rank, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-300">{rank.subject}</span>
                      <span className={`font-bold ${rank.performance === 'EXCELLENT' ? 'text-green-400' : rank.performance === 'AVERAGE' ? 'text-amber-400' : 'text-rose-400'}`}>{rank.average}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

       {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add Class / Department</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Class / Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science Department"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Advisor / Head</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alao Yusuf"
                    value={formData.teacher_name}
                    onChange={(e) => setFormData({...formData, teacher_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Stream / Option Allocation</label>
                  <select
                    value={formData.stream}
                    onChange={(e) => setFormData({...formData, stream: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Stream A">Stream A</option>
                    <option value="Stream B">Stream B</option>
                    <option value="Stream C">Stream C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Faculty / Division</label>
                <input
                  type="text"
                  value={formData.curriculum}
                  onChange={(e) => setFormData({...formData, curriculum: e.target.value})}
                  placeholder="e.g. Faculty of Sciences"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Class / Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
