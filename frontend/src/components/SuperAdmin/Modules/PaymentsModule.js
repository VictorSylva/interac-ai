import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  Download
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL } from '../../../config';

export default function PaymentsModule() {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const getAuthHeaders = () => {
    const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
      const res = await fetch(`${API_BASE_URL}/api/super-admin/payments?user_id=${encodeURIComponent(uid)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
      }
    } catch (err) {
      console.error("Failed to fetch payments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [currentUser]);

  const filteredPayments = payments.filter(p => 
    (p.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
            <CreditCard size={24} className="text-green-600" />
            Payment Transactions
          </h2>
          <p className="text-grey-600 text-sm">Real-time view of subscription and token purchases.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-grey-400" size={18} />
            <input 
              type="text" 
              placeholder="Ref or business name..." 
              className="pl-10 pr-4 py-2 bg-white border border-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
             onClick={fetchPayments}
             className="p-2 bg-white border border-grey-medium rounded-xl hover:bg-grey-50 transition-colors text-grey-600 shadow-sm"
          >
            <RefreshCcw size={18} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-all shadow-md">
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-grey-medium overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-grey-50/50 border-b border-grey-medium">
              <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Business</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Reference</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="5" className="px-6 py-6"><div className="h-4 bg-grey-200 rounded w-full"></div></td>
                </tr>
              ))
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-grey-500 italic">
                  No payment transactions found.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-grey-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-bold text-navy">{p.business_name}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold text-navy">
                      {p.currency} {p.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs font-mono text-grey-500 bg-grey-100 px-2 py-1 rounded inline-block">
                      {p.reference}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs text-grey-500 font-medium whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-fit uppercase tracking-wider ${
                      p.status === 'success' ? 'bg-green-100 text-green-700' : 
                      p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {p.status === 'success' ? <CheckCircle size={10} /> : p.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                      {p.status}
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
