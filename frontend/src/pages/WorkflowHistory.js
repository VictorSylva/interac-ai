import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

export default function WorkflowHistory() {
    const { id } = useParams(); // workflow_id
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedExec, setExpandedExec] = useState(null);

    const fetchHistory = useCallback(async () => {
        const businessId = currentUser?.business_id || currentUser?.email || "default";
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            let url = `${apiUrl}/api/executions?business_id=${businessId}`;
            if (id) {
                url += `&workflow_id=${id}`;
            }
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setExecutions(data);
            }
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }, [id, currentUser]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const toggleExpand = (execId) => {
        if (expandedExec === execId) {
            setExpandedExec(null);
        } else {
            setExpandedExec(execId);
        }
    };

    if (loading) return <div className="p-8">Loading History...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-navy">Execution History</h1>
                    <p className="text-gray-600">
                        {id ? `Showing logs for Workflow: ${id}` : "All recent workflow executions"}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 p-4 text-sm font-medium text-gray-500">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Status</div>
                    <div className="col-span-4">Trigger</div>
                    <div className="col-span-4">Time</div>
                </div>

                {executions.length === 0 && (
                     <div className="p-8 text-center text-gray-500">No executions found.</div>
                )}

                {executions.map((exec) => (
                    <div key={exec.id} className="border-b border-gray-100 last:border-0">
                        <div 
                            onClick={() => toggleExpand(exec.id)}
                            className="grid grid-cols-12 p-4 items-center hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <div className="col-span-1 text-gray-400">
                                {expandedExec === exec.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                                {exec.status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
                                {exec.status === 'running' && <Clock size={16} className="text-blue-500 animate-pulse" />}
                                {exec.status === 'failed' && <XCircle size={16} className="text-red-500" />}
                                <span className={`capitalize text-sm font-medium ${
                                    exec.status === 'completed' ? 'text-green-700' :
                                    exec.status === 'failed' ? 'text-red-700' : 'text-blue-700'
                                }`}>
                                    {exec.status}
                                </span>
                            </div>
                            <div className="col-span-4 text-sm text-gray-600 truncate">
                                {JSON.stringify(exec.trigger_event || {})}
                            </div>
                            <div className="col-span-4 text-sm text-gray-500">
                                {new Date(exec.started_at).toLocaleString()}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedExec === exec.id && (
                            <div className="bg-gray-50 p-6 border-t border-gray-100 space-y-4">
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Trigger Data</h4>
                                    <pre className="bg-white p-3 rounded border text-xs overflow-auto">
                                        {JSON.stringify(exec.trigger_event, null, 2)}
                                    </pre>
                                </div>
                                
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Final Context</h4>
                                    <pre className="bg-white p-3 rounded border text-xs overflow-auto">
                                        {JSON.stringify(exec.context_data, null, 2)}
                                    </pre>
                                </div>

                                {exec.error_message && (
                                    <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
                                        <strong>Error:</strong> {exec.error_message}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
