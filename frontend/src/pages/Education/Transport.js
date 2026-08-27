import React, { useState, useEffect } from 'react';
import { Car, Plus, Search, Loader2, MapPin, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduTransportPage({ orgId }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    route_name: '',
    driver_name: '',
    bus_no: 'BUS-9902'
  });

  useEffect(() => {
    fetchRoutes();
  }, [orgId]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/transport/routes?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/transport/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ route_name: '', driver_name: '', bus_no: 'BUS-9902' });
        fetchRoutes();
      }
    } catch (e) {
      console.error(e);
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
            <Car className="w-4 h-4" /> LOGISTICS & TRANSPORT
          </div>
          <h2 className="text-3xl font-extrabold text-white">School Bus Routes & Tracking</h2>
          <p className="text-slate-400 mt-1">Manage transport route mappings, assign drivers, and check real-time simulated GPS bus locations.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Create Route
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Bus Routes Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Route Name</th>
                    <th className="p-4">Assigned Driver</th>
                    <th className="p-4">Bus License Plate</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading routes...</td></tr>
                  ) : routes.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No transport routes created. Click Create Route to start.</td></tr>
                  ) : routes.map(r => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        {r.display_label}
                      </td>
                      <td className="p-4 text-slate-300">{r.attributes?.driver_name}</td>
                      <td className="p-4 font-mono text-cyan-300">{r.attributes?.bus_no}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[9px] bg-green-500/20 text-green-300 border border-green-500/30 uppercase font-bold">{r.attributes?.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Map Telemetry Simulator */}
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Live GPS Telemetry (Simulated)</h3>
            <div className="h-48 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]"></div>
              {/* Map grid lines */}
              <div className="absolute w-full h-[1px] bg-white/5 top-1/2"></div>
              <div className="absolute h-full w-[1px] bg-white/5 left-1/2"></div>
              {/* Moving dots */}
              <div className="absolute w-3.5 h-3.5 bg-cyan-400 rounded-full animate-ping top-1/3 left-1/3"></div>
              <div className="absolute w-2 h-2 bg-cyan-500 rounded-full top-1/3 left-1/3"></div>
              <span className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[9px] font-mono text-slate-400 border border-white/5">Route: Lekki Express | Lat: 6.52 | Lng: 3.37</span>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create Bus Route</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Route Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lekki Phase 1 - Campus Link"
                  value={formData.route_name}
                  onChange={(e) => setFormData({...formData, route_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Driver Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yusuf Bello"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bus License Plate</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAG-9942-AA"
                    value={formData.bus_no}
                    onChange={(e) => setFormData({...formData, bus_no: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
