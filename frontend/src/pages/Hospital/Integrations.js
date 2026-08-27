import React, { useState } from 'react';
import { 
  Network, Loader2, ArrowRight, Play, CheckCircle2, AlertCircle, FileText, Upload 
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function Integrations({ orgId }) {
  const [syncingFHIR, setSyncingFHIR] = useState(false);
  const [parsingHL7, setParsingHL7] = useState(false);
  
  // HL7 message input
  const [hl7Msg, setHl7Msg] = useState("MSH|^~\\&|EPIC|ROSE_HOSPITAL|INTERAC_AI|LAGOOS|20260731||ADT^A08|MSG00001|P|2.5\nPID|1||PAT990141||Doe^John||19850615|M|||123 Main St^^Lagos\nPV1|1|O|Outpatient Unit||||DR_AMINAYUSUF");
  const [hl7Result, setHl7Result] = useState(null);

  const handleSyncFHIR = async () => {
    setSyncingFHIR(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/integrations/fhir/sync?org_id=${orgId}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(`FHIR Sync complete! Ingested ${data.patients_ingested} Patients and ${data.observations_ingested} Vitals.`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingFHIR(false);
    }
  };

  const handleParseHL7 = async (e) => {
    e.preventDefault();
    setParsingHL7(true);
    setHl7Result(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/hospital/integrations/hl7/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, hl7_message: hl7Msg })
      });
      if (res.ok) {
        const data = await res.json();
        setHl7Result(data);
      } else {
        const err = await res.json();
        alert(err.detail || "Parse failed");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setParsingHL7(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Network className="w-4 h-4" /> INTEGRATION STANDARDS
          </div>
          <h2 className="text-3xl font-extrabold text-white">Mode A Integration Gateway</h2>
          <p className="text-slate-400 mt-1">Synchronize clinical patient resources via FHIR JSON APIs and parse HL7 ADT message segments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: FHIR Sync */}
        <div className="glass rounded-3xl border border-white/10 p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-rose-400" /> FHIR REST API Endpoint Client
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Connect to an external Hospital Management System (such as OpenMRS, Bahmni, Epic, or Cerner) via standard FHIR API servers.
              Synchronizes local database cache stores with remote Patient files and clinical observation indexes.
            </p>
            <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Target FHIR Base URL:</span><span className="text-white font-mono">https://fhir.nigeria-hms.org/fhir/v4</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Security Credentials:</span><span className="text-emerald-400 font-bold">MUTUAL TLS & JWT CERT ACTIVE</span></div>
            </div>
          </div>

          <button
            onClick={handleSyncFHIR}
            disabled={syncingFHIR}
            className="w-full px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {syncingFHIR ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing FHIR Patient Assets...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Trigger FHIR Database Sync Now
              </>
            )}
          </button>
        </div>

        {/* Right: HL7 Message Segment Parser */}
        <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-400" /> HL7 Message Segment Parser
          </h3>
          
          <form onSubmit={handleParseHL7} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">HL7 Segment Content</label>
              <textarea
                required
                value={hl7Msg}
                onChange={(e) => setHl7Msg(e.target.value)}
                rows="4"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={parsingHL7}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-2 transition-colors border border-white/10"
            >
              {parsingHL7 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Parse Segment & Ingest Patient Record
            </button>
          </form>

          {hl7Result && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl text-xs space-y-2 animate-fade-in-up">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold pb-2 border-b border-white/5">
                <CheckCircle2 className="w-4 h-4" /> HL7 Segment Ingested successfully
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>Patient Name: <strong className="text-white">{hl7Result.patient_name}</strong></div>
                <div>File ID: <strong className="text-white font-mono">{hl7Result.patient_id}</strong></div>
                <div>Gender: <strong className="text-white">{hl7Result.gender}</strong></div>
                <div>Birth Date: <strong className="text-white">{hl7Result.dob}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
