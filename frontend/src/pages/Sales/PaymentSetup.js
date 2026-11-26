import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Lock,
  Wallet
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import Loader from "../../components/Loader";

export default function PaymentSetup() {
  const { currentUser } = useAuth();
  const { refreshPaymentStatus } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [banks, setBanks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [config, setConfig] = useState({
    configured: false,
    is_active: false,
    bank_name: "",
    bank_code: "",
    account_number: "",
    account_name: "",
    subaccount_code: "",
    percentage_charge: 0.0
  });

  const [form, setForm] = useState({
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
    percentage_charge: 0.0
  });

  const [verifyMessage, setVerifyMessage] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getAuthHeaders = () => {
    let token = currentUser?.token;
    if (!token) {
      try {
        const stored = localStorage.getItem("user");
        if (stored) token = JSON.parse(stored)?.token;
      } catch (e) {}
    }
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    if (currentUser) {
      fetchInitialData();
    }
  }, [currentUser]);

  const fetchInitialData = async () => {
    setLoading(true);
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    try {
      // 1. Fetch Banks
      const banksRes = await fetch(`${API_BASE_URL}/api/sales/payment/banks`, {
        headers: getAuthHeaders()
      });
      const banksData = await banksRes.json();
      if (banksData.status === "success") {
        setBanks(banksData.banks || []);
      }

      // 2. Fetch current payment config
      const cfgRes = await fetch(`${API_BASE_URL}/api/sales/payment/config?business_id=${encodeURIComponent(businessId)}`, {
        headers: getAuthHeaders()
      });
      const cfgData = await cfgRes.json();
      if (cfgData.status === "success" && cfgData.config) {
        setConfig(cfgData.config);
        if (cfgData.config.configured) {
          setForm({
            bank_code: cfgData.config.bank_code || "",
            bank_name: cfgData.config.bank_name || "",
            account_number: cfgData.config.account_number || "",
            account_name: cfgData.config.account_name || "",
            percentage_charge: cfgData.config.percentage_charge || 0.0
          });
        }
      }
    } catch (err) {
      console.error("Error fetching payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBankSelect = (e) => {
    const selectedCode = e.target.value;
    const selectedBank = banks.find((b) => b.code === selectedCode);
    setForm((prev) => ({
      ...prev,
      bank_code: selectedCode,
      bank_name: selectedBank ? selectedBank.name : "",
      account_name: ""
    }));
    setVerifyMessage(null);
    setVerifyError(null);
  };

  const handleAccountChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
    setForm((prev) => ({ ...prev, account_number: val, account_name: "" }));
    setVerifyMessage(null);
    setVerifyError(null);
  };

  const handleVerifyAccount = async () => {
    if (!form.bank_code) {
      setVerifyError("Please select a settlement bank first.");
      return;
    }
    if (!form.account_number || form.account_number.length !== 10) {
      setVerifyError("Please enter a valid 10-digit NUBAN account number.");
      return;
    }

    setVerifying(true);
    setVerifyError(null);
    setVerifyMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/sales/payment/resolve-account`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bank_code: form.bank_code,
          account_number: form.account_number
        })
      });
      const data = await res.json();
      if (res.ok && data.status && data.account_name) {
        setForm((prev) => ({ ...prev, account_name: data.account_name }));
        setVerifyMessage(`Verified: ${data.account_name}`);
      } else {
        setVerifyError(data.detail || data.message || "Could not resolve bank account details.");
      }
    } catch (err) {
      setVerifyError("Network error verifying account. Please check your connection.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.bank_code) {
      alert("Please select your settlement bank.");
      return;
    }
    if (!form.account_number || form.account_number.length !== 10) {
      alert("Please enter a valid 10-digit account number.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    const businessId = currentUser?.business_id || currentUser?.email || "default";

    try {
      const res = await fetch(`${API_BASE_URL}/api/sales/payment/config`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          business_id: businessId,
          bank_code: form.bank_code,
          bank_name: form.bank_name,
          account_number: form.account_number,
          account_name: form.account_name || "Verified Merchant",
          percentage_charge: parseFloat(form.percentage_charge) || 0.0
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setConfig((prev) => ({
          ...prev,
          configured: true,
          is_active: true,
          ...data.config
        }));
        setSaveSuccess(true);
        if (refreshPaymentStatus) refreshPaymentStatus();
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        alert(data.detail || "Failed to configure Paystack payout account.");
      }
    } catch (err) {
      alert("Error saving payment configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader />
      </div>
    );
  }

  const filteredBanks = searchTerm
    ? banks.filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : banks;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Paystack Direct Payout & Settlement
              </h2>
              <p className="text-sm text-gray-500">
                Receive 100% of customer payments directly to your business bank account.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config.configured && config.is_active ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Active & Receiving Payouts
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Payouts Not Configured
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Settlement Method</h4>
            <p className="text-lg font-bold text-gray-900 mt-1">Direct Bank Deposit</p>
            <p className="text-xs text-gray-500 mt-1">Next-day automatic settlement (T+1) to your NUBAN account.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Fee</h4>
            <p className="text-lg font-bold text-gray-900 mt-1">0% Platform Fee</p>
            <p className="text-xs text-gray-500 mt-1">100% of sales deposited directly to you without platform cuts.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gateway Security</h4>
            <p className="text-lg font-bold text-gray-900 mt-1">Paystack Verified</p>
            <p className="text-xs text-gray-500 mt-1">Encrypted card, USSD, and bank transfer checkouts.</p>
          </div>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Settlement Bank Account</h3>
          <p className="text-sm text-gray-500 mt-1">
            Specify where funds from your offer links and catalog sales should be paid.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Payout Account Connected Successfully!</p>
                <p className="text-xs text-emerald-700">
                  Subaccount {config.subaccount_code} is active. Future customer purchases will settle directly into this account.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Select */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Settlement Bank <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.bank_code}
                onChange={handleBankSelect}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 font-medium transition-all"
              >
                <option value="">-- Choose Settlement Bank --</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">Supported by all 280+ licensed commercial banks & MFBs.</p>
            </div>

            {/* Account Number */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                10-Digit NUBAN Account Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="0123456789"
                  value={form.account_number}
                  onChange={handleAccountChange}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 font-medium tracking-widest transition-all"
                />
                <button
                  type="button"
                  onClick={handleVerifyAccount}
                  disabled={verifying || !form.bank_code || form.account_number.length !== 10}
                  className="px-5 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {verifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Verify
                </button>
              </div>

              {verifyMessage && (
                <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {verifyMessage}
                </p>
              )}
              {verifyError && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {verifyError}
                </p>
              )}
            </div>
          </div>

          {/* Account Name Display */}
          {form.account_name && (
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">Verified Account Name</span>
                <span className="text-base font-bold text-gray-900">{form.account_name}</span>
              </div>
              <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
                Ready to Connect
              </span>
            </div>
          )}

          {/* Connected Subaccount Summary if existing */}
          {config.configured && (
            <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Paystack Subaccount Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400 block text-xs">Subaccount Code</span>
                  <span className="font-mono font-bold text-gray-800">{config.subaccount_code}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Bank Name</span>
                  <span className="font-bold text-gray-800">{config.bank_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Account Number</span>
                  <span className="font-mono font-bold text-gray-800">{config.account_number || "N/A"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Lock className="w-4 h-4 text-emerald-500" />
              Secure 256-bit encrypted connection to Paystack NUBAN gateway
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connecting Subaccount...
                </>
              ) : (
                <>
                  <span>Save Payout Settings</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Helpful FAQ section */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-900">How Direct Settlements Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
          <div className="space-y-1">
            <p className="font-bold text-gray-800">1. Instant Routing Upon Checkout</p>
            <p className="text-xs leading-relaxed text-gray-500">
              When a buyer clicks your shared offer link and completes payment, Paystack tags the transaction with your business's dedicated Subaccount code.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-gray-800">2. Next-Day Automatic Bank Deposit</p>
            <p className="text-xs leading-relaxed text-gray-500">
              Paystack deposits 100% of the funds straight into your verified bank account on the next payout cycle (T+1), without requiring manual withdrawals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
