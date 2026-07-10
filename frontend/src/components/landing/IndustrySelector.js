import React from 'react';
import { Hotel, Stethoscope, Building, ArrowRight, Sparkles } from 'lucide-react';

const IndustryCard = ({ icon: Icon, title, description, cta, onClick, color }) => (
  <div 
    onClick={onClick}
    className="group relative bg-white/[0.03] backdrop-blur-md border border-white/5 p-8 md:p-10 rounded-[32px] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-500 cursor-pointer flex flex-col h-full overflow-hidden"
  >
    {/* Animated background glow */}
    <div className={`absolute -top-24 -right-24 w-48 h-48 bg-${color}-500/10 blur-[80px] rounded-full group-hover:bg-${color}-500/20 transition-all duration-700`} />
    
    <div className={`w-14 h-14 bg-white/5 text-white rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-500`}>
      <Icon size={28} strokeWidth={2} />
    </div>
    
    <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{title}</h3>
    <p className="text-slate-400 font-medium leading-relaxed mb-8 flex-1">
      {description}
    </p>
    
    <div className="flex items-center text-white font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all duration-500">
      <span className="opacity-70 group-hover:opacity-100">{cta}</span>
      <ArrowRight className="ml-2 text-indigo-400" size={18} />
    </div>
  </div>
);

const IndustrySelector = ({ onSelectIndustry, onHoverIndustry }) => {
  const industries = [
    {
      id: 'hotel',
      icon: Hotel,
      title: 'Hotels & Shortlets',
      description: 'Automate guest check-ins, room service requests, and bookings via WhatsApp and Web.',
      cta: 'View Hotel Demo',
      color: 'indigo',
    },
    {
      id: 'clinic',
      icon: Stethoscope,
      title: 'Clinics & Hospitals',
      description: 'Seamlessly schedule appointments, handle patient inquiries, and follow up automatically.',
      cta: 'View Clinic Demo',
      color: 'rose',
    },
    {
      id: 'real-estate',
      icon: Building,
      title: 'Real Estate Agents',
      description: 'Qualify buyers instantly, showcase properties, and book viewings 24/7.',
      cta: 'View Real Estate Demo',
      color: 'emerald',
    }
  ];

  return (
    <section id="industries" className="py-32 bg-[#020617] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 border border-indigo-500/20">
            <Sparkles size={14} />
            <span>Tailored Solutions</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Choose Your <span className="text-gradient">Industry</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
            Select your sector to see how InteracAI transforms customer interactions into revenue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {industries.map((ind) => (
            <IndustryCard 
              key={ind.id}
              {...ind}
              onClick={() => onSelectIndustry(ind)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default IndustrySelector;
