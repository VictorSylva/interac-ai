import React from 'react';
import { 
  BarChart2, 
  Building, 
  CreditCard, 
  Activity, 
  Wrench, 
  ShieldCheck,
  ChevronRight,
  LogOut,
  FileText,
  Sparkles,
  Sliders
} from 'lucide-react';

const SuperAdminSidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Platform Pulse', icon: BarChart2 },
    { id: 'businesses', label: 'Tenants & Profiles', icon: Building },
    { id: 'entitlements', label: 'Entitlement Studio', icon: Sliders },
    { id: 'invoices', label: 'Custom Invoices', icon: FileText },
    { id: 'leads', label: 'Signal Audit Leads', icon: Sparkles },
    { id: 'payments', label: 'Payment Ledger', icon: CreditCard },
    { id: 'logs', label: 'Compliance Audit Logs', icon: Activity },
    { id: 'support', label: 'Overrides & Utilities', icon: Wrench },
  ];

  return (
    <div className="w-64 bg-slate-900 h-full flex flex-col text-white shadow-2xl border-r border-slate-800">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
          I
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-white">InteracAI</h1>
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold">Control Center</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 ${
                  isActive 
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30' 
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-white/80" />}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-semibold text-slate-200">Zero-Trust Entitlements</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Audit-First Commercial Engine
          </div>
        </div>

        <button 
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-xs font-medium"
          onClick={() => window.location.href = '/dashboard'}
        >
          <LogOut size={16} />
          <span>Exit to Customer Portal</span>
        </button>
      </div>
    </div>
  );
};

export default SuperAdminSidebar;
