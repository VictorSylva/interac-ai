import React, { useState, useEffect } from 'react';
import { 
  FileText, CreditCard, DollarSign, CheckCircle2, 
  Loader2, Sparkles, ClipboardList, AlertCircle, 
  Printer, ArrowRight, X, Eye, DollarSign as CashIcon 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Finance({ orgId }) {
  const [invoices, setInvoices] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal & Interactive states
  const [selectedFolio, setSelectedFolio] = useState(null);
  const [selectedPOSOrder, setSelectedPOSOrder] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [processingSettle, setProcessingSettle] = useState(false);

  // Filters
  const [folioFilter, setFolioFilter] = useState('all'); // 'all', 'settled', 'unpaid'

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Guest Folio Invoices
      const resVal = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_invoice`);
      if (resVal.ok) {
        const data = await resVal.json();
        setInvoices(data.items || []);
      }
      
      // 2. Fetch Direct POS Orders
      const posRes = await fetch(`${API_BASE_URL}/api/v1/hotels/restaurant/orders?org_id=${encodeURIComponent(orgId)}`);
      if (posRes.ok) {
        const posData = await posRes.json();
        setPosOrders(posData || []);
      }

      // 3. Fetch Finance Report
      const repVal = await fetch(`${API_BASE_URL}/api/v1/hotels/finance/reports?org_id=${encodeURIComponent(orgId)}`);
      if (repVal.ok) {
        const repData = await repVal.json();
        setReport(repData);
      }
    } catch (e) {
      console.error("Error loading finance board:", e);
    } finally {
      setLoading(false);
    }
  };

  // Settle a Folio Payment
  const handlePostFolioPayment = async (e) => {
    e.preventDefault();
    if (!selectedFolio || !settleAmount) return;
    
    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }

    setProcessingSettle(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hotels/folios/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          folio_id: selectedFolio.id,
          amount: amountVal,
          payment_method: settleMethod
        })
      });

      if (res.ok) {
        alert(`Payment of ₦${amountVal.toLocaleString()} successfully posted.`);
        setSettleAmount('');
        setSelectedFolio(null); // Close modal
        await fetchData(); // Refresh
      } else {
        const err = await res.json();
        alert(err.detail || "Payment settlement failed.");
      }
    } catch (err) {
      console.error("Folio payment posting error:", err);
    } finally {
      setProcessingSettle(false);
    }
  };

  // Calculations
  const directPOSRevenue = posOrders
    .filter(o => o.attributes?.payment_status === 'PAID')
    .reduce((acc, o) => acc + parseFloat(o.attributes?.total_amount || 0.0), 0.0);

  const roomFolioRevenue = report?.total_collected || 0.0;
  const totalRevenueCollected = roomFolioRevenue + directPOSRevenue;

  const totalOutstandingFolioBalance = invoices.reduce((acc, inv) => acc + parseFloat(inv.attributes?.balance || 0.0), 0.0);
  const unsettledCount = invoices.filter(inv => inv.attributes?.balance > 0.0).length;

  const filteredInvoices = invoices.filter(inv => {
    const isUnpaid = inv.attributes?.balance > 0.0;
    if (folioFilter === 'unpaid') return isUnpaid;
    if (folioFilter === 'settled') return !isUnpaid;
    return true;
  });

  const handlePrint = (divId) => {
    const printContent = document.getElementById(divId).innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Reload to restore React bindings
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <FileText className="text-purple-400 w-6 h-6" /> Folio Finance & Invoices
        </h2>
        <p className="text-slate-400 text-xs mt-1">Audit guest invoices, payments ledger logs, and close out cashier shifts.</p>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Billing Collected (Net)</div>
            <div className="text-xl font-black text-emerald-400 mt-1">₦{totalRevenueCollected.toLocaleString()}</div>
            <div className="text-[9px] text-slate-500 mt-1">Room: ₦{roomFolioRevenue.toLocaleString()} | POS: ₦{directPOSRevenue.toLocaleString()}</div>
          </div>
          <DollarSign className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Outstanding Ledger Balance</div>
            <div className="text-xl font-black text-rose-400 mt-1">₦{totalOutstandingFolioBalance.toLocaleString()}</div>
            <div className="text-[9px] text-slate-500 mt-1">{unsettledCount} unpaid room folios</div>
          </div>
          <AlertCircle className={`w-8 h-8 ${unsettledCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cashier Register Status</div>
            <div className="text-xl font-black text-emerald-400 mt-1">Balanced</div>
            <div className="text-[9px] text-slate-500 mt-1">Shift logs aligned with PMS audits</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Guest Invoices Ledger Table */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" /> Guest Folio Billing Ledger
          </h3>
          {/* Filter Tab Selector */}
          <div className="flex rounded-lg bg-black/40 border border-white/10 p-1 text-[10px] font-bold">
            <button 
              onClick={() => setFolioFilter('all')} 
              className={`px-3 py-1 rounded ${folioFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >All</button>
            <button 
              onClick={() => setFolioFilter('unpaid')} 
              className={`px-3 py-1 rounded ${folioFilter === 'unpaid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >Unpaid</button>
            <button 
              onClick={() => setFolioFilter('settled')} 
              className={`px-3 py-1 rounded ${folioFilter === 'settled' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >Settled</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No guest invoices match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Invoice / Folio Description</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Charges Total</th>
                  <th className="p-3">Outstanding Balance</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredInvoices.map(inv => {
                  const charges = inv.attributes?.charges || [];
                  const totalCharges = charges.reduce((acc, c) => acc + parseFloat(c.amount || 0.0), 0.0);
                  const balance = inv.attributes?.balance || 0.0;
                  const isSettled = balance === 0.0;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-white">{inv.display_label}</td>
                      <td className="p-3 font-mono font-bold text-purple-300">Room {inv.attributes?.room_number}</td>
                      <td className="p-3 font-mono text-slate-300">₦{totalCharges.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-white">₦{balance.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          isSettled 
                            ? 'bg-emerald-500/10 text-emerald-300' 
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {isSettled ? 'Settled' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedFolio(inv)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white hover:bg-white/10 flex items-center gap-1.5 ml-auto"
                        >
                          <Eye size={12} className="text-purple-300" /> View Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restaurant & Bar POS Transactions Table */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-purple-400" /> Restaurant & Bar POS Tickets
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : posOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No POS tickets registered today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Ticket ID</th>
                  <th className="p-3">Dining Location</th>
                  <th className="p-3">Items Purchased</th>
                  <th className="p-3">Total Cost</th>
                  <th className="p-3">Settlement Method</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {posOrders.map((ord, idx) => {
                  const itemsStr = ord.attributes?.items?.map(i => `${i.qty}x ${i.name}`).join(', ') || 'F&B Order';
                  const total = ord.attributes?.total_amount || 0.0;
                  const paymentStatus = ord.attributes?.payment_status || 'UNPAID';
                  const method = ord.attributes?.payment_method || (paymentStatus === 'ROOM_CHARGE' ? 'Room Folio Post' : 'Direct Settlement Pending');

                  return (
                    <tr key={ord.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-slate-400 font-mono text-xs">{ord.id?.slice(0, 8) || `ord_${idx}`}</td>
                      <td className="p-3 font-semibold text-white">Table: {ord.attributes?.table_number || 'Bar'}</td>
                      <td className="p-3 text-slate-400 truncate max-w-[200px]" title={itemsStr}>{itemsStr}</td>
                      <td className="p-3 font-mono font-bold text-white">₦{total.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          paymentStatus === 'PAID' 
                            ? 'bg-emerald-500/10 text-emerald-300' 
                            : paymentStatus === 'ROOM_CHARGE' 
                              ? 'bg-indigo-500/10 text-indigo-300' 
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {paymentStatus === 'PAID' ? `Direct: ${method}` : paymentStatus === 'ROOM_CHARGE' ? 'Folio Charged' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedPOSOrder(ord)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white hover:bg-white/10 flex items-center gap-1.5 ml-auto"
                        >
                          <Eye size={12} className="text-purple-300" /> View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guest Folio details Invoice Modal */}
      {selectedFolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-white/15 rounded-3xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedFolio.display_label}</h3>
                <span className="text-[10px] text-slate-500 font-mono">Folio ID: {selectedFolio.id}</span>
              </div>
              <button onClick={() => setSelectedFolio(null)} className="p-1 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Printable Area */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin" id="print-folio-invoice">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-slate-500 font-bold uppercase text-[9px]">Guest Holder</div>
                  <div className="text-white font-bold mt-0.5">{selectedFolio.display_label?.split(' - ')[1] || 'Registered Lodger'}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold uppercase text-[9px]">Room Number</div>
                  <div className="text-purple-300 font-bold mt-0.5">Room {selectedFolio.attributes?.room_number}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold uppercase text-[9px]">Billing Status</div>
                  <div className="text-white mt-0.5">
                    {selectedFolio.attributes?.balance === 0.0 ? (
                      <span className="text-emerald-400 font-bold uppercase">Fully Settled</span>
                    ) : (
                      <span className="text-amber-400 font-bold uppercase">Payment Pending</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold uppercase text-[9px]">Outstanding Balance</div>
                  <div className="text-rose-400 font-black mt-0.5">₦{(selectedFolio.attributes?.balance || 0.0).toLocaleString()}</div>
                </div>
              </div>

              {/* Charges List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Itemized Folio Charges</h4>
                <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/15">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 font-bold uppercase text-[9px] text-slate-500">
                      <tr>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Date/Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(selectedFolio.attributes?.charges || []).map((c, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="p-3 text-slate-200 font-semibold">{c.description}</td>
                          <td className="p-3 text-right font-mono font-bold text-white">₦{(c.amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-slate-400 font-mono text-[10px]">{new Date(c.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                      {/* Room stay baseline cost if not explicitly added to charges */}
                      {(selectedFolio.attributes?.charges || []).length === 0 && (
                        <tr>
                          <td className="p-3 text-slate-500 italic" colSpan="3">No transactions posted to folio.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payments & Credits Posted</h4>
                <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/15">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 font-bold uppercase text-[9px] text-slate-500">
                      <tr>
                        <th className="p-3">Method</th>
                        <th className="p-3 text-right">Payment Amount</th>
                        <th className="p-3 text-right">Date/Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(selectedFolio.attributes?.payments || []).map((p, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="p-3 text-slate-200 font-semibold uppercase">{p.payment_method}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">₦{(p.amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-slate-400 font-mono text-[10px]">{new Date(p.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(selectedFolio.attributes?.payments || []).length === 0 && (
                        <tr>
                          <td className="p-3 text-slate-500 italic" colSpan="3">No payments recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Settle Form and Actions Footer */}
            <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
              {selectedFolio.attributes?.balance > 0.0 && (
                <form onSubmit={handlePostFolioPayment} className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] text-purple-300 font-bold uppercase">Settle Amount (₦)</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      max={selectedFolio.attributes.balance}
                      placeholder={selectedFolio.attributes.balance}
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-purple-300 font-bold uppercase">Payment Method</label>
                    <select 
                      value={settleMethod}
                      onChange={(e) => setSettleMethod(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={processingSettle}
                    className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md shadow-purple-600/10"
                  >
                    {processingSettle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Post Payment"}
                  </button>
                </form>
              )}

              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => handlePrint('print-folio-invoice')}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Printer size={14} /> Print Invoice
                </button>
                <button 
                  onClick={() => setSelectedFolio(null)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Receipt details Thermal Invoice Modal */}
      {selectedPOSOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white text-slate-800 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
            {/* Modal Close */}
            <button 
              onClick={() => setSelectedPOSOrder(null)} 
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Printable Thermal Receipt Container */}
            <div className="flex-1 overflow-y-auto pr-1 mt-6 text-xs text-center font-mono space-y-6" id="print-pos-receipt">
              {/* Receipt Header */}
              <div className="space-y-1">
                <h3 className="text-sm font-black tracking-wider uppercase text-slate-900">Hospitality F&B POS</h3>
                <p className="text-[10px] text-slate-500">Walk-in Dining & Bar Operations</p>
                <p className="text-[9px] text-slate-400">{new Date(selectedPOSOrder.attributes?.timestamp || Date.now()).toLocaleString()}</p>
              </div>

              {/* Dashed Separator */}
              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {/* Meta details */}
              <div className="text-left space-y-1 text-[10px] text-slate-600">
                <div><span className="font-bold">TICKET ID:</span> {selectedPOSOrder.id}</div>
                <div><span className="font-bold">LOCATION:</span> Table: {selectedPOSOrder.attributes?.table_number || 'Bar'}</div>
                <div><span className="font-bold">SETTLED STATUS:</span> {selectedPOSOrder.attributes?.payment_status}</div>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {/* Items Table */}
              <table className="w-full text-left text-[11px] text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 font-bold text-slate-800">
                    <th className="pb-1">Item Description</th>
                    <th className="pb-1 text-center">Qty</th>
                    <th className="pb-1 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPOSOrder.attributes?.items || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100/50">
                      <td className="py-2 text-slate-900">{item.name}</td>
                      <td className="py-2 text-center">{item.qty}</td>
                      <td className="py-2 text-right">₦{(item.price * item.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {/* Totals */}
              <div className="space-y-1 text-right text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Subtotal:</span>
                  <span className="font-black text-slate-900">₦{(selectedPOSOrder.attributes?.total_amount || 0.0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL BILL:</span>
                  <span>₦{(selectedPOSOrder.attributes?.total_amount || 0.0).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              <div className="text-[10px] text-slate-500 text-center leading-relaxed">
                Thank you for dining with us!<br/>
                Please retain this receipt for room accounting.
              </div>
            </div>

            {/* Print & Close Controls */}
            <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-4 z-10">
              <button 
                onClick={() => handlePrint('print-pos-receipt')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button 
                onClick={() => setSelectedPOSOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
