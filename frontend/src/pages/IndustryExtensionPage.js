import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Hotel, Landmark, ShoppingBag, ShieldAlert, Key, Star, FileText, 
  AlertTriangle, TrendingUp, CheckCircle2, User, Building, MapPin, Loader2, Sparkles, 
  Plus, Trash2, Shield, RefreshCw, CreditCard, Layers, Clock, DollarSign, Check, X, Search,
  Home, Car, Activity, Stethoscope, BookOpen, HeartPulse, UserCheck, Eye, Zap, AlertCircle, Heart, Users, Settings, Wrench, Package, BarChart2, Coffee
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';

import Reservations from './Hotels/Reservations';
import FrontDesk from './Hotels/FrontDesk';
import RoomsDirectory from './Hotels/RoomsDirectory';
import Housekeeping from './Hotels/Housekeeping';
import Maintenance from './Hotels/Maintenance';
import Restaurant from './Hotels/Restaurant';
import Inventory from './Hotels/Inventory';
import Finance from './Hotels/Finance';
import Analytics from './Hotels/Analytics';

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
    // CHURCH
    else if (modalType === 'church_member') {
      entityTypeCode = 'church_member';
      displayLabel = `${formData.name} (${formData.membership_status || 'Member'})`;
    }
    // GOVERNMENT
    else if (modalType === 'gov_case') {
      entityTypeCode = 'gov_case';
      displayLabel = `Case #${formData.case_number}: ${formData.title}`;
    }
    // MANUFACTURING
    else if (modalType === 'machine_asset') {
      entityTypeCode = 'machine_asset';
      displayLabel = `${formData.machine_name} (${formData.serial_number})`;
    }
    // EDUCATION
    else if (modalType === 'student_record') {
      entityTypeCode = 'student_record';
      displayLabel = `${formData.student_name} (ID: ${formData.student_id})`;
    }
    // AGRICULTURE
    else if (modalType === 'farm_field') {
      entityTypeCode = 'farm_field';
      displayLabel = `${formData.field_name} (${formData.crop_type})`;
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

  const renderRegistrationModal = () => {
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="glass p-6 rounded-3xl border border-white/10 w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-xl font-extrabold text-white capitalize">Register {modalType.replace('_', ' ')}</h3>
            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreateEntity} className="space-y-4 text-xs">
            {/* HOTELS FIELDS */}
            {modalType === 'room' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Room Number</label>
                  <input type="text" name="room_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 302" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Room Type</label>
                  <select name="room_type" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="">Select Type</option>
                    <option value="Standard">Standard</option>
                    <option value="Deluxe">Deluxe</option>
                    <option value="Suite">Suite</option>
                    <option value="Penthouse">Penthouse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Floor</label>
                  <input type="number" name="floor" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 3" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Housekeeping Status</label>
                  <select name="housekeeping" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Clean">Clean</option>
                    <option value="Dirty">Dirty</option>
                    <option value="Inspect">Inspect</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Occupancy Status</label>
                  <select name="occupancy" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Checked-In">Checked-In</option>
                    <option value="Out">Out</option>
                    <option value="Hold">Hold</option>
                  </select>
                </div>
              </>
            )}
            {modalType === 'keycard' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Keycard RFID Code</label>
                  <input type="text" name="keycard_rfid" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. RFID-9920-A" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Assigned Room</label>
                  <input type="text" name="assigned_room" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Room 302" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Guest Name</label>
                  <input type="text" name="guest_name" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. John Doe" />
                </div>
              </>
            )}
            {modalType === 'vip' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Guest Full Name</label>
                  <input type="text" name="name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Princess Adedoyin" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">VIP Status Category</label>
                  <select name="vip_status" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="VIP Tier 1">VIP Tier 1</option>
                    <option value="VIP Tier 2">VIP Tier 2</option>
                    <option value="Celebrity VVIP">Celebrity VVIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Folio Invoicing Item Summary</label>
                  <input type="text" name="folio_invoices" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Room: $350, Spa: $120, Dining: $95" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Reservation Progress State</label>
                  <select name="reservation_state" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Reserved">Reserved</option>
                    <option value="Checked-In">Checked-In</option>
                    <option value="Out">Out</option>
                    <option value="Hold">Hold</option>
                  </select>
                </div>
              </>
            )}

            {/* IRS NIGERIA */}
            {modalType === 'taxpayer' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Taxpayer Full Name / Corporate Name</label>
                  <input type="text" name="name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Dangote Group" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">TIN Number (Taxpayer Identification Number)</label>
                  <input type="text" name="tin_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. TIN-88290-NG" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Income Tax Clearance Certificate ID</label>
                  <input type="text" name="tax_clearance_id" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. TCC-908122" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Audit Progression State</label>
                  <select name="audit_progression" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Audit Notified">Audit Notified</option>
                    <option value="Pending POS Matches">Pending POS Matches</option>
                    <option value="Audit Cleared">Audit Cleared</option>
                  </select>
                </div>
              </>
            )}
            {modalType === 'pos' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Terminal ID</label>
                  <input type="text" name="terminal_id" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. POS-LAG-009" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Merchant Name</label>
                  <input type="text" name="merchant_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Mega Plaza Supermarket" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">LGA Revenue Yield</label>
                  <input type="number" name="lga_yield" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 550000" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Settlement Date</label>
                  <input type="date" name="settlement_date" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500" />
                </div>
              </>
            )}

            {/* RETAIL */}
            {modalType === 'retail_pos' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Lane Number</label>
                  <input type="text" name="lane_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Lane 01" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Cashier Name</label>
                  <input type="text" name="cashier_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Blessing Okon" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">CCTV Scan Status Flag</label>
                  <select name="cctv_scan_flag" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Normal">Normal Scan</option>
                    <option value="Skipped">Barcode Skip Flagged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Refund / Void Ratio (%)</label>
                  <input type="number" step="0.1" name="void_ratio" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 2.4" />
                </div>
              </>
            )}
            {modalType === 'inventory_sku' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">SKU Code</label>
                  <input type="text" name="sku_code" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. SKU-BEV-COLL-09" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Product Name</label>
                  <input type="text" name="product_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Coca-Cola Pack of 24" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Supplier Name</label>
                  <input type="text" name="supplier_name" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Coca-Cola Hellenic" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Supplier Purchase Order Stream</label>
                  <input type="text" name="purchase_order_stream" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. PO-8921: 50 units, PO-8994: 100 units" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Returns Tracking & History</label>
                  <input type="text" name="returns_history" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 2 units returned due to damage" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Customer Loyalty Points Rate</label>
                  <input type="number" name="loyalty_points" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 10" />
                </div>
              </>
            )}

            {/* ESTATE */}
            {modalType === 'resident' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Plot / Flat Number</label>
                  <input type="text" name="plot_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Plot 14, Phase 2" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Resident Name</label>
                  <input type="text" name="resident_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Chief Frank Okeke" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Rent Ledger Status</label>
                  <select name="rent_ledger" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Paid">Paid (Current Month)</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </>
            )}
            {modalType === 'alpr' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Vehicle Plate Number</label>
                  <input type="text" name="plate_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. LAG-994-AA" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Vehicle Make / Model</label>
                  <input type="text" name="make_model" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Toyota Prado Black" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Visitor Pass Expiration Date</label>
                  <input type="datetime-local" name="visitor_pass_expiration" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500" />
                </div>
              </>
            )}

            {/* HOSPITAL */}
            {modalType === 'patient' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Patient Name</label>
                  <input type="text" name="name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Dr. Ngozi Balogun" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Patient ID</label>
                  <input type="text" name="patient_id" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. PAT-9081" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Triage Category Level</label>
                  <select name="triage_level" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Normal">Normal Care</option>
                    <option value="Urgent">Urgent Triage</option>
                    <option value="Critical">Critical ER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">EHR Clinical Progress Notes</label>
                  <textarea name="ehr_notes" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 h-20" placeholder="e.g. Patient presents with elevated heart rate, administered beta-blocker." />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Ward Bed Allocation</label>
                  <input type="text" name="ward_bed_allocation" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Ward C, Bed 04" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Radiology / Lab Test Orders</label>
                  <input type="text" name="lab_orders" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Full Blood Count, ECG" />
                </div>
              </>
            )}
            {modalType === 'bed' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Ward Name</label>
                  <input type="text" name="ward_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Intensive Care Unit" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Bed Number</label>
                  <input type="text" name="bed_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Bed 12" />
                </div>
              </>
            )}

            {/* BIBLE TRANSLATION */}
            {modalType === 'language' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Language Focus Name</label>
                  <input type="text" name="language_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Yoruba (Main Dialect)" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Geographic Region</label>
                  <input type="text" name="region" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. West Africa" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Team Review Workflow Stage</label>
                  <select name="review_stage" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Draft">Drafting Phase</option>
                    <option value="Review">Internal Peer Review</option>
                    <option value="Community Check">Community Checking</option>
                    <option value="Approved">Approved Translation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Translation Audio Track File Reference URL</label>
                  <input type="text" name="audio_track_url" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. s3://bible-audio/yor-01.mp3" />
                </div>
              </>
            )}

            {/* CHURCH */}
            {modalType === 'church_member' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Member Name</label>
                  <input type="text" name="name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Sister Deborah Alao" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Membership Status</label>
                  <select name="membership_status" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Active Member">Active Member</option>
                    <option value="Visitor">Visitor</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Volunteer Schedule Assignment</label>
                  <input type="text" name="volunteer_schedule" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Sunday Usher 1st Service" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Contribution / Giving Ledger (NGN)</label>
                  <input type="number" name="giving_record" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 50000" />
                </div>
              </>
            )}

            {/* GOVERNMENT */}
            {modalType === 'gov_case' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Case Title</label>
                  <input type="text" name="title" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Land Title Allocation Audit" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Case Number</label>
                  <input type="text" name="case_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. CASE-8812" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Priority Level</label>
                  <select name="priority" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Normal">Normal Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Case Allocation (Assigned Investigator)</label>
                  <input type="text" name="case_allocation" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Inspector Yusuf Ojo" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Audit / Case Progress Step</label>
                  <select name="progress_step" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Investigation">Under Active Investigation</option>
                    <option value="Review">Under Panel Review</option>
                    <option value="Resolved">Resolved & Cleared</option>
                  </select>
                </div>
              </>
            )}

            {/* MANUFACTURING */}
            {modalType === 'machine_asset' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Machine Asset Name</label>
                  <input type="text" name="machine_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. CNC Mill A" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Serial Number</label>
                  <input type="text" name="serial_number" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. SN-MILL-992" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Temperature Sensor Threshold (°C)</label>
                  <input type="number" name="temp_sensor" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 78" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">OEE Score (%)</label>
                  <input type="number" name="oee_score" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 84" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Active Shift Operator</label>
                  <input type="text" name="operator_name" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Yusuf Bello" />
                </div>
              </>
            )}

            {/* EDUCATION */}
            {modalType === 'student_record' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Student Full Name</label>
                  <input type="text" name="student_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Daniel Nnamdi" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Student Matric ID</label>
                  <input type="text" name="student_id" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. EDU-STUD-554" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Enrolled Course / Department</label>
                  <input type="text" name="course_enrolled" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. B.Sc. Computer Science" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Attendance Drop Risk State</label>
                  <select name="attendance_risk" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Low">Low Risk</option>
                    <option value="High">High Risk (Follow-up Needed)</option>
                  </select>
                </div>
              </>
            )}

            {/* AGRICULTURE */}
            {modalType === 'farm_field' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Field / Sector Name</label>
                  <input type="text" name="field_name" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. Field Alpha-1" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Crop Type Focus</label>
                  <input type="text" name="crop_type" required onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. White Cassava" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Soil Moisture Sensor (%)</label>
                  <input type="number" name="moisture_pct" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 42" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Weather Irrigation Cycle Plan</label>
                  <select name="irrigation_cycle" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-slate-300 outline-none focus:border-indigo-500">
                    <option value="Morning Plan">Morning Plan</option>
                    <option value="Evening Plan">Evening Plan</option>
                    <option value="Rain Delay Skipped">Rain Delay Skipped</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Crop Yield Projection (Tons)</label>
                  <input type="number" step="0.1" name="yield_projection" onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g. 12.5" />
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end border-t border-white/10 pt-4 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Save Record
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader message="Loading Operational Suite..." /></div>;

  // 1. 🏨 HOTELS & HOSPITALITY MODULE SUITE
  if (path.includes('/hotels/')) {
    if (path.includes('/hotels/reservations')) {
      return <Reservations orgId={orgId} />;
    }
    if (path.includes('/hotels/frontdesk')) {
      return <FrontDesk orgId={orgId} />;
    }
    if (path.includes('/hotels/rooms')) {
      return <RoomsDirectory orgId={orgId} />;
    }

    if (path.includes('/hotels/housekeeping')) {
      return <Housekeeping orgId={orgId} />;
    }
    if (path.includes('/hotels/maintenance')) {
      return <Maintenance orgId={orgId} />;
    }
    if (path.includes('/hotels/restaurant')) {
      return <Restaurant orgId={orgId} />;
    }
    if (path.includes('/hotels/inventory')) {
      return <Inventory orgId={orgId} />;
    }
    if (path.includes('/hotels/finance')) {
      return <Finance orgId={orgId} />;
    }
    if (path.includes('/hotels/analytics')) {
      return <Analytics orgId={orgId} />;
    }

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
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Hotel className="w-5 h-5 text-purple-400" /> Registered Hotel Rooms Directory (Opera/Mews Spec)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Room</th><th className="p-3">Type</th><th className="p-3">Floor</th><th className="p-3">Housekeeping</th><th className="p-3">Occupancy</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rooms.map(r => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{r.display_label}</td>
                    <td className="p-3">{r.attributes?.room_type || 'Suite'}</td>
                    <td className="p-3 font-mono">Floor {r.attributes?.floor || '1'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">{r.attributes?.housekeeping || 'Clean'}</span></td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">{r.attributes?.occupancy || 'Available'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(r.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Guests Table */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Star className="w-5 h-5 text-purple-400" /> Guest Folio Invoicing & Reservation States</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Guest Name</th><th className="p-3">VIP Status</th><th className="p-3">Reservation State</th><th className="p-3">Folio Charges</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {vips.map(v => (
                  <tr key={v.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{v.display_label}</td>
                    <td className="p-3 text-amber-300">{v.attributes?.vip_status || 'VIP Tier 1'}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">{v.attributes?.reservation_state || 'Reserved'}</span></td>
                    <td className="p-3 font-mono text-purple-300">{v.attributes?.folio_invoices || 'None'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(v.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
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
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{t.attributes?.audit_progression || 'Audit Notified'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(t.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
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

        {/* Live Inventory SKUs Table */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-amber-400" /> Active SKU Inventory Directory (Lightspeed/Shopify POS Spec)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Product Name</th><th className="p-3">SKU Code</th><th className="p-3">Supplier</th><th className="p-3">Purchase Orders</th><th className="p-3">Returns History</th><th className="p-3">Loyalty Points</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {skus.map(s => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{s.display_label}</td>
                    <td className="p-3 font-mono text-amber-300">{s.attributes?.sku_code || 'SKU-001'}</td>
                    <td className="p-3">{s.attributes?.supplier_name || 'Generic Supplier'}</td>
                    <td className="p-3 font-mono text-slate-300">{s.attributes?.purchase_order_stream || 'None'}</td>
                    <td className="p-3 font-mono text-rose-300">{s.attributes?.returns_history || 'None'}</td>
                    <td className="p-3 text-emerald-300">{s.attributes?.loyalty_points || 0} pts</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(s.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
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
                <tr><th className="p-3">Plot / Address</th><th className="p-3">Resident Name</th><th className="p-3">Rent Ledger</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {residents.map(r => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{r.display_label}</td>
                    <td className="p-3">{r.attributes?.resident_name || 'Resident'}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">{r.attributes?.rent_ledger || 'Paid'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(r.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicles & Visitor Passes Table */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Car className="w-5 h-5 text-indigo-400" /> ALPR Vehicles & Visitor Pass Expiration</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Plate Number</th><th className="p-3">Vehicle Details</th><th className="p-3">Visitor Pass Expiration</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white font-mono">{v.display_label}</td>
                    <td className="p-3 text-slate-300">{v.attributes?.make_model || 'Unspecified'}</td>
                    <td className="p-3 font-mono text-indigo-300">{v.attributes?.visitor_pass_expiration || 'Permanent'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(v.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
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
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-rose-400" /> Admitted Patients Directory (Epic/OpenMRS Spec)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Patient Name</th><th className="p-3">Patient ID</th><th className="p-3">Triage</th><th className="p-3">EHR Clinical Notes</th><th className="p-3">Ward Bed</th><th className="p-3">Lab Orders</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{p.display_label}</td>
                    <td className="p-3 font-mono text-rose-300">{p.attributes?.patient_id || 'PAT-9014'}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">{p.attributes?.triage_level || 'Urgent'}</span></td>
                    <td className="p-3 text-slate-300">{p.attributes?.ehr_notes || 'No active notes recorded'}</td>
                    <td className="p-3 font-mono text-rose-300">{p.attributes?.ward_bed_allocation || 'Unassigned'}</td>
                    <td className="p-3 text-cyan-300">{p.attributes?.lab_orders || 'None'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(p.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
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
                <tr><th className="p-3">Language Name</th><th className="p-3">Region</th><th className="p-3">Review Stage</th><th className="p-3">Audio Track</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {languages.map(l => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{l.display_label}</td>
                    <td className="p-3 text-emerald-300">{l.attributes?.region || 'Global'}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">{l.attributes?.review_stage || 'Draft'}</span></td>
                    <td className="p-3 font-mono text-xs text-slate-400">{l.attributes?.audio_track_url || 'No audio recorded'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(l.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // 7. ⛪ CHURCH & MINISTRY SUITE
  if (path.includes('/church/')) {
    const members = entities.filter(e => e.entity_type_id?.includes('church_member'));

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Heart className="w-4 h-4" /> Church & Ministry Operating System
            </div>
            <h2 className="text-3xl font-extrabold text-white">Member Directory, Small Groups & Contribution Ledgers</h2>
            <p className="text-slate-400 mt-1">Manage volunteers, track weekly attendance trends, and schedule pastoral visits.</p>
          </div>
          <button onClick={() => { setModalType('church_member'); setShowModal(true); setFormData({ name: 'Sister Deborah Alao', membership_status: 'Active Member' }); }} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Member
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-rose-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-rose-400" /> AI Pastoral Care Copilot</h3>
            <div className="flex gap-2">
              <button onClick={() => handleExecuteSkill('module_church:summarize_attendance_trends')} disabled={submitting} className="px-4 py-2 rounded-xl bg-rose-600/30 text-rose-200 text-xs font-bold border border-rose-500/30 flex items-center gap-2">
                Analyze Weekly Attendance Trends
              </button>
            </div>
          </div>
          {skillResult && skillResult.skillId.includes('church') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-rose-200 text-xs font-mono overflow-x-auto border border-rose-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-rose-400" /> Active Member Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Member Name</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{m.display_label}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">{m.attributes?.membership_status || 'Active Member'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(m.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // 8. 🏛️ GOVERNMENT & CASES SUITE
  if (path.includes('/government/')) {
    const cases = entities.filter(e => e.entity_type_id?.includes('gov_case'));

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Landmark className="w-4 h-4" /> Government Case Management
            </div>
            <h2 className="text-3xl font-extrabold text-white">Public Case Registry & Investigator Dossiers</h2>
            <p className="text-slate-400 mt-1">Assign investigations, track public incidents, and audit citizen filings.</p>
          </div>
          <button onClick={() => { setModalType('gov_case'); setShowModal(true); setFormData({ case_number: `CASE-${Math.floor(1000 + Math.random() * 9000)}`, title: 'Tax Evasion Inquiry', priority: 'High' }); }} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Log Case File
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-indigo-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /> AI Case Intelligence</h3>
            <button onClick={() => handleExecuteSkill('module_government:analyze_case_load')} disabled={submitting} className="px-4 py-2 rounded-xl bg-indigo-600/30 text-indigo-200 text-xs font-bold border border-indigo-500/30 flex items-center gap-2">
              Analyze Investigator Caseloads
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('government') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-indigo-200 text-xs font-mono overflow-x-auto border border-indigo-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-400" /> Active Investigation Cases</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Case ID / Title</th><th className="p-3">Priority</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {cases.map(c => (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{c.display_label}</td>
                    <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">{c.attributes?.priority || 'Normal'}</span></td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(c.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // 9. ⚙️ MANUFACTURING SUITE
  if (path.includes('/manufacturing/')) {
    const machines = entities.filter(e => e.entity_type_id?.includes('machine'));

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Settings className="w-4 h-4" /> Shopfloor Manufacturing intelligence
            </div>
            <h2 className="text-3xl font-extrabold text-white">Machine Health, OEE Metrics & Quality Control</h2>
            <p className="text-slate-400 mt-1">Monitor CNC machines, track assembly line schedules, and schedule predictive maintenance cycles.</p>
          </div>
          <button onClick={() => { setModalType('machine_asset'); setShowModal(true); setFormData({ machine_name: 'CNC Milling Center A', serial_number: 'SN-MILL-9920', temp_sensor: 78 }); }} className="px-4 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Machine
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-yellow-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-400" /> AI Machine Intelligence</h3>
            <button onClick={() => handleExecuteSkill('module_manufacturing:predictive_maintenance_scheduler')} disabled={submitting} className="px-4 py-2 rounded-xl bg-yellow-600/30 text-yellow-200 text-xs font-bold border border-yellow-500/30 flex items-center gap-2">
              Run Predictive Maintenance Scan
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('manufacturing') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-yellow-200 text-xs font-mono overflow-x-auto border border-yellow-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-yellow-400" /> Registered Factory Assets</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Asset Label</th><th className="p-3">Serial Number</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{m.display_label}</td>
                    <td className="p-3 font-mono text-yellow-300">{m.attributes?.serial_number || 'SN-9014'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(m.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // 10. 🎓 EDUCATION SUITE
  if (path.includes('/education/')) {
    const students = entities.filter(e => e.entity_type_id?.includes('student'));

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Activity className="w-4 h-4" /> Academic & Campus Intelligence
            </div>
            <h2 className="text-3xl font-extrabold text-white">Student Enrollment & Classroom Attendance</h2>
            <p className="text-slate-400 mt-1">Manage academic registries, analyze attendance drops, and coordinate counselor followups.</p>
          </div>
          <button onClick={() => { setModalType('student_record'); setShowModal(true); setFormData({ student_name: 'Daniel Nnamdi', student_id: 'EDU-STUD-5541' }); }} className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Student
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-cyan-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-400" /> AI Student Tutor & Care</h3>
            <button onClick={() => handleExecuteSkill('module_education:analyze_attendance_grades')} disabled={submitting} className="px-4 py-2 rounded-xl bg-cyan-600/30 text-cyan-200 text-xs font-bold border border-cyan-500/30 flex items-center gap-2">
              Analyze Attendance-Grades Correlation
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('education') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-cyan-200 text-xs font-mono overflow-x-auto border border-cyan-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-cyan-400" /> Enrolled Students Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Student Name</th><th className="p-3">Student ID</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{s.display_label}</td>
                    <td className="p-3 font-mono text-cyan-300">{s.attributes?.student_id || 'EDU-STUD-901'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(s.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // 11. 🌾 AGRICULTURE SUITE
  if (path.includes('/agriculture/')) {
    const fields = entities.filter(e => e.entity_type_id?.includes('farm_field'));

    return (
      <div className="space-y-8 pb-12 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Layers className="w-4 h-4" /> Smart Agriculture & Farm Management
            </div>
            <h2 className="text-3xl font-extrabold text-white">Fields, Livestock Indexes & Crop Yield projections</h2>
            <p className="text-slate-400 mt-1">Track soil parameters, crop rotation metrics, and schedule machinery maintenance.</p>
          </div>
          <button onClick={() => { setModalType('farm_field'); setShowModal(true); setFormData({ field_name: 'Field Alpha-1', crop_type: 'White Cassava', moisture_pct: 42 }); }} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Field
          </button>
        </div>

        <div className="glass p-6 rounded-3xl border border-emerald-500/30 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-400" /> AI Farm Advisory Copilot</h3>
            <button onClick={() => handleExecuteSkill('module_agriculture:predict_harvest_yield')} disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600/30 text-emerald-200 text-xs font-bold border border-emerald-500/30 flex items-center gap-2">
              Predict Field Yield projections
            </button>
          </div>
          {skillResult && skillResult.skillId.includes('agriculture') && (
            <pre className="bg-black/50 p-4 rounded-2xl text-emerald-200 text-xs font-mono overflow-x-auto border border-emerald-500/20">{JSON.stringify(skillResult.data, null, 2)}</pre>
          )}
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Active Farm Fields Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                <tr><th className="p-3">Field Label</th><th className="p-3">Crop Type</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {fields.map(f => (
                  <tr key={f.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{f.display_label}</td>
                    <td className="p-3 text-emerald-300">{f.attributes?.crop_type || 'Cassava'}</td>
                    <td className="p-3 text-right"><button onClick={() => handleDeleteEntity(f.id)} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderRegistrationModal()}
      </div>
    );
  }

  // DEFAULT FALLBACK
  return <div className="p-8 text-white">Select an industry module from the sidebar navigation.</div>;
}

