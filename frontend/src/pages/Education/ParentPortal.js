import React, { useState, useEffect } from 'react';
import { Users, Calendar, BookOpen, Receipt, FileText, CheckCircle2, MessageSquare, Plus, Check, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduParentPortalPage({ orgId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [report, setReport] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [childName, setChildName] = useState('Loading profile...');
  const [courseEnrolled, setCourseEnrolled] = useState('');
  
  // Simulated approvals / requests
  const [approvals, setApprovals] = useState([
    { id: 1, title: "Field Trip to Lagos Conservation Center", cost: "₦5,000", date: "Aug 15", approved: false, stream: "Stream A" },
    { id: 2, title: "Inter-School Sports Club Transport Pass", cost: "₦3,500", date: "Aug 18", approved: false, stream: "Stream A" }
  ]);

  useEffect(() => {
    fetchChildProfile();
  }, [orgId]);

  useEffect(() => {
    if (studentId) {
      fetchInvoices();
      fetchReport();
    }
  }, [orgId, studentId]);

  const fetchChildProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students/my-child?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const sData = await res.json();
        setStudentId(sData.attributes?.student_id || sData.id);
        setChildName(sData.display_label);
        setCourseEnrolled(sData.attributes?.course_enrolled || '');
      } else {
        const listRes = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
        if (listRes.ok) {
          const list = await listRes.json();
          if (list && list.length > 0) {
            const first = list[0];
            setStudentId(first.attributes?.student_id || first.id);
            setChildName(first.display_label);
            setCourseEnrolled(first.attributes?.course_enrolled || '');
          } else {
            setStudentId('');
            setChildName('No Child Onboarded');
            setCourseEnrolled('');
          }
        }
      }
    } catch (e) {
      console.error("Error loading child profile:", e);
    }
  };

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: 'module_education:generate_report_card',
          params: { org_id: orgId, student_id: studentId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data.result);
      }
    } catch (e) {
      console.error("Error fetching report card:", e);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/fees/invoices?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    setPayingInvoice(invoiceId);
    try {
      const inv = invoices.find(i => i.id === invoiceId);
      const balanceToPay = inv ? (inv.attributes?.balance || 0) : 0;
      const res = await fetch(`${API_BASE_URL}/api/v1/education/fees/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, invoice_id: invoiceId, amount_paid: balanceToPay })
      });
      if (res.ok) {
        fetchInvoices();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPayingInvoice(null);
    }
  };

  const handleApproveTrip = (id) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, approved: true } : a));
    alert("Activity Permission Authorized Successfully!");
  };

  const getAcademicAverage = () => {
    if (!report || !report.grades || Object.keys(report.grades).length === 0) return 'N/A';
    
    // Attempt to parse percentages first
    const scores = Object.values(report.grades).map(g => {
      const match = g.match(/\((\d+)%\)/);
      return match ? parseInt(match[1]) : null;
    }).filter(s => s !== null);
    
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      let letter = 'F';
      if (avg >= 90) letter = 'A+';
      else if (avg >= 80) letter = 'A';
      else if (avg >= 70) letter = 'B+';
      else if (avg >= 60) letter = 'B';
      else if (avg >= 50) letter = 'C';
      return `${letter} (${avg}% Average)`;
    }
    
    // Fallback to letter grade point average
    const gradePoints = {
      'A+': 5, 'A': 5, 'A-': 4.5,
      'B+': 4, 'B': 3.5, 'B-': 3,
      'C+': 2.5, 'C': 2, 'C-': 1.5,
      'D': 1, 'F': 0
    };
    
    let totalPoints = 0;
    let count = 0;
    Object.values(report.grades).forEach(g => {
      const cleanGrade = g.trim().toUpperCase();
      if (gradePoints[cleanGrade] !== undefined) {
        totalPoints += gradePoints[cleanGrade];
        count++;
      } else {
        const found = Object.keys(gradePoints).find(k => cleanGrade.startsWith(k));
        if (found) {
          totalPoints += gradePoints[found];
          count++;
        }
      }
    });
    
    if (count === 0) return 'Graded';
    const gpa = (totalPoints / count).toFixed(2);
    let avgLetter = 'C';
    if (gpa >= 4.5) avgLetter = 'A';
    else if (gpa >= 3.5) avgLetter = 'B';
    else if (gpa >= 2.0) avgLetter = 'C';
    else avgLetter = 'D';
    
    return `${avgLetter} (${gpa} GPA)`;
  };

  const filteredApprovals = approvals.filter(a =>
    courseEnrolled && (
      !a.stream ||
      a.stream.toLowerCase() === courseEnrolled.toLowerCase()
    )
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" /> PARENT PORTAL
          </div>
          <h2 className="text-3xl font-extrabold text-white">Guardian Control Desk ({childName})</h2>
          <p className="text-slate-400 mt-1">Track child academic progress, review attendance logs, manage payments, and authorize activity requests.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Child Profile Vitals & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-400" /> Child Progress Briefing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Academic Average</span>
                <span className="text-xl font-bold text-green-400 block">{getAcademicAverage()}</span>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Weekly Attendance</span>
                <span className="text-xl font-bold text-cyan-400 block">{report?.attendance_rate || 'N/A'}</span>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Behavior Score</span>
                <span className="text-xl font-bold text-indigo-400 block">{report && Object.keys(report.grades).length > 0 ? 'Good Standing' : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-indigo-400" /> Invoices & Fee Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">Total Fee</th>
                    <th className="p-4">Scholarship</th>
                    <th className="p-4">Outstanding Balance</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invoices.filter(inv => inv.attributes?.student_id === studentId).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 italic bg-white/5 rounded-2xl">
                        No invoices billed to your account.
                      </td>
                    </tr>
                  ) : (
                    invoices.filter(inv => inv.attributes?.student_id === studentId).map(inv => (
                      <tr key={inv.id} className="hover:bg-white/5">
                        <td className="p-4 font-bold text-white font-mono">{inv.display_label || 'INV-4414'}</td>
                        <td className="p-4">₦{Number(inv.attributes?.amount || 0).toLocaleString()}</td>
                        <td className="p-4 text-green-400">₦{Number(inv.attributes?.scholarship || 0).toLocaleString()}</td>
                        <td className="p-4 font-bold text-slate-200">₦{Number(inv.attributes?.balance || 0).toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            inv.attributes?.status === 'PAID' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {inv.attributes?.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {inv.attributes?.status !== 'PAID' && (
                            <button
                              onClick={() => handlePayInvoice(inv.id)}
                              disabled={payingInvoice === inv.id}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition flex items-center justify-center gap-1.5 ml-auto"
                            >
                              {payingInvoice === inv.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              Pay Now (Paystack)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Columns: Announcements and Approvals */}
        <div className="lg:col-span-1 space-y-6">
          {/* Permission Requests */}
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-indigo-400" /> Activity Approvals</h3>
            <div className="space-y-3">
              {filteredApprovals.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-4 text-center bg-white/5 rounded-xl border border-white/5">
                  No pending activity approvals for your child.
                </div>
              ) : (
                filteredApprovals.map(req => (
                  <div key={req.id} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                    <div className="font-bold text-white">{req.title}</div>
                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>Date: {req.date}</span>
                      <span>Cost: {req.cost}</span>
                    </div>
                    {req.approved ? (
                      <span className="text-[10px] font-bold text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Approved</span>
                    ) : (
                      <button
                        onClick={() => handleApproveTrip(req.id)}
                        className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition"
                      >
                        Authorize Permission
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* School Announcements */}
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-400" /> Announcements</h3>
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="font-bold text-white">Inter-House Sports Heat Day</div>
                <p className="text-[10px] text-slate-400 mt-1">Scheduled for next Friday. Students must bring sport kits.</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="font-bold text-white">Parent-Teacher Association Meeting</div>
                <p className="text-[10px] text-slate-400 mt-1">Saturday, Aug 22 at 10:00 AM. Location: Multi-Purpose Hall.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
