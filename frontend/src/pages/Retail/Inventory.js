import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, AlertCircle, ArrowLeftRight, Calendar, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailInventory({ orgId }) {
  const [activeSubTab, setActiveSubTab] = useState('levels');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inventory, setInventory] = useState([
    { product_id: 'prod_milk', display_label: 'Dangote Premium Milk 1L', sku: 'SKU-MILK-001', stock_level: 12, reorder_threshold: 30, warehouse_allocations: { "Depot A": 8, "Depot B": 4 }, expiry_date: '2026-08-15', batch_number: 'B-MK882', dead_stock: false },
    { product_id: 'prod_egg', display_label: 'Grade A Farm Fresh Eggs Crate', sku: 'SKU-EGG-102', stock_level: 40, reorder_threshold: 15, warehouse_allocations: { "Depot A": 30, "Depot B": 10 }, expiry_date: '2026-08-25', batch_number: 'B-EG911', dead_stock: false },
    { product_id: 'prod_beer', display_label: 'Guinness Stout Bottle 330ml', sku: 'SKU-BEER-409', stock_level: 180, reorder_threshold: 50, warehouse_allocations: { "Depot A": 120, "Depot B": 60 }, expiry_date: '2027-02-10', batch_number: 'B-GS550', dead_stock: false }
  ]);

  // Adjust Inventory Form
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [formData, setFormData] = useState({ sku: '', adjustment: 10, reason: 'Cycle Count Correction' });

  // Stock Transfer Form
  const [transferData, setTransferData] = useState({ sku: 'SKU-MILK-001', qty: 5, from: 'Depot A', to: 'Depot B' });

  useEffect(() => {
    fetchInventory();
  }, [orgId]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/inventory?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowAdjustModal(false);
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate transfer by adjusting Depot allocations in UI
    setTimeout(() => {
      setInventory(prev => prev.map(item => {
        if (item.sku === transferData.sku) {
          const qty = Number(transferData.qty);
          const fromLoc = transferData.from;
          const toLoc = transferData.to;
          const fromStock = Math.max(0, (item.warehouse_allocations[fromLoc] || 0) - qty);
          const toStock = (item.warehouse_allocations[toLoc] || 0) + qty;
          return {
            ...item,
            warehouse_allocations: {
              ...item.warehouse_allocations,
              [fromLoc]: fromStock,
              [toLoc]: toStock
            }
          };
        }
        return item;
      }));
      setSubmitting(false);
      alert("Inventory stock transfer registered successfully.");
    }, 800);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Layers className="w-4 h-4" /> Supply Chain & Inventory Control
          </div>
          <h2 className="text-3xl font-extrabold text-white">Supermarket Stock Ledger & Logistics</h2>
          <p className="text-slate-400 mt-1">Expiry date tracking, cycle counts, dead stock scans, and warehouse transfers.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (inventory.length > 0) {
                setFormData({ sku: inventory[0].sku, adjustment: 5, reason: 'Cycle Count Correction' });
                setShowAdjustModal(true);
              }
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Adjust / Shrinkage Count
          </button>
        </div>
      </div>

      {/* SUBTABS */}
      <div className="flex gap-2 border-b border-white/5 pb-1">
        {[
          { id: 'levels', label: 'Stock Levels & Reorder Limits' },
          { id: 'transfers', label: 'Warehouse & Depot Transfers' },
          { id: 'expiry', label: 'Expiry & Batch Traceability' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeSubTab === tab.id 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeSubTab === 'levels' && (
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Supermarket Stock Directory</h3>
            <span className="text-[10px] text-slate-500 font-mono">Live Sync</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Total In-Stock</th>
                  <th className="p-3">Reorder Point</th>
                  <th className="p-3">Replenishment Status</th>
                  <th className="p-3 text-right">Depot Allocations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {inventory.map(item => {
                  const understocked = item.stock_level <= item.reorder_threshold;
                  return (
                    <tr key={item.sku} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{item.display_label}</td>
                      <td className="p-3 font-mono text-slate-400">{item.sku}</td>
                      <td className="p-3 font-bold">{item.stock_level} units</td>
                      <td className="p-3 font-mono text-slate-400">{item.reorder_threshold} units</td>
                      <td className="p-3">
                        {understocked ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3.5 h-3.5" /> REORDER CRITICAL
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OPTIMAL STOCK
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">
                        {Object.entries(item.warehouse_allocations).map(([depot, qty]) => `${depot}: ${qty}`).join(' | ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'transfers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* TRANSFER FORM */}
          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" /> Log Stock Transfer
            </h3>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Product SKU</label>
                <select 
                  value={transferData.sku}
                  onChange={(e) => setTransferData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  {inventory.map(i => (
                    <option key={i.sku} value={i.sku}>{i.display_label} ({i.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">From Source</label>
                  <select 
                    value={transferData.from}
                    onChange={(e) => setTransferData(prev => ({ ...prev, from: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Depot A">Depot A</option>
                    <option value="Depot B">Depot B</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">To Target</label>
                  <select 
                    value={transferData.to}
                    onChange={(e) => setTransferData(prev => ({ ...prev, to: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Depot B">Depot B</option>
                    <option value="Depot A">Depot A</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Quantity (Units)</label>
                <input 
                  type="number"
                  min="1"
                  value={transferData.qty}
                  onChange={(e) => setTransferData(prev => ({ ...prev, qty: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                {submitting ? 'Registering Transfer...' : 'Initiate Transfer'}
              </button>
            </form>
          </div>

          {/* TRANSFER LOGS VIEW */}
          <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Logistics Transfer History</h3>
            <div className="space-y-3">
              {[
                { date: '2026-08-04 09:20 AM', sku: 'SKU-MILK-001', qty: 20, from: 'Depot B', to: 'Depot A', status: 'Delivered', courier: 'Supermarket Truck #2' },
                { date: '2026-08-03 14:15 PM', sku: 'SKU-BEER-409', qty: 50, from: 'Depot A', to: 'Depot B', status: 'In Transit', courier: 'Logistics Dispatch' }
              ].map((log, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-300">
                  <div className="space-y-1">
                    <p className="font-bold text-white">{log.sku} - {log.qty} units</p>
                    <p className="text-[10px] text-slate-400 font-mono">{log.from} &rarr; {log.to} | Courier: {log.courier}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${log.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{log.status}</span>
                    <p className="text-[9px] text-slate-500 font-mono mt-1">{log.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'expiry' && (
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-400" /> Expiry & Batch Traceability Ledger
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300">Safety Compliance Active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3 text-right">Action Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {inventory.map(item => {
                  const expiryDays = Math.ceil((new Date(item.expiry_date) - new Date('2026-08-04')) / (1000 * 60 * 60 * 24));
                  const nearExpiry = expiryDays <= 15;
                  return (
                    <tr key={item.sku} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{item.display_label}</td>
                      <td className="p-3 font-mono text-slate-400">{item.sku}</td>
                      <td className="p-3 font-mono text-amber-300">{item.batch_number}</td>
                      <td className="p-3 font-mono">{item.expiry_date}</td>
                      <td className="p-3 text-right">
                        {nearExpiry ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans">
                            EXPIRES IN {expiryDays} DAYS (Markdown suggested)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                            COMPLIANT ({expiryDays} Days remaining)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUST INVENTORY MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-sm w-full space-y-6 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Adjust / Shrinkage Count</h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Product SKU</label>
                <select 
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  {inventory.map(i => (
                    <option key={i.sku} value={i.sku}>{i.display_label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Adjustment Units (negative for shrinkage)</label>
                <input 
                  type="number"
                  value={formData.adjustment}
                  onChange={(e) => setFormData(prev => ({ ...prev, adjustment: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Adjustment Reason</label>
                <select 
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Cycle Count Correction">Cycle Count Correction</option>
                  <option value="Damaged Stock Writeoff">Damaged Stock Writeoff</option>
                  <option value="CCTV Shoplifting Shrinkage">CCTV Shoplifting Shrinkage</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAdjustModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Adjust'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
