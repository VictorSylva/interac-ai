import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Camera, Activity, MapPin, Network } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { API_BASE_URL } from '../config';

export default function IntelligenceView() {
  const [entities, setEntities] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  // Single Unified API Host
  const API_HOST = API_BASE_URL;


  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  const fetchIntelligenceData = async () => {
    try {
      setLoading(true);
      
      // Fetch high risk entities
      const resEnt = await fetch(`${API_HOST}/api/v1/intelligence/top-risks?limit=50`);
      if (resEnt.ok) {
        const dataEnt = await resEnt.json();
        if (Array.isArray(dataEnt)) {
          setEntities(dataEnt);
        } else {
          setEntities([]);
        }
      }

      // Fetch graph topology
      const resGraph = await fetch(`${API_HOST}/api/v1/intelligence/graph-topology`);
      if (resGraph.ok) {
        const dataGraph = await resGraph.json();
        if (dataGraph && dataGraph.nodes && dataGraph.links) {
          setGraphData(dataGraph);
        }
      }

    } catch (e) {
      console.error('Error fetching intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const getEntityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'person': return <Users size={16} />;
      case 'camera': return <Camera size={16} />;
      case 'location': return <MapPin size={16} />;
      case 'vehicle': return <Activity size={16} />;
      default: return <Activity size={16} />;
    }
  };

  const getNodeColor = (node) => {
    if (node.status === 'alert') return '#ef4444'; // Red-500
    if (node.status === 'flagged') return '#f97316'; // Orange-500
    if (node.type === 'camera') return '#3b82f6'; // Blue-500
    if (node.type === 'zone') return '#a855f7'; // Purple-500
    return '#10b981'; // Emerald-500 (Active)
  };

  return (
    <div className="flex flex-col gap-6 h-[700px] animate-fade-in-up">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Network className="text-indigo-400" />
          Security Intelligence Graph
        </h2>
        <button 
          onClick={fetchIntelligenceData} 
          className="glass border border-white/10 hover:bg-white/10 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Refresh Graph Data
        </button>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        {/* Left Pane: Risk Leaderboard */}
        <div className="flex-none w-5/12 flex flex-col glass rounded-2xl shadow-sm border border-white/10 overflow-hidden">
          <h3 className="p-5 pb-4 text-lg font-bold text-white flex items-center gap-2 m-0 border-b border-white/10 bg-black/20">
            <ShieldAlert size={20} className="text-rose-400" />
            Risk Leaderboard
          </h3>
          <div className="flex-grow overflow-auto p-0 scrollbar-thin">
            {loading ? (
              <div className="text-center text-slate-400 p-8 mt-10">Loading risk entities...</div>
            ) : entities.length === 0 ? (
              <div className="text-center text-slate-400 p-8 mt-10">No risk entities found.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/40 sticky top-0 backdrop-blur-md">
                  <tr className="text-slate-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b border-white/10">Entity</th>
                    <th className="p-4 font-semibold border-b border-white/10">Type</th>
                    <th className="p-4 font-semibold border-b border-white/10 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entities.map(entity => (
                    <tr key={entity.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-semibold text-slate-200 text-sm">
                        {entity.entity_identifier}
                      </td>
                      <td className="p-4 text-slate-400">
                        <div className="flex items-center gap-2 capitalize text-sm">
                          <span className="text-indigo-400">{getEntityIcon(entity.entity_type)}</span>
                          {entity.entity_type}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-bold text-base ${
                          entity.risk_score >= 40 ? 'text-rose-400' : 
                          entity.risk_score >= 15 ? 'text-orange-400' : 'text-slate-300'
                        }`}>
                          {entity.risk_score.toFixed(1)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Pane: Interactive Graph */}
        <div className="flex-1 glass rounded-2xl shadow-inner border border-white/10 overflow-hidden relative group">
          {graphData.nodes.length > 0 && (
             <div className="absolute inset-0">
               <ForceGraph2D
                 graphData={graphData}
                 nodeLabel="name"
                 nodeColor={getNodeColor}
                 nodeRelSize={4}
                 linkColor={() => 'rgba(255, 255, 255, 0.15)'}
                 linkWidth={(link) => link.confidence ? link.confidence * 2 : 1}
                 linkDirectionalArrowLength={3.5}
                 linkDirectionalArrowRelPos={1}
                 backgroundColor="#0f172a" // Tailwind slate-900 equivalent for dark background
               />
             </div>
          )}
          {graphData.nodes.length === 0 && !loading && (
             <div className="p-10 text-center text-white/50 flex h-full items-center justify-center flex-col gap-4">
               <Network size={48} className="opacity-30" />
               <p>No graph topology data available.<br/>Trigger an event to map relationships.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
