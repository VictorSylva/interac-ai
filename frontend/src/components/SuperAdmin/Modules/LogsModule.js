import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCcw, 
  Cpu, 
  Webhook, 
  ChevronDown, 
  ChevronUp, 
  Terminal,
  User
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export default function LogsModule() {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [activeSubTab]);

  const fetchLogs = async () => {
    if (!currentUser) return;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    setLoading(true);
    try {
      const endpoint = activeSubTab === 'system' ? '/api/super-admin/logs/system' : '/api/super-admin/logs/webhooks';
      const res = await fetch(`${apiUrl}${endpoint}?user_id=${currentUser.id}`);
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

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Activity size={24} className="text-purple-600" />
            System Visibility
          </h2>
          <p className="text-grey-600 text-sm">Monitor administrative actions and incoming webhooks.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-grey-medium p-1 rounded-xl shadow-sm">
            <button 
              onClick={() => setActiveSubTab('system')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'system' ? 'bg-navy text-white shadow-md' : 'text-grey-500 hover:bg-grey-50'
              }`}
            >
              <Cpu size={14} />
              System Logs
            </button>
            <button 
              onClick={() => setActiveSubTab('webhooks')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'webhooks' ? 'bg-navy text-white shadow-md' : 'text-grey-500 hover:bg-grey-50'
              }`}
            >
              <Webhook size={14} />
              Webhook Logs
            </button>
          </div>
          <button 
             onClick={fetchLogs}
             className="p-2 bg-white border border-grey-medium rounded-xl hover:bg-grey-50 transition-colors text-grey-600 shadow-sm"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-grey-medium overflow-hidden">
        <div className="p-4 bg-navy text-white flex items-center gap-2">
           <Terminal size={14} className="text-blue-400" />
           <span className="text-xs font-mono uppercase tracking-widest leading-none mt-0.5">Console Output</span>
        </div>
        
        <div className="divide-y divide-grey-100">
           {loading ? (
             Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-5 animate-pulse flex gap-4">
                   <div className="w-10 h-10 bg-grey-200 rounded-lg"></div>
                   <div className="flex-1 space-y-2">
                      <div className="h-4 bg-grey-200 rounded w-1/4"></div>
                      <div className="h-3 bg-grey-200 rounded w-3/4"></div>
                   </div>
                </div>
             ))
           ) : logs.length === 0 ? (
             <div className="p-12 text-center text-grey-500 italic">No logs recorded for this period.</div>
           ) : (
             logs.map((log) => (
               <div key={log.id} className="group hover:bg-grey-50/50 transition-colors">
                  <div 
                    className="p-5 flex items-start gap-4 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                     <div className={`p-2 rounded-lg ${activeSubTab === 'system' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {activeSubTab === 'system' ? <User size={18} /> : <Webhook size={18} />}
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-sm font-bold text-navy capitalize">
                              {activeSubTab === 'system' ? log.action.replace(/_/g, ' ') : `${log.provider} Event`}
                           </span>
                           <span className="text-[10px] text-grey-400 font-mono">
                              {new Date(log.created_at).toLocaleString()}
                           </span>
                        </div>
                        <p className="text-xs text-grey-600">
                           {activeSubTab === 'system' 
                             ? `Performed by ${log.admin_email} on target ${log.target_id}` 
                             : `Processed with status ${log.status_code || 'N/A'}`}
                        </p>
                     </div>
                     <div className="text-grey-300 group-hover:text-grey-500 transition-colors">
                        {expandedLog === log.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                  </div>
                  
                  {expandedLog === log.id && (
                    <div className="px-5 pb-5 ml-14 animate-in slide-in-from-top-2 duration-200">
                       <div className="bg-navy rounded-xl p-4 overflow-x-auto">
                          <pre className="text-[11px] font-mono text-blue-200 leading-relaxed">
                             {JSON.stringify(activeSubTab === 'system' ? log.details : log.payload, null, 2)}
                          </pre>
                       </div>
                    </div>
                  )}
               </div>
             ))
           )}
        </div>
      </div>
    </div>
  );
}
