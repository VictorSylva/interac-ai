import React, { useState } from 'react';
import { Camera, MapPin, Link2, X, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function CameraManagerModal({ isOpen, onClose, cameras, onCamerasUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    rtsp_url: ''
  });

  const API_HOST = API_BASE_URL;


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.rtsp_url) {
      setError("Name and Stream URL are required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_HOST}/api/v1/cameras/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          location: formData.location || null,
          rtsp_url: formData.rtsp_url,
          ptz_supported: false
        })
      });

      if (!res.ok) {
        throw new Error("Failed to add camera.");
      }

      setFormData({ name: '', location: '', rtsp_url: '' });
      onCamerasUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async (id) => {
    if (!window.confirm("Are you sure you want to delete this camera?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api/v1/cameras/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete camera.");
      onCamerasUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-card w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="text-indigo-400" />
            Camera Management
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-sm">
               <AlertTriangle size={18} />
               {error}
            </div>
          )}

          {/* Active Cameras List */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Registered Cameras</h3>
            {cameras.length === 0 ? (
              <div className="text-center p-6 bg-black/20 rounded-xl border border-dashed border-white/10 text-slate-500">
                No cameras currently registered.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameras.map(cam => (
                  <div key={cam.id} className="glass border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-slate-200">{cam.name}</div>
                      <button 
                        onClick={() => handleDeleteCamera(cam.id)}
                        disabled={loading}
                        className="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete Camera"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center gap-2"><MapPin size={12} className="text-slate-500" /> {cam.location || "N/A"}</div>
                      <div className="flex items-center gap-2 truncate"><Link2 size={12} className="text-slate-500" /> {cam.rtsp_url}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-white/10" />

          {/* Add New Camera Form */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Add New Camera</h3>
            <form onSubmit={handleAddCamera} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Camera Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Front Door IP Cam"
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Location</label>
                  <input 
                    type="text" 
                    name="location" 
                    value={formData.location} 
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Main Entrance"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 ml-1">Stream URL (RTSP or HTTP IP Webcam)</label>
                <input 
                  type="text" 
                  name="rtsp_url" 
                  value={formData.rtsp_url} 
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  placeholder="e.g. http://192.168.1.100:8080/video"
                  required 
                />
                <p className="text-[10px] text-slate-500 ml-1 mt-1">Accepts RTSP streams or HTTP MJPEG streams from mobile IP Webcam apps.</p>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add Camera
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
