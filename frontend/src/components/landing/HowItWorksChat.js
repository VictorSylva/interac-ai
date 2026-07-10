import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, CheckCircle2, MessageSquare, Hotel, Stethoscope, Building, Send, MoreVertical, Phone, Video } from 'lucide-react';

const flows = {
  hotel: [
    { role: 'user', content: "Hi, I'm looking for a room for a business trip next Tuesday." },
    { role: 'bot', content: "Welcome to Lunares Lodge! I'd be happy to help. We have Executive Suites and Deluxe Rooms available for Tuesday. Which would you prefer?" },
    { role: 'user', content: "What's the difference in price?" },
    { role: 'bot', content: "Executive Suites are $280/night with full lounge access. Deluxe Rooms are $195. Both include high-speed Wi-Fi and breakfast." },
    { role: 'user', content: "I'll go with the Deluxe Room." },
    { role: 'bot', content: "Perfect choice. To secure your corporate rate, please provide your full name and company email.", highlight: "Lead Captured" },
    { role: 'user', content: "Alex Rivera, alex@techcorp.com" },
    { role: 'bot', content: "Thank you, Alex. I've blocked that room for you. Would you like me to send the secure payment link to your WhatsApp?", highlight: "Reservation Pending" },
    { role: 'user', content: "Yes please." },
    { role: 'bot', content: "Sent! Check your WhatsApp. We look forward to welcoming you to Lunares Lodge.", highlight: "Booking Confirmed" }
  ],
  clinic: [
    { role: 'user', content: "I have a sharp pain in my lower molar. Do you have any emergency openings today?" },
    { role: 'bot', content: "I'm sorry to hear you're in pain. We do have an emergency slot at 4:15 PM today. Is this your first time at our clinic?" },
    { role: 'user', content: "Yes, I just moved to the area." },
    { role: 'bot', content: "Understood. To get you registered quickly, please share your name and phone number.", highlight: "Lead Captured" },
    { role: 'user', content: "Jordan Lee, 555-0123" },
    { role: 'bot', content: "Thanks Jordan. I've reserved the 4:15 PM slot for you. Please arrive 10 minutes early for paperwork.", highlight: "Emergency Appointment Booked" },
    { role: 'bot', content: "I've also sent you a digital intake form to save time. See you soon!", highlight: "Form Sent" }
  ],
  'real-estate': [
    { role: 'user', content: "Is the penthouse at Skyline Towers still available?" },
    { role: 'bot', content: "It is! It's one of our most popular listings. Would you like to see the virtual tour or schedule an in-person walkthrough?" },
    { role: 'user', content: "In-person would be better. Maybe this weekend?" },
    { role: 'bot', content: "We have viewings this Saturday at 10 AM or Sunday at 2 PM. What's your budget range for this move?", highlight: "Qualifying Lead" },
    { role: 'user', content: "Around $5k-$7k. Sunday at 2 PM works." },
    { role: 'bot', content: "Perfect. I need your full name and email to send the entry credentials.", highlight: "Lead Captured" },
    { role: 'user', content: "Casey Wright, casey@design.co" },
    { role: 'bot', content: "You're all set for Sunday at 2 PM! Our senior agent will meet you in the lobby.", highlight: "Viewing Scheduled" }
  ]
};

