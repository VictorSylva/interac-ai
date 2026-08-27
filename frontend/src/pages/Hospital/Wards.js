import React, { useState, useEffect } from 'react';
import { 
  Layers, Search, Plus, User, CheckCircle2, ShieldAlert, Loader2, ArrowRight, Activity 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Wards({ orgId }) {
  const [beds, setBeds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Allocate Bed Modal Form
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [allocForm, setAllocForm] = useState({
    patient_name: ''
  });

  // Predicted Bed demand
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    fetchBeds();
    fetchPatients();
    fetchPredictions();
  }, [orgId]);

  const fetchBeds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/wards/beds?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setBeds(data || []);
      }
    } catch (e) {
      console.error("Error loading ward beds:", e);
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

  const fetchPredictions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/wards/predict-occupancy?org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.days_forecast || []);
      }
    } catch (e) {
      console.error("Error loading predictions:", e);
    }
  };

  const handleOpenAllocate = (bed) => {
    setSelectedBed(bed);
    setAllocForm({ patient_name: bed.attributes?.patient_name || '' });
    setShowAllocModal(true);
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBed) return;
    setSubmitting(true);
    try {
      const patient = patients.find(p => p.display_label === allocForm.patient_name);
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/wards/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          bed_id: selectedBed.id,
          patient_id: patient ? patient.id : '',
          patient_name: allocForm.patient_name
        })
      });

      if (res.ok) {
        setShowAllocModal(false);
        await fetchBeds();
      }
    } catch (e) {
      console.error("Allocate bed error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bedId, status) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/hospital/wards/beds/${bedId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, status })
      });
      await fetchBeds();
    } catch (e) {
      console.error("Update bed status failed:", e);
    }
  };

  const occupiedCount = beds.filter(b => b.attributes?.status === 'OCCUPIED').length;
  const vacantCount = beds.filter(b => b.attributes?.status === 'VACANT').length;
  const dirtyCount = beds.filter(b => b.attributes?.status === 'DIRTY').length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Layers className="w-4 h-4" /> WARD OPERATIONS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Interactive Ward Bed Occupancy</h2>
          <p className="text-slate-400 mt-1">Review live bed grid charts, assign patients to Step-Down/ICU, and trigger room sanitizations.</p>
        </div>
      </div>

      {/* Ward Occupancy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Hospital Beds</span>
          <h3 className="text-2xl font-black text-white mt-1">{beds.length}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">ICU & general rosters combined</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-rose-400 font-bold uppercase block">Occupied Beds</span>
          <h3 className="text-2xl font-black text-rose-400 mt-1">{occupiedCount}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">Active admitted patients</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-emerald-400 font-bold uppercase block">Available Vacant Beds</span>
          <h3 className="text-2xl font-black text-emerald-400 mt-1">{vacantCount}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">Ready for intake routing</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-amber-400 font-bold uppercase block">Dirty / Cleaning Pending</span>
          <h3 className="text-2xl font-black text-amber-400 mt-1">{dirtyCount}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">Sanitization task dispatched</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Bed Visual Matrix Grid */}
        <div className="lg:col-span-2 glass rounded-3xl border border-white/10 p-6 space-y-6">
          <h3 className="text-lg font-bold text-white">Live Ward bed Allocations</h3>
          
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {beds.map(bed => {
                const status = bed.attributes?.status;
                const isOccupied = status === 'OCCUPIED';
                const isDirty = status === 'DIRTY';
                
                return (
                  <div
                    key={bed.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                      isOccupied
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : isDirty
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white font-mono">{bed.attributes?.bed_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          isOccupied 
                            ? 'bg-rose-500/20 text-rose-300' 
                            : isDirty 
                              ? 'bg-amber-500/20 text-amber-300' 
                              : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-3.5">
                        {isOccupied ? bed.attributes?.patient_name : 'Vacant Bed'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">{bed.attributes?.ward}</p>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleOpenAllocate(bed)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600/30 text-rose-200 text-[10px] font-bold border border-rose-500/20"
                      >
                        {isOccupied ? 'Discharge' : 'Admit'}
                      </button>
                      {isDirty && (
                        <button
                          onClick={() => handleUpdateStatus(bed.id, 'VACANT')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-200 text-[10px] font-bold border border-emerald-500/20"
                        >
                          Cleaned
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Bed occupancy prediction */}
        <div className="lg:col-span-1 glass rounded-3xl border border-white/10 p-6 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5"><Activity className="w-5 h-5 text-rose-400" /> Occupancy Forecast</h3>
          <div className="space-y-4">
            {predictions.map((p, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block font-bold">{p.day}</span>
                  <span className="text-slate-500 block mt-0.5">Need: {p.beds_needed} beds</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-rose-300 font-mono">{p.expected_occupancy}</span>
                  <span className="text-[9px] text-slate-500 block">estimated occupancy</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Allocate Bed Modal */}
      {showAllocModal && selectedBed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-rose-400" /> Allocate Ward Bed</h3>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleAllocateSubmit} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300 space-y-1">
                <div>Ward Bed ID: <strong className="text-white">{selectedBed.attributes?.bed_number}</strong></div>
                <div>Block: <strong className="text-white">{selectedBed.attributes?.ward}</strong></div>
              </div>

              {selectedBed.attributes?.status === 'OCCUPIED' ? (
                <div className="p-4 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    Are you sure you want to discharge patient <strong>{selectedBed.attributes?.patient_name}</strong>? This de-allocates the bed immediately and flags it as DIRTY.
                  </p>
                  <input type="hidden" value="" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient for Bed Admission</label>
                  <select
                    required
                    value={allocForm.patient_name}
                    onChange={(e) => setAllocForm({...allocForm, patient_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="">-- Choose Admitted Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.display_label}>{p.display_label} ({p.attributes?.patient_id})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAllocModal(false)}
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
                  {selectedBed.attributes?.status === 'OCCUPIED' ? 'Confirm Discharge' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
