import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, CheckCircle2 } from 'lucide-react';

const DemoChat = ({ industry, flow }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const userName = localStorage.getItem('interac_user_name') || 'Guest';

  useEffect(() => {
    // Initial message
    const initialMsg = flow[0];
    setMessages([{ role: 'bot', content: initialMsg.content.replace('{name}', userName) }]);
    setStep(1);
  }, [flow, userName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (text = input) => {
    if (!text.trim() || isTyping) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Trigger next bot response
    if (step < flow.length) {
      setIsTyping(true);
      setTimeout(() => {
        const nextStep = flow[step];
        setMessages(prev => [...prev, { role: 'bot', content: nextStep.content.replace('{name}', userName) }]);
        setStep(prev => prev + 1);
        setIsTyping(false);
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-[#0f172a] p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white ring-4 ring-indigo-500/20">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">InteracAI Receptionist</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Active Simulation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scroll-smooth"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl font-medium text-sm md:text-base leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'}`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex gap-1">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="mb-4 flex flex-wrap gap-2">
            {step < flow.length && flow[step].suggestions?.map((s, i) => (
                <button 
                    key={i} 
                    onClick={() => handleSend(s)}
                    className="text-xs font-bold px-4 py-2 bg-slate-100 text-slate-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200"
                >
                    {s}
                </button>
            ))}
        </div>
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium"
          />
          <button 
            type="submit"
            className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DemoChat;
