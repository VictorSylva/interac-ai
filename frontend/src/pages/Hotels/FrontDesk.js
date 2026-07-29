import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Search, Key, CreditCard, DollarSign, Plus, 
  Trash2, ArrowRight, Loader2, AlertCircle, Sparkles, CheckCircle2 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function FrontDesk({ orgId }) {
  const [reservations, setReservations] = useState([]);
  const [inHouseGuests, setInHouseGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected folio for charging/paying
  const [selectedFolio, setSelectedFolio] = useState(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Modals forms data
  const [chargeForm, setChargeForm] = useState({ description: '', amount: 0.0 });
  const [paymentForm, setPaymentForm] = useState({ amount: 0.0, payment_method: 'Card' });

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resVal = await fetch(`${API_BASE_URL}/api/v1/hotels/reservations?org_id=${encodeURIComponent(orgId)}`);
      if (resVal.ok) {
        const data = await resVal.json();
        setReservations(data || []);
        
        // Filter in-house guests
        setInHouseGuests(data.filter(r => r.attributes.status === 'CHECKED_IN') || []);
      }
    } catch (e) {
      console.error("Error loading front desk data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (reservationId) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, reservation_id: reservationId })
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Check-in failed");
      }
    } catch (e) {
      console.error("Check-in error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (reservationId) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, reservation_id: reservationId })
      });
      if (res.ok) {
        setSelectedFolio(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Checkout failed");
      }
    } catch (e) {
      console.error("Checkout error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostCharge = async (e) => {
    e.preventDefault();
    if (!selectedFolio) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/folios/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          folio_id: selectedFolio.id,
          description: chargeForm.description,
          amount: parseFloat(chargeForm.amount)
        })
      });
      if (res.ok) {
        setShowChargeModal(false);
        setChargeForm({ description: '', amount: 0.0 });
        
        // Refresh selected folio data
        const updatedFolio = await res.json();
        setSelectedFolio(updatedFolio);
        await fetchData();
      }
    } catch (e) {
      console.error("Charge post error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedFolio) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/folios/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          folio_id: selectedFolio.id,
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method
        })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentForm({ amount: 0.0, payment_method: 'Card' });
        
        // Refresh selected folio data
        const updatedFolio = await res.json();
        setSelectedFolio(updatedFolio);
        await fetchData();
      }
    } catch (e) {
      console.error("Payment settle error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchFolioDetails = async (folioId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities/${folioId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFolio(data);
      }
    } catch (e) {
      console.error("Error loading folio details:", e);
    }
  };

  const pendingCheckins = reservations.filter(r => 
    r.attributes.status === 'RESERVED' &&
    (r.attributes.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.attributes.room_number?.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <UserCheck className="text-purple-400 w-6 h-6" /> Reception Front Desk
        </h2>
        <p className="text-slate-400 text-xs mt-1">Manage physical arrivals check-in, keycard issuances, and room billing invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Arrivals Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Arrivals Search Box */}
          <div className="glass border border-white/10 p-5 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> Expected Arrivals (Checked-In PMS Queue)
            </h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search arrivals by guest name or room..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : pendingCheckins.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6" />
                <span>No pending arrivals matching criteria</span>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCheckins.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-purple-500/20 transition-all">
                    <div>
                      <h4 className="text-xs font-black text-white">{r.attributes.guest_name}</h4>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Room {r.attributes.room_number} • Rate: ₦{r.attributes.nightly_rate?.toLocaleString()} • Booking: {r.attributes.booking_source}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCheckIn(r.id)}
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition-all flex items-center gap-1.5 shadow"
                    >
                      {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                      Check In Room
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In-House Guests Directory */}
          <div className="glass border border-white/10 p-5 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">In-House Active Guests</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="p-3">Guest</th>
                    <th className="p-3">Room</th>
                    <th className="p-3">Check-In</th>
                    <th className="p-3">Folio Status</th>
                    <th className="p-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {inHouseGuests.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-500">No checked-in guests in-house.</td>
                    </tr>
                  ) : (
                    inHouseGuests.map(g => (
                      <tr key={g.id} className="hover:bg-white/5">
                        <td className="p-3 font-bold text-white">{g.attributes.guest_name}</td>
                        <td className="p-3 font-mono font-bold text-purple-300">{g.attributes.room_number}</td>
                        <td className="p-3 text-slate-400 text-[10px]">{g.attributes.actual_check_in?.split('T')[0]}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[9px] font-bold uppercase">Open Folio</span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => fetchFolioDetails(g.attributes.folio_id)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-200 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-600/50"
                          >
                            Manage Folio
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Folio Billing / Checkout Panel */}
        <div className="space-y-6">
          {selectedFolio ? (
            <div className="glass border border-purple-500/30 p-5 rounded-3xl space-y-6">
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <CreditCard className="text-purple-400 w-4 h-4" /> Guest Folio Billing
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Room {selectedFolio.attributes.room_number}</p>
                </div>
                <button onClick={() => setSelectedFolio(null)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
              </div>

              {/* Balance Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Outstanding Balance</div>
                <div className="text-2xl font-black text-white mt-1">₦{selectedFolio.attributes.balance?.toLocaleString()}</div>
              </div>

              {/* Transactions List */}
              <div className="space-y-3">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transactions History</h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 text-[11px]">
                  {selectedFolio.attributes.charges?.map((c, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-300">{c.description}</span>
                      <span className="font-mono text-purple-300 font-bold">₦{c.amount}</span>
                    </div>
                  ))}
                  {selectedFolio.attributes.payments?.map((p, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-white/5 text-emerald-400">
                      <span>Payment ({p.payment_method})</span>
                      <span className="font-mono font-bold">-₦{p.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folio Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => { setChargeForm({ description: '', amount: 0.0 }); setShowChargeModal(true); }}
                  className="py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Post Charge
                </button>
                <button 
                  onClick={() => { setPaymentForm({ amount: selectedFolio.attributes.balance, payment_method: 'Card' }); setShowPaymentModal(true); }}
                  className="py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Post Payment
                </button>
              </div>

              {/* Checkout Button */}
              {selectedFolio.attributes.balance === 0.0 ? (
                <button 
                  onClick={() => handleCheckOut(selectedFolio.attributes.reservation_id)}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Check Out Guest
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-center gap-2 leading-relaxed">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Settle the folio balance of ₦{selectedFolio.attributes.balance?.toLocaleString()} to enable room checkout.</span>
                </div>
              )}

            </div>
          ) : (
            <div className="glass border border-white/10 p-5 rounded-3xl text-center py-16 text-slate-500 space-y-3">
              <CreditCard className="w-12 h-12 mx-auto text-slate-600" />
              <div>
                <h4 className="text-xs font-bold text-white">Guest Folio Invoicing</h4>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Select an in-house guest from the directory list to post charges or settle payments.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Post Charge Modal */}
      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Post Operational Charge</h3>
            <form onSubmit={handlePostCharge} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Item Description</label>
                <input 
                  type="text" 
                  required
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({...chargeForm, description: e.target.value})}
                  placeholder="Minibar beer + chips"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Charge Amount (₦)</label>
                <input 
                  type="number" 
                  required
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm({...chargeForm, amount: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowChargeModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold">Confirm Charge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-white/15 p-6 rounded-3xl shadow-2xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Settle Folio Payment</h3>
            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Payment Method</label>
                <select 
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Cash">Cash Cashier</option>
                  <option value="Transfer">Bank Settlement Transfer</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Payment Amount (₦)</label>
                <input 
                  type="number" 
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Post Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
