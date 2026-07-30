import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Users, MessageCircle, TrendingUp, Calendar, ShieldCheck, Target, Heart, Zap, 
  ShieldAlert, Activity, Lock, Shield, Video, DollarSign, RefreshCw, FileText, 
  CheckCircle2, ChevronRight, Key, Layers, Landmark, Coffee, Package
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';

const COLORS = ['#6366f1', '#818cf8', '#4f46e5', '#312e81', '#1e1b4b'];
const SENTIMENT_COLORS = {
  Positive: '#10b981',
  Neutral: '#64748b',
  Negative: '#ef4444'
};

export default function DashboardOverview() {
  const { currentUser, userRole, activeDept } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [risks, setRisks] = useState([]);
  const [installedModules, setInstalledModules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Department-specific states
  const [reservations, setReservations] = useState([]);
  const [housekeeping, setHousekeeping] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const businessId = currentUser?.business_id || currentUser?.email || "default";
  const userDept = activeDept?.toLowerCase() || 'general';
  const activeRole = userRole?.toLowerCase() || 'admin';

  const fetchData = async () => {
    if (!currentUser) return;
    const apiHost = API_BASE_URL;
    
    try {
        const [analyticsRes, insightsRes, balanceRes, risksRes, modulesRes] = await Promise.all([
            fetch(`${apiHost}/api/analytics?business_id=${encodeURIComponent(businessId)}`),
            fetch(`${apiHost}/api/analytics/insights?business_id=${encodeURIComponent(businessId)}`),
            fetch(`${apiHost}/api/tokens/balance?business_id=${encodeURIComponent(businessId)}`),
            fetch(`${apiHost}/api/v1/intelligence/top-risks?limit=5`),
            fetch(`${apiHost}/api/v1/modules/installed?org_id=${encodeURIComponent(businessId)}`)
        ]);
        
        const analyticsJson = analyticsRes.ok ? await analyticsRes.json() : null;
        const insightsJson = insightsRes.ok ? await insightsRes.json() : null;
        const balanceJson = balanceRes.ok ? await balanceRes.json() : null;
        const risksJson = risksRes.ok ? await risksRes.json() : [];
        const modulesJson = modulesRes.ok ? await modulesRes.json() : [];
        
        if (analyticsJson) {
            setData({ ...analyticsJson, balance: balanceJson });
        } else {
            setData({
                overview: { total_conversations: 0, pipeline_value: 0, total_appointments: 0 },
                balance: balanceJson
            });
        }
        if (insightsJson) setInsights(insightsJson);
        if (Array.isArray(risksJson)) setRisks(risksJson);
        setInstalledModules(Array.isArray(modulesJson) ? modulesJson : modulesJson.modules || []);

        // Load Hospitality department specific details if in those workspaces
        if (userDept === 'reception' || userDept === 'general') {
            const resReservations = await fetch(`${apiHost}/api/v1/hotels/reservations?org_id=${encodeURIComponent(businessId)}`);
            if (resReservations.ok) {
                const resJson = await resReservations.json();
                setReservations(Array.isArray(resJson) ? resJson : []);
            }
            const resHk = await fetch(`${apiHost}/api/v1/hotels/housekeeping/tasks?org_id=${encodeURIComponent(businessId)}`);
            if (resHk.ok) {
                const hkJson = await resHk.json();
                setHousekeeping(Array.isArray(hkJson) ? hkJson : []);
            }
            const resRooms = await fetch(`${apiHost}/api/v1/entities?org_id=${encodeURIComponent(businessId)}&entity_type_code=hotel_room`);
            if (resRooms.ok) {
                const roomsJson = await resRooms.json();
                setRooms(Array.isArray(roomsJson.items) ? roomsJson.items : []);
            }
        }

        if (userDept === 'finance' || userDept === 'general') {
            const resOrders = await fetch(`${apiHost}/api/v1/hotels/restaurant/orders?org_id=${encodeURIComponent(businessId)}`);
            if (resOrders.ok) {
                const ordersJson = await resOrders.json();
                setPosOrders(Array.isArray(ordersJson) ? ordersJson : []);
            }
        }
    } catch (err) {
        console.error("Dashboard overview fetch error:", err);
        setData({
            overview: { total_conversations: 0, pipeline_value: 0, total_appointments: 0 },
            balance: null
        });
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, userDept]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader message="Initializing Operational Workspace..." /></div>;
  if (!data) return <div className="p-6 text-center text-slate-400">Unable to load command center data.</div>;

  // Role Privilege Banner
  const getRolePrivilegeBanner = () => {
    if (activeRole === 'viewer') {
      return (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md">
          <Lock size={16} className="text-amber-400" />
          <span>READ-ONLY PREVIEW MODE: You cannot check-in guests, update housekeeping tasks, or log tickets.</span>
        </div>
      );
    }
    if (activeRole === 'agent') {
      return (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md">
          <Activity size={16} className="text-blue-400 animate-pulse" />
          <span>STAFF ACCESS: You can execute operational workflows, perform check-ins, and manage service tasks.</span>
        </div>
      );
    }
    return (
      <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md">
        <Shield size={16} className="text-indigo-400" />
        <span>ADMINISTRATIVE WORKSPACE PREVIEW: Full dashboard controls and simulated override permissions active.</span>
      </div>
    );
  };

  // Mock data for graphs
  const mockRevenueData = [
    { name: 'Mon', Revenue: 4000, Invoices: 2400 },
    { name: 'Tue', Revenue: 3000, Invoices: 1398 },
    { name: 'Wed', Revenue: 9800, Invoices: 2000 },
    { name: 'Thu', Revenue: 2780, Invoices: 3908 },
    { name: 'Fri', Revenue: 1890, Invoices: 4800 },
    { name: 'Sat', Revenue: 2390, Invoices: 3800 },
    { name: 'Sun', Revenue: 3490, Invoices: 4300 },
  ];

  const cctvFeeds = [
    { id: 1, name: 'CAM 01 - MAIN LOBBY', status: 'ACTIVE', noise: 'rec-pulse' },
    { id: 2, name: 'CAM 02 - CORRIDOR 3A', status: 'ACTIVE', noise: 'rec-pulse' },
    { id: 3, name: 'CAM 03 - CORRIDOR 5B', status: 'ACTIVE', noise: 'rec-pulse' },
    { id: 4, name: 'CAM 04 - CORRIDOR 7C', status: 'ACTIVE', noise: 'rec-pulse' }
  ];

  // ==========================================
  // RENDER DEDICATED WORKSPACE VIEWS
  // ==========================================

  // --- VIEW 1: RECEPTION / FRONT DESK DASHBOARD ---
  if (userDept === 'reception') {
    const occupiedRooms = reservations.filter(r => r.attributes?.checked_in === true && !r.attributes?.checked_out).length;
    const pendingCheckins = reservations.filter(r => !r.attributes?.checked_in).length;
    const dirtyRooms = housekeeping.filter(h => h.status?.toLowerCase() === 'dirty').length;

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-wide">Reception & Front Desk Workspace</h2>
            <p className="text-slate-400 mt-1">Real-time room allocation, check-ins, and guest hospitality dashboard.</p>
          </div>
          <button 
            onClick={handleManualRefresh} 
            disabled={refreshing}
            className="text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 hover:border-indigo-500/30 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync PMS'}
          </button>
        </div>

        {getRolePrivilegeBanner()}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Rooms Occupied</span>
            <h4 className="text-3xl font-bold text-white mt-2">{occupiedRooms} <span className="text-sm text-slate-500 font-medium">/ {rooms.length || 0}</span></h4>
            <p className="text-xs text-slate-400 mt-2">Active guest keycards allocated</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Pending Arrivals</span>
            <h4 className="text-3xl font-bold text-white mt-2">{pendingCheckins} <span className="text-sm text-slate-500 font-medium">Booked</span></h4>
            <p className="text-xs text-slate-400 mt-2">Awaiting check-in workflow</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Housekeeping Tasks</span>
            <h4 className="text-3xl font-bold text-white mt-2">{dirtyRooms} <span className="text-sm text-slate-500 font-medium">Dirty Rooms</span></h4>
            <p className="text-xs text-slate-400 mt-2">{housekeeping.length} total cleaning cycles</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Front Desk Status</span>
            <h4 className="text-3xl font-bold text-white mt-2">ONLINE</h4>
            <p className="text-xs text-slate-400 mt-2">Check-in widgets initialized</p>
          </div>
        </div>

        {/* Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of Reservations & Check-ins */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl flex flex-col h-[400px]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-indigo-400" />
                Active Guest Bookings & Check-ins
              </h3>
              <div className="flex-1 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {reservations.length > 0 ? (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500 font-bold">
                        <th className="py-2">Guest Name</th>
                        <th className="py-2">Room</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Folio ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((res, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 font-semibold text-white">{res.attributes?.guest_name || res.display_label}</td>
                          <td className="py-3">{res.attributes?.room_number || "TBD"}</td>
                          <td className="py-3">
                            {res.attributes?.checked_out ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-400 font-bold uppercase">Checked Out</span>
                            ) : res.attributes?.checked_in ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold uppercase">In House</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold uppercase">Pending</span>
                            )}
                          </td>
                          <td className="py-3 text-slate-400 font-mono text-xs">{res.attributes?.folio_id || "Unassigned"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    No active reservations recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Rooms Matrix */}
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">PMS Rooms Matrix</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {rooms.length > 0 ? (
                  rooms.map((room) => {
                    const roomNum = room.display_label; // e.g. "Suite 01" or "501"
                    const hasActive = reservations.some(r => r.attributes?.room_number === roomNum && r.attributes?.checked_in && !r.attributes?.checked_out);
                    const isDirty = (room.attributes?.housekeeping || "").toLowerCase() === 'dirty';
                    const isOOS = (room.attributes?.status || "").toUpperCase() === 'OUT_OF_SERVICE' || risks.some(r => r.entity_identifier === `Room ${roomNum}`);
                    
                    let statusColor = "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
                    let label = "Vacant";
                    if (isOOS) {
                      statusColor = "bg-rose-500/20 border-rose-500/40 text-rose-400";
                      label = "Out of Service";
                    } else if (hasActive || (room.attributes?.status || "").toUpperCase() === 'OCCUPIED') {
                      statusColor = "bg-indigo-500/20 border-indigo-500/40 text-indigo-300";
                      label = "Occupied";
                    } else if (isDirty) {
                      statusColor = "bg-amber-500/20 border-amber-500/40 text-amber-400";
                      label = "Dirty";
                    }

                    return (
                      <div key={room.id} className={`p-4 rounded-xl border ${statusColor} text-center flex flex-col justify-between h-24 hover:scale-[1.02] transition-transform duration-200`}>
                        <span className="text-sm font-bold truncate" title={roomNum}>{roomNum}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-5 p-8 text-center text-slate-500 text-sm border border-white/5 rounded-xl bg-white/5">
                    No registered rooms found. Go to Rooms Directory to add some.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar controls for desk */}
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Front Desk Console</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/dashboard/hotels/frontdesk')}
                  disabled={activeRole === 'viewer'}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Key size={16} /> Guest Check-in Widget
                  </span>
                  <ChevronRight size={16} />
                </button>

                <button 
                  onClick={() => navigate('/dashboard/hotels/reservations')}
                  disabled={activeRole === 'viewer'}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 font-bold rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={16} /> New Booking / Reservation
                  </span>
                  <ChevronRight size={16} />
                </button>

                <button 
                  onClick={() => navigate('/dashboard/hotels/housekeeping')}
                  disabled={activeRole === 'viewer'}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 font-bold rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Activity size={16} /> Housekeeping Cleaning Schedule
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Recent Desk Log Feed */}
            <div className="glass p-6 rounded-2xl h-[280px] flex flex-col">
              <h3 className="text-sm font-bold text-white mb-3">Workspace Activity Log</h3>
              <div className="flex-1 overflow-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 pr-1">
                {reservations.map((res, idx) => (
                  <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>Reservation Normalized</span>
                      <span className="text-[10px] text-slate-500">Just Now</span>
                    </div>
                    <p className="text-slate-400">Created folio for Guest {res.attributes?.guest_name || res.display_label} in Room {res.attributes?.room_number || 'TBD'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: SECURITY & SURVEILLANCE DASHBOARD ---
  if (userDept === 'security') {
    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-wide">Security Operations Center (SOC)</h2>
            <p className="text-slate-400 mt-1">Unified view of physical camera feeds, keycard events, and security logs.</p>
          </div>
          <div className="text-right text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center">
            Threat Level: <span className="text-rose-400 font-bold ml-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span> ELEVATED</span>
          </div>
        </div>

        {getRolePrivilegeBanner()}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Active Threat Incidents</span>
            <h4 className="text-3xl font-bold text-white mt-2">{risks.length} <span className="text-sm text-slate-500 font-medium">Alerts</span></h4>
            <p className="text-xs text-slate-400 mt-2">Requires immediate audit / check</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">CCTV Feeds</span>
            <h4 className="text-3xl font-bold text-white mt-2">4 / 4 <span className="text-sm text-slate-500 font-medium">Online</span></h4>
            <p className="text-xs text-slate-400 mt-2">Scanline channels synced</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Access Points Status</span>
            <h4 className="text-3xl font-bold text-white mt-2">5 Active</h4>
            <p className="text-xs text-slate-400 mt-2">Smart Lock integrations secure</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Security Hub</span>
            <h4 className="text-3xl font-bold text-white mt-2">MONITORED</h4>
            <p className="text-xs text-slate-400 mt-2">ARGUS Perception services fully online</p>
          </div>
        </div>

        {/* Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Cameras feed mock */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Video size={20} className="text-rose-400" />
                Live CCTV Camera Surveillance Feeds
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {cctvFeeds.map(cam => (
                  <div key={cam.id} className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 group">
                    {/* Pulsing red REC dot */}
                    <div className="absolute top-3 left-3 bg-red-600/90 text-[10px] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1.5 z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      REC
                    </div>
                    {/* Camera Title */}
                    <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 font-mono bg-black/60 px-2 py-0.5 rounded z-10">
                      {cam.name}
                    </div>
                    {/* Simulated Static noise overlay */}
                    <div className="absolute inset-0 bg-slate-900/10 pointer-events-none mix-blend-overlay z-0 opacity-40 animate-pulse bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="absolute inset-0 bg-emerald-500/5 mix-blend-color pointer-events-none" />
                    
                    {/* Dynamic Text to look realistic */}
                    <div className="absolute inset-0 flex flex-col justify-center items-center text-xs text-emerald-400/30 font-mono select-none">
                      <span>SCANNING CHANNEL...</span>
                      <span>RESOLUTION: 1080P @ 30FPS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Interactive Threat Graph Link */}
            <div className="glass p-6 rounded-2xl flex items-center justify-between border border-rose-500/20 bg-rose-500/5">
              <div className="space-y-1">
                <h4 className="font-bold text-white">Need to investigate room-keycard access anomalies?</h4>
                <p className="text-xs text-slate-400">Open the 2D Relationship Intelligence Graph to trace user keys, room check-ins, and guest details.</p>
              </div>
              <button 
                onClick={() => navigate('/dashboard/intelligence')}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
              >
                Inspect Graph
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Incident Control</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/dashboard/intelligence')}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert size={16} /> Acknowledge Threat Alerts
                  </span>
                  <ChevronRight size={16} />
                </button>
                
                <button 
                  disabled={activeRole === 'viewer'}
                  onClick={() => alert("Simulating Security Patrol dispatch ticket...")}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 font-bold rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Activity size={16} /> Dispatch Guard Patrol
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Physical Alerts Threat List */}
            <div className="glass p-6 rounded-2xl h-[330px] flex flex-col">
              <h3 className="text-sm font-bold text-white mb-3">Live Incident Alerts</h3>
              <div className="flex-1 overflow-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                {risks.length > 0 ? risks.map((risk, idx) => (
                  <div key={idx} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between font-bold text-rose-300">
                      <span>Threat Score: {risk.risk_score.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-500">ALERT</span>
                    </div>
                    <p className="text-slate-400 font-bold">{risk.entity_identifier}</p>
                    <p className="text-xs text-slate-500 capitalize">{risk.entity_type} flag detected by Argus OS</p>
                  </div>
                )) : (
                  <div className="text-slate-500 text-xs italic flex h-full items-center justify-center">No active incidents.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: FINANCE & BILLING DASHBOARD ---
  if (userDept === 'finance') {
    const totalPosSales = posOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-wide">Financial & Billing Operations</h2>
            <p className="text-slate-400 mt-1">Gross revenue collections, POS terminal billing, and tax audit compliance.</p>
          </div>
          <button 
            onClick={handleManualRefresh} 
            disabled={refreshing}
            className="text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 hover:border-indigo-500/30 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refresh Balances' : 'Sync Invoices'}
          </button>
        </div>

        {getRolePrivilegeBanner()}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">POS Restaurant Sales</span>
            <h4 className="text-3xl font-bold text-white mt-2">₦{totalPosSales.toLocaleString()}</h4>
            <p className="text-xs text-slate-400 mt-2">{posOrders.length} processed orders</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Unpaid Folios</span>
            <h4 className="text-3xl font-bold text-white mt-2">3 <span className="text-sm text-slate-500 font-medium">Pending</span></h4>
            <p className="text-xs text-slate-400 mt-2">Awaiting checkout payments</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">IRS Compliance Status</span>
            <h4 className="text-3xl font-bold text-white mt-2">COMPLIANT</h4>
            <p className="text-xs text-slate-400 mt-2">0 Tax audit anomalies flags</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Compute Tokens Balance</span>
            <h4 className="text-3xl font-bold text-white mt-2">{(data.balance?.conversations_remaining || 0).toLocaleString()}</h4>
            <p className="text-xs text-slate-400 mt-2">Recharges automated</p>
          </div>
        </div>

        {/* Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl h-[400px] flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-400" />
                Revenue Collections & Invoice Flow (Mon - Sun)
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockRevenueData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* POS Billing Orders Table */}
            <div className="glass p-6 rounded-2xl flex flex-col h-[280px]">
              <h3 className="text-lg font-bold text-white mb-4">Recent Restaurant Orders & POS Billing</h3>
              <div className="flex-1 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {posOrders.length > 0 ? (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500 font-bold">
                        <th className="py-2">Order ID</th>
                        <th className="py-2">Items</th>
                        <th className="py-2">Total Amount</th>
                        <th className="py-2">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posOrders.map((ord, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 text-slate-400 font-mono text-xs">{ord.id?.slice(0, 8) || "ord_9f82"}</td>
                          <td className="py-2 text-white font-semibold">{ord.items || "Restaurant Charge"}</td>
                          <td className="py-2">₦{(ord.total_amount || 0).toLocaleString()}</td>
                          <td className="py-2">
                            {ord.payment_status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold uppercase">Paid</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold uppercase">Charged to Room</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    No restaurant POS orders logged.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Financial Controls</h3>
              <div className="space-y-3">
                <button 
                  disabled={activeRole === 'viewer'}
                  onClick={() => navigate('/dashboard/sales')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign size={16} /> Open Sales & Invoices
                  </span>
                  <ChevronRight size={16} />
                </button>

                <button 
                  onClick={() => navigate('/dashboard/subscription')}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Landmark size={16} /> Subscription & Billing
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Compliance Feed */}
            <div className="glass p-6 rounded-2xl h-[330px] flex flex-col">
              <h3 className="text-sm font-bold text-white mb-3">Compliance & IRS Audit Logs</h3>
              <div className="flex-1 overflow-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-emerald-300">
                    <span>Tax Reporting Sync</span>
                    <span className="text-[10px] text-emerald-400">COMPLIANT</span>
                  </div>
                  <p className="text-slate-400">Synced end-of-day hospitality folios to Nigeria IRS module connector.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>Invoice Hash Created</span>
                    <span className="text-[10px] text-slate-500">SYNCED</span>
                  </div>
                  <p className="text-slate-400">SHA256 checksum generated for folio fol_5a289b4.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3.5: RESTAURANT & POS WORKSPACE ---
  if (userDept === 'restaurant' || userDept === 'kitchen' || userDept === 'bar') {
    const totalOrders = posOrders.length;
    const pendingOrders = posOrders.filter(o => o.payment_status !== 'paid').length;
    const totalSales = posOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-wide">Restaurant & POS Food Operations</h2>
            <p className="text-slate-400 mt-1">Real-time table orders, kitchen queue monitoring, and POS transactions.</p>
          </div>
          <button 
            onClick={handleManualRefresh} 
            disabled={refreshing}
            className="text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 hover:border-indigo-500/30 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing POS...' : 'Sync POS'}
          </button>
        </div>

        {getRolePrivilegeBanner()}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Active POS Orders</span>
            <h4 className="text-3xl font-bold text-white mt-2">{totalOrders} <span className="text-sm text-slate-500 font-medium">Logged</span></h4>
            <p className="text-xs text-slate-400 mt-2">Active restaurant tickets</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Unpaid / Folio Charged</span>
            <h4 className="text-3xl font-bold text-white mt-2">{pendingOrders} <span className="text-sm text-slate-500 font-medium">Tickets</span></h4>
            <p className="text-xs text-slate-400 mt-2">Charged to guest rooms</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Today's POS Revenue</span>
            <h4 className="text-3xl font-bold text-white mt-2">₦{totalSales.toLocaleString()}</h4>
            <p className="text-xs text-slate-400 mt-2">Gross restaurant billing</p>
          </div>
          <div className="glass p-6 rounded-2xl border border-white/10">
            <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Inventory Status</span>
            <h4 className="text-3xl font-bold text-white mt-2">94%</h4>
            <p className="text-xs text-slate-400 mt-2">F&B stock levels healthy</p>
          </div>
        </div>

        {/* Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Orders List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl flex flex-col h-[400px]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Coffee size={20} className="text-indigo-400" />
                Live Restaurant Orders & Dining POS
              </h3>
              <div className="flex-1 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {posOrders.length > 0 ? (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500 font-bold">
                        <th className="py-2">Order ID</th>
                        <th className="py-2">Items</th>
                        <th className="py-2">Total Amount</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posOrders.map((ord, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 text-slate-400 font-mono text-xs">{ord.id?.slice(0, 8) || `ord_${idx}`}</td>
                          <td className="py-3 font-semibold text-white">{ord.items || "F&B Charge"}</td>
                          <td className="py-3">₦{(ord.total_amount || 0).toLocaleString()}</td>
                          <td className="py-3">
                            {ord.payment_status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold uppercase">Paid</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold uppercase">Room Charge</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    No active restaurant orders logged today.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Dining Console</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/dashboard/hotels/restaurant')}
                  disabled={activeRole === 'viewer'}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Coffee size={16} /> Open Restaurant POS
                  </span>
                  <ChevronRight size={16} />
                </button>

                <button 
                  onClick={() => navigate('/dashboard/hotels/inventory')}
                  disabled={activeRole === 'viewer'}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 font-bold rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2">
                    <Package size={16} /> Inventory Stock Levels
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 4: GENERAL / MASTER DASHBOARD (Original Dashboard) ---
  const mainStats = [
    { label: 'Conversations', value: data.overview?.total_conversations || 0, sub: 'Active syncs', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Pipeline', value: `$${(data.overview?.pipeline_value || 0).toLocaleString()}`, sub: 'Estimated value', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Physical Alerts', value: risks.length, sub: 'Active incidents', icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Appointments', value: data.overview?.upcoming_appointments ?? 0, sub: `${data.overview?.total_appointments || 0} total scheduled`, icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* Top Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-wide">Platform Intelligence</h2>
          <p className="text-slate-400 mt-1">Unified view of physical operations and digital workflows.</p>
        </div>
        <button 
          onClick={handleManualRefresh} 
          disabled={refreshing}
          className="text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 hover:border-indigo-500/30 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'System Synced'}
        </button>
      </div>

      {getRolePrivilegeBanner()}

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat) => (
          <div key={stat.label} className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700`} />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} border border-white/5`}>
                <stat.icon size={22} />
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium relative z-10">{stat.label}</p>
            <h4 className="text-3xl font-bold text-white mt-1 relative z-10">{stat.value}</h4>
            <p className="text-xs text-slate-500 mt-2 relative z-10">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Dynamic Industry Control Center Widgets */}
      {installedModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-indigo-400" />
            Industry Operational Control Center
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {installedModules.flatMap(mod => 
              (mod.ui_extensions?.dashboard_widgets || []).map(widget => (
                <div key={widget.id} className="glass p-6 rounded-2xl border border-white/10 flex items-center justify-between group hover:border-indigo-500/30 transition-all duration-300">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{mod.name}</span>
                    <h4 className="text-md font-bold text-slate-200 mt-1">{widget.title}</h4>
                    <p className="text-2xl font-black text-white mt-2">
                      {widget.config?.value || (widget.type === 'chart' ? '📈 Live Analytics' : '📡 Monitoring')}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 text-slate-400 group-hover:text-indigo-400 rounded-xl transition-colors">
                    <Activity size={24} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Intelligence & Security (ARGUS) */}
        <div className="lg:col-span-1 space-y-8">
          {/* Security Intelligence Panel */}
          <div className="glass p-6 rounded-2xl flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <ShieldAlert size={20} className="text-rose-400" />
              Physical Security Alerts
            </h3>
            <div className="flex-1 overflow-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 pr-2">
              {risks.length > 0 ? risks.map((risk, idx) => (
                <div key={idx} className="glass-card p-4 rounded-xl flex items-center justify-between group hover:border-rose-500/30 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 group-hover:bg-rose-500/20 transition-colors">
                      <Activity size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{risk.entity_identifier}</h4>
                      <p className="text-xs text-slate-500 capitalize">{risk.entity_type} Detected</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md">
                      {risk.risk_score.toFixed(1)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                  No active incidents.
                </div>
              )}
            </div>
            <button onClick={() => navigate('/dashboard/intelligence')} className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors border border-white/10">
              Open Intelligence Graph
            </button>
          </div>

          {/* AI Sales Copilot Section */}
          <div className="relative p-6 rounded-2xl overflow-hidden glass border border-indigo-500/30 bg-indigo-900/10">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />
             <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                       <Zap size={20} className="text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Digital Automation</h3>
                 </div>
                 {insights?.insights?.length > 0 ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                            <h4 className="text-sm font-bold text-indigo-300 mb-1">Stalled Lead: {insights.insights[0].lead_name}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed italic">
                              "{insights.insights[0].recommendation}"
                            </p>
                        </div>
                        <button onClick={() => navigate('/dashboard/conversations')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
                           Execute Workflow
                        </button>
                    </div>
                 ) : (
                    <p className="text-sm text-slate-400">All digital workflows are running optimally.</p>
                 )}
             </div>
          </div>
        </div>

        {/* Right Column: Business Metrics */}
        <div className="lg:col-span-2 space-y-8">
            
          {/* Conversation Funnel */}
          <div className="glass p-6 rounded-2xl h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target size={20} className="text-emerald-400" />
                Digital Lead Funnel
              </h3>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.funnel_data || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="stage" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="var(--indigo)" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row inside Right Col */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Customer Sentiment */}
            <div className="glass p-6 rounded-2xl h-[300px] flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Heart size={20} className="text-indigo-400" />
                Interaction Sentiment
              </h3>
              <div className="flex-1 flex flex-col items-center justify-center">
                {data?.sentiment_analysis && data.sentiment_analysis.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.sentiment_analysis}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {data.sentiment_analysis.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-500 text-sm italic">No interaction data available.</div>
                )}
              </div>
            </div>

            {/* Quota / Tokens */}
            <div className="glass p-6 rounded-2xl h-[300px] flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageCircle size={20} className="text-blue-400" />
                Compute Usage
              </h3>
              <div className="flex-1 flex flex-col justify-center">
                 <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm text-slate-400">Tokens Remaining</span>
                      <span className="text-2xl font-black text-white">{(data?.balance?.conversations_remaining || 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
                       <div 
                        className="bg-gradient-to-r from-indigo-500 to-blue-400 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                        style={{ width: `${Math.min(100, ((data?.balance?.conversations_remaining || 0) / 500) * 100)}%` }} 
                       />
                    </div>
                 </div>
                 <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-sm mb-2">
                       <span className="text-slate-400">AI Resolutions</span>
                       <span className="text-white font-bold">{data?.ai_resolution_rate?.resolved_by_ai || 0}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-400">Avg Response Time</span>
                       <span className="text-white font-bold">{data?.overview?.avg_response_time || "0m"}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
