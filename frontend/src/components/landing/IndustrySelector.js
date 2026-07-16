import React from 'react';
import { 
  Hotel, Stethoscope, Building, Building2, ShoppingBag, ShoppingCart, 
  Store, GraduationCap, BookOpen, Landmark, Package, Factory, 
  Truck, Home, HardHat, HeartHandshake, Globe, Scale, Plane, 
  Sprout, Network, Heart, ArrowRight, Sparkles, Utensils, ShieldCheck, Cpu
} from 'lucide-react';
import AutoSlider from './AutoSlider';

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

const IndustrySelector = ({ onSelectIndustry }) => {
  const interactiveIndustries = [
    {
      id: 'hotel',
      icon: Hotel,
      title: 'Hotels & Shortlets',
      description: 'Automate guest check-ins, room service requests, and reservations via WhatsApp and Web chat.',
      cta: 'View Hotel Demo',
      color: 'indigo',
    },
    {
      id: 'clinic',
      icon: Stethoscope,
      title: 'Clinics & Hospitals',
      description: 'Seamlessly schedule consultations, automate medical triage surveys, and send patient reminders.',
      cta: 'View Clinic Demo',
      color: 'rose',
    },
    {
      id: 'real-estate',
      icon: Building,
      title: 'Real Estate Agents',
      description: 'Qualify property buyers automatically, showcase listings, and schedule viewing inspects 24/7.',
      cta: 'View Real Estate Demo',
      color: 'emerald',
    }
  ];

  const expandedIndustries = [
    { name: "Hotels & Hospitality", icon: Hotel, tagline: "WhatsApp reservations sync with guest profiles while video intelligence alerts staff of waiting queue lines." },
    { name: "Clinics & Medical", icon: Heart, tagline: "AI schedules appointments and routes patient triage, while entrance cameras track patient intake logs." },
    { name: "Hospitals", icon: Building2, tagline: "Emergency routing automates doctor alerts while real-time cameras monitor security checkpoints." },
    { name: "Retail Stores", icon: ShoppingBag, tagline: "AI handles stock checkups and checkouts while analytics monitor foot traffic patterns." },
    { name: "Supermarkets", icon: ShoppingCart, tagline: "WhatsApp loyalty campaigns drive sales while visual scanners log loading-dock deliveries." },
    { name: "Shopping Malls", icon: Store, tagline: "AI guides directory routing queries while camera streams monitor parking space occupancy." },
    { name: "Schools & Academies", icon: GraduationCap, tagline: "Route student admission inquiries, term calendar updates, and FAQs." },
    { name: "Universities", icon: BookOpen, tagline: "Manage transcript requests via portal workflows while campus intelligence monitors building access." },
    { name: "Banks & Finances", icon: Landmark, tagline: "Appointment check-ins route queue status while camera vision spots ATM zone loitering." },
    { name: "Warehouses", icon: Package, tagline: "Inventory tracking syncs with dispatch, while perimeter alarms secure high-value storage zones." },
    { name: "Factories", icon: Factory, tagline: "Shift checklists trigger automation reports while thermal cameras detect anomalies." },
    { name: "Logistics Hubs", icon: Truck, tagline: "Track courier delivery updates, dispatch rosters, and gate pass codes." },
    { name: "Residential Estates", icon: Home, tagline: "Automated visitor codes route to WhatsApp while AI cameras track gate intrusions." },
    { name: "Construction Sites", icon: HardHat, tagline: "Vendor invoicing automates ledger entry while safety AI monitors gear compliance." },
    { name: "Churches & Ministries", icon: HeartHandshake, tagline: "Coordinate event announcements, member queries, and charity logs." },
    { name: "NGOs & Foundations", icon: Globe, tagline: "Handle donor outreach campaigns, campaign queries, and reports." },
    { name: "Government Agencies", icon: Scale, tagline: "Provide municipal guidance, license bookings, and queue routing." },
    { name: "Transportation Hubs", icon: Plane, tagline: "Route departure status alerts, terminal guide directions, and loitering." },
    { name: "Agriculture", icon: Sprout, tagline: "Sync irrigation sensor status, coordinate logistics, and analyze yields." },
    { name: "Smart Communities", icon: Network, tagline: "Community news broadcasts to WhatsApp while ARGUS security secures the perimeter." },
    { name: "Real Estate Agencies", icon: Building, tagline: "Automate buyer profile qualification while camera sensors verify open-house visitors." },
    { name: "Insurance Companies", icon: ShieldCheck, tagline: "Claims filing triggers CRM triage while intelligence dashboards analyze risk trends." },
    { name: "Hospitality Venues", icon: Utensils, tagline: "Automate dining reservations while camera analytics track seating turn times." },
    { name: "Manufacturing Plants", icon: Cpu, tagline: "CRM workflows automate order pipelines while camera streams flag gear anomalies." }
  ];

  return (
    <section id="industries" className="py-32 bg-[#020617] relative overflow-hidden border-t border-white/5">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Interactive Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 border border-indigo-500/20">
            <Sparkles size={14} />
            <span>Interactive Demonstrations</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Choose Your <span className="text-gradient">Industry Demo</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
            Select a featured sector to see how InteracAI automates customer journeys, qualifies leads, and completes goals.
          </p>
        </div>

        {/* 3 Featured Demos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {interactiveIndustries.map((ind) => (
            <IndustryCard 
              key={ind.id}
              {...ind}
              onClick={() => onSelectIndustry(ind)}
            />
          ))}
        </div>

        {/* Expanded Sector Support */}
        <div className="border-t border-white/5 pt-20">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
              One Platform. <span className="text-gradient">24 Core Industries.</span>
            </h3>
            <p className="text-slate-400 font-medium max-w-xl mx-auto text-sm leading-relaxed">
              Every industry runs on the same core InteracAI intelligence platform, customized to your specific workflows, compliance needs, and locations.
            </p>
          </div>

          <AutoSlider speed={1.1}>
            {expandedIndustries.map((ind, i) => {
              const IconComponent = ind.icon;
              return (
                <div 
                  key={i} 
                  className="w-[280px] flex-shrink-0 p-6 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300 group flex items-start gap-4"
                >
                  <div className="p-3 bg-white/5 rounded-xl text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all flex-shrink-0">
                    <IconComponent size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-1 group-hover:text-indigo-300 transition-colors">{ind.name}</h4>
                    <p className="text-slate-500 text-xs font-semibold leading-normal">{ind.tagline}</p>
                  </div>
                </div>
              );
            })}
          </AutoSlider>
        </div>
      </div>
    </section>
  );
};

export default IndustrySelector;
