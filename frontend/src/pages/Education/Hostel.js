import React, { useState, useEffect } from 'react';
import { Home, Plus, Search, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduHostelPage({ orgId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    room_no: '',
    block: 'Male Dorm Block A',
    capacity: 4
  });

  useEffect(() => {
    fetchRooms();
  }, [orgId]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/hostel/rooms?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data || []);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/education/hostel/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ room_no: '', block: 'Male Dorm Block A', capacity: 4 });
        fetchRooms();
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
            <Home className="w-4 h-4" /> HOSTEL WORKSPACE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Hostel Allocations & Dorm Room Stocks</h2>
          <p className="text-slate-400 mt-1">Manage student housing allocations, dorm room capacities, and warden log sheets.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Add Room Block
        </button>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Housing Inventory</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Dormitory Block & Room</th>
                <th className="p-4">Room No</th>
                <th className="p-4">Max Capacity</th>
                <th className="p-4">Occupancy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading rooms...</td></tr>
              ) : rooms.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No dorm rooms registered. Click Add Room Block.</td></tr>
              ) : rooms.map(r => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white">{r.display_label}</td>
                  <td className="p-4 font-mono text-cyan-300">Room {r.attributes?.room_no}</td>
                  <td className="p-4 font-mono text-slate-400">{r.attributes?.capacity} students</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 uppercase">Vacant</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create Hostel Room</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Housing Block</label>
                <select
                  value={formData.block}
                  onChange={(e) => setFormData({...formData, block: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Male Dorm Block A">Male Dorm Block A</option>
                  <option value="Male Dorm Block B">Male Dorm Block B</option>
                  <option value="Female Dorm Block C">Female Dorm Block C</option>
                  <option value="Female Dorm Block D">Female Dorm Block D</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Room number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 104"
                    value={formData.room_no}
                    onChange={(e) => setFormData({...formData, room_no: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Capacity (Beds)</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
