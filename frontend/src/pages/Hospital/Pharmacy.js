import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Search, Loader2, Play, AlertCircle, Sparkles, CheckCircle2, ShieldAlert, FileText 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Pharmacy({ orgId }) {
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dispense Form
  const [showDispModal, setShowDispModal] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [dispenseForm, setDispenseForm] = useState({
    patient_name: '',
    qty: 1,
    prescription_id: ''
  });

  // Supply predictions
  const [predictions, setPredictions] = useState([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  useEffect(() => {
    fetchInventory();
    fetchPatients();
    fetchPredictions();
  }, [orgId]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/pharmacy/inventory?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data || []);
      }
    } catch (e) {
      console.error("Error loading pharmacy inventory:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/patients?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data || []);
      }
    } catch (e) {
      console.error("Error loading patients:", e);
    }
  };

  const fetchPredictions = async () => {
    setLoadingPredictions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/pharmacy/predict-demand?org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predicted_high_demand_skus || []);
      }
    } catch (e) {
      console.error("Error loading predictions:", e);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const handleOpenDispense = (drug) => {
    setSelectedDrug(drug);
    setShowDispModal(true);
  };

  const handleDispenseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDrug) return;
    setSubmitting(true);
    try {
      const patient = patients.find(p => p.display_label === dispenseForm.patient_name);
      
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/pharmacy/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          patient_id: patient ? patient.id : `PAT-WALK-${Math.floor(1000 + Math.random()*9000)}`,
          patient_name: dispenseForm.patient_name,
          drug_name: selectedDrug.display_label,
          qty: dispenseForm.qty,
          prescription_id: dispenseForm.prescription_id
        })
      });

      if (res.ok) {
        setDispenseForm({ patient_name: '', qty: 1, prescription_id: '' });
        setShowDispModal(false);
        await fetchInventory();
      } else {
        const err = await res.json();
        alert(err.detail || "Dispense failed");
      }
    } catch (e) {
      console.error("Dispense error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(i => 
    i.display_label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Package className="w-4 h-4" /> PHARMACY DISPENSARY
          </div>
          <h2 className="text-3xl font-extrabold text-white">Medicine Inventory & Prescriptions</h2>
          <p className="text-slate-400 mt-1">Dispense medication records, track expiry alerts, and review AI-driven supply demands.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Inventory List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold text-white">Stock Catalog</h3>
              <input
                type="text"
                placeholder="Search stock..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Drug Formulation</th>
                    <th className="p-4">Stock Remaining</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Security Class</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" /></td></tr>
                  ) : filteredInventory.map(item => {
                    const isLow = item.attributes?.qty <= item.attributes?.min_alert_stock;
                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-white">{item.display_label}</td>
                        <td className="p-4">
                          <span className={`font-mono font-bold ${isLow ? 'text-rose-400' : 'text-slate-300'}`}>{item.attributes?.qty} units</span>
                          {isLow && <span className="ml-2 text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full uppercase">Low Stock</span>}
                        </td>
                        <td className="p-4 text-slate-400">{item.attributes?.supplier}</td>
                        <td className="p-4">
                          {item.attributes?.controlled_substance ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">Controlled</span>
                          ) : (
                            <span className="text-slate-500">Unrestricted</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenDispense(item)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all"
                          >
                            Dispense
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: AI Demand Predictions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-purple-500/30 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" /> AI Demand & Runout Predictions
            </h3>

            {loadingPredictions ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" /></div>
            ) : (
              <div className="space-y-4">
                {predictions.map((p, idx) => (
                  <div key={idx} className="bg-purple-950/10 border border-purple-500/10 p-4.5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-purple-200">{p.drug}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        p.shortage_risk === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>{p.shortage_risk} RISK</span>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>Expected Dispense (7d): <strong className="text-white font-mono">{p.expected_dispense_7d} units</strong></div>
                      <div>Vendor Lead Time: <strong className="text-white font-mono">{p.lead_time_days} days</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dispense Modal */}
      {showDispModal && selectedDrug && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-rose-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-rose-950/20 px-6 py-4 border-b border-rose-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Package className="w-5 h-5 text-rose-400" /> Dispense Medication</h3>
              <button onClick={() => setShowDispModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>
            <form onSubmit={handleDispenseSubmit} className="p-6 space-y-4">
              <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
                Selected Drug: <strong className="text-white">{selectedDrug.display_label}</strong> <br />
                Available Stock: <strong className="text-white">{selectedDrug.attributes?.qty} units</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={dispenseForm.patient_name}
                  onChange={(e) => setDispenseForm({...dispenseForm, patient_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.display_label}>{p.display_label} ({p.attributes?.patient_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dispensation Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedDrug.attributes?.qty}
                    required
                    value={dispenseForm.qty}
                    onChange={(e) => setDispenseForm({...dispenseForm, qty: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prescription ID Reference</label>
                  <input
                    type="text"
                    placeholder="PR-9012"
                    value={dispenseForm.prescription_id}
                    onChange={(e) => setDispenseForm({...dispenseForm, prescription_id: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDispModal(false)}
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
                  Verify & Dispense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
