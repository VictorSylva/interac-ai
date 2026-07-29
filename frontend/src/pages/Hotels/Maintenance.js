import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Check, Loader2, AlertCircle, 
  Sparkles, CheckCircle2, User, Hammer, ClipboardList 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Maintenance({ orgId }) {
  const [tickets, setTickets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    room_number: '',
    issue_description: '',
    assigned_technician: '',
    priority: 'MEDIUM',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resVal = await fetch(`${API_BASE_URL}/api/v1/hotels/maintenance/tickets?org_id=${encodeURIComponent(orgId)}`);
      if (resVal.ok) {
        const data = await resVal.json();
        setTickets(data || []);
      }
      
      const roomVal = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_room`);
      if (roomVal.ok) {
        const roomData = await roomVal.json();
        setRooms(roomData.items || []);
      }
    } catch (e) {
      console.error("Error loading maintenance board:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/maintenance/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ room_number: '', issue_description: '', assigned_technician: '', priority: 'MEDIUM', notes: '' });
        await fetchData();
      }
    } catch (err) {
      console.error("Error logging ticket:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/maintenance/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus
        })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error("Error updating ticket status:", e);
    }
  };

  const openTickets = tickets.filter(t => t.attributes.status !== 'RESOLVED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Wrench className="text-purple-400 w-6 h-6" /> Maintenance Tickets
          </h2>
          <p className="text-slate-400 text-xs mt-1">Log room faults, dispatch technicians, track asset fixes, and manage room blocks.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Report Facility Fault
        </button>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Open Tickets</div>
            <div className="text-xl font-black text-white mt-1">{openTickets.length} Tickets</div>
          </div>
          <AlertCircle className={`w-8 h-8 ${openTickets.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Technicians</div>
            <div className="text-xl font-black text-white mt-1">2 Staff</div>
          </div>
          <User className="w-8 h-8 text-purple-400" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resolved Tickets</div>
            <div className="text-xl font-black text-white mt-1">
              {tickets.filter(t => t.attributes.status === 'RESOLVED').length} Tickets
            </div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Tickets List */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Maintenance Task Board
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No maintenance records logged. Click "Report Facility Fault" to report an issue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((t) => {
              const status = t.attributes.status || 'OPEN';
              const priority = t.attributes.priority || 'MEDIUM';
              
              return (
                <div key={t.id} className="glass p-4 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[160px] hover:border-purple-500/20 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-white">Room {t.attributes.room_number}</h4>
                      <p className="text-[11px] text-slate-300 font-bold mt-1.5">{t.attributes.issue_description}</p>
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <Hammer className="w-3 h-3 text-purple-400" /> Tech: {t.attributes.assigned_technician}
                      </p>
                      {t.attributes.notes && <p className="text-[10px] text-slate-500 italic mt-1.5">"{t.attributes.notes}"</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                      priority === 'CRITICAL' || priority === 'HIGH' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-500/10 text-slate-300'
                    }`}>
                      {priority}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      status === 'RESOLVED' 
                        ? 'bg-emerald-500/10 text-emerald-300' 
                        : status === 'IN_PROGRESS'
                        ? 'bg-blue-500/10 text-blue-300 animate-pulse'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                    }`}>
                      {status}
                    </span>

                    <div className="flex gap-1.5">
                      {status === 'OPEN' && (
                        <button 
                          onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-200 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/50"
                        >
                          Dispatch
                        </button>
                      )}
                      {(status === 'OPEN' || status === 'IN_PROGRESS') && (
                        <button 
                          onClick={() => handleUpdateStatus(t.id, 'RESOLVED')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-200 border border-emerald-500/30 text-[9px] font-bold hover:bg-emerald-600/50"
                        >
                          Resolve Fault
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Report Facility Fault</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Room / Location</label>
                <select 
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select Location...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.display_label}>Room {r.display_label}</option>
                  ))}
                  <option value="Lobby">Hotel Lobby Reception</option>
                  <option value="Restaurant">Restaurant Diner</option>
                  <option value="Gym">Fitness Gym Center</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Issue Description</label>
                <input 
                  type="text" 
                  required
                  value={formData.issue_description}
                  onChange={(e) => setFormData({...formData, issue_description: e.target.value})}
                  placeholder="e.g. AC leaking water, TV not powering"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Assign Technician</label>
                <input 
                  type="text" 
                  required
                  value={formData.assigned_technician}
                  onChange={(e) => setFormData({...formData, assigned_technician: e.target.value})}
                  placeholder="e.g. Samuel Ade"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Severity Priority</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH (Block Reservations)</option>
                  <option value="CRITICAL">CRITICAL (Out of Service)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Maintenance Ticket"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
