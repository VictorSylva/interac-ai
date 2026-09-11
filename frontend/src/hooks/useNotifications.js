import { useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';

export const useNotifications = (businessId, userId, onMessage) => {
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize Audio for Sound Alerts
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Lightweight notification sound
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play blocked (user must click page first):', e));
    }
  }, []);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // 1. WebSocket Logic
  useEffect(() => {
    if (!businessId) return;

    // Derive correct WebSocket protocol and host from API_BASE_URL
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss:' : 'ws:';
    const backendHost = API_BASE_URL.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${backendHost}/ws/${encodeURIComponent(businessId)}`;
    
    const connect = () => {
      console.log('[InteracAI Notification] Connecting to WebSocket...', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[InteracAI Notification] WS Message:', data);
          
          // 1. Play sound for incoming customer messages
          if (data.type === 'NEW_MESSAGE' && (data.sender === 'customer' || data.sender === 'user')) {
            // Check if human assistance is needed or active
            const isHumanNeeded = data.mode === 'human' || data.status === 'waiting';
            if (isHumanNeeded) {
              playSound();
            }
          }

          // 2. Play sound for Handovers (Waiting for Agent)
          if (data.type === 'CONVERSATION_UPDATED' && data.status === 'waiting') {
             playSound();
          }
          
          if (onMessageRef.current) onMessageRef.current(data);
        } catch (err) {
          console.error('[InteracAI Notification] WS parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[InteracAI Notification] WS Closed. Reconnecting in 5s...');
        setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.warn('[InteracAI Notification] WS connection error:', err);
      };

      socketRef.current = ws;
    };

    connect();

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [businessId, playSound]);

  // 2. Push Notification Logic
  const registerPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported in this browser');
      return;
    }

    try {
      const configRes = await fetch(`${API_BASE_URL}/api/notifications/config`);
      const configData = await configRes.json();
      const vapidKey = configData.vapid_public_key;

      if (!vapidKey) {
        console.warn('VAPID Public Key not configured in backend');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker Registered for Push');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      // Send to backend
      await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          subscription: subscription
        })
      });

      console.log('Push subscription successfully registered');
    } catch (err) {
      console.error('Push registration failed:', err);
    }
  }, [userId]);

  return { registerPush, playSound };
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
