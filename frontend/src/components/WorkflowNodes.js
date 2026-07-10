import React from 'react';
import { Handle, Position } from 'reactflow';
import { 
    MessageSquare, Ticket, User, GitBranch, Clock, Brain, 
    Zap, Globe, DollarSign, ShoppingCart, Percent, Box, Target 
} from 'lucide-react';

const getNodeIcon = (type, label) => {
    const l = label ? label.toLowerCase() : '';
    if (type === 'start') return <Zap size={16} className="text-white" />;
    if (type === 'sales_trigger') return <DollarSign size={16} className="text-white" />;
    if (l.includes('ticket')) return <Ticket size={16} className="text-white" />;
    if (l.includes('agent')) return <User size={16} className="text-white" />;
    if (l.includes('offer')) return <ShoppingCart size={16} className="text-white" />;
    if (l.includes('discount')) return <Percent size={16} className="text-white" />;
    if (type === 'lead_capture' || l.includes('lead')) return <Target size={16} className="text-white" />;
    if (type === 'condition') return <GitBranch size={16} className="text-white" />;
    if (type === 'time_delay' || type === 'wait_for_reply') return <Clock size={16} className="text-white" />;
    if (type === 'ai_inference' || type === 'ai_extract') return <Brain size={16} className="text-white" />;
    if (type === 'http_request') return <Globe size={16} className="text-white" />;
    return <MessageSquare size={16} className="text-white" />;
};

const getNodeColors = (type) => {
    switch (type) {
        case 'start':
        case 'sales_trigger':
            return { color: 'green', gradient: 'from-green-500 to-emerald-600' };
        case 'action':
            return { color: 'blue', gradient: 'from-blue-500 to-indigo-600' };
        case 'lead_capture':
            return { color: 'pink', gradient: 'from-pink-500 to-rose-600' };
        case 'condition':
        case 'time_delay':
        case 'wait_for_reply':
            return { color: 'orange', gradient: 'from-orange-500 to-amber-600' };
        case 'ai_inference':
        case 'ai_extract':
        case 'http_request':
            return { color: 'purple', gradient: 'from-purple-500 to-violet-600' };
        default:
            return { color: 'gray', gradient: 'from-gray-500 to-slate-600' };
    }
};

export const CustomNode = ({ data, isConnectable }) => {
    const type = data.backendType || 'action';
    const label = data.label || 'Node';
    const colors = getNodeColors(type);

    return (
        <div className={`w-[220px] rounded-xl shadow-lg border border-gray-100 bg-white/90 backdrop-blur-md transition-all hover:shadow-xl hover:-translate-y-0.5 overflow-hidden group`}>
            {/* Header Gradient */}
            <div className={`h-2 w-full bg-gradient-to-r ${colors.gradient}`} />
            
            <div className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-inner`}>
                    {getNodeIcon(type, label)}
                </div>
                
                <div className="flex-1">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5" style={{ fontSize: '10px' }}>
                        {type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-bold text-gray-800 leading-tight">
                        {label}
                    </div>
                </div>
            </div>

            {/* Input Handle */}
            {type !== 'start' && type !== 'sales_trigger' && (
                <Handle
                    type="target"
                    position={Position.Top}
                    isConnectable={isConnectable}
                    className="w-3 h-3 border-2 border-white bg-gray-400 shadow-sm transition-transform group-hover:scale-125"
                />
            )}

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className={`w-3 h-3 border-2 border-white shadow-sm transition-transform group-hover:scale-125 ${
                    colors.color === 'green' ? 'bg-green-500' : 
                    colors.color === 'blue' ? 'bg-blue-500' :
                    colors.color === 'pink' ? 'bg-pink-500' :
                    colors.color === 'orange' ? 'bg-orange-500' :
                    colors.color === 'purple' ? 'bg-purple-500' : 'bg-gray-500'
                }`}
            />
        </div>
    );
};
