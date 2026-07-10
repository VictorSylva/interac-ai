import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, MessageCircle, TrendingUp, Calendar, ShieldCheck, Target, Heart, Zap, ShieldAlert, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

const COLORS = ['#6366f1', '#818cf8', '#4f46e5', '#312e81', '#1e1b4b'];
const SENTIMENT_COLORS = {
  Positive: '#10b981',
  Neutral: '#64748b',
  Negative: '#ef4444'
};

export default function DashboardOverview() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        if (!currentUser) return;
        const apiHost = process.env.REACT_APP_API_URL || 'http://localhost:8080';
        
        try {
            const businessId = currentUser.business_id || currentUser.email || "default";
            const [analyticsRes, insightsRes, balanceRes, risksRes] = await Promise.all([
                fetch(`${apiHost}/api/analytics?business_id=${encodeURIComponent(businessId)}`),
                fetch(`${apiHost}/api/analytics/insights?business_id=${encodeURIComponent(businessId)}`),
                fetch(`${apiHost}/api/tokens/balance?business_id=${encodeURIComponent(businessId)}`),
                fetch(`${apiHost}/api/v1/intelligence/top-risks?limit=5`)
            ]);
            
            const [analyticsJson, insightsJson, balanceJson, risksJson] = await Promise.all([
                analyticsRes.ok ? analyticsRes.json() : null,
                insightsRes.ok ? insightsRes.json() : null,
                balanceRes.ok ? balanceRes.json() : null,
                risksRes.ok ? risksRes.json() : []
            ]);
            
            if (analyticsJson) setData({ ...analyticsJson, balance: balanceJson });
            if (insightsJson) setInsights(insightsJson);
            if (Array.isArray(risksJson)) setRisks(risksJson);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, [currentUser]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader message="Initializing Command Center..." /></div>;
  if (!data) return <div className="p-6 text-center text-slate-400">Unable to load command center data.</div>;

  const mainStats = [
    { label: 'Conversations', value: data.overview?.total_conversations || 0, sub: 'Active syncs', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Pipeline', value: `$${(data.overview?.pipeline_value || 0).toLocaleString()}`, sub: 'Estimated value', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Physical Alerts', value: risks.length, sub: 'Active incidents', icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Appointments', value: data.overview?.total_appointments || 0, sub: 'Upcoming', icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* Top Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-wide">Platform Intelligence</h2>
          <p className="text-slate-400 mt-1">Unified view of physical operations and digital workflows.</p>
        </div>
        <div className="text-right text-sm text-slate-400 glass px-4 py-2 rounded-xl border border-white/10 flex items-center">
           Live status: <span className="text-emerald-400 font-bold ml-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ACTIVE</span>
        </div>
      </div>

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
