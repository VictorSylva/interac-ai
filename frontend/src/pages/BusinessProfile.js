import React, { useState, useEffect } from "react";
import {
  Save,
  Building,
  FileText,
  MessageCircle,
  Clock,
  MapPin,
  Zap,
  Trash2,
  Globe,
  Upload,
  Users,
  Shield,
  Copy,
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/Loader";

export default function BusinessProfile() {
  const { currentUser, activeDept, activeRole, setLocalPreview, clearLocalPreview } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [profileSaved, setProfileSaved] = useState(false);

  // Enterprise IAM states
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviteDept, setInviteDept] = useState("general");
  const [inviteProp, setInviteProp] = useState("");
  const [newPropName, setNewPropName] = useState("");
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");

  const handleUpdateProfile = (dept, role) => {
    setProfileSaved(false);
    try {
      setLocalPreview(dept, role);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error("Error updating preview profile:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Error fetching users:", e);
    }
  };

  const fetchInvitations = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (e) {
      console.error("Error fetching invitations:", e);
    }
  };

  const fetchProperties = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/properties`);
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch (e) {
      console.error("Error fetching properties:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/login-history`);
      if (res.ok) {
        const data = await res.json();
        setLoginLogs(data);
      }
    } catch (e) {
      console.error("Error fetching audit logs:", e);
    }
  };

  useEffect(() => {
    if (activeSettingsTab === "iam") {
      fetchUsers();
      fetchInvitations();
      fetchProperties();
    } else if (activeSettingsTab === "properties") {
      fetchProperties();
    } else if (activeSettingsTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeSettingsTab]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          department: inviteDept,
          property_id: inviteProp || null
        })
      });
      if (res.ok) {
        alert("Employee invitation email sent!");
        setInviteEmail("");
        fetchInvitations();
      } else {
        const err = await res.json();
        alert(`Failed to send invite: ${err.detail || 'Unknown error'}`);
      }
    } catch (error) {
      alert("Error sending invitation.");
    }
  };

  const handleCancelInvite = async (inviteId) => {
    if (!window.confirm("Cancel this invitation?")) return;
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/invitations/${inviteId}/cancel`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Invitation cancelled!");
        fetchInvitations();
      }
    } catch (error) {
      alert("Error cancelling invitation.");
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(`Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'reactivate'} this employee account?`)) return;
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/users/${userId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        alert(`Employee status updated to ${newStatus}!`);
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Failed to update status: ${err.detail}`);
      }
    } catch (error) {
      alert("Error updating user status.");
    }
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    if (!newPropName) return;
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPropName })
      });
      if (res.ok) {
        alert("Property/Branch created!");
        setNewPropName("");
        fetchProperties();
      }
    } catch (error) {
      alert("Error creating property.");
    }
  };

  const [form, setForm] = useState({
    name: "",
    industry: "retail",
    description: "",
    services: "",
    tone: "friendly",
    faq: "",
    custom_instructions: "",
    location: "",
    hours: "",
    auto_escalate_on_keyword: false,
    departments: ["sales", "support", "billing", "general"],
  });

  useEffect(() => {
    fetchProfile();
    fetchKnowledge();
  }, [currentUser]);

  const fetchKnowledge = async () => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(
        `${apiUrl}/api/knowledge?business_id=${encodeURIComponent(businessId)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch knowledge");
      const data = await res.json();
      setKnowledgeDocs(Array.isArray(data) ? data : []);
    } catch (error) {
    }
  };

  const fetchProfile = async () => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `${apiUrl}/api/business-profile?business_id=${encodeURIComponent(
          businessId,
        )}`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        setForm((prev) => ({ ...prev, ...data }));
      }
      setLoading(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
      }
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const businessId =
      currentUser?.business_id || currentUser?.email || "default";

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/business-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, business_id: businessId }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || "Save failed");
      }

      alert("Profile saved successfully!");
    } catch (error) {
      const detail = error.message;
      const displayError =
        typeof detail === "object" ? JSON.stringify(detail) : detail;
      alert(`Failed to save profile: ${displayError}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTrain = async () => {
    if (
      !window.confirm(
        "Start AI Training? This will analyze your last 50 conversations.",
      )
    )
      return;
    const businessId =
      currentUser?.business_id || currentUser?.email || "default";
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiUrl}/api/train/${encodeURIComponent(businessId)}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Training failed on server");
      const data = await res.json();
      alert(`Training result: ${data.status}`);
    } catch (error) {
      alert("Training process encountered an error.");
    }
  };

  if (loading) return <Loader message="Accessing Business Engine..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Business Profile</h1>
          <div className="flex items-center gap-2 text-sm text-grey-500 mt-1">
            <span>ID: {currentUser?.business_id}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentUser?.business_id);
                alert("Business ID copied!");
              }}
              className="text-blue-500 hover:text-blue-700 underline"
            >
              Copy for Widget
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTrain}
            className="bg-white border border-navy text-navy hover:bg-navy-light hover:text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Zap size={18} />
            Train AI
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-navy hover:bg-navy-light text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-grey-light overflow-hidden">
        {/* Tab Header Selector */}
        <div className="flex border-b border-grey-light bg-grey-50 px-6 pt-4 space-x-6">
          <button
            type="button"
            onClick={() => setActiveSettingsTab("profile")}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeSettingsTab === "profile" ? "border-navy text-navy" : "border-transparent text-grey-500 hover:text-navy"}`}
          >
            Business Profile
          </button>
          {(currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <>
              <button
                type="button"
                onClick={() => setActiveSettingsTab("iam")}
                className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeSettingsTab === "iam" ? "border-navy text-navy" : "border-transparent text-grey-500 hover:text-navy"}`}
              >
                Employee & IAM
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab("properties")}
                className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeSettingsTab === "properties" ? "border-navy text-navy" : "border-transparent text-grey-500 hover:text-navy"}`}
              >
                Branches & Properties
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab("audit")}
                className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeSettingsTab === "audit" ? "border-navy text-navy" : "border-transparent text-grey-500 hover:text-navy"}`}
              >
                Security Audit Logs
              </button>
            </>
          )}
        </div>

        <div className="p-6 space-y-6">
          {activeSettingsTab === "profile" && (
            <div className="space-y-6">
          {/* User Workspace Department and Role Switcher (ONLY for database owner/admin) */}
          {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
            <Section title="Personal Workspace Department & Role Settings" icon={Zap}>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4 mb-2">
                <p className="text-xs text-slate-600">
                  Switch your active department workspace or role tier to preview InteracAI's multi-tenant RBAC (Role-Based Access Control) filters. Changing these options updates your permissions instantly.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Active Department Workspace
                    </label>
                    <select
                      value={activeDept}
                      onChange={(e) => handleUpdateProfile(e.target.value, activeRole)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:border-navy"
                    >
                      <option value="general">General (Full Base Access)</option>
                      <option value="reception">Reception / Front Desk (Hotels, Hospital EHR)</option>
                      <option value="security">Security & Surveillance (ALPR, CCTV, Guard Patrols)</option>
                      <option value="finance">Finance & Billing (POS, Invoices, IRS Tax Audits)</option>
                      <option value="counselor">Counselor (Education Attendance Risk)</option>
                      <option value="operator">Operator (Manufacturing Shopfloor OEE)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Active Role Tier
                    </label>
                    <select
                      value={activeRole}
                      onChange={(e) => handleUpdateProfile(activeDept, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:border-navy"
                    >
                      <option value="owner">Owner / Administrator (Full Dashboard & Settings)</option>
                      <option value="admin">Department Manager</option>
                      <option value="support_agent">Supervisor</option>
                      <option value="agent">Staff / Officer (Standard Operational Access)</option>
                      <option value="viewer">Viewer (Read-Only Views)</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <button
                    onClick={() => {
                      clearLocalPreview();
                      setProfileSaved(true);
                      setTimeout(() => setProfileSaved(false), 2000);
                    }}
                    className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold flex items-center gap-1 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 w-fit"
                  >
                    Reset Preview to Database Default
                  </button>
                  {profileSaved && (
                    <div className="text-xs font-bold text-emerald-600 animate-pulse">
                      Workspace preferences updated successfully! Reloading permissions...
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          <Divider />

          {/* Basic Info */}
          <Section title="Basic Information" icon={Building}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Acme Corp"
              />
              <Input
                label="Industry"
                name="industry"
                value={form.industry}
                onChange={handleChange}
                placeholder="e.g. Real Estate, Retail"
              />
              <div className="md:col-span-2">
                <TextArea
                  label="Short Description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Briefly describe what your business does..."
                  rows={2}
                />
              </div>
            </div>
          </Section>

          <Divider />

          {/* Services */}
          <Section title="Services & Offerings" icon={FileText}>
            <TextArea
              label="Services Offered (One per line)"
              name="services"
              value={form.services}
              onChange={handleChange}
              placeholder="- Web Design&#10;- SEO Optimization&#10;- Branding"
              rows={4}
            />
          </Section>

          <Divider />

          <KnowledgeBase
            docs={knowledgeDocs}
            refresh={fetchKnowledge}
            businessId={
              currentUser?.business_id || currentUser?.email || "default"
            }
          />

          <Divider />

          {/* AI Persona */}
          <Section title="AI Persona & Knowledge" icon={MessageCircle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-grey-700 mb-1">
                  Communication Tone
                </label>
                <select
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className="w-full p-2 border border-grey-medium rounded-lg text-navy focus:outline-none focus:border-navy"
                >
                  <option value="formal">Formal & Professional</option>
                  <option value="friendly">Friendly & Casual</option>
                  <option value="direct">Direct & Concise</option>
                  <option value="enthusiastic">Enthusiastic & Energetic</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <TextArea
                  label="Frequently Asked Questions (FAQ)"
                  name="faq"
                  value={form.faq}
                  onChange={handleChange}
                  placeholder="Q: What is your return policy?&#10;A: 30 days money back...&#10;&#10;Q: Do you ship internationally?&#10;A: Yes, we do."
                  rows={6}
                />
                <p className="text-xs text-grey-500 mt-1">
                  The AI will use this knowledge to answer customer questions.
                </p>
              </div>
              <div className="md:col-span-2">
                <TextArea
                  label="Custom System Instructions (Advanced)"
                  name="custom_instructions"
                  value={form.custom_instructions}
                  onChange={handleChange}
                  placeholder="e.g. Always end messages with 'Have a great day!'. Never mention competitor X."
                  rows={3}
                />
                <p className="text-xs text-grey-500 mt-1">
                  Specific rules for the AI behavior.
                </p>
              </div>
              
              <div className="md:col-span-2 flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <input
                  type="checkbox"
                  id="auto_escalate_on_keyword"
                  name="auto_escalate_on_keyword"
                  checked={form.auto_escalate_on_keyword}
                  onChange={(e) => setForm({ ...form, auto_escalate_on_keyword: e.target.checked })}
                  className="w-4 h-4 text-navy rounded border-grey-300 focus:ring-navy"
                />
                <label htmlFor="auto_escalate_on_keyword" className="flex-1">
                  <span className="block text-sm font-bold text-navy">Auto-escalate on handover keywords</span>
                  <span className="block text-xs text-navy/70">Automatically transfer to human if user says "human", "agent", etc.</span>
                </label>
                <div className="text-[10px] bg-navy text-white px-2 py-0.5 rounded font-bold uppercase">PRO</div>
              </div>
            </div>
          </Section>

          <Divider />

          {/* Operations */}
          <Section title="Operations" icon={Clock}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Location / Address"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. 123 Main St, New York"
                icon={MapPin}
              />
              <Input
                label="Operating Hours"
                name="hours"
                value={form.hours}
                onChange={handleChange}
                placeholder="e.g. Mon-Fri 9am-5pm"
              />
            </div>
          </Section>

          <Divider />

          {/* Departments */}
          <Section title="Departments" icon={Zap}>
            <div className="space-y-4">
              <p className="text-sm text-grey-600">
                Define the departments in your business. These will be used for routing conversations and filtering.
              </p>
              <div className="flex flex-wrap gap-2">
                {form.departments?.map((dept, idx) => (
                  <div key={idx} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-navy rounded-full border border-blue-200 text-sm font-semibold group">
                    <span className="capitalize">{dept}</span>
                    <button 
                      type="button"
                      onClick={() => setForm({...form, departments: form.departments.filter((_, i) => i !== idx)})}
                      className="text-grey-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => {
                    const newDept = prompt("Enter department name:");
                    if (newDept && !form.departments.includes(newDept.toLowerCase())) {
                      setForm({...form, departments: [...form.departments, newDept.toLowerCase().trim()]});
                    }
                  }}
                  className="px-3 py-1 border border-dashed border-grey-medium rounded-full text-sm text-grey-500 hover:border-navy hover:text-navy transition-colors"
                >
                  + Add Dept
                </button>
              </div>
            </div>
          </Section>
          <Section title="Website Integration" icon={Globe}>
            <div className="space-y-6">
              <p className="text-sm text-grey-600">
                Copy and paste these snippets into your website's <code>&lt;head&gt;</code> or before the closing <code>&lt;/body&gt;</code> tag to enable InteracAI features.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-navy mb-2 flex items-center gap-2">
                    <MessageCircle size={16} /> Chat Widget Snippet
                  </h4>
                  <div className="relative group">
                    <pre className="bg-navy text-blue-100 p-4 rounded-lg text-xs overflow-x-auto border border-white/10 font-mono">
{`<script src="https://interractai.web.app/interractai.js"></script>
<script>
  window.InterractAI_Config = {
    businessId: "${currentUser?.business_id || 'YOUR_BUSINESS_ID'}"
  };
</script>`}
                    </pre>
                    <button 
                      onClick={() => {
                        const code = `<script src="https://interractai.web.app/interractai.js"></script>\n<script>\n  window.InterractAI_Config = {\n    businessId: "${currentUser?.business_id || 'YOUR_BUSINESS_ID'}"\n  };\n</script>`;
                        navigator.clipboard.writeText(code);
                        alert("Chat Widget snippet copied!");
                      }}
                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                      title="Copy Code"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-navy mb-2 flex items-center gap-2">
                    <Zap size={16} className="text-blue-500" /> Behavior Analytics Snippet
                  </h4>
                  <div className="relative group">
                    <pre className="bg-navy text-blue-100 p-4 rounded-lg text-xs overflow-x-auto border border-white/10 font-mono">
{`<script src="https://interractai.web.app/ba_tracker.js"></script>
<script>
  initBATracker("${currentUser?.business_id || 'YOUR_BUSINESS_ID'}");
</script>`}
                    </pre>
                    <button 
                      onClick={() => {
                        const code = `<script src="https://interractai.web.app/ba_tracker.js"></script>\n<script>\n  initBATracker("${currentUser?.business_id || 'YOUR_BUSINESS_ID'}");\n</script>`;
                        navigator.clipboard.writeText(code);
                        alert("Analytics snippet copied!");
                      }}
                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                      title="Copy Code"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-grey-500 mt-1 italic">
                    Note: The tracker automatically captures pageviews, clicks, and engagement.
                  </p>
                </div>
              </div>
            </div>
          </Section>
          </div>
        )}

        {/* --- TAB 2: EMPLOYEE & IAM --- */}
        {activeSettingsTab === "iam" && (
          <div className="space-y-8">
            {/* Send Invitation Form */}
            <Section title="Invite New Employee" icon={Users}>
              <form onSubmit={handleSendInvite} className="bg-grey-50 p-6 rounded-2xl border border-grey-light space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-navy mb-1 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="employee@business.com"
                      className="w-full p-2 border border-grey-medium rounded-lg text-navy text-sm focus:outline-none focus:border-navy"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy mb-1 uppercase tracking-wider">Role Tier</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full p-2 border border-grey-medium rounded-lg text-navy text-sm bg-white focus:outline-none focus:border-navy"
                    >
                      <option value="receptionist">Receptionist / Frontdesk</option>
                      <option value="room_service">Room Service / Housekeeping</option>
                      <option value="restaurant_staff">Restaurant Server / Kitchen</option>
                      <option value="security_guard">Security Guard</option>
                      <option value="accounts_manager">Finance / Auditor</option>
                      <option value="general_manager">General Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy mb-1 uppercase tracking-wider">Department</label>
                    <select
                      value={inviteDept}
                      onChange={(e) => setInviteDept(e.target.value)}
                      className="w-full p-2 border border-grey-medium rounded-lg text-navy text-sm bg-white focus:outline-none focus:border-navy"
                    >
                      <option value="general">General</option>
                      <option value="reception">Reception / Front desk</option>
                      <option value="security">Security & Patrol</option>
                      <option value="finance">Finance & Accounts</option>
                      <option value="restaurant">Restaurant & Kitchen</option>
                      <option value="housekeeping">Housekeeping</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy mb-1 uppercase tracking-wider">Assign Branch/Hotel (Optional)</label>
                    <select
                      value={inviteProp}
                      onChange={(e) => setInviteProp(e.target.value)}
                      className="w-full p-2 border border-grey-medium rounded-lg text-navy text-sm bg-white focus:outline-none focus:border-navy"
                    >
                      <option value="">All Branches</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-navy hover:bg-navy-light text-white text-sm px-4 py-2 rounded-lg font-bold transition-all shadow-md"
                  >
                    Send Staff Invitation
                  </button>
                </div>
              </form>
            </Section>

            {/* Pending Invitations list */}
            <Section title="Pending Staff Invitations" icon={Clock}>
              <div className="bg-white border border-grey-light rounded-xl overflow-hidden">
                {invites.length > 0 ? (
                  <table className="w-full text-left text-sm text-grey-700">
                    <thead>
                      <tr className="bg-grey-50 border-b border-grey-light text-navy font-bold text-xs uppercase tracking-wider">
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-b border-grey-light hover:bg-grey-50 transition-colors">
                          <td className="p-4 font-medium text-navy">{inv.email}</td>
                          <td className="p-4 capitalize text-grey-600">{inv.role}</td>
                          <td className="p-4 capitalize text-grey-600">{inv.department}</td>
                          <td className="p-4 flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                const link = `${window.location.origin}/accept-invitation?token=${inv.id}`;
                                navigator.clipboard.writeText(link);
                                alert("Invitation link copied to clipboard!");
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1"
                              title="Copy activation link for employee"
                            >
                              <Copy size={14} /> Copy Link
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelInvite(inv.id)}
                              className="text-red-500 hover:text-red-700 font-semibold text-xs flex items-center gap-1"
                            >
                              <Trash2 size={14} /> Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-grey-500 text-sm">
                    No pending invitations.
                  </div>
                )}
              </div>
            </Section>

            {/* Current Employees management */}
            <Section title="Manage Employees" icon={Users}>
              <div className="bg-white border border-grey-light rounded-xl overflow-hidden">
                {users.length > 0 ? (
                  <table className="w-full text-left text-sm text-grey-700">
                    <thead>
                      <tr className="bg-grey-50 border-b border-grey-light text-navy font-bold text-xs uppercase tracking-wider">
                        <th className="p-4">Employee</th>
                        <th className="p-4">Role / Department</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-grey-light hover:bg-grey-50 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-navy">{u.email}</div>
                            <div className="text-xs text-grey-500">ID: {u.id}</div>
                          </td>
                          <td className="p-4">
                            <div className="capitalize font-medium text-grey-800">{u.role}</div>
                            <div className="capitalize text-xs text-grey-500">{u.department}</div>
                          </td>
                          <td className="p-4">
                            {u.status === 'suspended' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase">Suspended</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold uppercase">Active</span>
                            )}
                          </td>
                          <td className="p-4">
                            {u.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u.id, u.status)}
                                className={`font-bold text-xs px-3 py-1.5 rounded border transition-colors ${u.status === 'suspended' ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                              >
                                {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-grey-500 text-sm">
                    No employees listed.
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* --- TAB 3: BRANCHES & PROPERTIES --- */}
        {activeSettingsTab === "properties" && (
          <div className="space-y-8">
            {/* Create Property Form */}
            <Section title="Add New Property / Branch" icon={Building}>
              <form onSubmit={handleCreateProperty} className="bg-grey-50 p-6 rounded-2xl border border-grey-light space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-navy mb-1 uppercase tracking-wider">Property/Branch Name</label>
                    <input
                      type="text"
                      required
                      value={newPropName}
                      onChange={(e) => setNewPropName(e.target.value)}
                      placeholder="e.g. Lagos Airport Hotel, Lekki Suite 2"
                      className="w-full p-2 border border-grey-medium rounded-lg text-navy text-sm focus:outline-none focus:border-navy"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-navy hover:bg-navy-light text-white text-sm px-5 py-2.5 rounded-lg font-bold transition-all shadow-md"
                  >
                    Create Property
                  </button>
                </div>
              </form>
            </Section>

            {/* Properties list */}
            <Section title="Existing Properties / Branches" icon={Building}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.length > 0 ? (
                  properties.map((p) => (
                    <div key={p.id} className="p-4 bg-white border border-grey-light rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Building className="text-navy" size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-navy">{p.name}</h4>
                          <p className="text-xs text-grey-500 font-mono">ID: {p.id}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 p-8 text-center border border-dashed border-grey-medium rounded-xl text-grey-500 text-sm">
                    No branches or properties registered yet.
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* --- TAB 4: SECURITY AUDIT LOGS --- */}
        {activeSettingsTab === "audit" && (
          <div className="space-y-6">
            <Section title="Employee Login Audit Trail" icon={Shield}>
              <div className="bg-white border border-grey-light rounded-xl overflow-hidden">
                {loginLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-grey-700">
                      <thead>
                        <tr className="bg-grey-50 border-b border-grey-light text-navy font-bold text-xs uppercase tracking-wider">
                          <th className="p-4">Email</th>
                          <th className="p-4">IP / Browser</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginLogs.map((log) => (
                          <tr key={log.id} className="border-b border-grey-light hover:bg-grey-50 transition-colors">
                            <td className="p-4 font-semibold text-navy">{log.email}</td>
                            <td className="p-4 text-xs text-grey-500">
                              <div>IP: {log.ip_address || "Unknown"}</div>
                              <div className="truncate max-w-[200px]" title={log.user_agent}>{log.user_agent || "N/A"}</div>
                            </td>
                            <td className="p-4">
                              {log.status === 'success' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold uppercase">Success</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase" title={log.reason}>Failed</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-grey-500">{new Date(log.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-grey-500 text-sm">
                    No login audit logs recorded yet.
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-navy">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon size={20} className="text-navy" />
        </div>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="pl-0 md:pl-2">{children}</div>
    </div>
  );
}

function Input({ label, name, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-grey-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-2 border border-grey-medium rounded-lg text-navy focus:outline-none focus:border-navy placeholder-grey-400"
        placeholder={placeholder}
      />
    </div>
  );
}

function TextArea({ label, name, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-grey-700 mb-1">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-2 border border-grey-medium rounded-lg text-navy focus:outline-none focus:border-navy placeholder-grey-400 font-sans"
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

function Divider() {
  return <hr className="border-grey-light my-6" />;
}

function KnowledgeBase({ docs, refresh, businessId }) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiUrl}/api/knowledge/upload?business_id=${encodeURIComponent(businessId)}`,
        {
          method: "POST",
          body: formData,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      await refresh();
      alert("Document uploaded!");
    } catch (error) {
      alert("Failed to upload document.");
    } finally {
      setUploading(false);
      e.target.value = null; // Reset input
    }
  };

  const handleScrape = async () => {
    if (!url) return;
    setScraping(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/knowledge/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, business_id: businessId }),
      });
      if (!res.ok) throw new Error("Scrape failed");
      await refresh();
      setUrl("");
      alert("Website scraped!");
    } catch (error) {
      alert("Failed to scrape website.");
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiUrl}/api/knowledge/${id}?business_id=${encodeURIComponent(businessId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Delete failed");
      await refresh();
    } catch (error) {
      alert("Failed to delete.");
    }
  };

  return (
    <Section title="Knowledge Base" icon={Globe}>
      <div className="space-y-4">
        <p className="text-sm text-grey-600">
          Upload documents or scrape your website so the AI can learn about your
          business details.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload */}
          <div className="border border-dashed border-grey-medium rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-grey-50 relative">
            <Upload size={24} className="text-navy mb-2" />
            <span className="text-sm font-semibold text-navy">
              {uploading ? "Uploading..." : "Upload Document"}
            </span>
            <span className="text-xs text-grey-500 mt-1">
              .docx, .txt (Max 5MB)
            </span>
            <input
              type="file"
              accept=".docx,.txt"
              onChange={handleUpload}
              disabled={uploading}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {/* Scrape */}
          <div className="border border-grey-medium rounded-lg p-4 flex flex-col gap-3">
            <label className="text-sm font-semibold text-navy">
              Scrape Website
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/about"
                className="flex-1 p-2 border border-grey-medium rounded text-sm focus:outline-none focus:border-navy"
              />
              <button
                onClick={handleScrape}
                disabled={scraping || !url}
                className="bg-navy text-white text-xs px-3 py-1 rounded hover:bg-navy-light disabled:opacity-50"
              >
                {scraping ? "..." : "Fetch"}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {docs.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-bold text-navy">Uploaded Knowledge</h4>
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex justify-between items-center p-3 bg-grey-50 border border-grey-light rounded-lg"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {doc.type === "url" ? (
                    <Globe size={16} className="text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText
                      size={16}
                      className="text-orange-500 flex-shrink-0"
                    />
                  )}
                  <div className="truncate">
                    <div className="text-sm font-medium text-navy truncate">
                      {doc.title}
                    </div>
                    <div className="text-xs text-grey-500 truncate">
                      {(doc.content || "").substring(0, 50)}...
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
