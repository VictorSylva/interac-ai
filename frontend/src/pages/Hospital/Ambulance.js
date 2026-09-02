import React, { useState, useEffect } from 'react';
import { 
  Navigation, Search, Plus, MapPin, CheckCircle2, ShieldAlert, Loader2, Clock, AlertTriangle 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Ambulance({ orgId }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Dispatch Modal Form
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    incident_location: '',
    notes: ''
  });

  useEffect(() => {
    fetchVehicles();
  }, [orgId]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/ambulance/vehicles?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data || []);
      }
    } catch (e) {
      console.error("Error loading ambulances:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispatch = (veh) => {
    setSelectedVehicle(veh);
    setDispatchForm({ incident_location: '', notes: '' });
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/ambulance/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          vehicle_id: selectedVehicle.id,
          incident_location: dispatchForm.incident_location,
          notes: dispatchForm.notes
        })
      });

      if (res.ok) {
        setShowDispatchModal(false);
        await fetchVehicles();
      }
    } catch (e) {
      console.error("Dispatch ambulance error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnToBay = async (vehId) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/hospital/ambulance/vehicles/${vehId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, status: 'AVAILABLE', incident_location: '', notes: '' })
      });
      await fetchVehicles();
    } catch (e) {
      console.error("Return to bay failed:", e);
    }
  };

  const activeCount = vehicles.filter(v => v.attributes?.status === 'AVAILABLE').length;
  const dispatchCount = vehicles.filter(v => v.attributes?.status === 'DISPATCHED').length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Navigation className="w-4 h-4" /> EMERGENCY SERVICES
          </div>
          <h2 className="text-3xl font-extrabold text-white">Ambulance Fleet & Incident Dispatch</h2>
          <p className="text-slate-400 mt-1">Track vehicle GPS locations, assign paramedics, and deploy sirens to accident hotspots.</p>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Ambulance Fleet</span>
          <h3 className="text-2xl font-black text-white mt-1">{vehicles.length}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">Operational trauma vans</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-emerald-400 font-bold uppercase block">Available in Bay</span>
          <h3 className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">Ready for deployment dispatch</span>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-rose-400 font-bold uppercase block">Dispatched Vehicles</span>
          <h3 className="text-2xl font-black text-rose-400 mt-1">{dispatchCount}</h3>
          <span className="text-[9px] text-slate-500 block mt-1">On route / treating patients</span>
        </div>
      </div>

      {/* Vehicles Grid list */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-6">
        <h3 className="text-lg font-bold text-white">Live Fleet Roster</h3>
        
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {vehicles.map(veh => {
              const status = veh.attributes?.status;
              const isDispatched = status === 'DISPATCHED';
              
              return (
                <div
                  key={veh.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                    isDispatched
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white font-mono">{veh.attributes?.plate_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        isDispatched ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {status}
                      </span>
                    </div>
                    
                    <h4 className="text-base font-bold text-white mt-3">{veh.display_label}</h4>
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" /> 
                      {isDispatched ? veh.attributes?.incident_location : 'Idle at Base Station'}
                    </p>
                    
                    {isDispatched && (
                      <p className="text-[11px] text-slate-500 italic mt-2">
                        "{veh.attributes?.notes || 'Responding to emergency call'}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-white/5">
                    {!isDispatched ? (
                      <button
                        onClick={() => handleOpenDispatch(veh)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all shadow-md"
                      >
                        Dispatch Trauma Team
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReturnToBay(veh.id)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-200 text-[10px] font-bold border border-emerald-500/20"
                      >
                        Arrived in Bay
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Navigation className="w-5 h-5 text-rose-400" /> Dispatch Emergency Vehicle</h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleDispatchSubmit} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
                Ambulance: <strong>{selectedVehicle.display_label}</strong> ({selectedVehicle.attributes?.plate_number})
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Incident Location Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mile 12 Highway Junction, Lagos"
                  value={dispatchForm.incident_location}
                  onChange={(e) => setDispatchForm({...dispatchForm, incident_location: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dispatch Mission Notes</label>
                <textarea
                  required
                  placeholder="Paramedic team assigned: Nurse Joy & Dr. Obi. 3 car pileup collision reported, multiple casualties..."
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({...dispatchForm, notes: e.target.value})}
                  rows="3"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
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
                  Sound Siren & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
