import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Info } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduIntelligencePage({ orgId }) {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchGraph();
  }, [orgId]);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/knowledge-graph?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data || { nodes: [], links: [] });
        if (data?.nodes?.length > 0) {
          setSelectedNode(data.nodes[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <Sparkles className="w-4 h-4" /> KNOWLEDGE GRAPH
        </div>
        <h2 className="text-3xl font-extrabold text-white">Campus Entity Relationship Network</h2>
        <p className="text-slate-400 mt-1">AI-driven mapping linking students, registered guardians, teachers, classrooms, library logs, and security feeds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SVG Node Graph */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-3xl border border-white/10 p-6 h-[460px] flex flex-col justify-between relative overflow-hidden">
            <h3 className="text-lg font-bold text-white z-10 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" /> Network View
            </h3>

            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-black/20">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-2" />
                <span>Mapping relations graph...</span>
              </div>
            ) : graph.nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic">
                No student profiles registered to build graph maps.
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center relative">
                <svg className="w-full h-[320px] select-none" viewBox="0 0 500 300">
                  {/* Lines / Links */}
                  {graph.links.map((link, idx) => {
                    const sourceIdx = graph.nodes.findIndex(n => n.id === link.source);
                    const targetIdx = graph.nodes.findIndex(n => n.id === link.target);
                    if (sourceIdx === -1 || targetIdx === -1) return null;
                    
                    // Assign positions on a circle around root (250, 150)
                    const count = graph.nodes.length - 1;
                    const r = 100;
                    
                    const sourceX = link.source === 'school_root' ? 250 : 250 + r * Math.cos((sourceIdx * 2 * Math.PI) / count);
                    const sourceY = link.source === 'school_root' ? 150 : 150 + r * Math.sin((sourceIdx * 2 * Math.PI) / count);
                    const targetX = link.target === 'school_root' ? 250 : 250 + r * Math.cos((targetIdx * 2 * Math.PI) / count);
                    const targetY = link.target === 'school_root' ? 150 : 150 + r * Math.sin((targetIdx * 2 * Math.PI) / count);
                    
                    return (
                      <line
                        key={idx}
                        x1={sourceX}
                        y1={sourceY}
                        x2={targetX}
                        y2={targetY}
                        stroke="#ffffff1f"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {graph.nodes.map((node, idx) => {
                    const count = graph.nodes.length - 1;
                    const r = 100;
                    const x = node.id === 'school_root' ? 250 : 250 + r * Math.cos((idx * 2 * Math.PI) / count);
                    const y = node.id === 'school_root' ? 150 : 150 + r * Math.sin((idx * 2 * Math.PI) / count);
                    
                    return (
                      <g
                        key={node.id}
                        className="cursor-pointer group"
                        onClick={() => setSelectedNode(node)}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={node.id === 'school_root' ? 14 : 10}
                          fill={node.color || '#94a3b8'}
                          stroke={selectedNode?.id === node.id ? '#ffffff' : 'none'}
                          strokeWidth="2"
                        />
                        <text
                          x={x}
                          y={y - (node.id === 'school_root' ? 20 : 15)}
                          fill="#cbd5e1"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {node.label?.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
            <div className="text-[10px] text-slate-500 text-center font-mono">
              Click individual nodes to examine operational relationship payloads.
            </div>
          </div>
        </div>

        {/* Selected Node Details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass rounded-3xl border border-white/10 p-6 h-[460px] flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4"><Info className="w-5 h-5 text-cyan-400" /> Node Inspector</h3>
              {selectedNode ? (
                <div className="space-y-4 py-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Node Label:</span>
                    <div className="font-bold text-white text-sm mt-0.5">{selectedNode.label}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Node Type:</span>
                    <div className="font-mono text-cyan-300 mt-0.5">{selectedNode.type}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Hex Color Spec:</span>
                    <div className="font-mono text-slate-400 mt-0.5">{selectedNode.color}</div>
                  </div>
                  <div className="border-t border-white/5 pt-4 text-[10px] text-slate-400 leading-relaxed">
                    This entity matches registered DB records. The Observation Bus listens for state changes on this node to trigger workflows.
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic py-8 text-xs">No node selected.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
