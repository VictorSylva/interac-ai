import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { Search, MoreHorizontal, Shield, Ban, Trash2 } from 'lucide-react';

export default function BusinessList() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/super-admin/businesses`);
            const data = await res.json();
            setBusinesses(data);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (business_id, currentStatus) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/super-admin/businesses/${business_id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchBusinesses();
            }
        } catch (err) {
        }
    };

    const deleteBusiness = async (business_id) => {
        if (!window.confirm("Are you sure you want to permanently delete this business? This action cannot be undone.")) {
            return;
        }
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/super-admin/businesses/${business_id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchBusinesses();
            }
        } catch (err) {
        }
    };

    const filteredBusinesses = businesses.filter(b => 
        (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.industry || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-navy">Registered Businesses</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-grey-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search businesses..." 
                        className="pl-10 pr-4 py-2 border border-grey-medium rounded-lg text-sm focus:outline-none focus:border-navy w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-grey-light text-left text-xs font-bold text-grey-600 uppercase tracking-wider">
                            <th className="p-4 rounded-tl-lg">Business Name</th>
                            <th className="p-4">Industry</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Plan</th>
                            <th className="p-4 rounded-tr-lg">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-medium">
                        {loading ? (
                            <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr>
                        ) : filteredBusinesses.length === 0 ? (
                            <tr><td colSpan="5" className="p-4 text-center">No businesses found.</td></tr>
                        ) : (
                            filteredBusinesses.map((b, idx) => (
                                <tr key={idx} className="hover:bg-grey-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-navy">{b.name || 'Unnamed Business'}</div>
                                        <div className="text-xs text-grey-500">{b.business_id}</div>
                                    </td>
                                    <td className="p-4 text-sm text-grey-600">{b.industry || 'N/A'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            b.status === 'suspended' ? 'bg-red-100 text-red-700' : 
                                            b.status === 'active' ? 'bg-green-100 text-green-700' :
                                            'bg-grey-200 text-grey-600'
                                        }`}>
                                            {(b.status || 'expired').charAt(0).toUpperCase() + (b.status || 'expired').slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-grey-600">
                                        {(b.plan_name || 'Pro Plan').charAt(0).toUpperCase() + (b.plan_name || 'Pro Plan').slice(1)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button 
                                                className="p-1 hover:bg-grey-200 rounded text-grey-600" 
                                                title="Manage Subscription"
                                            >
                                                <Shield size={16} />
                                            </button>
                                            <button 
                                                className={`p-1 rounded ${b.status === 'suspended' ? 'bg-red-100 text-red-600' : 'hover:bg-red-50 text-red-500'}`}
                                                title={b.status === 'suspended' ? "Activate" : "Suspend"}
                                                onClick={() => toggleStatus(b.business_id, b.status)}
                                            >
                                                <Ban size={16} />
                                            </button>
                                            <button 
                                                className="flex items-center gap-1 p-1 px-2 hover:bg-red-100 rounded text-red-600 border border-transparent hover:border-red-200 transition-colors"
                                                title="Delete Business"
                                                onClick={() => deleteBusiness(b.business_id)}
                                            >
                                                <Trash2 size={16} />
                                                <span className="text-xs font-bold">Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
