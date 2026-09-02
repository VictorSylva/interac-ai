import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduLibraryPage({ orgId }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    isbn: '',
    copies: 5
  });

  const [activeStudentId, setActiveStudentId] = useState('EDU-STUD-5541');
  const [activeStudentName, setActiveStudentName] = useState('Daniel Nnamdi');

  useEffect(() => {
    fetchBooks();
  }, [orgId]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/library/books?org_id=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/library/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...formData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ title: '', isbn: '', copies: 5 });
        fetchBooks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBorrow = async (bookId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/library/borrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          book_id: bookId,
          student_id: activeStudentId,
          student_name: activeStudentName
        })
      });
      if (res.ok) {
        fetchBooks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturn = async (bookId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/library/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          book_id: bookId,
          student_id: activeStudentId
        })
      });
      if (res.ok) {
        fetchBooks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Package className="w-4 h-4" /> LIBRARY DESK
          </div>
          <h2 className="text-3xl font-extrabold text-white">Library Catalog & Borrowing Registry</h2>
          <p className="text-slate-400 mt-1">Manage textbook inventories, track check-outs, issue fine invoices, and monitor digital assets.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Catalog Book
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Book Stock Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Book Title</th>
                    <th className="p-4">ISBN</th>
                    <th className="p-4">Available / Total</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading catalog...</td></tr>
                  ) : books.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No library books registered. Click Catalog Book.</td></tr>
                  ) : books.map(b => {
                    const borrowed = b.attributes?.borrowed_logs?.some(l => l.student_id === activeStudentId && l.status === 'BORROWED');
                    return (
                      <tr key={b.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-white">{b.display_label}</td>
                        <td className="p-4 font-mono text-cyan-300">{b.attributes?.isbn}</td>
                        <td className="p-4 font-mono text-slate-400">{b.attributes?.available_copies} / {b.attributes?.total_copies}</td>
                        <td className="p-4 text-right space-x-2">
                          {borrowed ? (
                            <button
                              onClick={() => handleReturn(b.id)}
                              className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold transition"
                            >
                              Return Book
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBorrow(b.id)}
                              disabled={b.attributes?.available_copies <= 0}
                              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-[10px] font-bold transition"
                            >
                              Issue Copy
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Active Student Issuer</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1.5">Selected Student</label>
                <select
                  value={activeStudentId}
                  onChange={(e) => {
                    const selName = e.target.value === 'EDU-STUD-5541' ? 'Daniel Nnamdi' : 'Kassim Bello';
                    setActiveStudentId(e.target.value);
                    setActiveStudentName(selName);
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="EDU-STUD-5541">Daniel Nnamdi (EDU-STUD-5541)</option>
                  <option value="EDU-STUD-1024">Kassim Bello (EDU-STUD-1024)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="bg-cyan-950/20 px-6 py-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Catalog New Textbook</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Book Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Physics Volume 1"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">ISBN Number</label>
                  <input
                    type="text"
                    required
                    placeholder="978-0-123456-7"
                    value={formData.isbn}
                    onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Initial Copies Stock</label>
                  <input
                    type="number"
                    value={formData.copies}
                    onChange={(e) => setFormData({...formData, copies: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center gap-2">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
