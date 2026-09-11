import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Trash2, 
  DollarSign,
  Send,
  XCircle,
  Building,
  Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { useAuth } from '../../../contexts/AuthContext';

export default function InvoicesModule() {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Invoice Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBid, setSelectedBid] = useState('');
  const [invoiceTitle, setInvoiceTitle] = useState('InteracAI Custom Operating System Agreement');
  const [currency, setCurrency] = useState('NGN');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { description: 'InteracAI Platform Core Setup & Industry Operating System', quantity: 1, unit_price: 350000 },
    { description: 'WhatsApp Intelligence & AI Copilot Concierge Engine', quantity: 1, unit_price: 150000 }
  ]);

  const getAuthHeaders = () => {
    const token = currentUser?.token || currentUser?.access_token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchInvoices = async () => {
    try {
      const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
      const res = await fetch(`${API_BASE_URL}/api/super-admin/invoices?user_id=${encodeURIComponent(uid)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setInvoices(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const uid = currentUser?.id || currentUser?.uid || currentUser?.email || '';
      const res = await fetch(`${API_BASE_URL}/api/super-admin/businesses?user_id=${encodeURIComponent(uid)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBusinesses(data);
        if (data.length > 0) setSelectedBid(data[0].business_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchBusinesses();
  }, [currentUser]);

  const addItemRow = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...items];
    updated[idx][field] = field === 'description' ? value : parseFloat(value) || 0;
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
  };

  const handleCreateInvoice = async () => {
    if (!selectedBid || items.length === 0 || !currentUser) {
      alert('Please select a business and add at least one line item.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/invoices?user_id=${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: selectedBid,
          title: invoiceTitle,
          currency: currency,
          notes: notes,
          items: items
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchInvoices();
        alert('Custom invoice generated successfully!');
      } else {
        alert('Failed to generate invoice.');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating invoice.');
    }
  };

  const handleApproveInvoice = async (invoiceId) => {
    if (!window.confirm("Approve and mark this invoice as PAID? This will automatically provision and activate all associated custom capabilities.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/invoices/${invoiceId}/approve?user_id=${currentUser?.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchInvoices();
        alert('Invoice marked as paid and entitlements activated!');
      } else {
        alert('Approval failed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (inv.business_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <FileText size={22} />
            </div>
            Custom Invoices & Commercial Agreements
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Enterprise quote-to-provisioning pipeline. Issue tailored invoices and unlock custom entitlements upon approval.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20"
        >
          <Plus size={16} />
          <span>Generate Custom Agreement</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search invoice number or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6">Invoice #</th>
                <th className="py-4 px-6">Business Client</th>
                <th className="py-4 px-6">Total Amount</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Issue Date</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">Loading invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">No custom invoices found.</td></tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6 font-mono font-bold text-indigo-600">{inv.invoice_number}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{inv.business_name}</div>
                      <div className="text-xs text-slate-400">{inv.title}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {inv.currency} {inv.total_amount?.toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      {inv.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                          <CheckCircle2 size={13} /> Paid & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                          <Clock size={13} /> Issued (Pending)
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                      {new Date(inv.issue_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => handleApproveInvoice(inv.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          Approve & Provision
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <FileText className="text-indigo-600" size={20} />
                Generate Custom Operating System Invoice
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Target Tenant</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                    value={selectedBid}
                    onChange={(e) => setSelectedBid(e.target.value)}
                  >
                    {businesses.map(b => (
                      <option key={b.business_id} value={b.business_id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Currency</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Agreement Title</label>
                <input 
                  type="text" 
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Itemized Deliverables & Capabilities</label>
                  <button onClick={addItemRow} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <input 
                        type="text" 
                        placeholder="Deliverable description..."
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900"
                      />
                      <input 
                        type="number" 
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-900"
                      />
                      <input 
                        type="number" 
                        placeholder="Price"
                        value={it.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right text-slate-900"
                      />
                      <button onClick={() => removeItemRow(idx)} className="p-1 text-slate-400 hover:text-rose-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Total Contract Sum:</span>
                <span className="text-xl font-black text-indigo-900">
                  {currency} {calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateInvoice}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20"
              >
                Issue Agreement Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
