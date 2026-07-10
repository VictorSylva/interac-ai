import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Mail, 
  Settings, 
  Send, 
  CheckCircle, 
  XCircle, 
  Lock,
  ChevronRight,
  Server,
  Zap,
  AlertTriangle,
  Activity,
  ShieldCheck
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import Loader from "../../components/Loader";

export default function EmailSetup() {
  const { currentUser } = useAuth();
  const { refreshEmailStatus } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState(null);

  const [form, setForm] = useState({
    provider: "resend",
    api_key: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    from_name: "",
    reply_to: "",
    is_active: false
  });

  useEffect(() => {
    fetchConfig();
  }, [currentUser]);

  const fetchConfig = async () => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/email/config?business_id=${encodeURIComponent(businessId)}`);
      const data = await res.json();
      if (data.status === "success") {
        setForm(prev => ({ ...prev, ...data.config }));
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/email/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, business_id: businessId }),
      });
      const data = await res.json();
      if (data.status === "success") {
        if (!silent) alert("Settings updated successfully!");
        if (refreshEmailStatus) refreshEmailStatus();
        return true;
      } else {
        alert("Failed to save configuration.");
        return false;
      }
    } catch (error) {
      alert("Error saving configuration.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
      const newState = !form.is_active;
      setForm(prev => ({...prev, is_active: newState}));
      
      setSaving(true);
      const businessId = currentUser?.business_id || currentUser?.email || "default";
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      try {
        await fetch(`${apiUrl}/api/email/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, is_active: newState, business_id: businessId }),
        });
        if (refreshEmailStatus) refreshEmailStatus();
      } catch (error) {
      } finally {
        setSaving(false);
      }
  };


  const handleTest = async () => {
    if (!testEmail) return alert("Please enter an email to test.");
    setTesting(true);
    setTestStatus(null);
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/email/test-email?business_id=${encodeURIComponent(businessId)}&to=${encodeURIComponent(testEmail)}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.status === "success") {
        setTestStatus("success");
      } else {
        setTestStatus("failed");
        alert(data.detail || "Test email failed. Please check your credentials.");
      }
    } catch (error) {
      setTestStatus("failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Loader message="Loading Email Settings..." />;

  const isConfigured = form.provider === 'resend' ? !!form.api_key : (!!form.smtp_host && !!form.smtp_user);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header with Prominent Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-grey-light">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-3">
             <Mail className="text-navy" /> Email Integration
          </h1>
          <p className="text-grey-500 text-sm mt-1">Manage transactional emails and automated order fulfillment</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${form.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <Activity size={16} className={form.is_active ? 'animate-pulse' : ''} />
                {form.is_active ? 'LIVE & ACTIVE' : 'INACTIVE / DORMANT'}
            </div>
            
            <button 
                onClick={handleToggleActive}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-md ${form.is_active ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-navy hover:bg-navy-light text-white'}`}
            >
                {form.is_active ? 'Deactivate' : 'Activate Now'}
            </button>
        </div>
      </div>

      {!form.is_active && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                  <AlertTriangle className="text-amber-500" size={20} />
                  <div>
                      <p className="text-sm font-bold text-amber-800">Your custom email settings are not yet Live.</p>
                      <p className="text-xs text-amber-700">Automated offer deliveries will use platform defaults until you click <b>'Activate Now'</b> above.</p>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Provider Selection */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light">
                <h3 className="font-bold text-navy mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-70">
                    Step 1: Choose Provider
                </h3>
                <div className="space-y-3">
                    <button 
                        onClick={() => setForm({...form, provider: 'resend'})}
                        className={`w-full p-4 rounded-xl border-2 flex flex-col items-start transition-all ${form.provider === 'resend' ? 'border-navy bg-navy/5 shadow-inner' : 'border-grey-light hover:border-grey-medium'}`}
                    >
                        <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-bold text-sm">Resend API</span>
                            {form.provider === 'resend' && <ShieldCheck size={16} className="text-navy" />}
                        </div>
                        <span className="text-xs text-grey-500 text-left leading-relaxed">Modern, developer-friendly email infrastructure. Ideal for startups.</span>
                    </button>
                    
                    <button 
                        onClick={() => setForm({...form, provider: 'smtp'})}
                        className={`w-full p-4 rounded-xl border-2 flex flex-col items-start transition-all ${form.provider === 'smtp' ? 'border-navy bg-navy/5 shadow-inner' : 'border-grey-light hover:border-grey-medium'}`}
                    >
                        <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-bold text-sm">Custom SMTP</span>
                            {form.provider === 'smtp' && <ShieldCheck size={16} className="text-navy" />}
                        </div>
                        <span className="text-xs text-grey-500 text-left leading-relaxed">Use your existing business mail server (Google, Outlook, Private).</span>
                    </button>
                </div>

                <div className="mt-8 bg-grey-50 p-4 rounded-lg border border-grey-light">
                    <h4 className="text-xs font-bold text-grey-600 uppercase mb-2">Quick Test</h4>
                    <div className="space-y-2">
                         <input 
                            type="email" 
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="test@example.com"
                            className="w-full p-2.5 rounded-lg border border-grey-light text-sm focus:outline-none focus:ring-2 focus:ring-navy/10"
                        />
                        <button 
                            onClick={handleTest}
                            disabled={testing || !testEmail || !isConfigured}
                            className={`w-full font-bold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${isConfigured ? 'bg-navy text-white hover:bg-navy-light shadow-sm' : 'bg-grey-200 text-grey-400 cursor-not-allowed'}`}
                        >
                            {testing ? "Sending..." : "Send Test Email"}
                            {!testing && <Send size={14} />}
                        </button>
                        {testStatus === "success" && <p className="text-[10px] text-green-600 text-center font-bold mt-1 animate-in zoom-in-95">✓ Connection Successful!</p>}
                        {testStatus === "failed" && <p className="text-[10px] text-red-500 text-center font-bold mt-1 animate-in zoom-in-95">✗ Connection Failed!</p>}
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Detailed Config */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-grey-light relative overflow-hidden">
                 <div className="flex items-center gap-3 text-navy pb-4 border-b border-grey-light mb-6">
                    <Settings size={20} className="text-navy/50" />
                    <h2 className="text-lg font-bold">Step 2: {form.provider === 'resend' ? 'Resend' : 'SMTP'} Details</h2>
                </div>

                {form.provider === 'resend' ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <InputField 
                            label="Resend API Key" 
                            name="api_key" 
                            type="password"
                            value={form.api_key} 
                            onChange={handleChange} 
                            placeholder="re_1234567890..."
                            icon={Lock}
                        />
                        <div className="bg-navy/5 p-4 rounded-lg flex gap-3 items-start">
                            <Activity size={18} className="text-navy shrink-0 mt-0.5" />
                            <p className="text-xs text-navy/70 leading-relaxed">
                                Get your API key from the <b>Resend Dashboard</b>. Ensure you have verified your domain in Resend to avoid spam filters.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-right-4">
                        <div className="md:col-span-2">
                            <InputField 
                                label="SMTP Host" 
                                name="smtp_host" 
                                value={form.smtp_host} 
                                onChange={handleChange} 
                                placeholder="e.g. smtp.gmail.com"
                                icon={Server}
                            />
                        </div>
                        <InputField 
                            label="SMTP Port" 
                            name="smtp_port" 
                            type="number"
                            value={form.smtp_port} 
                            onChange={handleChange} 
                            placeholder="587"
                        />
                        <InputField 
                            label="SMTP User / Username" 
                            name="smtp_user" 
                            value={form.smtp_user} 
                            onChange={handleChange} 
                            placeholder="user@example.com"
                        />
                        <div className="md:col-span-2">
                             <InputField 
                                label="SMTP Password / App Password" 
                                name="smtp_password" 
                                type="password"
                                value={form.smtp_password} 
                                onChange={handleChange} 
                                placeholder="••••••••"
                                icon={Lock}
                            />
                            <p className="text-[10px] text-grey-500 mt-2">
                                <b>Note:</b> For Gmail, you must use an <b>App Password</b>, not your main account password.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-10 pt-8 border-t border-grey-light">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-widest mb-6 opacity-60">Sender Branding</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField 
                            label="From Name (Display Name)" 
                            name="from_name" 
                            value={form.from_name} 
                            onChange={handleChange} 
                            placeholder="e.g. Interact Support"
                        />
                        <InputField 
                            label="From Email Address" 
                            name="from_email" 
                            value={form.from_email} 
                            onChange={handleChange} 
                            placeholder="e.g. hello@yourdomain.com"
                        />
                        <div className="md:col-span-2">
                             <InputField 
                                label="Reply-To Address (Optional)" 
                                name="reply_to" 
                                value={form.reply_to} 
                                onChange={handleChange} 
                                placeholder="e.g. support@yourdomain.com"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-10">
                    <button 
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="bg-navy hover:bg-navy-light text-white px-10 py-3.5 rounded-xl transition-all font-bold flex items-center gap-2 shadow-lg shadow-navy/20 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Configuration"}
                        {!saving && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, name, value, onChange, placeholder, type = "text", icon: Icon }) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold text-grey-600 uppercase tracking-wider">{label}</label>
      <div className="relative group">
        {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-grey-400 group-focus-within:text-navy transition-colors" />}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className={`w-full p-3 bg-grey-50 border border-grey-light rounded-xl text-navy focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/5 text-sm transition-all ${Icon ? 'pl-11' : 'pl-4'}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

