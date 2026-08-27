import React, { useState } from 'react';
import { DollarSign, BarChart2, TrendingUp, RefreshCw, Send, CheckCircle2, Link } from 'lucide-react';

export default function RetailFinance() {
  const [accountingSync, setAccountingSync] = useState('QuickBooks');
  const [syncedStatus, setSyncedStatus] = useState(false);

  const handleExport = () => {
    setSyncedStatus(true);
    setTimeout(() => {
      alert(`Consolidated retail sales ledger exported to ${accountingSync} successfully.`);
      setSyncedStatus(false);
    }, 1200);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <DollarSign className="w-4 h-4" /> Finance, Profitability & Accounting
          </div>
          <h2 className="text-3xl font-extrabold text-white">Daily Ledger & Margins Auditor</h2>
          <p className="text-slate-400 mt-1">Cross-compare branch profits, review category margins, and sync ledgers to ERP systems.</p>
        </div>
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* REVENUE BREAKDOWN & CATEGORIES */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-400" /> Revenue & Cost Accounting
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Department Category</th>
                  <th className="p-3">Revenue (Today)</th>
                  <th className="p-3">COGS (Cost of Goods)</th>
                  <th className="p-3">Gross Margins</th>
                  <th className="p-3 text-right">Performance Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[
                  { cat: 'Dairies', rev: 450000, cost: 369000, margin: 18, rank: '#2 High Volume' },
                  { cat: 'Beverages', rev: 620000, cost: 434000, margin: 30, rank: '#1 Highest Yield' },
                  { cat: 'Fresh Produce', rev: 780000, cost: 593700, margin: 23.8, rank: '#3 Standard Yield' }
                ].map(item => (
                  <tr key={item.cat} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{item.cat}</td>
                    <td className="p-3 font-mono text-slate-300">₦{item.rev.toLocaleString()}</td>
                    <td className="p-3 font-mono text-slate-400">₦{item.cost.toLocaleString()}</td>
                    <td className="p-3 font-bold text-emerald-400">+{item.margin}%</td>
                    <td className="p-3 text-right text-slate-400 font-mono text-[10px]">{item.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACCOUNTING INTEGRATIONS */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Link className="w-5 h-5 text-amber-400" /> Accounting Integration
          </h3>
          <p className="text-xs text-slate-400">Instantly export sales invoices, cost of sales, and tax liabilities directly to your accounting platform.</p>

          <div className="space-y-3">
            {['QuickBooks', 'Xero', 'Sage Books', 'Zoho Books'].map(platform => (
              <div 
                key={platform} 
                onClick={() => setAccountingSync(platform)}
                className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center text-xs font-bold transition-all ${
                  accountingSync === platform 
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300' 
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <span>{platform} Cloud Connector</span>
                <span className="text-[10px] text-slate-500 font-mono">Sync Active</span>
              </div>
            ))}
          </div>

          <button 
            onClick={handleExport}
            disabled={syncedStatus}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl"
          >
            {syncedStatus ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Synchronizing Ledger...</>
            ) : (
              <><Send className="w-4 h-4" /> Export Ledger to {accountingSync}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
