import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import {
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  DollarSign,
  Tag,
  X,
  Filter,
  ChevronRight,
  Send,
  Trash2,
} from "lucide-react";
import Loader from "../components/Loader";

export default function Leads() {
  const { currentUser } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [leadAppointments, setLeadAppointments] = useState([]);

  useEffect(() => {
    if (currentUser) {
      const bid = currentUser.business_id || currentUser.email || "default";
      if (bid) {
        fetchLeads(bid);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const getAuthHeaders = (includeJson = true) => {
    let token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
    if (!token) {
      try {
        const user = JSON.parse(localStorage.getItem('interact_user') || '{}');
        token = user.token || user.access_token;
      } catch (e) {}
    }
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchLeads = async (bid) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${API_BASE_URL}/api/leads?business_id=${encodeURIComponent(bid)}`, {
        signal: controller.signal,
        headers: getAuthHeaders(false),
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const validLeads = Array.isArray(data) 
        ? data.filter(l => l && (l.name || l.phone || l.email || l.contact || (l.tags && l.tags.length > 0))) 
        : [];
      setLeads(validLeads);
    } catch (err) {
      if (err.name !== 'AbortError') {
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadActivities = async (leadId) => {
    const bid = currentUser.business_id || currentUser.email || "default";
    setLoadingActivities(true);
    try {
      const [activityRes, aptRes] = await Promise.all([
        fetch(
          `${API_BASE_URL}/api/leads/${leadId}/activity?business_id=${encodeURIComponent(bid)}`,
          { headers: getAuthHeaders(false) }
        ),
        fetch(
          `${API_BASE_URL}/api/scheduling/appointments?business_id=${encodeURIComponent(bid)}&lead_id=${leadId}`,
          { headers: getAuthHeaders(false) }
        ),
      ]);

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(Array.isArray(activityData) ? activityData : []);
      }
      if (aptRes.ok) {
        const aptData = await aptRes.json();
        setLeadAppointments(Array.isArray(aptData) ? aptData : []);
      }
    } catch (err) {
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    fetchLeadActivities(lead.id);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedLead) return;

    const bid = currentUser.business_id || currentUser.email || "default";

    // Optimistic update
    const oldStatus = selectedLead.status;
    setSelectedLead({ ...selectedLead, status: newStatus });

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/leads/${selectedLead.id}?business_id=${encodeURIComponent(bid)}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();

      setLeads(
        leads.map((l) =>
          l.id === selectedLead.id ? { ...l, status: updated.status } : l,
        ),
      );

      fetchLeadActivities(selectedLead.id);
    } catch (err) {
      setSelectedLead({ ...selectedLead, status: oldStatus });
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedLead) return;

    const bid = currentUser.business_id || currentUser.email || "default";
    setSendingMessage(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/leads/${selectedLead.id}/message?business_id=${encodeURIComponent(bid)}`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            message: messageText,
            user_id: currentUser.id || "agent",
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to send message");

      setMessageText("");
      fetchLeadActivities(selectedLead.id);
    } catch (err) {
      alert("Failed to send message. Please try again.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Are you sure you want to delete this lead record?")) return;
    const bid = currentUser.business_id || currentUser.email || "default";
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/leads/${leadId}?business_id=${encodeURIComponent(bid)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(false),
        }
      );
      if (!res.ok) throw new Error("Failed to delete lead");
      setLeads(leads.filter((l) => l.id !== leadId));
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
      }
    } catch (err) {
      alert("Failed to delete lead: " + err.message);
    }
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      qualified: "bg-green-100 text-green-800",
      converted: "bg-purple-100 text-purple-800",
      unqualified: "bg-grey-200 text-grey-600",
    };
    const colorClass =
      colors[status?.toLowerCase()] || "bg-grey-100 text-grey-800";

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${colorClass}`}
      >
        {status || "New"}
      </span>
    );
  };

  const filteredLeads = leads.filter(
    (l) => filterStatus === "all" || l.status?.toLowerCase() === filterStatus,
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-grey-light relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-navy mb-2">
              Leads & Opportunities
            </h1>
            <p className="text-grey-600">
              Manage and track your potential customers.
            </p>
          </div>
          <div className="flex gap-4">
            <select
              className="bg-white border border-grey-300 text-grey-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-grey-medium overflow-hidden">
          {/* Desktop Table View - Hidden on smaller screens */}
          <table className="w-full hidden lg:table">
            <thead className="bg-grey-50">
              <tr className="text-left text-xs font-bold text-grey-500 uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Value</th>
                <th className="p-4">Captured</th>
                <th className="p-4">AI Score</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12">
                    <Loader message="Retrieving prospects..." />
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-grey-500">
                    <div className="flex flex-col items-center gap-2">
                      <User size={48} className="text-grey-300" />
                      <p>No leads found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleLeadClick(lead)}
                    className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedLead?.id === lead.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold">
                          {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                          <p className="font-medium text-navy">
                            {lead.name || "Unknown Visitor"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-grey-500 mt-0.5">
                            {lead.email ? (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {lead.email}
                              </span>
                            ) : lead.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {lead.phone}
                              </span>
                            ) : (
                              <span className="italic">No contact info</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="p-4">
                      {lead.value ? (
                        <div className="flex items-center gap-1 font-medium text-green-700">
                          <DollarSign size={14} />
                          {lead.value.toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-grey-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-grey-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {lead.source === 'landing_demo' && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest border border-indigo-200">
                            Demo
                          </span>
                        )}
                        {lead.tags && lead.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                        {lead.ai_tier && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              lead.ai_tier === "hot"
                                ? "bg-red-100 text-red-700"
                                : lead.ai_tier === "warm"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {lead.ai_tier.toUpperCase()} ({lead.ai_score})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right text-grey-400">
                      <ChevronRight size={18} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Card View - Visible on LG and smaller */}
          <div className="lg:hidden divide-y divide-grey-100">
            {loading ? (
              <div className="p-8">
                <Loader message="Retrieving prospects..." />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-grey-500">
                <div className="flex flex-col items-center gap-2">
                  <User size={48} className="text-grey-300" />
                  <p>No leads found.</p>
                </div>
              </div>
            ) : (
              filteredLeads.map((lead, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLeadClick(lead)}
                  className="p-4 active:bg-blue-50 cursor-pointer"
                >
                  {/* Header: Name & Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold">
                        {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div>
                        <p className="font-medium text-navy text-lg">
                          {lead.name || "Unknown Visitor"}
                        </p>
                        <p className="text-xs text-grey-500 flex items-center gap-1">
                          Captured:{" "}
                          {new Date(lead.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 ml-[52px]">
                    {/* Contact */}
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-grey-400 uppercase tracking-wider mb-0.5">
                        Contact
                      </p>
                      <div className="flex items-center gap-2 text-sm text-grey-700">
                        {lead.email ? (
                          <>
                            <Mail size={14} className="text-grey-400" />{" "}
                            <span className="truncate">{lead.email}</span>
                          </>
                        ) : lead.phone ? (
                          <>
                            <Phone size={14} className="text-grey-400" />{" "}
                            {lead.phone}
                          </>
                        ) : (
                          <span className="text-grey-400 italic">
                            No contact info
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Value */}
                    <div>
                      <p className="text-[10px] font-bold text-grey-400 uppercase tracking-wider mb-0.5">
                        Est. Value
                      </p>
                      <div className="flex items-center gap-1 text-sm font-medium text-green-700">
                        <DollarSign size={14} />
                        {lead.value ? lead.value.toLocaleString() : "0"}
                      </div>
                    </div>

                    {/* AI Score */}
                    <div>
                      <p className="text-[10px] font-bold text-grey-400 uppercase tracking-wider mb-0.5">
                        AI Insight
                      </p>
                      {lead.ai_tier ? (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded textxs font-bold ${
                            lead.ai_tier === "hot"
                              ? "bg-red-100 text-red-700"
                              : lead.ai_tier === "warm"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {lead.ai_tier.toUpperCase()} ({lead.ai_score})
                        </span>
                      ) : (
                        <span className="text-xs text-grey-400 italic">
                          Pending...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                      View Details <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Lead Detail Drawer - Responsive Width */}
      <div
        className={`
                fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl border-l border-grey-200 transform transition-transform duration-300 ease-in-out z-50
                ${selectedLead ? "translate-x-0" : "translate-x-full"}
            `}
      >
        {selectedLead && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-grey-100 flex justify-between items-start bg-grey-50">
              <div>
                <h2 className="text-xl font-bold text-navy">
                  {selectedLead.name}
                </h2>
                <p className="text-sm text-grey-500 flex items-center gap-1 mt-1">
                  Created{" "}
                  {new Date(selectedLead.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteLead(selectedLead.id)}
                  title="Delete Lead"
                  className="p-2 hover:bg-red-50 rounded-full text-grey-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-2 hover:bg-grey-200 rounded-full text-grey-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Status Section */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                    Current Status
                  </span>
                  <StatusBadge status={selectedLead.status} />
                </div>
                <div className="mt-4">
                  <label className="text-xs text-grey-500">Change Status</label>
                  <select
                    className="mt-1 block w-full bg-white border border-blue-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={selectedLead.status || "new"}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="unqualified">Unqualified</option>
                  </select>
                </div>
              </div>

              {/* Business Details (from Landing Demo) */}
              {(selectedLead.custom_fields?.company_name || selectedLead.custom_fields?.industry) && (
                <div>
                  <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-4 border-b border-grey-100 pb-2">
                    Business Details
                  </h3>
                  <div className="space-y-4">
                    {selectedLead.custom_fields?.company_name && (
                      <div>
                        <p className="text-[10px] font-bold text-grey-400 uppercase">Company</p>
                        <p className="text-sm text-navy font-bold">{selectedLead.custom_fields.company_name}</p>
                      </div>
                    )}
                    {selectedLead.custom_fields?.role && (
                      <div>
                        <p className="text-[10px] font-bold text-grey-400 uppercase">Role</p>
                        <p className="text-sm text-navy">{selectedLead.custom_fields.role}</p>
                      </div>
                    )}
                    {selectedLead.custom_fields?.industry && (
                      <div>
                        <p className="text-[10px] font-bold text-grey-400 uppercase">Industry</p>
                        <p className="text-sm text-navy capitalize">{selectedLead.custom_fields.industry}</p>
                      </div>
                    )}
                    {selectedLead.custom_fields?.automation_goals && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-bold text-grey-400 uppercase mb-1">Automation Goals</p>
                        <p className="text-xs text-slate-600 italic">"{selectedLead.custom_fields.automation_goals}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-4 border-b border-grey-100 pb-2">
                  Contact Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-grey-700">
                    <div className="w-8 h-8 rounded-full bg-grey-100 flex items-center justify-center text-grey-500">
                      <Mail size={16} />
                    </div>
                    <span>{selectedLead.email || "No email provided"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-grey-700">
                    <div className="w-8 h-8 rounded-full bg-grey-100 flex items-center justify-center text-grey-500">
                      <Phone size={16} />
                    </div>
                    <span>{selectedLead.phone || "No phone provided"}</span>
                  </div>
                </div>
              </div>

              {/* Appointments Section */}
              <div>
                <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-4 border-b border-grey-100 pb-2 flex justify-between items-center">
                  <span>Appointments</span>
                  {leadAppointments && leadAppointments.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full">
                      {leadAppointments.length}
                    </span>
                  )}
                </h3>
                {!leadAppointments || leadAppointments.length === 0 ? (
                  <p className="text-sm text-grey-400 italic">
                    No appointments scheduled.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leadAppointments.map((apt, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-grey-50 rounded border border-grey-100"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-navy text-xs uppercase">
                            Confirmed Appointment
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${apt.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}
                          >
                            {apt.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-grey-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-blue-500" />
                            {new Date(apt.start_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-blue-500" />
                            {new Date(apt.start_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-4 border-b border-grey-100 pb-2">
                  Activity Timeline
                </h3>
                {loadingActivities ? (
                  <p className="text-sm text-grey-400 italic">
                    Loading activities...
                  </p>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-grey-400 italic">
                    No activity yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="font-medium text-navy">
                            {activity.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-grey-500 mt-1">
                            {JSON.stringify(activity.content)}
                          </p>
                          <p className="text-xs text-grey-400 mt-1">
                            {new Date(activity.created_at).toLocaleString()} by{" "}
                            {activity.created_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Message Composer */}
            <div className="p-4 border-t border-grey-200 bg-grey-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={sendingMessage}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={16} />
                  {sendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
