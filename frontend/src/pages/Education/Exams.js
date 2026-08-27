import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Loader2, Sparkles, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduExamsPage({ orgId }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    subject: 'Chemistry',
    exam_date: '2026-08-20T10:00:00Z',
    questions: [
      { q: "What is the atomic number of Carbon?", options: ["5", "6", "7", "8"], correct: "6" }
    ]
  });

  // CBT simulator
  const [runningCbt, setRunningCbt] = useState(false);
  const [cbtResult, setCbtResult] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchExams();
    fetchStudents();
  }, [orgId]);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/exams?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setExams(data || []);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/education/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ subject: 'Chemistry', exam_date: '2026-08-20T10:00:00Z', questions: [{ q: "What is Carbon atomic number?", options: ["5", "6"], correct: "6" }] });
        fetchExams();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const runCbtSimulator = async () => {
    if (students.length === 0) {
      alert("No students onboarded in the directory yet. Please onboard a student first!");
      return;
    }
    const targetStudent = students[0];
    const targetId = targetStudent.attributes?.student_id || targetStudent.id;
    const targetName = targetStudent.display_label;
    const activeSubject = exams[0]?.display_label?.replace("Exam: ", "") || 'Computer Science';

    setRunningCbt(true);
    setCbtResult('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/exams/submit-cbt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          student_id: targetId,
          student_name: targetName,
          subject: activeSubject,
          score: Math.floor(Math.random() * 41) + 60
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCbtResult(data.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningCbt(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
            <FileText className="w-4 h-4" /> EXAM OFFICE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Examination Schedules & CBT Engine</h2>
          <p className="text-slate-400 mt-1">Publish midterm/final dates, build dynamic Q&A question banks, and administer Computer-Based Testing (CBT).</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Publish Exam
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Exams List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Published Exams</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Exam Date</th>
                    <th className="p-4">Questions Count</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading exams...</td></tr>
                  ) : exams.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No exams published. Click Publish Exam.</td></tr>
                  ) : exams.map(e => (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{e.display_label}</td>
                      <td className="p-4 font-mono text-indigo-300">{new Date(e.attributes?.exam_date).toLocaleDateString()}</td>
                      <td className="p-4 font-mono text-slate-300">{e.attributes?.questions?.length || 0} items</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[9px] bg-green-500/20 text-green-300 font-bold border border-green-500/30 uppercase">Published</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CBT Simulator */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-indigo-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /> CBT Testing Simulator</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Triggers a simulated test completion for student Daniel Nnamdi on Computer Science, posting scores directly to the grading registrar.
            </p>
            <button
              onClick={runCbtSimulator}
              disabled={runningCbt}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningCbt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-indigo-300" />}
              Launch CBT Exam Simulator
            </button>

            {cbtResult && (
              <div className="mt-4 p-4 bg-green-950/10 border border-green-500/20 text-xs text-green-300 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{cbtResult}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-indigo-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-indigo-950/20 px-6 py-4 border-b border-indigo-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Publish Exam Sheet</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Exam Date</label>
                <input
                  type="datetime-local"
                  required
                  value={(formData.exam_date || '').substring(0, 16)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setFormData({...formData, exam_date: ''});
                      return;
                    }
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      setFormData({...formData, exam_date: d.toISOString()});
                    }
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
