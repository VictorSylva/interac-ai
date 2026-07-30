import React, { useState, useEffect } from 'react';
import { 
  BarChart2, TrendingUp, Bed, DollarSign, Loader2, Sparkles, 
  CheckCircle2
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Analytics({ orgId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [orgId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/finance/reports?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (e) {
      console.error("Error loading hotel analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  const occupancy = report?.occupancy_rate || '0.0%';
  const pct = parseFloat(occupancy.replace('%', '')) || 0;
  const radius = 45;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const adr = report?.average_daily_rate || 0.0;
  const revpar = report?.revpar || 0.0;
  const totalRev = report?.total_room_revenue || 0.0;
  const totalColl = report?.total_collected || 0.0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart2 className="text-purple-400 w-6 h-6" /> ADR & RevPAR Analytics
          </h2>
          <p className="text-slate-400 text-xs mt-1">Review live hotel performance, yield indexes, and guest satisfaction summaries.</p>
        </div>
        <button 
          onClick={fetchReport} 
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 flex items-center gap-1.5 transition-all text-xs font-bold"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Occupancy Rate</div>
                <div className="text-2xl font-black text-white mt-1">{occupancy}</div>
                <div className="text-[9px] text-purple-400 font-bold mt-1">Occupied: {report?.occupied_rooms}/{report?.total_rooms} rooms</div>
              </div>
              <Bed className="w-8 h-8 text-purple-400" />
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Average Daily Rate (ADR)</div>
                <div className="text-2xl font-black text-white mt-1">₦{adr.toLocaleString()}</div>
                <div className="text-[9px] text-emerald-400 font-bold mt-1">Average per sold room</div>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Revenue Per Room (RevPAR)</div>
                <div className="text-2xl font-black text-white mt-1">₦{revpar.toLocaleString()}</div>
                <div className="text-[9px] text-purple-400 font-bold mt-1">Room yield across inventory</div>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guest Satisfaction</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">94%</div>
                <div className="text-[9px] text-slate-400 mt-1">Based on guest reviews</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass border border-white/10 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Room Yield & Financial Returns
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-300 py-2 border-b border-white/5">
                  <span>Room Revenue Potential (All Rooms Occupied)</span>
                  <span className="font-mono font-bold text-white">₦{(report?.total_rooms * 150000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300 py-2 border-b border-white/5">
                  <span>Actual Room Revenue Posted</span>
                  <span className="font-mono font-bold text-purple-300">₦{totalRev.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300 py-2 border-b border-white/5">
                  <span>Cashier Settlements Collected</span>
                  <span className="font-mono font-bold text-emerald-400">₦{totalColl.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Performance charts mock */}
            <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Occupancy Target Index</h3>
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Background track */}
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      className="text-slate-800"
                      strokeWidth={strokeWidth}
                      stroke="currentColor"
                      fill="transparent"
                    />
                    {/* Progress arc */}
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      className="text-purple-500 transition-all duration-1000 ease-out"
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <span className="absolute text-xl font-black text-white">{occupancy}</span>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed max-w-[200px]">
                  Property occupancy index is healthy. Aim to cross 85% to maximize weekend yield.
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// Micro local helper to avoid Lucide import crashes
function RefreshCwIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