const HowItWorksChat = () => {
  const [activeTab, setActiveTab] = useState('hotel');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef(null);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const cycleTimeoutRef = useRef(null);

  const tabs = [
    { id: 'hotel', label: 'Hotels', icon: Hotel, color: 'indigo' },
    { id: 'clinic', label: 'Clinics', icon: Stethoscope, color: 'rose' },
    { id: 'real-estate', label: 'Real Estate', icon: Building, color: 'emerald' }
  ];

  useEffect(() => {
    setMessages([]);
    setCurrentStep(0);
    setIsTyping(false);
  }, [activeTab]);

  useEffect(() => {
    if (currentStep === 0 && messages.length === 0 && !isTyping) {
      const timer = setTimeout(() => runStep(0), 1000);
      return () => clearTimeout(timer);
    }

    // Auto-cycle logic: if a flow finishes, wait 5 seconds and go to next
    if (isAutoCycling && currentStep >= flows[activeTab].length && !isTyping) {
      cycleTimeoutRef.current = setTimeout(() => {
        const currentIndex = tabs.findIndex(t => t.id === activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
      }, 5000);
      return () => clearTimeout(cycleTimeoutRef.current);
    }
  }, [activeTab, currentStep, messages, isAutoCycling]);

  const handleTabClick = (id) => {
    setIsAutoCycling(false);
    setActiveTab(id);
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const runStep = (step) => {
    const flow = flows[activeTab];
    if (step >= flow.length) return;

    const msg = flow[step];
    
    if (msg.role === 'user') {
      setTimeout(() => {
        setMessages(prev => [...prev, msg]);
        setCurrentStep(step + 1);
      }, 1000);
    } else {
      setIsTyping(true);
      const typingTime = Math.min(msg.content.length * 15 + 800, 3000);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, msg]);
        setCurrentStep(step + 1);
      }, typingTime);
    }
  };

  useEffect(() => {
    if (currentStep > 0 && currentStep < flows[activeTab].length) {
      runStep(currentStep);
    }
  }, [currentStep, activeTab]);

  return (
    <section id="how-it-works" className="py-32 bg-[#020617] relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
            See the <span className="text-indigo-400">Magic</span> in Real-Time
          </h2>
          <p className="text-slate-400 font-medium max-w-2xl mx-auto text-lg">
            Watch how InteracAI handles complex customer journeys, captures leads, and closes deals while you sleep.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Controls */}
          <div className="lg:col-span-4 space-y-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center justify-between p-6 rounded-[24px] font-bold transition-all border ${
                  activeTab === tab.id 
                    ? `bg-indigo-600/10 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/5` 
                    : `bg-white/[0.02] border-white/5 text-slate-500 hover:bg-white/[0.04]`
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-white/5'}`}>
                    <tab.icon size={20} />
                  </div>
                  <span className="text-lg">{tab.label}</span>
                </div>
                {activeTab === tab.id && <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />}
              </button>
            ))}
            
            <div className="p-8 bg-indigo-600 rounded-[32px] mt-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
               <h4 className="text-white text-xl font-bold mb-2">Ready to automate?</h4>
               <p className="text-indigo-100 text-sm mb-6">Our AI agents are ready to deploy in your business within 24 hours.</p>
               <button 
                 onClick={() => window.location.href='#book-demo'}
                 className="w-full py-4 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
               >
                 Book Your Demo
               </button>
            </div>
          </div>

          {/* Chat UI */}
          <div className="lg:col-span-8 bg-[#0f172a] rounded-[40px] shadow-2xl border border-white/5 overflow-hidden flex flex-col h-[700px] relative">
            {/* Chat Header */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-full flex items-center justify-center text-white">
                    <Bot size={24} />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#1e293b] rounded-full" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">InteracAI Concierge</h3>
                  <span className="text-green-400 text-[10px] font-bold uppercase tracking-widest">Always Online</span>
                </div>
              </div>
              <div className="flex items-center gap-5 text-slate-400">
                <Video size={20} className="hover:text-white cursor-pointer" />
                <Phone size={20} className="hover:text-white cursor-pointer" />
                <MoreVertical size={20} className="hover:text-white cursor-pointer" />
              </div>
            </div>

            {/* Chat Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-6 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90 scroll-smooth"
            >
              {messages.map((m, i) => (
                <div 
                  key={i} 
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-5 py-3 rounded-[20px] font-medium leading-relaxed shadow-lg ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-[#1e293b] text-slate-200 border border-white/5 rounded-tl-none'
                    }`}>
                      {m.content}
                    </div>
                    
                    {m.highlight && (
                      <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-500/20 animate-in zoom-in duration-500">
                        <CheckCircle2 size={12} />
                        {m.highlight}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e293b] px-5 py-4 rounded-[20px] rounded-tl-none border border-white/5 flex gap-1.5 shadow-lg">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Mock Footer */}
            <div className="p-6 bg-[#1e293b]/50 border-t border-white/5 flex items-center gap-4">
               <div className="flex-1 h-14 bg-[#0f172a] rounded-2xl border border-white/5 flex items-center px-6 text-slate-500 text-sm font-medium italic">
                 The AI is processing the conversation...
               </div>
               <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                 <Send size={24} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksChat;
