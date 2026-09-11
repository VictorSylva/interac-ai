import React, { useState, useEffect } from "react";
import { 
  Globe, 
  CheckCircle, 
  XCircle, 
  Info, 
  Copy, 
  Lock, 
  MessageSquare, 
  Instagram, 
  Facebook, 
  ShieldAlert, 
  Zap, 
  RefreshCw, 
  ExternalLink,
  Sliders,
  AlertTriangle
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/Loader";

export default function MetaChannelsSetup() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const businessId = currentUser?.business_id || currentUser?.email || "default";
  const webhookUrl = `${API_BASE_URL.replace(/:\d+$/, ':8000')}/meta/webhook`;

  const [form, setForm] = useState({
    page_id: "",
    page_access_token: "",
    instagram_business_id: "",
    app_id: "",
    app_secret: "",
    verify_token: "interac_meta_verify_secret",
    is_active: true,
    messenger_enabled: true,
    instagram_enabled: true,
    facebook_comments_enabled: true,
    instagram_comments_enabled: true,
    comment_to_dm_enabled: true,
    human_mode_policy: "ai_active",
    auto_escalate_critical: true
  });

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

  useEffect(() => {
    fetchConfig();
  }, [currentUser]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/meta/config?business_id=${encodeURIComponent(businessId)}`, {
        headers: getAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.config) {
          setForm(prev => ({
            ...prev,
            page_id: data.config.page_id || "",
            page_access_token: data.config.page_access_token || "",
            instagram_business_id: data.config.instagram_business_id || "",
            app_id: data.config.app_id || "",
            app_secret: data.config.app_secret || "",
            verify_token: data.config.verify_token || "interac_meta_verify_secret",
            is_active: data.config.is_active !== undefined ? data.config.is_active : true,
            messenger_enabled: data.config.messenger_enabled !== undefined ? data.config.messenger_enabled : true,
            instagram_enabled: data.config.instagram_enabled !== undefined ? data.config.instagram_enabled : true,
            facebook_comments_enabled: data.config.facebook_comments_enabled !== undefined ? data.config.facebook_comments_enabled : true,
            instagram_comments_enabled: data.config.instagram_comments_enabled !== undefined ? data.config.instagram_comments_enabled : true,
            comment_to_dm_enabled: data.config.comment_to_dm_enabled !== undefined ? data.config.comment_to_dm_enabled : true,
            human_mode_policy: data.config.human_mode_policy || "ai_active",
            auto_escalate_critical: data.config.auto_escalate_critical !== undefined ? data.config.auto_escalate_critical : true
          }));
        }
      }
    } catch (err) {
      console.error("Error fetching Meta config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/meta/config`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          business_id: businessId,
          ...form
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        alert("Meta omnichannel configurations saved successfully!");
      } else {
        alert(data.message || data.detail || "Failed to save configuration.");
      }
    } catch (err) {
      alert("Error saving configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/meta/test-connection`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          business_id: businessId,
          page_id: form.page_id,
          page_access_token: form.page_access_token,
          instagram_business_id: form.instagram_business_id
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        status: "error",
        message: "Failed to reach server: " + err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (loading) {
    return <Loader message="Loading Meta & Social Channels Configuration..." />;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Globe size={24} />
              </span>
              <h1 className="text-2xl font-bold text-navy">Meta & Social Signal Intelligence</h1>
            </div>
            <p className="text-sm text-grey-600 mt-1">
              Connect Facebook Messenger, Instagram DMs, Page comments, and Instagram comments. All channels feed into InteracAI's unified CRM, ARGUS Intelligence, and Workflow Automation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              form.is_active ? 'bg-green-100 text-green-800' : 'bg-grey-100 text-grey-600'
            }`}>
              {form.is_active ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>

        {/* Human Ownership Notice */}
        <div className="mt-4 p-3 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-3">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <strong>Human Co-Existence Guarantee:</strong> InteracAI never locks you out of your Facebook Page or Instagram app. When your team replies manually via native Meta Business Suite or mobile apps, InteracAI automatically detects the agent response, pauses AI bot intervention, and preserves human conversation ownership.
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Webhook & Meta App Setup */}
        <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2 mb-4">
            <Lock size={18} className="text-indigo-600" />
            1. Meta App & Webhook Verification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Webhook Callback URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full text-xs font-mono bg-grey-50 border border-grey-300 rounded-lg px-3 py-2 text-grey-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="px-3 py-2 bg-grey-100 hover:bg-grey-200 text-grey-700 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  {copiedWebhook ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copiedWebhook ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-grey-500 mt-1">Paste this into Meta App Dashboard under Webhooks (Subscriptions: <code>messages</code>, <code>messaging_postbacks</code>, <code>feed</code>).</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Webhook Verify Token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="verify_token"
                  value={form.verify_token}
                  onChange={handleChange}
                  className="w-full text-xs font-mono border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(form.verify_token, 'token')}
                  className="px-3 py-2 bg-grey-100 hover:bg-grey-200 text-grey-700 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  {copiedToken ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copiedToken ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-grey-500 mt-1">Must match the token entered in your Meta App Webhook settings.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Meta App ID</label>
              <input
                type="text"
                name="app_id"
                value={form.app_id}
                onChange={handleChange}
                placeholder="e.g. 109283746592019"
                className="w-full text-sm border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Meta App Secret (HMAC Verification)</label>
              <input
                type="password"
                name="app_secret"
                value={form.app_secret}
                onChange={handleChange}
                placeholder="Enter App Secret for X-Hub-Signature-256 validation"
                className="w-full text-sm font-mono border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-grey-500 mt-1">Used to cryptographically verify inbound Meta payloads and prevent webhook spoofing.</p>
            </div>
          </div>
        </div>

        {/* Facebook Page & Messenger Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2 mb-4">
            <Facebook size={18} className="text-blue-600" />
            2. Facebook Page & Messenger Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Facebook Page ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="page_id"
                required
                value={form.page_id}
                onChange={handleChange}
                placeholder="e.g. 102938475610293"
                className="w-full text-sm border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-grey-500 mt-1">Find your Page ID in Facebook Page -&gt; About -&gt; Page Transparency.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Page Access Token <span className="text-red-500">*</span></label>
              <input
                type="password"
                name="page_access_token"
                required
                value={form.page_access_token}
                onChange={handleChange}
                placeholder="EAA..."
                className="w-full text-sm font-mono border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-grey-500 mt-1">Encrypted securely at rest using Fernet token encryption.</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-grey-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
              <input
                type="checkbox"
                name="messenger_enabled"
                checked={form.messenger_enabled}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-navy block">Facebook Messenger Bot</span>
                <span className="text-[11px] text-grey-500">Enable AI responses for direct messages received on Facebook Messenger.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
              <input
                type="checkbox"
                name="facebook_comments_enabled"
                checked={form.facebook_comments_enabled}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-navy block">Facebook Page Comments AI</span>
                <span className="text-[11px] text-grey-500">Monitor post comments, detect intent/sentiment, and reply publicly.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Instagram Professional Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2 mb-4">
            <Instagram size={18} className="text-pink-600" />
            3. Instagram Direct & Comments Settings
          </h2>
          <div>
            <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Instagram Business Account ID</label>
            <input
              type="text"
              name="instagram_business_id"
              value={form.instagram_business_id}
              onChange={handleChange}
              placeholder="e.g. 1784140530921098"
              className="w-full text-sm border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-grey-500 mt-1">Requires an Instagram Professional (Business/Creator) account connected to your Facebook Page.</p>
          </div>

          <div className="mt-4 pt-4 border-t border-grey-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
              <input
                type="checkbox"
                name="instagram_enabled"
                checked={form.instagram_enabled}
                onChange={handleChange}
                className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
              />
              <div>
                <span className="text-xs font-bold text-navy block">Instagram Direct Messages (DMs)</span>
                <span className="text-[11px] text-grey-500">AI conversation bot for Instagram DMs (respects Meta 24-hr messaging window).</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
              <input
                type="checkbox"
                name="instagram_comments_enabled"
                checked={form.instagram_comments_enabled}
                onChange={handleChange}
                className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
              />
              <div>
                <span className="text-xs font-bold text-navy block">Instagram Post Comments AI</span>
                <span className="text-[11px] text-grey-500">Scan media comments for lead inquiries, questions, and brand risks.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Social Signal & Response Policies */}
        <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2 mb-4">
            <Sliders size={18} className="text-purple-600" />
            4. Social Intelligence & Response Policies
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-grey-700 uppercase mb-1">Human-in-the-Loop Mode Policy</label>
              <select
                name="human_mode_policy"
                value={form.human_mode_policy}
                onChange={handleChange}
                className="w-full text-sm border border-grey-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ai_active">AI Active (Automatic AI replies unless escalated or claimed)</option>
                <option value="hybrid_supervision">Hybrid Supervision (AI drafts; human takeover on request)</option>
                <option value="human_takeover">Human First (AI disabled by default; manual operator only)</option>
              </select>
              <p className="text-[11px] text-grey-500 mt-1">Controls how AI handles inbound conversations across Messenger and Instagram.</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="comment_to_dm_enabled"
                  checked={form.comment_to_dm_enabled}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-navy block">Comment-to-DM Private Replies</span>
                  <span className="text-[11px] text-grey-500">Automatically open a 1:1 Messenger/IG direct message when a user asks for price or quote in public comments.</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-grey-200 hover:bg-grey-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="auto_escalate_critical"
                  checked={form.auto_escalate_critical}
                  onChange={handleChange}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-navy block">Auto-Escalate Critical Risks</span>
                  <span className="text-[11px] text-grey-500">Automatically switch conversation to Human Mode and alert agents if negative sentiment or urgent complaint is detected.</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Test Connection & Save Action */}
        <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={testing || !form.page_id || !form.page_access_token}
              onClick={handleTestConnection}
              className="px-4 py-2.5 bg-grey-100 hover:bg-grey-200 text-grey-700 font-semibold rounded-lg text-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} className="text-amber-600" />}
              {testing ? 'Verifying Token...' : 'Test Meta Connection'}
            </button>

            {testResult && (
              <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                testResult.status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testResult.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>
                  {testResult.status === 'success' 
                    ? `Connected: ${testResult.page_name || 'Facebook Page'} (ID: ${testResult.page_id})` 
                    : (testResult.message || 'Connection failed')}
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-6 py-2.5 bg-navy hover:bg-navy-light text-white font-bold rounded-lg text-sm shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {saving ? 'Saving...' : 'Save Meta Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
