import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Plus, Check, Loader2, AlertCircle, 
  Sparkles, CheckCircle2, User, RefreshCw, ClipboardList 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Housekeeping({ orgId }) {
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    room_number: '',
    assigned_to: '',
    priority: '3',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resVal = await fetch(`${API_BASE_URL}/api/v1/hotels/housekeeping/tasks?org_id=${encodeURIComponent(orgId)}`);
      if (resVal.ok) {
        const data = await resVal.json();
        setTasks(data || []);
      }
      
      const roomVal = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_room`);
      if (roomVal.ok) {
        const roomData = await roomVal.json();
        setRooms(roomData.items || []);
      }
    } catch (e) {
      console.error("Error loading housekeeping board:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/housekeeping/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ room_number: '', assigned_to: '', priority: '3', notes: '' });
        await fetchData();
      }
    } catch (err) {
      console.error("Error creating task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/housekeeping/tasks/${taskId}`, {
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
      console.error("Error updating task status:", e);
    }
  };

  const dirtyRooms = rooms.filter(r => r.attributes.housekeeping === 'Dirty');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <ClipboardList className="text-purple-400 w-6 h-6" /> Housekeeping Schedule
          </h2>
          <p className="text-slate-400 text-xs mt-1">Assign room cleans, inspect rooms, and track real-time clean statuses.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Create Cleaning Assignment
        </button>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dirty Rooms Pending</div>
            <div className="text-xl font-black text-white mt-1">{dirtyRooms.length} Rooms</div>
          </div>
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Cleaning Staff</div>
            <div className="text-xl font-black text-white mt-1">3 Staff</div>
          </div>
          <User className="w-8 h-8 text-purple-400" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Completed Cleans Today</div>
            <div className="text-xl font-black text-white mt-1">
              {tasks.filter(t => t.attributes.status === 'COMPLETED' || t.attributes.status === 'INSPECTED').length} Tasks
            </div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Task List Grid */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Cleaning Assignments Board
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No active cleaning assignments. Click "Create Cleaning Assignment" to assign a room.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => {
              const status = task.attributes.status || 'PENDING';
              const priority = task.attributes.priority || 3;
              
              return (
                <div key={task.id} className="glass p-4 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[150px] hover:border-purple-500/20 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-white">Room {task.attributes.room_number}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-purple-400" /> Assigned: {task.attributes.assigned_to}
                      </p>
                      {task.attributes.notes && <p className="text-[10px] text-slate-500 italic mt-1.5">"{task.attributes.notes}"</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                      priority >= 4 ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-500/10 text-slate-300'
                    }`}>
                      P{priority} Priority
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      status === 'COMPLETED' || status === 'INSPECTED' 
                        ? 'bg-emerald-500/10 text-emerald-300' 
                        : status === 'CLEANING'
                        ? 'bg-blue-500/10 text-blue-300 animate-pulse'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {status}
                    </span>

                    <div className="flex gap-1.5">
                      {status === 'PENDING' && (
                        <button 
                          onClick={() => handleUpdateStatus(task.id, 'CLEANING')}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-200 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600/50"
                        >
                          Start Clean
                        </button>
                      )}
                      {(status === 'PENDING' || status === 'CLEANING') && (
                        <button 
                          onClick={() => handleUpdateStatus(task.id, 'COMPLETED')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-200 border border-emerald-500/30 text-[9px] font-bold hover:bg-emerald-600/50"
                        >
                          Complete Clean
                        </button>
                      )}
                      {status === 'COMPLETED' && (
                        <button 
                          onClick={() => handleUpdateStatus(task.id, 'INSPECTED')}
                          className="px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-200 border border-purple-500/30 text-[9px] font-bold hover:bg-purple-600/50"
                        >
                          Inspect & Approve
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

      {/* Create Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create Cleaning Assignment</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Room Number</label>
                <select 
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select Room...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.display_label}>
                      Room {r.display_label} ({r.attributes.housekeeping || 'Clean'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Assign Cleaner</label>
                <input 
                  type="text" 
                  required
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                  placeholder="e.g. Joy Okafor"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Priority</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="1">1 - Low</option>
                  <option value="3">3 - Medium</option>
                  <option value="5">5 - Immediate (Checkout)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Special Notes</label>
                <input 
                  type="text" 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="VIP arrival today at 3pm."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Cleaning Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
