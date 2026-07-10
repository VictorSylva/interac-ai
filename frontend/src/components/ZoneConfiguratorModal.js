import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

export default function ZoneConfiguratorModal({ isOpen, onClose, camera, onZonesUpdated }) {
  const [points, setPoints] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  const API_HOST = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  // Load existing zone polygons if they exist
  useEffect(() => {
    if (isOpen && camera) {
      if (camera.zone_polygons && camera.zone_polygons.length > 0) {
        setPoints(camera.zone_polygons);
      } else {
        setPoints([]);
      }
      setError(null);
    }
  }, [isOpen, camera]);

  const handleCanvasClick = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalize coordinates
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    setPoints([...points, [normalizedX, normalizedY]]);
  };

  const handleClear = () => setPoints([]);

  const handleSave = async () => {
    if (points.length > 0 && points.length < 3) {
      setError("A zone must have at least 3 points to form a valid area.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_HOST}/api/v1/cameras/${camera.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send points or null if cleared
          zone_polygons: points.length >= 3 ? points : null
        })
      });

      if (!res.ok) throw new Error("Failed to save zone configuration.");
      
      onZonesUpdated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !camera) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-card w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="text-indigo-400" />
              Zone Configuration: {camera.name}
            </h2>
            <p className="text-sm text-slate-400 mt-1">Click on the video feed to draw the boundaries of the restricted zone.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-black flex-1 relative flex flex-col items-center justify-center">
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-rose-500/90 text-white font-bold text-sm shadow-xl flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Video / Canvas Container */}
          <div 
            ref={containerRef}
            onClick={handleCanvasClick}
            className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10 cursor-crosshair shadow-[0_0_30px_rgba(0,0,0,0.5)]"
          >
            {/* Live Video Feed Background */}
            <img 
              src={`${API_HOST}/cameras/${camera.id}/stream`} 
              alt="Live Configuration Feed"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />

            {/* SVG Overlay for drawing polygon */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {points.length > 0 && (
                <polygon
                  points={points.map(p => `${p[0] * 100}% ${p[1] * 100}%`).join(', ')}
                  fill="rgba(244, 63, 94, 0.2)"
                  stroke="rgba(244, 63, 94, 0.8)"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}
              {points.map((p, i) => (
                <circle 
                  key={i}
                  cx={`${p[0] * 100}%`} 
                  cy={`${p[1] * 100}%`} 
                  r="4" 
                  fill="#f43f5e" 
                  stroke="white"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex justify-between items-center">
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors font-semibold text-sm border border-white/5"
          >
            <RotateCcw size={16} /> Clear Zone
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-slate-300 hover:text-white transition-colors font-semibold text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Zone Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
