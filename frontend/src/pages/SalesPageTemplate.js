import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const SalesPageTemplate = () => {
    const { businessSlug, offerSlug } = useParams();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [assessmentAnswers, setAssessmentAnswers] = useState({});

    useEffect(() => {
        const apiUrl = API_BASE_URL;
        
        const fetchPage = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/sales/public/${businessSlug}/${offerSlug}`);
                if (!res.ok) throw new Error("Offer details could not be retrieved. It may have expired or been deactivated.");
                const data = await res.json();
                setPageData(data);
            } catch(e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
        
        // --- Verification Flow ---
        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference');
        
        if (reference && !verified) {
            const verifyPayment = async () => {
                setVerifying(true);
                try {
                    const res = await fetch(`${apiUrl}/api/sales/public/verify/${reference}`);
                    const data = await res.json();
                    if (res.ok || data.status === 'already_processed') {
                        setVerified(true);
                    } else {
                        setError("Payment verification encountered an issue. Our team has been notified. Please do not re-pay.");
                    }
                } catch (err) {
                    setError("Unable to connect to verification server. Please refresh or contact support.");
                } finally {
                    setVerifying(false);
                }
            };
            verifyPayment();
        }
    }, [businessSlug, offerSlug, verified]);

    const handleCheckout = async (e) => {
        e.preventDefault();
        setIsCheckingOut(true);
        const apiUrl = API_BASE_URL;

        try {
            const res = await fetch(`${apiUrl}/api/sales/public/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offer_id: pageData.offer.id,
                    customer_email: email,
                    customer_phone: phone || null,
                    currency: pageData.offer.currency,
                    callback_url: window.location.origin + window.location.pathname + "?success=true",
                    assessment_answers: assessmentAnswers
                })
            });
            
            const data = await res.json();
            if (res.ok && data.authorization_url) {
                window.location.href = data.authorization_url; // Redirect to Paystack
            } else {
                throw new Error(data.detail || "Checkout initialization failed. Please try again later.");
            }
        } catch(e) {
            alert(e.message);
            setIsCheckingOut(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Loading Offer...</p>
        </div>
    </div>;
    
    if (error) return <div className="flex h-screen items-center justify-center text-red-500 bg-slate-50 p-6 text-center">
        <div className="max-w-md">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-800 text-white rounded-full font-bold hover:bg-slate-700 transition-colors">Try Again</button>
        </div>
    </div>;

    const content = pageData.page_content || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center py-12 px-4 font-sans text-slate-800">
            <div className="max-w-2xl w-full">
                {/* Optional Hero Image */}
                {content.image_url && (
                    <div className="w-full h-64 md:h-80 rounded-3xl overflow-hidden shadow-lg mb-8 animate-fade-in-up border border-white/50">
                        <img src={content.image_url} alt={pageData.offer.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Header Section */}
                <div className="text-center mb-10 animate-fade-in-up">
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4 tracking-tight">
                        {pageData.offer.title}
                    </h1>
                    <p className="text-slate-500 text-lg max-w-lg mx-auto leading-relaxed">
                        {content.subtitle || "Secure your spot and get instant access to our premium offering."}
                    </p>
                </div>
                
                {/* Verifying State UI */}
                {verifying && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-xl border border-blue-100 text-center mb-8 animate-pulse">
                         <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                         <h3 className="text-2xl font-bold text-slate-800 mb-2">Completing your purchase...</h3>
                         <p className="text-slate-500">Please wait while we verify your payment with Paystack.</p>
                    </div>
                )}

                {/* Success Message UI */}
                {(verified || window.location.search.includes('success=true')) && !verifying && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-emerald-100 text-center mb-10 animate-[bounce_1s_ease-in-out_infinite_alternate] shadow-emerald-500/10">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-50">
                            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-3xl font-black text-emerald-900 mb-3 tracking-tight">Payment Successful!</h2>
                        <p className="text-emerald-700 text-lg mb-8 leading-relaxed max-w-md mx-auto">
                            Fantastic! Your purchase is confirmed. We've sent your receipt and delivery details to your inbox and WhatsApp.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm font-bold text-emerald-800">
                                Order Reference: {new URLSearchParams(window.location.search).get("reference") || "Confirmed"}
                            </div>
                            <button 
                                onClick={() => window.location.href = '/'}
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                            >
                                Back to Platform
                            </button>
                        </div>
                    </div>
                )}

                {!verifying && !verified && !window.location.search.includes('success=true') && (
                    <>
                        {/* Main Card */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                            <div className="p-8 md:p-10">
                                {/* Offer Details */}
                                <div className="mb-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                                    <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap">
                                        {pageData.offer.description || "Get full access to this exclusive offer now. This includes all bonuses and lifetime updates."}
                                    </p>
                                    
                                    {content.features && content.features.length > 0 && (
                                        <ul className="mt-6 space-y-3 pt-6 border-t border-slate-200/60">
                                            {content.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start">
                                                    <svg className="w-6 h-6 text-emerald-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                    <span className="text-slate-700 font-medium">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                
                                {/* Price Summary */}
                                <div className="flex items-center justify-between py-6 mb-8 border-b border-slate-100">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-slate-400 font-semibold uppercase tracking-wider text-sm">Total Due Today</span>
                                            {pageData.offer.stock !== undefined && (
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                    pageData.offer.stock > 0 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                    {pageData.offer.stock > 0 ? `${pageData.offer.stock} in stock` : 'Out of stock'}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-slate-900 font-bold text-4xl flex items-baseline gap-2">
                                            <span className="text-2xl text-slate-400 font-semibold">{pageData.offer.currency === 'NGN' ? '₦' : '$'}</span>
                                            {typeof pageData.offer.price === 'number' 
                                                ? pageData.offer.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                                : pageData.offer.price} 
                                            <span className="text-lg font-medium text-slate-400 ml-1">{pageData.offer.currency}</span>
                                        </span>
                                    </div>
                                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100 shadow-sm">
                                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                </div>

                                {/* Checkout Form */}
                                <form onSubmit={handleCheckout} className="space-y-6 relative">
                                    
                                    {/* Assessment Fields */}
                                    {pageData.assessment_template && pageData.assessment_template.length > 0 && (
                                        <div className="mb-6 space-y-4">
                                            <h3 className="text-lg font-bold text-slate-800">Please answer a few quick questions:</h3>
                                            {pageData.assessment_template.map((q, idx) => (
                                                <div key={idx} className="flex flex-col">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                        {q.question} {q.required && <span className="text-red-500">*</span>}
                                                    </label>
                                                    {q.type === 'textarea' ? (
                                                        <textarea 
                                                            required={q.required}
                                                            value={assessmentAnswers[q.question] || ''}
                                                            onChange={e => setAssessmentAnswers({...assessmentAnswers, [q.question]: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-800 resize-none min-h-[100px]"
                                                        ></textarea>
                                                    ) : (
                                                        <input 
                                                            type="text"
                                                            required={q.required}
                                                            value={assessmentAnswers[q.question] || ''}
                                                            onChange={e => setAssessmentAnswers({...assessmentAnswers, [q.question]: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-800"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            <hr className="my-6 border-slate-200" />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Delivery Email Address</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
                                            </div>
                                            <input 
                                                type="email" 
                                                required
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-800 font-medium placeholder-slate-400"
                                                placeholder="you@example.com"
                                                disabled={isCheckingOut}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Phone Number</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            </div>
                                            <input 
                                                type="tel" 
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-800 font-medium placeholder-slate-400"
                                                placeholder="+1234567890"
                                                disabled={isCheckingOut}
                                            />
                                        </div>
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        disabled={isCheckingOut}
                                        className={`w-full relative overflow-hidden group py-4 rounded-xl text-lg font-bold text-white transition-all transform
                                            ${isCheckingOut ? 'bg-indigo-400 cursor-not-allowed scale-[0.98]' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/30'}
                                        `}
                                    >
                                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                        <span className="relative flex items-center justify-center gap-2">
                                            {isCheckingOut ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    Initializing Secure Checkout...
                                                </>
                                            ) : (
                                                <>
                                                    Complete Purchase
                                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </form>
                            </div>
                            
                            {/* Trust Badges */}
                            <div className="bg-slate-50 p-6 border-t border-slate-100">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                        <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                                        Bank-level 256-bit encryption
                                    </div>
                                    <div className="flex gap-3 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                                        {/* SVG icons mockups for cards */}
                                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            <style jsx>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default SalesPageTemplate;
