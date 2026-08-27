import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Star, BarChart, ShieldCheck, FileText, CheckCircle2, Clock } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailProcurement({ orgId }) {
  const [suppliers, setSuppliers] = useState([
    { id: 'sup_dangote', display_label: 'Dangote Dairies', attributes: { code: 'SUPP-DANG', contact_person: 'Alhaji Musa Dangote', email: 'procurement@dangotedairies.com', lead_time_days: 2, quality_score: 96, delivery_accuracy: 98, vendor_scorecard_rating: 'A+' } },
    { id: 'sup_guinness', display_label: 'Guinness Nigeria PLC', attributes: { code: 'SUPP-GUIN', contact_person: 'Rita Johnson', email: 'orders@guinness-nigeria.com', lead_time_days: 4, quality_score: 92, delivery_accuracy: 89, vendor_scorecard_rating: 'B' } }
  ]);
  const [purchaseOrders, setPurchaseOrders] = useState([
    { id: 'PO-99201', supplier: 'Dangote Dairies', date: '2026-08-03', items: 'Whole Milk 1L x 120 units', amount: '₦108,000', status: 'Approved' },
    { id: 'PO-99202', supplier: 'Guinness Nigeria PLC', date: '2026-08-04', items: 'Stout Beer x 350 units', amount: '₦140,000', status: 'Pending Review' }
  ]);
  const [showPoModal, setShowPoModal] = useState(false);
  const [poForm, setPoForm] = useState({ supplier: 'Dangote Dairies', items: 'Milk x 100', amount: 90000 });

  useEffect(() => {
    fetchSuppliers();
  }, [orgId]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/suppliers?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePo = (e) => {
    e.preventDefault();
    const newPo = {
      id: `PO-${Math.floor(10000 + Math.random() * 90000)}`,
      supplier: poForm.supplier,
      date: new Date().toISOString().split('T')[0],
      items: poForm.items,
      amount: `₦${Number(poForm.amount).toLocaleString()}`,
      status: 'Pending Review'
    };
    setPurchaseOrders(prev => [newPo, ...prev]);
    setShowPoModal(false);
    alert(`Purchase Order ${newPo.id} submitted for approval.`);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Truck className="w-4 h-4" /> Supplier Management & Procurement
          </div>
          <h2 className="text-3xl font-extrabold text-white">Purchase Orders & Scorecards</h2>
          <p className="text-slate-400 mt-1">Audit supplier lead times, manage inventory reordering, and track logistics delivery accuracy.</p>
        </div>

        <button 
          onClick={() => setShowPoModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Purchase Order
        </button>
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SUPPLIERS LIST */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" /> Supplier Directory
          </h3>

          <div className="space-y-4">
            {suppliers.map(sup => (
              <div key={sup.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sup.display_label}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sup.attributes?.code} | Contact: {sup.attributes?.contact_person}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                    sup.attributes?.vendor_scorecard_rating === 'A+' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    Score: {sup.attributes?.vendor_scorecard_rating}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/5 text-center text-[10px]">
                  <div>
                    <p className="text-slate-400 uppercase font-bold">Avg Lead Time</p>
                    <p className="text-xs font-mono text-white mt-1 flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {sup.attributes?.lead_time_days} days</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase font-bold">Quality Accuracy</p>
                    <p className="text-xs font-mono text-emerald-400 font-bold mt-1">{sup.attributes?.quality_score}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase font-bold">Delivery Accuracy</p>
                    <p className="text-xs font-mono text-emerald-400 font-bold mt-1">{sup.attributes?.delivery_accuracy}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PURCHASE ORDERS TRACKING */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" /> Procurement Stream
          </h3>

          <div className="space-y-4">
            {purchaseOrders.map(po => (
              <div key={po.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-300 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-white font-mono">{po.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    po.status === 'Approved' ? 'bg-emerald-500/25 text-emerald-300' : 'bg-amber-500/25 text-amber-300 animate-pulse'
                  }`}>
                    {po.status}
                  </span>
                </div>
                <p className="font-bold">{po.supplier}</p>
                <p className="text-[10px] text-slate-400 font-mono">{po.items}</p>
                <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[10px] text-slate-500 font-mono">
                  <span>{po.date}</span>
                  <span className="text-amber-400 font-bold">{po.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PO CREATION MODAL */}
      {showPoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-sm w-full space-y-6 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Create Purchase Order</h3>
            <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Supplier Partner</label>
                <select 
                  value={poForm.supplier}
                  onChange={(e) => setPoForm(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Dangote Dairies">Dangote Dairies</option>
                  <option value="Guinness Nigeria PLC">Guinness Nigeria PLC</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">SKU items & Quantity</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Milk SKU x 150 units"
                  value={poForm.items}
                  onChange={(e) => setPoForm(prev => ({ ...prev, items: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Estimated Invoice cost (₦)</label>
                <input 
                  type="number" 
                  required
                  value={poForm.amount}
                  onChange={(e) => setPoForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowPoModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Submit PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
