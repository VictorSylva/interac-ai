import React, { useState, useEffect } from 'react';
import { UserPlus, Plus, Search, Loader2, Sparkles, Check, X, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduAdmissionsPage({ orgId }) {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Application Form
  const [showAppModal, setShowAppModal] = useState(false);
  const [formData, setFormData] = useState({
    applicant_name: '',
    exam_score: 85,
    status: 'PENDING_EXAM',
    interview_notes: 'Highly motivated applicant.'
  });

  // AI Forecast
  const [forecast, setForecast] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  useEffect(() => {
    fetchAdmissions();
  }, [orgId]);

  const fetchAdmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/admissions?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAdmissions(data || []);
      }
    } catch (e) {
      console.error("Error loading admissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAppSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/admissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowAppModal(false);
        setFormData({ applicant_name: '', exam_score: 85, status: 'PENDING_EXAM', interview_notes: 'Highly motivated.' });
        fetchAdmissions();
      }
    } catch (e) {
      console.error("Admission log error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/admissions/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, admission_id: id })
      });
      if (res.ok) {
        fetchAdmissions();
      }
    } catch (e) {
      console.error("Approval error:", e);
    }
  };

  const runEnrollmentForecast = async () => {
    setRunningAI(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:forecast_enrollment',
          params: { org_id: orgId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setForecast(data.result);
      }
    } catch (e) {
      console.error("Enrollment forecast error:", e);
    } finally {
      setRunningAI(false);
    }
  };

  const filtered = admissions.filter(a =>
    a.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.attributes?.application_id && a.attributes.application_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
            <UserPlus className="w-4 h-4" /> ADMISSIONS DESK
          </div>
          <h2 className="text-3xl font-extrabold text-white">Student Admissions & Enrollment</h2>
          <p className="text-slate-400 mt-1">Track applicant lists, schedule entrance examinations, log interview scores, and approve student admissions.</p>
        </div>
        <button
          onClick={() => setShowAppModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Log Application File
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Applicants List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold text-white">Admission Registry</h3>
              <input
                type="text"
                placeholder="Search applicants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none w-full sm:w-64 focus:border-indigo-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Applicant Name</th>
                    <th className="p-4">Application ID</th>
                    <th className="p-4">Exam Score</th>
                    <th className="p-4">Interview Notes</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 italic">
                        No applications logged. Click Log Application to start.
                      </td>
                    </tr>
                  ) : filtered.map(a => (
                    <tr key={a.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{a.display_label}</td>
                      <td className="p-4 font-mono text-indigo-300">{a.attributes?.application_id}</td>
                      <td className="p-4 font-mono">{a.attributes?.exam_score}%</td>
                      <td className="p-4 text-slate-400 truncate max-w-[150px]">{a.attributes?.interview_notes}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          a.attributes?.status === 'ACCEPTED' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {a.attributes?.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {a.attributes?.status !== 'ACCEPTED' && (
                          <button
                            onClick={() => handleApprove(a.id)}
                            className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold transition"
                          >
                            Approve Admission
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Forecast */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-indigo-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" /> AI Enrollment Forecasting
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Predicts future applicant volumes, target capacity limits per stream, and classroom space utilization.
            </p>
            <button
              onClick={runEnrollmentForecast}
              disabled={runningAI}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {runningAI && <Loader2 className="w-4 h-4 animate-spin" />}
              {runningAI ? 'Projecting Data...' : 'Forecast Next Term Registration'}
            </button>

            {forecast && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-indigo-500/20 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Current Enrollment:</span>
                  <span className="font-bold text-white font-mono">{forecast.current_enrollment}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Next Term Projection:</span>
                  <span className="font-bold text-indigo-300 font-mono">{forecast.next_term_projection}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                  <span className="text-slate-400">Growth rate:</span>
                  <span className="font-bold text-green-400 font-mono">{forecast.growth_rate}</span>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Stream capacity flags:</div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Science streams:</span>
                    <span>{forecast.capacity_limits?.['Science stream']}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Art streams:</span>
                    <span>{forecast.capacity_limits?.['Art stream']}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Application Modal */}
      {showAppModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-indigo-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-indigo-950/20 px-6 py-4 border-b border-indigo-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-indigo-400" /> Log Application</h3>
              <button onClick={() => setShowAppModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAppSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Applicant Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Kassim Bello"
                  value={formData.applicant_name}
                  onChange={(e) => setFormData({...formData, applicant_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Entrance Exam Score (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.exam_score}
                    onChange={(e) => setFormData({...formData, exam_score: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Application State</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PENDING_EXAM">PENDING_EXAM</option>
                    <option value="WAITLIST">WAITLIST</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Interview notes</label>
                <textarea
                  placeholder="Strong communication skills. Passes mathematical evaluation."
                  value={formData.interview_notes}
                  onChange={(e) => setFormData({...formData, interview_notes: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 h-24"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAppModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
