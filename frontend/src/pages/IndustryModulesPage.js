import React, { useState, useEffect } from 'react';
import { 
  Building2, Hotel, Landmark, ShoppingBag, ShieldCheck, 
  Stethoscope, BookOpen, CheckCircle2, XCircle, Loader2, Sparkles, Zap, ArrowRight, Briefcase 
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

const MODULE_METADATA = {
  module_sme: {
    icon: Briefcase,
    color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30',
    btnBg: 'bg-blue-600 hover:bg-blue-500',
    tags: ['Product & Service', 'Omnichannel CRM', 'Argus Intelligence']
  },
  module_retail: {
    icon: ShoppingBag,
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
    btnBg: 'bg-amber-600 hover:bg-amber-500',
    tags: ['POS Integration', 'Loss Prevention', 'Inventory Shrinkage']
  },
  module_bible_translation: {
    icon: BookOpen,
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
    btnBg: 'bg-emerald-600 hover:bg-emerald-500',
    tags: ['Language Catalog', 'Field Progress', 'Donor Impact']
  },
  module_estate: {
    icon: ShieldCheck,
    color: 'from-indigo-500/20 to-blue-500/10 text-indigo-400 border-indigo-500/30',
    btnBg: 'bg-indigo-600 hover:bg-indigo-500',
    tags: ['ALPR License Plate', 'Guard Patrol Radar', 'Visitor Overstay']
  },
  module_hospital: {
    icon: Stethoscope,
    color: 'from-rose-500/20 to-pink-500/10 text-rose-400 border-rose-500/30',
    btnBg: 'bg-rose-600 hover:bg-rose-500',
    tags: ['ER Wait Times', 'Patient Flow Triage', 'Staffing Forecast']
  },
  module_hotels: {
    icon: Hotel,
    color: 'from-purple-500/20 to-violet-500/10 text-purple-400 border-purple-500/30',
    btnBg: 'bg-purple-600 hover:bg-purple-500',
    tags: ['VIP Guest Dossier', 'Keycard Access Radar', 'Occupancy Anomalies']
  },
  module_nigeria_irs: {
    icon: Landmark,
    color: 'from-green-500/20 to-emerald-500/10 text-green-400 border-green-500/30',
    btnBg: 'bg-green-600 hover:bg-green-500',
    tags: ['TIN Taxpayer Dossier', 'POS Tax Evasion Radar', 'LGA Revenue Yield']
  },
  module_church: {
    icon: BookOpen,
    color: 'from-rose-500/20 to-orange-500/10 text-rose-400 border-rose-500/30',
    btnBg: 'bg-rose-600 hover:bg-rose-500',
    tags: ['Volunteer Schedule', 'Givings Ledger', 'Attendance Tracker']
  },
  module_government: {
    icon: Landmark,
    color: 'from-indigo-500/20 to-blue-500/10 text-indigo-400 border-indigo-500/30',
    btnBg: 'bg-indigo-600 hover:bg-indigo-500',
    tags: ['Case Management', 'Citizen Directory', 'Incident Dispatch']
  },
  module_manufacturing: {
    icon: ShieldCheck,
    color: 'from-yellow-500/20 to-orange-500/10 text-yellow-400 border-yellow-500/30',
    btnBg: 'bg-yellow-600 hover:bg-yellow-500',
    tags: ['CNC Asset Health', 'Production Order', 'Quality Control']
  },
  module_education: {
    icon: Stethoscope,
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
    btnBg: 'bg-cyan-600 hover:bg-cyan-500',
    tags: ['Student Enrollments', 'Class Attendance', 'AI Student Tutor']
  },
  module_agriculture: {
    icon: Building2,
    color: 'from-emerald-500/20 to-green-500/10 text-emerald-400 border-emerald-500/30',
    btnBg: 'bg-emerald-600 hover:bg-emerald-500',
    tags: ['Farm Field Soil', 'Livestock Tracker', 'Crop Yield Forecast']
  }
};

export default function IndustryModulesPage() {
  const { currentUser } = useAuth();
  const [availableModules, setAvailableModules] = useState([]);
  const [installedModuleIds, setInstalledModuleIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingModule, setTogglingModule] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const orgId = currentUser?.business_id || currentUser?.email || 'default';

  const getAuthHeaders = () => {
    const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    fetchModulesData();
  }, [orgId, currentUser]);

  const fetchModulesData = async () => {
    setLoading(true);
    try {
      const [availRes, instRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/modules`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/v1/modules/installed?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders() })
      ]);

      if (availRes.ok) {
        const data = await availRes.json();
        setAvailableModules(Array.isArray(data) ? data : data.modules || []);
      }
      if (instRes.ok) {
        const installed = await instRes.json();
        const installedList = Array.isArray(installed) ? installed : (installed.modules || []);
        const installedSet = new Set(installedList.map(m => m.id || m));
        setInstalledModuleIds(installedSet);
      }
    } catch (err) {
      console.error("Error loading industry modules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModule = async (moduleId, isInstalled) => {
    setTogglingModule(moduleId);
    const endpoint = isInstalled ? '/api/v1/modules/uninstall' : '/api/v1/modules/install';
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ org_id: orgId, module_id: moduleId })
      });

      if (res.ok) {
        const nextSet = new Set(installedModuleIds);
        if (isInstalled) {
          nextSet.delete(moduleId);
          // Also delete short name if present
          nextSet.delete(moduleId.replace('module_', ''));
          showToast(`Module '${moduleId}' disabled.`);
        } else {
          nextSet.add(moduleId);
          showToast(`Module '${moduleId}' activated!`);
        }
        setInstalledModuleIds(nextSet);
        window.dispatchEvent(new Event('installedModulesChanged'));
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed: ${errData.detail || 'Could not update module'}`);
      }
    } catch (err) {
      console.error("Error toggling module:", err);
      showToast('Network error toggling module.');
    } finally {
      setTogglingModule(null);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader message="Loading Industry Modules Marketplace..." /></div>;

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Zap className="w-5 h-5" />
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold uppercase tracking-widest mb-1">
            <Sparkles className="w-4 h-4" /> Multi-Tenant Capability Suite
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-wide">Industry Starter Modules</h2>
          <p className="text-slate-400 mt-1 max-w-2xl">
            Toggle specialized industry modules ON or OFF to dynamically adapt your AI Copilot reasoning skills, dynamic database entities, and perception security alerts.
          </p>
        </div>

        <div className="glass px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <div>
            <div className="text-xs text-slate-400 font-medium">Active Workspace</div>
            <div className="text-sm font-bold text-white truncate max-w-[200px]">{currentUser?.business_name || currentUser?.email}</div>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableModules.map((mod) => {
          const isInstalled = installedModuleIds.has(mod.id);
          const meta = MODULE_METADATA[mod.id] || {
            icon: Building2,
            color: 'from-slate-500/20 to-gray-500/10 text-slate-300 border-slate-500/30',
            btnBg: 'bg-indigo-600 hover:bg-indigo-500',
            tags: ['Industry Integration']
          };
          const IconComp = meta.icon;

          return (
            <div 
              key={mod.id}
              className={`glass p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                isInstalled ? 'border-indigo-500/40 ring-1 ring-indigo-500/30 shadow-2xl' : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Top Row: Icon & Status Toggle */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br border ${meta.color}`}>
                    <IconComp className="w-7 h-7" />
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleModule(mod.id, isInstalled)}
                    disabled={togglingModule === mod.id}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                      isInstalled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        isInstalled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-white">{mod.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono">v{mod.version}</span>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  {mod.description}
                </p>

                {/* Capabilities Badges */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {meta.tags.map((tag, idx) => (
                    <span key={idx} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Copilot Skills list */}
                {mod.copilot_skills && mod.copilot_skills.length > 0 && (
                  <div className="mb-6 pt-4 border-t border-white/10 space-y-1.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Copilot Reasoning Skills:</div>
                    {mod.copilot_skills.map((s, idx) => (
                      <div key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span className="font-mono text-[11px] text-indigo-300">{typeof s === 'string' ? s : s.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer Button */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                  isInstalled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isInstalled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {isInstalled ? 'ACTIVE IN WORKSPACE' : 'INACTIVE'}
                </span>

                <button
                  onClick={() => handleToggleModule(mod.id, isInstalled)}
                  disabled={togglingModule === mod.id}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg flex items-center gap-2 ${meta.btnBg} disabled:opacity-50`}
                >
                  {togglingModule === mod.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isInstalled ? 'Disable Module' : 'Enable Module'} <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
