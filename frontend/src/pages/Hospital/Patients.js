import React, { useState, useEffect } from 'react';
import { 
  Heart, Search, Plus, User, FileText, Activity, Shield, Phone, 
  Camera, QrCode, ArrowRight, Loader2, AlertCircle, Trash2, CheckCircle2 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Patients({ orgId }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Registration Form
  const [showRegModal, setShowRegModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    national_id: '',
    insurance_provider: '',
    insurance_policy: '',
    emergency_contact: '',
    medical_history: '',
    allergies: ''
  });

  useEffect(() => {
    fetchPatients();
  }, [orgId]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data || []);
        if (data.length > 0 && !selectedPatient) {
          setSelectedPatient(data[0]);
        }
      }
    } catch (e) {
      console.error("Error loading patients:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSubmitting(true);
    try {
      const payload = {
        org_id: orgId,
        name: form.name,
        national_id: form.national_id,
        insurance_provider: form.insurance_provider,
        insurance_policy: form.insurance_policy,
        emergency_contact: form.emergency_contact,
        medical_history: form.medical_history,
        allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()) : []
      };
      
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setForm({
          name: '',
          national_id: '',
          insurance_provider: '',
          insurance_policy: '',
          emergency_contact: '',
          medical_history: '',
          allergies: ''
        });
        setShowRegModal(false);
        await fetchPatients();
      } else {
        const err = await res.json();
        alert(err.detail || "Registration failed");
      }
    } catch (e) {
      console.error("Error creating patient:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.attributes?.patient_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.attributes?.national_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Heart className="w-4 h-4" /> Hospital Information System (HIS)
          </div>
          <h2 className="text-3xl font-extrabold text-white">Patient Registry & Intake</h2>
          <p className="text-slate-400 mt-1">Register new admissions, review insurance validations, and generate clinical barcodes.</p>
        </div>
        <button 
          onClick={() => setShowRegModal(true)} 
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" /> Register Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Patient List */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-4 h-[calc(100vh-220px)] flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or SSN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">No patients registered.</div>
            ) : (
              filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                    selectedPatient?.id === p.id
                      ? 'bg-rose-500/10 border-rose-500/30 shadow-lg'
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <img
                    src={p.attributes?.photo_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.display_label}`}
                    alt="Patient avatar"
                    className="w-10 h-10 rounded-full bg-white/10 border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{p.display_label}</h4>
                    <span className="text-[10px] font-mono text-rose-300 block">{p.attributes?.patient_id}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Patient Details Card */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPatient ? (
            <div className="glass rounded-3xl border border-white/10 p-8 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedPatient.attributes?.photo_url}
                    alt="Patient visual avatar"
                    className="w-20 h-20 rounded-2xl bg-white/10 border border-white/10 shadow-inner"
                  />
                  <div>
                    <h3 className="text-2xl font-black text-white">{selectedPatient.display_label}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 uppercase tracking-wider">
                        {selectedPatient.attributes?.triage_level || 'Normal'} Priority
                      </span>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-slate-400" /> {selectedPatient.attributes?.qr_code_ref}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 text-center w-full sm:w-auto">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Patient File ID</span>
                  <span className="text-sm font-mono font-bold text-rose-300 mt-0.5 block">{selectedPatient.attributes?.patient_id}</span>
                </div>
              </div>

              {/* Bio Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><User className="w-4 h-4 text-rose-400" /> General Identification</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">National ID / NIN:</span><span className="text-white font-mono">{selectedPatient.attributes?.national_id || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Registered:</span><span className="text-white">{new Date(selectedPatient.attributes?.registered_at).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Emergency Phone:</span><span className="text-white flex items-center gap-1"><Phone className="w-3 h-3 text-rose-400" /> {selectedPatient.attributes?.emergency_contact || 'N/A'}</span></div>
                  </div>
                </div>

                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Shield className="w-4 h-4 text-rose-400" /> Insurance Coverage</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">HMO Provider:</span><span className="text-white font-bold">{selectedPatient.attributes?.insurance_provider || 'Self-Pay (No HMO)'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Policy No:</span><span className="text-white font-mono">{selectedPatient.attributes?.insurance_policy || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Verification Status:</span><span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE</span></div>
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <FileText className="w-5 h-5 text-rose-400" />
                  <h4 className="text-sm font-bold text-white">Clinical Medical History</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">ALLERGIES</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.attributes?.allergies?.length > 0 ? (
                        selectedPatient.attributes.allergies.map((a, i) => (
                          <span key={i} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">{a}</span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No allergies registered.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">CHRONIC CONDITIONS & SURGICAL HISTORY</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-black/20 p-3.5 rounded-xl border border-white/5 font-medium">
                      {selectedPatient.attributes?.medical_history || 'No chronic issues or previous procedures declared.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl border border-white/10 p-12 text-center text-slate-500 text-xs">
              <Heart className="w-12 h-12 text-rose-500/20 mx-auto mb-4" /> Select or register a patient profile to review their complete clinical EMR dossier.
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-xl rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Heart className="w-5 h-5 text-rose-400" /> Patient Intake Registration</h3>
              <button onClick={() => setShowRegModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="John Doe"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">National ID / NIN</label>
                  <input
                    type="text"
                    value={form.national_id}
                    onChange={(e) => setForm({...form, national_id: e.target.value})}
                    placeholder="NIN-990141"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Insurance Provider</label>
                  <input
                    type="text"
                    value={form.insurance_provider}
                    onChange={(e) => setForm({...form, insurance_provider: e.target.value})}
                    placeholder="AXA Mansard"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Policy Number</label>
                  <input
                    type="text"
                    value={form.insurance_policy}
                    onChange={(e) => setForm({...form, insurance_policy: e.target.value})}
                    placeholder="POL-88901"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Emergency Contact</label>
                  <input
                    type="text"
                    value={form.emergency_contact}
                    onChange={(e) => setForm({...form, emergency_contact: e.target.value})}
                    placeholder="+234803000111"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Drug Allergies (Comma separated)</label>
                <input
                  type="text"
                  value={form.allergies}
                  onChange={(e) => setForm({...form, allergies: e.target.value})}
                  placeholder="Penicillin, Sulfa, Peanuts"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Chronic History & Symptoms</label>
                <textarea
                  value={form.medical_history}
                  onChange={(e) => setForm({...form, medical_history: e.target.value})}
                  placeholder="History of hypertension, Type 2 diabetes diagnosed in 2024..."
                  rows="3"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                ></textarea>
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Complete Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
