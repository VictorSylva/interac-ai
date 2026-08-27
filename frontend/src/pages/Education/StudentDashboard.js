import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, BookOpen, Clock, FileText, Send, Sparkles, AlertCircle, Receipt } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduStudentDashboardPage({ orgId }) {
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [studentName, setStudentName] = useState('Loading profile...');
  const [courseEnrolled, setCourseEnrolled] = useState('');
  
  // AI Tutor chat
  const [messages, setMessages] = useState([
    { sender: 'tutor', text: "Hello! I'm your AI Study Partner. What topic in Math or Computer Science are we studying today?" }
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    fetchStudentProfile();
  }, [orgId]);

  useEffect(() => {
    if (studentId) {
      fetchReport();
      fetchDashboardData();
    }
  }, [orgId, studentId]);

  const fetchStudentProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/students/me?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const sData = await res.json();
        setStudentId(sData.attributes?.student_id || sData.id);
        setStudentName(sData.display_label);
        setCourseEnrolled(sData.attributes?.course_enrolled || '');
      } else {
        const listRes = await fetch(`${API_BASE_URL}/api/v1/education/students?org_id=${encodeURIComponent(orgId)}`);
        if (listRes.ok) {
          const list = await listRes.json();
          if (list && list.length > 0) {
            const first = list[0];
            setStudentId(first.attributes?.student_id || first.id);
            setStudentName(first.display_label);
            setCourseEnrolled(first.attributes?.course_enrolled || '');
          } else {
            setStudentId('');
            setStudentName('No Students Registered');
            setCourseEnrolled('');
          }
        }
      }
    } catch (e) {
      console.error("Error loading student profile:", e);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Courses
      const cRes = await fetch(`${API_BASE_URL}/api/v1/education/academic/courses?org_id=${encodeURIComponent(orgId)}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCourses(cData || []);
      }
      // Assignments
      const aRes = await fetch(`${API_BASE_URL}/api/v1/education/learning/materials?org_id=${encodeURIComponent(orgId)}`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAssignments(aData || []);
      }
      // Invoices
      const iRes = await fetch(`${API_BASE_URL}/api/v1/education/fees/invoices?org_id=${encodeURIComponent(orgId)}`);
      if (iRes.ok) {
        const iData = await iRes.json();
        setInvoices(iData || []);
      }
    } catch (e) {
      console.error("Error loading dashboard details:", e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
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
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate AI Tutor response after a second
    setTimeout(() => {
      let response = "That's an interesting question! Let's break it down step-by-step. Remember we have our test scheduled for next Monday.";
      if (chatInput.toLowerCase().includes('math') || chatInput.toLowerCase().includes('algebra')) {
        response = "For quadratic equations, use the formula x = (-b ± √(b² - 4ac)) / 2a. Shall we solve an example together?";
      } else if (chatInput.toLowerCase().includes('chemistry')) {
        response = "In our Chemistry practicals, remember that balancing equations is about matching the count of atoms on the reactant and product sides. Let's look at H2 + O2 -> H2O.";
      }
      setMessages(prev => [...prev, { sender: 'tutor', text: response }]);
    }, 1000);
  };

  const studentCourses = courses.filter(c =>
    courseEnrolled && (
      c.display_label?.toLowerCase() === courseEnrolled.toLowerCase() ||
      c.attributes?.stream?.toLowerCase() === courseEnrolled.toLowerCase() ||
      c.attributes?.curriculum?.toLowerCase() === courseEnrolled.toLowerCase()
    )
  );

  const studentAssignments = assignments.filter(a =>
    courseEnrolled && (
      a.attributes?.subject?.toLowerCase() === courseEnrolled.toLowerCase() ||
      a.attributes?.stream?.toLowerCase() === courseEnrolled.toLowerCase() ||
      a.attributes?.class?.toLowerCase() === courseEnrolled.toLowerCase()
    )
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Welcome Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
          <LayoutDashboard className="w-4 h-4" /> STUDENT DESK
        </div>
        <h2 className="text-3xl font-extrabold text-white">Welcome back, {studentName}!</h2>
        <p className="text-slate-400 mt-1">Here is your academic overview, timetable scheduler, homework submissions, and AI study companion.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Columns: Timetable, Grades, Homework */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vitals Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
                <div className="text-2xl font-black text-cyan-400 mt-1">{report?.attendance_rate || 'N/A'}</div>
              </div>
              <Calendar className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Grade Position</span>
                <div className="text-2xl font-black text-indigo-400 mt-1">{report?.position_in_class || 'N/A'}</div>
              </div>
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Invoices</span>
                <div className="text-2xl font-black text-amber-400 mt-1">₦{(invoices.filter(inv => inv.attributes?.student_id === studentId).reduce((acc, curr) => acc + (curr.attributes?.balance || 0), 0)).toLocaleString()}</div>
              </div>
              <Receipt className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          {/* Timetable & Assignments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Today's Class Timetable</h3>
              <div className="space-y-3">
                {studentCourses.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-4 text-center bg-white/5 rounded-xl border border-white/5">
                    No scheduled classes found for your department.
                  </div>
                ) : (
                  studentCourses.map((c, index) => (
                    <div key={c.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-xs">{c.display_label}</div>
                        <div className="text-[10px] text-slate-400">Teacher: {c.attributes?.teacher_name || 'Unassigned'} | {c.attributes?.stream || 'Syllabus Item'}</div>
                      </div>
                      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">
                        {index === 0 ? '09:00 - 10:30' : index === 1 ? '11:00 - 12:30' : '14:00 - 15:30'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Homework Assignments</h3>
              <div className="space-y-3">
                {studentAssignments.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-4 text-center bg-white/5 rounded-xl border border-white/5">
                    No active homework assignments found for your department.
                  </div>
                ) : (
                  studentAssignments.map(a => (
                    <div key={a.id} className="bg-white/5 p-3 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-white">
                        <span>{a.display_label}</span>
                        <span className="text-rose-400 font-medium">Due: {a.attributes?.due_date || 'N/A'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Subject: {a.attributes?.subject} | <a href={a.attributes?.materials_url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">View File</a></p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Academic Report Card */}
          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Academic Report Card</h3>
            {loading ? (
              <div className="text-center text-slate-500 text-xs py-4">Loading reports...</div>
            ) : report && report.grades && Object.keys(report.grades).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(report.grades).map(([subject, grade]) => (
                  <div key={subject} className="bg-black/30 border border-white/5 p-4 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-500 font-bold block truncate uppercase">{subject}</span>
                    <span className="text-2xl font-black text-cyan-400 mt-1 block">{grade}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-xs italic py-4 bg-white/5 rounded-xl border border-white/5">
                No evaluation grades published for this term yet.
              </div>
            )}
            {report?.comments && (
              <div className="bg-black/20 p-3 rounded-xl border border-white/5 text-[11px] text-slate-400 leading-relaxed">
                <strong>Instructor Commentary:</strong> {report.comments}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Tutor Workspace */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-cyan-500/30 p-6 flex flex-col h-[520px]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" /> AI Study Partner Tutor
            </h3>

            {/* Chat message box */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1 scrollbar-thin">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-cyan-600 text-white rounded-tr-none'
                      : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="border-t border-white/10 pt-4 flex gap-2">
              <input
                type="text"
                placeholder="Ask me anything (e.g. solve algebra)..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
