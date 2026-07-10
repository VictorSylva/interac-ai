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
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/Loader";

export default function BusinessProfile() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);

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
        <div className="p-6 space-y-6">
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
