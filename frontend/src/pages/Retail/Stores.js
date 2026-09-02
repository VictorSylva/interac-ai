import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Loader2, Thermometer, User, Clock, ShieldCheck, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailStores({ orgId }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', manager: '', region: 'Lagos', hours: '8:00 AM - 10:00 PM', zones: 'Aisle 1-10, Checkout, Warehouse' });

  useEffect(() => {
    fetchStores();
  }, [orgId]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/stores?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          name: formData.name,
          manager: formData.manager,
          region: formData.region,
          hours: formData.hours,
          zones: formData.zones.split(',')
        })
      });
      if (res.ok) {
        setShowRegModal(false);
        setFormData({ name: '', manager: '', region: 'Lagos', hours: '8:00 AM - 10:00 PM', zones: 'Aisle 1-10, Checkout, Warehouse' });
        fetchStores();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <MapPin className="w-4 h-4" /> Store Hierarchy & Multi-Branch
          </div>
          <h2 className="text-3xl font-extrabold text-white">Supermarket Branch Profile Registry</h2>
          <p className="text-slate-400 mt-1">Configure physical store hours, appoint branch managers, map layout zones, and track cold storage telemetry.</p>
        </div>

        <button 
          onClick={() => setShowRegModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Register Branch Store
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center flex justify-center items-center gap-2 text-slate-400 text-xs">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> Fetching branch profiles...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stores.map(store => (
            <div key={store.id} className="glass p-6 rounded-3xl border border-white/10 space-y-4 hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <MapPin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{store.display_label}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{store.attributes?.region}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/25 text-emerald-300 inline-flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Operational</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 text-xs text-slate-300">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Store Manager</p>
                  <p className="font-bold flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {store.attributes?.manager || 'Unassigned'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Opening Hours</p>
                  <p className="font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {store.attributes?.hours}</p>
                </div>
              </div>

              {/* COLD TELEMETRY DISPLAY */}
              <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex justify-between items-center text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5"><Thermometer className="w-4 h-4 text-cyan-400" /> Refrigerator Temp Telemetry</span>
                <span className="font-mono text-cyan-300 font-black">{store.attributes?.refrigerator_temp || 4.0}°C</span>
              </div>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Department Zones</p>
                <div className="flex flex-wrap gap-1.5">
                  {store.attributes?.zones?.map((zone, idx) => (
                    <span key={idx} className="bg-white/5 border border-white/5 rounded-lg px-2 py-0.5 text-[9px] font-mono text-slate-400">{zone}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-sm w-full space-y-6 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Register Branch Store</h3>
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Branch Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Lekki Express Mall"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Store Manager Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Chinelo Ndu"
                  value={formData.manager}
                  onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Region / State</label>
                  <input 
                    type="text" 
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Hours</label>
                  <input 
                    type="text" 
                    value={formData.hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Layout Zones (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.zones}
                  onChange={(e) => setFormData(prev => ({ ...prev, zones: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRegModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  {submitting ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
