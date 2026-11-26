import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Save, ChevronLeft, ChevronRight, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';

export default function Scheduling() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('calendar');
  const [appointments, setAppointments] = useState([]);
  const [aptTypes, setAptTypes] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month'); // 'month' or 'week'

  useEffect(() => {
    if (currentUser?.business_id) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const bid = currentUser.business_id;
      const [aptRes, typeRes, availRes] = await Promise.all([
        fetch(`${apiUrl}/api/scheduling/appointments?business_id=${bid}`),
        fetch(`${apiUrl}/api/scheduling/types?business_id=${bid}`),
        fetch(`${apiUrl}/api/scheduling/availability?business_id=${bid}`)
      ]);

      if (aptRes.ok) {
        const apts = await aptRes.json();
        setAppointments(apts);
      }
      if (typeRes.ok) setAptTypes(await typeRes.json());
      if (availRes.ok) {
        const availData = await availRes.json();
        const fullAvail = Array.from({ length: 7 }, (_, i) => {
          const existing = availData.find(r => r.day_of_week === i);
          return existing || { day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: true };
        });
        setAvailability(fullAvail);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const bid = currentUser.business_id;
      const res = await fetch(`${apiUrl}/api/scheduling/availability?business_id=${bid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(availability.map(r => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: r.is_active
        })))
      });
      if (res.ok) alert("Availability saved!");
    } catch (err) {
      alert("Failed to save availability");
    }
    setSaving(false);
  };

  const handleAddType = async () => {
    const name = prompt("Appointment Type Name (e.g. Discovery Call):");
    if (!name) return;
    const duration = prompt("Duration in minutes:", "30");
    if (!duration) return;

    try {
      const bid = currentUser.business_id;
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/scheduling/types?business_id=${bid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: "",
          duration_minutes: parseInt(duration),
          color_code: "#3b82f6"
        })
      });
      if (res.ok) {
        const newType = await res.json();
        setAptTypes([...aptTypes, newType]);
      }
    } catch (err) {
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm("Delete this appointment type?")) return;
    try {
      const bid = currentUser.business_id;
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/scheduling/types/${id}?business_id=${bid}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAptTypes(aptTypes.filter(t => t.id !== id));
      }
    } catch (err) {
    }
  };

  const handleTimeChange = (idx, field, value) => {
    const newAvail = [...availability];
    newAvail[idx] = { ...newAvail[idx], [field]: value };
    setAvailability(newAvail);
  };

  const handleToggleActive = (idx) => {
    const newAvail = [...availability];
    newAvail[idx] = { ...newAvail[idx], is_active: !newAvail[idx].is_active };
    setAvailability(newAvail);
  };

  const renderCalendar = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const totalDays = endOfMonth.getDate();

    const days = [];
    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 border border-grey-light bg-grey-light/20"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayApts = appointments.filter(a => {
          const aptDate = new Date(a.start_at);
          return aptDate.getFullYear() === date.getFullYear() &&
                 aptDate.getMonth() === date.getMonth() &&
                 aptDate.getDate() === date.getDate();
      });

      days.push(
        <div key={day} className="min-h-[120px] border border-grey-light p-2 overflow-y-auto hover:bg-grey-light transition-colors">
          <div className="flex justify-between items-start mb-1">
            <span className="font-semibold text-xs text-navy">{day}</span>
          </div>
          <div className="space-y-1">
            {dayApts.map(apt => (
              <div 
                key={apt.id} 
                className="text-[9px] p-1 rounded border-l-2 truncate shadow-sm"
                style={{ 
                  backgroundColor: `${apt.appointment_type_color || apt.appointment_type?.color_code || '#3b82f6'}15`, 
                  color: apt.appointment_type_color || apt.appointment_type?.color_code || '#3b82f6',
                  borderColor: apt.appointment_type_color || apt.appointment_type?.color_code || '#3b82f6'
                }}
                title={`${apt.appointment_type_name || apt.appointment_type?.name || apt.notes || 'Appointment'} at ${new Date(apt.start_at).toLocaleTimeString()}`}
              >
                <span className="font-bold">{new Date(apt.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="ml-1 opacity-80">{apt.appointment_type_name || apt.appointment_type?.name || apt.notes || 'Appointment'}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-grey-light flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-bold text-navy">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex bg-grey-light rounded-lg p-1">
                <button 
                  onClick={() => setCalendarView('month')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${calendarView === 'month' ? 'bg-white shadow-sm text-navy' : 'text-text-light'}`}
                >
                  Month
                </button>
                <button 
                  onClick={() => setCalendarView('week')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${calendarView === 'week' ? 'bg-white shadow-sm text-navy' : 'text-text-light'}`}
                >
                  Week
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (calendarView === 'month') {
                    newDate.setMonth(newDate.getMonth() - 1);
                  } else {
                    newDate.setDate(newDate.getDate() - 7);
                  }
                  setCurrentDate(newDate);
                }} 
                className="p-2 hover:bg-grey-light rounded"
              >
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium hover:bg-grey-light rounded">Today</button>
              <button 
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (calendarView === 'month') {
                    newDate.setMonth(newDate.getMonth() + 1);
                  } else {
                    newDate.setDate(newDate.getDate() + 7);
                  }
                  setCurrentDate(newDate);
                }} 
                className="p-2 hover:bg-grey-light rounded"
              >
                <ChevronRight size={20} />
              </button>
              <button 
                onClick={fetchData} 
                className="ml-2 p-2 hover:bg-grey-light rounded text-navy"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        
        {calendarView === 'month' ? (
          <>
            <div className="grid grid-cols-7 bg-navy text-white text-center py-2 text-xs font-medium uppercase tracking-wider">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 overflow-auto">
              {days}
            </div>
          </>
        ) : (
          renderWeekView()
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    // Time slots (8 AM to 8 PM)
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        
        const dayApts = appointments.filter(a => {
            const aptDate = new Date(a.start_at);
            return aptDate.getFullYear() === date.getFullYear() &&
                   aptDate.getMonth() === date.getMonth() &&
                   aptDate.getDate() === date.getDate();
        });

        const now = new Date();
        const isToday = now.toDateString() === date.toDateString();
        const nowTop = ((now.getHours() - 8) * 50) + (now.getMinutes() / 60 * 50);

        days.push(
            <div key={i} className="flex-1 min-w-[120px] border-r border-grey-light last:border-r-0">
                <div className="p-3 text-center border-b border-grey-light bg-grey-light/10">
                    <div className="text-[10px] text-text-light uppercase font-bold">{date.toLocaleDateString('default', { weekday: 'short' })}</div>
                    <div className={`text-lg font-bold ${new Date().toDateString() === date.toDateString() ? 'text-blue-600' : 'text-navy'}`}>
                        {date.getDate()}
                    </div>
                </div>
                <div className="relative h-[650px]">
                    {/* Time grids */}
                    {hours.map(h => (
                        <div key={h} className="h-[50px] border-b border-grey-light/50 text-[9px] text-text-light pl-1 pointer-events-none">
                            {h}:00
                        </div>
                    ))}

                    {/* Today/Now Indicator */}
                    {isToday && now.getHours() >= 8 && now.getHours() < 21 && (
                        <div 
                            className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                            style={{ top: `${nowTop}px` }}
                        >
                            <div className="absolute -top-1.5 -left-1 w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                        </div>
                    )}
                    
                    {/* Appointments */}
                    {dayApts.map(apt => {
                        const start = new Date(apt.start_at);
                        const top = ((start.getHours() - 8) * 50) + (start.getMinutes() / 60 * 50);
                        const startAt = new Date(apt.start_at);
                        const endAt = new Date(apt.end_at);
                        const durationMins = (endAt - startAt) / (1000 * 60);
                        const height = (durationMins / 60) * 50;

                        return (
                            <div 
                                key={apt.id}
                                className="absolute left-1 right-1 rounded border-l-4 p-1 text-[10px] shadow-sm overflow-hidden z-10"
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    backgroundColor: `${apt.appointment_type_color || apt.appointment_type?.color_code || '#3b82f6'}F0`,
                                    color: 'white',
                                    borderColor: 'rgba(0,0,0,0.1)'
                                }}
                            >
                                <div className="font-bold truncate">{apt.appointment_type_name || apt.appointment_type?.name || apt.notes || 'Appointment'}</div>
                                <div className="text-[9px] opacity-90">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="flex overflow-x-auto">
            <div className="w-12 border-r border-grey-light bg-grey-light/5 flex flex-col pt-[53px]">
                {/* Reserved for y-axis scale if needed */}
            </div>
            {days}
        </div>
    );
  };

  const renderSettings = () => {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    return (
      <div className="space-y-8">
        {/* Availability Rules */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-navy mb-1 flex items-center">
            <Clock className="mr-2" size={20} /> Business Availability
          </h3>
          {availability.every(r => !r.id) && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
              <strong>Notice:</strong> Your availability hasn't been saved to the database yet. The AI will not be able to show slots until you click <strong>Save Availability</strong> below.
            </div>
          )}
          <div className="space-y-4">
            {dayNames.map((day, idx) => {
              const rule = availability.find(r => r.day_of_week === idx) || { start_time: "09:00", end_time: "17:00", is_active: true };
              return (
                <div key={day} className="flex items-center justify-between p-3 border border-grey-light rounded">
                  <span className="font-medium w-32">{day}</span>
                  <div className="flex items-center space-x-4">
                    <input 
                      type="time" 
                      value={rule.start_time.substring(0, 5)} 
                      onChange={(e) => handleTimeChange(idx, 'start_time', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <span>to</span>
                    <input 
                      type="time" 
                      value={rule.end_time.substring(0, 5)} 
                      onChange={(e) => handleTimeChange(idx, 'end_time', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={rule.is_active} 
                        onChange={() => handleToggleActive(idx)}
                        className="form-checkbox h-4 w-4 text-navy"
                      />
                      <span className="ml-2 text-sm">Active</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={handleSaveAvailability}
            disabled={saving}
            className="mt-6 flex items-center bg-navy text-white px-4 py-2 rounded shadow hover:bg-navy-light transition-colors disabled:opacity-50"
          >
            <Save className="mr-2" size={18} /> {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>

        {/* Appointment Types */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-navy flex items-center">
              <Plus className="mr-2" size={20} /> Appointment Types
            </h3>
            <button onClick={handleAddType} className="text-sm text-navy hover:underline">+ Add Type</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aptTypes.map(type => (
              <div key={type.id} className="p-4 border border-grey-light rounded-lg flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy">{type.name}</h4>
                  <p className="text-xs text-text-light">{type.duration_minutes} mins • {type.description || "No description"}</p>
                </div>
                <button onClick={() => handleDeleteType(type.id)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-navy">Scheduling</h1>
          <p className="text-text-light">Manage your availability and track appointments.</p>
        </div>
        <div className="flex bg-white p-1 rounded-lg border border-grey-light shadow-sm">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-md transition-all flex items-center ${activeTab === 'calendar' ? 'bg-navy text-white' : 'text-text-light hover:bg-grey-light'}`}
          >
            <CalendarIcon size={18} className="mr-2" /> Calendar
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-md transition-all flex items-center ${activeTab === 'settings' ? 'bg-navy text-white' : 'text-text-light hover:bg-grey-light'}`}
          >
            <SettingsIcon size={18} className="mr-2" /> Settings
          </button>
        </div>
      </div>

      {loading ? (
        <Loader message="Fetching Schedules..." />
      ) : activeTab === 'calendar' ? (
        renderCalendar()
      ) : (
        renderSettings()
      )}

      {/* Debug Footer (Developer Mode) */}
      <div className="mt-8 pt-4 border-t border-grey-medium flex justify-between items-center text-[10px] text-text-light opacity-50">
        <div>
          Business ID: <span className="font-mono">{currentUser?.business_id || 'N/A'}</span>
        </div>
        <div>
          Loaded: <span className="font-bold">{appointments.length}</span> appointments
        </div>
      </div>
    </div>
  );
}
