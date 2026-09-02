import React, { useState, useEffect } from 'react';
import { 
  Calendar, Plus, Search, User, Key, Check, Loader2, 
  AlertCircle, ChevronLeft, ChevronRight, Sparkles 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Reservations({ orgId }) {
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    guest_name: '',
    room_number: '',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nightly_rate: 150.0,
    vip_status: 'Regular',
    nationality: 'Nigeria',
    passport_id: '',
    booking_source: 'Walk-in'
  });

  // Calendar dates view (10 days starting from today)
  const [startDate, setStartDate] = useState(new Date());
  const datesArray = Array.from({ length: 10 }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });

  const getAuthHeaders = (includeJson = true) => {
    let token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
    if (!token) {
      try {
        const user = JSON.parse(localStorage.getItem('interact_user') || '{}');
        token = user.token || user.access_token;
      } catch (e) {}
    }
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    fetchData();
  }, [orgId, startDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Reservations
      const resVal = await fetch(`${API_BASE_URL}/api/v1/hotels/reservations?org_id=${encodeURIComponent(orgId)}`, {
        headers: getAuthHeaders(false)
      });
      if (resVal.ok) {
        const resData = await resVal.json();
        setReservations(resData || []);
      } else {
        console.warn(`[Reservations] Fetch reservations returned status ${resVal.status}`);
      }
      
      // 2. Fetch Rooms
      const roomVal = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_room`, {
        headers: getAuthHeaders(false)
      });
      if (roomVal.ok) {
        const roomData = await roomVal.json();
        setRooms(roomData.items || []);
      }
    } catch (e) {
      console.error("Error loading reservations board:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/reservations`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({
          guest_name: '',
          room_number: '',
          check_in_date: new Date().toISOString().split('T')[0],
          check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          nightly_rate: 150.0,
          vip_status: 'Regular',
          nationality: 'Nigeria',
          passport_id: '',
          booking_source: 'Walk-in'
        });
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to create reservation");
      }
    } catch (err) {
      console.error("Error creating reservation:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const shiftCalendar = (days) => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + days);
    setStartDate(next);
  };

  // Find booking for room on specific date
  const getBookingForRoomDate = (roomNumber, date) => {
    const dateStr = date.toISOString().split('T')[0];
    return reservations.find(r => {
      if (r.attributes.room_number !== roomNumber) return false;
      const inDate = r.attributes.check_in_date;
      const outDate = r.attributes.check_out_date;
      return dateStr >= inDate && dateStr < outDate && r.attributes.status !== 'CANCELLED';
    });
  };

  const filteredReservations = reservations.filter(r => 
    r.attributes.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.attributes.room_number?.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="text-purple-400 w-6 h-6" /> Hotel Bookings & Reservations
          </h2>
          <p className="text-slate-400 text-xs mt-1">Manage expected arrivals, room blocks, and register reservations.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Book Reservation
        </button>
      </div>

      {/* Search and Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-navy-light/30 border border-white/5 p-4 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search bookings by guest or room..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => shiftCalendar(-7)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white border border-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-purple-300 px-2">
            {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {datesArray[9].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button onClick={() => shiftCalendar(7)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white border border-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Calendar Board */}
        <div className="lg:col-span-2 glass border border-white/10 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" /> Live Room Grid Calendar
          </h3>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="p-2 font-bold text-slate-400 w-24">Room</th>
                    {datesArray.map((d, i) => (
                      <th key={i} className="p-2 text-center text-[10px] text-slate-400 font-mono">
                        <div>{d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2)}</div>
                        <div className="text-white text-xs font-bold">{d.getDate()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(rooms.length === 0 ? ['101', '102', '103', '201', '202', '501'] : rooms.map(r => r.display_label)).map((roomNum, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/5">
                      <td className="p-2 font-black text-white font-mono">{roomNum}</td>
                      {datesArray.map((date, dIdx) => {
                        const booking = getBookingForRoomDate(roomNum, date);
                        return (
                          <td key={dIdx} className="p-1 text-center border-l border-white/5 h-12 min-w-[50px]">
                            {booking ? (
                              <div className={`p-1.5 rounded-lg text-[9px] font-bold leading-tight h-full flex flex-col justify-between ${
                                booking.attributes.status === 'CHECKED_IN' 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}>
                                <span className="truncate block font-sans">{booking.attributes.guest_name}</span>
                                <span className="text-[7px] opacity-75 uppercase block">{booking.attributes.status}</span>
                              </div>
                            ) : (
                              <div className="h-full w-full rounded hover:bg-purple-500/10 cursor-pointer transition-all" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dynamic Reservation Sidebar List */}
        <div className="glass border border-white/10 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bookings List</h3>
          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
            {filteredReservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <AlertCircle className="w-8 h-8 mb-2" />
                <span className="text-xs">No reservations found</span>
              </div>
            ) : (
              filteredReservations.map((r) => (
                <div key={r.id} className="p-3.5 rounded-2xl bg-black/20 border border-white/5 hover:border-purple-500/30 transition-all space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" /> {r.attributes.guest_name}
                      </h4>
                      <div className="text-[10px] text-slate-400 mt-0.5">Room {r.attributes.room_number} • {r.attributes.booking_source}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                      r.attributes.status === 'CHECKED_IN' 
                        ? 'bg-emerald-500/10 text-emerald-300' 
                        : r.attributes.status === 'CHECKED_OUT'
                        ? 'bg-blue-500/10 text-slate-300'
                        : 'bg-purple-500/10 text-purple-300'
                    }`}>
                      {r.attributes.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-white/5 font-mono">
                    <div>IN: {r.attributes.check_in_date}</div>
                    <div>OUT: {r.attributes.check_out_date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Book Reservation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="text-purple-400" /> Book Reservation Room
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Guest Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.guest_name}
                    onChange={(e) => setFormData({...formData, guest_name: e.target.value})}
                    placeholder="Alabi Ogunlesi"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Room Number</label>
                  <input 
                    type="text" 
                    required
                    value={formData.room_number}
                    onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                    placeholder="Suite 501"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Nightly Rate (₦)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.nightly_rate}
                    onChange={(e) => setFormData({...formData, nightly_rate: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Check-In Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({...formData, check_in_date: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Check-Out Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.check_out_date}
                    onChange={(e) => setFormData({...formData, check_out_date: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">VIP Status</label>
                  <select 
                    value={formData.vip_status}
                    onChange={(e) => setFormData({...formData, vip_status: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="Regular">Regular Guest</option>
                    <option value="VIP Tier 1">VIP Tier 1</option>
                    <option value="Presidential VIP">Presidential VIP</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Nationality</label>
                  <input 
                    type="text" 
                    value={formData.nationality}
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Booking Reservation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
