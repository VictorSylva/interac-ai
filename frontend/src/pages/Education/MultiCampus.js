import React, { useState } from 'react';
import { MapPin, Check } from 'lucide-react';

export default function EduMultiCampusPage() {
  const [selectedBranch, setSelectedBranch] = useState('Lekki Campus (Primary)');
  const [branches, setBranches] = useState([
    { id: 1, name: "Lekki Campus (Primary)", address: "Plot 12, Admiralty Way, Lekki Phase 1, Lagos", studentCount: 1240, teacherCount: 52 },
    { id: 2, name: "Ikeja Campus (Secondary)", address: "42, Allen Avenue, Ikeja, Lagos", studentCount: 600, teacherCount: 30 },
    { id: 3, name: "Abuja Branch", address: "Garki Area 11, Abuja", studentCount: 0, teacherCount: 4 }
  ]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <MapPin className="w-4 h-4" /> BRANCH LOGISTICS
        </div>
        <h2 className="text-3xl font-extrabold text-white">Multi-Campus Branch Selector</h2>
        <p className="text-slate-400 mt-1">Switch operational context between school branches, audit regional databases, and assign staff regional privileges.</p>
      </div>

      <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Campus Branches</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {branches.map(b => (
            <div
              key={b.id}
              onClick={() => setSelectedBranch(b.name)}
              className={`p-6 rounded-2xl border transition cursor-pointer flex flex-col justify-between h-48 ${
                selectedBranch === b.name
                  ? 'bg-cyan-600/10 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                  : 'bg-white/5 border-white/5 hover:border-white/15'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-white text-sm">{b.name}</h4>
                  {selectedBranch === b.name && <Check className="w-4.5 h-4.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{b.address}</p>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-white/5 pt-3">
                <span>Enrolled: {b.studentCount}</span>
                <span>Teachers: {b.teacherCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
