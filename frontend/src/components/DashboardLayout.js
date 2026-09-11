import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, MessageSquare, Settings, LogOut, BarChart2, Menu, X, Zap, Users, 
  Calendar, Phone, Activity, Shield, Check, ShoppingCart, Layers, Heart, Landmark,
  UserCheck, Key, Briefcase, Wrench, Coffee, Package, Receipt, Globe, Sliders
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import SubscriptionBanner from './SubscriptionBanner';

export default function DashboardLayout() {
  const { logout, userRole, currentUser, activeDept, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [userDropdown, setUserDropdown] = useState(false);
  const [installedModules, setInstalledModules] = useState([]);
  const businessId = currentUser?.business_id || currentUser?.email;

  const getAuthHeaders = (includeJson = false) => {
    let token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
    if (!token) {
      try {
        const user = JSON.parse(localStorage.getItem('interact_user') || '{}');
        token = user.token || user.access_token;
      } catch (e) {}
    }
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchInstalledModules = React.useCallback(() => {
    if (!businessId) return;
    fetch(`${API_BASE_URL}/api/v1/modules/installed?org_id=${encodeURIComponent(businessId)}`, {
      headers: getAuthHeaders(false)
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        let modules = Array.isArray(data) ? data : data.modules || [];
        const isHotelBiz = (
          subStatus?.industry === 'hotel' || 
          currentUser?.industry === 'hotel' || 
          (currentUser?.business_name && currentUser.business_name.toLowerCase().includes('hotel')) ||
          (subStatus?.name && subStatus.name.toLowerCase().includes('hotel'))
        );
        if (modules.length === 0 && isHotelBiz) {
          modules = [{
            id: 'module_hotels',
            name: 'Hotels & Hospitality Intelligence',
            ui_extensions: {
              routes: [
                { path: "/hotels/reservations", title: "Reservations Calendar", icon: "Calendar" },
                { path: "/hotels/frontdesk", title: "Front Desk & Check-in", icon: "UserCheck" },
                { path: "/hotels/rooms", title: "Rooms Directory", icon: "Key" },
                { path: "/hotels/housekeeping", title: "Housekeeping Schedule", icon: "Briefcase" },
                { path: "/hotels/maintenance", title: "Maintenance Tickets", icon: "Wrench" },
                { path: "/hotels/restaurant", title: "Restaurant POS", icon: "Coffee" },
                { path: "/hotels/inventory", title: "Inventory Control", icon: "Package" },
                { path: "/hotels/finance", title: "Folio Finance & Invoices", icon: "Receipt" },
                { path: "/hotels/analytics", title: "ADR / RevPAR Analytics", icon: "BarChart2" }
              ]
            }
          }];
        }
        setInstalledModules(modules);
      })
      .catch(err => console.error("Error fetching installed modules:", err));
  }, [businessId, subStatus, currentUser]);

  React.useEffect(() => {
    if (businessId) {
        fetch(`${API_BASE_URL}/api/business-status?business_id=${businessId}`)
             .then(res => res.ok ? res.json() : null)
             .then(data => { if(data) setSubStatus(data); })
             .catch(err => {});
        fetchInstalledModules();
     }

     const handleModuleChange = () => fetchInstalledModules();
     window.addEventListener('installedModulesChanged', handleModuleChange);
     return () => window.removeEventListener('installedModulesChanged', handleModuleChange);
  }, [businessId, fetchInstalledModules]);

  const getPlanBadge = () => {
    if (!subStatus || subStatus.status !== 'active') return null;
    
    const plan = subStatus.plan_name?.toLowerCase() || 'starter';
    const planConfig = {
        starter: { color: 'bg-blue-100 text-blue-700', label: 'STARTER' },
        growth: { color: 'bg-indigo-100 text-indigo-700', label: 'GROWTH' },
        pro: { color: 'bg-green-100 text-green-700', label: 'PRO' },
        enterprise: { color: 'bg-amber-100 text-amber-700', label: 'ENTERPRISE' }
    };

    const config = planConfig[plan] || planConfig.starter;

    return (
        <div className={`flex items-center text-[10px] ${config.color} px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm`}>
            <Shield size={10} className="mr-1 fill-current" /> {config.label}
        </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
    }
  };

  const isSuperAdminOrOwner = (
    userRole === 'super_admin' || 
    userRole === 'owner' || 
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'owner' ||
    currentUser?.email === 'interacai.int@gmail.com' ||
    currentUser?.email === 'mbasitisylva@gmail.com'
  );

  const baseMenuItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/dashboard', roles: ['owner', 'admin', 'support_agent'] },
    { icon: MessageSquare, label: 'Conversations', path: '/dashboard/conversations', roles: ['owner', 'admin', 'support_agent'] },
    { icon: Users, label: 'Customers (CRM)', path: '/dashboard/leads', roles: ['owner', 'admin'] },
    { icon: BarChart2, label: 'Business Analytics', path: '/dashboard/analytics', roles: ['owner', 'admin'] },
    { icon: Activity, label: 'Operational Insights', path: '/dashboard/behavior-analytics', roles: ['owner', 'admin'] },
    { icon: Zap, label: 'Workflows & Automations', path: '/dashboard/automations', roles: ['owner', 'admin'] },
    { icon: ShoppingCart, label: 'Commerce & Sales', path: '/dashboard/sales', roles: ['owner', 'admin'] },
    { icon: Calendar, label: 'Scheduling', path: '/dashboard/scheduling', roles: ['owner', 'admin'] },
    { icon: Phone, label: 'WhatsApp Integration', path: '/dashboard/whatsapp-setup', roles: ['owner', 'admin'] },
    { icon: Globe, label: 'Meta & Social Channels', path: '/dashboard/meta-setup', roles: ['owner', 'admin'] },
    { icon: Shield, label: 'Security & Surveillance', path: '/dashboard/intelligence', roles: ['owner', 'admin'] },
    { icon: Layers, label: 'Industry Modules', path: '/dashboard/modules', roles: ['owner', 'admin'] },
    { icon: Settings, label: 'Settings & Profile', path: '/dashboard/profile', roles: ['owner', 'admin'] },
    { icon: Shield, label: 'Billing & Subscription', path: '/dashboard/subscription', roles: ['owner', 'admin'] },
    ...(isSuperAdminOrOwner ? [
      { icon: Sliders, label: 'Control Center (Super Admin)', path: '/super-admin', roles: ['owner', 'super_admin'] }
    ] : [])
  ];

  // Dynamically inject industry module UI extension routes with permission validations
  const moduleMenuItems = [];
  installedModules.forEach(mod => {
    if (mod.ui_extensions && Array.isArray(mod.ui_extensions.routes)) {
      mod.ui_extensions.routes.forEach(r => {
        let iconComp = Activity;
        const iconMap = {
          'Calendar': Calendar,
          'UserCheck': UserCheck,
          'Key': Key,
          'Briefcase': Briefcase,
          'Wrench': Wrench,
          'Coffee': Coffee,
          'Package': Package,
          'Receipt': Receipt,
          'BarChart2': BarChart2
        };
        if (r.icon && iconMap[r.icon]) {
          iconComp = iconMap[r.icon];
        } else if (mod.id === 'module_hotels') {
          iconComp = Activity;
        } else if (mod.id === 'module_nigeria_irs') {
          iconComp = Shield;
        } else if (mod.id === 'module_retail') {
          iconComp = ShoppingCart;
        } else if (mod.id === 'module_estate') {
          iconComp = Shield;
        } else if (mod.id === 'module_hospital') {
          iconComp = Activity;
        } else if (mod.id === 'module_bible_translation') {
          iconComp = Zap;
        } else if (mod.id === 'module_church') {
          iconComp = Heart;
        } else if (mod.id === 'module_government') {
          iconComp = Landmark;
        } else if (mod.id === 'module_manufacturing') {
          iconComp = Settings;
        } else if (mod.id === 'module_education') {
          iconComp = Activity;
        } else if (mod.id === 'module_agriculture') {
          iconComp = Layers;
        }

        moduleMenuItems.push({
          icon: iconComp,
          label: r.title,
          path: `/dashboard${r.path}`,
          roles: ['owner', 'admin', 'support_agent', 'agent'], // Allow general base access, checked against department below
          isExtension: true,
          moduleName: mod.name,
          modulePermissions: mod.permissions || []
        });
      });
    }
  });


  const allMenuItems = [...baseMenuItems, ...moduleMenuItems];

  const menuItems = allMenuItems.filter(item => {
      // ALWAYS keep Settings and Home in sidebar for preview switching/recovery
      if (item.label === 'Settings & Profile' || item.label === 'Home') return true;

      if (!userRole) return false;
      const role = userRole.toLowerCase();
      const userDept = activeDept?.toLowerCase();

      // Owner and super admin bypass basic filters
      if (role === 'owner' || role === 'super_admin') return true;

      // 1. Validate against granular permissions
      if (hasPermission) {
          const mapping = {
              'Conversations': 'conversation.reply',
              'Customers (CRM)': 'customer.read',
              'Business Analytics': 'hotel.analytics.view',
              'Operational Insights': 'hotel.analytics.view',
              'Workflows & Automations': 'workflow.manage',
              'Commerce & Sales': 'hotel.finance.read',
              'Scheduling': 'hotel.reservations.read',
              'WhatsApp Integration': 'workflow.manage',
              'Meta & Social Channels': 'workflow.manage',
              'Security & Surveillance': 'security.cameras.view',
              'Industry Modules': 'module.install',
              'Billing & Subscription': 'billing.manage'
          };
          const requiredPermission = mapping[item.label];
          if (requiredPermission && !hasPermission(requiredPermission)) {
              return false;
          }
      }

      // 2. Filter by User Department Workspace (Applies to everyone)
      if (userDept && userDept !== 'general') {
          // If it's a dynamic module route
          if (item.isExtension && item.modulePermissions) {
              if (item.path.includes('/hotels/')) {
                  const pathDepts = {
                      '/hotels/reservations': ['frontdesk', 'reception', 'general_manager', 'owner', 'admin'],
                      '/hotels/frontdesk': ['frontdesk', 'reception', 'general_manager', 'owner', 'admin'],
                      '/hotels/rooms': ['frontdesk', 'reception', 'housekeeping', 'maintenance', 'general_manager', 'owner', 'admin'],
                      '/hotels/housekeeping': ['housekeeping', 'laundry', 'general_manager', 'owner', 'admin'],
                      '/hotels/maintenance': ['maintenance', 'general_manager', 'owner', 'admin'],
                      '/hotels/restaurant': ['restaurant', 'kitchen', 'bar', 'general_manager', 'owner', 'admin'],
                      '/hotels/inventory': ['store', 'kitchen', 'housekeeping', 'general_manager', 'owner', 'admin'],
                      '/hotels/finance': ['accounts', 'finance', 'general_manager', 'owner', 'admin'],
                      '/hotels/analytics': ['general_manager', 'owner', 'admin', 'accounts', 'finance']
                  };
                  const routeKey = Object.keys(pathDepts).find(key => item.path.endsWith(key));
                  if (routeKey && !pathDepts[routeKey].includes(userDept)) {
                      return false;
                  }
              } else {
                  const hasDeptPermission = item.modulePermissions.some(
                      p => p.department.toLowerCase() === userDept
                  );
                  if (!hasDeptPermission) return false;
              }
          }
          
          // Base menu items mapping (e.g. Conversations, Scheduling)
          const deptMapping = {
              security: ['Home', 'Security & Surveillance', 'Settings & Profile'],
              finance: ['Home', 'Business Analytics', 'Billing & Subscription', 'Commerce & Sales', 'Settings & Profile'],
              reception: ['Home', 'Conversations', 'Scheduling', 'Settings & Profile'],
              counselor: ['Home', 'Conversations', 'Scheduling', 'Settings & Profile'],
              operator: ['Home', 'Conversations', 'Settings & Profile'],
              pastor: ['Home', 'Conversations', 'Scheduling', 'Settings & Profile'],
              inventory: ['Home', 'Business Analytics', 'Settings & Profile'],
              cashier: ['Home', 'Conversations', 'Settings & Profile']
          };
          
          if (deptMapping[userDept]) {
              if (!item.isExtension && !deptMapping[userDept].includes(item.label)) {
                  return false;
              }
          }
      }

      // 3. Fallback to basic role access lists
      return item.roles.includes(role) || (role === 'admin');
  });



  return (
    <div className="flex h-screen bg-navy text-white">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-navy-light/50 backdrop-blur-2xl flex flex-col transition-transform duration-300 ease-in-out border-r border-white/10
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center">
                <img src="/interacAi-logo.png" alt="InteracAI Logo" className="h-14 w-auto brightness-0 invert" />
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white hover:text-blue-400">
                <X size={24} />
            </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)} // Close on navigate
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                location.pathname === item.path
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)] border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-white hover:text-red-400 w-full px-4 py-2 transition-colors font-medium"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-navy to-navy pointer-events-none" />
        <header className="glass border-b border-white/10 p-4 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <h2 className="text-xl font-bold text-white tracking-wide">
                 {menuItems.find(i => i.path === location.pathname)?.label || 'Command Center'}
              </h2>
          </div>
          <div className="flex items-center space-x-4 relative">
             <div className="flex flex-col items-end">
                 <span className="text-sm text-slate-300 hidden md:inline font-medium">
                     {currentUser?.email || 'User'}
                 </span>
                 {getPlanBadge()}
             </div>
             <div className="relative">
                <button 
                    onClick={() => setUserDropdown(!userDropdown)}
                    className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 hover:bg-indigo-500/40 transition-all border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                    {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                </button>
                {subStatus?.status === 'active' && (
                    <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white rounded-full p-0.5 shadow-sm">
                        <Check size={8} className="text-white stroke-[4px]" />
                    </div>
                )}
             </div>

             {/* User Dropdown */}
             {userDropdown && (
                <div className="absolute right-0 top-14 w-48 glass-card rounded-xl shadow-2xl border border-white/10 animate-fade-in-up z-50 overflow-hidden">
                    <div className="p-3 border-b border-white/10 text-xs text-slate-400 truncate bg-black/20">
                        {currentUser?.email}
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left p-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    >
                        <LogOut size={16} /> Logout
                    </button>
                </div>
             )}
          </div>
        </header>
        
        {/* Subscription Banner */}
        {subStatus && (
            <SubscriptionBanner 
                status={subStatus.status} 
                trialEnd={subStatus.trial_end_at} 
            />
        )}

        <div className="p-4 md:p-8 flex-1 relative text-navy">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
