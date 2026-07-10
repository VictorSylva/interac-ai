import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, MessageSquare, Globe, ArrowRight, Mail, Ticket, UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

export default function Automations() {
    const { currentUser } = useAuth();
    const [automations, setAutomations] = useState([]);
    const [showBuilder, setShowBuilder] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState('keyword');
    const [triggerValue, setTriggerValue] = useState('');
    const [actionType, setActionType] = useState('reply');
    const [actionTemplate, setActionTemplate] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');

    useEffect(() => {
        fetchAutomations();
    }, [currentUser]);

    const fetchAutomations = () => {
        const businessId = currentUser ? currentUser.email : "default";
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        fetch(`${apiUrl}/api/automations?business_id=${encodeURIComponent(businessId)}`, {
            signal: controller.signal
        })
            .then(res => {
                clearTimeout(timeoutId);
                return res.json();
            })
            .then(data => {
                setAutomations(data);
                setLoading(false);
            })
            .catch(err => {
                setLoading(false);
            });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const businessId = currentUser ? currentUser.email : "default";
        
        const config = {};
        if (actionType === 'reply') config.template = actionTemplate;
        else if (actionType === 'webhook') config.webhook_url = webhookUrl;
        else if (actionType === 'email') config.to_email = actionTemplate;
        else if (actionType === 'create_ticket') config.priority = 'medium';

        const rule = {
            name,
            trigger: {
                type: triggerType,
                value: triggerValue
            },
            action: {
                type: actionType,
                config
            },
            active: true,
            business_id: businessId
        };

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            await fetch(`${apiUrl}/api/automations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule)
            });
            setShowBuilder(false);
            resetForm();
            fetchAutomations();
        } catch (error) {
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this automation?")) return;
        const businessId = currentUser ? currentUser.email : "default";
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            await fetch(`${apiUrl}/api/automations/${id}?business_id=${encodeURIComponent(businessId)}`, { method: 'DELETE' });
            fetchAutomations();
        } catch (error) {
        }
    };

    const resetForm = () => {
        setName('');
        setTriggerType('keyword');
        setTriggerValue('');
        setActionType('reply');
        setActionTemplate('');
        setWebhookUrl('');
    };

    if (loading) return <Loader message="Indexing Automations..." />;


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-navy">Automations</h1>
                <button 
                    onClick={() => setShowBuilder(true)}
                    className="bg-navy hover:bg-navy-light text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <Plus size={20} />
                    New Automation
                </button>
            </div>

            {/* Builder Modal / Inline Form */}
            {showBuilder && (
                <div className="bg-white p-6 rounded-lg shadow border border-grey-medium mb-6 animate-fade-in-up">
                    <h2 className="text-xl font-bold mb-4">Create New Automation</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Automation Name</label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full p-2 border border-grey-medium rounded"
                                required 
                                placeholder="e.g., Auto Reply to Price"
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            {/* Trigger Section */}
                            <div className="flex-1 w-full bg-grey-light p-4 rounded">
                                <h3 className="font-semibold mb-2 flex items-center gap-2"><Zap size={18} /> Trigger</h3>
                                <select 
                                    value={triggerType} 
                                    onChange={e => setTriggerType(e.target.value)}
                                    className="w-full p-2 border border-grey-medium rounded mb-2"
                                >
                                    <option value="keyword">Keyword</option>
                                    <option value="intent">Intent</option>
                                    <option value="time_range">Time Range (e.g. Out of Office)</option>
                                </select>
                                <input 
                                    type="text"
                                    value={triggerValue}
                                    onChange={e => setTriggerValue(e.target.value)}
                                    placeholder={
                                        triggerType === 'keyword' ? "e.g., discount" : 
                                        triggerType === 'time_range' ? "HH:MM-HH:MM (e.g. 17:00-09:00)" :
                                        "e.g., pricing"
                                    }
                                    className="w-full p-2 border border-grey-medium rounded"
                                    required
                                />
                            </div>

                            <ArrowRight size={24} className="text-grey-400 hidden md:block" />

                            {/* Action Section */}
                            <div className="flex-1 w-full bg-grey-light p-4 rounded">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">Action</h3>
                                <select 
                                    value={actionType} 
                                    onChange={e => setActionType(e.target.value)}
                                    className="w-full p-2 border border-grey-medium rounded mb-2"
                                >
                                    <option value="reply">Send Reply</option>
                                    <option value="webhook">Call Webhook</option>
                                    <option value="email">Send Email Notification</option>
                                    <option value="create_ticket">Create Support Ticket</option>
                                    <option value="save_lead">Save as Lead</option>
                                </select>
                                
                                {actionType === 'reply' && (
                                    <textarea 
                                        value={actionTemplate}
                                        onChange={e => setActionTemplate(e.target.value)}
                                        placeholder="Enter reply message..."
                                        className="w-full p-2 border border-grey-medium rounded h-24"
                                        required
                                    />
                                )}

                                {actionType === 'webhook' && (
                                    <input 
                                        type="url"
                                        value={webhookUrl}
                                        onChange={e => setWebhookUrl(e.target.value)}
                                        placeholder="https://hooks.zapier.com/..."
                                        className="w-full p-2 border border-grey-medium rounded"
                                        required
                                    />
                                )}

                                {actionType === 'email' && (
                                    <input 
                                        type="email"
                                        value={actionTemplate} // Reusing template state for email address for simplicity
                                        onChange={e => setActionTemplate(e.target.value)}
                                        placeholder="notify@business.com"
                                        className="w-full p-2 border border-grey-medium rounded"
                                        required
                                    />
                                )}
                                
                                {(actionType === 'create_ticket' || actionType === 'save_lead') && (
                                     <div className="text-sm text-grey-600 italic p-2">
                                        Action will run automatically. No config needed.
                                     </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button 
                                type="button" 
                                onClick={() => setShowBuilder(false)}
                                className="px-4 py-2 text-grey-600 hover:bg-grey-light rounded"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                Create Automation
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {automations.map(rule => (
                    <div key={rule.id} className="bg-white p-4 rounded-lg shadow border border-grey-medium hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{rule.name}</h3>
                            <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs uppercase font-bold">When</span>
                                <span className="font-mono">{rule.trigger.type}: "{rule.trigger.value}"</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs uppercase font-bold">Then</span>
                                {rule.action.type === 'reply' ? (
                                    <div className="flex items-center gap-1">
                                        <MessageSquare size={14} /> 
                                        <span className="truncate max-w-[150px]">Reply</span>
                                    </div>

                                ) : rule.action.type === 'email' ? (
                                    <div className="flex items-center gap-1">
                                        <Mail size={14} />
                                        <span className="truncate max-w-[150px]">Email</span>
                                    </div>
                                ) : rule.action.type === 'create_ticket' ? (
                                    <div className="flex items-center gap-1">
                                        <Ticket size={14} />
                                        <span className="truncate max-w-[150px]">Ticket</span>
                                    </div>
                                ) : rule.action.type === 'save_lead' ? (
                                    <div className="flex items-center gap-1">
                                        <UserPlus size={14} />
                                        <span className="truncate max-w-[150px]">Lead</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <Globe size={14} />
                                        <span className="truncate max-w-[150px]">Webhook</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
