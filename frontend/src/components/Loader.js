import React from 'react';

export default function Loader({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full animate-fade-in">
      <div className="relative mb-6">
        {/* Outer pulse effect */}
        <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-pulse-slow scale-150"></div>
        
        {/* Logo with bounce animation */}
        <div className="relative animate-bounce-slow">
          <img 
            src="/interacAi-logo.png" 
            alt="InteracAI" 
            className="h-16 w-auto" 
          />
        </div>
      </div>
      
      {/* Loading Bar */}
      <div className="w-48 h-1.5 bg-grey-medium rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-navy-light to-blue-500 w-full origin-left animate-[loading_1.5s_infinite_ease-in-out]"></div>
      </div>
      
      {/* Message */}
      <p className="text-navy font-bold text-sm tracking-widest uppercase opacity-70 animate-pulse">
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
