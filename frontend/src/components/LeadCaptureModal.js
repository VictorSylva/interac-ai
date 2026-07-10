import React, { useState } from 'react';
import { X, User, Mail, Phone, Briefcase, Building2, Sparkles, Send } from 'lucide-react';
import { API_BASE_URL } from '../config';

const LeadCaptureModal = ({ isOpen, onClose, industry, demoType, onRevealDemo }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    company_name: '',
    automation_goals: '',
    industry: industry || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync industry if it changes from props
  React.useEffect(() => {
    if (industry) {
      setFormData(prev => ({ ...prev, industry }));
    }
  }, [industry]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          demo_type: demoType,
        }),
      });

      if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Failed to capture lead');
      }

      // Store in localStorage to skip next time
      localStorage.setItem('interac_lead_captured', 'true');
      localStorage.setItem('interac_user_name', formData.name);
      
      onRevealDemo();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roles = ['Owner', 'Manager', 'Staff', 'Other'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/90 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-[#0f172a] rounded-[40px] w-full max-w-xl my-auto overflow-hidden shadow-2xl border border-white/5 animate-in zoom-in-95 duration-300 relative">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/5 blur-[100px] -ml-32 -mb-32 rounded-full" />

        <div className="relative p-8 md:p-12">
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>

          <div className="mb-10 text-center">
            <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-4">
              <Sparkles size={24} />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">Unlock Your Demo</h2>
            <p className="text-slate-400 font-medium">Experience a personalized simulation for {industry}.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="text" required placeholder="Full Name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500"
                />
              </div>

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="email" required placeholder="Work Email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="tel" required placeholder="Phone Number" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500"
                />
              </div>

              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="text" required placeholder="Company Name" value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative group">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <select
                  required value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500 appearance-none cursor-pointer"
                >
                  <option value="" disabled className="bg-navy">Role</option>
                  {roles.map(r => <option key={r} value={r} className="bg-navy">{r}</option>)}
                </select>
              </div>

              <div className="relative group">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="text" required placeholder="Industry" value={formData.industry} readOnly
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-medium text-white/50 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="relative group">
              <textarea
                placeholder="What would you like to automate? (Optional)"
                value={formData.automation_goals}
                onChange={(e) => setFormData({ ...formData, automation_goals: e.target.value })}
                rows="2"
                className="w-full p-6 bg-white/5 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-white placeholder:text-slate-500 resize-none"
              />
            </div>

            {error && <p className="text-rose-400 text-sm font-bold bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-5 mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Start Live Simulation</span>
                  <Send size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 text-slate-500 font-bold hover:text-white transition-colors"
            >
              Cancel & Go Back
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Privacy Protected • Enterprise Grade Security
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeadCaptureModal;
