import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase, ShoppingBag, Calendar, CheckSquare, FileText,
  AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, User, Users,
  Sparkles, Plus, RefreshCw, DollarSign, X, Zap, AlertCircle,
  Package, ArrowRight, ShieldAlert, Sliders, Play, Building,
  ChevronRight, Info, Settings, Loader2
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const PRESET_OPTIONS = [
  { id: 'beauty', name: 'Beauty & Wellness', icon: '🌸', desc: 'Salons, spas, estheticians, wellness studios with booking & retail.' },
  { id: 'consulting', name: 'Consulting & Professional Services', icon: '💼', desc: 'Agencies, law firms, accounting, coaches with retainers & project milestones.' },
  { id: 'fashion', name: 'Fashion & Custom Apparel', icon: '👗', desc: 'Designers, boutiques, tailors with custom measurements & fabric procurement.' },
  { id: 'printing', name: 'Commercial Printing & Merchandise', icon: '🖨️', desc: 'Custom print shops, packaging, promotional items with quote-to-order flow.' },
  { id: 'cleaning', name: 'Commercial Cleaning & Facilities', icon: '🧹', desc: 'Janitorial, residential cleaning, facility care with recurring dispatch & chemical stock.' }
];

const SKILL_LIST = [
  { key: 'daily_business_brief', name: 'Daily Business Brief', category: 'Executive', desc: 'Aggregated revenue, overdue receivables, low-stock warnings, and urgent tasks for today.' },
  { key: 'sales_pipeline_analyzer', name: 'Sales Pipeline Analyzer', category: 'CRM', desc: 'Analyzes active leads across stages and projects expected pipeline conversion value.' },
  { key: 'clv_estimator', name: 'Customer Lifetime Value (CLV)', category: 'CRM', desc: 'Calculates historical spend, order frequencies, and projected customer value tiers.' },
  { key: 'churn_risk_detector', name: 'Churn Risk Detector', category: 'CRM', desc: 'Flags customers with no purchases or appointments in the past 60 days.' },
  { key: 'top_customer_identifier', name: 'Top Customer Identifier', category: 'CRM', desc: 'Ranks top 10% revenue-generating accounts and VIP client profiles.' },
  { key: 'inactive_customer_reengagement', name: 'Inactive Re-engagement Recommendations', category: 'CRM', desc: 'Generates targeted win-back campaign prompts for dormant accounts.' },
  { key: 'revenue_trend_analyzer', name: 'Revenue Trend Analyzer', category: 'Finance', desc: 'Breaks down paid vs unpaid invoice ratios and operational cash inflow velocity.' },
  { key: 'outstanding_payment_analyzer', name: 'Outstanding Payment & Aging Analyzer', category: 'Finance', desc: 'Classifies receivables into 0-15, 16-30, and 30+ day overdue buckets.' },
  { key: 'expense_anomaly_detector', name: 'Expense Anomaly Detector', category: 'Finance', desc: 'Audits recent expenditures for unusual single transactions and category spikes.' },
  { key: 'fast_slow_moving_inventory', name: 'Fast vs Slow Moving Inventory', category: 'Inventory', desc: 'Identifies velocity items needing reorder vs dead inventory tying up capital.' },
  { key: 'appointment_no_show_analyzer', name: 'Appointment No-Show Analyzer', category: 'Scheduling', desc: 'Evaluates no-show frequencies and missed revenue impact across service tiers.' },
  { key: 'service_utilization_rate', name: 'Service Utilization Rate', category: 'Scheduling', desc: 'Measures scheduled booking hours against total operational capacity.' },
  { key: 'operational_bottleneck_detector', name: 'Operational Bottleneck Detector', category: 'Operations', desc: 'Flags overdue tasks, unfulfilled orders, and delayed project milestones.' },
  { key: 'supplier_lead_time_performance', name: 'Supplier Lead Time Performance', category: 'Procurement', desc: 'Ranks suppliers by delivery lead times and procurement spend distribution.' },
  { key: 'quote_to_order_conversion', name: 'Quote-to-Order Conversion Rate', category: 'Sales', desc: 'Measures sales proposal win rates and lost deal friction factors.' },
  { key: 'owner_attention_prioritizer', name: 'Owner Attention Prioritizer', category: 'Executive', desc: 'Synthesizes urgent cross-department issues into an actionable 5-item triage queue.' }
];

