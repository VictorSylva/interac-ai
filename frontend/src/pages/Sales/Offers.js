import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Link as LinkIcon, Edit, Trash2, CheckCircle, Image as ImageIcon, MessageSquare, DollarSign, List, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const Offers = () => {
    const { currentUser } = useAuth();
    const [offers, setOffers] = useState([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentOfferId, setCurrentOfferId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [slug, setSlug] = useState('');
    const [currency, setCurrency] = useState('USD');
    
    // Content state (JSON)
    const [subtitle, setSubtitle] = useState('');
    const [features, setFeatures] = useState(['']);
    const [imageUrl, setImageUrl] = useState('');
    const [postMessage, setPostMessage] = useState('');
    const [assessmentTemplate, setAssessmentTemplate] = useState([]);
    
    // AI Metadata (Phase 3)
    const [targetAudience, setTargetAudience] = useState('');
    const [coreBenefit, setCoreBenefit] = useState('');
    const [pricePositioning, setPricePositioning] = useState('Standard');
    
    useEffect(() => {
        if (currentUser) fetchOffers();
    }, [currentUser]);
    
    const fetchOffers = async () => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/sales/offers?business_id=${currentUser.business_id}`);
            if (res.ok) {
                const data = await res.json();
                setOffers(data);
            }
        } catch(e) {
        }
    };
    
    const token = "dummy-jwt-token-for-mvp";
    
    const openEditor = (offer = null) => {
        if (offer) {
            setCurrentOfferId(offer.id);
            setTitle(offer.title || '');
            setDescription(offer.description || '');
            setPrice(offer.price || '');
            setSlug(offer.slug || '');
            setCurrency(offer.currency || 'USD');
            
            const content = offer.content || {};
            setSubtitle(content.subtitle || '');
            setFeatures(content.features?.length ? content.features : ['']);
            setImageUrl(content.image_url || '');
            setPostMessage(content.post_purchase_message || '');
            setAssessmentTemplate(offer.assessment_template || content.assessment_template || []);

            const aiMeta = offer.ai_metadata || {};
            setTargetAudience(aiMeta.target_audience || '');
            setCoreBenefit(aiMeta.core_benefit || '');
            setPricePositioning(aiMeta.price_positioning || 'Standard');
        } else {
            setCurrentOfferId(null);
            setTitle(''); setDescription(''); setPrice(''); setSlug('');
            setCurrency('USD'); setSubtitle(''); setFeatures(['']);
            setImageUrl(''); setPostMessage(''); setAssessmentTemplate([]);
            setTargetAudience(''); setCoreBenefit(''); setPricePositioning('Standard');
        }
        setIsEditorOpen(true);
    };

    const handleFeatureChange = (index, value) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const addFeature = () => setFeatures([...features, '']);
    const removeFeature = (index) => setFeatures(features.filter((_, i) => i !== index));
    
    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const payload = {
            business_id: currentUser.business_id,
            title, description, price: parseFloat(price), slug, currency,
            content: {
                subtitle,
                features: features.filter(f => f.trim() !== ''),
                image_url: imageUrl,
                post_purchase_message: postMessage,
                assessment_template: assessmentTemplate.filter(q => q.question.trim() !== '')
            },
            ai_metadata: {
                target_audience: targetAudience,
                core_benefit: coreBenefit,
                price_positioning: pricePositioning
            }
        };

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const url = currentOfferId 
                ? `${apiUrl}/api/sales/offers/${currentOfferId}?business_id=${currentUser.business_id}`
                : `${apiUrl}/api/sales/offers`;
            
            const res = await fetch(url, {
                method: currentOfferId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                setIsEditorOpen(false);
                fetchOffers();
            } else {
                const errData = await res.json();
                alert(`Error: ${errData.detail || 'Failed to save offer'}`);
            }
        } catch(e) {
            alert("Could not connect to server. Please check your connection.");
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isEditorOpen) {
        return (
            <div className="p-6 max-w-5xl mx-auto animate-fade-in-up">
                <button onClick={() => setIsEditorOpen(false)} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back to Offers
                </button>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-slate-50 border-b border-gray-100 p-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{currentOfferId ? 'Edit Offer Page' : 'Create New Offer Page'}</h2>
                            <p className="text-slate-500 text-sm mt-1">Design your premium checkout experience and delivery rules.</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSave} className="p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Left Column: Core Details */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center border-b pb-2"><DollarSign size={18} className="mr-2 text-blue-500"/> Core Details</h3>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Offer Title</label>
                                    <input type="text" placeholder="e.g. Premium Coaching Bundle" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Price</label>
                                        <input type="number" step="0.01" placeholder="99.00" required value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Currency</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white">
                                            <option value="USD">USD ($)</option>
                                            <option value="NGN">NGN (₦)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Custom URL Slug</label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">/</span>
                                        <input type="text" placeholder="premium-bundle" required value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="flex-1 w-full border border-gray-200 p-3 rounded-r-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center"><ImageIcon size={16} className="mr-1 text-slate-400"/> Cover Image URL</label>
                                    <input type="text" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                </div>

                                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4">
                                    <h3 className="text-sm font-bold text-indigo-800 flex items-center">✨ Phase 3: Offer Intelligence</h3>
                                    <p className="text-[10px] text-indigo-600 uppercase tracking-wider font-bold">Injected into conversational AI</p>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Audience (Who is this for?)</label>
                                        <input type="text" placeholder="e.g. Busy parents, startup founders..." value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full border border-white p-2 rounded bg-white/80 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Core Benefit (What problem does it solve?)</label>
                                        <input type="text" placeholder="e.g. Save 10 hours a week on laundry..." value={coreBenefit} onChange={e => setCoreBenefit(e.target.value)} className="w-full border border-white p-2 rounded bg-white/80 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Price Positioning</label>
                                        <select value={pricePositioning} onChange={e => setPricePositioning(e.target.value)} className="w-full border border-white p-2 rounded bg-white/80 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                                            <option value="Economy">Economy (Budget friendly)</option>
                                            <option value="Standard">Standard (Great value)</option>
                                            <option value="Premium">Premium (High tier / Luxury)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right Column: Page Content & Delivery */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center border-b pb-2"><List size={18} className="mr-2 text-blue-500"/> Page Content & Delivery</h3>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Subtitle / Headline</label>
                                    <input type="text" placeholder="Get lifetime access today." value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Description</label>
                                    <textarea placeholder="Describe exactly what they get..." rows="3" value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"></textarea>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Key Features (Bullet Points)</label>
                                    {features.map((feature, i) => (
                                        <div key={i} className="flex mb-2">
                                            <div className="flex-1 flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white px-3 py-2">
                                                <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0" />
                                                <input type="text" placeholder="e.g. 5 Hours of Video Content" value={feature} onChange={(e) => handleFeatureChange(i, e.target.value)} className="w-full outline-none text-sm text-slate-700" />
                                            </div>
                                            {features.length > 1 && (
                                                <button type="button" onClick={() => removeFeature(i)} className="ml-2 text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addFeature} className="text-sm text-blue-600 font-medium hover:underline mt-1">+ Add Feature</button>
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                    <label className="block text-sm font-bold text-blue-800 mb-1 flex items-center"><MessageSquare size={16} className="mr-2"/> Automated Post-Purchase Message</label>
                                    <p className="text-xs text-blue-600/80 mb-2">This is privately sent to the buyer via WhatsApp/Email immediately after successful payment.</p>
                                    <textarea placeholder="Thank you for buying! Here is the link to access your digital files: https://drive..." rows="3" required value={postMessage} onChange={e => setPostMessage(e.target.value)} className="w-full border border-blue-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none shadow-inner"></textarea>
                                </div>
                                
                                <div className="mt-6 border-t pt-6">
                                    <h3 className="text-md font-bold text-slate-800 mb-2 flex items-center">Pre-Offer Assessment Form</h3>
                                    <p className="text-xs text-slate-500 mb-4">Add questions to qualify buyers before they can purchase. Data is passed to the AI for dynamic fulfillment.</p>
                                    
                                    {assessmentTemplate.map((q, i) => (
                                        <div key={i} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col gap-2 relative">
                                            <button type="button" onClick={() => setAssessmentTemplate(assessmentTemplate.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                            <input type="text" placeholder="e.g. What is your biggest challenge right now?" value={q.question} onChange={e => {
                                                const newA = [...assessmentTemplate];
                                                newA[i].question = e.target.value;
                                                setAssessmentTemplate(newA);
                                            }} className="w-full border border-gray-200 p-2 rounded focus:ring-2 outline-none text-sm font-medium" />
                                            <div className="flex items-center gap-2 mt-1">
                                                <select value={q.type} onChange={e => {
                                                    const newA = [...assessmentTemplate];
                                                    newA[i].type = e.target.value;
                                                    setAssessmentTemplate(newA);
                                                }} className="text-sm p-1 border rounded text-gray-600">
                                                    <option value="text">Short Text</option>
                                                    <option value="textarea">Long Text</option>
                                                </select>
                                                <label className="text-sm text-gray-600 flex items-center gap-1 ml-4 cursor-pointer">
                                                    <input type="checkbox" checked={q.required} onChange={e => {
                                                        const newA = [...assessmentTemplate];
                                                        newA[i].required = e.target.checked;
                                                        setAssessmentTemplate(newA);
                                                    }} /> Required
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setAssessmentTemplate([...assessmentTemplate, {question: '', type: 'text', required: true}])} className="text-sm text-indigo-600 font-medium hover:underline inline-flex items-center">+ Add Question</button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-10 flex gap-4 pt-6 border-t border-gray-100">
                            <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-lg shadow-md transition-transform active:scale-95 flex items-center">
                                {isSaving ? 'Saving...' : 'Publish Offer Page'}
                            </button>
                            <button type="button" onClick={() => setIsEditorOpen(false)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold px-8 py-3 rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Commerce & Offers</h1>
                    <p className="text-slate-500 mt-1">Create and manage your sales funnels and digital products.</p>
                </div>
                <button onClick={() => openEditor()} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 font-semibold">
                    <Plus size={20} /> Build New Offer
                </button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {offers.length === 0 ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><DollarSign size={24} /></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Offers Yet</h3>
                        <p className="text-slate-500 max-w-md mx-auto">Create your first offer page to start selling digital products or collecting payments directly.</p>
                    </div>
                ) : (
                    offers.map(offer => (
                        <div key={offer.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                            {offer.content?.image_url && (
                                <div className="h-32 bg-gray-200 overflow-hidden">
                                    <img src={offer.content.image_url} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>
                            )}
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{offer.title}</h3>
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-bold leading-none">Active</span>
                                </div>
                                <p className="text-2xl font-extrabold text-blue-600 mb-4 tracking-tight">
                                    {offer.currency === 'NGN' ? '₦' : '$'}{offer.price}
                                    <span className="text-sm font-medium text-slate-400 ml-1">{offer.currency}</span>
                                </p>
                                
                                <div className="mt-auto pt-4 border-t border-gray-100 flex gap-2">
                                    <button onClick={() => {
                                        const url = `${window.location.origin}/${currentUser.business_id}/${offer.slug}`;
                                        navigator.clipboard.writeText(url);
                                        alert("Link copied!");
                                    }} className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-slate-600 py-2 rounded-lg font-medium transition-colors text-sm border border-gray-200">
                                        <LinkIcon size={14}/> Copy Link
                                    </button>
                                    <button onClick={() => openEditor(offer)} className="flex-1 flex justify-center items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg font-medium transition-colors text-sm">
                                        <Edit size={14}/> Edit Offer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Offers;
