import React from 'react';
import { 
  BarChart2, 
  Building, 
  CreditCard, 
  Users, 
  Activity, 
  Wrench, 
  ShieldCheck,
  ChevronRight,
  LogOut
} from 'lucide-react';

const SuperAdminSidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'businesses', label: 'Businesses', icon: Building },
    { id: 'subscriptions', label: 'Subscriptions', icon: ShieldCheck },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'users', label: 'Admin Access', icon: Users },
    { id: 'logs', label: 'System Logs', icon: Activity },
    { id: 'support', label: 'Support Tools', icon: Wrench },
  ];

  return (
    <div className="w-64 bg-navy h-full flex flex-col text-white shadow-xl">
      <div className="p-6 border-b border-navy-light flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg">
          A
        </div>
        <div>
          <h1 className="font-bold text-lg">InteracAI</h1>
          <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Super Admin</p>
        </div>
      </div>

      <nav className="flex-1 py-6 px-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-grey-300 hover:bg-navy-light hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-blue-400'} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} />}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-navy-light">
        <div className="bg-navy-light/50 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-grey-300">System Status: Stable</span>
          </div>
          <div className="text-[10px] text-grey-400">
            Powered by Interac Platform v2.1
          </div>
        </div>

        <button 
          className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
          onClick={() => window.location.href = '/'}
        >
          <LogOut size={18} />
          <span>Exit Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export default SuperAdminSidebar;
