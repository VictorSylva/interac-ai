import React, { useState, useEffect, useCallback } from 'react';
import { Search, Send, Phone, User, MoreVertical, Filter, UserCheck, Share2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';
import { useNotifications } from '../hooks/useNotifications';

export default function Conversations() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [availableDepartments, setAvailableDepartments] = useState(['sales', 'support', 'billing', 'general']);
  
  const businessId = currentUser?.business_id || currentUser?.email || "default";

  const onMessage = useCallback((event) => {
    // Normalize IDs: the server often sends full "bid:user_id", dashboard uses "user_id"
    const eventConvoId = event.conversation_id?.includes(':') ? event.conversation_id.split(':')[1] : event.conversation_id;
    
    if (event.type === 'NEW_MESSAGE') {
      // Update message list if this is the active chat
      if (selectedChat && (selectedChat.id === eventConvoId || selectedChat.id === event.user_id)) {
        // Prevent duplicate local state additions if the message is already in list
        setMessages(prev => {
          const isDuplicate = prev.slice(-5).some(m => 
             m.text === event.text && 
             m.sender === event.sender
          );
          if (isDuplicate) return prev;
          return [...prev, {
            text: event.text,
            sender: event.sender,
            timestamp: event.timestamp,
            platform: event.platform
          }];
        });
      }
      // Update sidebar list
      setConversations(prev => {
        const exists = prev.find(c => c.id === eventConvoId || c.id === event.user_id);
        if (exists) {
            return prev.map(c => (c.id === eventConvoId || c.id === event.user_id) ? {
                ...c, 
                lastMessage: event.text, 
                lastTimestamp: event.timestamp,
                unread: (selectedChat?.id === c.id) ? 0 : (c.unread + 1),
                mode: event.mode || c.mode,
                status: event.status || c.status,
                department: event.department || c.department
            } : c).sort((a,b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
        } else {
            // Add NEW conversation to the list if it doesn't exist
            const newConvo = {
                id: eventConvoId,
                customerName: event.user_id || "New Customer",
                lastMessage: event.text,
                lastTimestamp: event.timestamp,
                unread: 1,
                platform: event.platform || 'web',
                mode: event.mode || 'ai',
                status: event.status || 'active',
                department: event.department || 'general'
            };
            return [newConvo, ...prev].sort((a,b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
        }
      });
    } else if (event.type === 'CONVERSATION_UPDATED') {
        setConversations(prev => prev.map(c => (c.id === eventConvoId) ? {
            ...c,
            mode: event.mode,
            status: event.status,
            department: event.department,
            assignedAgentId: event.assigned_agent_id
        } : c));
        
        if (selectedChat?.id === eventConvoId) {
            setSelectedChat(prev => ({
                ...prev, 
                mode: event.mode,
                status: event.status,
                department: event.department,
                assignedAgentId: event.assigned_agent_id
            }));
        }
    }
  }, [selectedChat, businessId]);

  const { registerPush } = useNotifications(
    businessId, 
    currentUser?.id,
    onMessage
  );

  useEffect(() => {
    registerPush();
  }, [registerPush]);

  // Fetch Business Config (Departments)
  useEffect(() => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    fetch(`${apiUrl}/api/business-profile?business_id=${encodeURIComponent(businessId)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.departments && Array.isArray(data.departments)) {
          setAvailableDepartments(data.departments);
        }
      })
      .catch(err => console.error("Error fetching departments:", err));
  }, [currentUser]);

  // Fetch Conversations List
  useEffect(() => {
    // Use business_id (UUID) or fallback to email (legacy/dev) or default
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${apiUrl}/api/conversations?business_id=${encodeURIComponent(businessId)}`, {
        signal: controller.signal
    })
      .then(res => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(data => {
        setConversations(Array.isArray(data) ? data : []);
        if (data.length > 0) {
            if (window.innerWidth >= 768) {
                 setSelectedChat(data[0]);
            }
        }
        setLoading(false);
      })
      .catch(err => {
          setLoading(false);
      });
  }, [currentUser]);

  const safelyFormatDate = (dateString) => {
      try {
          if (!dateString) return '';
          return new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } catch (e) {
          return '';
      }
  };

  // Fetch Messages when Selected Chat Changes (Initial only, then WS handles it)
  useEffect(() => {
    if (selectedChat) {
      const businessId = currentUser?.business_id || currentUser?.email || "default";
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

      fetch(`${apiUrl}/api/conversations/${selectedChat.id}/messages?business_id=${encodeURIComponent(businessId)}`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => setMessages(Array.isArray(data) ? data : []))
        .catch(err => {
            console.error("Fetch messages error:", err);
        });
    }
  }, [selectedChat, currentUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    // Optimistic Update
    const msg = {
        text: newMessage,
        sender: 'agent', 
        timestamp: new Date().toISOString(),
        platform: 'web_manual'
    };

    setMessages([...messages, msg]);
    const sentText = newMessage;
    setNewMessage('');
    
    try {
      const res = await fetch(`${apiUrl}/api/conversations/${selectedChat.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sentText,
          business_id: businessId
        })
      });

      if (!res.ok) throw new Error("Failed to send message");
      
      // Update selected chat mode locally if it was AI
      if (selectedChat.mode === 'ai') {
        setSelectedChat({...selectedChat, mode: 'human'});
        setConversations(prev => prev.map(c => c.id === selectedChat.id ? {...c, mode: 'human'} : c));
      }

    } catch (err) {
      console.error("Send error:", err);
      // Optional: show error toast
    }
  };

  const handleResolve = async () => {
    if (!selectedChat) return;

    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiUrl}/api/conversations/${selectedChat.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId })
      });

      if (res.ok) {
        // Switch back to AI mode locally
        const updatedChat = { ...selectedChat, mode: 'ai', status: 'closed' };
        setSelectedChat(updatedChat);
        setConversations(prev => prev.map(c => c.id === selectedChat.id ? updatedChat : c));
      }
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedChat) return;
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    try {
        await fetch(`${apiUrl}/api/conversations/${selectedChat.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "System: Agent claimed conversation",
                business_id: businessId,
                agent_id: currentUser.id
            })
        });
        setSelectedChat({...selectedChat, assignedAgentId: currentUser.id, mode: 'human'});
    } catch (err) {
        console.error("Assign error:", err);
    }
  };

  const filteredConversations = conversations.filter(c => 
    filterDepartment === 'all' || (c.department && c.department.toLowerCase() === filterDepartment.toLowerCase())
  );

  if (loading) {
      return <Loader message="Opening Secure Channels..." />;
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-white rounded-lg shadow overflow-hidden relative">
      {/* Sidebar - Chat List */}
      <div className={`
        border-r border-grey-medium flex flex-col transition-all duration-300
        w-full md:w-1/3 
        ${selectedChat ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-4 border-b border-grey-medium flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-grey-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 border border-grey-medium rounded-lg focus:outline-none focus:border-navy"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
             <Filter size={14} className="text-grey-400 shrink-0" />
             <button 
                onClick={() => setFilterDepartment('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${filterDepartment === 'all' ? 'bg-navy text-white' : 'bg-grey-100 text-grey-600'}`}
             >
                All
             </button>
             {availableDepartments.map(dept => (
                <button 
                    key={dept}
                    onClick={() => setFilterDepartment(dept)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase whitespace-nowrap ${filterDepartment === dept ? 'bg-navy text-white' : 'bg-grey-100 text-grey-600'}`}
                >
                    {dept}
                </button>
             ))}
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {filteredConversations.length === 0 && <div className="p-4 text-center text-grey-500">No conversations matching filter.</div>}
          {filteredConversations.map(chat => (
            <div 
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b border-grey-light cursor-pointer hover:bg-grey-light transition-colors ${selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-navy' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-navy">{chat.customerName || chat.id}</h3>
                 {/* Format timestamp simply */}
                <span className="text-xs text-grey-500">
                    {safelyFormatDate(chat.lastTimestamp)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-grey-600 truncate max-w-[80%]">{chat.lastMessage}</p>
                 {chat.unread > 0 && (
                  <span className="bg-navy text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {chat.unread}
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${chat.platform === 'whatsapp' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {chat.platform || 'unknown'}
                 </span>
                  {chat.mode === 'human' && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                       Human Mode
                    </span>
                  )}
                  {chat.department && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-grey-100 text-grey-600">
                       {chat.department}
                    </span>
                  )}
                  {chat.status === 'waiting' && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 text-red-600 animate-pulse">
                       Waiting
                    </span>
                  )}
              </div>
              {chat.assignedAgentId && chat.assignedAgentId !== currentUser.id && (
                <div className="mt-1 text-[10px] text-grey-400">
                  Assigned to: {chat.assignedAgentId.split('-')[0]}...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`
        flex-col bg-grey-light
        w-full md:w-2/3
        ${selectedChat ? 'flex' : 'hidden md:flex'}
      `}>
        {selectedChat ? (
        <>
            {/* Chat Header */}
            <div className="p-3 md:p-4 border-b border-grey-medium flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Back Button for Mobile */}
                    <button 
                        onClick={() => setSelectedChat(null)}
                        className="md:hidden p-2 -ml-2 text-grey-600 hover:bg-grey-light rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>

                    <div className="w-8 h-8 md:w-10 md:h-10 bg-navy-light rounded-full flex items-center justify-center text-white shrink-0">
                        <User size={20} />
                    </div>
                    <div className="overflow-hidden">
                        <h2 className="font-bold text-navy truncate">{selectedChat.customerName || selectedChat.id}</h2>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-green-600 flex items-center gap-1">
                              ● Active
                          </span>
                          {selectedChat.mode === 'human' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">
                              AI Paused
                            </span>
                          )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 md:gap-2">
                    {selectedChat.mode === 'human' ? (
                       <button 
                         onClick={handleResolve}
                         className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors border border-green-200"
                       >
                         Resolve
                       </button>
                    ) : (
                      <button 
                        onClick={handleAssignToMe}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors border border-blue-200"
                      >
                        <UserCheck size={16} /> Assign to Me
                      </button>
                    )}
                    <button className="p-2 hover:bg-grey-light rounded-full text-grey-600" title="Transfer">
                        <Share2 size={20} />
                    </button>
                    <button className="p-2 hover:bg-grey-light rounded-full text-grey-600">
                        <Phone size={20} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-lg shadow-sm ${
                            msg.sender === 'customer' 
                                ? 'bg-white text-navy rounded-tl-none' 
                                : msg.sender === 'agent'
                                    ? 'bg-navy text-white rounded-tr-none'
                                    : 'bg-blue-100 text-navy-dark rounded-tr-none border border-blue-200' // Bot
                        }`}>
                            <p className="text-sm md:text-base">{msg.text}</p>
                            <div className={`text-[10px] mt-1 text-right ${msg.sender === 'agent' ? 'text-blue-200' : 'text-grey-400'}`}>
                                {safelyFormatDate(msg.timestamp)}
                                {msg.sender === 'bot' && ' (AI)'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-white border-t border-grey-medium">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 p-3 border border-grey-medium rounded-lg focus:outline-none focus:border-navy"
                    />
                    <button type="submit" className="bg-navy hover:bg-navy-light text-white p-3 rounded-lg transition-colors">
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-grey-500 bg-grey-50">
                <div className="text-center">
                     <p className="hidden md:block">Select a conversation to start chatting</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
