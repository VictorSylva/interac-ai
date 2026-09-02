import React, { useState } from 'react';
import { Zap, Check, Loader2 } from 'lucide-react';

export default function EduIntegrationsPage() {
  const [syncing, setSyncing] = useState(null);
  const [connectors, setConnectors] = useState([
    { id: 'powerschool', name: "PowerSchool Integration", status: "CONNECTED", type: "SIS" },
    { id: 'facts', name: "FACTS SIS Connection", status: "CONNECTED", type: "SIS" },
    { id: 'infinite_campus', name: "Infinite Campus API", status: "DISCONNECTED", type: "SIS" },
    { id: 'blackbaud', name: "Blackbaud K-12 Cloud", status: "DISCONNECTED", type: "ERP" }
  ]);

  const handleSync = (id) => {
    setSyncing(id);
    setTimeout(() => {
      setSyncing(null);
      alert(`${id} data synced successfully.`);
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <Zap className="w-4 h-4" /> LEGACY CONNECTORS
        </div>
        <h2 className="text-3xl font-extrabold text-white">LMS / SIS Integrations Hub</h2>
        <p className="text-slate-400 mt-1">Connect InteracAI as an intelligence overlay for your existing school enterprise software.</p>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Available Enterprise API Connections</h3>
        <div className="space-y-4">
          {connectors.map(conn => (
            <div key={conn.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <h4 className="font-bold text-white text-sm">{conn.name}</h4>
                <div className="text-[10px] text-slate-500 font-mono mt-1">Type: {conn.type}</div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  conn.status === 'CONNECTED' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-800 text-slate-500 border border-white/5'
                }`}>
                  {conn.status}
                </span>
                {conn.status === 'CONNECTED' && (
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing === conn.id}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-bold transition flex items-center gap-1.5"
                  >
                    {syncing === conn.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    Sync Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
