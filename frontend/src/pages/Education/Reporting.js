import React, { useState } from 'react';
import { FileText, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduReportingPage({ orgId }) {
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [reportType, setReportType] = useState('');

  const generateReport = async (skillName, typeLabel) => {
    setLoading(true);
    setReportResult(null);
    setReportType(typeLabel);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/modules/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: `module_education:${skillName}`,
          params: { org_id: orgId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReportResult(data.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <FileText className="w-4 h-4" /> COMPLIANCE & REPORTS
        </div>
        <h2 className="text-3xl font-extrabold text-white">Enterprise Report Builder</h2>
        <p className="text-slate-400 mt-1">Compile official academic transcript folios, calculate term averages, and audit school compliance records.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Select Report Format</h3>
            <div className="space-y-3">
              <button
                onClick={() => generateReport('generate_report_card', 'Student Report Card')}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                {loading && reportType === 'Student Report Card' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Student Report Card
              </button>
              <button
                onClick={() => generateReport('generate_inspection_report', 'Ministry Inspection Audit')}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                {loading && reportType === 'Ministry Inspection Audit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Inspection Audit
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="glass rounded-3xl border border-white/10 p-6 min-h-[300px] flex flex-col justify-between">
            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-4">Report Preview Desk</h3>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-2" />
                <span>Compiling telemetry and database assets...</span>
              </div>
            ) : reportResult ? (
              <div className="flex-grow py-4 space-y-4 text-xs text-slate-300">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">{reportType} Preview</h4>
                
                {reportType === 'Student Report Card' ? (
                  <div className="bg-black/30 border border-white/5 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between font-bold">
                      <span>Matric ID: {reportResult.student_id}</span>
                      <span>Term: {reportResult.term}</span>
                    </div>
                    <div className="border-t border-white/5 pt-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Subject Grades:</div>
                      {Object.entries(reportResult.grades || {}).map(([sub, gr]) => (
                        <div key={sub} className="flex justify-between py-1">
                          <span>{sub}:</span>
                          <span className="font-bold text-cyan-300 font-mono">{gr}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/5 pt-2 flex justify-between text-[11px] text-slate-400">
                      <span>Class Rank: {reportResult.position_in_class}</span>
                      <span>Attendance: {reportResult.attendance_rate}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 border border-white/5 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between font-bold">
                      <span>Rating Draft:</span>
                      <span className="text-green-400 font-mono">{reportResult.school_rating_draft}</span>
                    </div>
                    <div className="border-t border-white/5 pt-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Compliance Checks:</div>
                      {Object.entries(reportResult.compliance_checks || {}).map(([check, val]) => (
                        <div key={check} className="flex justify-between py-1">
                          <span>{check}:</span>
                          <span className="font-bold text-white font-mono">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 italic py-12">
                No report selected. Choose a format to compile.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
