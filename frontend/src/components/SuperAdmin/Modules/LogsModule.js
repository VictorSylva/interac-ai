import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCcw, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Terminal,
  User,
  Clock,
  FileCode
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL } from '../../../config';

export default function LogsModule() {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('compliance');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getAuthHeaders = () => {
    const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    fetchLogs();
  }, [activeSubTab, currentUser]);

  const fetchLogs = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let endpoint = '/api/super-admin/audit-logs';
      if (activeSubTab === 'system') endpoint = '/api/super-admin/logs/system';
      
      const uid = currentUser.id || currentUser.uid || currentUser.email || '';
      const res = await fetch(`${API_BASE_URL}${endpoint}?user_id=${encodeURIComponent(uid)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    (l.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.target_resource || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.admin_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-500/20">
              <ShieldCheck size={22} />
            </div>
            Compliance & Audit Logging
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Immutable log of all administrative actions, entitlement modifications, quota overrides, and provisioning events.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveSubTab('compliance')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'compliance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Entitlement & Admin Audits
            </button>
            <button 
              onClick={() => setActiveSubTab('system')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'system' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              System Events
            </button>
          </div>

          <button 
            onClick={fetchLogs}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
            title="Refresh Logs"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search actions, resources, or admin actors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-semibold">Loading audit trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-semibold">No audit records found.</div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLog === log.id;
              return (
                <div key={log.id} className="p-6 hover:bg-slate-50/70 transition">
                  <div 
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0">
                        <Terminal size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">{log.action}</span>
                          {log.reason && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              {log.reason}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          Target: {log.target_resource || log.target_id || 'Platform'} • Actor: <strong className="text-slate-700">{log.admin_email}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <span className="text-xs text-slate-400 font-medium">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.previous_state && (
                        <div className="bg-slate-900 rounded-2xl p-4 text-slate-100 font-mono text-xs overflow-x-auto">
                          <div className="text-[10px] uppercase font-bold text-rose-400 mb-2">Previous State</div>
                          <pre>{JSON.stringify(log.previous_state, null, 2)}</pre>
                        </div>
                      )}
                      <div className="bg-slate-900 rounded-2xl p-4 text-slate-100 font-mono text-xs overflow-x-auto">
                        <div className="text-[10px] uppercase font-bold text-emerald-400 mb-2">New Applied State</div>
                        <pre>{JSON.stringify(log.new_state || log.details || {}, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
