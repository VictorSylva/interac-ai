import React from 'react';
import { Hotel, Stethoscope, Building2, MessageSquare, ArrowRight } from 'lucide-react';
import ChatWidget from '../components/ChatWidget';

const DemoMultiBusinessPage = () => {
  const sections = [
    {
      id: 'hotel',
      title: 'Grand Luxe Hotel',
      subtitle: 'AI Front Desk Assistant',
      businessId: '44a5ecc5-e623-4299-89b4-f527004ecf59',
      description: 'Handle bookings, answer guest questions, and automate reservations. The AI assistant can manage room availability, handle check-in procedures, and provide local recommendations to guests instantly.',
      icon: Hotel,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      accentColor: 'bg-blue-600'
    },
    {
      id: 'dental',
      title: 'BrightSmile Dental Clinic',
      subtitle: 'AI Patient Assistant',
      businessId: '13176817-d414-4aa1-ad05-628ad37ac797',
      description: 'Book appointments, handle patient inquiries, and manage consultations. Our AI helps patients find suitable time slots, provides pre-appointment instructions, and answers common dental care questions.',
      icon: Stethoscope,
      color: 'rose',
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-600',
      borderColor: 'border-rose-200',
      accentColor: 'bg-rose-600'
    },
    {
      id: 'real-estate',
      title: 'PrimeNest Realty',
      subtitle: 'AI Property Consultant',
      businessId: '7f64af1e-4946-4a6d-a1e3-edde5d37ed47',
      description: 'Qualify leads, recommend properties, and schedule inspections. The AI consultant screens potential buyers, matches them with suitable listings based on their preferences, and coordinates viewing schedules.',
      icon: Building2,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-200',
      accentColor: 'bg-emerald-600'
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-navy selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/interacAi-logo.png" alt="InteracAI" className="h-10 w-auto" />
            <span className="text-navy font-bold text-xl tracking-tight">Demo Environment</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`} className="text-sm font-semibold text-slate-500 hover:text-navy transition-colors capitalize">
                {s.id.replace('-', ' ')}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden bg-navy pt-24 pb-32 px-6">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Multi-Business Shell
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.1] animate-slide-up">
            InteracAI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Demo Environment</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 font-medium mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Experience AI-powered conversations across multiple industries in one unified platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-sm text-slate-500 bg-navy-light/50 border border-slate-800 rounded-xl px-4 py-2">
              Each section below simulates a real business using InteracAI.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-24 space-y-32">
        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className={`scroll-mt-32 group`}>
            <div className={`flex flex-col ${index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-16 items-center`}>
              
              {/* Content Side */}
              <div className="flex-1 space-y-8">
                <div className={`w-20 h-20 ${section.bgColor} ${section.textColor} rounded-[2.5rem] flex items-center justify-center shadow-lg shadow-${section.color}-500/10 group-hover:scale-110 transition-transform duration-500`}>
                  <section.icon size={40} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className={`text-lg font-bold uppercase tracking-widest ${section.textColor}`}>
                      {section.subtitle}
                    </h3>
                    <h2 className="text-4xl md:text-5xl font-black text-navy tracking-tight">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-slate-500 text-xl leading-relaxed max-w-xl font-medium">
                    {section.description}
                  </p>
                </div>
                
                <div className="pt-4">
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full">
                    Ready for Integration
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>

              {/* Chat Placeholder Side */}
              <div className="w-full lg:w-[480px]">
                <div className={`relative bg-white border-2 border-dashed ${section.borderColor} rounded-[2.5rem] h-[600px] flex flex-col items-center justify-center text-center p-2 transition-all duration-500 group-hover:border-solid group-hover:shadow-2xl group-hover:shadow-${section.color}-500/10 group-hover:-translate-y-2 overflow-hidden`}>
                  <ChatWidget 
                    businessId={section.businessId} 
                    variant="inline" 
                    forceOpen={true}
                  />
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* Industry Fast Links (Sticky Bottom on Mobile) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-navy/90 backdrop-blur-lg p-2 rounded-2xl border border-white/10 shadow-2xl">
        {sections.map(s => (
          <a key={s.id} href={`#${s.id}`} className="p-3 text-white/70 hover:text-white transition-colors">
            <s.icon size={20} />
          </a>
        ))}
      </div>

      {/* Footer */}
      <footer className="bg-navy py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4 text-center md:text-left">
            <img src="/interacAi-logo.png" alt="InteracAI" className="h-10 w-auto brightness-0 invert mx-auto md:mx-0" />
            <p className="text-slate-500 max-w-xs">
              Empowering businesses with intelligent AI conversational agents.
            </p>
          </div>
          <div className="flex gap-8">
             <div className="text-center md:text-left">
                <h5 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Platform</h5>
                <ul className="text-slate-500 space-y-2 text-sm font-medium">
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">How it works</li>
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">Security</li>
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">Pricing</li>
                </ul>
             </div>
             <div className="text-center md:text-left">
                <h5 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Resources</h5>
                <ul className="text-slate-500 space-y-2 text-sm font-medium">
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">Documentation</li>
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">API Reference</li>
                  <li className="hover:text-blue-400 cursor-pointer transition-colors">Support</li>
                </ul>
             </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
            &copy; 2024 InteracAI. Demo Environment Shell. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DemoMultiBusinessPage;
