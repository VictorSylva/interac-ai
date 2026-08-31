import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Search, 
  Building, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Save, 
  PlusCircle, 
  RefreshCw,
  Sparkles,
  Info,
  Calendar
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { useAuth } from '../../../contexts/AuthContext';

export default function EntitlementsModule() {
  const { currentUser } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBid, setSelectedBid] = useState('');
  const [tenantBundle, setTenantBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideType, setOverrideType] = useState('grant_access');
  const [overrideLimit, setOverrideLimit] = useState('');
  const [overrideDays, setOverrideDays] = useState(14);
  const [overrideReason, setOverrideReason] = useState('');

  // Editable local state of entitlements
  const [localEntitlements, setLocalEntitlements] = useState([]);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses?user_id=${currentUser?.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setBusinesses(data);
        if (data.length > 0 && !selectedBid) {
          setSelectedBid(data[0].business_id);
          loadBusinessEntitlements(data[0].business_id);
        }
      }
    } catch (e) {
      console.error('Failed to load businesses', e);
    }
  };

  const loadBusinessEntitlements = async (bid) => {
    if (!bid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses/${bid}/detail?user_id=${currentUser?.id}`);
      const data = await res.json();
      setTenantBundle(data);

      // Build array of features from catalog + existing entitlements
      const catalog = data.catalog_template || {};
      const features = catalog.features || [];
      const limits = catalog.default_limits || {};
      const existingEnts = data.entitlements || {};

      const combined = [];

      // Add catalog features
      features.forEach(f => {
        const ent = existingEnts[f.key];
        combined.push({
          key: f.key,
          name: f.name,
          type: f.type,
          enabled: ent ? ent.enabled : f.default,
          limit: ent ? ent.limit : null,
          override: ent?.override || null
        });
      });

      // Add numeric limits
      Object.keys(limits).forEach(limKey => {
        const limCfg = limits[limKey];
        const ent = existingEnts[limKey];
        // Check if already in combined
        if (!combined.find(c => c.key === limKey)) {
          combined.push({
            key: limKey,
            name: limKey.replace('.', ' ').toUpperCase(),
            type: 'numeric',
            enabled: true,
            limit: ent?.limit !== undefined ? ent.limit : limCfg.limit,
            unit: limCfg.unit,
            override: ent?.override || null
          });
        }
      });

      setLocalEntitlements(combined);
    } catch (e) {
      console.error('Failed to load business bundle', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = (key) => {
    setLocalEntitlements(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    }));
  };

  const handleLimitChange = (key, val) => {
    setLocalEntitlements(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, limit: parseInt(val) || 0 };
      }
      return item;
    }));
  };

  const handleSaveEntitlements = async () => {
    if (!selectedBid || !currentUser) return;
    setSaving(true);
    try {
      const payload = localEntitlements.map(item => ({
        key: item.key,
        enabled: item.enabled,
        limit: item.limit,
        type: item.type,
        unit: item.unit
      }));

      const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses/${selectedBid}/entitlements?user_id=${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entitlements: payload,
          reason: 'Admin adjusted capability matrix in Control Center'
        })
      });

      if (res.ok) {
        alert('Entitlements successfully saved and applied to tenant!');
        loadBusinessEntitlements(selectedBid);
      } else {
        alert('Failed to save entitlements.');
      }
    } catch (e) {
      console.error('Save error', e);
      alert('Error saving entitlements.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOverride = async () => {
    if (!selectedBid || !overrideKey || !overrideReason || !currentUser) {
      alert('Please provide entitlement key and mandatory reason.');
      return;
    }

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + parseInt(overrideDays));

    const val = overrideType === 'limit_increase' 
      ? { enabled: true, limit: parseInt(overrideLimit) || 10000 }
      : { enabled: true };

    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses/${selectedBid}/overrides?user_id=${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entitlement_key: overrideKey,
          override_type: overrideType,
          override_value: val,
          reason: overrideReason,
          expires_at: expDate.toISOString()
        })
      });

      if (res.ok) {
        setShowOverrideModal(false);
        setOverrideReason('');
        setOverrideKey('');
        loadBusinessEntitlements(selectedBid);
        alert('Time-bound override activated successfully!');
      } else {
        alert('Failed to create override.');
      }
    } catch (e) {
      console.error(e);
      alert('Error activating override.');
    }
  };

  const filteredFeatures = localEntitlements.filter(f => 
    f.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
    f.key.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Sliders size={22} />
            </div>
            Entitlement Studio & Capability Matrix
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Audit-first, granular tenant provisioning. Define exact permissions, quotas, and intelligence modules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            className="bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedBid}
            onChange={(e) => {
              setSelectedBid(e.target.value);
              loadBusinessEntitlements(e.target.value);
            }}
          >
            {businesses.map(b => (
              <option key={b.business_id} value={b.business_id}>
                {b.name} ({b.industry?.toUpperCase() || 'GENERAL'})
              </option>
            ))}
          </select>

          <button 
            onClick={() => loadBusinessEntitlements(selectedBid)}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
            title="Refresh Entitlements"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {tenantBundle && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Profile</span>
            <div className="text-lg font-black text-slate-900 mt-1">{tenantBundle.name}</div>
            <div className="text-xs text-blue-600 font-semibold uppercase mt-0.5">{tenantBundle.industry} Operating System</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commercial Status</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-bold text-slate-800 capitalize">
                {tenantBundle.commercial_profile?.status?.replace('_', ' ') || 'Active'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Account Mgr: {tenantBundle.commercial_profile?.account_manager}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Conversations</span>
            <div className="text-lg font-black text-slate-900 mt-1">
              {tenantBundle.usage?.conversations_used?.toLocaleString()} / {tenantBundle.usage?.conversations_limit?.toLocaleString()}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, (tenantBundle.usage?.conversations_used / (tenantBundle.usage?.conversations_limit || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Token Allocation</span>
            <div className="text-lg font-black text-indigo-600 mt-1">
              {(tenantBundle.usage?.tokens_total_available || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Quota Cap: {(tenantBundle.usage?.tokens_limit || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Control Actions & Search */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search capabilities or limits..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOverrideModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Clock size={15} className="text-amber-600" />
              <span>Create Time-Bound Override</span>
            </button>

            <button
              onClick={handleSaveEntitlements}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Deploy Entitlement Matrix'}</span>
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-semibold">Loading tenant entitlement configuration...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeatures.map((feat) => {
                const isNumeric = feat.type === 'numeric';
                const hasOverride = !!feat.override;

                return (
                  <div 
                    key={feat.key}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasOverride 
                        ? 'border-amber-300 bg-amber-50/30' 
                        : feat.enabled 
                          ? 'border-slate-200 bg-white hover:border-slate-300' 
                          : 'border-slate-100 bg-slate-50/70 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{feat.name}</span>
                          {hasOverride && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                              Override Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{feat.key}</div>
                        {hasOverride && (
                          <div className="text-[11px] text-amber-700 font-medium mt-1">
                            Reason: {feat.override.reason} (Expires: {new Date(feat.override.expires_at).toLocaleDateString()})
                          </div>
                        )}
                      </div>

                      {isNumeric ? (
                        <div className="w-36">
                          <input 
                            type="number"
                            value={feat.limit || 0}
                            onChange={(e) => handleLimitChange(feat.key, e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="text-[10px] text-slate-400 text-right mt-0.5 font-medium">{feat.unit || 'units'}</div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggleFeature(feat.key)}
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                            feat.enabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition"></div>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Clock className="text-amber-500" size={20} />
                Create Time-Bound Entitlement Override
              </div>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Target Capability / Limit Key</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={overrideKey}
                  onChange={(e) => setOverrideKey(e.target.value)}
                >
                  <option value="">Select feature or limit key...</option>
                  {localEntitlements.map(e => (
                    <option key={e.key} value={e.key}>{e.name} ({e.key})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Override Type</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                    value={overrideType}
                    onChange={(e) => setOverrideType(e.target.value)}
                  >
                    <option value="grant_access">Grant Access (Enable)</option>
                    <option value="limit_increase">Increase Quota Limit</option>
                    <option value="emergency_break_glass">Emergency Break-Glass</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Duration (Days)</label>
                  <input 
                    type="number"
                    value={overrideDays}
                    onChange={(e) => setOverrideDays(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              {overrideType === 'limit_increase' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">New Quota Amount</label>
                  <input 
                    type="number"
                    placeholder="e.g. 15000"
                    value={overrideLimit}
                    onChange={(e) => setOverrideLimit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Mandatory Business Justification</label>
                <textarea 
                  rows={3}
                  placeholder="e.g., Strategic pilot expansion approved by platform architect..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateOverride}
                className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20"
              >
                Activate Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
