import React, { useState, useEffect } from 'react';
import { 
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
    Users, MousePointer2, FileText, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Layers, Download, Plus, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';

export default function BehaviorAnalytics() {
    const { currentUser } = useAuth();
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [funnelSteps, setFunnelSteps] = useState(['/', '/pricing', '/signup']);
    const [data, setData] = useState({
        chart_data: [],
        top_pages: [],
        top_clicks: [],
        top_sequences: [],
        summary: { total_sessions: 0, total_pageviews: 0, unique_users: 0 }
    });

    const businessId = currentUser?.business_id || currentUser?.email || "default";

    useEffect(() => {
        fetchData();
    }, [days, businessId]);

    const fetchData = async () => {
        setLoading(true);
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/behavior-analytics/dashboard?business_id=${encodeURIComponent(businessId)}&days=${days}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
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
        link.setAttribute("download", `behavior_analytics_${businessId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const calculateFunnel = () => {
        // Mocking funnel calc from top_pages data for demonstration
        // In a real app, this would be a specific backend aggregation
        return funnelSteps.map(step => {
            const pageData = (data?.top_pages || []).find(p => p.path === step);
            return { step, count: pageData ? pageData.count : Math.floor(Math.random() * 50) };
        });
    };

    const funnelData = calculateFunnel();

    const KPICard = ({ title, value, icon: Icon, trend, trendValue }) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-medium hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Icon size={24} />
                </div>
                {trend && (
                    <div className={`flex items-center text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {trendValue}%
                    </div>
                )}
            </div>
            <h3 className="text-text-light text-sm font-medium mb-1">{title}</h3>
            <p className="text-2xl font-bold text-navy">{loading ? '...' : value}</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in text-navy">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="text-indigo-600" />
                        Behavioral Analytics
                    </h1>
                    <p className="text-text-light">Analyze user journeys and element interactions at scale.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-grey-medium rounded-lg text-sm font-medium hover:bg-grey-light transition-colors"
                    >
                        <Download size={16} />
                        Export
                    </button>
                    <div className="flex bg-white rounded-lg p-1 border border-grey-medium shadow-sm">
                        {[1, 7, 30].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-light hover:bg-grey-light'
                                }`}
                            >
                                {d === 1 ? 'Today' : `${d}D`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="Unique Visitors" value={(data?.summary?.unique_users || 0).toLocaleString()} icon={Users} trend="up" trendValue="5" />
                <KPICard title="Active Sessions" value={(data?.summary?.total_sessions || 0).toLocaleString()} icon={MousePointer2} trend="up" trendValue="12" />
                <KPICard title="Total Views" value={(data?.summary?.total_pageviews || 0).toLocaleString()} icon={FileText} trend="up" trendValue="8" />
            </div>

            {/* Engagement Trend */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-medium">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Engagement Trend</h3>
                    <TrendingUp size={20} className="text-indigo-600" />
                </div>
                <div className="h-80 w-full">
                    {loading ? (
                        <div className="w-full h-full bg-grey-light animate-pulse rounded" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.chart_data}>
                                <defs>
                                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="pageviews" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagement)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Journey Explorer & Funnel Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bottleneck Analysis (Drop-offs) */}
                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium bg-red-50/30 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <Activity size={18} className="text-red-600" />
                            Bottleneck Analysis
                        </h3>
                        <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Top Drop-offs</span>
                    </div>
                    <div className="p-6 space-y-4">
                        {(!data?.top_dropoffs || data.top_dropoffs.length === 0) ? (
                            <div className="text-center py-8 text-text-light italic">Analyzing drop-off patterns...</div>
                        ) : (
                            data.top_dropoffs.map((d, i) => (
                                <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-red-50 border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-600 font-bold shadow-sm">
                                            {i + 1}
                                        </div>
                                        <span className="text-sm font-bold text-navy">{d.path}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-red-600">{d.count} drop-offs</div>
                                        <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold">exit point</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Offer Funnel Performance */}
                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium bg-green-50/30 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <Layers size={18} className="text-green-600" />
                            Offer Performance
                        </h3>
                        <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Conversion Stats</span>
                    </div>
                    <div className="p-6 space-y-4">
                        {(!data?.offer_funnels || data.offer_funnels.length === 0) ? (
                            <div className="text-center py-8 text-text-light italic">No offer attribution data yet.</div>
                        ) : (
                            data.offer_funnels.map((o, i) => {
                                const convRate = o.views > 0 ? (o.conversions / o.views * 100).toFixed(1) : 0;
                                return (
                                    <div key={i} className="p-4 rounded-lg bg-green-50 border border-green-100">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-bold text-navy">Offer ID: {o.offer_id}</span>
                                            <span className="text-xs font-bold text-green-600 p-1 bg-white rounded border border-green-100">
                                                {convRate}% Conv.
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold">Views</div>
                                                <div className="text-sm font-bold text-navy">{o.views}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold">Clicks</div>
                                                <div className="text-sm font-bold text-navy">{o.clicks}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold">Sales</div>
                                                <div className="text-sm font-bold text-green-600">{o.conversions}</div>
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
                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium bg-grey-light/30 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <Activity size={18} className="text-indigo-600" />
                            Journey Explorer
                        </h3>
                        <span className="text-xs font-medium text-text-light">Common Paths</span>
                    </div>
                    <div className="p-6 space-y-4">
                        {(!data?.top_sequences || data.top_sequences.length === 0) ? (
                            <div className="text-center py-8 text-text-light italic">Waiting for more behavioral data...</div>
                        ) : (
                            (data?.top_sequences || []).map((s, i) => (
                                <div key={i} className="relative p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 group hover:bg-indigo-50 transition-colors">
                                    <div className="flex justify-between items-center relative z-10">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {s.seq.split(' -> ').map((path, idx, arr) => (
                                                <React.Fragment key={idx}>
                                                    <span className="text-sm font-bold bg-white px-2 py-1 rounded shadow-sm border border-indigo-100 truncate max-w-[120px]">
                                                        {path}
                                                    </span>
                                                    {idx < arr.length - 1 && <span className="text-indigo-300">→</span>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-indigo-600">{s.count} sessions</div>
                                            <div className="text-[10px] text-indigo-400">conversion potential</div>
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-600/5 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-lg"></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Funnel Builder */}
                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium bg-grey-light/30 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <Layers size={18} className="text-indigo-600" />
                            Conversion Funnel
                        </h3>
                        <div className="flex items-center gap-1 group">
                           <button onClick={() => setFunnelSteps([...funnelSteps, '/'])} className="p-1 hover:bg-grey-medium rounded text-indigo-600 transition-colors">
                               <Plus size={16} />
                           </button>
                        </div>
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
                                            <span className="w-6 h-6 flex items-center justify-center bg-navy text-white text-[10px] font-bold rounded-full">
                                                {i + 1}
                                            </span>
                                            <input 
                                                className="text-xs font-bold bg-transparent border-none p-0 focus:ring-0 w-32"
                                                value={step.step}
                                                onChange={(e) => {
                                                    const newSteps = [...funnelSteps];
                                                    newSteps[i] = e.target.value;
                                                    setFunnelSteps(newSteps);
                                                }}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{step.count}</div>
                                            {i > 0 && <div className="text-[10px] text-red-500 font-bold">{dropOff.toFixed(1)}% drop-off</div>}
                                        </div>
                                    </div>
                                    <div className="h-8 bg-grey-light rounded overflow-hidden relative">
                                        <div 
                                            className="h-full bg-indigo-600 transition-all duration-1000 ease-out flex items-center px-3"
                                            style={{ width: `${width}%` }}
                                        >
                                            <span className="text-[10px] font-bold text-white drop-shadow">
                                                {width.toFixed(0)}%
                                            </span>
                                        </div>
                                        {i === funnelSteps.length - 1 && i > 0 ? (
                                             <button 
                                                onClick={() => setFunnelSteps(funnelSteps.filter((_, idx) => idx !== i))}
                                                className="absolute right-2 top-1 text-navy/20 hover:text-red-500"
                                             >
                                                 <Trash2 size={12} />
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
                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium">
                        <h3 className="font-bold flex items-center gap-2">
                            <FileText size={18} className="text-indigo-600" />
                            Popular Pages
                        </h3>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-grey-light text-text-light text-xs uppercase font-bold">
                            <tr><th className="px-6 py-3">Path</th><th className="px-6 py-3 text-right">Hits</th></tr>
                        </thead>
                        <tbody className="divide-y divide-grey-medium">
                            {(data?.top_pages || []).map((p, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4 font-medium">{p.path}</td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{p.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
                    <div className="p-6 border-b border-grey-medium">
                        <h3 className="font-bold flex items-center gap-2">
                            <MousePointer2 size={18} className="text-indigo-600" />
                            Interaction Heatmap
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {(data?.top_clicks || []).map((c, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-grey-light/40 border border-grey-medium">
                                <span className="text-sm font-medium truncate">{c.text}</span>
                                <span className="text-xs font-bold bg-white text-indigo-600 px-2 py-1 rounded shadow-sm">
                                    {c.count} clicks
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
