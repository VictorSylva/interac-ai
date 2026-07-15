import React, { useState, useEffect } from 'react';
import { Clock, Search, MapPin, Database, MessageSquare, ShieldAlert, CreditCard, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export default function TimelineViewer() {
  const [entityId, setEntityId] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  const API_HOST = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!entityId.trim()) return;

    setLoading(true);
    setError('');
    setTimeline([]);

    try {
      const res = await fetch(`${API_HOST}/api/v2/timeline/${entityId.trim()}`);
      if (!res.ok) {
        throw new Error(`Failed to load timeline: ${res.statusText}`);
      }
      const data = await res.json();
      setTimeline(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Entity not found or server error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getSourceIcon = (source) => {
    switch (source?.toLowerCase()) {
      case 'whatsapp': 
      case 'web': 
      case 'email': 
        return <MessageSquare size={16} className="text-indigo-400" />;
      case 'cameras': 
        return <Eye size={16} className="text-blue-400" />;
      case 'payments': 
        return <CreditCard size={16} className="text-emerald-400" />;
      case 'fusion_engine':
      case 'autonomous_intel':
        return <ShieldAlert size={16} className="text-rose-400" />;
      default: 
        return <Database size={16} className="text-slate-400" />;
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[720px] animate-fade-in-up">
      {/* Search Header */}
      <div className="glass rounded-2xl p-5 border border-white/10 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 m-0">
            <Clock className="text-indigo-400" />
            Audit Timeline Viewer
          </h2>
          <p className="text-slate-400 text-xs mt-1">Cross-system chronological history reconstructor</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="flex bg-black/40 border border-white/10 rounded-xl px-3 py-2 items-center w-full md:w-80 focus-within:border-indigo-500 transition-all">
            <Search className="text-slate-500 mr-2" size={18} />
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Search entity (e.g. 23480350..., cam_1, order_id)"
              className="bg-transparent border-none outline-none text-white placeholder:text-slate-500 text-sm w-full"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            Query
          </button>
        </form>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-black/10">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            <span>Reconstructing timeline history...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-rose-400 font-semibold p-8 text-center">{error}</div>
        ) : timeline.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 p-8 text-center">
            <Clock size={48} className="opacity-20" />
            <p className="text-sm">Input a registered customer phone number, camera ID, or transaction reference code above to compile audit traces.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-thin">
            <div className="relative border-l-2 border-indigo-500/20 pl-6 ml-4 flex flex-col gap-6">
              {timeline.map((item, idx) => (
                <div key={item.observation_id || idx} className="relative group animate-fade-in-up">
                  {/* Timeline Dot & Icon */}
                  <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                    {getSourceIcon(item.source_system)}
                  </div>

                  {/* Context Block */}
                  <div className="glass hover:bg-white/5 border border-white/10 rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-white/5 font-bold uppercase">
                          {item.source_system}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${getSeverityColor(item.severity)}`}>
                          {item.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <MapPin size={12} className="text-slate-500" />
                        {item.location}
                      </div>
                    </div>

                    <p className="text-slate-200 text-sm font-medium leading-relaxed">
                      {item.description}
                    </p>

                    {/* Metadata Inspect */}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleExpand(item.observation_id || idx)}
                          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all"
                        >
                          {expandedItems[item.observation_id || idx] ? (
                            <>Hide Parameters <ChevronUp size={12} /></>
                          ) : (
                            <>Inspect Parameters <ChevronDown size={12} /></>
                          )}
                        </button>

                        {expandedItems[item.observation_id || idx] && (
                          <pre className="mt-2 p-3 rounded-lg bg-black/50 border border-white/5 text-xs font-mono text-slate-300 overflow-x-auto">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
