import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  CheckCircle, 
  Clock, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  ArrowRight,
  Filter
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { useAuth } from '../../../contexts/AuthContext';

export default function AuditLeadsModule() {
  const { currentUser } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getAuthHeaders = () => {
    const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchLeads = async () => {
    try {
      const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
      const res = await fetch(`${API_BASE_URL}/api/super-admin/leads/audits?user_id=${encodeURIComponent(uid)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [currentUser]);

  const handleUpdateStatus = async (leadId, newStatus) => {
    const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/leads/audits/${leadId}/status?user_id=${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchLeads();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = leads.filter(l => {
    const matchesSearch = (l.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (l.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (l.email || '').toLowerCase().includes(search.toLowerCase());
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && l.status === statusFilter;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/20">
              <Sparkles size={22} />
            </div>
            Signal Audit Inbound Pipeline
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Prospect organizations requesting custom InteracAI signal audits from the landing page.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search business, contact, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {['all', 'new', 'audit_scheduled', 'proposal_sent', 'converted'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                  statusFilter === st 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-semibold">Loading audit requests...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-semibold">No audit requests found.</div>
          ) : (
            filtered.map(l => (
              <div key={l.id} className="p-6 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-900 text-base">{l.business_name}</span>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full capitalize">
                      {l.industry}
                    </span>
                    <span className="text-xs text-slate-400">
                      {l.employee_count ? `${l.employee_count} employees` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5"><Building size={13} className="text-slate-400" /> Contact: {l.contact_name}</span>
                    <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {l.email}</span>
                    {l.phone && <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {l.phone}</span>}
                  </div>

                  {l.audit_scope && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
                      "{l.audit_scope}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={l.status}
                    onChange={(e) => handleUpdateStatus(l.id, e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="new">New Lead</option>
                    <option value="contacted">Contacted</option>
                    <option value="audit_scheduled">Audit Scheduled</option>
                    <option value="proposal_sent">Custom Proposal Sent</option>
                    <option value="converted">Converted to Customer</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
