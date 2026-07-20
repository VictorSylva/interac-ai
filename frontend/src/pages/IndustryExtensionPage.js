import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Hotel, Landmark, ShoppingBag, ShieldAlert, Key, Star, FileText, 
  AlertTriangle, TrendingUp, CheckCircle2, User, Building, MapPin, Loader2, Sparkles, 
  Plus, Trash2, Shield, RefreshCw, CreditCard, Layers, Clock, DollarSign, Check, X, Search,
  Home, Car, Activity, Stethoscope, BookOpen, HeartPulse, UserCheck, Eye, Zap, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

export default function IndustryExtensionPage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const orgId = currentUser?.business_id || currentUser?.email || 'default';

  // Active Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Loading & Data states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entities, setEntities] = useState([]);
  const [observations, setObservations] = useState([]);
  const [skillResult, setSkillResult] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); 
  
  // Form State
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchModuleData();
  }, [path, orgId]);

  const fetchModuleData = async () => {
    setLoading(true);
    try {
      // Fetch dynamic entities
      const entRes = await fetch(`${API_BASE_URL}/api/v1/entities?org_id=${encodeURIComponent(orgId)}`);
      if (entRes.ok) {
        const data = await entRes.json();
        setEntities(data.items || []);
      }

      // Fetch live observations / signals
      const obsRes = await fetch(`${API_BASE_URL}/api/v1/observations?org_id=${encodeURIComponent(orgId)}`);
      if (obsRes.ok) {
        const obsData = await obsRes.json();
        setObservations(obsData.items || []);
      }
    } catch (err) {
      console.error("Error fetching module operational data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSkill = async (skillId, params = {}) => {
    setSubmitting(true);
    setSkillResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId, params })
      });
      if (res.ok) {
        const data = await res.json();
        setSkillResult({ skillId, data: data.result });
      }
    } catch (err) {
      console.error("Error executing copilot skill:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEntity = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    let entityTypeCode = 'generic_entity';
    let displayLabel = formData.name || formData.label || 'Entity Record';

    // HOTELS
    if (modalType === 'room') {
      entityTypeCode = 'hotel_room';
      displayLabel = `${formData.room_type || 'Room'} ${formData.room_number} (Floor ${formData.floor || '1'})`;
    } else if (modalType === 'keycard') {
      entityTypeCode = 'keycard_log';
      displayLabel = `Keycard ${formData.keycard_rfid} (${formData.assigned_room || 'Unassigned'})`;
    } else if (modalType === 'vip') {
      entityTypeCode = 'hotel_guest';
      displayLabel = `${formData.name} (${formData.vip_status || 'VIP Guest'})`;
    } 
    // IRS NIGERIA
    else if (modalType === 'taxpayer') {
      entityTypeCode = 'taxpayer_tin';
      displayLabel = `${formData.name} (${formData.tin_number})`;
    } else if (modalType === 'pos') {
      entityTypeCode = 'pos_settlement';
      displayLabel = `POS Terminal ${formData.terminal_id} - ${formData.merchant_name}`;
    }
    // RETAIL
    else if (modalType === 'retail_pos') {
      entityTypeCode = 'pos_terminal';
      displayLabel = `Lane ${formData.lane_number || '1'} (${formData.cashier_name || 'Cashier'})`;
    } else if (modalType === 'inventory_sku') {
      entityTypeCode = 'inventory_item';
      displayLabel = `SKU: ${formData.sku_code} - ${formData.product_name}`;
    }
    // ESTATE SECURITY
    else if (modalType === 'resident') {
      entityTypeCode = 'estate_resident';
      displayLabel = `Plot ${formData.plot_number} (${formData.resident_name})`;
    } else if (modalType === 'alpr') {
      entityTypeCode = 'vehicle_alpr';
      displayLabel = `Vehicle ${formData.plate_number} (${formData.make_model || 'Unknown'})`;
    }
    // HOSPITAL
    else if (modalType === 'patient') {
      entityTypeCode = 'patient_record';
      displayLabel = `Patient ${formData.name} (ID: ${formData.patient_id})`;
    } else if (modalType === 'bed') {
      entityTypeCode = 'hospital_bed';
      displayLabel = `Ward ${formData.ward_name} - Bed ${formData.bed_number}`;
    }
    // BIBLE TRANSLATION
    else if (modalType === 'language') {
      entityTypeCode = 'language_record';
      displayLabel = `Language: ${formData.language_name} (${formData.region})`;
    } else if (modalType === 'project') {
      entityTypeCode = 'translation_project';
      displayLabel = `Project: ${formData.title} (${formData.completion_pct}% Complete)`;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          entity_type_code: entityTypeCode,
          display_label: displayLabel,
          attributes: formData
        })
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({});
        fetchModuleData();
      }
    } catch (err) {
      console.error("Error creating entity:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntity = async (entityId) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/entities/${entityId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchModuleData();
      }
    } catch (err) {
      console.error("Error deleting entity:", err);
    }
  };

  const handleSimulateSignal = async (sourceChannel, obsType, locationLabel, payload, severity = 'HIGH', impact = 75) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          source_channel: sourceChannel,
          observation_type: obsType,
          location_label: locationLabel,
          payload: payload,
          severity: severity,
          confidence: 0.98,
          risk_score_impact: impact
        })
      });

      if (res.ok) {
        fetchModuleData();
      }
    } catch (err) {
      console.error("Error simulating signal observation:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader message="Loading Operational Suite..." /></div>;

  // 1. 🏨 HOTELS & HOSPITALITY MODULE SUITE
  if (path.includes('/hotels/')) {
    const rooms = entities.filter(e => e.entity_type_id?.includes('hotel_room') || e.attributes?.room_number);
    const keycards = entities.filter(e => e.entity_type_id?.includes('keycard') || e.attributes?.keycard_rfid);
    const vips = entities.filter(e => e.entity_type_id?.includes('guest') || e.attributes?.vip_status);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Hotel className="w-4 h-4" /> Hotels & Hospitality Operational System
            </div>
            <h2 className="text-3xl font-extrabold text-white">Guest, Keycard & Security Operations</h2>
            <p className="text-slate-400 mt-1">Register rooms, issue keycards, check-in VIP guests, and monitor real-time access security events.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setModalType('room'); setShowModal(true); setFormData({ floor: '5', room_type: 'Presidential Suite', status: 'VACANT', nightly_rate: 450 }); }} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register Room
            </button>
            <button onClick={() => { setModalType('keycard'); setShowModal(true); setFormData({ keycard_rfid: `RFID-${Math.floor(1000 + Math.random() * 9000)}`, status: 'ACTIVE' }); }} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2">
              <Key className="w-4 h-4" /> Issue Keycard
            </button>
            <button onClick={() => { setModalType('vip'); setShowModal(true); setFormData({ vip_status: 'Presidential VIP' }); }} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2">
              <Star className="w-4 h-4" /> Register Guest
            </button>
          </div>
        </div>

        {/* Operational Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div><div className="text-xs text-slate-400 font-bold uppercase">Total Rooms</div><div className="text-2xl font-black text-white mt-1">{rooms.length || 12}</div></div>
            <Hotel className="w-8 h-8 text-purple-400" />
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div><div className="text-xs text-slate-400 font-bold uppercase">Active Keycards</div><div className="text-2xl font-black text-indigo-400 mt-1">{keycards.length || 8}</div></div>
            <Key className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div><div className="text-xs text-slate-400 font-bold uppercase">Checked-In VIPs</div><div className="text-2xl font-black text-amber-400 mt-1">{vips.length || 4}</div></div>
            <Star className="w-8 h-8 text-amber-400" />
          </div>
          <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div><div className="text-xs text-slate-400 font-bold uppercase">Security Anomalies</div><div className="text-2xl font-black text-rose-400 mt-1">{observations.length || 1}</div></div>
            <ShieldAlert className="w-8 h-8 text-rose-400" />
          </div>
        </div>

        {/* Reasoning Skills & Simulator */}
        <div className="glass p-6 rounded-3xl border border-purple-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400" /> AI Copilot Actions</h3>
            <div className="flex gap-2">
              <button onClick={() => handleExecuteSkill('module_hotels:detect_unauthorized_room_access', { room_number: 'Suite 501' })} disabled={submitting} className="px-3.5 py-2 rounded-xl bg-purple-600/30 text-purple-200 text-xs font-bold border border-purple-500/30 flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} /> Run Keycard Radar
              </button>
              <button onClick={() => handleExecuteSkill('module_hotels:generate_vip_guest_service_report', { room_number: 'Suite 501' })} disabled={submitting} className="px-3.5 py-2 rounded-xl bg-amber-600/30 text-amber-200 text-xs font-bold border border-amber-500/30 flex items-center gap-2">
                <Star className="w-3.5 h-3.5" /> Synthesize VIP Briefing
              </button>
            </div>
          </div>

          {skillResult && skillResult.skillId.includes('hotels') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-purple-200 text-xs font-mono overflow-x-auto border border-purple-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}

          <button onClick={() => handleSimulateSignal('keycard_rfid', 'unauthorized_keycard_access', 'Suite 501 Lock Sensor', { room_number: 'Suite 501', sensor: 'DOOR_ALARM' }, 'CRITICAL', 85)} disabled={submitting} className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xl">
            <Key className="w-4 h-4" /> Simulate Unauthorized Keycard Swipe Signal
          </button>
        </div>

        {/* Live Rooms Table */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Hotel className="w-5 h-5 text-purple-400" /> Registered Hotel Rooms Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Room / Label</th><th className="p-3">Category</th><th className="p-3">Floor</th><th className="p-3">Nightly Rate</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rooms.map(r => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{r.display_label}</td>
                    <td className="p-3">{r.attributes?.room_type || 'Suite'}</td>
                    <td className="p-3 font-mono">Floor {r.attributes?.floor || '1'}</td>
                    <td className="p-3 font-bold text-purple-300">${r.attributes?.nightly_rate || 250}/night</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300">{r.attributes?.status || 'VACANT'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(r.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 2. 🏛️ IRS NIGERIA TAX INTELLIGENCE SUITE
  if (path.includes('/irs/')) {
    const taxpayers = entities.filter(e => e.entity_type_id?.includes('taxpayer') || e.attributes?.tin_number);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Landmark className="w-4 h-4" /> Internal Revenue Service of Nigeria (IRS) Suite
            </div>
            <h2 className="text-3xl font-extrabold text-white">Taxpayer Compliance & POS Evasion Intelligence</h2>
            <p className="text-slate-400 mt-1">Manage TIN taxpayer records, cross-reference POS settlements, and trigger tax evasion audits.</p>
          </div>
          <button onClick={() => { setModalType('taxpayer'); setShowModal(true); setFormData({ tin_number: `TIN-NG-${Math.floor(10000000 + Math.random() * 90000000)}`, lga_zone: 'Ikeja LGA' }); }} className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Taxpayer TIN
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-green-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-green-400" /> AI Tax Evasion Reasoning</h3>
            <div className="flex gap-2">
              <button onClick={() => handleExecuteSkill('module_nigeria_irs:detect_tax_evasion_anomalies', { tin: 'TIN-NG-99201482', lga: 'Ikeja' })} disabled={submitting} className="px-3.5 py-2 rounded-xl bg-green-600/30 text-green-200 text-xs font-bold border border-green-500/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Run POS vs VAT Evasion Anomaly Radar
              </button>
              <button onClick={() => handleExecuteSkill('module_nigeria_irs:predict_lga_tax_yield', { state: 'Lagos' })} disabled={submitting} className="px-3.5 py-2 rounded-xl bg-teal-600/30 text-teal-200 text-xs font-bold border border-teal-500/30 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" /> Predict LGA Revenue Yield
              </button>
            </div>
          </div>

          {skillResult && skillResult.skillId.includes('nigeria_irs') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-green-200 text-xs font-mono overflow-x-auto border border-green-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-green-400" /> Registered Taxpayer TIN Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Business Name</th><th className="p-3">TIN Number</th><th className="p-3">LGA Zone</th><th className="p-3">Turnover</th><th className="p-3">Audit Risk</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {taxpayers.map(t => (
                  <tr key={t.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{t.attributes?.name || t.display_label}</td>
                    <td className="p-3 font-mono text-green-300">{t.attributes?.tin_number || 'TIN-NG-99201482'}</td>
                    <td className="p-3">{t.attributes?.lga_zone || 'Ikeja LGA'}</td>
                    <td className="p-3 font-bold text-slate-200">₦{Number(t.attributes?.declared_turnover || 45000000).toLocaleString()}.00</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">HIGH_RISK</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(t.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. 🛒 RETAIL & LOSS PREVENTION MODULE SUITE
  if (path.includes('/retail/')) {
    const posLanes = entities.filter(e => e.entity_type_id?.includes('pos') || e.attributes?.cashier_name);
    const skus = entities.filter(e => e.entity_type_id?.includes('inventory') || e.attributes?.sku_code);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
              <ShoppingBag className="w-4 h-4" /> Retail & Loss Prevention Suite
            </div>
            <h2 className="text-3xl font-extrabold text-white">POS Cashier & Inventory Shrinkage Radar</h2>
            <p className="text-slate-400 mt-1">Monitor POS cashier terminals, inventory shrinkage SKUs, and CCTV barcode scanner skips.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setModalType('retail_pos'); setShowModal(true); setFormData({ lane_number: '1', cashier_name: 'Blessing Okon', void_count: 14 }); }} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register POS Lane
            </button>
            <button onClick={() => { setModalType('inventory_sku'); setShowModal(true); setFormData({ sku_code: `SKU-${Math.floor(1000 + Math.random() * 9000)}`, shrinkage_units: 6 }); }} className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Log Inventory SKU
            </button>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-amber-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-400" /> AI Loss Prevention Actions</h3>
            <button onClick={() => handleExecuteSkill('module_retail:detect_loss_prevention_anomalies', { store_id: 'Store-01' })} disabled={submitting} className="px-4 py-2 rounded-xl bg-amber-600/30 text-amber-200 text-xs font-bold border border-amber-500/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Run POS Cashier Refund Exception Radar
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('retail') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-amber-200 text-xs font-mono overflow-x-auto border border-amber-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
          <button onClick={() => handleSimulateSignal('pos_scanner', 'barcode_scanner_skip', 'Checkout Lane 3 Camera', { lane: '3', item_skipped: 'Sony Headphones' }, 'HIGH', 70)} disabled={submitting} className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl">
            <ShoppingBag className="w-4 h-4" /> Simulate CCTV Barcode Scanner Skip Alert
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-400" /> POS Checkout Lanes & Cashiers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Checkout Lane</th><th className="p-3">Cashier Name</th><th className="p-3">Refund / Void Ratio</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {posLanes.map(p => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{p.display_label}</td>
                    <td className="p-3">{p.attributes?.cashier_name || 'Cashier'}</td>
                    <td className="p-3 font-mono text-amber-300">{p.attributes?.void_count || 4} voids today</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(p.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. 🏡 RESIDENTIAL ESTATE SECURITY MODULE SUITE
  if (path.includes('/estate/')) {
    const residents = entities.filter(e => e.entity_type_id?.includes('resident') || e.attributes?.plot_number);
    const vehicles = entities.filter(e => e.entity_type_id?.includes('alpr') || e.attributes?.plate_number);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Shield className="w-4 h-4" /> Residential Estate Security Suite
            </div>
            <h2 className="text-3xl font-extrabold text-white">Access Control, ALPR & Guard Patrol Radar</h2>
            <p className="text-slate-400 mt-1">Manage resident access codes, ALPR vehicle recognition, and visitor gate overstay alarms.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setModalType('resident'); setShowModal(true); setFormData({ plot_number: 'Plot 42', resident_name: 'Engr. Emeka Nnamdi' }); }} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register Resident
            </button>
            <button onClick={() => { setModalType('alpr'); setShowModal(true); setFormData({ plate_number: 'LND-994-AB', make_model: 'Toyota Prado' }); }} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2">
              <Car className="w-4 h-4" /> Register ALPR Vehicle
            </button>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-indigo-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /> AI Estate Security Copilot</h3>
            <button onClick={() => handleExecuteSkill('module_estate:analyze_visitor_traversal', { visitor_id: 'VIS-9940' })} disabled={submitting} className="px-4 py-2 rounded-xl bg-indigo-600/30 text-indigo-200 text-xs font-bold border border-indigo-500/30 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" /> Analyze Visitor Traversal & Overstay
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('estate') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-indigo-200 text-xs font-mono overflow-x-auto border border-indigo-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
          <button onClick={() => handleSimulateSignal('alpr_camera', 'unregistered_vehicle_scan', 'Main Estate Gate', { plate: 'UNKNOWN-PLATE-88', camera: 'CAM-01-ENTRANCE' }, 'HIGH', 80)} disabled={submitting} className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl">
            <Car className="w-4 h-4" /> Simulate ALPR License Plate Recognition Alert
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Home className="w-5 h-5 text-indigo-400" /> Registered Estate Residents & Plots</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Plot / Address</th><th className="p-3">Resident Name</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {residents.map(r => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{r.display_label}</td>
                    <td className="p-3">{r.attributes?.resident_name || 'Resident'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(r.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 5. 🏥 HEALTHCARE & HOSPITAL OPERATIONAL MODULE SUITE
  if (path.includes('/hospital/')) {
    const patients = entities.filter(e => e.entity_type_id?.includes('patient') || e.attributes?.patient_id);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Stethoscope className="w-4 h-4" /> Healthcare & Hospital Operational Suite
            </div>
            <h2 className="text-3xl font-extrabold text-white">Emergency Department & Patient Flow Triage</h2>
            <p className="text-slate-400 mt-1">Manage ward bed occupancy, emergency department wait-time bottlenecks, and nurse staffing forecasts.</p>
          </div>
          <button onClick={() => { setModalType('patient'); setShowModal(true); setFormData({ patient_id: `PAT-${Math.floor(1000 + Math.random() * 9000)}`, triage_level: 'Urgent' }); }} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Patient
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-rose-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-rose-400" /> AI Hospital Triage Copilot</h3>
            <button onClick={() => handleExecuteSkill('module_hospital:patient_flow_bottlenecks', { ward: 'Emergency Ward' })} disabled={submitting} className="px-4 py-2 rounded-xl bg-rose-600/30 text-rose-200 text-xs font-bold border border-rose-500/30 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-400" /> Analyze ER Wait-Time Bottlenecks
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('hospital') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-rose-200 text-xs font-mono overflow-x-auto border border-rose-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-rose-400" /> Admitted Patients Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Patient Name</th><th className="p-3">Patient ID</th><th className="p-3">Triage Level</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{p.display_label}</td>
                    <td className="p-3 font-mono text-rose-300">{p.attributes?.patient_id || 'PAT-9014'}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">{p.attributes?.triage_level || 'Urgent'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(p.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 6. 📖 BIBLE TRANSLATION & FIELD IMPACT MODULE SUITE
  if (path.includes('/bible_translation/')) {
    const languages = entities.filter(e => e.entity_type_id?.includes('language') || e.attributes?.language_name);

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
              <BookOpen className="w-4 h-4" /> Bible Translation & Field Impact Suite
            </div>
            <h2 className="text-3xl font-extrabold text-white">Language Catalog & Field Translation Progress</h2>
            <p className="text-slate-400 mt-1">Track translation progress per language, field incident logs, and donor impact statements.</p>
          </div>
          <button onClick={() => { setModalType('language'); setShowModal(true); setFormData({ language_name: 'Yoruba (Dialect Focus)', region: 'West Africa' }); }} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Language
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-emerald-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-400" /> AI Translation & Impact Actions</h3>
            <button onClick={() => handleExecuteSkill('module_bible_translation:analyze_translation_progress', { project_id: 'YOR-NT-01' })} disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600/30 text-emerald-200 text-xs font-bold border border-emerald-500/30 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Analyze Translation Completion Rate
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('bible_translation') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-emerald-200 text-xs font-mono overflow-x-auto border border-emerald-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-400" /> Active Language Catalog</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Language Name</th><th className="p-3">Region</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {languages.map(l => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{l.display_label}</td>
                    <td className="p-3 text-emerald-300">{l.attributes?.region || 'Global'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(l.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT FALLBACK
  return <div className="p-8 text-white">Select an industry module from the sidebar navigation.</div>;
}
