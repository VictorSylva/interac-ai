import React, { useState, useEffect } from 'react';
import { 
  Coffee, Plus, CreditCard, DollarSign, ArrowRight, Loader2, 
  AlertCircle, Sparkles, CheckCircle2, User, ChevronRight,
  Edit, Trash2
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Restaurant({ orgId }) {
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active POS Order Basket
  const [activeTable, setActiveTable] = useState('Bar');
  const [basket, setBasket] = useState([]);
  
  // Charge Room form
  const [chargeRoomModal, setChargeRoomModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [targetRoom, setTargetRoom] = useState('');

  // Tab View state
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' or 'menu'

  // Dynamic Menu state
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null); // null when creating
  const [menuFormName, setMenuFormName] = useState('');
  const [menuFormPrice, setMenuFormPrice] = useState('');
  const [menuSubmitting, setMenuSubmitting] = useState(false);

  // Default Menu Items seed list
  const defaultMenuItems = [
    { name: 'Jollof Rice & Spicy Chicken', price: 4500.0 },
    { name: 'Egusi Soup & Semo', price: 5000.0 },
    { name: 'Grilled Croaker Fish', price: 8500.0 },
    { name: 'Club Sandwich & Fries', price: 3500.0 },
    { name: 'Mocktail Chapman', price: 1500.0 },
    { name: 'Premium Red Wine (Glass)', price: 4000.0 }
  ];

  useEffect(() => {
    fetchData();
    fetchMenu();
  }, [orgId]);

  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=restaurant_food`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        
        if (items.length === 0) {
          console.log("No menu items found. Seeding defaults...");
          const seedPromises = defaultMenuItems.map(item => 
            fetch(`${API_BASE_URL}/api/v1/entities`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                org_id: orgId,
                entity_type_code: 'restaurant_food',
                display_label: item.name,
                attributes: { price: item.price }
              })
            })
          );
          
          await Promise.all(seedPromises);
          
          // Re-fetch after seeding
          const retryRes = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=restaurant_food`);
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const mapped = (retryData.items || []).map(e => ({
              id: e.id,
              name: e.display_label,
              price: Number(e.attributes?.price || 0)
            }));
            setMenuItems(mapped);
          }
        } else {
          const mapped = items.map(e => ({
            id: e.id,
            name: e.display_label,
            price: Number(e.attributes?.price || 0)
          }));
          setMenuItems(mapped);
        }
      }
    } catch (e) {
      console.error("Error loading menu:", e);
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (!menuFormName || !menuFormPrice) return;
    setMenuSubmitting(true);
    try {
      const priceVal = parseFloat(menuFormPrice);
      if (isNaN(priceVal)) {
        alert("Please enter a valid price.");
        return;
      }
      
      let res;
      if (editingMenuItem) {
        res = await fetch(`${API_BASE_URL}/api/v1/entities/${editingMenuItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_label: menuFormName,
            attributes: { price: priceVal }
          })
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/v1/entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: orgId,
            entity_type_code: 'restaurant_food',
            display_label: menuFormName,
            attributes: { price: priceVal }
          })
        });
      }
      
      if (res.ok) {
        setMenuModalOpen(false);
        setEditingMenuItem(null);
        setMenuFormName('');
        setMenuFormPrice('');
        await fetchMenu();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to save menu item.");
      }
    } catch (e) {
      console.error("Save menu item error:", e);
    } finally {
      setMenuSubmitting(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBasket(basket.filter(i => i.id !== itemId));
        await fetchMenu();
      } else {
        alert("Failed to delete menu item.");
      }
    } catch (e) {
      console.error("Delete menu item error:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/restaurant/orders?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data || []);
      }

      const roomRes = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_room`);
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setRooms(roomData.items || []);
      }
    } catch (e) {
      console.error("Error loading restaurant panel:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBasket = (item) => {
    const existing = basket.find(i => i.id === item.id);
    if (existing) {
      setBasket(basket.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setBasket([...basket, { ...item, qty: 1 }]);
    }
  };

  const handleRemoveFromBasket = (itemId) => {
    setBasket(basket.filter(i => i.id !== itemId));
  };

  const handleSaveOrder = async () => {
    if (basket.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/restaurant/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          table_number: activeTable,
          items: basket
        })
      });
      if (res.ok) {
        setBasket([]);
        await fetchData();
      }
    } catch (e) {
      console.error("Order submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChargeRoom = async (e) => {
    e.preventDefault();
    if (!selectedOrderId || !targetRoom) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/restaurant/orders/${selectedOrderId}/room-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          room_number: targetRoom
        })
      });
      if (res.ok) {
        setChargeRoomModal(false);
        setTargetRoom('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Room charge post failed.");
      }
    } catch (e) {
      console.error("Room post charge failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = basket.reduce((acc, i) => acc + (i.price * i.qty), 0.0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Coffee className="text-purple-400 w-6 h-6" /> Restaurant & Bar POS
          </h2>
          <p className="text-slate-400 text-xs mt-1">Place guest dining tickets, track open bills, and post charges directly to room folios.</p>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex rounded-xl bg-black/40 border border-white/10 p-1 self-start md:self-auto">
          <button 
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pos' 
                ? 'bg-purple-600 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            POS Terminal
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'menu' 
                ? 'bg-purple-600 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Manage Menu Items
          </button>
        </div>
      </div>

      {activeTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Menu Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass border border-white/10 p-5 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hospitality Dining Menu</h3>
                
                {/* Table Selector */}
                <select 
                  value={activeTable}
                  onChange={(e) => setActiveTable(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="Bar">Diner Bar Counter</option>
                  <option value="Table 1">Table 1</option>
                  <option value="Table 2">Table 2</option>
                  <option value="Table 3">Table 3</option>
                  <option value="Room Service">Room Service In-Room</option>
                </select>
              </div>

              {loadingMenu ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : menuItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No menu items configured. Go to "Manage Menu Items" to add some.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menuItems.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-black/25 border border-white/5 flex justify-between items-center hover:border-purple-500/20 transition-all">
                      <div>
                        <h4 className="text-xs font-black text-white">{item.name}</h4>
                        <span className="text-[11px] font-mono text-purple-300 font-bold mt-1 block">₦{item.price.toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={() => handleAddToBasket(item)}
                        className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Orders List */}
            <div className="glass border border-white/10 p-5 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active POS Tickets</h3>
              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No active restaurant bills.</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="flex justify-between items-center p-4 rounded-2xl bg-black/20 border border-white/5">
                      <div>
                        <h4 className="text-xs font-black text-white">Table: {o.attributes.table_number}</h4>
                        <div className="text-[10px] text-slate-400 mt-1 max-w-[280px] truncate">
                          {o.attributes.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}
                        </div>
                        <span className="text-[11px] font-mono text-purple-300 font-bold mt-1 block">Total: ₦{o.attributes.total_amount?.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          o.attributes.payment_status === 'ROOM_CHARGE' 
                            ? 'bg-emerald-500/10 text-emerald-300' 
                            : 'bg-rose-500/10 text-rose-300'
                        }`}>
                          {o.attributes.payment_status}
                        </span>
                        {o.attributes.payment_status === 'UNPAID' && (
                          <button 
                            onClick={() => { setSelectedOrderId(o.id); setChargeRoomModal(true); }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/30 text-purple-200 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-600/50 flex items-center gap-1"
                          >
                            Charge Room <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* POS Basket Sidebar */}
          <div className="glass border border-white/10 p-5 rounded-3xl flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
                <Coffee className="text-purple-400 w-4 h-4" /> Basket (Table: {activeTable})
              </h3>
              
              <div className="space-y-3 mt-4 overflow-y-auto max-h-[220px]">
                {basket.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">Basket is empty</div>
                ) : (
                  basket.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5">
                      <div>
                        <span className="text-white font-bold">{item.qty}x</span> <span className="text-slate-300">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-purple-300 font-bold">₦{(item.price * item.qty).toLocaleString()}</span>
                        <button onClick={() => handleRemoveFromBasket(item.id)} className="text-rose-400 font-bold hover:text-rose-300">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 uppercase font-bold">Total Bill</span>
                <span className="text-lg font-black text-white font-mono">₦{totalAmount.toLocaleString()}</span>
              </div>

              <button 
                onClick={handleSaveOrder}
                disabled={submitting || basket.length === 0}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save order & print ticket"}
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* Manage Menu Items View */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Coffee className="text-purple-400 w-4 h-4" /> Restaurant Menu Catalog
              </h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Configure and manage all food & beverage offerings available on the POS terminal.</p>
            </div>
            <button
              onClick={() => {
                setEditingMenuItem(null);
                setMenuFormName('');
                setMenuFormPrice('');
                setMenuModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/10"
            >
              <Plus className="w-4 h-4" /> Add Food Item
            </button>
          </div>

          <div className="glass border border-white/10 rounded-3xl overflow-hidden">
            {loadingMenu ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Coffee className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-semibold">No menu items found</p>
                <p className="text-xs text-slate-500 mt-1">Click the "+ Add Food Item" button to create one.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 bg-black/10">
                {menuItems.map((item, idx) => (
                  <div key={item.id} className="flex justify-between items-center p-4 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono w-6 font-bold">#{idx + 1}</span>
                      <div>
                        <h4 className="text-xs font-black text-white">{item.name}</h4>
                        <span className="text-[11px] font-mono text-purple-300 font-bold block mt-0.5">₦{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMenuItem(item);
                          setMenuFormName(item.name);
                          setMenuFormPrice(item.price.toString());
                          setMenuModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center border border-white/5"
                        title="Edit Item"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMenuItem(item.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center border border-rose-500/10"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post to Room Charge Modal */}
      {chargeRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Post Bill to Guest Room Folio</h3>
              <button onClick={() => setChargeRoomModal(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleChargeRoom} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Guest Room Code</label>
                <select 
                  required
                  value={targetRoom}
                  onChange={(e) => setTargetRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select Occupied Room...</option>
                  {rooms.filter(r => r.attributes.status === 'OCCUPIED').map(r => (
                    <option key={r.id} value={r.display_label}>
                      Room {r.display_label} - {r.attributes.guest_name}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Room Folio Charge"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Menu Item Create/Edit Modal */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingMenuItem ? "Edit Food Item" : "Create New Food Item"}
              </h3>
              <button onClick={() => setMenuModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Food Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Jollof Rice & Spicy Chicken"
                  value={menuFormName}
                  onChange={(e) => setMenuFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Price (₦)</label>
                <input 
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="e.g. 4500"
                  value={menuFormPrice}
                  onChange={(e) => setMenuFormPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={menuSubmitting} 
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {menuSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingMenuItem ? "Update Food Item" : "Create Food Item"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
