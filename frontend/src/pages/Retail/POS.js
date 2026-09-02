import React, { useState, useEffect } from 'react';
import { CreditCard, ShoppingBag, Plus, Minus, Search, Trash2, ShieldAlert, Sparkles, CheckCircle2, User, HelpCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailPOS({ orgId }) {
  const [products, setProducts] = useState([
    { id: 'prod_milk', display_label: 'Dangote Premium Whole Milk 1L', price: 950, category: 'Dairies', sku: 'SKU-MILK-001' },
    { id: 'prod_egg', display_label: 'Grade A Farm Fresh Eggs Crate', price: 2800, category: 'Fresh Produce', sku: 'SKU-EGG-102' },
    { id: 'prod_beer', display_label: 'Guinness Stout Bottle 330ml', price: 550, category: 'Beverages', sku: 'SKU-BEER-409' }
  ]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cashier, setCashier] = useState('Blessing Okon');
  const [lane, setLane] = useState('Lane 1');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, card: 0 });
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successTx, setSuccessTx] = useState(null);
  const [simulateScannerSkip, setSimulateScannerSkip] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [orgId]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/products?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setProducts(data.map(p => ({
            id: p.id,
            display_label: p.display_label,
            price: p.attributes?.selling_price || 1000,
            category: p.attributes?.category || 'General',
            sku: p.attributes?.sku || 'SKU-GEN'
          })));
        }
      }
    } catch (e) {
      console.error("Error fetching products:", e);
    }
  };

  const handleLookupCustomer = async () => {
    if (!customerPhone) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/customers?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        const found = data.find(c => c.attributes?.phone === customerPhone);
        if (found) {
          setSelectedCustomer({
            name: found.display_label,
            points: found.attributes?.loyalty_points || 0,
            tier: found.attributes?.membership_tier || 'Bronze'
          });
        } else {
          alert("Customer phone number not found.");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.id === product.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0.075; // 7.5% VAT
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/pos/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          lane_number: lane,
          cashier_name: cashier,
          total_amount: total,
          items: cart.map(i => ({ sku: i.sku, qty: i.quantity, unit_price: i.price })),
          payment_method: paymentMethod,
          simulated_skip: simulateScannerSkip ? 'Guinness Stout Bottle 330ml' : null
        })
      });

      if (res.ok) {
        const r = await res.json();
        setSuccessTx(r.transaction_id);
        setCart([]);
        setSelectedCustomer(null);
        setCustomerPhone('');
        setSimulateScannerSkip(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.display_label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-fade-in-up">
      {/* LEFT 2 COLUMNS: CATALOG */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-amber-400" /> POS Cashier Checkout Desk
            </h2>
            <p className="text-xs text-slate-400 mt-1">Register: <span className="text-white font-mono">{lane}</span> | Cashier: <span className="text-white font-mono">{cashier}</span></p>
          </div>

          <div className="flex gap-2">
            <select 
              value={lane} 
              onChange={(e) => setLane(e.target.value)} 
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="Lane 1">Lane 1</option>
              <option value="Lane 2">Lane 2</option>
              <option value="Lane 3">Lane 3</option>
            </select>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Scan barcode or type SKU / product name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* PRODUCTS LIST */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredProducts.map(p => (
            <div 
              key={p.id} 
              onClick={() => addToCart(p)}
              className="glass p-5 rounded-2xl border border-white/10 hover:border-amber-500/50 cursor-pointer hover:bg-white/[0.02] active:scale-[0.98] transition-all space-y-3 flex flex-col justify-between"
            >
              <div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 uppercase tracking-wider">{p.category}</span>
                <h4 className="text-sm font-bold text-white mt-2 leading-snug line-clamp-2">{p.display_label}</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{p.sku}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-base font-black text-amber-400">₦{p.price.toLocaleString()}</span>
                <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"><Plus className="w-4 h-4" /></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: SHOPPING CART */}
      <div className="glass p-6 rounded-3xl border border-white/10 flex flex-col justify-between h-[calc(100vh-12rem)] min-h-[500px]">
        <div className="space-y-6 overflow-y-auto max-h-[60%] pr-2">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-base font-bold text-white">Current Cart</h3>
            <span className="text-xs text-slate-400">{cart.length} unique items</span>
          </div>

          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="w-12 h-12 text-slate-600 animate-bounce" />
              Cart is currently empty. Click on items to add.
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white line-clamp-1">{item.display_label}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">₦{item.price.toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="p-1 rounded bg-white/10 text-white hover:bg-white/20"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-white/10 text-white hover:bg-white/20"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => removeFromCart(item.id)} className="p-1 text-slate-400 hover:text-rose-400 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CUSTOMER & CHECKOUT FOOTER */}
        <div className="border-t border-white/10 pt-6 space-y-4">
          {/* LOYALTY LOOKUP */}
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Customer Loyalty Ledger</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Phone (e.g. 08098765432)" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white flex-1 focus:outline-none"
              />
              <button 
                onClick={handleLookupCustomer}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10"
              >
                Find
              </button>
            </div>
            {selectedCustomer && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center text-xs">
                <span className="text-white font-bold flex items-center gap-1"><User className="w-3.5 h-3.5 text-emerald-400" /> {selectedCustomer.name}</span>
                <span className="text-emerald-400 font-mono font-bold">{selectedCustomer.points} pts ({selectedCustomer.tier})</span>
              </div>
            )}
          </div>

          {/* SIMULATE SCAN SKIP SIGNAL */}
          <div className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-xs">
            <span className="text-rose-300 font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-rose-400" /> Simulate Scan Skip</span>
            <input 
              type="checkbox" 
              checked={simulateScannerSkip}
              onChange={(e) => setSimulateScannerSkip(e.target.checked)}
              className="accent-rose-500 w-4 h-4"
            />
          </div>

          {/* PRICING BREAKDOWN */}
          <div className="space-y-1.5 text-xs border-t border-white/5 pt-4">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT (7.5%):</span>
              <span>₦{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-black text-white pt-1">
              <span>Total Bill:</span>
              <span className="text-amber-400">₦{total.toLocaleString()}</span>
            </div>
          </div>

          {/* PAYMENT TYPE SELECTOR */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {['Cash', 'Card', 'Split'].map(method => (
              <div 
                key={method} 
                onClick={() => setPaymentMethod(method)}
                className={`py-2 rounded-xl border cursor-pointer font-bold ${
                  paymentMethod === method 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {method}
              </div>
            ))}
          </div>

          {/* CHECKOUT ACTION */}
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] transition-transform duration-200"
          >
            <CreditCard className="w-4 h-4" /> Process Transaction
          </button>
        </div>
      </div>

      {/* TRANSACTION SUCCESS MODAL */}
      {successTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-emerald-500/30 max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Checkout Approved</h3>
              <p className="text-xs text-slate-400 mt-1">Transaction Ref: <span className="text-emerald-400 font-mono font-bold">{successTx}</span></p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-left text-xs font-mono space-y-1 text-slate-300">
              <p>Terminal: {lane}</p>
              <p>Cashier: {cashier}</p>
              <p>Status: Payment Authorized</p>
              <p>Method: {paymentMethod}</p>
            </div>
            <button 
              onClick={() => setSuccessTx(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              Done / Print Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
