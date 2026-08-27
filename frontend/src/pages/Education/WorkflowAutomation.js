import React, { useState } from 'react';
import { Zap, Plus, Sparkles, SwitchCamera } from 'lucide-react';

export default function EduWorkflowPage() {
  const [rules, setRules] = useState([
    { id: 1, trigger: "Student consecutive absences > 3 days", action: "Send SMS to Guardian & flag Dropout Risk in SIS", active: true },
    { id: 2, trigger: "Argus OS CCTV: fight_detected Alert", action: "Dispatch push notification to Principal & lock Campus Gates", active: true },
    { id: 3, trigger: "Fees Invoice outstanding balance > 60 days overdue", action: "Flag default warning & schedule parent reminder email", active: true },
    { id: 4, trigger: "Health Clinic: clinic_emergency_visit Logged", action: "Place urgent call to mapped Emergency Contact", active: true }
  ]);

  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <Zap className="w-4 h-4" /> WORKFLOW AUTOMATION
        </div>
        <h2 className="text-3xl font-extrabold text-white">Event Triggers & Action Workflows</h2>
        <p className="text-slate-400 mt-1">Configure automated school policies linked to live biometric entry gates, clinic logs, and CCTV cameras.</p>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h3 className="text-lg font-bold text-white">Active School Rules Engine</h3>
          <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition">
            <Plus className="w-4 h-4" /> Define New Trigger
          </button>
        </div>

        <div className="space-y-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex justify-between items-center gap-6">
              <div className="space-y-1.5">
                <div className="font-bold text-xs text-white uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> When: {rule.trigger}
                </div>
                <div className="text-xs text-slate-300">
                  <strong>Then:</strong> {rule.action}
                </div>
              </div>
              <button
                onClick={() => toggleRule(rule.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  rule.active ? 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30' : 'bg-white/5 text-slate-500 border border-white/10'
                }`}
              >
                {rule.active ? 'Active' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
