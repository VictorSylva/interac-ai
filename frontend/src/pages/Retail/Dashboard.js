import React, { useState, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, TrendingDown, ArrowRight, ShieldAlert, AlertCircle, RefreshCw, BarChart2, DollarSign, Store, Activity, MapPin, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailDashboard({ orgId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    revenue_today: 1850200,
    margins_pct: 24.5,
    net_profit_today: 453300,
    cash_balance: 920000,
    terminal_balances: { "Lane 1": 340000, "Lane 2": 280000, "Lane 3": 300000 },
    category_performance: [
      { category: "Dairies", revenue: 450000, profit: 81000 },
      { category: "Beverages", revenue: 620000, profit: 186000 },
      { category: "Fresh Produce", revenue: 780000, profit: 186300 }
    ],
    branch_revenue_share: { "Ikeja Main": 1150000, "Lekki Express": 700200 }
  });
  const [aiSuggestions, setAiSuggestions] = useState([
    { id: 1, text: "Lekki branch Milk stock is at 12 units (under reorder threshold). Auto-procurement suggested.", type: "warning" },
    { id: 2, text: "Sweethearting risk identified at Lane 2 cashier (14 voids processed today).", type: "danger" },
    { id: 3, text: "Spices Aisle 3 basket cross-shopping correlation is high. Recommending layout adjust.", type: "info" }
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [orgId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/finance/analytics?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (e) {
      console.error("Error loading finance stats:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <LayoutDashboard className="w-4 h-4" /> Retail Operating System
          </div>
          <h2 className="text-3xl font-extrabold text-white">Supermarket Operations & Analytics</h2>
          <p className="text-slate-400 mt-1">Real-time revenue metrics, profit margin ratios, and multi-branch benchmarking.</p>
        </div>
        <button 
          onClick={fetchAnalytics} 
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync Telemetry
        </button>
      </div>

      {/* METRIC CARD ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-16 h-16 text-amber-400" />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Gross Sales Today</p>
          <h3 className="text-2xl font-black text-white mt-2">₦{data.revenue_today.toLocaleString()}</h3>
          <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> +12.4% vs Yesterday
          </span>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <BarChart2 className="w-16 h-16 text-cyan-400" />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Profit Margin Ratio</p>
          <h3 className="text-2xl font-black text-white mt-2">{data.margins_pct}%</h3>
          <span className="text-cyan-400 text-xs font-bold flex items-center gap-1 mt-1">
            <Activity className="w-3.5 h-3.5" /> Healthy target met
          </span>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-16 h-16 text-emerald-400" />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Net Profit Today</p>
          <h3 className="text-2xl font-black text-white mt-2">₦{data.net_profit_today.toLocaleString()}</h3>
          <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> +8.6% vs Target
          </span>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <AlertCircle className="w-16 h-16 text-rose-400" />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Inventory Shrinkage</p>
          <h3 className="text-2xl font-black text-rose-400 mt-2">1.25%</h3>
          <span className="text-rose-400 text-xs font-bold flex items-center gap-1 mt-1">
            <TrendingDown className="w-3.5 h-3.5" /> ₦306k est. loss
          </span>
        </div>
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* BRANCH COMPARISON CHART (HTML/CSS) */}
        <div className="lg:col-span-2 glass p-8 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" /> Multi-Branch Benchmarking
          </h3>
          <div className="space-y-4">
            {Object.entries(data.branch_revenue_share).map(([branch, rev]) => {
              const percentage = (rev / (data.revenue_today || 1)) * 100;
              return (
                <div key={branch} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-400" /> {branch}</span>
                    <span className="text-slate-300">₦{rev.toLocaleString()} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <h4 className="text-sm font-bold text-white pt-4 border-t border-white/5">Product Category Margin Allocation</h4>
          <div className="grid grid-cols-3 gap-4">
            {data.category_performance.map(cat => (
              <div key={cat.category} className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{cat.category}</p>
                <p className="text-sm font-black text-white mt-1">₦{cat.revenue.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-0.5">+{((cat.profit / cat.revenue) * 100).toFixed(0)}% Margin</p>
              </div>
            ))}
          </div>
        </div>

        {/* PROACTIVE AI CO-PILOT ADVISORY */}
        <div className="glass p-8 rounded-3xl border border-amber-500/20 bg-amber-500/[0.02] space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" /> AI Copilot Insights
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300">Active Radar</span>
          </div>

          <div className="space-y-4">
            {aiSuggestions.map(s => (
              <div 
                key={s.id} 
                className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all ${
                  s.type === 'danger' 
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
                    : s.type === 'warning' 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                      : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                }`}
              >
                <div className="flex gap-2.5">
                  {s.type === 'danger' ? (
                    <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/5 text-center">
            <a 
              href="/dashboard/retail/intelligence"
              className="text-xs text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              Ask AI Intelligence Console <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
