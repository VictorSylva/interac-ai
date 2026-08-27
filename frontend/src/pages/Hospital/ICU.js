import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Plus, User, Heart, Lock, Loader2, AlertTriangle, AlertCircle, CheckCircle2
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function ICU({ orgId }) {
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);

  useEffect(() => {
    fetchTelemetry();
    
    // Set up continuous simulation polling (every 4 seconds)
    const interval = setInterval(() => {
      fetchTelemetry();
      setTriggerCount(prev => prev + 1);
    }, 4000);

    return () => clearInterval(interval);
  }, [orgId]);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/icu/monitoring?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data || []);
      }
    } catch (e) {
      console.error("Error loading telemetry:", e);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Activity className="w-4 h-4" /> CRITICAL CARE (ICU) telemetry
          </div>
          <h2 className="text-3xl font-extrabold text-white">ICU Central Vitals Monitor</h2>
          <p className="text-slate-400 mt-1">Continuous live diagnostic monitoring feeds from ward bedside monitors and ventilator telemetries.</p>
        </div>
        <div className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2 bg-rose-500/10 px-3.5 py-2 border border-rose-500/20 rounded-xl text-rose-300">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" /> Live Telemetry Feed (Sync count: {triggerCount})
        </div>
      </div>

      {/* Grid of Monitor Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {telemetry.map((feed, idx) => {
          const isCritical = feed.alert === 'CRITICAL';
          return (
            <div
              key={idx}
              className={`glass rounded-3xl border p-6 space-y-6 transition-all ${
                isCritical
                  ? 'border-rose-500 bg-rose-950/10 shadow-2xl shadow-rose-900/10'
                  : 'border-white/10'
              }`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-start pb-4 border-b border-white/5">
                <div>
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300">{feed.bed}</span>
                  <h3 className="text-lg font-bold text-white mt-1.5">{feed.patient_name}</h3>
                  <span className="text-[10px] font-mono text-slate-500 block">{feed.patient_id}</span>
                </div>
                
                {isCritical ? (
                  <span className="px-2.5 py-1 rounded-xl bg-rose-600/30 text-rose-300 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> Vitals Alarm
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Stable
                  </span>
                )}
              </div>

              {/* Vitals metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Heart Rate</span>
                  <span className={`text-3xl font-black mt-1 block flex items-center justify-center gap-1.5 ${isCritical && feed.heart_rate > 100 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                    <Heart className="w-6 h-6 fill-current" /> {feed.heart_rate} <span className="text-xs font-normal text-slate-500">bpm</span>
                  </span>
                </div>

                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Pulse Oximetry</span>
                  <span className={`text-3xl font-black mt-1 block ${feed.spo2 < 92 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                    {feed.spo2}% <span className="text-xs font-normal text-slate-500">SpO2</span>
                  </span>
                </div>

                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Blood Pressure</span>
                  <span className="text-xl font-bold text-white font-mono mt-2 block">{feed.blood_pressure}</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">mmHg</span>
                </div>

                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Respiration</span>
                  <span className="text-2xl font-black text-white font-mono mt-1.5 block">{feed.respiration_rate} <span className="text-xs font-normal text-slate-500">/min</span></span>
                </div>
              </div>

              {/* Ventilator details */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 block font-bold text-[9px] uppercase tracking-wider">Ventilator Integration</span>
                  <span className="text-white font-bold block mt-0.5">Mode: {feed.ventilator_mode}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block font-bold text-[9px] uppercase tracking-wider">Status Code</span>
                  <span className="text-emerald-400 font-bold block mt-0.5">SYNCHRONIZED</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
