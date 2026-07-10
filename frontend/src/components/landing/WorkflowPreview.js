import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Sparkles, 
  GitBranch, 
  UserCheck, 
  Play, 
  Bell, 
  Database,
  Globe,
  Smartphone
} from 'lucide-react';

const WorkflowPreview = () => {
  const [activeStep, setActiveStep] = useState(0);
  
  // Auto-advance steps for demo feel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { id: 0, label: 'Inquiry', icon: <MessageSquare className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 1, label: 'AI Process', icon: <Sparkles className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 2, label: 'Logic', icon: <GitBranch className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 3, label: 'Lead Capture', icon: <UserCheck className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 4, label: 'Notification', icon: <Bell className="w-4 h-4 md:w-5 md:h-5" /> },
  ];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-navy-deep/50 backdrop-blur-sm relative overflow-hidden min-h-[400px]">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #3b82f6 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative w-full max-w-4xl flex items-center justify-between z-10 px-2 md:px-0">
        {/* Connection Lines (SVG) */}
        <svg className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 pointer-events-none overflow-visible hidden md:block">
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path 
            d="M 50,0 L 850,0" 
            stroke="url(#flowGradient)" 
            strokeWidth="2" 
            strokeDasharray="4 8"
            className="opacity-20"
          />
          {/* Animated Flow Pulse */}
          <circle r="4" fill="#3b82f6" className="animate-pulse shadow-[0_0_12px_#3b82f6]">
            <animateMotion 
              dur="4s" 
              repeatCount="indefinite" 
              path="M 50,0 L 850,0"
            />
          </circle>
        </svg>

        {steps.map((step, idx) => (
          <div key={step.id} className="flex flex-col items-center relative group">
            {/* Connection labels (hover) */}
            <div className={`absolute -top-12 px-3 py-1 rounded-full bg-navy border border-white/10 text-[10px] font-bold uppercase transition-all duration-500 whitespace-nowrap ${
              activeStep === idx ? 'opacity-100 -translate-y-1' : 'opacity-0 translate-y-2'
            }`}>
              {step.label}
            </div>

            {/* Node Circle */}
            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-700 shadow-2xl border-2 ${
              activeStep === idx 
                ? 'bg-white text-navy border-blue-400 scale-110 rotate-3 z-20 shadow-blue-500/50' 
                : 'bg-navy border-white/5 text-white/40 scale-100 rotate-0 z-10'
            }`}>
              {step.icon}
              {activeStep === idx && (
                <div className="absolute inset-0 rounded-xl md:rounded-2xl animate-ping border-2 border-blue-400/30 -z-10" />
              )}
            </div>
            
            {/* Small status indicator */}
            <div className={`mt-4 w-2 h-2 rounded-full transition-all duration-500 ${
              activeStep === idx ? 'bg-blue-400 scale-125 shadow-[0_0_8px_#3b82f6]' : 'bg-white/10 scale-100'
            }`} />
          </div>
        ))}
      </div>

      {/* Dynamic Content Display Area */}
      <div className="mt-8 md:mt-16 w-full max-w-2xl px-2 md:px-0">
        <div className="glass border border-white/5 p-4 md:p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left space-y-4 md:space-y-0 md:space-x-6">
            <div className="p-2 md:p-3 bg-blue-500/10 rounded-xl text-blue-400">
              {steps[activeStep].icon}
            </div>
            <div className="flex-1">
               <h4 className="text-white font-bold mb-1 flex flex-col md:flex-row items-center justify-center md:justify-start">
                 <span className="text-xs md:text-base">Step {activeStep + 1}: {steps[activeStep].label}</span>
                 <span className="md:ml-3 mt-1 md:mt-0 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[8px] md:text-[10px] uppercase">Active</span>
               </h4>
               <p className="text-white/50 text-[10px] md:text-sm leading-relaxed px-2 md:px-0">
                 {activeStep === 0 && "User initiates contact via WhatsApp or Web Chat widget. InteracAI detects the intent instantly."}
                 {activeStep === 1 && "The AI processing engine analyzes the message, retrieves knowledge base context, and prepares a response."}
                 {activeStep === 2 && "Workflow logic routes the conversation. Is it a lead? A support ticket? A booking request?"}
                 {activeStep === 3 && "InteracAI automatically extracts name, email, and preferences to save to your integrated CRM."}
                 {activeStep === 4 && "Instant alerts sent to your team via Slack or Browser, while a response is delivered to the customer."}
               </p>
            </div>
          </div>
          
          {/* Progress bar at bottom of card */}
          <div className="absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-500" 
               style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* Simulation Toggle (Visual only) */}
      <div className="absolute bottom-4 right-8 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Simulation Running</span>
        </div>
      </div>
    </div>
  );
};

export default WorkflowPreview;
