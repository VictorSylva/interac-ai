import React, { useState, useEffect } from 'react';
import { UserCheck, Award, MessageSquare, Plus, Search, Tag, AlertTriangle, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function RetailCustomers({ orgId }) {
  const [customers, setCustomers] = useState([
    { id: 'cust_olumide', display_label: 'Olumide Awosika', attributes: { loyalty_id: 'LOY-4401', email: 'olumide.awosika@gmail.com', phone: '08031234567', loyalty_points: 1450, membership_tier: 'Gold', churn_risk: 'Low', preferred_categories: ['Spirits', 'Groceries'], recent_purchases_count: 18 } },
    { id: 'cust_chioma', display_label: 'Chioma Nze', attributes: { loyalty_id: 'LOY-3102', email: 'chioma.nze@yahoo.com', phone: '08098765432', loyalty_points: 3400, membership_tier: 'Platinum', churn_risk: 'High', preferred_categories: ['Dairies', 'Cosmetics'], recent_purchases_count: 32 } }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [orgId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/retail/customers?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleIssueCoupon = (e) => {
    e.preventDefault();
    alert(`Personalized Coupon code ${couponCode || 'SAVE10'} issued to selected loyalty groups.`);
    setShowCouponModal(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.display_label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.attributes?.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <UserCheck className="w-4 h-4" /> Customer Management & CRM
          </div>
          <h2 className="text-3xl font-extrabold text-white">Loyalty Portals & Churn Analysis</h2>
          <p className="text-slate-400 mt-1">Manage membership points, issue specialized coupons, and flag at-risk loyalty shoppers.</p>
        </div>

        <button 
          onClick={() => { setCouponCode(`LOY-DISC-${Math.floor(10 + Math.random() * 90)}`); setShowCouponModal(true); }}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Tag className="w-4 h-4" /> Issue AI Coupons
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Lookup customer by name or phone..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CUSTOMERS LIST */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" /> Loyalty Directory
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Loyalty ID</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Loyalty Balance</th>
                  <th className="p-3">Membership Tier</th>
                  <th className="p-3 text-right">Preferred Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{c.display_label}</td>
                    <td className="p-3 font-mono text-amber-300">{c.attributes?.loyalty_id || 'LOY-0000'}</td>
                    <td className="p-3 space-y-0.5">
                      <p>{c.attributes?.email}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{c.attributes?.phone}</p>
                    </td>
                    <td className="p-3 font-bold text-white font-mono">{c.attributes?.loyalty_points || 0} pts</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        c.attributes?.membership_tier === 'Platinum' 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {c.attributes?.membership_tier || 'Bronze'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-400">
                      {c.attributes?.preferred_categories?.join(', ') || 'General'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI CHURN RISK ALERTS */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> AI Customer Analytics
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300">Predictive</span>
          </div>

          <div className="space-y-4">
            {customers.map(c => {
              const isHigh = c.attributes?.churn_risk === 'High';
              return (
                <div key={c.id} className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all ${
                  isHigh ? 'bg-rose-500/10 border-rose-500/25 text-rose-300' : 'bg-white/5 border-white/10 text-slate-400'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-white">{c.display_label}</span>
                    {isHigh && (
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-0.5 uppercase">
                        <AlertTriangle className="w-3 h-3" /> Churn Risk
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Purchases count: {c.attributes?.recent_purchases_count || 10}</p>
                  <p className="mt-2 text-[11px] text-slate-300">
                    {isHigh 
                      ? 'Recommendation: Has not visited in 20 days (historic frequency is every 5 days). Send email offer today.' 
                      : 'Recommendation: Active customer showing stable buying metrics.'
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COUPON MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border border-amber-500/30 max-w-sm w-full space-y-6 animate-scale-in">
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5"><Tag className="w-5 h-5 text-amber-400" /> Issue Promotional Coupon</h3>
            <form onSubmit={handleIssueCoupon} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Generated Coupon Code</label>
                <input 
                  type="text" 
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Loyalty Segments</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                  <option value="At Risk High Churn">At Risk (High Churn Probability)</option>
                  <option value="Platinum Tier">Platinum Level Members Only</option>
                  <option value="All Customers">All Registered Loyalty Shoppers</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase">Discount Rate</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                  <option value="10">10% OFF Cart Total</option>
                  <option value="15">15% OFF Cart Total</option>
                  <option value="20">20% OFF Cart Total</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCouponModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Issue Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