export default function SMEWorkspace() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const orgId = currentUser?.business_id || currentUser?.email || 'default';

  // Derive active tab from URL pathname to stay in 100% sync with sidebar
  const getTabFromPath = useCallback((p) => {
    if (p.includes('/sme/crm') || p.includes('/sme/customers')) return 'customers';
    if (p.includes('/sme/orders')) return 'orders';
    if (p.includes('/sme/products') || p.includes('/sme/inventory')) return 'inventory';
    if (p.includes('/sme/services') || p.includes('/sme/appointments')) return 'appointments';
    if (p.includes('/sme/finance')) return 'finance';
    if (p.includes('/sme/projects')) return 'projects';
    if (p.includes('/sme/intelligence') || p.includes('/sme/signals')) return 'intelligence';
    if (p.includes('/sme/settings') || p.includes('/sme/config')) return 'settings';
    return 'overview';
  }, []);

  const activeTab = getTabFromPath(pathname);

  // Tab navigation handler
  const handleTabClick = (tabId) => {
    const tabToPath = {
      overview: '/dashboard/sme/overview',
      customers: '/dashboard/sme/crm',
      orders: '/dashboard/sme/orders',
      inventory: '/dashboard/sme/products',
      appointments: '/dashboard/sme/services',
      finance: '/dashboard/sme/finance',
      projects: '/dashboard/sme/projects',
      intelligence: '/dashboard/sme/intelligence',
      settings: '/dashboard/sme/settings'
    };
    navigate(tabToPath[tabId] || '/dashboard/sme/overview');
  };

  // Core Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [attentionItems, setAttentionItems] = useState([]);
  const [smeConfig, setSmeConfig] = useState(null);

  // Entities & Activity
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Intelligence Skill Execution
  const [activeSkill, setActiveSkill] = useState('daily_business_brief');
  const [executingSkill, setExecutingSkill] = useState(false);
  const [skillResult, setSkillResult] = useState(null);

  // Modals & Forms
  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

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

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch initial dashboard overview & config
  const fetchOverviewData = useCallback(async () => {
    try {
      const [ovRes, attRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/sme/dashboard/overview?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE_URL}/api/v1/sme/attention?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE_URL}/api/v1/sme/config?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
      ]);

      if (ovRes.ok) {
        const data = await ovRes.json();
        setOverview(data);
      }
      if (attRes.ok) {
        const attData = await attRes.json();
        setAttentionItems(attData.items || []);
      }
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setSmeConfig(cfgData);
      }
    } catch (err) {
      console.error('Error fetching SME overview:', err);
    }
  }, [orgId]);

  // Tab specific entity fetchers
  const fetchTabEntities = useCallback(async (tab) => {
    try {
      if (tab === 'customers') {
        const [cRes, lRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/customers?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/leads?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (cRes.ok) {
          const cData = await cRes.json();
          setCustomers(Array.isArray(cData) ? cData : (cData.items || []));
        }
        if (lRes.ok) {
          const lData = await lRes.json();
          setLeads(Array.isArray(lData) ? lData : (lData.items || []));
        }
      } else if (tab === 'orders') {
        const [oRes, pRes, cRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/orders?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/products?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/customers?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (oRes.ok) {
          const oData = await oRes.json();
          setOrders(Array.isArray(oData) ? oData : (oData.items || []));
        }
        if (pRes.ok) {
          const pData = await pRes.json();
          setProducts(Array.isArray(pData) ? pData : (pData.items || []));
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          setCustomers(Array.isArray(cData) ? cData : (cData.items || []));
        }
      } else if (tab === 'inventory') {
        const [pRes, mRes, sRes, poRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/products?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/inventory/movements?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/suppliers?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/purchase-orders?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          setProducts(Array.isArray(pData) ? pData : (pData.items || []));
        }
        if (mRes.ok) {
          const mData = await mRes.json();
          setInventoryMovements(Array.isArray(mData) ? mData : (mData.items || []));
        }
        if (sRes.ok) {
          const sData = await sRes.json();
          setSuppliers(Array.isArray(sData) ? sData : (sData.items || []));
        }
        if (poRes.ok) {
          const poData = await poRes.json();
          setPurchaseOrders(Array.isArray(poData) ? poData : (poData.items || []));
        }
      } else if (tab === 'appointments') {
        const [sRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/services?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/appointments?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (sRes.ok) {
          const sData = await sRes.json();
          setServices(Array.isArray(sData) ? sData : (sData.items || []));
        }
        if (aRes.ok) {
          const aData = await aRes.json();
          setAppointments(Array.isArray(aData) ? aData : (aData.items || []));
        }
      } else if (tab === 'finance') {
        const [iRes, eRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/invoices?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/expenses?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (iRes.ok) {
          const iData = await iRes.json();
          setInvoices(Array.isArray(iData) ? iData : (iData.items || []));
        }
        if (eRes.ok) {
          const eData = await eRes.json();
          setExpenses(Array.isArray(eData) ? eData : (eData.items || []));
        }
      } else if (tab === 'projects') {
        const [pRes, tRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/sme/projects?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) }),
          fetch(`${API_BASE_URL}/api/v1/sme/tasks?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          setProjects(Array.isArray(pData) ? pData : (pData.items || []));
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          setTasks(Array.isArray(tData) ? tData : (tData.items || []));
        }
      }
    } catch (err) {
      console.error(`Error loading ${tab} data:`, err);
    }
  }, [orgId]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await fetchOverviewData();
    await fetchTabEntities(activeTab);
    setLoading(false);
  }, [fetchOverviewData, fetchTabEntities, activeTab]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    fetchTabEntities(activeTab);
  }, [activeTab, fetchTabEntities]);

  // Apply Industry Preset
  const handleApplyPreset = async (presetId) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sme/preset?org_id=${encodeURIComponent(orgId)}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ preset_key: presetId, org_id: orgId })
      });
      if (res.ok) {
        showToast(`Preset "${presetId}" applied successfully! Reloading workspace...`);
        await loadAllData();
      } else {
        showToast('Failed to apply preset', 'error');
      }
    } catch (err) {
      console.error('Error applying preset:', err);
      showToast('Error applying preset', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Seed Demo Data
  const handleSeedDemo = async (presetId = 'beauty') => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sme/seed-demo?org_id=${encodeURIComponent(orgId)}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ preset: presetId, org_id: orgId })
      });
      if (res.ok) {
        showToast(`Demo fixtures seeded for ${presetId}! All operational tables populated.`);
        await loadAllData();
      } else {
        showToast('Error seeding demo data', 'error');
      }
    } catch (err) {
      console.error('Error seeding demo fixtures:', err);
      showToast('Failed to seed fixtures', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Deploy Starter Workflows
  const handleDeployWorkflows = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sme/workflows/deploy-starter?org_id=${encodeURIComponent(orgId)}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ org_id: orgId })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Successfully deployed ${data.deployed_count || 15} starter workflows!`);
      } else {
        showToast('Failed to deploy workflows', 'error');
      }
    } catch (err) {
      console.error('Error deploying workflows:', err);
      showToast('Error deploying workflows', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute ARGUS Skill
  const handleRunSkill = async (skillKey) => {
    setExecutingSkill(true);
    setSkillResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sme/skills/execute?org_id=${encodeURIComponent(orgId)}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ skill_id: skillKey, org_id: orgId, params: {} })
      });
      if (res.ok) {
        const data = await res.json();
        setSkillResult(data.result);
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.detail || 'Skill execution returned an error', 'error');
      }
    } catch (err) {
      console.error('Error executing skill:', err);
      showToast('Network error while executing skill', 'error');
    } finally {
      setExecutingSkill(false);
    }
  };

  // Dedicated Resource Creator with specific endpoints
  const handleSaveModalRecord = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let endpoint = '';
      let payload = { org_id: orgId };

      if (modalType === 'new_product') {
        endpoint = `${API_BASE_URL}/api/v1/sme/products?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          name: modalData.display_label,
          sku: modalData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          selling_price: parseFloat(modalData.selling_price || 0),
          cost_price: parseFloat(modalData.cost_price || 0),
          current_stock: parseFloat(modalData.current_stock || 0),
          reorder_threshold: parseFloat(modalData.reorder_threshold || 5)
        };
      } else if (modalType === 'new_customer') {
        endpoint = `${API_BASE_URL}/api/v1/sme/customers?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          name: modalData.display_label,
          email: modalData.email || '',
          phone: modalData.phone || '',
          status: modalData.status || 'ACTIVE',
          total_spend: parseFloat(modalData.total_spend || 0)
        };
      } else if (modalType === 'new_lead') {
        endpoint = `${API_BASE_URL}/api/v1/sme/leads?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          name: modalData.display_label,
          contact_name: modalData.contact_name || '',
          stage: modalData.stage || 'QUALIFIED',
          estimated_value: parseFloat(modalData.estimated_value || 0),
          next_followup_at: modalData.next_followup_at || ''
        };
      } else if (modalType === 'new_order') {
        endpoint = `${API_BASE_URL}/api/v1/sme/orders?org_id=${encodeURIComponent(orgId)}`;
        const qty = Math.max(1, parseFloat(modalData.quantity || 1));
        const unitPrice = parseFloat(modalData.unit_price || (modalData.total_amount ? modalData.total_amount / qty : 0));
        const total = parseFloat(modalData.total_amount !== undefined ? modalData.total_amount : (unitPrice * qty));

        payload = {
          ...payload,
          customer_id: modalData.customer_id || undefined,
          customer_name: modalData.customer_name || 'Direct Customer',
          total_amount: total,
          payment_status: modalData.payment_status || 'PAID',
          payment_method: modalData.payment_method || 'paystack',
          items: modalData.product_name ? [{
            product_id: modalData.product_id || undefined,
            id: modalData.product_id || undefined,
            name: modalData.product_name,
            quantity: qty,
            price: unitPrice
          }] : []
        };
      } else if (modalType === 'new_service') {
        endpoint = `${API_BASE_URL}/api/v1/sme/services?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          name: modalData.display_label,
          price: parseFloat(modalData.price || 0),
          duration_minutes: parseInt(modalData.duration_minutes || 60),
          category: modalData.category || 'General'
        };
      } else if (modalType === 'new_appointment') {
        endpoint = `${API_BASE_URL}/api/v1/sme/appointments?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          customer_name: modalData.customer_name || 'Guest',
          service_name: modalData.service_name || 'Service Session',
          price: parseFloat(modalData.price || 0),
          start_time: modalData.start_time || new Date().toISOString(),
          status: modalData.status || 'CONFIRMED'
        };
      } else if (modalType === 'new_invoice') {
        endpoint = `${API_BASE_URL}/api/v1/sme/invoices?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          customer_name: modalData.customer_name || 'Client',
          amount: parseFloat(modalData.amount || 0),
          due_date: modalData.due_date || '',
          status: modalData.status || 'PENDING'
        };
      } else if (modalType === 'new_expense') {
        endpoint = `${API_BASE_URL}/api/v1/sme/expenses?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          category: modalData.category || 'SUPPLIES',
          amount: parseFloat(modalData.amount || 0),
          description: modalData.description || 'General Business Cost',
          vendor: modalData.vendor || 'Vendor'
        };
      } else if (modalType === 'new_project') {
        endpoint = `${API_BASE_URL}/api/v1/sme/projects?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          title: modalData.display_label,
          client_name: modalData.client_name || 'Client',
          budget: parseFloat(modalData.budget || 0),
          completion_percentage: parseInt(modalData.completion_percentage || 0),
          status: 'ACTIVE'
        };
      } else if (modalType === 'new_task') {
        endpoint = `${API_BASE_URL}/api/v1/sme/tasks?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          display_label: modalData.display_label,
          title: modalData.display_label,
          assignee: modalData.assignee || 'Operations Staff',
          priority: modalData.priority || 'HIGH',
          status: modalData.status || 'TODO',
          due_date: modalData.due_date || ''
        };
      } else if (modalType === 'new_po') {
        endpoint = `${API_BASE_URL}/api/v1/sme/purchase-orders?org_id=${encodeURIComponent(orgId)}`;
        payload = {
          ...payload,
          supplier_name: modalData.supplier_name || 'Primary Supplier',
          total_cost: parseFloat(modalData.total_cost || 0),
          status: 'SUBMITTED',
          items: [{ name: modalData.product_name || 'Raw Stock', quantity: parseFloat(modalData.quantity || 1) }]
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Record saved successfully!');
        setModalType(null);
        await loadAllData();
        if (modalType === 'new_order' || modalType === 'new_po') {
          fetch(`${API_BASE_URL}/api/v1/sme/products?org_id=${encodeURIComponent(orgId)}`, { headers: getAuthHeaders(false) })
            .then(r => r.ok ? r.json() : [])
            .then(pData => setProducts(Array.isArray(pData) ? pData : (pData.items || [])))
            .catch(() => {});
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.detail || 'Failed to save record', 'error');
      }
    } catch (err) {
      console.error('Error saving record:', err);
      showToast('Network error while saving', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-400">Loading SME & Business Operations Workspace...</p>
      </div>
    );
  }

  const modelType = smeConfig?.business_model || 'HYBRID';
  const caps = smeConfig?.capabilities || {};
  const metrics = overview?.metrics || {};

  return (
    <div className="space-y-6 pb-16 animate-fade-in-up">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all transform animate-bounce border ${
          notification.type === 'error' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 backdrop-blur-md' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 backdrop-blur-md'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/20 p-6 rounded-3xl border border-blue-500/20 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Briefcase className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">SME & Business Operations</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-blue-500/30 text-blue-300 border border-blue-500/40">
                  {modelType} MODEL
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ARGUS OS
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Unified commerce, CRM, scheduling, inventory, projects & financial intelligence engine.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="relative group">
            <button className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Presets</span>
            </button>
            <div className="absolute right-0 mt-2 w-64 p-2 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl hidden group-hover:block z-50 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Apply Industry Preset</p>
              {PRESET_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  disabled={submitting}
                  className="w-full text-left p-2 rounded-xl hover:bg-blue-600/20 hover:border-blue-500/30 border border-transparent transition flex items-center gap-2.5"
                >
                  <span className="text-base">{p.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{p.name}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Seed Demo Fixtures */}
          <button
            onClick={() => handleSeedDemo('beauty')}
            disabled={submitting}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Seed Demo Data</span>
          </button>

          {/* Deploy Starter Workflows */}
          <button
            onClick={handleDeployWorkflows}
            disabled={submitting}
            className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 text-xs font-semibold flex items-center gap-1.5 border border-purple-500/30 transition"
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Deploy 15 Workflows</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadAllData}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/10"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top-Level Tabs Navigation (Synced with Sidebar Routes) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/10 text-xs font-semibold scrollbar-none">
        {[
          { id: 'overview', label: 'Command Overview', icon: TrendingUp },
          { id: 'customers', label: 'Customers & Leads', icon: Users },
          { id: 'orders', label: 'Orders & Sales', icon: ShoppingBag },
          { id: 'inventory', label: 'Products & Inventory', icon: Package },
          { id: 'appointments', label: 'Services & Schedule', icon: Calendar },
          { id: 'finance', label: 'Finance & Invoices', icon: DollarSign },
          { id: 'projects', label: 'Projects & Tasks', icon: CheckSquare },
          { id: 'intelligence', label: 'ARGUS Intelligence (16)', icon: Sparkles },
          { id: 'settings', label: 'Model Settings', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: COMMAND OVERVIEW & OWNER ATTENTION ENGINE
          ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Realized Revenue</span>
              <div className="text-xl font-black text-emerald-400">{formatCurrency(metrics.total_revenue || 0)}</div>
              <div className="text-[10px] text-slate-400">Total collected funds</div>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receivables</span>
              <div className="text-xl font-black text-amber-400">{formatCurrency(metrics.total_receivables || 0)}</div>
              <div className="text-[10px] text-amber-400/80 font-medium">Outstanding unpaid</div>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</span>
              <div className="text-xl font-black text-rose-400">{formatCurrency(metrics.total_expenses || 0)}</div>
              <div className="text-[10px] text-slate-400">Operational costs</div>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</span>
              <div className={`text-xl font-black ${(metrics.net_profit || 0) >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                {formatCurrency(metrics.net_profit || 0)}
              </div>
              <div className="text-[10px] text-slate-400">Cash-flow margin</div>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Customers</span>
              <div className="text-xl font-black text-white">{metrics.total_customers || 0}</div>
              <div className="text-[10px] text-slate-400">{metrics.open_leads || 0} open leads</div>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Health</span>
              <div className={`text-xl font-black ${(metrics.low_stock_products || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {metrics.low_stock_products || 0} Low
              </div>
              <div className="text-[10px] text-slate-400">SKUs below threshold</div>
            </div>
          </div>

          {/* Owner Attention Engine - Primary Priority Feed */}
          <div className="glass p-6 rounded-3xl border border-blue-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">Owner Attention Engine</h3>
                  <p className="text-xs text-slate-400">Prioritized operational triage queue generated by ARGUS OS.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                {attentionItems.length} Issues Flagged
              </span>
            </div>

            <div className="space-y-3">
              {attentionItems.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/5 rounded-2xl border border-white/10">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-white">Zero critical alerts</p>
                  <p className="text-[11px] mt-0.5">All inventory, receivables, orders, and appointments are within healthy thresholds.</p>
                </div>
              ) : (
                attentionItems.map((item, idx) => {
                  const isHigh = item.priority === 'HIGH';
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                        isHigh
                          ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`p-2 rounded-xl mt-0.5 ${isHigh ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isHigh ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/30 text-amber-300'
                            }`}>
                              {item.category} • {item.priority}
                            </span>
                            <span className="text-xs font-bold text-white">{item.message}</span>
                          </div>
                          <p className="text-xs text-slate-300">{item.action}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => {
                            if (item.category === 'FINANCE') handleTabClick('finance');
                            else if (item.category === 'INVENTORY') handleTabClick('inventory');
                            else if (item.category === 'SALES') handleTabClick('orders');
                            else if (item.category === 'OPERATIONS') handleTabClick('projects');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 border border-white/10 transition"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Intelligence Teaser */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" /> Appointments & Bookings
                </h4>
                <span className="text-xs text-slate-400">{metrics.pending_appointments || 0} scheduled</span>
              </div>
              <p className="text-xs text-slate-400">
                Service booking engine auto-emits no-show signals and assigns staff capacity.
              </p>
              <button
                onClick={() => handleTabClick('appointments')}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition flex items-center justify-center gap-1.5"
              >
                <span>Open Appointments Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="glass p-5 rounded-3xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" /> Stock & Movement Ledger
                </h4>
                <span className="text-xs text-slate-400">{metrics.total_products || 0} SKUs</span>
              </div>
              <p className="text-xs text-slate-400">
                Orders trigger automatic stock decrements; goods receipts from POs replenish ledger.
              </p>
              <button
                onClick={() => handleTabClick('inventory')}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition flex items-center justify-center gap-1.5"
              >
                <span>Manage Inventory & Suppliers</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="glass p-5 rounded-3xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" /> Operational Projects
                </h4>
                <span className="text-xs text-slate-400">{metrics.active_projects || 0} active</span>
              </div>
              <p className="text-xs text-slate-400">
                Track deliverables, milestone billing, task assignments, and overdue task alerts.
              </p>
              <button
                onClick={() => handleTabClick('projects')}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition flex items-center justify-center gap-1.5"
              >
                <span>View Projects & Tasks</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CUSTOMERS & LEADS (CRM)
          ===================================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Customer Dossier & Lead Pipeline</h2>
              <p className="text-xs text-slate-400">Omnichannel customer profiles, lifetime purchase histories, and prospect stages.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('new_customer');
                  setModalData({ display_label: '', email: '', phone: '', status: 'ACTIVE', total_spend: 0 });
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Customer</span>
              </button>
              <button
                onClick={() => {
                  setModalType('new_lead');
                  setModalData({ display_label: '', contact_name: '', stage: 'QUALIFIED', estimated_value: 150000, next_followup_at: '' });
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Lead</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customers Table */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> Customer Directory ({customers.length})
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Phone / Email</th>
                      <th className="p-3">Total Spend</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customers.length === 0 ? (
                      <tr><td colSpan="4" className="p-6 text-center text-slate-500">No customer records found.</td></tr>
                    ) : (
                      customers.map(c => (
                        <tr key={c.id} className="hover:bg-white/5 transition">
                          <td className="p-3 font-bold text-white">{c.display_label}</td>
                          <td className="p-3 text-slate-400">{c.attributes?.phone || c.attributes?.email || 'N/A'}</td>
                          <td className="p-3 font-mono text-emerald-400">{formatCurrency(c.attributes?.total_spend || 0)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.attributes?.status === 'VIP' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {c.attributes?.status || 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leads Table */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Active Lead Pipeline ({leads.length})
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3">Deal / Contact</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Est. Value</th>
                      <th className="p-3">Follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leads.length === 0 ? (
                      <tr><td colSpan="4" className="p-6 text-center text-slate-500">No active leads found.</td></tr>
                    ) : (
                      leads.map(l => (
                        <tr key={l.id} className="hover:bg-white/5 transition">
                          <td className="p-3 font-bold text-white">
                            <div>{l.display_label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{l.attributes?.contact_name}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                              {l.attributes?.stage || 'NEW'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-emerald-400">{formatCurrency(l.attributes?.estimated_value || 0)}</td>
                          <td className="p-3 text-[11px] text-slate-400">{l.attributes?.next_followup_at || 'None'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: ORDERS & SALES
          ===================================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Orders & Sales Fulfillment</h2>
              <p className="text-xs text-slate-400">Order transactions with automatic inventory deduction and payment tracking.</p>
            </div>
            <button
              onClick={() => {
                const firstProd = products[0];
                const firstCust = customers[0];
                const unitPrice = parseFloat(firstProd?.attributes?.selling_price || 0);
                const stock = firstProd?.attributes?.current_stock !== undefined ? parseFloat(firstProd.attributes.current_stock) : undefined;
                setModalType('new_order');
                setModalData({
                  customer_id: firstCust?.id || '',
                  customer_name: firstCust?.display_label || 'Direct Customer',
                  product_id: firstProd?.id || '',
                  product_name: firstProd?.display_label || '',
                  unit_price: unitPrice,
                  available_stock: stock,
                  quantity: 1,
                  total_amount: unitPrice > 0 ? unitPrice : 0,
                  payment_status: 'PAID',
                  payment_method: 'paystack'
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Order</span>
            </button>
          </div>

          <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.length === 0 ? (
                    <tr><td colSpan="6" className="p-6 text-center text-slate-500">No orders recorded yet.</td></tr>
                  ) : (
                    orders.map(o => (
                      <tr key={o.id} className="hover:bg-white/5 transition">
                        <td className="p-3 font-mono font-bold text-blue-400">{o.id.substring(0, 16)}...</td>
                        <td className="p-3 font-semibold text-white">{o.attributes?.customer_name || 'Walk-in'}</td>
                        <td className="p-3 font-mono text-emerald-400 font-bold">{formatCurrency(o.attributes?.total_amount || 0)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.attributes?.payment_status === 'PAID' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {o.attributes?.payment_status || 'PENDING'}
                          </span>
                        </td>
                        <td className="p-3 capitalize text-slate-400">{o.attributes?.payment_method || 'Cash'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                            {o.attributes?.fulfillment_status || 'DELIVERED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PRODUCTS & INVENTORY
          ===================================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Products, Inventory & Procurement</h2>
              <p className="text-xs text-slate-400">SKU directory, automatic low-stock alarms, suppliers and purchase order receipts.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('new_product');
                  setModalData({
                    display_label: '',
                    sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                    selling_price: 15000,
                    cost_price: 7000,
                    current_stock: 25,
                    reorder_threshold: 5
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product SKU</span>
              </button>
              <button
                onClick={() => {
                  setModalType('new_po');
                  setModalData({ supplier_name: suppliers[0]?.display_label || 'Primary Supplier', product_name: products[0]?.display_label || 'Raw Material', total_cost: 100000, quantity: 20 });
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Purchase Order</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products Catalog */}
            <div className="lg:col-span-2 glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" /> Active Product SKUs ({products.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Cost</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.length === 0 ? (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-500">No products configured.</td></tr>
                    ) : (
                      products.map(p => {
                        const stock = p.attributes?.current_stock || 0;
                        const threshold = p.attributes?.reorder_threshold || 5;
                        const isLow = stock <= threshold && stock > 0;
                        const isOut = stock <= 0;
                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition">
                            <td className="p-3 font-bold text-white">{p.display_label}</td>
                            <td className="p-3 font-mono text-slate-400">{p.attributes?.sku || 'SKU-NONE'}</td>
                            <td className="p-3 font-mono text-emerald-400">{formatCurrency(p.attributes?.selling_price || 0)}</td>
                            <td className="p-3 font-mono text-slate-400">{formatCurrency(p.attributes?.cost_price || 0)}</td>
                            <td className="p-3 font-mono font-bold">{stock} units</td>
                            <td className="p-3">
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">OUT OF STOCK</span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">LOW STOCK</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">HEALTHY</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Movements Feed */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-purple-400" /> Stock Movements Ledger
              </h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {inventoryMovements.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No stock movements recorded.</p>
                ) : (
                  inventoryMovements.map(m => {
                    const isDeduction = (m.attributes?.quantity || 0) < 0;
                    return (
                      <div key={m.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs flex justify-between items-center">
                        <div className="space-y-0.5">
                          <div className="font-bold text-white">{m.attributes?.product_name || m.display_label}</div>
                          <div className="text-[10px] text-slate-400">{m.attributes?.movement_type}</div>
                        </div>
                        <span className={`font-mono font-black text-xs ${isDeduction ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isDeduction ? '' : '+'}{m.attributes?.quantity}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: SERVICES & APPOINTMENTS
          ===================================================================== */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Service Offerings & Scheduling</h2>
              <p className="text-xs text-slate-400">Appointment booking, staff assignments, and automated no-show observation detection.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('new_service');
                  setModalData({ display_label: '', price: 25000, duration_minutes: 60, category: 'General' });
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Service</span>
              </button>
              <button
                onClick={() => {
                  setModalType('new_appointment');
                  setModalData({
                    customer_name: customers[0]?.display_label || 'Walk-in Guest',
                    service_name: services[0]?.display_label || 'Standard Session',
                    price: 25000,
                    start_time: new Date().toISOString().substring(0, 16),
                    status: 'CONFIRMED'
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Book Appointment</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Appointments List */}
            <div className="lg:col-span-2 glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" /> Booking Calendar ({appointments.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Service</th>
                      <th className="p-3">Schedule</th>
                      <th className="p-3">Fee</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {appointments.length === 0 ? (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-500">No scheduled appointments.</td></tr>
                    ) : (
                      appointments.map(a => {
                        const status = a.attributes?.status || 'CONFIRMED';
                        return (
                          <tr key={a.id} className="hover:bg-white/5 transition">
                            <td className="p-3 font-bold text-white">{a.attributes?.customer_name || 'Client'}</td>
                            <td className="p-3 text-slate-300">{a.attributes?.service_name || 'Service'}</td>
                            <td className="p-3 text-[11px] text-slate-400">{a.attributes?.start_time?.substring(0, 16) || 'Scheduled'}</td>
                            <td className="p-3 font-mono text-emerald-400">{formatCurrency(a.attributes?.price || 0)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' :
                                status === 'NO_SHOW' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              {status !== 'COMPLETED' && status !== 'NO_SHOW' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      await fetch(`${API_BASE_URL}/api/v1/sme/appointments/${a.id}/status?org_id=${encodeURIComponent(orgId)}&status=COMPLETED`, { method: 'POST', headers: getAuthHeaders(true) });
                                      showToast('Appointment completed');
                                      loadAllData();
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-200 text-[10px] font-bold hover:bg-emerald-600 transition"
                                  >
                                    Done
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await fetch(`${API_BASE_URL}/api/v1/sme/appointments/${a.id}/status?org_id=${encodeURIComponent(orgId)}&status=NO_SHOW`, { method: 'POST', headers: getAuthHeaders(true) });
                                      showToast('Marked as NO_SHOW (Signal recorded)');
                                      loadAllData();
                                    }}
                                    className="px-2 py-1 rounded bg-rose-600/30 text-rose-200 text-[10px] font-bold hover:bg-rose-600 transition"
                                  >
                                    No Show
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Service Menu */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Service Menu ({services.length})
              </h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {services.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No services added.</p>
                ) : (
                  services.map(s => (
                    <div key={s.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-white">{s.display_label}</div>
                        <div className="text-[10px] text-slate-400">{s.attributes?.duration_minutes || 60} mins • {s.attributes?.category || 'Service'}</div>
                      </div>
                      <div className="font-mono font-bold text-emerald-400">{formatCurrency(s.attributes?.price || 0)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: FINANCE & INVOICES
          ===================================================================== */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Operational Finance & Receivables Aging</h2>
              <p className="text-xs text-slate-400">Invoices, payment verification, overdue debt aging buckets, and expense ledger.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('new_invoice');
                  setModalData({ customer_name: customers[0]?.display_label || 'Client', amount: 100000, due_date: '', status: 'PENDING' });
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Issue Invoice</span>
              </button>
              <button
                onClick={() => {
                  setModalType('new_expense');
                  setModalData({ category: 'RENT', amount: 50000, description: 'Office space lease', vendor: 'Commercial Properties' });
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Log Expense</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoices List */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Invoices & Receivables ({invoices.length})
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.length === 0 ? (
                      <tr><td colSpan="4" className="p-6 text-center text-slate-500">No invoices generated.</td></tr>
                    ) : (
                      invoices.map(i => {
                        const isOverdue = i.attributes?.status === 'OVERDUE';
                        return (
                          <tr key={i.id} className="hover:bg-white/5 transition">
                            <td className="p-3 font-bold text-white">{i.attributes?.customer_name || i.display_label}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{formatCurrency(i.attributes?.amount || 0)}</td>
                            <td className="p-3 text-[11px] text-slate-400">{i.attributes?.due_date || 'Due on Receipt'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                i.attributes?.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-300' :
                                isOverdue ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {i.attributes?.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses List */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-400" /> Operational Expense Ledger ({expenses.length})
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expenses.length === 0 ? (
                      <tr><td colSpan="4" className="p-6 text-center text-slate-500">No expenses logged.</td></tr>
                    ) : (
                      expenses.map(e => (
                        <tr key={e.id} className="hover:bg-white/5 transition">
                          <td className="p-3 font-bold text-white">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-slate-300">{e.attributes?.category || 'EXPENSE'}</span>
                          </td>
                          <td className="p-3 text-slate-300">{e.attributes?.description || e.display_label}</td>
                          <td className="p-3 text-slate-400">{e.attributes?.vendor || 'Internal'}</td>
                          <td className="p-3 font-mono font-bold text-rose-400">{formatCurrency(e.attributes?.amount || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: PROJECTS & TASKS
          ===================================================================== */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Client Projects & Operational Tasks</h2>
              <p className="text-xs text-slate-400">Milestone delivery, budget consumption, and team task allocation.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('new_project');
                  setModalData({ display_label: '', client_name: customers[0]?.display_label || 'Corporate Client', budget: 500000, completion_percentage: 0 });
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
              <button
                onClick={() => {
                  setModalType('new_task');
                  setModalData({ display_label: '', assignee: 'Operations Lead', priority: 'HIGH', status: 'TODO', due_date: '' });
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Projects */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-400" /> Active Client Projects ({projects.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No projects defined.</p>
                ) : (
                  projects.map(p => (
                    <div key={p.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-white text-sm">{p.display_label}</div>
                          <div className="text-xs text-slate-400">{p.attributes?.client_name || 'Client Project'}</div>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold text-xs">{formatCurrency(p.attributes?.budget || 0)}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Progress</span>
                          <span>{p.attributes?.completion_percentage || 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.attributes?.completion_percentage || 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" /> Operational Task List ({tasks.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No pending tasks.</p>
                ) : (
                  tasks.map(t => (
                    <div key={t.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white">{t.display_label}</div>
                        <div className="text-[10px] text-slate-400">Assignee: {t.attributes?.assignee || 'Staff'} • Due: {t.attributes?.due_date || 'Flexible'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.attributes?.priority === 'URGENT' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {t.attributes?.status || 'TODO'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 8: SIGNALS & ARGUS INTELLIGENCE (16 SKILLS)
          ===================================================================== */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">ARGUS OS Intelligence: 16 Copilot Skills</h2>
              <p className="text-xs text-slate-400">Real-time analytical reasoning grounded in live operational records (Zero mock data).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Skills Directory */}
            <div className="glass p-5 rounded-3xl border border-white/10 space-y-3 max-h-[600px] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Intelligence Skill</span>
              <div className="space-y-1.5">
                {SKILL_LIST.map(s => {
                  const isSelected = activeSkill === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        setActiveSkill(s.key);
                        setSkillResult(null);
                      }}
                      className={`w-full text-left p-3 rounded-2xl transition border ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500/50 text-white shadow-lg shadow-blue-500/10'
                          : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold">{s.name}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 font-bold">{s.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skill Runner & Output */}
            <div className="lg:col-span-2 glass p-6 rounded-3xl border border-blue-500/30 space-y-5">
              {(() => {
                const s = SKILL_LIST.find(item => item.key === activeSkill);
                return (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {s?.category} INTELLIGENCE
                        </span>
                        <h3 className="text-lg font-black text-white mt-1.5">{s?.name}</h3>
                        <p className="text-xs text-slate-300 mt-0.5">{s?.desc}</p>
                      </div>

                      <button
                        onClick={() => handleRunSkill(activeSkill)}
                        disabled={executingSkill}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                      >
                        {executingSkill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                        <span>{executingSkill ? 'Analyzing DB...' : 'Execute Skill'}</span>
                      </button>
                    </div>

                    {/* Skill Result Display */}
                    <div className="rounded-2xl bg-black/40 border border-white/10 p-5 min-h-[300px] flex flex-col justify-center">
                      {executingSkill ? (
                        <div className="text-center space-y-3 py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                          <p className="text-xs text-slate-400">Querying live tenant databases and computing graph signals...</p>
                        </div>
                      ) : skillResult ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Live Execution Result
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">Grounded Multi-Tenant DB</span>
                          </div>

                          {skillResult.insufficient_data ? (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                              <div className="font-bold flex items-center gap-1.5 mb-1">
                                <Info className="w-4 h-4" /> Insufficient Tenant Data
                              </div>
                              <p className="text-[11px] text-amber-300/80">
                                This skill executed against live DB tables but found 0 matching historical records for this tenant. Seed demo data or record live transactions to view populated graphs.
                              </p>
                            </div>
                          ) : (
                            <pre className="text-xs font-mono text-blue-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
                              {JSON.stringify(skillResult, null, 2)}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2 opacity-60" />
                          <p className="font-bold text-slate-300">Ready for Execution</p>
                          <p className="text-[11px] mt-0.5">Click "Execute Skill" to perform real database analytical synthesis.</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 9: MODEL SETTINGS & PRESETS
          ===================================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Business Model & Capability Configuration</h2>
            <p className="text-xs text-slate-400">Configure whether this enterprise operates as Product, Service, or Hybrid, and toggle capabilities.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model & Capabilities */}
            <div className="glass p-6 rounded-3xl border border-white/10 space-y-5">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" /> Operational Model
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {['PRODUCT', 'SERVICE', 'HYBRID'].map(m => (
                  <button
                    key={m}
                    onClick={async () => {
                      await fetch(`${API_BASE_URL}/api/v1/sme/config?org_id=${encodeURIComponent(orgId)}`, {
                        method: 'POST',
                        headers: getAuthHeaders(true),
                        body: JSON.stringify({ business_model: m, org_id: orgId })
                      });
                      showToast(`Model updated to ${m}`);
                      loadAllData();
                    }}
                    className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition ${
                      modelType === m
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <span className="text-xs font-bold text-slate-300">Feature Capabilities</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(caps).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="font-medium text-slate-300">{k}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                        {v ? 'ENABLED' : 'OFF'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Presets Gallery */}
            <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" /> Industry Presets
              </h3>
              <p className="text-xs text-slate-400">
                Applying a preset adjusts capabilities, default currencies, catalog structure, and starter workflows in 1 click.
              </p>

              <div className="space-y-2">
                {PRESET_OPTIONS.map(p => (
                  <div key={p.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.icon}</span>
                      <div>
                        <div className="font-bold text-white text-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.desc}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApplyPreset(p.id)}
                      disabled={submitting}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-xs font-bold border border-blue-500/30 transition"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DEDICATED MODAL DIALOGS WITH SPECIFIC FIELDS FOR EACH ENTITY TYPE
          ===================================================================== */}
      {modalType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass p-6 rounded-3xl border border-white/10 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  {modalType === 'new_product' && 'Product & Inventory'}
                  {modalType === 'new_customer' && 'Customer CRM'}
                  {modalType === 'new_lead' && 'Sales Pipeline'}
                  {modalType === 'new_order' && 'Order Fulfillment'}
                  {modalType === 'new_service' && 'Service Menu'}
                  {modalType === 'new_appointment' && 'Booking Schedule'}
                  {modalType === 'new_invoice' && 'Operational Finance'}
                  {modalType === 'new_expense' && 'Expenditure Ledger'}
                  {modalType === 'new_project' && 'Client Deliverables'}
                  {modalType === 'new_task' && 'Task Allocation'}
                  {modalType === 'new_po' && 'Procurement'}
                </span>
                <h3 className="text-lg font-bold text-white capitalize">
                  {modalType === 'new_product' && 'Register Product SKU'}
                  {modalType === 'new_customer' && 'Create Customer Profile'}
                  {modalType === 'new_lead' && 'Capture Sales Lead'}
                  {modalType === 'new_order' && 'Record Sales Order'}
                  {modalType === 'new_service' && 'Add Service Offering'}
                  {modalType === 'new_appointment' && 'Book Appointment'}
                  {modalType === 'new_invoice' && 'Issue Invoice'}
                  {modalType === 'new_expense' && 'Log Expense'}
                  {modalType === 'new_project' && 'Create Project'}
                  {modalType === 'new_task' && 'Assign Task'}
                  {modalType === 'new_po' && 'Create Purchase Order'}
                </h3>
              </div>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModalRecord} className="space-y-4 text-xs">
              {/* ---------------- 1. PRODUCT FORM ---------------- */}
              {modalType === 'new_product' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Product Name / Title <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Rejuvenating Glow Oil 50ml"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">SKU Code <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.sku || ''}
                      onChange={(e) => setModalData({ ...modalData, sku: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                      placeholder="e.g. GLOW-OIL-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Selling Price (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={modalData.selling_price || ''}
                        onChange={(e) => setModalData({ ...modalData, selling_price: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="15000"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Unit Cost Price (₦)</label>
                      <input
                        type="number"
                        step="any"
                        value={modalData.cost_price || ''}
                        onChange={(e) => setModalData({ ...modalData, cost_price: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="7000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Initial Stock on Hand <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.current_stock || ''}
                        onChange={(e) => setModalData({ ...modalData, current_stock: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="25"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Low-Stock Alert Threshold <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.reorder_threshold || ''}
                        onChange={(e) => setModalData({ ...modalData, reorder_threshold: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="5"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 2. CUSTOMER FORM ---------------- */}
              {modalType === 'new_customer' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Full Name / Account Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Folake Adebayo"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Email Address</label>
                    <input
                      type="email"
                      value={modalData.email || ''}
                      onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. folake@lagosmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Phone Number (WhatsApp) <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.phone || ''}
                      onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                      placeholder="+2348031234567"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Customer Tier</label>
                      <select
                        value={modalData.status || 'ACTIVE'}
                        onChange={(e) => setModalData({ ...modalData, status: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="VIP">VIP</option>
                        <option value="LEAD">LEAD</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Past Spend History (₦)</label>
                      <input
                        type="number"
                        value={modalData.total_spend || ''}
                        onChange={(e) => setModalData({ ...modalData, total_spend: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 3. LEAD FORM ---------------- */}
              {modalType === 'new_lead' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Deal / Account Title <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Corporate Retainer Proposal"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Key Contact Person <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.contact_name || ''}
                      onChange={(e) => setModalData({ ...modalData, contact_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Dr. Ken Nnamani"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Pipeline Stage</label>
                      <select
                        value={modalData.stage || 'QUALIFIED'}
                        onChange={(e) => setModalData({ ...modalData, stage: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      >
                        <option value="NEW">NEW</option>
                        <option value="QUALIFIED">QUALIFIED</option>
                        <option value="PROPOSAL_SENT">PROPOSAL_SENT</option>
                        <option value="NEGOTIATION">NEGOTIATION</option>
                        <option value="WON">WON</option>
                        <option value="LOST">LOST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Estimated Deal Value (₦)</label>
                      <input
                        type="number"
                        value={modalData.estimated_value || ''}
                        onChange={(e) => setModalData({ ...modalData, estimated_value: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="350000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={modalData.next_followup_at || ''}
                      onChange={(e) => setModalData({ ...modalData, next_followup_at: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* ---------------- 4. ORDER FORM ---------------- */}
              {modalType === 'new_order' && (
                <>
                  {/* Customer Selection */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
                      Customer <span className="text-rose-400">*</span>
                    </label>
                    {customers.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={modalData.customer_id || (modalData.is_custom_customer ? '__custom__' : '')}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setModalData({ ...modalData, customer_id: '', is_custom_customer: true });
                            } else {
                              const c = customers.find(item => item.id === e.target.value);
                              setModalData({
                                ...modalData,
                                customer_id: c?.id || '',
                                customer_name: c?.display_label || 'Direct Customer',
                                is_custom_customer: false
                              });
                            }
                          }}
                          className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs font-semibold"
                        >
                          <option value="">-- Select Existing Customer --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.display_label} {c.attributes?.phone ? `(${c.attributes.phone})` : ''} - {c.attributes?.status || 'Active'}
                            </option>
                          ))}
                          <option value="__custom__">+ Enter Custom Customer Name...</option>
                        </select>

                        {(modalData.is_custom_customer || !modalData.customer_id) && (
                          <input
                            type="text"
                            required
                            value={modalData.customer_name || ''}
                            onChange={(e) => setModalData({ ...modalData, customer_name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs"
                            placeholder="e.g. Walk-in Customer / Folake Adebayo"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={modalData.customer_name || ''}
                        onChange={(e) => setModalData({ ...modalData, customer_name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs"
                        placeholder="e.g. Walk-in Customer / Folake Adebayo"
                      />
                    )}
                  </div>

                  {/* Product Selection with Auto-Price Assignment */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-300 font-bold">
                        Select Product SKU <span className="text-rose-400">*</span>
                      </label>
                      {modalData.available_stock !== undefined && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          modalData.available_stock > 5 ? 'bg-emerald-500/20 text-emerald-300' :
                          modalData.available_stock > 0 ? 'bg-amber-500/20 text-amber-300' :
                          'bg-rose-500/20 text-rose-300'
                        }`}>
                          Available Stock: {modalData.available_stock} units
                        </span>
                      )}
                    </div>

                    {products.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={modalData.product_id || (modalData.is_custom_product ? '__custom__' : '')}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setModalData({
                                ...modalData,
                                product_id: '',
                                is_custom_product: true
                              });
                            } else {
                              const p = products.find(prod => prod.id === e.target.value);
                              if (p) {
                                const price = parseFloat(p.attributes?.selling_price || 0);
                                const stock = p.attributes?.current_stock !== undefined ? parseFloat(p.attributes.current_stock) : 0;
                                const qty = Math.max(1, parseFloat(modalData.quantity || 1));
                                setModalData({
                                  ...modalData,
                                  product_id: p.id,
                                  product_name: p.display_label,
                                  unit_price: price,
                                  available_stock: stock,
                                  quantity: qty,
                                  total_amount: price * qty,
                                  is_custom_product: false
                                });
                              }
                            }
                          }}
                          className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs font-semibold"
                        >
                          <option value="">-- Choose Product From Catalog --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.display_label} — {formatCurrency(p.attributes?.selling_price || 0)} (Stock: {p.attributes?.current_stock ?? 0} units)
                            </option>
                          ))}
                          <option value="__custom__">+ Enter Custom / Unlisted Product...</option>
                        </select>

                        {(modalData.is_custom_product || !modalData.product_id) && (
                          <input
                            type="text"
                            required
                            value={modalData.product_name || ''}
                            onChange={(e) => setModalData({ ...modalData, product_name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs"
                            placeholder="e.g. Custom Skincare Pack"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={modalData.product_name || ''}
                        onChange={(e) => setModalData({ ...modalData, product_name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 text-xs"
                        placeholder="e.g. Rejuvenating Glow Oil"
                      />
                    )}
                  </div>

                  {/* Pricing & Stock Card Preview */}
                  {modalData.product_name && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{modalData.product_name}</div>
                        <div className="text-[11px] text-blue-300">
                          Unit Price: <strong className="text-emerald-400 font-mono">{formatCurrency(modalData.unit_price || 0)}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Current Stock</div>
                        <div className="font-mono font-bold text-white">
                          {modalData.available_stock !== undefined ? `${modalData.available_stock} units` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quantity & Auto-calculated Total Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={modalData.quantity || '1'}
                        onChange={(e) => {
                          const qty = Math.max(1, parseFloat(e.target.value) || 1);
                          const unitPrice = parseFloat(modalData.unit_price || 0);
                          setModalData({
                            ...modalData,
                            quantity: qty,
                            total_amount: unitPrice > 0 ? unitPrice * qty : modalData.total_amount
                          });
                        }}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">
                        Total Order Amount (₦) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={modalData.total_amount !== undefined ? modalData.total_amount : ''}
                        onChange={(e) => setModalData({ ...modalData, total_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="7000"
                      />
                      {modalData.unit_price > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          Auto: {modalData.quantity || 1} × {formatCurrency(modalData.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Payment Status</label>
                      <select
                        value={modalData.payment_status || 'PAID'}
                        onChange={(e) => setModalData({ ...modalData, payment_status: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      >
                        <option value="PAID">PAID</option>
                        <option value="PENDING">PENDING</option>
                        <option value="PARTIAL">PARTIAL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Payment Method</label>
                      <select
                        value={modalData.payment_method || 'paystack'}
                        onChange={(e) => setModalData({ ...modalData, payment_method: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      >
                        <option value="paystack">Paystack</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="pos">POS Terminal</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 5. SERVICE FORM ---------------- */}
              {modalType === 'new_service' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Service Title <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Luxury Spa & Body Scrub"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Category</label>
                    <input
                      type="text"
                      value={modalData.category || ''}
                      onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Spa, Advisory, Hair, Repairs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Standard Fee (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.price || ''}
                        onChange={(e) => setModalData({ ...modalData, price: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="25000"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Duration (Minutes)</label>
                      <input
                        type="number"
                        value={modalData.duration_minutes || '60'}
                        onChange={(e) => setModalData({ ...modalData, duration_minutes: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="60"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 6. APPOINTMENT FORM ---------------- */}
              {modalType === 'new_appointment' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Customer Full Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.customer_name || ''}
                      onChange={(e) => setModalData({ ...modalData, customer_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Princess Adedoyin"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Service Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.service_name || ''}
                      onChange={(e) => setModalData({ ...modalData, service_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Gold Luxury Spa Session"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Date & Time <span className="text-rose-400">*</span></label>
                      <input
                        type="datetime-local"
                        required
                        value={modalData.start_time || ''}
                        onChange={(e) => setModalData({ ...modalData, start_time: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Service Fee (₦)</label>
                      <input
                        type="number"
                        value={modalData.price || ''}
                        onChange={(e) => setModalData({ ...modalData, price: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="30000"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 7. INVOICE FORM ---------------- */}
              {modalType === 'new_invoice' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Customer / Client Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.customer_name || ''}
                      onChange={(e) => setModalData({ ...modalData, customer_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Folake Adebayo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Invoice Balance (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.amount || ''}
                        onChange={(e) => setModalData({ ...modalData, amount: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="100000"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Payment Due Date <span className="text-rose-400">*</span></label>
                      <input
                        type="date"
                        required
                        value={modalData.due_date || ''}
                        onChange={(e) => setModalData({ ...modalData, due_date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 8. EXPENSE FORM ---------------- */}
              {modalType === 'new_expense' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Expense Category <span className="text-rose-400">*</span></label>
                    <select
                      value={modalData.category || 'SUPPLIES'}
                      onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                    >
                      <option value="RENT">RENT</option>
                      <option value="UTILITIES">UTILITIES</option>
                      <option value="PAYROLL">PAYROLL</option>
                      <option value="SUPPLIES">SUPPLIES</option>
                      <option value="MARKETING">MARKETING</option>
                      <option value="LOGISTICS">LOGISTICS</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Description <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.description || ''}
                      onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Office generator diesel and servicing"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Payee / Vendor</label>
                      <input
                        type="text"
                        value={modalData.vendor || ''}
                        onChange={(e) => setModalData({ ...modalData, vendor: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                        placeholder="e.g. TotalEnergies Lekki"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Expense Amount (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.amount || ''}
                        onChange={(e) => setModalData({ ...modalData, amount: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="45000"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 9. PROJECT FORM ---------------- */}
              {modalType === 'new_project' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Project Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Rebranding & Custom Website"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Client / Account Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.client_name || ''}
                      onChange={(e) => setModalData({ ...modalData, client_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Apex Global Bank"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Contract Budget (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.budget || ''}
                        onChange={(e) => setModalData({ ...modalData, budget: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="750000"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Completion (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={modalData.completion_percentage || '0'}
                        onChange={(e) => setModalData({ ...modalData, completion_percentage: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 10. TASK FORM ---------------- */}
              {modalType === 'new_task' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Task Title / Description <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.display_label || ''}
                      onChange={(e) => setModalData({ ...modalData, display_label: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Prepare client deck & deliverables"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Assignee Staff Member <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.assignee || ''}
                      onChange={(e) => setModalData({ ...modalData, assignee: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Blessing Okon / Operations Lead"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Priority</label>
                      <select
                        value={modalData.priority || 'HIGH'}
                        onChange={(e) => setModalData({ ...modalData, priority: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Deadline Date</label>
                      <input
                        type="date"
                        value={modalData.due_date || ''}
                        onChange={(e) => setModalData({ ...modalData, due_date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ---------------- 11. PURCHASE ORDER FORM ---------------- */}
              {modalType === 'new_po' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Supplier Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.supplier_name || ''}
                      onChange={(e) => setModalData({ ...modalData, supplier_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Essential Oils Lab Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">Product / Material Description <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={modalData.product_name || ''}
                      onChange={(e) => setModalData({ ...modalData, product_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                      placeholder="e.g. Rejuvenating Glow Oil 50ml"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Quantity to Order <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.quantity || ''}
                        onChange={(e) => setModalData({ ...modalData, quantity: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">Total PO Cost (₦) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={modalData.total_cost || ''}
                        onChange={(e) => setModalData({ ...modalData, total_cost: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono"
                        placeholder="140000"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
