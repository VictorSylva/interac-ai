import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Check, Loader2, AlertCircle, 
  Sparkles, CheckCircle2, User, RefreshCw, Layers 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Inventory({ orgId }) {
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stockChange, setStockChange] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    sku_name: '',
    stock_level: 10,
    alert_threshold: 5,
    supplier: 'General Store',
    cost_price: 1500.0,
    unit: 'pcs'
  });

  useEffect(() => {
    fetchSkus();
  }, [orgId]);

  const fetchSkus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/inventory?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSkus(data || []);
      }
    } catch (e) {
      console.error("Error loading inventory SKUs:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSku = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...formData
        })
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ sku_name: '', stock_level: 10, alert_threshold: 5, supplier: 'General Store', cost_price: 1500.0, unit: 'pcs' });
        await fetchSkus();
      }
    } catch (err) {
      console.error("Error creating SKU:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (skuId, change) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/inventory/${skuId}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          stock_change: change
        })
      });
      if (res.ok) {
        setStockChange(prev => ({ ...prev, [skuId]: '' }));
        await fetchSkus();
      }
    } catch (e) {
      console.error("Error adjusting stock count:", e);
    }
  };

  const lowStockItems = skus.filter(s => s.attributes.stock_level < s.attributes.alert_threshold);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Package className="text-purple-400 w-6 h-6" /> Inventory & Store Control
          </h2>
          <p className="text-slate-400 text-xs mt-1">Monitor hotel supplies, food ingredients, minibar stock, and low-level SKU warnings.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Add Inventory SKU
        </button>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Inventory SKUs</div>
            <div className="text-xl font-black text-white mt-1">{skus.length} Items</div>
          </div>
          <Layers className="w-8 h-8 text-purple-400" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Low Stock Alerts</div>
            <div className="text-xl font-black text-white mt-1">{lowStockItems.length} SKUs</div>
          </div>
          <AlertCircle className={`w-8 h-8 ${lowStockItems.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Supplier Partners</div>
            <div className="text-xl font-black text-white mt-1">4 Suppliers</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Inventory SKU table */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Store Room Stock Ledger
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : skus.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No inventory SKUs registered. Click "Add Inventory SKU" to add supplies.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">SKU Name</th>
                  <th className="p-3">Stock Count</th>
                  <th className="p-3">Threshold</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Cost Price</th>
                  <th className="p-3 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {skus.map(sku => {
                  const stock = sku.attributes.stock_level || 0;
                  const threshold = sku.attributes.alert_threshold || 5;
                  const isLow = stock < threshold;
                  
                  return (
                    <tr key={sku.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{sku.display_label}</td>
                      <td className="p-3 font-mono">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isLow ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'
                        }`}>
                          {stock} {sku.attributes.unit}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{threshold} {sku.attributes.unit}</td>
                      <td className="p-3 text-slate-400">{sku.attributes.supplier}</td>
                      <td className="p-3 font-mono">₦{sku.attributes.cost_price?.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <input 
                            type="number" 
                            placeholder="Qty" 
                            value={stockChange[sku.id] || ''}
                            onChange={(e) => setStockChange({ ...stockChange, [sku.id]: e.target.value })}
                            className="w-16 px-2 py-1 rounded bg-black/40 border border-white/10 text-white placeholder-slate-600 text-[10px] focus:outline-none focus:border-purple-500 text-center font-mono"
                          />
                          <button 
                            onClick={() => handleAdjustStock(sku.id, parseInt(stockChange[sku.id] || 0))}
                            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold"
                          >
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add SKU Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Inventory SKU</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleCreateSku} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">SKU Name / Item</label>
                <input 
                  type="text" 
                  required
                  value={formData.sku_name}
                  onChange={(e) => setFormData({...formData, sku_name: e.target.value})}
                  placeholder="e.g. Minibar Coca-Cola 33cl"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Stock Level</label>
                  <input 
                    type="number" 
                    required
                    value={formData.stock_level}
                    onChange={(e) => setFormData({...formData, stock_level: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Alert Threshold</label>
                  <input 
                    type="number" 
                    required
                    value={formData.alert_threshold}
                    onChange={(e) => setFormData({...formData, alert_threshold: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Cost Price (₦)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({...formData, cost_price: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Unit Type</label>
                  <input 
                    type="text" 
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    placeholder="pcs, bottles, crates"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Supplier Record</label>
                <input 
                  type="text" 
                  value={formData.supplier}
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Inventory SKU"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
