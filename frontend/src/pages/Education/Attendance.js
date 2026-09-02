import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Search, Loader2, Sparkles, AlertCircle, Smartphone, Camera, Zap } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduAttendancePage({ orgId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [manualDate, setManualDate] = useState(new Date().toISOString().substring(0, 10));
  const [attendanceStates, setAttendanceStates] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    person_id: 'EDU-STUD-5541',
    name: 'Daniel Nnamdi',
    role: 'student',
    method: 'Biometric',
    status: 'Present'
  });

  useEffect(() => {
    fetchLogs();
    fetchStudents();
  }, [orgId]);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
        const initial = {};
        data.forEach(s => {
          const sId = s.attributes?.student_id || s.id;
          initial[sId] = 'Present';
        });
        setAttendanceStates(initial);
        if (data && data.length > 0) {
          const firstId = data[0].attributes?.student_id || data[0].id;
          setFormData(prev => ({
            ...prev,
            person_id: firstId,
            name: data[0].display_label
          }));
        }
      }
    } catch (e) {
      console.error("Error loading students:", e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/attendance/logs?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCheckin = async (methodOverride = null) => {
    setSubmitting(true);
    try {
      const activeMethod = methodOverride || formData.method;
      const res = await fetch(`${API_BASE_URL}/api/v1/education/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          person_id: formData.person_id,
          name: formData.name,
          role: formData.role,
          method: activeMethod,
          status: formData.status
        })
      });
      if (res.ok) {
        fetchLogs();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitManualAttendance = async () => {
    setSubmitting(true);
    try {
      const promises = students.map(s => {
        const sId = s.attributes?.student_id || s.id;
        const status = attendanceStates[sId] || 'Present';
        return fetch(`${API_BASE_URL}/api/v1/education/attendance/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: orgId,
            person_id: sId,
            name: s.display_label,
            role: 'student',
            method: 'Manual Register',
            status: status,
            timestamp: new Date(manualDate).toISOString()
          })
        });
      });
      await Promise.all(promises);
      alert("Manual attendance registry filed successfully!");
      fetchLogs();
      setActiveTab('timeline');
    } catch (e) {
      console.error(e);
      alert("Failed to submit manual attendance.");
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
            <CheckSquare className="w-4 h-4" /> ATTENDANCE TRACKER
          </div>
          <h2 className="text-3xl font-extrabold text-white">Campus & Classroom Attendance</h2>
          <p className="text-slate-400 mt-1">Monitor RFID gate cards, biometric fingerprint logs, CCTV face recognition match, and GPS bus telemetry.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Check-in Logs or Manual Register */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-2">
              <h3 className="text-lg font-bold text-white">Attendance Registry</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'timeline'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                  }`}
                >
                  Real-Time Logs
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'manual'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                  }`}
                >
                  Manual Filing (Teacher)
                </button>
              </div>
            </div>

            {activeTab === 'timeline' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">ID</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {loading ? (
                      <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto" /></td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No attendance logs found for today.</td></tr>
                    ) : logs.map(log => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-white">{log.display_label}</td>
                        <td className="p-4 font-mono text-cyan-300">{log.attributes?.person_id}</td>
                        <td className="p-4 uppercase text-[10px] text-slate-400 font-bold">{log.attributes?.role}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[9px] bg-white/5 border border-white/10 font-mono">{log.attributes?.method}</span>
                        </td>
                        <td className="p-4">
                          <span className={`font-bold ${log.attributes?.status === 'Present' ? 'text-green-400' : log.attributes?.status === 'Late' ? 'text-amber-400' : 'text-rose-400'}`}>
                            ● {log.attributes?.status || 'Present'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-mono">{log.attributes?.timestamp ? new Date(log.attributes.timestamp).toLocaleTimeString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'manual' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-slate-400">
                    Select active date for manual register submission:
                  </div>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                      <tr>
                        <th className="p-4">Student Name</th>
                        <th className="p-4">Matric ID</th>
                        <th className="p-4">Status Check-in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="p-8 text-center text-slate-500 italic">
                            No students registered under Student Directory.
                          </td>
                        </tr>
                      ) : (
                        students.map(s => {
                          const sId = s.attributes?.student_id || s.id;
                          const currentVal = attendanceStates[sId] || 'Present';
                          return (
                            <tr key={sId} className="hover:bg-white/5">
                              <td className="p-4 font-bold text-white">{s.display_label}</td>
                              <td className="p-4 font-mono text-cyan-300">{sId}</td>
                              <td className="p-4 flex gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status_${sId}`}
                                    value="Present"
                                    checked={currentVal === 'Present'}
                                    onChange={() => setAttendanceStates(prev => ({...prev, [sId]: 'Present'}))}
                                    className="accent-cyan-400"
                                  />
                                  <span>Present</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status_${sId}`}
                                    value="Absent"
                                    checked={currentVal === 'Absent'}
                                    onChange={() => setAttendanceStates(prev => ({...prev, [sId]: 'Absent'}))}
                                    className="accent-rose-400"
                                  />
                                  <span className="text-rose-400">Absent</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status_${sId}`}
                                    value="Late"
                                    checked={currentVal === 'Late'}
                                    onChange={() => setAttendanceStates(prev => ({...prev, [sId]: 'Late'}))}
                                    className="accent-amber-400"
                                  />
                                  <span className="text-amber-400">Late</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {students.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSubmitManualAttendance}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save & File Attendance Register
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Simulated Hardware Ingestion */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-4">Hardware Telemetry Simulators</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1.5">Active Target Student/Staff</label>
                <select
                  value={formData.person_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const foundStudent = students.find(s => (s.attributes?.student_id || s.id) === selId);
                    const name = foundStudent ? foundStudent.display_label : 'Daniel Nnamdi';
                    const role = selId.startsWith('EDU-TEACH') ? 'staff' : 'student';
                    setFormData({...formData, person_id: selId, name: name, role: role});
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {students.length === 0 ? (
                    <option value="EDU-STUD-5541">Daniel Nnamdi (Student)</option>
                  ) : (
                    students.map(s => {
                      const sId = s.attributes?.student_id || s.id;
                      return (
                        <option key={sId} value={sId}>{s.display_label} (Student)</option>
                      );
                    })
                  )}
                  <option value="EDU-TEACH-9081">Mrs. Funmi Oshin (Teacher)</option>
                </select>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-2">
                <button
                  onClick={() => handleSimulateCheckin('Biometric')}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-cyan-600/20 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-600/30 transition flex items-center justify-center gap-2 font-bold"
                >
                  <Zap className="w-4 h-4 text-cyan-400" /> Simulate Fingerprint Biometric
                </button>
                <button
                  onClick={() => handleSimulateCheckin('RFID')}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center justify-center gap-2 font-bold"
                >
                  <Smartphone className="w-4 h-4 text-indigo-400" /> Simulate RFID Card Gate Swipe
                </button>
                <button
                  onClick={() => handleSimulateCheckin('Face')}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-purple-600/20 text-purple-200 border border-purple-500/30 hover:bg-purple-600/30 transition flex items-center justify-center gap-2 font-bold"
                >
                  <Camera className="w-4 h-4 text-purple-400" /> Simulate CCTV Face Recognition
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
