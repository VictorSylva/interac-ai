import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, AlertTriangle, Info, Video, Activity, Clock, 
  ShieldAlert, ShieldCheck, CheckCircle2, MapPin, 
  Volume2, VolumeX, RefreshCw, Bot, Network, Settings, Clipboard 
} from 'lucide-react';

import IntelligenceView from '../components/IntelligenceView';
import AICopilot from '../components/AICopilot';
import TimelineViewer from '../components/TimelineViewer';
import InvestigationsWorkspace from '../components/InvestigationsWorkspace';
import CameraManagerModal from '../components/CameraManagerModal';
import ZoneConfiguratorModal from '../components/ZoneConfiguratorModal';

function StreamViewer({ camera, apiHost }) {
  const [hasError, setHasError] = useState(false);

  // Reset error when camera changes
  useEffect(() => {
    setHasError(false);
  }, [camera.id]);

  if (hasError) {
    return (
      <div className="text-red-500 text-center p-5">
        <h3 className="font-bold text-lg mb-2">STREAM OFFLINE</h3>
        <p className="text-sm text-white/50">Camera services could not be reached, or stream URL is invalid.</p>
      </div>
    );
  }

  return (
    <img 
      src={`${apiHost}/cameras/${camera.id}/stream`} 
      alt={camera.name}
      className="w-full h-full object-contain"
      onError={() => setHasError(true)}
    />
  );
}

