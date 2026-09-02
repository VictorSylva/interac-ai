import React, { useState, useEffect } from 'react';
import { Shield, Eye, AlertTriangle, ShieldAlert, Users, TrendingUp, RefreshCw, Layers } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailSecurity({ orgId }) {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([
    { id: 'alert_01', timestamp: new Date().toISOString(), camera: 'CAM-04-Aisle4', event: 'High Loitering count detected', severity: 'WARNING', aisle: 'Aisle 4 (Liquor cabinet)', confidence: 0.82, status: 'Active' },
    { id: 'alert_02', timestamp: new Date(Date.now() - 1800000).toISOString(), camera: 'CAM-01-Entrance', event: 'VIP Customer recognized', severity: 'INFO', customer: 'Chioma Nze (Platinum Level)', confidence: 0.96, status: 'Logged' },
    { id: 'alert_03', timestamp: new Date(Date.now() - 7200000).toISOString(), camera: 'CAM-09-Checkout2', event: 'POS Sweethearting exception scanner mismatch', severity: 'CRITICAL', cashier: 'Abigail Udoh', confidence: 0.88, status: 'Escalated to Store Manager' }
  ]);
  const [peopleCount, setPeopleCount] = useState(38);
  const [checkoutQueueLength, setCheckoutQueueLength] = useState(4);

  useEffect(() => {
    fetchAlerts();
  }, [orgId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/security/alerts?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAlert = async (type) => {
    let details = {};
    let location = 'Aisle 4';
    let severity = 'WARNING';
    let impact = 0.4;

    if (type === 'sweethearting') {
      details = { cashier: 'Abigail Udoh', item: 'Sony Headphones', cost: 45000 };
      location = 'Checkout Lane 3';
      severity = 'CRITICAL';
      impact = 0.8;
    } else if (type === 'intrusion') {
      details = { location: 'Warehouse Stockroom A', access_card: 'Unauthorized' };
      location = 'Stockroom Door';
      severity = 'HIGH';
      impact = 0.6;
    } else {
      details = { count: 8, dwell_minutes: 12 };
      location = 'Aisle 4 (Premium Spirits)';
      severity = 'WARNING';
      impact = 0.3;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/security/simulate-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          source: 'cctv_yolo',
          event_type: `cctv_${type}_detected`,
          location: location,
          details: details,
          severity: severity,
          confidence: 0.92,
          risk_impact: impact
        })
      });
      if (res.ok) {
        fetchAlerts();
        alert("Argus OS simulated signal injected successfully.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Shield className="w-4 h-4" /> Surveillance Intelligence (Argus OS)
          </div>
          <h2 className="text-3xl font-extrabold text-white">Supermarket Loss Prevention Center</h2>
          <p className="text-slate-400 mt-1">Simulate sweethearting fraud, monitor loitering counts, and map customer crowd hotspots.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={fetchAlerts} 
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Alerts
          </button>
        </div>
      </div>

      {/* ANCHOR TELEMETRY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/10 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Live Customer Count</p>
          <h3 className="text-3xl font-black text-white mt-2">{peopleCount} People</h3>
          <p className="text-slate-500 text-[10px] mt-1 font-mono">Aggregated across 12 CCTV streams</p>
        </div>
        <div className="glass p-6 rounded-3xl border border-white/10 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Checkout Congestion</p>
          <h3 className="text-3xl font-black text-white mt-2">{checkoutQueueLength} Queue avg</h3>
          <p className="text-slate-500 text-[10px] mt-1 font-mono">Queue length target &lt; 5 shoppers</p>
        </div>
        <div className="glass p-6 rounded-3xl border border-white/10 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Alarms</p>
          <h3 className="text-3xl font-black text-rose-400 mt-2">{alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'WARNING').length} Alarms</h3>
          <p className="text-slate-500 text-[10px] mt-1 font-mono">CCTV scans and loitering triggers</p>
        </div>
      </div>

      {/* CORE ALERTS FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LIVE EVENTS TIMELINE */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" /> Argus Surveillance Alerts Feed
          </h3>

          <div className="space-y-4">
            {alerts.map(a => (
              <div key={a.id || a.timestamp} className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-300 flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      a.severity === 'CRITICAL' 
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                        : a.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {a.severity}
                    </span>
                    <span className="font-bold text-white font-mono">{a.camera}</span>
                  </div>
                  <p className="font-bold text-slate-200 mt-1">{a.event}</p>
                  <pre className="text-[10px] text-slate-400 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(a.customer || a.cashier || a.aisle || a.details || 'Loitering alert trigger')}</pre>
                </div>
                <div className="text-right text-[10px] text-slate-500 space-y-1 font-mono">
                  <p>{new Date(a.timestamp).toLocaleTimeString()}</p>
                  <p className="text-emerald-400 font-bold">Conf: {(a.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNAL INJECTION PANEL */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400" /> Inject Simulated Signals
          </h3>
          <p className="text-xs text-slate-400">Trigger simulated camera events directly into the Observation Bus to verify Argus OS detection flows.</p>

          <div className="space-y-3">
            <button 
              onClick={() => handleSimulateAlert('sweethearting')}
              className="w-full py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all text-left px-5 flex justify-between items-center"
            >
              <span>POS Sweethearting Skip</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </button>

            <button 
              onClick={() => handleSimulateAlert('intrusion')}
              className="w-full py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all text-left px-5 flex justify-between items-center"
            >
              <span>Stockroom Door Intrusion</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </button>

            <button 
              onClick={() => handleSimulateAlert('loitering')}
              className="w-full py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all text-left px-5 flex justify-between items-center"
            >
              <span>High Spirits Loitering Aisle 4</span>
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
            </button>
          </div>

          {/* CROWD HOTSPOT SKETCH */}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Users className="w-4 h-4 text-amber-400" /> Live Store Hotmap Visual</h4>
            <div className="bg-white/5 rounded-2xl border border-white/5 p-4 text-[10px] space-y-2 text-slate-400">
              <div className="flex justify-between items-center">
                <span>Produce Section (Aisle 1)</span>
                <span className="text-emerald-400 font-bold">Low density</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Dairies (Aisle 5)</span>
                <span className="text-amber-400 font-bold">Medium density</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Spirits Cabinet (Aisle 4)</span>
                <span className="text-rose-400 font-bold animate-pulse">Critical dwell loitering</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
