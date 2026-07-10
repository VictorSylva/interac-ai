import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2 } from 'lucide-react';

export default function AICopilot() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'model',
      content: 'I am ARGUS, your AI Security Co-Pilot. You can ask me to analyze the security graph or investigate recent alerts.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const CAMERA_SERVICE_HOST = process.env.REACT_APP_CAMERA_API_URL || 'http://localhost:8001';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${CAMERA_SERVICE_HOST}/api/v1/intelligence/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      
      const modelMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.response || "Sorry, I couldn't process that request."
      };

      setMessages([...newMessages, modelMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: 'Connection error. The AI engine might be offline.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-grey-medium bg-grey/30 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Bot className="text-blue-600" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-navy m-0">AI Co-Pilot</h2>
          <p className="text-xs text-text-light m-0 mt-1">ARGUS Intelligence Engine v1.0</p>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6 bg-grey/10">
        {messages.map(msg => (
          <div 
            key={msg.id} 
            className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-navy text-white' : 'bg-blue-100 text-blue-600'
            }`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>

            {/* Bubble */}
            <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-sm' 
                : 'bg-white border border-grey-medium text-text-body rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 self-start">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <Bot size={20} />
            </div>
            <div className="bg-white border border-grey-medium px-5 py-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              <span className="text-sm text-text-light">ARGUS is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-5 border-t border-grey-medium bg-white">
        <div className="flex gap-3 bg-grey/30 p-2 rounded-xl border border-grey-medium focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask ARGUS to investigate..."
            className="flex-grow bg-transparent border-none outline-none px-3 text-navy placeholder:text-text-light"
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
              (!input.trim() || isTyping) 
                ? 'bg-grey-medium text-text-light cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            <Send size={16} className={(!input.trim() || isTyping) ? 'opacity-50' : ''} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
