import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Loader2, Barcode, Tag, Truck, Check } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailProducts({ orgId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Registration Form
  const [showRegModal, setShowRegModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Groceries',
    brand: '',
    unit_cost: 0,
    selling_price: 0,
    variants: 'Standard',
    description: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [orgId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/products?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data || []);
      }
    } catch (e) {
      console.error("Error loading products:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          category: formData.category,
          brand: formData.brand,
          unit_cost: Number(formData.unit_cost),
          selling_price: Number(formData.selling_price),
          variants: formData.variants.split(','),
          description: formData.description
        })
      });
      if (res.ok) {
        setShowRegModal(false);
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          category: 'Groceries',
          brand: '',
          unit_cost: 0,
          selling_price: 0,
          variants: 'Standard',
          description: ''
        });
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.detail || "Product registration failed");
      }
    } catch (e) {
      console.error("Product creation error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.attributes?.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Package className="w-4 h-4" /> Product Catalog & Inventory Items
          </div>
          <h2 className="text-3xl font-extrabold text-white">Digital SKU Variant Registry</h2>
          <p className="text-slate-400 mt-1">Configure product variants, barcode specs, pricing margins, and display catalogues.</p>
        </div>
        <button 
          onClick={() => setShowRegModal(true)} 
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Product SKU
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Filter catalog by name, brand, or SKU..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* PRODUCTS DIRECTORY */}
      <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-400" /> Registered SKU Catalogue
        </h3>
        
        {loading ? (
          <div className="py-20 text-center flex justify-center items-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" /> Loading catalogue...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU Code</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Barcode</th>
                  <th className="p-3">Cost Price</th>
                  <th className="p-3">Selling Price</th>
                  <th className="p-3">Markup</th>
                  <th className="p-3 text-right">Digital Catalog</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredProducts.map(p => {
                  const cost = p.attributes?.unit_cost || 0;
                  const price = p.attributes?.selling_price || 0;
                  const markup = price > 0 ? (((price - cost) / price) * 100).toFixed(0) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{p.display_label}</td>
                      <td className="p-3 font-mono text-amber-300">{p.attributes?.sku || 'SKU-001'}</td>
                      <td className="p-3">{p.attributes?.category || 'Groceries'}</td>
                      <td className="p-3 font-mono text-slate-400 flex items-center gap-1"><Barcode className="w-3.5 h-3.5 text-slate-500" /> {p.attributes?.barcode || 'N/A'}</td>
                      <td className="p-3">₦{Number(cost).toLocaleString()}</td>
                      <td className="p-3 font-bold text-white">₦{Number(price).toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">+{markup}%</td>
                      <td className="p-3 text-right">
                        {p.attributes?.digital_catalog_visible !== false ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Visible</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-slate-400">Hidden</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGISTRATION MODAL */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-md w-full space-y-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-white">Register Product SKU</h3>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Product Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Dangote Whole Milk 1L"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">SKU Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. SKU-MILK-001"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Barcode</label>
                  <input 
                    type="text" 
                    placeholder="Barcode string"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dairies">Dairies</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Cosmetics">Cosmetics</option>
                    <option value="Fresh Produce">Fresh Produce</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Brand</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dangote"
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Cost Price (₦)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.unit_cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase">Selling Price (₦)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Variants (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.variants}
                  onChange={(e) => setFormData(prev => ({ ...prev, variants: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Description</label>
                <textarea 
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setShowRegModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  {submitting ? 'Creating SKU...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
