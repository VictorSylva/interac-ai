import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, User, Activity, Clock, ShieldAlert, Heart, Plaster, Sparkles, CheckCircle2 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EMR({ orgId }) {
  const [emrs, setEmrs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, [orgId]);

  useEffect(() => {
    if (selectedPatientId) {
      fetchEMRs();
    }
  }, [selectedPatientId]);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data || []);
        if (data.length > 0) {
          setSelectedPatientId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading patients:", e);
    }
  };

  const fetchEMRs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/emr?org_id=${encodeURIComponent(orgId)}&patient_id=${encodeURIComponent(selectedPatientId)}`);
      if (res.ok) {
        const data = await res.json();
        setEmrs(data || []);
      }
    } catch (e) {
      console.error("Error loading EMRs:", e);
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <FileText className="w-4 h-4" /> clinical records
          </div>
          <h2 className="text-3xl font-extrabold text-white">Electronic Medical Records (EMR)</h2>
          <p className="text-slate-400 mt-1">Review longitudinal patient timelines, consultation briefings, and vitals trend metrics.</p>
        </div>

        {/* Patient Picker */}
        <div className="w-full sm:w-72">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Active Patient</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.display_label} ({p.attributes?.patient_id})</option>
            ))}
          </select>
        </div>
      </div>

      {selectedPatient ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Patient quick details */}
          <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-6 h-fit">
            <div className="text-center pb-6 border-b border-white/10">
              <img
                src={selectedPatient.attributes?.photo_url}
                alt="Patient Avatar"
                className="w-24 h-24 rounded-3xl bg-white/10 border border-white/10 mx-auto shadow-md"
              />
              <h3 className="text-xl font-bold text-white mt-3">{selectedPatient.display_label}</h3>
              <span className="text-xs font-mono text-rose-300 mt-1 block">{selectedPatient.attributes?.patient_id}</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Allergies:</span>
                <span className="text-amber-400 font-bold">
                  {selectedPatient.attributes?.allergies?.join(', ') || 'No known allergies'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">HMO Provider:</span>
                <span className="text-white font-medium">{selectedPatient.attributes?.insurance_provider || 'Self-Pay'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Emergency contact:</span>
                <span className="text-white">{selectedPatient.attributes?.emergency_contact || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chronic history:</span>
                <span className="text-white text-right max-w-[150px] truncate block" title={selectedPatient.attributes?.medical_history}>
                  {selectedPatient.attributes?.medical_history || 'None declared'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: EMR Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-3xl border border-white/10 p-6 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-400" /> Longitudinal Clinical Timeline
              </h3>

              {loading ? (
                <div className="py-12 text-center text-slate-500">Loading timeline...</div>
              ) : emrs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 italic">No medical records indexed for this patient.</div>
              ) : (
                <div className="relative border-l border-white/10 ml-4 pl-6 space-y-6">
                  {emrs.map(emr => (
                    <div key={emr.id} className="relative group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-navy group-hover:scale-125 transition-transform" />
                      
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-bold text-white">{emr.attributes?.diagnoses}</h4>
                            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(emr.attributes?.recorded_at).toLocaleString()} | Attending: {emr.attributes?.doctor_name}
                            </span>
                          </div>
                        </div>

                        {/* Clinic Notes */}
                        <div className="text-xs text-slate-300 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                          <strong>Consultation Notes:</strong> <br />
                          {emr.attributes?.notes || 'No active consultation notes recorded.'}
                        </div>

                        {/* Vitals Summary */}
                        {emr.attributes?.vitals && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Blood Pressure</span>
                              <span className="text-xs font-bold text-white mt-0.5 block">
                                {emr.attributes.vitals.systolic}/{emr.attributes.vitals.diastolic} mmHg
                              </span>
                            </div>
                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Heart Rate</span>
                              <span className="text-xs font-bold text-white mt-0.5 block">{emr.attributes.vitals.heart_rate} bpm</span>
                            </div>
                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">SpO2</span>
                              <span className="text-xs font-bold text-emerald-400 mt-0.5 block">{emr.attributes.vitals.spo2}%</span>
                            </div>
                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Temp</span>
                              <span className="text-xs font-bold text-white mt-0.5 block">{emr.attributes.vitals.temperature}°C</span>
                            </div>
                          </div>
                        )}

                        {/* Orders Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                          {emr.attributes?.prescriptions?.length > 0 && (
                            <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl">
                              <strong className="text-rose-300 block mb-1">Prescriptions:</strong>
                              <ul className="list-disc pl-3.5 space-y-0.5 text-slate-300">
                                {emr.attributes.prescriptions.map((p, i) => <li key={i}>{p.drug} - {p.dosage}</li>)}
                              </ul>
                            </div>
                          )}
                          {emr.attributes?.lab_requests?.length > 0 && (
                            <div className="bg-cyan-500/5 border border-cyan-500/10 p-3 rounded-xl">
                              <strong className="text-cyan-300 block mb-1">Lab Orders:</strong>
                              <span className="text-slate-300 font-medium block">{emr.attributes.lab_requests.join(', ')}</span>
                            </div>
                          )}
                          {emr.attributes?.radiology_requests?.length > 0 && (
                            <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl">
                              <strong className="text-indigo-300 block mb-1">Imaging Orders:</strong>
                              <span className="text-slate-300 font-medium block">{emr.attributes.radiology_requests.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/10 p-12 text-center text-slate-500">
          No patients registered to display medical records for.
        </div>
      )}
    </div>
  );
}
