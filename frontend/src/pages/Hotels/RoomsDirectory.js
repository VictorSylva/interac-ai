import React, { useState, useEffect } from 'react';
import { 
  Hotel, Plus, Eye, Key, RefreshCw, Trash2, 
  Loader2, AlertCircle, Wrench, ShieldAlert, Sparkles 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RoomsDirectory({ orgId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for creating rooms
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: 'Standard King',
    floor: '1',
    nightly_rate: 150.0
  });

  useEffect(() => {
    fetchRooms();
  }, [orgId]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_room`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.items || []);
      }
    } catch (e) {
      console.error("Error loading rooms list:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          module_id: 'module_hotels',
          entity_type_code: 'hotel_room',
          display_label: formData.room_number,
          attributes: {
            room_type: formData.room_type,
            floor: formData.floor,
            status: 'VACANT',
            housekeeping: 'Clean',
            nightly_rate: parseFloat(formData.nightly_rate)
          }
        })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ room_number: '', room_type: 'Standard King', floor: '1', nightly_rate: 150.0 });
        await fetchRooms();
      } else {
        alert("Failed to create room profile.");
      }
    } catch (err) {
      console.error("Error creating room:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (roomId, updateAttrs) => {
    // Find room local copy to get current attrs
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            ...room.attributes,
            ...updateAttrs
          }
        })
      });
      if (res.ok) {
        await fetchRooms();
      }
    } catch (e) {
      console.error("Failed to override room status:", e);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm("Are you sure you want to delete this room configuration?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities/${roomId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchRooms();
      }
    } catch (e) {
      console.error("Failed to delete room:", e);
    }
  };

  // Group rooms by floor
  const floors = rooms.reduce((acc, room) => {
    const floor = room.attributes?.floor || '1';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  // Sort floors numerically
  const sortedFloors = Object.keys(floors).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Hotel className="text-purple-400 w-6 h-6" /> Hotel Rooms & Inventory
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review live room statuses, cleaning conditions, and housekeeping logs.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Register Room Profile
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="glass p-12 rounded-3xl border border-white/10 text-center space-y-4">
          <Hotel className="w-16 h-16 mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-white">No hotel rooms registered.</h3>
          <p className="text-xs text-slate-500 max-w-[260px] mx-auto leading-relaxed">Register room profiles to begin check-ins, reservations, and housekeeping schedules.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedFloors.map((floorNum) => (
            <div key={floorNum} className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Floor {floorNum} Overview
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {floors[floorNum].map((room) => {
                  const status = room.attributes.status || 'VACANT';
                  const housekeeping = room.attributes.housekeeping || 'Clean';
                  
                  return (
                    <div 
                      key={room.id} 
                      className={`glass p-5 rounded-2xl border transition-all relative group flex flex-col justify-between min-h-[170px] ${
                        status === 'OCCUPIED' 
                          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30' 
                          : status === 'OUT_OF_SERVICE'
                          ? 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/30'
                          : 'border-white/10 hover:border-purple-500/30'
                      }`}
                    >
                      {/* Room Code Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-lg font-black text-white font-mono">{room.display_label}</span>
                          <div className="text-[10px] text-slate-500 mt-0.5">{room.attributes.room_type || 'Standard'}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Guest Information / Occupancy */}
                      <div className="my-3">
                        {status === 'OCCUPIED' ? (
                          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5" /> Checked In: {room.attributes.guest_name || 'Guest'}
                          </div>
                        ) : status === 'OUT_OF_SERVICE' ? (
                          <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5" /> Out of Service
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                            Vacant (₦{room.attributes.nightly_rate?.toLocaleString()}/night)
                          </div>
                        )}
                      </div>

                      {/* Room Condition Overrides */}
                      <div className="flex justify-between items-center pt-3.5 border-t border-white/5">
                        
                        {/* Housekeeping Badges */}
                        <button 
                          onClick={() => handleUpdateStatus(room.id, { housekeeping: housekeeping === 'Clean' ? 'Dirty' : 'Clean' })}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                            housekeeping === 'Clean' 
                              ? 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' 
                              : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
                          }`}
                        >
                          {housekeeping}
                        </button>

                        {/* Block/Unblock toggle */}
                        <button
                          onClick={() => handleUpdateStatus(room.id, { status: status === 'OUT_OF_SERVICE' ? 'VACANT' : 'OUT_OF_SERVICE' })}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[9px] font-bold flex items-center gap-1"
                        >
                          {status === 'OUT_OF_SERVICE' ? 'Set Available' : 'Out of Service'}
                        </button>

                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Room Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Register Room Profile</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Room Code / Number</label>
                <input 
                  type="text" 
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  placeholder="Suite 501"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Floor Level</label>
                <select 
                  value={formData.floor}
                  onChange={(e) => setFormData({...formData, floor: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="1">Floor 1</option>
                  <option value="2">Floor 2</option>
                  <option value="3">Floor 3</option>
                  <option value="5">Floor 5 (VIP Suite Floor)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Room Tier Type</label>
                <select 
                  value={formData.room_type}
                  onChange={(e) => setFormData({...formData, room_type: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="Standard King">Standard King</option>
                  <option value="Double Deluxe">Double Deluxe</option>
                  <option value="Presidential Suite">Presidential Suite</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Nightly Pricing Rate (₦)</label>
                <input 
                  type="number" 
                  required
                  value={formData.nightly_rate}
                  onChange={(e) => setFormData({...formData, nightly_rate: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Room Profile"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
