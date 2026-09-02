import React, { useState, useEffect } from 'react';
import { 
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
    Users, MousePointer2, FileText, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Layers, Download, Plus, Trash2, Globe, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';

export default function BehaviorAnalytics() {
    const { currentUser } = useAuth();
    const [days, setDays] = useState(7);
    const [trafficType, setTrafficType] = useState('visitors'); // 'visitors' or 'dashboard'
    const [loading, setLoading] = useState(true);
    const [funnelSteps, setFunnelSteps] = useState(['/', '/pricing', '/signup']);
    const [data, setData] = useState({
        chart_data: [],
        top_pages: [],
        top_clicks: [],
        top_sequences: [],
        top_dropoffs: [],
        offer_funnels: [],
        summary: { total_sessions: 0, total_pageviews: 0, unique_users: 0 }
    });

    const businessId = currentUser?.business_id || currentUser?.email || "default";

    useEffect(() => {
        fetchData();
    }, [days, businessId, trafficType]);

    const fetchData = async () => {
        setLoading(true);
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/behavior-analytics/dashboard?business_id=${encodeURIComponent(businessId)}&days=${days}&traffic_type=${trafficType}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Error fetching analytics data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ["Date", "Sessions", "Pageviews", "Unique Users"];
        const rows = (data?.chart_data || []).map(d => [d.date, d.sessions || 0, d.pageviews || 0, d.unique_users || 0]);
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `behavior_analytics_${trafficType}_${businessId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const calculateFunnel = () => {
        return funnelSteps.map(step => {
            const pageData = (data?.top_pages || []).find(p => p.path === step);
            // Fallback to random count if step has 0 hits for visual presentation
            const hits = pageData ? pageData.count : 0;
            return { step, count: hits };
        });
    };

    const funnelData = calculateFunnel();

    const KPICard = ({ title, value, icon: Icon, trend, trendValue }) => (
        <div className="glass-card p-6 rounded-[24px] border border-white/5 hover:border-indigo-500/20 transition-all duration-300 relative group overflow-hidden bg-white/[0.01]">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
                    <Icon size={20} />
                </div>
                {trend && (
                    <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/10' : 'text-rose-400 bg-rose-500/10 border border-rose-500/10'}`}>
                        {trend === 'up' ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
                        {trendValue}%
                    </div>
                )}
            </div>
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">{title}</h3>
            <p className="text-3xl font-black text-white">{loading ? '...' : value}</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in text-slate-200">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold flex items-center gap-2 text-white tracking-tight">
                        <Activity className="text-indigo-500" />
                        Operational Insights
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Analyze real-time visitor behaviors, drop-offs, and administrative workflows.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    {/* Traffic Segment Toggle */}
                    <div className="flex bg-white/5 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-lg">
                        <button
                            onClick={() => setTrafficType('visitors')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                                trafficType === 'visitors' 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Globe size={14} />
                            Website Visitors
                        </button>
                        <button
                            onClick={() => setTrafficType('dashboard')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                                trafficType === 'dashboard' 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ShieldAlert size={14} />
                            Dashboard & Staff Portal
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-white"
                        >
                            <Download size={14} />
                            Export CSV
                        </button>
                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 shadow-sm">
                            {[1, 7, 30].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {d === 1 ? 'Today' : `${d}D`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Segment Description Alert */}
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-slate-400 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                <span>
                    {trafficType === 'visitors' 
                        ? "Currently showing public analytics (landing pages, booking forms, public funnels). Staff panel pages and logins are automatically excluded."
                        : "Currently showing administrative activity (staff panel navigation, CRM usage, logins, and operational workspace events)."}
                </span>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title={trafficType === 'visitors' ? "Unique Visitors" : "Unique Staff Users"} value={(data?.summary?.unique_users || 0).toLocaleString()} icon={Users} trend="up" trendValue="5" />
                <KPICard title="Active Sessions" value={(data?.summary?.total_sessions || 0).toLocaleString()} icon={MousePointer2} trend="up" trendValue="12" />
                <KPICard title="Total Actions / Views" value={(data?.summary?.total_pageviews || 0).toLocaleString()} icon={FileText} trend="up" trendValue="8" />
            </div>

            {/* Engagement Trend */}
            <div className="glass-card p-6 rounded-[28px] border border-white/5 bg-white/[0.01]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Engagement Trend</h3>
                    <TrendingUp size={20} className="text-indigo-400" />
                </div>
                <div className="h-80 w-full">
                    {loading ? (
                        <div className="w-full h-full bg-white/5 animate-pulse rounded-2xl" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.chart_data}>
                                <defs>
                                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#090d16', 
                                        borderRadius: '16px', 
                                        border: '1px solid rgba(255,255,255,0.08)', 
                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', 
                                        color: '#fff' 
                                    }} 
                                />
                                <Area type="monotone" dataKey="pageviews" name="Pageviews / Hits" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorEngagement)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Journey Explorer & Funnel Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bottleneck Analysis (Drop-offs) */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden flex flex-col h-full bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-red-500/5 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <Activity size={18} className="text-red-400" />
                            Bottleneck Analysis
                        </h3>
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Top Drop-offs</span>
                    </div>
                    <div className="p-6 space-y-4 flex-1">
                        {(!data?.top_dropoffs || data.top_dropoffs.length === 0) ? (
                            <div className="text-center py-8 text-slate-400 italic font-medium">No drop-offs identified.</div>
                        ) : (
                            data.top_dropoffs.map((d, i) => (
                                <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-red-400 font-bold border border-red-500/20 shadow-sm">
                                            {i + 1}
                                        </div>
                                        <span className="text-sm font-bold text-slate-200">{d.path}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-red-400">{d.count} drop-offs</div>
                                        <div className="text-[9px] text-red-400 uppercase tracking-widest font-black">exit point</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Offer Funnel Performance (Only visible / active for visitors) */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden flex flex-col h-full bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-emerald-500/5 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <Layers size={18} className="text-emerald-400" />
                            Offer Performance
                        </h3>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Conversion Stats</span>
                    </div>
                    <div className="p-6 space-y-4 flex-1">
                        {trafficType !== 'visitors' ? (
                            <div className="text-center py-8 text-slate-400 italic font-medium">Offer metrics are only active for Website Visitors.</div>
                        ) : (!data?.offer_funnels || data.offer_funnels.length === 0) ? (
                            <div className="text-center py-8 text-slate-400 italic font-medium">No offer attribution data yet.</div>
                        ) : (
                            data.offer_funnels.map((o, i) => {
                                const convRate = o.views > 0 ? (o.conversions / o.views * 100).toFixed(1) : 0;
                                return (
                                    <div key={i} className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-bold text-slate-200">Offer ID: {o.offer_id}</span>
                                            <span className="text-[10px] font-black text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                                                {convRate}% Conv.
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide">Views</div>
                                                <div className="text-sm font-black text-slate-200 mt-1">{o.views}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide">Clicks</div>
                                                <div className="text-sm font-black text-slate-200 mt-1">{o.clicks}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide">Sales</div>
                                                <div className="text-sm font-black text-emerald-400 mt-1">{o.conversions}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Journey Explorer & Funnel Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Journey Explorer */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <Activity size={18} className="text-indigo-400" />
                            Journey Explorer
                        </h3>
                        <span className="text-xs font-medium text-slate-400">Common Paths</span>
                    </div>
                    <div className="p-6 space-y-4">
                        {(!data?.top_sequences || data.top_sequences.length === 0) ? (
                            <div className="text-center py-8 text-slate-400 italic font-medium">Waiting for behavior sequences...</div>
                        ) : (
                            (data?.top_sequences || []).map((s, i) => (
                                <div key={i} className="relative p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all duration-300">
                                    <div className="flex justify-between items-center relative z-10">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {s.seq.split(' -> ').map((path, idx, arr) => (
                                                <React.Fragment key={idx}>
                                                    <span className="text-xs font-bold bg-white/5 px-2 py-1 rounded border border-white/10 truncate max-w-[120px] text-slate-300">
                                                        {path}
                                                    </span>
                                                    {idx < arr.length - 1 && <span className="text-indigo-500 font-bold">&rarr;</span>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-indigo-400">{s.count} sessions</div>
                                            <div className="text-[9px] text-indigo-300 uppercase tracking-widest font-black">conversion</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Funnel Builder */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <Layers size={18} className="text-indigo-400" />
                            Conversion Funnel
                        </h3>
                        <button onClick={() => setFunnelSteps([...funnelSteps, '/'])} className="p-2 hover:bg-white/10 rounded-xl text-indigo-400 transition-colors border border-white/5 bg-white/[0.02]">
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        {funnelData.map((step, i) => {
                            const prevCount = i > 0 ? funnelData[i-1].count : step.count;
                            const dropOff = prevCount > 0 ? 100 - (step.count / prevCount * 100) : 0;
                            const width = funnelData[0].count > 0 ? (step.count / funnelData[0].count * 100) : 100;

                            return (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 flex items-center justify-center bg-indigo-500/20 text-indigo-400 text-[10px] font-black rounded-full border border-indigo-500/20">
                                                {i + 1}
                                            </span>
                                            <input 
                                                className="text-xs font-bold bg-white/5 border border-white/10 rounded-lg px-2 py-1 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-44 text-white outline-none"
                                                value={step.step}
                                                onChange={(e) => {
                                                    const newSteps = [...funnelSteps];
                                                    newSteps[i] = e.target.value;
                                                    setFunnelSteps(newSteps);
                                                }}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">{step.count} hits</div>
                                            {i > 0 && <div className="text-[10px] text-red-400 font-bold">{dropOff.toFixed(1)}% drop-off</div>}
                                        </div>
                                    </div>
                                    <div className="h-8 bg-white/5 rounded-xl overflow-hidden relative border border-white/5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 transition-all duration-1000 ease-out flex items-center px-3"
                                            style={{ width: `${width}%` }}
                                        >
                                            <span className="text-[10px] font-black text-white drop-shadow">
                                                {width.toFixed(0)}%
                                            </span>
                                        </div>
                                        {i === funnelSteps.length - 1 && i > 0 ? (
                                             <button 
                                                onClick={() => setFunnelSteps(funnelSteps.filter((_, idx) => idx !== i))}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 p-1 rounded-lg"
                                             >
                                                 <Trash2 size={14} />
                                             </button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Deep Dive Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Popular Pages */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <FileText size={18} className="text-indigo-400" />
                            Popular Pages / Paths
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-slate-400 text-[10px] uppercase font-black tracking-wider border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Path / Location</th>
                                    <th className="px-6 py-4 text-right">Hits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.top_pages.length === 0 ? (
                                    <tr>
                                        <td colSpan="2" className="px-6 py-8 text-center text-slate-400 italic">No page hits matching query.</td>
                                    </tr>
                                ) : (
                                    data.top_pages.map((p, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-300">{p.path}</td>
                                            <td className="px-6 py-4 text-right font-black text-indigo-400">{p.count}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Interaction Heatmap */}
                <div className="glass-card rounded-[32px] border border-white/5 overflow-hidden bg-white/[0.01]">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h3 className="font-bold flex items-center gap-2 text-white">
                            <MousePointer2 size={18} className="text-indigo-400" />
                            Interaction Click Heatmap
                        </h3>
                    </div>
                    <div className="p-6 space-y-3">
                        {data.top_clicks.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 italic font-medium">No interaction clicks recorded.</div>
                        ) : (
                            data.top_clicks.map((c, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all">
                                    <span className="text-xs font-bold text-slate-300 truncate max-w-[80%]">{c.text}</span>
                                    <span className="text-xs font-black bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-xl border border-indigo-500/20 shadow-sm">
                                        {c.count} clicks
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
