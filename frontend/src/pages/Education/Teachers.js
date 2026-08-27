import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Loader2, Sparkles, AlertCircle, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduTeachersPage({ orgId }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    department: 'Science',
    weekly_hours: 18,
    salary: 150000
  });

  const [aiResult, setAiResult] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, [orgId]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/teachers?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data || []);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/education/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ name: '', department: 'Science', weekly_hours: 18, salary: 150000 });
        fetchTeachers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const runWorkloadAnalysis = async () => {
    setRunningAI(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:analyze_teacher_workload',
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
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
            <UserCheck className="w-4 h-4" /> TEACHER MANAGEMENT
          </div>
          <h2 className="text-3xl font-extrabold text-white">Teacher Profiles & Workloads</h2>
          <p className="text-slate-400 mt-1">Manage teaching staff qualifications, lesson hour distributions, and payroll integrations.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Register Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Teacher Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Teacher Name</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Weekly Load</th>
                    <th className="p-4">Base Salary</th>
                    <th className="p-4">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" /></td></tr>
                  ) : teachers.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No teachers registered. Click Register Teacher.</td></tr>
                  ) : teachers.map(t => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${t.display_label}`} className="w-8 h-8 rounded-full bg-white/10" alt="Avatar" />
                        {t.display_label}
                      </td>
                      <td className="p-4 text-slate-300">{t.attributes?.department}</td>
                      <td className="p-4 font-mono">{t.attributes?.weekly_hours} hours/wk</td>
                      <td className="p-4 font-mono text-indigo-300">₦{t.attributes?.salary?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-green-300">{t.attributes?.performance_score || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-indigo-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" /> AI Workload Audit
            </h3>
            <p className="text-xs text-slate-400">
              Scans teacher profiles, course loads, and streams to flag double bookings and schedule overload.
            </p>
            <button
              onClick={runWorkloadAnalysis}
              disabled={runningAI}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningAI && <Loader2 className="w-4 h-4 animate-spin" />}
              Audit Teacher Workload
            </button>

            {aiResult && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-indigo-500/20 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Average weekly workload:</span>
                  <span className="font-bold text-white font-mono">{aiResult.average_workload_hours_weekly} hours</span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Overloaded Staff Flags:</div>
                  {aiResult.overloaded_teachers?.map((t, idx) => (
                    <div key={idx} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl space-y-1">
                      <div className="font-bold text-rose-300">{t.teacher_name}</div>
                      <div className="text-[10px] text-slate-400">Weekly Hours: {t.weekly_hours} | Double Bookings: {t.conflict_warnings}</div>
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
          <div className="glass w-full max-w-md rounded-3xl border border-indigo-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-indigo-950/20 px-6 py-4 border-b border-indigo-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Register Teacher</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Teacher Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Funmi Oshin"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Science">Science</option>
                    <option value="Arts & Languages">Arts & Languages</option>
                    <option value="Social Science">Social Science</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Weekly Lessons (Hrs)</label>
                  <input
                    type="number"
                    value={formData.weekly_hours}
                    onChange={(e) => setFormData({...formData, weekly_hours: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Monthly Base Salary (₦)</label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({...formData, salary: parseInt(e.target.value)})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
