import React, { useState } from 'react';
import { Coffee, Plus, Search, Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function EduCafeteriaPage({ orgId }) {
  const [submitting, setSubmitting] = useState(false);
  const [posMessage, setPosMessage] = useState('');
  
  const [activeStudentId, setActiveStudentId] = useState('EDU-STUD-5541');
  const [activeStudentName, setActiveStudentName] = useState('Daniel Nnamdi');

  const [mealPlans, setMealPlans] = useState([
    { id: 1, name: "Student Lunch Pack A (Jollof Rice + Chicken)", price: 800 },
    { id: 2, name: "Premium Breakfast Plan (Egg Toast + Beverage)", price: 600 },
    { id: 3, name: "Healthy Fruit Combo (Salad + Juice)", price: 500 }
  ]);

  const handleSimulatePurchase = async (mealName, price) => {
    setSubmitting(true);
    setPosMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/education/cafeteria/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          student_id: activeStudentId,
          student_name: activeStudentName,
          cost: price,
          item_name: mealName
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPosMessage(data.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Coffee className="w-4 h-4" /> CAFETERIA OFFICE
          </div>
          <h2 className="text-3xl font-extrabold text-white">Cafeteria Dining & POS Terminal</h2>
          <p className="text-slate-400 mt-1">Settle student POS food purchases, configure weekly cafeteria menus, and audit cashier registers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Weekly Dining Menu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mealPlans.map(meal => (
                <div key={meal.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl space-y-4 hover:bg-white/10 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{meal.name}</h4>
                      <span className="text-xl font-bold text-cyan-400 block mt-1">₦{meal.price}</span>
                    </div>
                    <Coffee className="w-5 h-5 text-cyan-400" />
                  </div>
                  <button
                    onClick={() => handleSimulatePurchase(meal.name, meal.price)}
                    disabled={submitting}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Swipe Student Card
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">POS Issuer Settings</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1.5">Paying Student</label>
                <select
                  value={activeStudentId}
                  onChange={(e) => {
                    const name = e.target.value === 'EDU-STUD-5541' ? 'Daniel Nnamdi' : 'Kassim Bello';
                    setActiveStudentId(e.target.value);
                    setActiveStudentName(name);
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="EDU-STUD-5541">Daniel Nnamdi (EDU-STUD-5541)</option>
                  <option value="EDU-STUD-1024">Kassim Bello (EDU-STUD-1024)</option>
                </select>
              </div>

              {posMessage && (
                <div className="p-4 bg-green-950/10 border border-green-500/20 text-green-300 rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>{posMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
