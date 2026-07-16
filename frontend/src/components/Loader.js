import React from 'react';

export default function Loader({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full animate-fade-in">
      <div className="relative mb-6">
        {/* Outer pulse effect */}
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse scale-150"></div>
        
        {/* Logo with bounce animation inside a visible lighter blue oval capsule */}
        <div className="relative animate-bounce-slow py-4 px-6 rounded-full bg-[#dbeafe] border border-blue-300/50 shadow-2xl flex items-center justify-center min-w-[150px]">
          <img 
            src="/interacAi-logo.png" 
            alt="InteracAI" 
            className="h-10 w-auto" 
          />
        </div>
      </div>
      
      {/* Loading Bar */}
      <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 w-full origin-left animate-[loading_1.5s_infinite_ease-in-out]"></div>
      </div>
      
      {/* Message */}
      <p className="text-indigo-400 font-bold text-xs tracking-widest uppercase opacity-90 animate-pulse">
        {message}
      </p>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
