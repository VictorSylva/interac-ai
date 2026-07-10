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
  X
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
    const [confirmName, setConfirmName] = useState('');

    useEffect(() => {
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses?include_deleted=true&user_id=${currentUser.id}`);
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

    const toggleStatus = async (businessId, currentStatus) => {
        if (!currentUser) return;
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            await fetch(`${apiUrl}/api/super-admin/businesses/${businessId}/status?user_id=${currentUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchBusinesses();
        } catch (err) {
            console.error("Status update failed", err);
        }
    };

    const handleSoftDelete = async () => {
        if (!selectedBusiness || confirmName !== selectedBusiness.name || !currentUser) return;

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/super-admin/businesses/${selectedBusiness.business_id}?user_id=${currentUser.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setShowDeleteModal(false);
                setConfirmName('');
                fetchBusinesses();
            }
        } catch (err) {
            console.error("Soft delete failed", err);
        }
    };

    const reactivateBusiness = async (businessId) => {
        if (!currentUser) return;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            await fetch(`${apiUrl}/api/super-admin/businesses/${businessId}/reactivate?user_id=${currentUser.id}`, {
                method: 'POST'
            });
            fetchBusinesses();
        } catch (err) {
            console.error("Reactivation failed", err);
        }
    };

    const filteredBusinesses = businesses.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (b.business_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterStatus === 'deleted') return matchesSearch && b.is_deleted;
        if (filterStatus === 'active') return matchesSearch && !b.is_deleted && b.status === 'active';
        if (filterStatus === 'suspended') return matchesSearch && !b.is_deleted && b.status === 'suspended';
        
        return matchesSearch;
    });

    return (
        <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
                        <Building size={24} className="text-blue-600" />
                        Business Management
                    </h2>
                    <p className="text-grey-600 text-sm">Monitor and manage all connected tenants.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-grey-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by name or ID..." 
                            className="pl-10 pr-4 py-2 bg-white border border-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-white border border-grey-medium px-4 py-2 rounded-xl text-sm focus:outline-none shadow-sm font-medium text-grey-700"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All States</option>
                        <option value="active">Active Only</option>
                        <option value="suspended">Suspended</option>
                        <option value="deleted">Soft Deleted</option>
                    </select>
                    <button 
                         onClick={fetchBusinesses}
                         className="p-2 bg-white border border-grey-medium rounded-xl hover:bg-grey-50 transition-colors text-grey-600 shadow-sm"
                         title="Refresh Data"
                    >
                        <RefreshCcw size={18} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-grey-medium overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-grey-50/50 border-b border-grey-medium">
                            <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Business Details</th>
                            <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Plan & Tokens</th>
                            <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-100">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan="5" className="px-6 py-6"><div className="h-4 bg-grey-200 rounded w-full"></div></td>
                                </tr>
                            ))
                        ) : filteredBusinesses.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-grey-500 italic">
                                    No businesses found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredBusinesses.map((b) => (
                                <tr key={b.business_id} className={`hover:bg-grey-50/50 transition-colors ${b.is_deleted ? 'bg-red-50/20' : ''}`}>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-blue-700 shadow-inner ${b.is_deleted ? 'bg-red-100' : 'bg-blue-50'}`}>
                                                {(b.name || 'U')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className={`font-bold text-navy ${b.is_deleted ? 'line-through opacity-50' : ''}`}>
                                                    {b.name || 'Unnamed Business'}
                                                </div>
                                                <div className="text-[10px] font-mono text-grey-400 uppercase">{b.business_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-semibold text-grey-700 capitalize">{b.plan_name}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-1.5 bg-grey-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 w-3/4"></div>
                                                </div>
                                                <span className="text-[10px] text-grey-500 font-bold">Good</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {b.is_deleted ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold w-fit">
                                                <AlertCircle size={12} />
                                                Deleted
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                                                b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {b.status === 'active' ? <CheckCircle size={12} /> : <Ban size={12} />}
                                                {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-sm text-grey-500 font-medium">
                                        {new Date(b.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            {b.is_deleted ? (
                                                <button 
                                                    onClick={() => reactivateBusiness(b.business_id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
                                                >
                                                    <RefreshCcw size={14} />
                                                    Reactivate
                                                </button>
                                            ) : (
                                                <>
                                                    <button 
                                                        className="p-2 hover:bg-grey-100 text-grey-400 hover:text-navy rounded-lg transition-colors"
                                                        title="Quick Actions"
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleStatus(b.business_id, b.status)}
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            b.status === 'active' ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'
                                                        }`}
                                                        title={b.status === 'active' ? 'Suspend Access' : 'Activate Access'}
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedBusiness(b);
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Soft Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Safety Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom-8 duration-300">
                        <div className="bg-red-50 p-6 flex items-center justify-between border-b border-red-100">
                           <div className="flex items-center gap-3 text-red-700">
                                <div className="p-2 bg-red-100 rounded-xl">
                                    <AlertCircle size={20} />
                                </div>
                                <h3 className="font-bold text-lg">Safe Deletion Flow</h3>
                           </div>
                           <button onClick={() => setShowDeleteModal(false)} className="text-red-400 hover:text-red-700">
                                <X size={20} />
                           </button>
                        </div>
                        
                        <div className="p-8">
                            <p className="text-grey-600 mb-6 leading-relaxed">
                                You are about to <span className="font-bold text-navy">deactivate</span> the business: <br/>
                                <span className="inline-block mt-2 px-3 py-1 bg-grey-100 rounded-lg font-mono text-navy font-bold border border-grey-medium">
                                    {selectedBusiness?.name}
                                </span>
                            </p>
                            
                            <div className="space-y-4 mb-8">
                                <div className="flex gap-3 text-sm text-grey-500 italic bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                    <div className="shrink-0"><Shield size={16} className="text-blue-500" /></div>
                                    <p>This will disable logins and stop all automated workflows. Data remains in the system but will be marked as "Deleted".</p>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-grey-500 uppercase mb-2 ml-1">Type business name to confirm</label>
                                    <input 
                                        type="text" 
                                        autoFocus
                                        placeholder={selectedBusiness?.name}
                                        value={confirmName}
                                        onChange={(e) => setConfirmName(e.target.value)}
                                        className="w-full px-5 py-3 bg-white border border-grey-medium rounded-xl text-navy font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 px-4 bg-grey-100 text-grey-700 font-bold rounded-xl hover:bg-grey-200 transition-all border border-grey-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={confirmName !== selectedBusiness?.name}
                                    onClick={handleSoftDelete}
                                    className={`flex-1 py-3 px-4 font-bold rounded-xl transition-all shadow-md ${
                                        confirmName === selectedBusiness?.name 
                                            ? 'bg-red-600 text-white hover:bg-red-700' 
                                            : 'bg-red-200 text-white cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    Confirm Deactivate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
