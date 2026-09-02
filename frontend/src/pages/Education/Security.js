import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Loader2, Sparkles, AlertTriangle, ShieldAlert, Play } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduSecurityPage({ orgId }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [orgId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/security/cctv-alerts?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAlert = async (type, severity, location, camera) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/security/cctv-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          detection_type: type,
          camera_id: camera,
          location_label: location,
          severity: severity
        })
      });
      if (res.ok) {
        fetchAlerts();
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
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Shield className="w-4 h-4" /> ARGUS SURVEILLANCE OS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Campus Security & CCTV Analytics</h2>
          <p className="text-slate-400 mt-1">Monitor real-time security alerts, fight detections, unauthorized perimeter entry, and class loitering.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" /> Argus CV Ingestion Feed
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Alert Event</th>
                    <th className="p-4">Camera ID</th>
                    <th className="p-4">Zone / Location</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
                  ) : alerts.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No CCTV surveillance alerts detected. All zones secure.</td></tr>
                  ) : alerts.map(a => (
                    <tr key={a.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{a.display_label}</td>
                      <td className="p-4 font-mono text-cyan-300">{a.attributes?.camera_id}</td>
                      <td className="p-4 text-slate-300">{a.attributes?.location_label}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          a.attributes?.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {a.attributes?.severity}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{new Date(a.attributes?.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CCTV Trigger Simulator */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-4">Argus OS Event Simulator</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Injects synthetic events into the Argus Computer Vision pipeline. Triggering critical alerts automatically updates the Observation Bus.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleSimulateAlert('FIGHT', 'HIGH', 'Male Dorm Courtyard', 'CAM-DORM-04')}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-rose-600/20 text-rose-200 border border-rose-500/30 hover:bg-rose-600/30 transition flex items-center justify-center gap-2 font-bold text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Simulate Courtyard Fight Alert
              </button>
              <button
                onClick={() => handleSimulateAlert('PERIMETER_ENTRY', 'HIGH', 'Back Gate Fence', 'CAM-PERI-11')}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-rose-600/20 text-rose-200 border border-rose-500/30 hover:bg-rose-600/30 transition flex items-center justify-center gap-2 font-bold text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Simulate Unauthorized Gate Entry
              </button>
              <button
                onClick={() => handleSimulateAlert('LOITERING', 'WARNING', 'Main Library Corridor', 'CAM-LIB-02')}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-amber-600/20 text-amber-200 border border-amber-500/30 hover:bg-amber-600/30 transition flex items-center justify-center gap-2 font-bold text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Simulate Student Corridor Loitering
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
