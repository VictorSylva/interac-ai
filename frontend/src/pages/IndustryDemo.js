import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquare, ShieldCheck, Zap } from 'lucide-react';
import DemoChat from '../components/landing/DemoChat';

const IndustryDemo = () => {
  const { industry } = useParams();
  
  const flows = {
    hotel: [
      { content: "Hello {name}! Welcome to the Royal Sands Hotel. I'm your AI concierge. How can I assist you today?", suggestions: ["Book a room", "See amenities"] },
      { content: "Excellent choice! For when are you planning your stay?", suggestions: ["This weekend", "Next month"] },
      { content: "We have a Deluxe Sea View room and a Presidential Suite available for those dates. Which would you prefer?", suggestions: ["Deluxe Sea View", "Presidential Suite"] },
      { content: "Great! I just need your full name and email to hold the reservation.", suggestions: ["Send my details"] },
      { content: "Perfect, {name}. Your reservation is held! Here is your secure payment link to confirm: [Link]. Anything else I can help with?", suggestions: ["No thanks, all good!"] }
    ],
    clinic: [
      { content: "Hello {name}. Welcome to City Health Clinic. How can we help you today?", suggestions: ["Schedule appointment", "General inquiry"] },
      { content: "I can help with that. What symptoms or service are you looking for?", suggestions: ["Dental checkup", "General consultation"] },
      { content: "We have Dr. Smith (General) and Dr. Jones (Dental) available. Would you like to see available slots?", suggestions: ["Show time slots"] },
      { content: "Available slots for tomorrow: 10:00 AM, 2:30 PM, and 4:00 PM. Which works best?", suggestions: ["10:00 AM", "4:00 PM"] },
      { content: "Booked! You'll receive a confirmation SMS shortly. We look forward to seeing you, {name}.", suggestions: ["Thank you!"] }
    ],
    'real-estate': [
      { content: "Hi {name}! Looking for your dream home? I can show you our latest listings. What is your preferred location?", suggestions: ["Downtown", "Suburbs"] },
      { content: "Great area! And what is your approximate budget range?", suggestions: ["$500k - $800k", "$1M+"] },
      { content: "I found 3 properties matching your criteria. Would you like to see the virtual tours or book a physical viewing?", suggestions: ["Show virtual tours", "Book a viewing"] },
      { content: "I can schedule a viewing for you this Saturday. Does 11:00 AM work?", suggestions: ["Yes, that works", "Try another time"] },
      { content: "Excellent! I've notified the agent. They will meet you at the property. Happy house hunting, {name}!", suggestions: ["Thanks!"] }
    ]
  };

  const industryData = {
    hotel: { title: "Hotels & Shortlets", color: "indigo", colorHex: "#6366f1" },
    clinic: { title: "Clinics & Hospitals", color: "rose", colorHex: "#f43f5e" },
    'real-estate': { title: "Real Estate Agents", color: "emerald", colorHex: "#10b981" }
  };

  const industrySteps = {
    hotel: [
      { step: "01", title: "Guest Inquiry", desc: "Guest asks about room availability or check-in on WhatsApp." },
      { step: "02", title: "AI Reservation", desc: "AI instantly checks availability and offers tailored room options." },
      { step: "03", title: "Booking Confirmed", desc: "AI captures guest details and sends a secure payment link." },
      { step: "04", title: "Revenue Captured", desc: "Reservation is synced to your PMS and payment is processed." }
    ],
    clinic: [
      { step: "01", title: "Patient Request", desc: "Patient messages to book a consultation or check clinic hours." },
      { step: "02", title: "AI Triage", desc: "AI qualifies the patient and suggests the right specialist." },
      { step: "03", title: "Appointment Set", desc: "AI books a slot directly into your clinic's digital calendar." },
      { step: "04", title: "Reduced No-Shows", desc: "Patient receives automated SMS reminders and instructions." }
    ],
    'real-estate': [
      { step: "01", title: "Lead Capture", desc: "Buyer inquires about a listing seen on social media or your site." },
      { step: "02", title: "AI Qualification", desc: "AI qualifies the buyer's budget and location preferences." },
      { step: "03", title: "Viewing Booked", desc: "AI schedules a physical or virtual viewing for the agent." },
      { step: "04", title: "Faster Closings", desc: "Agent is notified of the hot lead with full qualification data." }
    ]
  };

  const currentIndustry = industryData[industry] || industryData.hotel;
  const currentFlow = flows[industry] || flows.hotel;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-100 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center text-slate-500 font-bold hover:text-indigo-600 transition-colors">
            <ArrowLeft className="mr-2" size={20} /> Back to Home
          </Link>
          <img src="/interacAi-logo.png" alt="Logo" className="h-14 w-auto brightness-0 invert" />
          <div className="w-24 hidden md:block" /> 
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-12">
            <div>
              <div className={`inline-flex items-center px-4 py-1.5 mb-6 rounded-full text-xs font-bold uppercase tracking-widest`} style={{ backgroundColor: `${currentIndustry.colorHex}15`, color: currentIndustry.colorHex }}>
                Live Simulation
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-[#0f172a] mb-6 tracking-tight leading-tight">
                InteracAI for <br />
                <span style={{ color: currentIndustry.colorHex }}>{currentIndustry.title}</span>
              </h1>
              <p className="text-xl text-slate-500 font-medium leading-relaxed">
                Experience how our AI handles complex customer journeys, captures data, and drives conversions automatically.
              </p>
            </div>

            <div className="space-y-8">
              <h3 className="text-xl font-bold text-[#0f172a]">What's happening in this demo?</h3>
              {[
                { icon: MessageSquare, title: "Natural Conversations", desc: "AI understands intent and responds contextually, not just with keywords." },
                { icon: Zap, title: "Instant Lead Capture", desc: "User details are automatically saved to your CRM during the chat." },
                { icon: CheckCircle2, title: "Goal Completion", desc: "From booking to payments, AI guides users to the finish line." },
                { icon: ShieldCheck, title: "Secure & Reliable", desc: "Enterprise-grade security for all customer interactions." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center flex-shrink-0`} style={{ color: currentIndustry.colorHex }}>
                    <item.icon size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0f172a]">{item.title}</h4>
                    <p className="text-slate-500 text-sm font-medium">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-8 rounded-3xl text-white shadow-xl shadow-indigo-500/10`} style={{ backgroundColor: currentIndustry.colorHex }}>
              <h3 className="text-2xl font-bold mb-4">Ready to go live?</h3>
              <p className="text-white/80 font-medium mb-8">
                Setup your own custom AI agent in less than 10 minutes. No coding required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => window.location.href='/#book-demo'} 
                  className="px-8 py-4 bg-white text-[#0f172a] rounded-2xl font-bold hover:opacity-90 transition-all text-center"
                >
                  Book Your Demo
                </button>
                <button 
                  onClick={() => window.location.href='/#book-demo'}
                  className="px-8 py-4 bg-black/20 border border-white/20 rounded-2xl font-bold hover:bg-black/30 transition-all text-center"
                >
                  Talk to Sales
                </button>
              </div>
            </div>
          </div>

          <div className="h-[600px] md:h-[700px] lg:sticky lg:top-32">
            <DemoChat industry={industry} flow={currentFlow} />
          </div>
        </div>
      </main>

      <section className="bg-white py-24 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-[#0f172a]">The {currentIndustry.title} Flow</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  {(industrySteps[industry] || industrySteps.hotel).map((s, i) => (
                      <div key={i} className="relative group">
                          <div className="text-6xl font-black text-slate-100 group-hover:text-indigo-50 transition-colors absolute -top-8 -left-4 -z-0">{s.step}</div>
                          <div className="relative z-10">
                              <h4 className="font-bold text-lg mb-2">{s.title}</h4>
                              <p className="text-slate-500 text-sm font-medium">{s.desc}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>
    </div>
  );
};

export default IndustryDemo;
