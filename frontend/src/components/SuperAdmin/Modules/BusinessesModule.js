import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Building, 
  MoreVertical, 
  Shield, 
  Ban, 
  Trash2, 
  RefreshCcw, 
  CheckCircle, 
  AlertCircle, 
  Filter, 
  X,
  Plus,
  Sliders,
  Sparkles,
  Clock,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL } from '../../../config';

export default function BusinessesModule() {
    const { currentUser } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPermanentModal, setShowPermanentModal] = useState(false);
    const [deleteType, setDeleteType] = useState('soft');
    const [deleting, setDeleting] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const [confirmPermanentName, setConfirmPermanentName] = useState('');

    // Provision Modal State
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [provisioning, setProvisioning] = useState(false);
    const [newBizName, setNewBizName] = useState('');
    const [newBizEmail, setNewBizEmail] = useState('');
    const [newBizPassword, setNewBizPassword] = useState('');
    const [newBizIndustry, setNewBizIndustry] = useState('general');
    const [smePreset, setSmePreset] = useState('beauty');
    const [newBizSize, setNewBizSize] = useState('Medium');
    const [isPilot, setIsPilot] = useState(false);
    const [pilotDays, setPilotDays] = useState(30);
    const [initialTokens, setInitialTokens] = useState(5000);
    const [accountMgr, setAccountMgr] = useState('Victor Sylva');

    const getAuthHeaders = () => {
        const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    };

    const fetchBusinesses = async () => {
        setLoading(true);
        try {
            const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
            const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses?include_deleted=true&user_id=${encodeURIComponent(uid)}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setBusinesses(data);
            }
        } catch (err) {
            console.error("Failed to fetch businesses", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBusinesses();
    }, [currentUser]);

    const toggleStatus = async (businessId, currentStatus) => {
        const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        try {
            await fetch(`${API_BASE_URL}/api/super-admin/businesses/${businessId}/status?user_id=${encodeURIComponent(uid)}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            fetchBusinesses();
        } catch (err) {
            console.error("Status update failed", err);
        }
    };

    const handleSoftDelete = async () => {
        if (!selectedBusiness || confirmName !== selectedBusiness.name) return;
        if (deleteType === 'permanent') {
            return handlePermanentDelete(confirmName);
        }
        const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses/${selectedBusiness.business_id}?user_id=${encodeURIComponent(uid)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                setShowDeleteModal(false);
                setConfirmName('');
                setSelectedBusiness(null);
                fetchBusinesses();
            } else {
                const data = await res.json();
                alert(data.detail || 'Failed to deactivate business');
            }
        } catch (err) {
            console.error("Soft delete failed", err);
            alert("Network error: Could not reach the server.");
        } finally {
            setDeleting(false);
        }
    };

    const handlePermanentDelete = async (overrideName) => {
        const checkName = overrideName || confirmPermanentName;
        if (!selectedBusiness || checkName !== selectedBusiness.name) return;
        const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses/${selectedBusiness.business_id}?permanent=true&user_id=${encodeURIComponent(uid)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                setShowPermanentModal(false);
                setShowDeleteModal(false);
                setConfirmPermanentName('');
                setConfirmName('');
                setSelectedBusiness(null);
                fetchBusinesses();
            } else {
                alert(data.detail || 'Failed to permanently delete business');
            }
        } catch (err) {
            console.error("Permanent delete failed", err);
            alert("Network error: Could not reach the server.");
        } finally {
            setDeleting(false);
        }
    };

    const reactivateBusiness = async (businessId) => {
        const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
        try {
            await fetch(`${API_BASE_URL}/api/super-admin/businesses/${businessId}/reactivate?user_id=${encodeURIComponent(uid)}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            fetchBusinesses();
        } catch (err) {
            console.error("Reactivation failed", err);
        }
    };

    const handleProvisionBusiness = async () => {
        if (!newBizName || !newBizEmail || !newBizPassword) {
            alert('Please fill all required tenant fields.');
            return;
        }
        setProvisioning(true);
        const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
        try {
            const res = await fetch(`${API_BASE_URL}/api/super-admin/provision-business?user_id=${encodeURIComponent(uid)}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    business_name: newBizName,
                    email: newBizEmail,
                    password: newBizPassword,
                    industry: newBizIndustry,
                    sme_preset: newBizIndustry === 'sme' ? smePreset : undefined,
                    business_size: newBizSize,
                    commercial_status: isPilot ? 'pilot_active' : 'customer_active',
                    pilot_enabled: isPilot,
                    pilot_days: parseInt(pilotDays) || 30,
                    account_manager_name: accountMgr,
                    initial_tokens: parseInt(initialTokens) || 10000000
                })
            });

            if (res.ok) {
                setShowProvisionModal(false);
                setNewBizName('');
                setNewBizEmail('');
                setNewBizPassword('');
                setNewBizIndustry('general');
                setSmePreset('beauty');
                fetchBusinesses();
                alert('Enterprise tenant and custom entitlements provisioned successfully!');
            } else {
                const errData = await res.json();
                alert(`Provisioning failed: ${errData.detail || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Error provisioning tenant.');
        } finally {
            setProvisioning(false);
        }
    };

    const filteredBusinesses = businesses.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (b.business_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (b.industry || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterStatus === 'deleted') return matchesSearch && b.is_deleted;
        if (filterStatus === 'active') return matchesSearch && !b.is_deleted && b.status === 'active';
        if (filterStatus === 'suspended') return matchesSearch && !b.is_deleted && b.status === 'suspended';
        if (filterStatus === 'pilot') return matchesSearch && !b.is_deleted && b.pilot_enabled;
        
        return matchesSearch;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                            <Building size={22} />
                        </div>
                        Tenant Administration & Profiles
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Audit-driven tenant management, custom operating system deployment, and lifecycle governance.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowProvisionModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                    >
                        <Plus size={16} />
                        <span>Provision Custom Operating System</span>
                    </button>

                    <button 
                        onClick={fetchBusinesses}
                        className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
                        title="Refresh"
                    >
                        <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by business name, ID, or industry..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {['all', 'active', 'pilot', 'suspended', 'deleted'].map(st => (
                            <button
                                key={st}
                                onClick={() => setFilterStatus(st)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                                    filterStatus === st 
                                        ? 'bg-slate-900 text-white shadow-sm' 
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="py-4 px-6">Tenant Name</th>
                                <th className="py-4 px-6">Industry Module</th>
                                <th className="py-4 px-6">Commercial Status</th>
                                <th className="py-4 px-6">Account Mgr</th>
                                <th className="py-4 px-6">Token Balance</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">Loading tenants...</td></tr>
                            ) : filteredBusinesses.length === 0 ? (
                                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">No businesses found.</td></tr>
                            ) : (
                                filteredBusinesses.map((b) => (
                                    <tr key={b.business_id} className="hover:bg-slate-50/80 transition">
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-slate-900">{b.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{b.business_id}</div>
                                            {b.owner_email && (
                                                <div className="text-[11px] text-blue-600 font-medium mt-0.5">{b.owner_email}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase">
                                                {b.industry || 'Hotel'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {b.is_deleted ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full">
                                                    Deleted
                                                </span>
                                            ) : b.status === 'suspended' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                                                    Suspended
                                                </span>
                                            ) : b.pilot_enabled ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                                                    <Clock size={12} /> Pilot Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                                                    <CheckCircle size={12} /> Active Customer
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                                            {b.account_manager || 'Victor Sylva'}
                                        </td>
                                        <td className="py-4 px-6 font-bold text-slate-800">
                                            {(b.tokens_available || 0).toLocaleString()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {!b.is_deleted && (
                                                    <button
                                                        onClick={() => toggleStatus(b.business_id, b.status)}
                                                        className={`p-1.5 rounded-lg border transition ${
                                                            b.status === 'suspended' 
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                                                                : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                                        }`}
                                                        title={b.status === 'suspended' ? "Reactivate" : "Suspend"}
                                                    >
                                                        {b.status === 'suspended' ? <CheckCircle size={15} /> : <Ban size={15} />}
                                                    </button>
                                                )}

                                                {b.is_deleted ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => reactivateBusiness(b.business_id)}
                                                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition shadow-sm"
                                                            title="Restore Business"
                                                        >
                                                            Restore
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBusiness(b);
                                                                setConfirmPermanentName('');
                                                                setShowPermanentModal(true);
                                                            }}
                                                            className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-sm"
                                                            title="Permanently Delete (Purge from Database)"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBusiness(b);
                                                            setDeleteType('soft');
                                                            setConfirmName('');
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-sm"
                                                        title="Delete Business"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Provisioning Wizard Modal */}
            {showProvisionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                                <Sparkles className="text-blue-600" size={20} />
                                Provision Custom Enterprise Operating System
                            </div>
                            <button onClick={() => setShowProvisionModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="py-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Organization Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Grand Monarch Luxury Hotel"
                                    value={newBizName}
                                    onChange={(e) => setNewBizName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Primary Owner Email *</label>
                                    <input 
                                        type="email" 
                                        placeholder="admin@hotel.com"
                                        value={newBizEmail}
                                        onChange={(e) => setNewBizEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Initial Password *</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••"
                                        value={newBizPassword}
                                        onChange={(e) => setNewBizPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Industry Module</label>
                                    <select 
                                        value={newBizIndustry}
                                        onChange={(e) => setNewBizIndustry(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                    >
                                        <option value="general">General Enterprise (Default)</option>
                                        <option value="sme">SME & Business Operations</option>
                                        <option value="hotel">Hospitality & Hotels</option>
                                        <option value="hospital">Healthcare & Hospitals</option>
                                        <option value="retail">Retail & Supermarkets</option>
                                        <option value="school">Education & Schools</option>
                                        <option value="estate">Real Estate & Facility</option>
                                        <option value="manufacturing">Manufacturing</option>
                                    </select>
                                </div>

                                {newBizIndustry === 'sme' && (
                                    <div className="col-span-2 p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
                                        <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                            <Sparkles size={14} className="text-amber-600" />
                                            SME Industry Preset & Starter Pack
                                        </label>
                                        <select 
                                            value={smePreset}
                                            onChange={(e) => setSmePreset(e.target.value)}
                                            className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                        >
                                            <option value="beauty">Beauty & Wellness (Salons, Spas, Skincare)</option>
                                            <option value="fashion">Fashion & Apparel (Tailors, Boutiques, Designers)</option>
                                            <option value="consulting">Professional Services & Consulting (Agencies, Freelancers)</option>
                                            <option value="cleaning">Cleaning & Facilities Management</option>
                                            <option value="printing">Printing, Branding & Media Production</option>
                                            <option value="general_trade">General Trade, Wholesale & Distribution</option>
                                        </select>
                                        <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
                                            Automatically seeds domain products/services, appointment types, customer tags, and Argus KPI metrics.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Assigned Specialist</label>
                                    <input 
                                        type="text" 
                                        value={accountMgr}
                                        onChange={(e) => setAccountMgr(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Initial AI Tokens</label>
                                    <input 
                                        type="number" 
                                        value={initialTokens}
                                        onChange={(e) => setInitialTokens(parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                                        placeholder="5000"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800">Pilot Deployment</span>
                                    <input 
                                        type="checkbox" 
                                        checked={isPilot}
                                        onChange={(e) => setIsPilot(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </div>

                                {isPilot && (
                                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
                                        <span className="text-xs text-slate-600 font-medium">Pilot Period:</span>
                                        <input 
                                            type="number" 
                                            value={pilotDays}
                                            onChange={(e) => setPilotDays(e.target.value)}
                                            className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                                        />
                                        <span className="text-xs text-slate-400">days</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button 
                                onClick={() => setShowProvisionModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleProvisionBusiness}
                                disabled={provisioning}
                                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
                            >
                                {provisioning ? 'Provisioning OS...' : 'Deploy Operating System'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Standard / Option-enabled Delete Confirmation Modal */}
            {showDeleteModal && selectedBusiness && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Business Tenant</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Managing tenant: <strong className="text-slate-900">{selectedBusiness.name}</strong> 
                            {selectedBusiness.owner_email && <span className="font-mono text-slate-600"> ({selectedBusiness.owner_email})</span>}
                        </p>

                        <div className="space-y-3 mb-5">
                            <label 
                                onClick={() => setDeleteType('soft')}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                                    deleteType === 'soft' 
                                        ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/20' 
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="deleteType" 
                                    value="soft" 
                                    checked={deleteType === 'soft'} 
                                    onChange={() => setDeleteType('soft')}
                                    className="mt-1 text-amber-600 focus:ring-amber-500" 
                                />
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Deactivate (Soft Delete) — Retain Data</div>
                                    <div className="text-[11px] text-slate-500 leading-normal mt-0.5">
                                        Disables access. Tenant data and users are preserved, allowing full restoration anytime. Note: email address remains linked to this tenant.
                                    </div>
                                </div>
                            </label>

                            <label 
                                onClick={() => setDeleteType('permanent')}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                                    deleteType === 'permanent' 
                                        ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-400/20' 
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="deleteType" 
                                    value="permanent" 
                                    checked={deleteType === 'permanent'} 
                                    onChange={() => setDeleteType('permanent')}
                                    className="mt-1 text-rose-600 focus:ring-rose-500" 
                                />
                                <div>
                                    <div className="text-xs font-bold text-rose-700">Permanent Database Purge (Hard Delete)</div>
                                    <div className="text-[11px] text-slate-500 leading-normal mt-0.5">
                                        Completely deletes all records from the database and erases associated user accounts. Frees up the email address for immediate re-registration.
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                                Type <strong className="text-slate-900 font-mono">"{selectedBusiness.name}"</strong> to confirm:
                            </label>
                            <input 
                                type="text"
                                placeholder={selectedBusiness.name}
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setConfirmName('');
                                }} 
                                disabled={deleting}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSoftDelete}
                                disabled={confirmName !== selectedBusiness.name || deleting}
                                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md disabled:opacity-40 transition flex items-center gap-1.5 ${
                                    deleteType === 'permanent' 
                                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                                        : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                }`}
                            >
                                <Trash2 size={14} />
                                {deleting ? 'Processing...' : deleteType === 'permanent' ? 'Purge Permanently' : 'Deactivate Tenant'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Permanent Purge Confirmation Modal */}
            {showPermanentModal && selectedBusiness && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-rose-100">
                        <div className="flex items-center gap-3 pb-4 border-b border-rose-100 text-rose-600">
                            <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-100">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Permanently Delete Account</h3>
                                <p className="text-xs text-rose-600 font-semibold">Irreversible Database Purge</p>
                            </div>
                        </div>

                        <div className="my-5 space-y-3">
                            <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl text-xs text-rose-900 leading-relaxed">
                                <p className="font-bold text-rose-950 mb-1">⚠️ Warning: This action cannot be undone.</p>
                                <p>
                                    This will permanently delete <strong className="font-black">{selectedBusiness.name}</strong>, 
                                    all registered users {selectedBusiness.owner_email && <span>(including <strong className="font-mono">{selectedBusiness.owner_email}</strong>)</span>}, 
                                    billing records, chat history, workflows, and settings directly from the database.
                                </p>
                                <p className="mt-2 font-bold text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                                    ✅ Once purged, the email address will immediately become available to register or provision a new account.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Type the business name <strong className="text-slate-900 font-mono">"{selectedBusiness.name}"</strong> to confirm:
                                </label>
                                <input 
                                    type="text"
                                    placeholder={selectedBusiness.name}
                                    value={confirmPermanentName}
                                    onChange={(e) => setConfirmPermanentName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => {
                                    setShowPermanentModal(false);
                                    setConfirmPermanentName('');
                                }} 
                                disabled={deleting}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handlePermanentDelete()}
                                disabled={confirmPermanentName !== selectedBusiness.name || deleting}
                                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-40 transition flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                {deleting ? 'Purging from Database...' : 'Permanently Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
