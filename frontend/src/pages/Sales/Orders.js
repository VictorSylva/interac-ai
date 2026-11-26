import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config';

const Orders = () => {
    const { currentUser } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if (currentUser) {
            fetchOrders();
        }
    }, [currentUser]);
    
    const getAuthHeaders = () => {
        let token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
        if (!token) {
            try {
                const user = JSON.parse(localStorage.getItem('interact_user') || '{}');
                token = user.token || user.access_token;
            } catch (e) {}
        }
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    };
    
    const fetchOrders = async () => {
        const businessId = currentUser.business_id || currentUser.email;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/sales/orders?business_id=${encodeURIComponent(businessId)}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(Array.isArray(data) ? data : []);
            }
        } catch(e) {
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-navy">Sales Orders</h1>
                <button onClick={fetchOrders} className="text-sm font-bold text-navy hover:underline">Refresh</button>
            </div>
            
            <div className="bg-white shadow-sm border border-grey-light rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-grey-50 border-b border-grey-light">
                        <tr>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">OrderID</th>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">Customer</th>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">Offer Detail</th>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">Payment</th>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">Delivery</th>
                            <th className="p-4 text-xs font-bold uppercase text-grey-500">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-100">
                        {orders.map(o => (
                            <tr key={o.id} className="hover:bg-grey-50 transition-colors">
                                <td className="p-4 font-mono text-sm text-grey-600">#{o.id}</td>
                                <td className="p-4">
                                    <div className="font-bold text-navy">{o.customer_email}</div>
                                    <div className="text-xs text-grey-500">{o.customer_phone || 'No phone'}</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-medium text-slate-800 text-sm truncate max-w-[200px]">
                                        {o.offer_title || 'Offer'}
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 uppercase">
                                        {o.currency} {o.amount}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${o.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {o.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {o.delivery_status ? (
                                        <div className="flex flex-col gap-1">
                                            <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${o.delivery_status === 'delivered' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {o.delivery_status}
                                            </span>
                                            {o.delivery_channel && (
                                                <span className="text-[9px] text-grey-400 font-bold uppercase">Via {o.delivery_channel}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-grey-300 font-bold uppercase italic">Not Sent</span>
                                    )}
                                </td>
                                <td className="p-4 text-grey-500 text-sm italic">{new Date(o.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {orders.length === 0 && !loading && (
                            <tr>
                                <td colSpan="6" className="p-16 text-center text-grey-400 font-medium italic">No orders found.</td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan="6" className="p-16 text-center text-grey-400 font-medium italic animate-pulse">Loading orders...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Orders;
