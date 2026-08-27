import React, { useState } from 'react';
import { Zap, CheckSquare, Clock, Plus, Play, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RetailWorkflows() {
  const [openingChecklist, setOpeningChecklist] = useState([
    { id: 1, text: "Verify POS terminal cash drawers contains ₦30,000 baseline floats.", done: true },
    { id: 2, text: "Check refrigerator temperature displays (verify target 4.0°C).", done: true },
    { id: 3, text: "Inspect fresh produce and remove items nearing shelf life.", done: false },
    { id: 4, text: "Turn on Electronic Shelf Labels (ESL) sync router.", done: false }
  ]);
  const [closingChecklist, setClosingChecklist] = useState([
    { id: 1, text: "Perform POS lane cash drop and reconcile totals with database.", done: false },
    { id: 2, text: "Lock restricted Spirits display case cabinets.", done: false },
    { id: 3, text: "Validate backup power generator diesel levels.", done: false },
    { id: 4, text: "Inspect CCTV Argus camera feed status checks.", done: false }
  ]);
  const [activeChecklist, setActiveChecklist] = useState('opening');
  const [replenishThreshold, setReplenishThreshold] = useState(20);
  const [replenishQty, setReplenishQty] = useState(100);

  const toggleChecklist = (id) => {
    if (activeChecklist === 'opening') {
      setOpeningChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
    } else {
      setClosingChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
    }
  };

  const handleSaveAutoReorder = (e) => {
    e.preventDefault();
    alert(`Auto-replenishment rule updated: trigger PO of ${replenishQty} units when stock drops below ${replenishThreshold} units.`);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Zap className="w-4 h-4" /> Workflow Engine & Checklists
          </div>
          <h2 className="text-3xl font-extrabold text-white">Supermarket Automated Workflows</h2>
          <p className="text-slate-400 mt-1">Manage opening/closing branch checklists, configure automated procurement rules, and audit task completions.</p>
        </div>
      </div>

      {/* CORE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CHECKLISTS (OPENING/CLOSING) */}
        <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 space-y-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-amber-400" /> Operational Checklists
            </h3>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveChecklist('opening')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${activeChecklist === 'opening' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'}`}
              >
                Opening Checklist
              </button>
              <button 
                onClick={() => setActiveChecklist('closing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${activeChecklist === 'closing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'}`}
              >
                Closing Checklist
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {(activeChecklist === 'opening' ? openingChecklist : closingChecklist).map(item => (
              <div 
                key={item.id} 
                onClick={() => toggleChecklist(item.id)}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] cursor-pointer transition-all text-xs"
              >
                <input 
                  type="checkbox" 
                  checked={item.done}
                  readOnly
                  className="accent-amber-500 w-4 h-4 pointer-events-none"
                />
                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-200 font-bold'}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AUTO-REORDER TRIGGER RULE */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Auto-Replenishment Rules
          </h3>

          <form onSubmit={handleSaveAutoReorder} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase">Trigger Stock Level Threshold</label>
              <input 
                type="number" 
                value={replenishThreshold}
                onChange={(e) => setReplenishThreshold(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
              <span className="text-[9px] text-slate-500">Initiate automated PO when SKU stock drops below this number.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase">Purchase Quantity (Units)</label>
              <input 
                type="number" 
                value={replenishQty}
                onChange={(e) => setReplenishQty(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase">Supplier Routing</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                <option value="Dangote">Primary Contracted Supplier (Dangote Dairies / Ondo Farm)</option>
                <option value="Guinness">Guinness Nigeria PLC</option>
              </select>
            </div>

            <button 
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
            >
              Update Reorder Rule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
