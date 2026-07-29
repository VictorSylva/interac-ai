import React, { useState, useEffect } from 'react';
import { 
  FileText, CreditCard, DollarSign, CheckCircle2, 
  Loader2, Sparkles, ClipboardList, AlertCircle 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Finance({ orgId }) {
  const [invoices, setInvoices] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Invoices
      const resVal = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}&entity_type_code=hotel_invoice`);
      if (resVal.ok) {
        const data = await resVal.json();
        setInvoices(data.items || []);
      }
      
      // 2. Fetch Finance Report
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

  const totalCollected = report?.total_collected || 0.0;
  const unsettledCount = invoices.filter(inv => inv.attributes.balance > 0.0).length;

  return (
    <div className="space-y-6">
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
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Billing Collected</div>
            <div className="text-xl font-black text-white mt-1">₦{totalCollected.toLocaleString()}</div>
          </div>
          <DollarSign className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unsettled Folios</div>
            <div className="text-xl font-black text-white mt-1">{unsettledCount} Invoices</div>
          </div>
          <AlertCircle className={`w-8 h-8 ${unsettledCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
        </div>
        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cashier Register Status</div>
            <div className="text-xl font-black text-emerald-400 mt-1">Balanced</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Invoices Ledger Table */}
      <div className="glass border border-white/10 p-6 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Guest Folio Billing Ledger
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No guest invoices generated. Checked-in guests will appear here.
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
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {invoices.map(inv => {
                  const charges = inv.attributes.charges || [];
                  const totalCharges = charges.reduce((acc, c) => acc + parseFloat(c.amount || 0.0), 0.0);
                  const balance = inv.attributes.balance || 0.0;
                  const isSettled = balance === 0.0;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{inv.display_label}</td>
                      <td className="p-3 font-mono font-bold text-purple-300">Room {inv.attributes.room_number}</td>
                      <td className="p-3 font-mono text-slate-300">₦{totalCharges.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-white">₦{balance.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          isSettled 
                            ? 'bg-emerald-500/10 text-emerald-300' 
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {isSettled ? 'Settled' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