export default function SecurityIntelligence() {
  const { currentUser } = useAuth();
  
  // App States
  const [currentTab, setCurrentTab] = useState('monitoring');
  const [cameras, setCameras] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [playerMode, setPlayerMode] = useState('live'); // 'live' | 'playback'
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [triggeringId, setTriggeringId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCameraManagerOpen, setIsCameraManagerOpen] = useState(false);
  const [isZoneConfiguratorOpen, setIsZoneConfiguratorOpen] = useState(false);
  const [configCamera, setConfigCamera] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Single Unified API Host
  const API_HOST = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  // Initialize Audio
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error('Failed to play alert sound', e);
    }
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      const camRes = await fetch(`${API_HOST}/api/v1/cameras/`);
      if (camRes.ok) {
        const camData = await camRes.json();
        setCameras(camData);
        if (camData.length > 0 && !selectedCamera) {
          setSelectedCamera(camData[0]);
        }
      }

      const eventRes = await fetch(`${API_HOST}/api/v1/events/`);
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        // Sort by newest
        setEvents(eventData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch (e) {
      console.error('Error fetching data from API', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.business_id) return;

    fetchData();

    let reconnectTimeout = null;

    const connectWs = () => {
      setWsStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/ws/${currentUser.business_id}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setWsStatus('connected');
        console.log("WebSocket connected");
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      };

      wsRef.current.onclose = () => {
        setWsStatus('disconnected');
        console.log("WebSocket disconnected, reconnecting in 5s...");
        reconnectTimeout = setTimeout(connectWs, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error", error);
        wsRef.current.close();
      };

      wsRef.current.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === 'intelligence_event') {
            const liveEvent = data.data;
            setEvents(prev => [liveEvent, ...prev].slice(0, 100)); // Keep last 100 events
            playBeep();
            // Refetch cameras in case status changed
            fetchData();
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentUser]);

  // Handle manual alert trigger
  const handleTriggerAlert = async (camId) => {
    setTriggeringId(camId);
    try {
      const res = await fetch(`${API_HOST}/cameras/${camId}/trigger`, {
        method: 'POST'
      });
      if (res.ok) {
        console.log(`Alert triggered for camera ${camId}`);
      } else {
        console.error('Failed to trigger alert');
      }
    } catch (e) {
      console.error('Connection error while triggering alert', e);
    } finally {
      setTriggeringId(null);
    }
  };

  // Resolve alert
  const handleResolveAlert = async (eventId) => {
    setResolvingId(eventId);
    try {
      const res = await fetch(`${API_HOST}/api/v1/events/${eventId}/resolve`, {
        method: 'PUT'
      });
      if (res.ok) {
        const updatedEvent = await res.json();
        // Update states
        setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
        if (selectedEvent && selectedEvent.id === eventId) {
          setSelectedEvent(updatedEvent);
        }
      }
    } catch (e) {
      console.error('Failed to resolve event', e);
    } finally {
      setResolvingId(null);
    }
  };

  const getEventIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'intrusion': return <AlertTriangle className="text-red-500" size={16} />;
      case 'zone_intrusion_detected': return <AlertTriangle className="text-red-500" size={16} />;
      case 'person_detected': return <Info className="text-blue-500" size={16} />;
      default: return <Info className="text-gray-500" size={16} />;
    }
  };

  // Stats calculation
  const totalCameras = cameras.length;
  const onlineCameras = cameras.filter(c => c.status === 'online').length;
  const totalAlerts = events.length;
  const unresolvedAlerts = events.filter(e => !e.is_resolved).length;
  const criticalAlerts = events.filter(e => e.severity === 'critical' && !e.is_resolved).length;
  const resolutionRate = totalAlerts > 0 ? Math.round(((totalAlerts - unresolvedAlerts) / totalAlerts) * 100) : 100;

  return (
    <div className="max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="text-indigo-400" size={32} />
            Security Intelligence
          </h1>
          <p className="text-slate-400 mt-1">Platform Control Center v1.0</p>
        </div>

        <div className="flex items-center gap-5 ml-auto">
          {/* Navigation Tabs */}
          <div className="flex gap-1 glass p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setCurrentTab('monitoring')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                currentTab === 'monitoring' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Live Monitoring
            </button>
            <button 
              onClick={() => setCurrentTab('intelligence')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'intelligence' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Network size={16} />
              Intelligence Graph
            </button>
            <button 
              onClick={() => setCurrentTab('copilot')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'copilot' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bot size={16} />
              AI Co-Pilot
            </button>
            <button 
              onClick={() => setCurrentTab('timeline')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'timeline' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={16} />
              Audit Timeline
            </button>
            <button 
              onClick={() => setCurrentTab('investigations')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'investigations' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clipboard size={16} />
              Investigations
            </button>
          </div>

          {/* WS Connection Status */}
          <div className="flex items-center gap-2 text-sm font-mono glass px-4 py-2 rounded-xl border border-white/10">
            <span className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 
              wsStatus === 'connecting' ? 'bg-orange-400' : 'bg-red-500'
            }`} />
            <span className="text-slate-300">
              WS: {wsStatus.toUpperCase()}
            </span>
          </div>

          {/* Sound Toggle */}
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="flex items-center gap-2 glass border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            {soundEnabled ? <Volume2 size={16} className="text-indigo-400" /> : <VolumeX size={16} className="text-slate-500" />}
            {soundEnabled ? 'Mute' : 'Unmute'}
          </button>

          {/* Add Camera Toggle */}
          <button 
            onClick={() => setIsCameraManagerOpen(true)} 
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            <Video size={16} />
            Cameras
          </button>
        </div>
      </div>

      {/* Main Container */}
      {currentTab === 'monitoring' ? (
        <div className="flex flex-col gap-6 animate-fade-in-up">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl shadow-sm border border-white/10 p-5 flex items-center gap-5">
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Video size={28} />
              </div>
              <div>
                <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-1">Cameras</div>
                <div className="text-2xl font-bold text-white">{onlineCameras}/{totalCameras} <span className="text-sm font-normal text-slate-400 ml-1 lowercase">online</span></div>
              </div>
            </div>

            <div className="glass rounded-2xl shadow-sm border border-white/10 p-5 flex items-center gap-5">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert size={28} />
              </div>
              <div>
                <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-1">Active Threats</div>
                <div className="text-2xl font-bold text-white">{unresolvedAlerts} <span className="text-sm font-bold text-rose-400 ml-1">({criticalAlerts} critical)</span></div>
              </div>
            </div>

            <div className="glass rounded-2xl shadow-sm border border-white/10 p-5 flex items-center gap-5">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck size={28} />
              </div>
              <div>
                <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-1">Resolution Rate</div>
                <div className="text-2xl font-bold text-white">{resolutionRate}% <span className="text-sm font-normal text-slate-400 ml-1 lowercase">cleared</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side: Media Player & Cameras (Takes up 2 columns) */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Media Player Card */}
              <div className={`glass rounded-2xl shadow-sm border overflow-hidden flex flex-col ${criticalAlerts > 0 ? 'border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.2)]' : 'border-white/10'}`}>
                {/* Header Toolbar */}
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20">
                  <div className="flex items-center gap-3">
                    <Activity size={20} className={playerMode === 'live' ? 'text-emerald-400' : 'text-orange-400'} />
                    <span className="font-bold text-white tracking-wide">
                      {playerMode === 'live' 
                        ? `LIVE: ${selectedCamera ? selectedCamera.name : 'No Camera Selected'}`
                        : `PLAYBACK: Event ID #${selectedEvent?.id} (${selectedEvent?.event_type})`
                      }
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPlayerMode('live')} 
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${playerMode === 'live' ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'glass border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'}`}
                    >
                      Live Feed
                    </button>
                    <button 
                      disabled={!selectedEvent}
                      onClick={() => setPlayerMode('playback')} 
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${!selectedEvent ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5' : playerMode === 'playback' ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'glass border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'}`}
                    >
                      Playback Clip
                    </button>
                  </div>
                </div>

                {/* Main Video Stream Container */}
                <div className="w-full bg-black aspect-video flex justify-center items-center relative overflow-hidden">
                  {loading ? (
                    <div className="text-white/60 flex flex-col items-center gap-3">
                      <RefreshCw className="animate-spin" size={32} />
                      <span>Loading feed configurations...</span>
                    </div>
                  ) : playerMode === 'live' && selectedCamera ? (
                    <StreamViewer camera={selectedCamera} apiHost={API_HOST} />
                  ) : playerMode === 'playback' && selectedEvent && selectedEvent.video_clip_path ? (
                    <video 
                      src={`${API_HOST}/static${selectedEvent.video_clip_path.replace('/var/lib/surveillance', '')}`}
                      controls 
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-white/40 text-center p-8">
                      <Video size={56} className="mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold text-white/80 mb-2">No Feed Active</h3>
                      <p className="text-sm">Select a camera to view live stream, or click a recorded event.</p>
                    </div>
                  )}

                  {/* HUD Status Marker */}
                  {playerMode === 'live' && selectedCamera && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded text-white text-xs font-mono border border-white/10">
                      <span className={`w-2 h-2 rounded-full ${selectedCamera.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {selectedCamera.status.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Details panel if playing back an event */}
                {playerMode === 'playback' && selectedEvent && (
                  <div className="p-5 border-t border-white/10 bg-black/40 backdrop-blur-md grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Timestamp</div>
                      <div className="text-sm font-bold text-white">{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Alert Type</div>
                      <div className="text-sm font-bold text-rose-400 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${selectedEvent.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                          {selectedEvent.severity}
                        </span>
                        {selectedEvent.event_type.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {!selectedEvent.is_resolved ? (
                        <button 
                          onClick={() => handleResolveAlert(selectedEvent.id)} 
                          disabled={resolvingId === selectedEvent.id}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          {resolvingId === selectedEvent.id ? 'Resolving...' : 'Resolve Alert'}
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                          <CheckCircle2 size={18} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Grid Control Card */}
              <div className="glass rounded-2xl shadow-sm border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-5 uppercase tracking-wide">Cameras Network Registry</h3>
                {cameras.length === 0 ? (
                  <div className="text-slate-400 text-center py-6 bg-black/20 rounded-xl border border-dashed border-white/10">No cameras registered in system.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cameras.map(cam => (
                      <div 
                        key={cam.id} 
                        onClick={() => { setSelectedCamera(cam); setPlayerMode('live'); }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          selectedCamera?.id === cam.id 
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' 
                            : 'border-white/10 glass-card hover:border-indigo-400/50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${cam.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-500'}`} />
                            <span className="font-bold text-slate-200">{cam.name}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono bg-black/40 px-2 py-1 rounded-md border border-white/5">ID: {cam.id}</span>
                        </div>

                        <div className="flex flex-col gap-1.5 text-sm text-slate-400 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-slate-500" />
                            <span>{cam.location || 'Not Specified'}</span>
                          </div>
                          <div className="font-mono text-xs truncate bg-black/40 p-1.5 rounded-md border border-white/5" title={cam.rtsp_url}>
                            {cam.rtsp_url}
                          </div>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfigCamera(cam);
                            setIsZoneConfiguratorOpen(true);
                          }}
                          className="flex items-center justify-center py-2 px-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold transition-all"
                          title="Configure Intrusion Zones"
                        >
                          <Settings size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerAlert(cam.id);
                          }}
                          disabled={triggeringId === cam.id || cam.status !== 'online'}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ShieldAlert size={14} />
                          {triggeringId === cam.id ? 'Simulating...' : 'Simulate'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Incident Feed (Takes up 1 column) */}
            <div className="lg:col-span-1 glass rounded-2xl shadow-sm border border-white/10 overflow-hidden h-[800px] flex flex-col">
              <div className="p-5 border-b border-white/10 bg-black/40 text-white flex justify-between items-center backdrop-blur-md">
                <h3 className="font-bold text-lg m-0 tracking-widest text-indigo-100">INCIDENT FEED</h3>
                <span className="text-xs font-mono bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-md font-bold border border-rose-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> REAL-TIME MONITOR
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/10">
                {events.length === 0 ? (
                  <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-3">
                    <Clock size={40} className="opacity-30" />
                    <p>No security alerts registered yet.</p>
                  </div>
                ) : (
                  events.map((evt) => (
                    <div 
                      key={evt.id}
                      onClick={() => {
                        setSelectedEvent(evt);
                        setPlayerMode('playback');
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedEvent?.id === evt.id 
                          ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                          : 'glass-card border-white/10 hover:border-indigo-400/50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                          evt.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        }`}>
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        {evt.snapshot_path ? (
                          <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-black flex items-center justify-center">
                            <img 
                              src={`${API_HOST}/static${evt.snapshot_path.replace('/var/lib/surveillance', '')}`} 
                              alt="thumbnail" 
                              className="w-full h-full object-cover"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0">
                            <Info size={16} className="text-white/30" />
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-200 truncate">
                            Camera ID: {evt.camera_id}
                          </span>
                          {evt.ai_metadata && evt.ai_metadata.detections_count > 0 && (
                            <span className="text-xs text-slate-400 truncate">
                              Detections: {evt.ai_metadata.detections_count} (
                              {evt.ai_metadata.intruders?.map((i) => i.class).join(', ')}
                              )
                            </span>
                          )}
                        </div>

                        <div className="flex-shrink-0 ml-2">
                          {evt.is_resolved ? (
                            <CheckCircle2 size={20} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          ) : (
                            <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ${evt.severity === 'critical' ? 'bg-rose-500 text-rose-500' : 'bg-orange-500 text-orange-500'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : currentTab === 'intelligence' ? (
        <IntelligenceView />
      ) : currentTab === 'copilot' ? (
        <AICopilot />
      ) : currentTab === 'timeline' ? (
        <TimelineViewer />
      ) : (
        <InvestigationsWorkspace />
      )}

      {/* Modals */}
      <CameraManagerModal 
        isOpen={isCameraManagerOpen} 
        onClose={() => setIsCameraManagerOpen(false)} 
        cameras={cameras}
        onCamerasUpdated={fetchData}
      />
      
      <ZoneConfiguratorModal 
        isOpen={isZoneConfiguratorOpen}
        onClose={() => setIsZoneConfiguratorOpen(false)}
        camera={configCamera}
        onZonesUpdated={fetchData}
      />
    </div>
  );
}
