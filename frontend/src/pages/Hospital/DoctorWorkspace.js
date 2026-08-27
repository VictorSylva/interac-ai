import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Search, Plus, User, FileText, Activity, Shield, Phone, 
  Sparkles, CheckCircle2, ChevronRight, Loader2, Play, AlertCircle, Heart, Key, Settings
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function DoctorWorkspace({ orgId }) {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  // Clinical notes forms
  const [diagnoses, setDiagnoses] = useState('');
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState({ systolic: 120, diastolic: 80, heart_rate: 75, temperature: 36.8, spo2: 98 });
  const [drugPrescriptions, setDrugPrescriptions] = useState([{ drug: '', dosage: '' }]);
  const [labOrders, setLabOrders] = useState([]);
  const [radioOrders, setRadioOrders] = useState([]);

  useEffect(() => {
    fetchQueue();
  }, [orgId]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/appointments?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data || []);
        if (data.length > 0 && !selectedAppt) {
          setSelectedAppt(data[0]);
        }
      }
    } catch (e) {
      console.error("Error loading doctor queue:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAICopilot = async () => {
    if (!selectedAppt) return;
    setAiLoading(true);
    setAiSummary('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: "module_hospital:summarize_patient_history",
          params: { patient_id: selectedAppt.attributes?.patient_id }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.result?.summary || 'Unable to generate patient brief.');
      }
    } catch (e) {
      console.error("AI Skill failed:", e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitConsultation = async (e) => {
    e.preventDefault();
    if (!selectedAppt) return;
    setSubmitting(true);
    try {
      // 1. Create EMR Record
      const payload = {
        org_id: orgId,
        patient_id: selectedAppt.attributes?.patient_id || selectedAppt.id,
        patient_name: selectedAppt.attributes?.patient_name,
        diagnoses,
        notes,
        vitals,
        prescriptions: drugPrescriptions.filter(d => d.drug && d.dosage),
        lab_requests: labOrders,
        radiology_requests: radioOrders
      };
      
      const emrRes = await fetch(`${API_BASE_URL}/api/v1/hospital/emr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (emrRes.ok) {
        // 2. Create billing charges for consultation and ordered tests
        const billingItems = [
          {"desc": "General Clinical Consultation Fee", "price": 10000.0}
        ];
        labOrders.forEach(l => billingItems.push({"desc": `Laboratory Test Order - ${l}`, "price": 8000.0}));
        radioOrders.forEach(r => billingItems.push({"desc": `Radiology Scan Order - ${r}`, "price": 18000.0}));
        
        await fetch(`${API_BASE_URL}/api/v1/hospital/billing/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: orgId,
            patient_id: selectedAppt.attributes?.patient_id,
            patient_name: selectedAppt.attributes?.patient_name,
            items: billingItems
          })
        });

        // 3. Create lab tests requests in laboratory
        for (const l of labOrders) {
          await fetch(`${API_BASE_URL}/api/v1/hospital/laboratory/tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: orgId,
              patient_id: selectedAppt.attributes?.patient_id,
              patient_name: selectedAppt.attributes?.patient_name,
              test_type: l
            })
          });
        }

        // 4. Create radiology scans requests in radiology
        for (const r of radioOrders) {
          await fetch(`${API_BASE_URL}/api/v1/hospital/radiology/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: orgId,
              patient_id: selectedAppt.attributes?.patient_id,
              patient_name: selectedAppt.attributes?.patient_name,
              imaging_type: r
            })
          });
        }

        // Clear forms
        setDiagnoses('');
        setNotes('');
        setDrugPrescriptions([{ drug: '', dosage: '' }]);
        setLabOrders([]);
        setRadioOrders([]);
        alert("Clinical EMR consultation completed successfully. Orders dispatched to Pharmacy, Lab, and Billing.");
        await fetchQueue();
      }
    } catch (e) {
      console.error("Consultation submission error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDrug = () => setDrugPrescriptions([...drugPrescriptions, { drug: '', dosage: '' }]);
  
  const handleToggleLab = (test) => {
    if (labOrders.includes(test)) {
      setLabOrders(labOrders.filter(t => t !== test));
    } else {
      setLabOrders([...labOrders, test]);
    }
  };

  const handleToggleRadio = (scan) => {
    if (radioOrders.includes(scan)) {
      setRadioOrders(radioOrders.filter(s => s !== scan));
    } else {
      setRadioOrders([...radioOrders, scan]);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <UserCheck className="w-4 h-4" /> CLINICAL WORKSPACE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Practitioner Workspace</h2>
          <p className="text-slate-400 mt-1">Review active triage lists, draft clinical reports, order tests, and utilize AI diagnostic briefs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Patient Queue List */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-5 space-y-4 h-[calc(100vh-200px)] flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Patient Queue</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>
            ) : appointments.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">No queue for today.</div>
            ) : (
              appointments.map(appt => (
                <button
                  key={appt.id}
                  onClick={() => setSelectedAppt(appt)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    selectedAppt?.id === appt.id
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{appt.attributes?.patient_name}</h4>
                    <span className="text-[10px] font-mono text-rose-300">{appt.attributes?.patient_id}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Clinical Notes Intake form */}
        <div className="lg:col-span-3 space-y-6">
          {selectedAppt ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column: Form Editor */}
              <div className="xl:col-span-2 glass rounded-3xl border border-white/10 p-6 space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedAppt.attributes?.patient_name}</h3>
                    <span className="text-xs text-rose-300 font-mono">{selectedAppt.attributes?.patient_id}</span>
                  </div>
                  <button
                    onClick={handleRunAICopilot}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600/30 text-purple-200 text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 hover:bg-purple-600/40 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" /> AI Patient Summary Briefing
                  </button>
                </div>

                <form onSubmit={handleSubmitConsultation} className="space-y-6">
                  {/* Vitals */}
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Activity className="w-4 h-4 text-rose-400" /> Record Vitals</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Sys BP (mmHg)</label>
                        <input type="number" value={vitals.systolic} onChange={(e)=>setVitals({...vitals, systolic: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Dia BP (mmHg)</label>
                        <input type="number" value={vitals.diastolic} onChange={(e)=>setVitals({...vitals, diastolic: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Heart Rate (bpm)</label>
                        <input type="number" value={vitals.heart_rate} onChange={(e)=>setVitals({...vitals, heart_rate: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Temp (°C)</label>
                        <input type="number" step="0.1" value={vitals.temperature} onChange={(e)=>setVitals({...vitals, temperature: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">SpO2 (%)</label>
                        <input type="number" value={vitals.spo2} onChange={(e)=>setVitals({...vitals, spo2: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Diagnoses & Notes */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Diagnosis</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acute Malaria, Hypertension Stage II"
                        value={diagnoses}
                        onChange={(e)=>setDiagnoses(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Consultation Notes</label>
                      <textarea
                        required
                        placeholder="Patient presented with complaints of headache, high-grade fever, and body aches for 3 days..."
                        value={notes}
                        onChange={(e)=>setNotes(e.target.value)}
                        rows="4"
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                      ></textarea>
                    </div>
                  </div>

                  {/* Drug Prescriptions */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prescribe Medications</label>
                      <button type="button" onClick={handleAddDrug} className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Drug</button>
                    </div>
                    <div className="space-y-2">
                      {drugPrescriptions.map((pres, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Drug name (e.g. Amoxicillin 500mg)"
                            value={pres.drug}
                            onChange={(e) => {
                              const list = [...drugPrescriptions];
                              list[idx].drug = e.target.value;
                              setDrugPrescriptions(list);
                            }}
                            className="bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                          />
                          <input
                            type="text"
                            placeholder="Dosage instruction (e.g. 1 cap 3x daily x 5 days)"
                            value={pres.dosage}
                            onChange={(e) => {
                              const list = [...drugPrescriptions];
                              list[idx].dosage = e.target.value;
                              setDrugPrescriptions(list);
                            }}
                            className="bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Dispatch Clinical Orders & Close File
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: AI Briefing & Diagnostics Order Lists */}
              <div className="space-y-6">
                {/* AI Brief Box */}
                {aiLoading || aiSummary ? (
                  <div className="glass rounded-3xl border border-purple-500/30 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-4 h-4 animate-pulse" /> Copilot EMR Brief</h4>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-xs text-purple-200"><Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Analyzing EMR history...</div>
                    ) : (
                      <p className="text-xs text-purple-200 leading-relaxed font-medium bg-purple-950/20 p-3 rounded-xl border border-purple-500/10">{aiSummary}</p>
                    )}
                  </div>
                ) : null}

                {/* Diagnostics Checklists */}
                <div className="glass rounded-3xl border border-white/10 p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Laboratory Diagnostic Tests</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['Full Blood Count', 'Blood Culture', 'Fasting Blood Sugar', 'Urinalysis', 'Widal Test', 'Lipid Profile'].map(test => (
                      <button
                        key={test}
                        type="button"
                        onClick={() => handleToggleLab(test)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          labOrders.includes(test)
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 font-bold'
                            : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {test}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-3xl border border-white/10 p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Radiology Imaging Scans</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['Chest X-Ray', 'Abdominal UltraSound', 'Brain CT Scan', 'MRI Knee Joint', 'Pelvic UltraSound'].map(scan => (
                      <button
                        key={scan}
                        type="button"
                        onClick={() => handleToggleRadio(scan)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          radioOrders.includes(scan)
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 font-bold'
                            : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {scan}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl border border-white/10 p-12 text-center text-slate-500">
              No patients checked-in today.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
