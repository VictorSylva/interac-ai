import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, User, Clock, AlertCircle, Play, Loader2, CheckCircle2, ShoppingBag 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Inventory({ orgId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Restock Modal Form
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [restockQty, setRestockQty] = useState(100);

  useEffect(() => {
    fetchInventory();
  }, [orgId]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/procurement/inventory?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data || []);
      }
    } catch (e) {
      console.error("Error loading inventory:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRestock = (item) => {
    setSelectedItem(item);
    setShowRestockModal(true);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/procurement/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          sku_code: selectedItem.attributes?.sku_code,
          qty_to_add: restockQty
        })
      });

      if (res.ok) {
        setShowRestockModal(false);
        await fetchInventory();
      }
    } catch (e) {
      console.error("Restock error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.attributes?.sku_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <ShoppingBag className="w-4 h-4" /> PROCUREMENT WING
          </div>
          <h2 className="text-3xl font-extrabold text-white">General Medical Consumables & Inventory</h2>
          <p className="text-slate-400 mt-1">Track stocks of syringes, gloves, sutures, and general clinical supplies, reorder low SKU stocks.</p>
        </div>
      </div>

      {/* Inventory list */}
      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-white">Consumables Catalog</h3>
          <input
            type="text"
            placeholder="Search catalog SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">SKU Item Name</th>
                <th className="p-4">SKU Identifier Code</th>
                <th className="p-4">Remaining Inventory</th>
                <th className="p-4">Rostered Supplier</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No inventory tracked.</td></tr>
              ) : (
                filteredItems.map(item => {
                  const isLow = item.attributes?.qty <= item.attributes?.min_alert_stock;
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{item.display_label}</td>
                      <td className="p-4 font-mono text-slate-400">{item.attributes?.sku_code}</td>
                      <td className="p-4">
                        <span className={`font-mono font-bold ${isLow ? 'text-rose-400' : 'text-slate-300'}`}>{item.attributes?.qty} units</span>
                        {isLow && <span className="ml-2 text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full uppercase">Low SKU</span>}
                      </td>
                      <td className="p-4 text-slate-400">{item.attributes?.supplier}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenRestock(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all shadow-md shadow-rose-500/10"
                        >
                          Request Restock Order
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-rose-400" /> Restock SKU Consumable</h3>
              <button onClick={() => setShowRestockModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
                Item: <strong className="text-white">{selectedItem.display_label}</strong> ({selectedItem.attributes?.sku_code}) <br />
                Supplier: <strong className="text-white">{selectedItem.attributes?.supplier}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Restock Order Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value))}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Dispatch Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
