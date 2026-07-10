import React, { useEffect, useState } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { 
    Users, MessageSquare, Clock, Zap, CheckCircle, TrendingUp, 
    Filter, AlertCircle, Sparkles, ArrowRight, DollarSign 
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

export default function Analytics() {
    const { currentUser } = useAuth();
    const [data, setData] = useState(null);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const businessId = currentUser?.business_id || currentUser?.email || "default";

    useEffect(() => {
        fetchAnalytics();
        fetchInsights();
    }, [days, businessId]);

    const fetchAnalytics = async () => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/analytics?business_id=${encodeURIComponent(businessId)}&days=${days}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
        }
    };

    const fetchInsights = async () => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/analytics/insights?business_id=${encodeURIComponent(businessId)}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            setInsights(json);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    if (loading || !data) return <Loader message="Processing Sales Intelligence..." />;


    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const SENTIMENT_COLORS = ['#10b981', '#94a3b8', '#ef4444'];

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-navy">Sales Intelligence</h1>
                    <p className="text-text-light">Actionable insights from your CRM and conversations.</p>
                </div>
                <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-grey-light shadow-sm">
                    <Filter size={16} className="text-text-light ml-2" />
                    {[7, 30, 90].map(d => (
                        <button 
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${days === d ? 'bg-navy text-white shadow' : 'text-text-light hover:bg-grey-light'}`}
                        >
                            Last {d} Days
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    icon={TrendingUp} 
                    title="Pipeline Value" 
                    value={`$${(data.overview.pipeline_value || 0).toLocaleString()}`}
                    color="text-green-600" 
                    bg="bg-green-50"
                />
                <KPICard 
                    icon={Users} 
                    title="Active Prospects" 
                    value={data.overview.active_users} 
                    color="text-blue-600" 
                    bg="bg-blue-50"
                />
                 <KPICard 
                    icon={Clock} 
                    title="Avg Response" 
                    value={data.overview.avg_response_time} 
                    color="text-orange-600" 
                    bg="bg-orange-50"
                />
                 <KPICard 
                    icon={CheckCircle} 
                    title="AI Resolution" 
                    value={`${data.ai_resolution_rate?.resolved_by_ai || 0}%`} 
                    color="text-teal-600" 
                    bg="bg-teal-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Funnel */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-navy">Lead Conversion Funnel</h3>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">CRM Distribution</span>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={data.funnel_data} margin={{left: 40, right: 40}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="stage" type="category" tick={{fontSize: 12, fontWeight: 600, fill: '#1E293B'}} width={100} />
                                <Tooltip cursor={{fill: '#F1F5F9'}} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={40}>
                                    {data.funnel_data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Insights & Recommendations */}
                <div className="bg-gradient-to-br from-navy to-navy-light text-white p-6 rounded-xl shadow-lg flex flex-col">
                    <div className="flex items-center space-x-2 mb-6 text-blue-300">
                        <Sparkles size={20} />
                        <h3 className="text-lg font-bold">AI Sales Insights</h3>
                    </div>
                    
                    {insights?.insights?.length > 0 ? (
                        <div className="flex-1 space-y-6 overflow-y-auto">
                            {insights.insights.map((insight, idx) => (
                                <div key={idx} className="bg-white/10 p-4 rounded-lg border border-white/10 hover:bg-white/20 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-sm">{insight.lead_name}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-tighter bg-orange-500/30 px-1.5 py-0.5 rounded">Stalled</span>
                                    </div>
                                    <p className="text-xs text-blue-100 italic leading-relaxed mb-3">
                                        "{insight.recommendation}"
                                    </p>
                                    <button className="text-[10px] font-bold flex items-center hover:translate-x-1 transition-transform">
                                        RE-ENGAGE <ArrowRight size={10} className="ml-1" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                            <CheckCircle size={48} className="mb-4 text-blue-300" />
                            <p className="text-sm font-medium">All leads are moving well!</p>
                            <p className="text-xs mt-1">No stalled leads identified.</p>
                        </div>
                    )}
                    
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mb-1">PRO-TIP</p>
                        <p className="text-xs leading-relaxed text-blue-100">
                            Follow-ups within 5 minutes increase conversion by 9x. Let AI handle the first touch.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Conversion */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                    <h3 className="text-lg font-bold text-navy mb-6">Channel Performance</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.channel_conversion}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="channel" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <Tooltip />
                                <Legend />
                                <Bar yAxisId="left" dataKey="total" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Capture Volume" barSize={40} />
                                <Line yAxisId="left" type="monotone" dataKey="converted" stroke="#10b981" strokeWidth={3} name="Conversions" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Engagement Trends */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                    <h3 className="text-lg font-bold text-navy mb-4">Sentiment & Engagement</h3>
                    <div className="grid grid-cols-2 gap-4 h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.sentiment_analysis}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.sentiment_analysis.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col justify-center space-y-4">
                            {data.sentiment_analysis.map((s, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: SENTIMENT_COLORS[idx % SENTIMENT_COLORS.length]}}></div>
                                    <span className="text-sm font-medium text-navy capitalize">{s.name}</span>
                                    <span className="text-xs text-text-light">{s.value} messages</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Intent Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                    <h3 className="text-lg font-bold text-navy mb-6">Conversation Intents</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.intent_distribution}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <Tooltip cursor={{fill: '#F1F5F9'}} />
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Busiest Hours */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                    <h3 className="text-lg font-bold text-navy mb-4">Engagement by Hour</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.busiest_hours}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="hour" tick={{fontSize: 12}} interval={3} />
                                <YAxis tick={{fontSize: 12}} />
                                <Tooltip />
                                <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ icon: Icon, title, value, color, bg }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light flex items-center space-x-4 hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-xl ${bg} ${color}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-xs font-bold text-text-light uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-extrabold text-navy font-mono tracking-tighter">{value}</p>
            </div>
        </div>
    );
}
