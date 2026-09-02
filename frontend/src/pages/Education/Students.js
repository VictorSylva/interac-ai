import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Loader2, Sparkles, AlertCircle, ShieldAlert, Heart, Calendar, Shield, CreditCard } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduStudentsPage({ orgId }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState([]);
  
  // Registration Form
  const [showRegModal, setShowRegModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    national_id: '',
    guardian_name: '',
    guardian_contact: '',
    guardian_email: '',
    student_email: '',
    course_enrolled: '',
    medical_history: 'None declared'
  });

  // AI Prediction Pane
  const [dropoutResult, setDropoutResult] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, [orgId]);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/academic/courses?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, course_enrolled: data[0].display_label }));
        }
      }
    } catch (e) {
      console.error("Error loading courses:", e);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
      }
    } catch (e) {
      console.error("Error loading students:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowRegModal(false);
        setFormData({ name: '', national_id: '', guardian_name: '', guardian_contact: '', guardian_email: '', student_email: '', course_enrolled: courses[0]?.display_label || '', medical_history: 'None declared' });
        fetchStudents();
      } else {
        const err = await res.json();
        alert(err.detail || "Registration failed");
      }
    } catch (e) {
      console.error("Student registration error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const runDropoutPrediction = async () => {
    setRunningAI(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:predict_dropout',
          params: { org_id: orgId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDropoutResult(data.result);
      }
    } catch (e) {
      console.error("Dropout prediction error:", e);
    } finally {
      setRunningAI(false);
    }
  };

  const filtered = students.filter(s =>
    s.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.attributes?.student_id && s.attributes.student_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" /> Student Information System (SIS)
          </div>
          <h2 className="text-3xl font-extrabold text-white">Student Enrollment & Directory</h2>
          <p className="text-slate-400 mt-1">Manage academic registration, digital profiles, emergency contacts, and medical histories.</p>
        </div>
        <button
          onClick={() => setShowRegModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Onboard Student
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Students List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold text-white">Registered Students</h3>
              <input
                type="text"
                placeholder="Search by name or matric ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none w-full sm:w-64 focus:border-cyan-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Matric ID</th>
                    <th className="p-4">Course/Stream</th>
                    <th className="p-4">National ID</th>
                    <th className="p-4">Dropout Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 italic">
                        No students enrolled. Click Onboard Student to add records.
                      </td>
                    </tr>
                  ) : filtered.map(s => {
                    const isRisk = s.attributes?.attendance_risk === 'High';
                    return (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <img
                            src={s.attributes?.photo_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.display_label}`}
                            alt="Avatar"
                            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10"
                          />
                          <div>
                            <div className="font-bold text-white">{s.display_label}</div>
                            <div className="text-[10px] text-slate-400">Guardian: {s.attributes?.guardian_name || 'None'}</div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-cyan-300">{s.attributes?.student_id}</td>
                        <td className="p-4 text-slate-300">{s.attributes?.course_enrolled}</td>
                        <td className="p-4 font-mono text-slate-400">{s.attributes?.national_id || 'N/A'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isRisk ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'
                          }`}>
                            {s.attributes?.attendance_risk || 'Low'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: AI Dropout Predictor */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-cyan-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" /> AI Dropout Risk Predictor
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analyzes student grade trends, attendance sheets, and LMS submission schedules to forecast students at risk of dropouts.
            </p>
            <button
              onClick={runDropoutPrediction}
              disabled={runningAI}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningAI && <Loader2 className="w-4 h-4 animate-spin" />}
              {runningAI ? 'Analyzing Trends...' : 'Run Dropout Risk Forecast'}
            </button>

            {dropoutResult && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-cyan-500/20 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Dropout Risk Level:</span>
                  <span className="font-bold text-cyan-300 uppercase">{dropoutResult.dropout_risk_index}</span>
                </div>
                <div className="border-t border-white/5 pt-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">High Risk Students Flagged:</div>
                  {dropoutResult.flagged_high_risk?.map((student, idx) => (
                    <div key={idx} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between font-bold text-xs text-rose-300">
                        <span>{student.name}</span>
                        <span>{student.dropout_probability}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">GPA: {student.grade_average} | Absences: {student.unexcused_absences}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-2 text-[11px] text-slate-400">
                  <strong>Recommendation:</strong> {dropoutResult.recommendation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboard Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Onboard Student</h3>
              <button onClick={() => setShowRegModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Daniel Nnamdi"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Student Email (Login)</label>
                  <input
                    type="email"
                    placeholder="student@school.edu"
                    value={formData.student_email}
                    onChange={(e) => setFormData({...formData, student_email: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Email (Login)</label>
                  <input
                    type="email"
                    placeholder="parent@school.edu"
                    value={formData.guardian_email}
                    onChange={(e) => setFormData({...formData, guardian_email: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">National ID (NIN)</label>
                  <input
                    type="text"
                    placeholder="NIN-8890-NG"
                    value={formData.national_id}
                    onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Enrolled Stream/Dept</label>
                  <select
                    value={formData.course_enrolled}
                    onChange={(e) => setFormData({...formData, course_enrolled: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {courses.length === 0 ? (
                      <option value="">No streams registered. Add under Academic Management first.</option>
                    ) : (
                      courses.map(c => (
                        <option key={c.id} value={c.display_label}>{c.display_label}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Full Name</label>
                  <input
                    type="text"
                    placeholder="Mr. Joseph Nnamdi"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({...formData, guardian_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Contact</label>
                  <input
                    type="text"
                    placeholder="+2348030000000"
                    value={formData.guardian_contact}
                    onChange={(e) => setFormData({...formData, guardian_contact: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Medical History / Allergies</label>
                <textarea
                  placeholder="History of mild seasonal asthma. Allergies: Penicillin"
                  value={formData.medical_history}
                  onChange={(e) => setFormData({...formData, medical_history: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
