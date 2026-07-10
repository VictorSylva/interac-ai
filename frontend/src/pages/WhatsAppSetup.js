import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Globe, 
  Send, 
  CheckCircle, 
  XCircle, 
  Info, 
  Copy, 
  ChevronRight, 
  ChevronLeft,
  Lock
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/Loader";

export default function WhatsAppSetup() {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState(null);

  const [form, setForm] = useState({
    phone_number_id: "",
    business_account_id: "",
    app_id: "",
    app_secret: "",
    access_token: "",
    is_active: false
  });

  useEffect(() => {
    fetchConfig();
  }, [currentUser]);

  const fetchConfig = async () => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/whatsapp/config?business_id=${encodeURIComponent(businessId)}`);
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

  const handleSave = async () => {
    setSaving(true);
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/whatsapp/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, business_id: businessId }),
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("Configuration saved successfully!");
        setStep(2);
      } else {
        alert("Failed to save configuration.");
      }
    } catch (error) {
      alert("Error saving configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone) return alert("Please enter a phone number to test.");
    setTesting(true);
    setTestStatus(null);
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${apiUrl}/api/whatsapp/test-message?business_id=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(testPhone)}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.status === "success" || data.success === true) {
        setTestStatus("success");
        await fetchConfig(); // Refresh config from backend to ensure state sync
      } else {
        setTestStatus("failed");
        alert(data.detail || "Test message failed.");
      }
    } catch (error) {
      setTestStatus("failed");
    } finally {
      setTesting(false);
    }
  };

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  const webhookUrl = `${apiUrl}/whatsapp/webhook`;
  const verifyToken = "interact_secret_token"; // We kept this global for now as per plan fallback

  if (loading) return <Loader message="Connecting to Meta API..." />;


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">WhatsApp Integration</h1>
          <p className="text-grey-500 text-sm">Connect your business to WhatsApp Business API</p>
        </div>
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-grey-100 text-grey-600'}`}>
                {form.is_active ? 'Status: Active' : 'Status: Inactive'}
            </span>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-grey-light">
          {[1, 2, 3].map(i => (
              <div key={i} className={`flex items-center gap-2 ${step === i ? 'text-navy font-bold' : 'text-grey-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= i ? 'border-navy bg-navy text-white' : 'border-grey-light'}`}>
                      {i}
                  </div>
                  <span>{i === 1 ? "Setup" : i === 2 ? "Webhook" : "Test & Activate"}</span>
                  {i < 3 && <ChevronRight size={16} className="mx-2 text-grey-300" />}
              </div>
          ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-grey-light overflow-hidden">
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 text-navy pb-2 border-b border-grey-light">
                    <Settings size={20} />
                    <h2 className="text-lg font-bold">API Credentials</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField 
                        label="Phone Number ID" 
                        name="phone_number_id" 
                        value={form.phone_number_id} 
                        onChange={handleChange} 
                        placeholder="e.g. 1234567890123456"
                    />
                    <InputField 
                        label="WhatsApp Business Account ID" 
                        name="business_account_id" 
                        value={form.business_account_id} 
                        onChange={handleChange} 
                        placeholder="e.g. 987654321098765"
                    />
                    <InputField 
                        label="Meta App ID" 
                        name="app_id" 
                        value={form.app_id} 
                        onChange={handleChange} 
                        placeholder="e.g. 112233445566"
                    />
                    <InputField 
                        label="Meta App Secret" 
                        name="app_secret" 
                        type="password"
                        value={form.app_secret} 
                        onChange={handleChange} 
                        placeholder="••••••••"
                        icon={Lock}
                    />
                    <div className="md:col-span-2">
                        <InputField 
                            label="Permanent Access Token" 
                            name="access_token" 
                            type="password"
                            value={form.access_token} 
                            onChange={handleChange} 
                            placeholder="EAAG...."
                            icon={Lock}
                        />
                        <p className="text-xs text-grey-500 mt-1">Generated in Meta Business Settings under System Users.</p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-navy hover:bg-navy-light text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save & Continue"}
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 text-navy pb-2 border-b border-grey-light">
                    <Globe size={20} />
                    <h2 className="text-lg font-bold">Webhook Configuration</h2>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-navy text-sm">
                    <Info size={20} className="flex-shrink-0" />
                    <div>
                        <p className="font-bold">Important Instructions:</p>
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                            <li>Go to Meta Developers Portal &rarr; WhatsApp &rarr; Configuration</li>
                            <li>Click Edit on the Webhook section</li>
                            <li>Paste the Callback URL and Verify Token below</li>
                            <li>Subscribe to the <strong>messages</strong> field</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-4">
                    <CopyField label="Callback URL" value={webhookUrl} />
                    <CopyField label="Verify Token" value={verifyToken} />
                </div>

                <div className="flex justify-between pt-4">
                    <button onClick={() => setStep(1)} className="text-grey-500 flex items-center gap-1 hover:text-navy">
                        <ChevronLeft size={18} /> Back to Setup
                    </button>
                    <button 
                        onClick={() => setStep(3)}
                        className="bg-navy hover:bg-navy-light text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        Next Step
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 text-navy pb-2 border-b border-grey-light">
                    <Send size={20} />
                    <h2 className="text-lg font-bold">Test & Activate</h2>
                </div>

                <div className="space-y-4 max-w-md mx-auto py-4">
                    <div className="text-center">
                        <p className="text-sm text-grey-600 mb-4">Send a test message to verify your connection works.</p>
                        <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                placeholder="e.g. 2348000000000"
                                className="flex-1 p-2 border border-grey-medium rounded-lg text-navy focus:outline-none focus:border-navy"
                             />
                             <button 
                                onClick={handleTest}
                                disabled={testing || !testPhone}
                                className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-light disabled:opacity-50 transition-colors"
                             >
                                {testing ? "Sending..." : "Send Test"}
                             </button>
                        </div>
                        {testStatus === "success" && (
                            <div className="mt-3 flex items-center justify-center gap-1 text-green-600 text-sm font-bold">
                                <CheckCircle size={16} /> Test Sent! Check your WhatsApp.
                            </div>
                        )}
                        {testStatus === "failed" && (
                            <div className="mt-3 flex items-center justify-center gap-1 text-red-600 text-sm font-bold">
                                <XCircle size={16} /> Failed to send. Check credentials.
                            </div>
                        )}
                    </div>
                </div>

                <Divider />

                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="flex items-center gap-3">
                        <label className="text-lg font-bold text-navy">Activate Chatbot</label>
                        <button 
                            onClick={async () => {
                                const newActive = !form.is_active;
                                setForm({ ...form, is_active: newActive });
                                const businessId = currentUser?.business_id || currentUser?.email || "default";
                                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
                                await fetch(`${apiUrl}/api/whatsapp/config`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ business_id: businessId, is_active: newActive }),
                                });
                            }}
                            className={`w-14 h-8 rounded-full relative transition-colors ${form.is_active ? 'bg-navy' : 'bg-grey-300'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${form.is_active ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                    <p className="text-sm text-grey-500 text-center">When active, AI will automatically respond to messages received on your WhatsApp number.</p>
                </div>

                <div className="flex justify-between pt-4 border-t border-grey-light">
                    <button onClick={() => setStep(2)} className="text-grey-500 flex items-center gap-1 hover:text-navy">
                        <ChevronLeft size={18} /> Back to Webhook
                    </button>
                    <button 
                        onClick={async () => {
                            await fetchConfig();
                            if (form.is_active || testStatus === "success") {
                                alert("WhatsApp setup complete and active!");
                            } else {
                                alert("Setup finished, but chatbot is currently inactive. Please test your connection or activate manually.");
                            }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors font-bold"
                    >
                        Complete Setup
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, name, value, onChange, placeholder, type = "text", icon: Icon }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-bold text-grey-700">{label}</label>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className={`w-full p-2 border border-grey-medium rounded-lg text-navy focus:outline-none focus:border-navy text-sm ${Icon ? 'pl-10' : ''}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function CopyField({ label, value }) {
    const copy = () => {
        navigator.clipboard.writeText(value);
        alert(`${label} copied!`);
    };
    return (
        <div className="space-y-1">
            <label className="block text-sm font-bold text-grey-700">{label}</label>
            <div className="flex gap-2">
                <input 
                    readOnly 
                    value={value} 
                    className="flex-1 p-2 bg-grey-50 border border-grey-medium rounded-lg text-sm text-navy font-mono"
                />
                <button onClick={copy} className="p-2 border border-navy text-navy rounded-lg hover:bg-navy-light hover:text-white transition-colors">
                    <Copy size={20} />
                </button>
            </div>
        </div>
    );
}

function Divider() {
  return <hr className="border-grey-light my-6" />;
}
