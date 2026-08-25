import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, Instagram, Mail, ArrowRight, CheckCircle2, Play, Calendar, Zap, Shield, MessageSquare, Sparkles, User, ChevronDown, ChevronUp, Globe, X, BarChart3, AlertTriangle, ShieldAlert, Bot } from 'lucide-react';
import IndustrySelector from '../components/landing/IndustrySelector';
import HowItWorksChat from '../components/landing/HowItWorksChat';
import LeadCaptureModal from '../components/LeadCaptureModal';
import AutoSlider from '../components/landing/AutoSlider';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const LandingPage = () => {
  const [demoFormState, setDemoFormState] = useState({ name: '', email: '', phone: '', businessType: '' });
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(null);
  const [scrollState, setScrollState] = useState('top');
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(null);

  const [activeDemoTab, setActiveDemoTab] = useState('automation');
  const [automationScenario, setAutomationScenario] = useState('chat');
  const [analyticsScenario, setAnalyticsScenario] = useState('standard');
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [activeSecuritySimulation, setActiveSecuritySimulation] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [intruderPos, setIntruderPos] = useState({ x: 5, y: 5 });
  const [resolvedPlateChars, setResolvedPlateChars] = useState('');
  const [smokeLevel, setSmokeLevel] = useState(0);

  const triggerSecuritySimulation = (type) => {
    setActiveSecuritySimulation(type);
    setScanning(false);
    
    if (type === 'intrusion') {
      setIntruderPos({ x: 5, y: 5 });
      let currentX = 5;
      let currentY = 5;
      const interval = setInterval(() => {
        currentX += 5;
        currentY += 4.5;
        setIntruderPos({ x: currentX, y: currentY });
        
        if (currentX >= 35) {
          clearInterval(interval);
          const alertTime = new Date().toLocaleTimeString();
          const newAlert = { time: alertTime, type: 'CRITICAL', text: 'Zone Intrusion Detected - Restricted Area A', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
          setSecurityAlerts(prev => [newAlert, ...prev].slice(0, 5));
          
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch(e){}
        }
      }, 150);
    } 
    
    else if (type === 'alpr') {
      setResolvedPlateChars('');
      const fullPlateText = 'LA-432-XYZ';
      let charIdx = 0;
      const interval = setInterval(() => {
        setResolvedPlateChars(prev => prev + fullPlateText[charIdx]);
        charIdx++;
        
        if (charIdx >= fullPlateText.length) {
          clearInterval(interval);
          const alertTime = new Date().toLocaleTimeString();
          const newAlert = { time: alertTime, type: 'INFO', text: 'License Plate Resolved: LA-432-XYZ (White SUV)', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
          setSecurityAlerts(prev => [newAlert, ...prev].slice(0, 5));
          
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.02, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          } catch(e){}
        }
      }, 200);
    } 
    
    else if (type === 'smoke' || type === 'fire') {
      setSmokeLevel(0);
      let level = 0;
      const interval = setInterval(() => {
        level += 1;
        setSmokeLevel(level);
        
        if (level >= 8) {
          clearInterval(interval);
          const alertTime = new Date().toLocaleTimeString();
          const isFire = type === 'fire';
          const newAlert = isFire 
            ? { time: alertTime, type: 'CRITICAL', text: 'Thermal Hotspot Detected - Warehouse Sector C', color: 'text-red-500 bg-red-500/10 border-red-500/20' }
            : { time: alertTime, type: 'WARNING', text: 'Smoke Anomaly Detected - Loading Bay 2', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
          
          setSecurityAlerts(prev => [newAlert, ...prev].slice(0, 5));
          
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = isFire ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(isFire ? 500 : 330, ctx.currentTime);
            gain.gain.setValueAtTime(0.03, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch(e){}
        }
      }, 200);
    }

    setTimeout(() => {
      setScanning(true);
      setActiveSecuritySimulation(null);
      setIntruderPos({ x: 5, y: 5 });
      setResolvedPlateChars('');
      setSmokeLevel(0);
    }, 6000);
  };

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

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    setDemoLoading(true);
    setDemoError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: demoFormState.name,
          email: demoFormState.email,
          phone: demoFormState.phone,
          role: 'Prospect',
          company_name: '',
          automation_goals: 'Requested a personalized demo',
          industry: demoFormState.businessType,
          demo_type: 'scheduled_demo',
          business_id: '0bbd48c4-b066-435a-be3d-c095b55897c6'
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to submit demo request');
      }

      setDemoSubmitted(true);
      setDemoFormState({ name: '', email: '', phone: '', businessType: '' });
    } catch (err) {
      setDemoError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const pricingPlans = [
    {
      id: "custom",
      name: "Custom",
      price: "Custom",
      conversations: "Unlimited",
      tokens: "Custom Quota",
      tagline: "For organizations requiring bespoke AI solutions, private databases, and custom integrations.",
      features: [
        "Unlimited AI Conversations & Agents",
        "Dedicated Private Infrastructure",
        "Bespoke System Integrations",
        "Investigations Workspace Access",
        "Dedicated Success Manager & SLA",
        "Custom APIs & Integrations"
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "₦750,000",
      conversations: "Unlimited",
      tokens: "50,000,000",
      tagline: "For multi-location organizations requiring enterprise AI operations, intelligence, automation, and security.",
      features: [
        "Unlimited AI Conversations & Agents",
        "Enterprise CRM & Intelligence Graph",
        "Multi-Location Workspace Management",
        "Dedicated Private Infrastructure",
        "ARGUS Security Surveillance Suite"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      price: "₦250,000",
      conversations: "10,000",
      tokens: "5,000,000",
      tagline: "Built for businesses ready to scale intelligently and operate like an enterprise.",
      features: [
        "Includes Everything in Growth",
        "Premium Digital Presence Included",
        "Custom UI/UX & Up to 12 Pages",
        "Online Booking Calendar Configuration",
        "Advanced CRM & Custom API Integration",
        "Analytics Dashboard & Speed Optimization",
        "Hosting & SSL Security Included"
      ]
    },
    {
      id: "growth",
      name: "Growth",
      price: "₦120,000",
      conversations: "2,000",
      tokens: "1,000,000",
      tagline: "Everything needed to launch and grow a professional digital business.",
      popular: true,
      features: [
        "Includes Everything in Starter",
        "Professional Digital Presence Included",
        "Mobile Responsive & SEO Ready",
        "Up to 6 Pages & Contact Forms",
        "WhatsApp & Google Maps Integration",
        "Admin-Managed Deployment",
        "Unlimited Custom Workflows"
      ]
    },
    {
      id: "starter",
      name: "Starter",
      price: "₦60,000",
      conversations: "500",
      tokens: "250,000",
      tagline: "For ambitious businesses ready to automate customer conversations and stop missing opportunities.",
      features: [
        "AI Receptionist & Automation",
        "WhatsApp Bot Integration",
        "Lead Capture & CRM Sync",
        "Unlimited Custom Workflows",
        "No Feature Restrictions",
        "No Website Included"
      ]
    }
  ];

  const comparisonRows = [
    { name: "Monthly Price", custom: "Custom Quote", enterprise: "₦750,000", pro: "₦250,000", growth: "₦120,000", starter: "₦60,000" },
    { name: "AI Conversations", custom: "Unlimited", enterprise: "Unlimited", pro: "≈ 10,000", growth: "≈ 2,000", starter: "≈ 500" },
    { name: "Token Allocation", custom: "Custom Quota", enterprise: "50,000,000", pro: "5,000,000", growth: "1,000,000", starter: "250,000" },
    { name: "AI Receptionist & CRM", custom: "✓ Dedicated CRM", enterprise: "✓ Enterprise CRM", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { name: "WhatsApp & Web Bot", custom: "✓ Dedicated Integration", enterprise: "✓ Unlimited Bots", pro: "✓ Included", growth: "✓ Included", starter: "✓ Included" },
    { name: "Digital Presence", custom: "Bespoke Portals", enterprise: "Tailored Custom Portals", pro: "✓ Premium Presence (up to 12 pages)", growth: "✓ Professional Presence (up to 6 pages)", starter: "❌ No" },
    { name: "Online Booking Calendar", custom: "✓ Custom Rules", enterprise: "✓ Advanced Custom Rules", pro: "✓ Included", growth: "❌ No", starter: "❌ No" },
    { name: "Surveillance Camera Streams", custom: "✓ Private Servers", enterprise: "✓ Unlimited Video Feeds", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { name: "Security & Risk Center", custom: "✓ Private Infrastructure", enterprise: "✓ Full Suite & Workspace", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { name: "Investigation Workspace", custom: "✓ SLA Covered", enterprise: "✓ Full Suite & Timeline", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { name: "Intelligence Graph", custom: "✓ Private Nodes", enterprise: "✓ Full Resolve Nodes", pro: "✓ Live Preview", growth: "❌ No", starter: "❌ No" },
    { name: "Support SLA", custom: "Custom Dedicated Support", enterprise: "Dedicated 24/7 Success Manager", pro: "Priority 24/7 Support", growth: "Standard Support", starter: "Standard Support" }
  ];

  const landingFaqs = [
    {
      q: "What is the website offering included in Growth and Pro plans?",
      a: "Growth and Pro plans include professional website development to launch your business online. The Growth plan delivers a responsive 6-page site, contact forms, and WhatsApp integration. The Pro plan adds premium custom UI/UX design, up to 12 pages, an integrated blog, portfolio showcase, online booking system, custom API/CRM integrations, and fully managed hosting and SSL security."
    },
    {
      q: "Are there revision limits for website development?",
      a: "We are committed to building an outstanding digital presence for your brand. While we do not promise unlimited design revisions, all future content updates, service additions, and layout tweaks are managed directly and seamlessly through your InteracAI subscription platform."
    },
    {
      q: "Why does the Starter plan not include a website?",
      a: "The Starter plan is built for companies that already have active websites or only need AI receptionist automation and custom CRM workflows. You can easily upgrade to Growth or Pro to add website development at any time."
    },
    {
      q: "How are custom domains, hosting, and SSL certificates handled?",
      a: "Standard cloud hosting and security certificates (SSL) are completely covered by your monthly Pro subscription. For the Growth plan, users host their website externally or upgrade to Pro for managed hosting. If you own a custom domain, our engineering team will assist Pro subscribers in mapping it."
    },
    {
      q: "What happens if I exhaust my monthly AI conversation limits?",
      a: "If you consume your monthly conversation quota, you can purchase Pay-As-You-Go (PAYG) token refills. PAYG tokens never expire and are only used after your monthly plan allocation is fully exhausted."
    }
  ];

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
          
          <div className="hidden lg:flex items-center space-x-8 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#industries" className="hover:text-white transition-colors">Industries</a>
            <a href="#experience" className="hover:text-white transition-colors">Demos</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
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
          <div className="max-w-4xl text-right flex flex-col items-end">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.3em] mb-12 border border-indigo-500/20 animate-in fade-in slide-in-from-right-8 duration-1000">
              <Zap size={14} className="fill-indigo-400 text-indigo-400" />
              <span>Unified AI Business Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tighter animate-in fade-in slide-in-from-right-12 duration-1000 delay-100 drop-shadow-2xl">
              One AI Platform. <br />
              <span className="text-gradient font-black">Automate. Understand. Protect.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-right-16 duration-1000 delay-200 font-medium drop-shadow-lg">
              Automate customer interactions, qualify leads, manage workflows, monitor physical locations with computer vision, and extract actionable intelligence—all powered by one unified AI engine.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-right-20 duration-1000 delay-300">
              <a href="#book-demo" className="w-full sm:w-auto">
                <button className="btn-primary w-full px-12 py-6 text-xl shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)]">
                  Book a Demo <ArrowRight size={20} />
                </button>
              </a>
              <a href="#solutions" className="w-full sm:w-auto">
                <button className="btn-outline w-full px-12 py-6 text-xl backdrop-blur-sm bg-white/5 shadow-xl">
                  Explore Solutions <ArrowRight size={20} />
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

      {/* Primary Brand Story Section */}
      <section className="py-24 bg-[#030712] relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.03),transparent_60%)]" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center md:text-left">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-4">
              <h2 className="text-sm font-black uppercase text-indigo-400 tracking-[0.3em] mb-4">The Signal Dilemma</h2>
              <h3 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
                Every growing business generates thousands of signals every day.
              </h3>
            </div>
            <div className="md:col-span-8 md:border-l md:border-white/10 md:pl-12">
              <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                {["Customer Conversations", "Sales Enquiries", "Website Visitors", "Appointments", "Staff Activity", "Security Events", "Cameras", "Transactions", "Workflows"].map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-semibold mb-6">
                Most businesses never connect these signals. They pay for disjointed tools, lose leads in the gaps, and operate blind to physical or digital threats.
              </p>
              <p className="text-base text-indigo-300 leading-relaxed font-bold">
                InteracAI transforms them into one intelligent operating platform that helps businesses automate faster, understand better, and respond smarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Areas Section */}
      <section id="solutions" className="py-32 bg-[#020617] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 border border-indigo-500/20">
              <Sparkles size={14} />
              <span>Full Capabilities</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
              One Engine. <span className="text-gradient">Three Solution Areas.</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              Every capability is connected under one InteracAI platform. Business automation, operational metrics, and camera intelligence work together to scale your operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Business Automation",
                tagline: "Automate customer interactions, qualify leads, and orchestrate campaigns.",
                color: "indigo",
                features: [
                  "AI Receptionist & Guest Concierge",
                  "WhatsApp & Web Chat Automation",
                  "Automated Lead Capture & CRM Sync",
                  "Visual Workflow Builder",
                  "Professional Website Development",
                  "24/7 Intelligent Support Bot"
                ]
              },
              {
                title: "Operational Intelligence",
                tagline: "Understand business performance and optimize workflows in real-time.",
                color: "rose",
                features: [
                  "Real-time Conversation Analytics",
                  "Workflow Performance Monitoring",
                  "AI Insights & Decision Support",
                  "Business Intelligence Dashboards",
                  "Automated Reporting",
                  "Multi-Location Sync"
                ]
              },
              {
                title: "Security Intelligence",
                tagline: "Protect people, assets, and locations with computer vision.",
                color: "emerald",
                features: [
                  "AI-Powered Video Analytics",
                  "Restricted Zone Intrusion Detection",
                  "Suspicious Behavior & Loitering Alerts",
                  "Fire, Smoke, & Thermal Detection",
                  "Automated License Plate Recognition",
                  "Incident Timeline & Graph Resolve"
                ]
              }
            ].map((sol, i) => (
              <div 
                key={i} 
                className="glass-card p-10 rounded-[32px] border border-white/5 relative hover:-translate-y-2 transition-all duration-500 flex flex-col h-full bg-white/[0.02]"
              >
                <div className={`absolute -top-20 -right-20 w-40 h-40 bg-${sol.color}-500/5 blur-[60px] rounded-full`} />
                <h3 className="text-3xl font-black mb-4 text-white">{sol.title}</h3>
                <p className="text-slate-400 text-sm font-semibold mb-8 min-h-[40px] leading-relaxed">{sol.tagline}</p>
                <ul className="space-y-4 flex-1">
                  {sol.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                      <CheckCircle2 size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-20 p-8 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Connected Intelligent Core</h4>
              <p className="text-slate-400 text-sm font-medium">Whether you qualify leads on WhatsApp or spot intrusions on CCTV, everything flows into one CRM, dashboard, and subscription.</p>
            </div>
            <a href="#experience">
              <button className="px-8 py-4 bg-white text-navy font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-95 flex-shrink-0 text-sm">
                Try Live Demos
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Industry Selection Section */}
      <IndustrySelector onSelectIndustry={handleIndustrySelect} />

      {/* Live Demo Simulation (How It Works) */}
      <HowItWorksChat />

      {/* Experience InteracAI (Interactive Demonstrations) Section */}
      <section id="experience" className="py-32 bg-[#0b0f19] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          {/* Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 border border-indigo-500/20">
              <Sparkles size={14} />
              <span>Interactive Platform Tour</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
              Experience <span className="text-gradient">InteracAI</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
              Explore the real-time capabilities of the InteracAI engine. Click a demo category below to play with the live simulator.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left selector */}
            <div className="lg:col-span-4 flex flex-col justify-center space-y-4">
              {[
                { id: 'automation', label: 'Business Automation', icon: MessageSquare, tagline: "AI chat, booking, & lead captures." },
                { id: 'security', label: 'Security Intelligence', icon: Shield, tagline: "Interactive surveillance & alarms preview.", badge: "Interactive Preview" },
                { id: 'analytics', label: 'Operational Analytics', icon: BarChart3, tagline: "Live KPI dashboards & entity graphs." }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDemoTab(tab.id)}
                  className={`w-full text-left p-6 rounded-[24px] font-bold transition-all border flex flex-col justify-between ${
                    activeDemoTab === tab.id 
                      ? 'bg-indigo-600/10 border-indigo-500/50 text-white shadow-xl shadow-indigo-500/5' 
                      : 'bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`p-3 rounded-xl ${activeDemoTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                      <tab.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg text-white font-bold">{tab.label}</span>
                        {tab.badge && (
                          <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/30">
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs font-semibold mt-1 leading-normal">{tab.tagline}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right Display Area */}
            <div className="lg:col-span-8 bg-[#020617]/60 backdrop-blur-md rounded-[40px] border border-white/5 p-8 flex flex-col justify-between min-h-[500px] shadow-2xl relative overflow-hidden">
              
              {/* Tab Content 1: Business Automation */}
              {activeDemoTab === 'automation' && (
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-2">Business Automation Simulator</h3>
                    <p className="text-slate-400 text-sm font-semibold mb-6">Toggle scenarios to see how InteracAI handles chats, CRM leads, websites, and workflows.</p>
                    
                    {/* Scenario Selector Pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {[
                        { id: 'chat', label: 'AI Receptionist Chat' },
                        { id: 'crm', label: 'CRM Lead Card', badge: 'Interactive Preview' },
                        { id: 'website', label: 'Website Presence', badge: 'Interactive Preview' },
                        { id: 'workflows', label: 'Workflow Triggers', badge: 'Interactive Preview' }
                      ].map((scen) => (
                        <button
                          key={scen.id}
                          onClick={() => setAutomationScenario(scen.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${
                            automationScenario === scen.id 
                              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <span>{scen.label}</span>
                          {scen.badge && (
                            <span className="text-[8px] font-black uppercase bg-indigo-500/20 px-1 py-0.5 rounded text-indigo-300">
                              Preview
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Scenario Render Container */}
                    <div className="bg-[#0f172a] rounded-[24px] border border-white/5 p-6 h-[300px] overflow-y-auto flex flex-col justify-between">
                      {automationScenario === 'chat' && (
                        <div className="space-y-4">
                          <div className="flex justify-start">
                            <div className="bg-[#1e293b] px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5 text-xs text-slate-300 font-medium max-w-[80%]">
                              Hi! I'm your AI Business Assistant. How can I help you today?
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="bg-indigo-600 px-4 py-2.5 rounded-2xl rounded-tr-none text-xs text-white font-medium max-w-[80%]">
                              I want to schedule an appointment for my clinic visit.
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="bg-[#1e293b] px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5 text-xs text-slate-300 font-medium max-w-[80%]">
                              Sure! I can schedule that. What is your full name and email?
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="bg-indigo-600 px-4 py-2.5 rounded-2xl rounded-tr-none text-xs text-white font-medium max-w-[80%]">
                              Casey, casey@email.com
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="bg-[#1e293b] px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5 text-xs text-slate-300 font-medium max-w-[80%]">
                              Got it! I've qualified you and booked your slot. Check your WhatsApp for the calendar invite!
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-[9px] font-black uppercase tracking-wider border border-green-500/20">
                              ✓ Lead Saved to CRM: Casey (casey@email.com)
                            </div>
                          </div>
                        </div>
                      )}

                      {automationScenario === 'crm' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">Enterprise CRM Registry</div>
                            <span className="bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-green-500/30">
                              Active Lead
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Contact Name</span>
                              <div className="font-bold text-white mt-1">Casey Williams</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Email Address</span>
                              <div className="font-bold text-white mt-1">casey@email.com</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Acquisition Channel</span>
                              <div className="font-bold text-indigo-400 mt-1">AI WhatsApp Receptionist</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Lead Temperature</span>
                              <div className="font-bold text-red-400 mt-1">Hot (Qualified)</div>
                            </div>
                          </div>
                          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-[10px] font-semibold text-slate-300">
                            🔑 <span className="font-bold text-indigo-300">Sync Status:</span> Dispatched to sales pipeline roster automatically.
                          </div>
                        </div>
                      )}

                      {automationScenario === 'website' && (
                        <div className="h-full flex flex-col justify-between text-slate-300">
                          <div className="border border-white/10 rounded-xl p-4 bg-slate-900 flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2 text-[10px] font-bold">
                              <span className="text-white">🏨 Luxe Shortlets</span>
                              <div className="flex gap-3 text-slate-500">
                                <span>Home</span>
                                <span>Rooms</span>
                                <span>Contact</span>
                              </div>
                            </div>
                            <div className="my-3 text-center animate-pulse">
                              <h4 className="text-sm font-black text-white">Experience Premium Hospitality</h4>
                              <p className="text-[10px] text-slate-400 mt-1">Book your escape with our automated concierge engine instantly.</p>
                            </div>
                            <div className="bg-indigo-500 text-white rounded-lg py-1.5 text-center text-[10px] font-bold">
                              Book Room (Powered by InteracAI Workflows)
                            </div>
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 mt-2 text-center uppercase tracking-widest">
                            Professional Digital Presence - Managed via Dashboard Settings
                          </div>
                        </div>
                      )}

                      {automationScenario === 'workflows' && (
                        <div className="space-y-4">
                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2 font-mono">
                            Active Workflow logic Map
                          </div>
                          <div className="flex flex-col gap-2">
                            {[
                              { step: "1. Web Chat Lead Capture", desc: "User inputs email and phone", status: "COMPLETED", color: "text-green-400" },
                              { step: "2. CRM Integration", desc: "Synchronize client profile", status: "COMPLETED", color: "text-green-400" },
                              { step: "3. WhatsApp Invite Dispatch", desc: "Send automated scheduling invite", status: "COMPLETED", color: "text-green-400" },
                              { step: "4. Slack Alert Trigger", desc: "Notify sales representatives", status: "COMPLETED", color: "text-green-400" }
                            ].map((w, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/5 px-4 py-2 rounded-xl text-[10px] font-mono">
                                <div>
                                  <span className="font-bold text-white">{w.step}</span>
                                  <span className="text-slate-500 ml-2">({w.desc})</span>
                                </div>
                                <span className={`${w.color} font-black uppercase tracking-wider`}>{w.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-slate-500 text-xs font-semibold">Test this live across multiple industries in our sandbox.</span>
                    <Link to="/demo" className="w-full sm:w-auto">
                      <button className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold text-xs hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 w-full">
                        Launch Full Chat Sandbox <ArrowRight size={14} />
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Tab Content 2: Security Intelligence */}
              {activeDemoTab === 'security' && (
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-2xl font-black text-white">AI Camera Surveillance Simulator</h3>
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Interactive Preview
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm font-semibold mb-6">Test how the computer vision engine tags objects and registers zone alarms.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                      
                      {/* Surveillance Stream Feed mock */}
                      <div className="md:col-span-7 bg-[#05070f] rounded-2xl border border-white/10 relative overflow-hidden h-[260px] flex items-center justify-center">
                        
                        {/* Camera static scan line grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(59,130,246,0.15)_95%)] bg-[length:100%_20px] pointer-events-none opacity-40 z-10" />

                        {/* Scanner grid animation when idle */}
                        {scanning && (
                          <div className="absolute inset-0 border border-emerald-500/10 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent bg-[length:100%_200px] animate-pulse z-10 pointer-events-none" />
                        )}

                        {/* 1. Intrusion Simulation Visuals */}
                        {activeSecuritySimulation === 'intrusion' && (
                          <>
                            {/* Constant dashed zone boundary */}
                            <div className="absolute top-[35%] left-[30%] w-[45%] h-[45%] border-2 border-dashed border-red-500/40 bg-red-500/5 rounded-xl z-10 flex items-center justify-center">
                              <span className="text-[8px] font-black uppercase text-red-500/40 tracking-wider">Restricted Area A</span>
                            </div>

                            {/* Moving Intruder Dot */}
                            <div 
                              className="absolute p-2 bg-indigo-500 border border-indigo-400 rounded-full text-white shadow-lg shadow-indigo-500/50 flex items-center gap-1.5 z-20 transition-all duration-100 text-[8px] font-black tracking-wider"
                              style={{ left: `${intruderPos.x}%`, top: `${intruderPos.y}%` }}
                            >
                              <User size={10} className="text-white" />
                              <span>Person</span>
                            </div>

                            {/* Critical Trigger Bounding Box overlay */}
                            {intruderPos.x >= 30 && (
                              <div className="absolute top-[35%] left-[30%] w-[45%] h-[45%] border-4 border-red-500 bg-red-500/15 z-20 animate-pulse rounded-xl flex flex-col justify-between p-1">
                                <span className="text-[8px] font-black text-white bg-red-500 px-1 py-0.5 rounded w-fit uppercase tracking-wider">Zone Intrusion Alarm</span>
                              </div>
                            )}
                          </>
                        )}

                        {/* 2. ALPR Simulation Visuals */}
                        {activeSecuritySimulation === 'alpr' && (
                          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="w-[80%] max-w-sm bg-slate-900 border border-blue-500/30 rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
                              <div className="flex justify-between items-center text-[9px] font-black text-blue-400 uppercase tracking-widest">
                                <span>Plate Reader Capture</span>
                                <span className="animate-pulse">Parsing...</span>
                              </div>

                              <div className="bg-amber-400 border-[6px] border-slate-950 rounded px-4 py-3 flex items-center justify-center relative overflow-hidden my-1 shadow-inner">
                                {/* Laser line scanner */}
                                <div className="absolute left-0 w-full h-1 bg-blue-500/80 shadow-[0_0_12px_#3b82f6] animate-[bounce_1.5s_infinite]" />
                                <span className="text-2xl font-mono font-black text-slate-900 tracking-[0.2em] uppercase select-none drop-shadow-md">
                                  {resolvedPlateChars || '...'}
                                </span>
                              </div>

                              <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                                <span>Device: OCR-CAM-03</span>
                                <span>Confidence: 99.1%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. Smoke Anomaly Visuals */}
                        {activeSecuritySimulation === 'smoke' && (
                          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-end">
                            {/* Rising smoke puffs */}
                            {Array.from({ length: smokeLevel }).map((_, idx) => {
                              const leftPercent = 20 + (idx * 11) % 65;
                              return (
                                <div 
                                  key={idx}
                                  className="absolute bg-slate-400/20 rounded-full blur-2xl animate-ping"
                                  style={{ 
                                    left: `${leftPercent}%`, 
                                    bottom: `${(idx * 12) % 75}%`,
                                    width: `${60 + idx * 8}px`,
                                    height: `${60 + idx * 8}px`,
                                    animationDuration: '3.5s'
                                  }}
                                />
                              );
                            })}
                            
                            {smokeLevel >= 8 && (
                              <div className="absolute top-4 right-4 bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded border border-amber-400 z-30 animate-pulse flex items-center gap-1.5 shadow-lg">
                                <AlertTriangle size={12} /> Smoke Resolved
                              </div>
                            )}
                          </div>
                        )}

                        {/* Idle scanning Tag */}
                        {scanning && !activeSecuritySimulation && (
                          <div className="absolute top-[20%] left-[40%] border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[9px] font-black text-emerald-400 z-10 rounded-full uppercase tracking-widest animate-pulse">
                            Scanning: Active
                          </div>
                        )}

                        {/* Status tag */}
                        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-2 py-1 bg-black/60 rounded text-[9px] font-bold uppercase tracking-wider text-slate-300">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                          <span>Cam-03 East Boundary</span>
                        </div>
                      </div>

                      {/* Timeline logs */}
                      <div className="md:col-span-5 flex flex-col justify-between bg-slate-900/60 rounded-2xl border border-white/5 p-4 overflow-y-auto max-h-[260px]">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-2">Live Incident Alerts</h4>
                        <div className="space-y-2 overflow-y-auto flex-1 text-[10px] font-mono leading-normal">
                          {securityAlerts.length === 0 ? (
                            <div className="text-slate-600 italic">No alerts triggered yet. Click triggers below.</div>
                          ) : (
                            securityAlerts.map((log, idx) => (
                              <div key={idx} className={`p-2 rounded border ${log.color}`}>
                                <span className="text-slate-500">[{log.time}]</span> <span className="font-bold">{log.type}</span>: {log.text}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Trigger buttons */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-3">
                    <button 
                      onClick={() => triggerSecuritySimulation('intrusion')}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 focus:outline-none animate-in fade-in"
                    >
                      <AlertTriangle size={14} /> Simulate Intrusion
                    </button>
                    <button 
                      onClick={() => triggerSecuritySimulation('alpr')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 focus:outline-none animate-in fade-in"
                    >
                      <Bot size={14} /> Simulate Plate Recognition
                    </button>
                    <button 
                      onClick={() => triggerSecuritySimulation('smoke')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 focus:outline-none animate-in fade-in"
                    >
                      <ShieldAlert size={14} /> Simulate Smoke Anomaly
                    </button>
                    <button 
                      onClick={() => triggerSecuritySimulation('fire')}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 focus:outline-none animate-in fade-in"
                    >
                      <ShieldAlert size={14} /> Simulate Fire Anomaly <span className="text-[8px] font-black uppercase bg-red-950/60 px-1 py-0.5 rounded text-red-300">Preview</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Operational Analytics */}
              {activeDemoTab === 'analytics' && (
                <div className="flex flex-col h-full justify-between animate-in fade-in">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-2">Operational Analytics & Intelligence Graph</h3>
                    <p className="text-slate-400 text-sm font-semibold mb-6">Examine how InteracAI correlates physical and digital metrics under a single logic graph.</p>
                    
                    {/* Scenario selector */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {[
                        { id: 'standard', label: 'Standard Overview' },
                        { id: 'supermarket', label: 'Supermarket Scenario', badge: 'Interactive Preview' },
                        { id: 'retail', label: 'Retail Analytics', badge: 'Interactive Preview' }
                      ].map((scen) => (
                        <button
                          key={scen.id}
                          onClick={() => setAnalyticsScenario(scen.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${
                            analyticsScenario === scen.id 
                              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <span>{scen.label}</span>
                          {scen.badge && (
                            <span className="text-[8px] font-black uppercase bg-indigo-500/20 px-1 py-0.5 rounded text-indigo-300">
                              Preview
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                      
                      {/* Metric KPI cards */}
                      <div className="bg-slate-900/60 rounded-2xl border border-white/5 p-4 flex flex-col justify-between h-[230px]">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-2">
                          {analyticsScenario === 'standard' && "Core Metrics"}
                          {analyticsScenario === 'supermarket' && "Supermarket Operations"}
                          {analyticsScenario === 'retail' && "Retail Performance"}
                        </h4>
                        
                        {analyticsScenario === 'standard' && (
                          <div className="grid grid-cols-2 gap-3 flex-1 items-center animate-in fade-in">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Conversations</div>
                              <div className="text-lg font-black text-indigo-400 mt-1">2,342</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Intrusions Tagged</div>
                              <div className="text-lg font-black text-red-500 mt-1">4</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Cost Savings</div>
                              <div className="text-lg font-black text-green-500 mt-1">₦350k</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">AI Accuracy</div>
                              <div className="text-lg font-black text-white mt-1">98.6%</div>
                            </div>
                          </div>
                        )}

                        {analyticsScenario === 'supermarket' && (
                          <div className="grid grid-cols-2 gap-3 flex-1 items-center animate-in fade-in">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Avg Queue Delay</div>
                              <div className="text-lg font-black text-indigo-400 mt-1">1.2 min</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Daily Footfall</div>
                              <div className="text-lg font-black text-white mt-1">4,120</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Auto-Restocks</div>
                              <div className="text-lg font-black text-green-500 mt-1">32 triggers</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Risk Incidents</div>
                              <div className="text-lg font-black text-emerald-400 mt-1">0 active</div>
                            </div>
                          </div>
                        )}

                        {analyticsScenario === 'retail' && (
                          <div className="grid grid-cols-2 gap-3 flex-1 items-center animate-in fade-in">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Avg Dwell Time</div>
                              <div className="text-lg font-black text-indigo-400 mt-1">18.5 min</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Lead Conv Rate</div>
                              <div className="text-lg font-black text-green-500 mt-1">4.8%</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">Unique Visitors</div>
                              <div className="text-lg font-black text-white mt-1">1,842</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                              <div className="text-[10px] font-black uppercase text-slate-500">CCTV Flags</div>
                              <div className="text-lg font-black text-red-400 mt-1">1 flag</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Intelligence Graph Mockup */}
                      <div className="bg-slate-900/60 rounded-2xl border border-white/5 p-4 flex flex-col justify-between h-[230px]">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-1">Security Graph Resolve</h4>
                        <span className="text-[9px] text-slate-500 mb-2 italic">Hover nodes to trace relationships</span>
                        
                        {/* Interactive Graph Node View */}
                        <div className="relative flex-1 bg-black/40 rounded-xl border border-white/5 p-2 flex items-center justify-center overflow-hidden">
                          {/* Draw nodes using simple styling */}
                          <div className="absolute w-[60px] h-[60px] bg-indigo-500/20 border border-indigo-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white text-center p-1 cursor-pointer hover:bg-indigo-500/40 z-20">
                            Core AI
                          </div>
                          
                          {/* Satellite nodes */}
                          <div className="absolute top-2 left-2 p-1.5 bg-rose-500/20 border border-rose-500 rounded-lg text-[7px] font-bold text-white cursor-pointer hover:bg-rose-500/40 z-20">
                            CCTV-03 Alert
                          </div>
                          <div className="absolute bottom-2 left-6 p-1.5 bg-blue-500/20 border border-blue-500 rounded-lg text-[7px] font-bold text-white cursor-pointer hover:bg-blue-500/40 z-20">
                            WhatsApp Bot
                          </div>
                          <div className="absolute top-6 right-2 p-1.5 bg-emerald-500/20 border border-emerald-500 rounded-lg text-[7px] font-bold text-white cursor-pointer hover:bg-emerald-500/40 z-20">
                            CRM Client
                          </div>
                          <div className="absolute bottom-4 right-6 p-1.5 bg-slate-500/20 border border-slate-400 rounded-lg text-[7px] font-bold text-white cursor-pointer hover:bg-slate-400/40 z-20">
                            Vehicle Plate
                          </div>

                          {/* Line Connectors */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-700 stroke-1 opacity-40 z-0">
                            <line x1="50%" y1="50%" x2="25%" y2="20%" stroke="gray" />
                            <line x1="50%" y1="50%" x2="30%" y2="80%" stroke="gray" />
                            <line x1="50%" y1="50%" x2="80%" y2="25%" stroke="gray" />
                            <line x1="50%" y1="50%" x2="75%" y2="80%" stroke="gray" />
                          </svg>
                        </div>
                      </div>

                    </div>
                  </div>
                  <div className="mt-8 text-[11px] text-slate-500 font-semibold leading-relaxed">
                    * By joining visual, conversation, and workflow streams into one security graph, InteracAI maps entity actions chronologically and decodes anomalies instantly.
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* Value Proposition Section */}
      <section id="value-prop" className="py-32 bg-[#020617] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 border border-indigo-500/20">
              <Sparkles size={14} />
              <span>Business Impact</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight text-white">
              Unified Intelligence. <span className="text-gradient">Real Outcomes.</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
              We help you automate communication, track operations, and secure assets in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              { title: "Reduce Missed Enquiries", desc: "Respond instantly, 24/7. Turn every web visitor or WhatsApp message into a conversation and sales opportunity.", icon: Zap },
              { title: "Turn Chats Into Revenue", desc: "AI schedules calendar bookings, qualifies buyer profiles, and syncs directly to your CRM to fast-track deals.", icon: CheckCircle2 },
              { title: "Detect Incidents Early", desc: "Spot zone intrusions, unrecognized license plates, or smoke anomalies on your video feeds before they escalate.", icon: ShieldAlert },
              { title: "Gain Operational Visibility", desc: "Track conversation volume, token usage, automation steps, and physical logs on real-time dashboards.", icon: BarChart3 },
              { title: "Scale Across Locations", desc: "Manage one storefront, clinic, or warehouse, or scale seamlessly to hundreds from a single account.", icon: Globe },
              { title: "Protect People & Assets", desc: "Keep physical operations secure and teams aligned with active alerts, incident timelines, and graph correlation.", icon: Shield }
            ].map((prop, i) => (
              <div key={i} className="glass-card p-10 rounded-[32px] bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-8">
                  <prop.icon size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">{prop.title}</h3>
                <p className="text-slate-400 leading-relaxed font-medium text-sm">{prop.desc}</p>
              </div>
            ))}
          </div>

          {/* Why Customers Subscribe - The Power of One Platform banner */}
          <div className="border-t border-white/5 pt-20">
            <div className="text-center mb-16">
              <h3 className="text-3xl font-black text-white mb-4">The Power of <span className="text-gradient">ONE Platform</span></h3>
              <p className="text-slate-400 text-sm font-semibold max-w-xl mx-auto">Consolidate your stack. InteracAI replaces multiple disconnected software subscriptions with a single unified solution.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "One Subscription", desc: "Consolidated billing" },
                { label: "One Platform", desc: "Unified interfaces" },
                { label: "One Login", desc: "Single admin access" },
                { label: "Bespoke Website", desc: "Included in Growth & Pro" },
                { label: "Operational Insights", desc: "Activity & token metrics" },
                { label: "Security Vision", desc: "Intrusion alerts" },
                { label: "CRM Lead Capture", desc: "Integrated profile database" },
                { label: "Multi-Location Sync", desc: "Grows with your business" }
              ].map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 text-center">
                  <div className="font-extrabold text-white text-base mb-1">{item.label}</div>
                  <div className="text-slate-500 text-xs font-semibold">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stack Comparison Section */}
      <section className="py-24 bg-[#030712] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              Stop Paying For <span className="text-gradient">Fragmented Tools</span>
            </h2>
            <p className="text-slate-400 text-sm font-semibold max-w-xl mx-auto">
              Consolidate your tools, slash subscription overheads, and streamline operations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
            {/* The Disjointed Stack */}
            <div className="p-8 md:p-12 rounded-[32px] bg-red-500/5 border border-red-500/10 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2">
                  ✕ The Fragmented Way
                </h3>
                <div className="space-y-4">
                  {[
                    { tool: "Website Developer", price: "₦150k - ₦500k upfront" },
                    { tool: "Live Chat / Receptionist Agency", price: "₦100k/mo per seat" },
                    { tool: "Standalone CRM", price: "₦40k/mo" },
                    { tool: "SMS & WhatsApp Gateways", price: "Pay per message fees" },
                    { tool: "Workflow Software (Zapier)", price: "₦35k/mo" },
                    { tool: "Analytics & Analytics Plugins", price: "₦25k/mo" },
                    { tool: "Security Monitoring Hardware/Software", price: "₦80k/mo" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm font-semibold border-b border-white/5 pb-2 text-slate-400">
                      <span>{item.tool}</span>
                      <span className="text-red-400">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 text-slate-500 text-xs font-bold">
                Result: Fragmented data, slow responses, system breakdowns, and runaway monthly bills.
              </div>
            </div>

            {/* The InteracAI Way */}
            <div className="p-8 md:p-12 rounded-[32px] bg-indigo-500/5 border border-indigo-500/20 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                Unified Power
              </div>
              <div>
                <h3 className="text-2xl font-bold text-indigo-400 mb-6 flex items-center gap-2">
                  ✓ The InteracAI Way
                </h3>
                <div className="space-y-4">
                  {[
                    "Professional Digital Presence",
                    "AI WhatsApp & Web Receptionist",
                    "Built-in CRM & Lead Sync",
                    "Integrated Booking Calendar",
                    "Unlimited Automated Workflows",
                    "Real-time Business Dashboards",
                    "Security Intelligence Surveillance"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm font-semibold border-b border-white/5 pb-2 text-slate-200">
                      <span className="text-green-400 text-lg">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 text-indigo-300 text-xs font-bold">
                Result: One platform. One login. One subscription. Everything works together natively.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Communication Section */}
      <section className="py-24 bg-[#020617] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              Everything Your Business Needs, <span className="text-gradient">Included.</span>
            </h2>
            <p className="text-slate-400 text-sm font-semibold max-w-xl mx-auto mt-4">
              Regardless of your tier, every subscription gives you core capabilities to operate your company at enterprise-grade efficiency.
            </p>
          </div>
          
          <AutoSlider speed={0.8}>
            {[
              { title: "AI Receptionist & Automation", desc: "Automate calls, chats, and FAQs with state-of-the-art natural language intelligence." },
              { title: "Unified CRM Leads Database", desc: "Capture user profiles, synchronize communications, and route leads automatically." },
              { title: "Unlimited Workflows", desc: "Build automated schedules, custom triggers, and integrations without arbitrary limits." },
              { title: "Continuous Platform Updates", desc: "Get automatic access to new core models, templates, and optimization features." },
              { title: "Secure Cloud Platform", desc: "Enterprise security protocols, encryption at rest and in transit, and active safeguards." },
              { title: "Business Intelligence", desc: "Operational dashboards, conversational logs, sentiment metrics, and cost analytics." },
              { title: "Future AI Improvements", desc: "Evolve with the latest developments in generative AI and LLMs automatically." },
              { title: "Enterprise-grade Infrastructure", desc: "Hosted on resilient cloud clusters with high uptime SLA and rapid response support." },
              { title: "One Integrated Workspace", desc: "No more switching windows. Replaces multiple software suites with one unified interface." }
            ].map((item, idx) => (
              <div key={idx} className="w-[320px] flex-shrink-0 p-8 rounded-3xl bg-white/[0.01] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors duration-300">
                <div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm mb-6">
                    ✓
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                  <p className="text-slate-400 text-sm font-semibold leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </AutoSlider>
        </div>
      </section>

      {/* Pricing, Comparison & FAQ Section */}
      <section id="pricing" className="py-32 bg-[#020617] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
              Simple, Transparent <span className="text-gradient">Pricing</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
              No hidden fees. Every plan includes full access to our workflow engine. Upgrade to include website development.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 xl:gap-8 mb-24 items-stretch">
            {pricingPlans.map((plan) => (
              <div 
                key={plan.id}
                className={`flex flex-col relative p-6 rounded-[32px] border-2 transition-all duration-500 hover:-translate-y-2 ${
                  plan.popular 
                    ? 'bg-[#0f172a] border-indigo-500 shadow-[0_0_50px_-12px_rgba(99,102,241,0.4)] z-10 scale-105' 
                    : 'bg-[#0b1329]/40 border-white/5 shadow-xl'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-3 text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold leading-normal min-h-[50px]">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-2xl font-black text-white">{plan.price}</span>
                    {plan.id !== 'custom' && <span className="text-slate-500 font-bold text-xs">/mo</span>}
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-4 mb-8 py-4 border-y border-white/5">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-indigo-300 text-[10px] font-bold w-fit">
                    <Zap size={10} className="fill-indigo-300 text-indigo-300" />
                    {plan.id === 'enterprise' || plan.id === 'custom' ? 'Unlimited conversations' : `≈ ${plan.conversations} conversations / month`}
                  </div>
                  <div className="text-slate-400 text-[10px] font-bold">
                    {plan.id === 'enterprise' || plan.id === 'custom' ? 'Custom SLA & Dedicated Deploy' : `(${plan.tokens} Tokens included)`}
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    {plan.features.map((feat, idx) => {
                      const isNoWeb = feat.includes("No Website");
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-2 text-xs ${
                            isNoWeb ? 'text-slate-500 font-medium' : (feat.includes("Presence Included") && (plan.id === 'growth' || plan.id === 'pro')) ? 'text-indigo-400 font-bold' : 'text-slate-300 font-medium'
                          }`}
                        >
                          {isNoWeb ? (
                            <span className="text-red-500 font-bold text-xs flex-shrink-0 mt-0.5">✕</span>
                          ) : (
                            <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                          )}
                          <span>{feat}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {plan.id === 'enterprise' || plan.id === 'custom' ? (
                  <a href="#book-demo" className="w-full">
                    <button className="w-full py-3.5 rounded-xl font-bold transition-all active:scale-95 bg-white/10 hover:bg-white/20 text-white text-xs">
                      Contact Sales
                    </button>
                  </a>
                ) : (
                  <Link to="/login" className="w-full">
                    <button className={`w-full py-3.5 rounded-xl font-bold transition-all active:scale-95 text-xs ${
                      plan.popular 
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20' 
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}>
                      Get Started
                    </button>
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Detailed Feature Comparison */}
          <div className="mb-24 glass-card p-8 md:p-12 rounded-[32px] border border-white/5 overflow-hidden">
            <h3 className="text-3xl font-extrabold mb-8 text-center tracking-tight text-white">Compare Plans & Features</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/5 text-xs font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-5 pr-4 text-slate-400">Feature</th>
                    <th className="py-5 px-4 text-center text-indigo-400 bg-indigo-500/5 rounded-t-2xl">Custom</th>
                    <th className="py-5 px-4 text-center text-amber-400 bg-amber-500/5">Enterprise</th>
                    <th className="py-5 px-4 text-center text-slate-400">Pro</th>
                    <th className="py-5 px-4 text-center text-slate-400">Growth</th>
                    <th className="py-5 pl-4 text-center text-slate-400">Starter</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-semibold text-slate-300">
                  {comparisonRows.map((feat, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="font-bold text-white">{feat.name}</div>
                      </td>
                      <td className="py-4 px-4 text-center bg-indigo-500/5 font-bold text-indigo-300">{feat.custom}</td>
                      <td className="py-4 px-4 text-center bg-amber-500/5 font-bold text-amber-300">{feat.enterprise}</td>
                      <td className="py-4 px-4 text-center font-bold text-white">{feat.pro}</td>
                      <td className="py-4 px-4 text-center text-slate-400 font-medium">{feat.growth}</td>
                      <td className="py-4 pl-4 text-center text-slate-500 font-medium">{feat.starter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-extrabold mb-10 text-center tracking-tight text-white">Frequently Asked Questions</h3>
            <div className="space-y-4">
              {landingFaqs.map((item, i) => {
                const isOpen = activeFaq === i;
                return (
                  <div key={i} className="glass-card rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : i)}
                      className="w-full px-8 py-5 text-left font-bold text-white flex items-center justify-between gap-4 hover:bg-white/5 transition-colors focus:outline-none"
                    >
                      <span className="text-base md:text-lg">{item.q}</span>
                      {isOpen ? <ChevronUp className="w-5 h-5 text-indigo-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                    </button>
                    <div 
                      className={`transition-all duration-300 overflow-hidden ${
                        isOpen ? 'max-h-96 border-t border-white/5' : 'max-h-0'
                      }`}
                    >
                      <div className="p-8 text-slate-400 leading-relaxed text-sm font-medium bg-white/5">
                        {item.a}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                    {demoError && (
                      <p className="text-red-600 text-sm font-bold bg-red-50 p-4 rounded-2xl border border-red-100">
                        {demoError}
                      </p>
                    )}
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
