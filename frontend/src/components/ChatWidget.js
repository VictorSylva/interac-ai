import React, { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  X,
  Send,
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";

export default function ChatWidget(props) {
  // Props for embedded/hero mode
  // variant: 'fixed' (default) | 'hero'
  // businessId: passed when embedded
  // theme: 'light' | 'dark'
  // position: 'bottom-right' etc
  // forceOpen: boolean
  // onClose: callback
  
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(props.forceOpen || false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("ai"); // 'ai' or 'human'
  const [businessId, setBusinessId] = useState(() => {
    if (props.businessId) return props.businessId;
    return "0bbd48c4-b066-435a-be3d-c095b55897c6";
  });

  // Sync with Auth (only if not embedded/fixed businessId)
  useEffect(() => {
    if (!props.businessId && currentUser?.email) {
      setBusinessId(currentUser.email);
    }
  }, [currentUser, props.businessId]);

  // Ensure Hero chat starts fresh every time page is loaded
  const [userId, setUserId] = useState(() => {
    // In hero mode, always start fresh
    if (props.variant === 'hero') {
      const newId = "web_user_hero_" + Math.random().toString(36).substr(2, 9);
      return newId;
    }
    
    if (props.userId) return props.userId;
    const stored = localStorage.getItem("chat_user_id");
    if (stored) return stored;
    const newId = "web_user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("chat_user_id", newId);
    return newId;
  });

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const toggleChat = () => {
    if (isOpen && props.onClose) {
      props.onClose();
    }
    setIsOpen(!isOpen);
  };


  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      try {
        // Add timestamp to bypass any browser caching
        const url = `${apiUrl}/api/web-chat/history?business_id=${businessId}&user_id=${userId}&t=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            const newMessages = data.messages.map((msg) => ({
              text: msg.text,
              sender: (msg.sender === "customer" || msg.sender === "user") ? "user" : "bot",
            }));

            setMessages((prev) => {
              const prevNonSystem = prev.filter(m => !m.isSystem);
              
              // Prevent overriding local state if server history is lagging behind local messages
              if (newMessages.length < prevNonSystem.length) {
                return prev;
              }

              if (JSON.stringify(newMessages) !== JSON.stringify(prevNonSystem)) {
                return newMessages;
              }
              
              return prev;
            });
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    const interval = setInterval(fetchMessages, 2000);
    fetchMessages(); // Initial fetch
    return () => clearInterval(interval);
  }, [isOpen, businessId, userId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = { text: inputText, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    
    // Only show AI typing indicator if we are in AI mode
    if (mode === "ai") {
      setLoading(true);
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/web-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          message: userMsg.text,
          business_id: businessId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === "human_mode" || data.status === "auto_escalated") {
          setMode("human");
          if (data.reply) {
            setMessages((prev) => [...prev, { text: data.reply, sender: "bot" }]);
          }
        } else if (data.status === "workflow_processing") {
          // Stay in loading/processing state or show a temporary note
          // The background worker will send the real reply shortly
          setMessages((prev) => [...prev, { text: "I'm transferring you to our support team.", sender: "bot", isSystem: true }]);
        } else if (data.reply) {
          setMode("ai");
          setMessages((prev) => [...prev, { text: data.reply, sender: "bot" }]);
        }
      } else {
        const errorMsg = data.reply || data.detail || "Sorry, I'm having trouble connecting right now.";
        setMessages((prev) => [...prev, { text: errorMsg, sender: "bot" }]);
      }
    } catch (error) {
      // Try to see if the error response has a 'detail' or 'reply' field
      let errorMsg = "Sorry, I'm having trouble connecting right now.";
      
      setMessages((prev) => [
        ...prev,
        {
          text: errorMsg,
          sender: "bot",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const isHero = props.variant === 'hero';
  const isInline = props.variant === 'inline';

  return (
    <div className={
      isHero ? "w-full max-w-5xl mx-auto mt-4 transition-all duration-500 hover:-translate-y-4 hover:scale-[1.01]" : 
      isInline ? "w-full h-full pointer-events-auto" :
      "fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-[9999] flex flex-col items-end justify-end pointer-events-none"
    }>
      {/* Container for floating animation to avoid conflict with hover transform */}
      <div className={isHero ? "w-full animate-float" : isInline ? "w-full h-full" : "w-full h-full md:w-auto md:h-auto flex flex-col items-end justify-end"}>
        {/* Chat Window - Pointer events enable interaction */}
        {(isOpen || isInline) && (
          <div className={`bg-white shadow-2xl flex flex-col overflow-hidden animate-fade-in-up transition-all duration-500 
            ${isHero ? "w-full max-w-5xl rounded-3xl border border-white/20" : 
              isInline ? "w-full h-full rounded-[2rem] border border-grey-medium" :
              "w-full h-[100dvh] md:w-80 md:h-96 md:rounded-lg border-0 md:border md:border-white/20 pointer-events-auto"}
          `}>
            {/* Header - Hidden in Initial Hero State */}
            {(!isHero || messages.length > 0) && (
              <div className="bg-grey-light text-navy p-4 flex justify-between items-center rounded-t-lg border-b border-navy/10">
                <div className="flex flex-col gap-1">
                  <img src="/interacAi-logo.png" alt="InteracAI" className="h-8 w-auto" />
                  <span className="text-[10px] text-green-600 font-medium px-1">● Online</span>
                </div>
                <button
                  onClick={toggleChat}
                  className="text-navy hover:text-navy-light"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Content Area */}
            <div className={`flex-1 p-4 bg-gray-50 flex flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain ${isHero && messages.length === 0 ? 'hidden' : 'min-h-[150px]'}`}>
                  {messages.length === 0 && (
                    <div className="text-center text-sm text-grey-500 mt-4">
                      👋 Hi! How can I help you today?
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg text-sm ${
                          msg.sender === "user"
                            ? "bg-navy text-white rounded-br-none"
                            : msg.isSystem 
                              ? "bg-transparent text-grey-500 italic border-none text-center w-full max-w-full"
                              : "bg-white text-navy border border-grey-medium rounded-bl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white text-navy border border-grey-medium rounded-lg rounded-bl-none p-3 text-sm italic text-grey-500">
                        Typing...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className={`bg-white flex flex-col gap-3 ${isHero ? 'p-4' : 'p-3 border-t border-gray-100'}`}
                >
                  <div className="flex gap-3">
                    <div className={`flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-2xl transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 ${isHero ? 'px-5 py-1 cursor-text' : 'px-3 py-1'}`}
                         onClick={() => isHero && toggleChat()}
                    >
                      <input
                        type="text"
                        className={`flex-1 bg-transparent text-navy outline-none ${isHero ? 'text-lg py-2.5' : 'text-sm py-2'}`}
                        placeholder={mode === 'human' ? "Agent will respond shortly..." : "Ask our AI assistant anything..."}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onFocus={() => isHero && toggleChat()}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !inputText.trim()}
                      className={`bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl flex items-center justify-center ${isHero ? 'px-6 text-base' : 'p-2'}`}
                    >
                      {isHero ? 'Send' : <Send size={18} />}
                    </button>
                  </div>

                  {isHero && messages.length === 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {['Request a demo', 'Pricing plans', 'WhatsApp setup', 'How it works'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setInputText(chip);
                            // Auto-send if desired, or just set text
                          }}
                          className="px-4 py-2 rounded-full border border-gray-200 text-gray-500 text-sm hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
          </div>
        )}

        {/* Toggle Button (Visible only when chat is closed or on desktop, and NOT in hero or inline mode) */}
        {!isHero && !isInline && (
          <div className="pointer-events-auto p-4 md:p-0">
            <button
              onClick={toggleChat}
              className={`w-16 h-16 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center overflow-hidden bg-navy mt-4 border-2 border-white/20 hover:border-indigo-500/50 group ${
                isOpen ? "hidden md:flex" : "flex animate-pulse-subtle"
              }`}
            >
              {isOpen ? <X size={32} className="text-white" /> : <img src="/interacAiIcon.png" alt="Chat" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
