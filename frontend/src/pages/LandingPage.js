import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, Instagram, Mail, ArrowRight, CheckCircle2, Play, Calendar, Zap, Shield, MessageSquare, Sparkles, User } from 'lucide-react';
import IndustrySelector from '../components/landing/IndustrySelector';
import HowItWorksChat from '../components/landing/HowItWorksChat';
import LeadCaptureModal from '../components/LeadCaptureModal';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const [demoFormState, setDemoFormState] = useState({ name: '', email: '', phone: '', businessType: '' });
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [scrollState, setScrollState] = useState('top');
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleScroll = () => {
      setScrollState(window.scrollY < 50 ? 'top' : 'scrolling');
    };
    window.addEventListener('scroll', handleScroll);
    
    // Handle hash scrolling on mount or hash change
    if (window.location.hash) {
      setTimeout(() => {
        const id = window.location.hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, [window.location.hash]);

  const handleIndustrySelect = (industry) => {
    setSelectedIndustry(industry);
    const isCaptured = localStorage.getItem('interac_lead_captured') === 'true';
    if (isCaptured) {
        navigate(`/demo/${industry.id}`);
    } else {
        setIsModalOpen(true);
    }
  };

  const handleRevealDemo = () => {
    setIsModalOpen(false);
    if (selectedIndustry) {
        navigate(`/demo/${selectedIndustry.id}`);
    }
  };

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    setDemoLoading(true);
    // Simulate API call
    setTimeout(() => {
      setDemoLoading(false);
      setDemoSubmitted(true);
      setDemoFormState({ name: '', email: '', phone: '', businessType: '' });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-x-hidden">
      {/* Premium Navbar */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
        scrollState === 'top' ? 'bg-transparent py-8' : 'bg-navy/80 backdrop-blur-xl border-b border-white/5 py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/interacAi-logo.png" alt="InteracAI" className="h-16 md:h-20 brightness-0 invert" />
          </div>
          
          <div className="hidden lg:flex items-center space-x-12 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            <a href="#industries" className="hover:text-white transition-colors">Industries</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Simulation</a>
            <a href="#value-prop" className="hover:text-white transition-colors">Why Us</a>
            <a href="#book-demo" className="hover:text-white transition-colors">Book Demo</a>
          </div>

          <div className="flex items-center gap-6">
            <a href="#book-demo">
              <button className="px-6 py-3 bg-white text-navy rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all active:scale-95 shadow-xl shadow-white/5">
                Book a Demo
              </button>
            </a>
          </div>
        </div>
      </nav>

      {/* High-Impact Hero Section */}
      <section className="relative min-h-screen flex items-center pt-40 overflow-hidden">
        {/* User-provided background image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/assets/hero-bg.jpg" 
            alt="Luxury Hotel" 
            className="w-full h-full object-cover opacity-60 scale-105 object-[25%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/40 to-[#020617]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex justify-end">
          <div className="max-w-3xl text-right flex flex-col items-end">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.3em] mb-12 border border-indigo-500/20 animate-in fade-in slide-in-from-right-8 duration-1000">
              <Zap size={14} className="fill-indigo-400" />
              <span>Premium AI Automation</span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tighter animate-in fade-in slide-in-from-right-12 duration-1000 delay-100 drop-shadow-2xl">
              Automate <br />
              <span className="text-gradient">Conversations.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-xl leading-relaxed animate-in fade-in slide-in-from-right-16 duration-1000 delay-200 font-medium drop-shadow-lg">
              InteracAI helps hotels, clinics, and real estate businesses respond instantly, capture high-quality leads, and close deals 24/7.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-right-20 duration-1000 delay-300">
              <a href="#book-demo" className="w-full sm:w-auto">
                <button className="btn-primary w-full px-12 py-6 text-xl shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)]">
                  Book a Demo <ArrowRight size={20} />
                </button>
              </a>
              <a href="#industries" className="w-full sm:w-auto">
                <button className="btn-outline w-full px-12 py-6 text-xl backdrop-blur-sm bg-white/5 shadow-xl">
                  Try Live Simulation <Play size={20} className="fill-white" />
                </button>
              </a>
            </div>
          </div>
        </div>

        {/* Floating Trust Badges */}
        <div className="absolute bottom-12 left-0 w-full z-10 hidden md:block">
           <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center gap-12 text-slate-500 font-bold text-xs uppercase tracking-[0.3em] opacity-50">
                 <span>Trusted by Leaders in</span>
                 <div className="flex gap-8">
                    <span>Hotels</span>
                    <span>Healthcare</span>
                    <span>Real Estate</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Industry Selection Section */}
      <IndustrySelector onSelectIndustry={handleIndustrySelect} />

      {/* Live Demo Simulation (How It Works) */}
      <HowItWorksChat />

      {/* Value Proposition Section */}
      <section id="value-prop" className="py-32 bg-[#020617] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
              Why Businesses Choose <span className="text-indigo-400">InteracAI</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "24/7 Automated Responses", desc: "Never miss a lead. Our AI responds instantly to every inquiry, even at 3 AM.", icon: Zap },
              { title: "Lead Qualification", desc: "Automatically qualify leads based on your specific criteria before they reach your team.", icon: CheckCircle2 },
              { title: "Multi-Channel Support", desc: "Seamlessly integrate with WhatsApp and your Website for a unified experience.", icon: MessageSquare },
              { title: "Workflow Automation", desc: "From bookings to follow-ups, we automate the entire customer journey.", icon: Sparkles },
              { title: "Enterprise Security", desc: "Your data is protected with enterprise-grade encryption and privacy controls.", icon: Shield },
              { title: "Human + AI Hybrid", desc: "Easily jump into conversations when a personal touch is needed.", icon: User }
            ].map((prop, i) => (
              <div key={i} className="glass-card p-10 rounded-[32px]">
                <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-8">
                  <prop.icon size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4">{prop.title}</h3>
                <p className="text-slate-400 leading-relaxed font-medium">{prop.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Booking Section */}
      <section id="book-demo" className="py-32 bg-white text-navy rounded-[60px] mx-4 md:mx-10 my-10 relative overflow-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-[0.2em] mb-8">
                <Calendar size={14} />
                <span>Personalized Strategy</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter leading-tight text-navy">
                Book a Personalized <span className="text-indigo-600">Demo</span>
              </h2>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed font-medium">
                Our team will set up a tailored demo for your business and guide you through how InteracAI can automate your specific growth goals.
              </p>
              
              <div className="space-y-6">
                {[
                  "Tailored implementation strategy",
                  "Deep dive into industry-specific workflows",
                  "ROI projection for your business",
                  "Guided setup and onboarding tour"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-navy font-bold">
                    <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={14} strokeWidth={3} />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:w-1/2 w-full">
              <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-slate-100">
                {demoSubmitted ? (
                  <div className="text-center py-12 animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                      <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-3xl font-bold mb-4 text-navy">Request Received!</h3>
                    <p className="text-slate-500 text-lg">Our team will contact you within 24 hours to schedule your demo.</p>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                        <input 
                          type="text" required placeholder="John Doe"
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-navy placeholder:text-slate-300"
                          value={demoFormState.name} onChange={(e) => setDemoFormState({...demoFormState, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Work Email</label>
                        <input 
                          type="email" required placeholder="john@company.com"
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-navy placeholder:text-slate-300"
                          value={demoFormState.email} onChange={(e) => setDemoFormState({...demoFormState, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone Number</label>
                        <input 
                          type="tel" required placeholder="+1 (555) 000-0000"
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-navy placeholder:text-slate-300"
                          value={demoFormState.phone} onChange={(e) => setDemoFormState({...demoFormState, phone: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Business Type</label>
                        <select 
                          required
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-navy placeholder:text-slate-300 appearance-none"
                          value={demoFormState.businessType} onChange={(e) => setDemoFormState({...demoFormState, businessType: e.target.value})}
                        >
                          <option value="">Select Industry</option>
                          <option value="Hotel">Hotels & Shortlets</option>
                          <option value="Clinic">Clinics & Hospitals</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={demoLoading}
                      className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-4"
                    >
                      {demoLoading ? (
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Schedule My Demo</span>
                          <ArrowRight size={24} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">
            Ready to See InteracAI <br /> in <span className="text-indigo-400">Action?</span>
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-12">
            <a href="#book-demo" className="w-full sm:w-auto">
              <button className="btn-primary w-full px-16 py-6 text-xl">Book a Demo</button>
            </a>
            <a href="#industries" className="w-full sm:w-auto">
              <button className="btn-outline w-full px-16 py-6 text-xl">Try Live Simulation</button>
            </a>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="bg-[#020617] text-white pt-32 pb-12 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
            <div className="space-y-8">
              <div className="flex items-center">
                <img src="/interacAi-logo.png" alt="InteracAI" className="h-14 brightness-0 invert" />
              </div>
              <p className="text-slate-500 font-medium leading-relaxed">
                Empowering businesses with intelligent automation that converts conversations into growth.
              </p>
              <div className="flex space-x-5">
                {[Twitter, Linkedin, Facebook, Instagram].map((Icon, i) => (
                  <a key={i} href="#" className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all border border-white/5">
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="font-black text-sm uppercase tracking-[0.2em] text-indigo-400">Solutions</h4>
              <ul className="space-y-4 text-slate-500 font-bold text-sm">
                <li><a href="#" className="hover:text-white transition-colors">AI Chat Automation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">WhatsApp Marketing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Lead Qualification</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Workflow Builder</a></li>
              </ul>
            </div>

            <div className="space-y-8">
              <h4 className="font-black text-sm uppercase tracking-[0.2em] text-indigo-400">Industries</h4>
              <ul className="space-y-4 text-slate-500 font-bold text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Hotels & Shortlets</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Clinics & Hospitals</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Real Estate Agencies</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Professional Services</a></li>
              </ul>
            </div>

            <div className="space-y-8">
              <h4 className="font-black text-sm uppercase tracking-[0.2em] text-indigo-400">Contact</h4>
              <ul className="space-y-4 text-slate-500 font-bold text-sm">
                <li className="flex items-center gap-3">
                  <Mail size={16} className="text-indigo-400" />
                  <span>contact@interacai.com</span>
                </li>
                <li>
                  <p className="leading-relaxed">
                    No. 18 SK OBAWEDE DRIVE, LOKOGOMA, FCT ABUJA, NIGERIA
                  </p>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">
            <span>&copy; 2026 InteracAI. All Rights Reserved.</span>
            <div className="flex space-x-10 mt-6 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Lead Capture Modal */}
      <LeadCaptureModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        industry={selectedIndustry?.title}
        demoType={selectedIndustry?.id}
        onRevealDemo={handleRevealDemo}
      />
    </div>
  );
};

export default LandingPage;
