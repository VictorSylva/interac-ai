import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, Plus, User, Clock, AlertCircle, Phone, 
  Sparkles, CheckCircle2, MessageSquare, Loader2, ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Appointments({ orgId }) {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  
  const [showBookModal, setShowBookModal] = useState(false);
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    doctor_name: 'Dr. Amina Yusuf',
    scheduled_time: '',
    department: 'General Outpatient',
    visit_type: 'Walk-in'
  });

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, [orgId]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/appointments?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data || []);
      }
    } catch (e) {
      console.error("Error loading appointments:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data || []);
      }
    } catch (e) {
      console.error("Error loading patients:", e);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!form.patient_name) return;
    setSubmitting(true);
    try {
      // Find patient ID if selected from list
      const matchingPatient = patients.find(p => p.display_label === form.patient_name);
      const payload = {
        org_id: orgId,
        patient_id: matchingPatient ? matchingPatient.id : `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
        patient_name: form.patient_name,
        doctor_name: form.doctor_name,
        scheduled_time: form.scheduled_time || new Date().toISOString(),
        department: form.department,
        visit_type: form.visit_type
      };
      
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setForm({
          patient_id: '',
          patient_name: '',
          doctor_name: 'Dr. Amina Yusuf',
          scheduled_time: '',
          department: 'General Outpatient',
          visit_type: 'Walk-in'
        });
        setShowBookModal(false);
        await fetchAppointments();
      } else {
        const err = await res.json();
        alert(err.detail || "Booking failed");
      }
    } catch (e) {
      console.error("Error booking appointment:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async (appt) => {
    setRemindingId(appt.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/appointments/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: appt.attributes?.emergency_contact || '+2348030000000',
          patient_name: appt.attributes?.patient_name
        })
      });
      if (res.ok) {
        alert("WhatsApp & SMS Reminder sent successfully!");
        // Toggle flag locally
        setAppointments(appointments.map(a => 
          a.id === appt.id ? { ...a, attributes: { ...a.attributes, reminders_sent: true } } : a
        ));
      }
    } catch (e) {
      console.error("Reminder dispatch failed:", e);
    } finally {
      setRemindingId(null);
    }
  };

  const activeQueues = appointments.filter(a => a.attributes?.status === 'BOOKED');

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Calendar className="w-4 h-4" /> Operational Scheduling
          </div>
          <h2 className="text-3xl font-extrabold text-white">Doctor Calendars & Triage Queue</h2>
          <p className="text-slate-400 mt-1">Organize doctor rosters, manage walk-in waiting lines, and dispatch patient updates.</p>
        </div>
        <button 
          onClick={() => setShowBookModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      {/* Analytics Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Today's Patients</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">{appointments.length}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">Registered consultations</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">Walk-In Waiting Queue</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">{appointments.filter(a => a.attributes?.visit_type === 'Walk-in').length}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">Awaiting triage call</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Rostered Practitioners</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">4</h3>
          <span className="text-[10px] text-slate-400 block mt-1">Active consultants checked-in</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Reminders Delivered</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">{appointments.filter(a => a.attributes?.reminders_sent).length}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">WhatsApp synchronization</span>
        </div>
      </div>

      {/* Queue Table */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-rose-400" /> Live Triage Waitlist Queue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Rostered Doctor</th>
                <th className="p-4">Clinic Department</th>
                <th className="p-4">Scheduled Slot</th>
                <th className="p-4">Visit Class</th>
                <th className="p-4">Sync Notifications</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td>
                </tr>
              ) : activeQueues.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500 italic">No scheduled patients in queue list.</td>
                </tr>
              ) : (
                activeQueues.map(appt => (
                  <tr key={appt.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white">{appt.attributes?.patient_name}</td>
                    <td className="p-4 font-medium text-slate-300">{appt.attributes?.doctor_name}</td>
                    <td className="p-4 text-slate-400">{appt.attributes?.department}</td>
                    <td className="p-4 font-mono text-rose-300">{new Date(appt.attributes?.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        appt.attributes?.visit_type === 'Emergency'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : appt.attributes?.visit_type === 'Scheduled'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {appt.attributes?.visit_type}
                      </span>
                    </td>
                    <td className="p-4">
                      {appt.attributes?.reminders_sent ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sent (WhatsApp)</span>
                      ) : (
                        <button
                          onClick={() => handleSendReminder(appt)}
                          disabled={remindingId === appt.id}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-bold text-[10px] flex items-center gap-1 transition-all"
                        >
                          {remindingId === appt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                          Trigger Sync
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-rose-400 font-bold text-xs uppercase tracking-wider">Awaiting Call</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-rose-400" /> Book Patient Consultation Slot</h3>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleBook} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={form.patient_name}
                  onChange={(e) => setForm({...form, patient_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Registered Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.display_label}>{p.display_label} ({p.attributes?.patient_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assign Medical Officer</label>
                  <select
                    value={form.doctor_name}
                    onChange={(e) => setForm({...form, doctor_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="Dr. Amina Yusuf">Dr. Amina Yusuf (Cardiology)</option>
                    <option value="Dr. Chidi Obi">Dr. Chidi Obi (Pediatrics)</option>
                    <option value="Dr. James Balogun">Dr. James Balogun (GP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Clinic Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({...form, department: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="General Outpatient">General Outpatient</option>
                    <option value="Pediatrics Clinic">Pediatrics Clinic</option>
                    <option value="Cardiology Unit">Cardiology Unit</option>
                    <option value="Emergency Department">Emergency Room (ER)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Scheduled Slot Time</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_time}
                    onChange={(e) => setForm({...form, scheduled_time: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Class / Visit Class</label>
                  <select
                    value={form.visit_type}
                    onChange={(e) => setForm({...form, visit_type: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="Walk-in">Walk-in Triage Queue</option>
                    <option value="Scheduled">Pre-Booked Appointment</option>
                    <option value="Emergency">Urgent ER Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
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
                  Assign Slot ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
