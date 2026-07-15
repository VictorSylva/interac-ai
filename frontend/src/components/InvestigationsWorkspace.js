import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, ShieldAlert, Clock, User, Clipboard, Plus, CheckCircle2, 
  MessageSquare, Send, Bot, Loader2, RefreshCw, AlertCircle, TrendingUp 
} from 'lucide-react';

export default function InvestigationsWorkspace() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  
  // Note inputs
  const [newNote, setNewNote] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('Analyst');

  // Case creation states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    entity_identifier: '',
    description: '',
    severity: 'medium',
    assigned_to: 'Analyst'
  });

  const API_HOST = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoadingList(true);
      const res = await fetch(`${API_HOST}/api/v2/investigations/`);
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (e) {
      console.error('Error fetching cases', e);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDossier = async (caseId) => {
    try {
      setLoadingDossier(true);
      const res = await fetch(`${API_HOST}/api/v2/investigations/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setDossier(data);
        setSelectedCaseId(caseId);
      }
    } catch (e) {
      console.error('Error fetching dossier', e);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.entity_identifier.trim()) return;

    try {
      const res = await fetch(`${API_HOST}/api/v2/investigations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });
      
      if (res.ok) {
        const result = await res.json();
        setShowCreateForm(false);
        setCreateForm({ title: '', entity_identifier: '', description: '', severity: 'medium', assigned_to: 'Analyst' });
        await fetchCases();
        if (result.case_id) {
          await fetchDossier(result.case_id);
        }
      }
    } catch (err) {
      console.error('Failed to create case', err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedCaseId) return;

    try {
      const res = await fetch(`${API_HOST}/api/v2/investigations/${selectedCaseId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: noteAuthor,
          text: newNote.trim()
        })
      });
      if (res.ok) {
        setNewNote('');
        await fetchDossier(selectedCaseId);
      }
    } catch (e) {
      console.error('Error adding note', e);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedCaseId) return;

    try {
      const res = await fetch(`${API_HOST}/api/v2/investigations/${selectedCaseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchDossier(selectedCaseId);
        await fetchCases();
      }
    } catch (e) {
      console.error('Error updating status', e);
    }
  };

  const runCopilotInvestigation = async () => {
    if (!selectedCaseId || !dossier) return;
    setLoadingCopilot(true);

    try {
      const queryText = `Analyze the security and business anomalies for case: ${dossier.title} targeting entity ${dossier.entity_identifier}`;
      const res = await fetch(`${API_HOST}/api/v2/copilot/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          case_id: selectedCaseId
        })
      });
      if (res.ok) {
        // Refetch dossier to display the newly added note by Copilot
        await fetchDossier(selectedCaseId);
      }
    } catch (e) {
      console.error('Error running Copilot', e);
    } finally {
      setLoadingCopilot(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'closed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'under_review': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'in_progress': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="flex gap-6 h-[720px] animate-fade-in-up">
      {/* Sidebar Panel: Cases list */}
      <div className="w-4/12 glass rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 m-0">
            <FolderOpen size={20} className="text-indigo-400" />
            Cases Files
          </h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all"
          >
            <Plus size={14} /> New Case
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
          {loadingList ? (
            <div className="text-center text-slate-400 py-10">Loading investigations...</div>
          ) : showCreateForm ? (
            <form onSubmit={handleCreateCase} className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-indigo-300 m-0">Create Investigation Case</h4>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Case Title</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                  className="bg-black/60 border border-white/10 rounded-lg p-2 text-sm text-white"
                  placeholder="e.g. Intrusion Probe dock 5"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Entity Identifier</label>
                <input
                  type="text"
                  required
                  value={createForm.entity_identifier}
                  onChange={(e) => setCreateForm({...createForm, entity_identifier: e.target.value})}
                  className="bg-black/60 border border-white/10 rounded-lg p-2 text-sm text-white"
                  placeholder="e.g. customer_234..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Case Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  className="bg-black/60 border border-white/10 rounded-lg p-2 text-sm text-white h-20 resize-none"
                  placeholder="Summarize investigation scope..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-semibold">Severity</label>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({...createForm, severity: e.target.value})}
                    className="bg-black/60 border border-white/10 rounded-lg p-2 text-sm text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-semibold">Assignee</label>
                  <input
                    type="text"
                    value={createForm.assigned_to}
                    onChange={(e) => setCreateForm({...createForm, assigned_to: e.target.value})}
                    className="bg-black/60 border border-white/10 rounded-lg p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Save Case
                </button>
              </div>
            </form>
          ) : cases.length === 0 ? (
            <div className="text-center text-slate-500 py-10">No cases recorded.</div>
          ) : (
            cases.map(c => (
              <div
                key={c.case_id}
                onClick={() => fetchDossier(c.case_id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedCaseId === c.case_id 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : 'border-white/10 glass-card hover:border-indigo-400/50'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold border ${getSeverityBadge(c.severity)}`}>
                    {c.severity}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold border ${getStatusColor(c.status)}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5 truncate">{c.title}</h4>
                
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <Clipboard size={12} className="text-slate-500" />
                    {c.entity_identifier.length > 15 ? c.entity_identifier.substring(0, 15) + '...' : c.entity_identifier}
                  </div>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel: Case Details Dossier */}
      <div className="flex-1 glass rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-black/10">
        {loadingDossier ? (
          <div className="flex-grow flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="animate-spin text-indigo-400" size={32} />
            <span>Loading case dossier details...</span>
          </div>
        ) : !dossier ? (
          <div className="flex-grow flex flex-col items-center justify-center gap-3 text-slate-500">
            <FolderOpen size={56} className="opacity-20" />
            <p className="text-sm">Select an active investigation case file from the registry directory sidebar.</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
            {/* Dossier Header Controls */}
            <div className="flex justify-between items-start flex-wrap gap-4 border-b border-white/10 pb-5">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">CASE FILE ID: #{dossier.case_id}</span>
                <h2 className="text-2xl font-bold text-white m-0 mt-1">{dossier.title}</h2>
                <p className="text-slate-400 text-sm mt-1.5">{dossier.description || 'No background description provided.'}</p>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</label>
                  <select
                    value={dossier.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white font-bold"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="under_review">Under Review</option>
                    <option value="closed">Closed / Resolved</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assignee</label>
                  <span className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-200 font-semibold flex items-center gap-1.5">
                    <User size={12} className="text-indigo-400" />
                    {dossier.assigned_to || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Copilot Reasoning Action Box */}
            <div className="glass border border-indigo-500/30 rounded-xl p-4 bg-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Bot size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white m-0">ARGUS OS ReAct Copilot</h4>
                  <p className="text-xs text-slate-400 m-0 mt-1">Autonomous reasoning agent scanner</p>
                </div>
              </div>

              <button
                onClick={runCopilotInvestigation}
                disabled={loadingCopilot || dossier.status === 'closed'}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCopilot ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing footprints...
                  </>
                ) : (
                  <>
                    <Bot size={14} /> Run AI Copilot Scan
                  </>
                )}
              </button>
            </div>

            {/* Entity Context engine profiles */}
            {dossier.entity_context && Object.keys(dossier.entity_context).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Risk Vector Breakdown */}
                <div className="glass rounded-xl border border-white/10 p-5">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <TrendingUp size={14} /> Multi-Dimensional Risk Metrics
                  </h4>
                  
                  <div className="flex items-center gap-5 mb-5 border-b border-white/5 pb-4">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-4 border-rose-500/40 flex flex-col items-center justify-center text-white">
                      <span className="text-xl font-black">{dossier.entity_context.risk_score}</span>
                      <span className="text-[8px] font-bold text-rose-300 uppercase leading-none">score</span>
                    </div>
                    <div>
                      <div className="text-slate-200 font-bold text-sm">Aggregate Risk Level</div>
                      <div className="text-xs text-slate-400 capitalize mt-0.5">Status bounds: {dossier.entity_context.status}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {/* Progress Bars for Risk dimensions (extracting vector from history details) */}
                    {(() => {
                      const history = dossier.entity_context.risk_history || [];
                      const vector = (history.length > 0 && history[0].vector) ? history[0].vector : {
                        physical: dossier.entity_context.risk_score || 0,
                        operational: 0,
                        financial: 0,
                        behavioral: 0,
                        fraud: 0,
                        safety: 0
                      };
                      
                      const safeVector = vector || {};
                      return Object.entries(safeVector).map(([dim, val]) => (
                        <div key={dim} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-400 capitalize">{dim} Risk</span>
                            <span className="text-slate-200">{(val || 0).toFixed(1)}</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${(val || 0) >= 40 ? 'bg-rose-500' : (val || 0) >= 15 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                              style={{ width: `${Math.min(100, val || 0)}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Graph Associations */}
                <div className="glass rounded-xl border border-white/10 p-5 flex flex-col">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                    Graph Associations
                  </h4>
                  <div className="flex-grow overflow-y-auto max-h-[300px] flex flex-col gap-2.5 scrollbar-thin">
                    {dossier.entity_context.known_relationships && dossier.entity_context.known_relationships.length > 0 ? (
                      dossier.entity_context.known_relationships.map((rel, idx) => (
                        <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-lg flex justify-between items-center text-xs">
                          <div>
                            <span className="text-indigo-400 font-bold uppercase">{rel.relationship}</span>
                            <div className="text-slate-200 mt-1 font-semibold">{rel.target_identifier || rel.source_identifier}</div>
                          </div>
                          <span className="text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold font-mono">
                            {rel.confidence ? rel.confidence.toFixed(2) : '1.0'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-slate-500 py-6 text-sm">No graph nodes mapped yet.</div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Chronological timelines */}
            <div className="glass rounded-xl border border-white/10 p-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Chronological Case Timeline</h4>
              <div className="max-h-[320px] overflow-y-auto flex flex-col gap-3 scrollbar-thin pr-2">
                {dossier.timeline && dossier.timeline.length > 0 ? (
                  dossier.timeline.map((evt, idx) => (
                    <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-lg flex gap-3 text-xs items-center">
                      <div className="text-[10px] text-slate-400 font-mono w-28 flex-shrink-0">
                        {new Date(evt.timestamp).toLocaleString()}
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold border uppercase flex-shrink-0 ${getSeverityBadge(evt.severity)}`}>
                        {evt.severity}
                      </span>
                      <div className="text-slate-200 font-medium flex-grow truncate" title={evt.description}>
                        {evt.description}
                      </div>
                      <div className="text-[10px] font-mono text-indigo-400 uppercase font-bold flex-shrink-0">
                        {evt.source_system}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-6">No timelines matched.</div>
                )}
              </div>
            </div>

            {/* Automated suggestions */}
            {dossier.automated_suggestions && dossier.automated_suggestions.length > 0 && (
              <div className="glass border border-amber-500/30 rounded-xl p-5 bg-amber-500/5">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <AlertCircle size={16} /> Automated Mitigation Suggestions
                </h4>
                <ul className="list-disc pl-5 text-sm text-slate-300 flex flex-col gap-2">
                  {dossier.automated_suggestions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Analyst log Notes list */}
            <div className="glass rounded-xl border border-white/10 p-5 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest m-0 flex items-center gap-1.5">
                <MessageSquare size={16} /> Case Audit Log & Notes
              </h4>

              <div className="max-h-[300px] overflow-y-auto flex flex-col gap-3 bg-black/20 p-4 rounded-xl border border-white/5 scrollbar-thin">
                {dossier.notes && dossier.notes.length > 0 ? (
                  dossier.notes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-lg text-xs leading-relaxed">
                      <div className="flex justify-between items-center text-slate-400 mb-1 font-semibold text-[10px]">
                        <span className="text-indigo-300 font-bold">{note.author}</span>
                        <span>{new Date(note.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 m-0">{note.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-4">No notes logged.</div>
                )}
              </div>

              {/* Add Note Input form */}
              <form onSubmit={handleAddNote} className="flex gap-2 flex-wrap md:flex-nowrap mt-2">
                <input
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white font-bold w-full md:w-28"
                  placeholder="Author"
                />
                
                <input
                  type="text"
                  required
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white flex-grow"
                  placeholder="Type an investigation update note or finding..."
                />
                
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Send size={12} /> Add
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
