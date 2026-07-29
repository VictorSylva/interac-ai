import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ChatWidget from './components/ChatWidget';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import reportWebVitals from './reportWebVitals';

// --- GLOBAL FETCH JWT INTERCEPTOR ---
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlStr = url.toString();
  const isBackendRequest = urlStr.includes('/api/') || urlStr.includes('/ws/');
  
  if (isBackendRequest) {
    const storedUserStr = localStorage.getItem('interact_user');
    if (storedUserStr) {
      try {
        const user = JSON.parse(storedUserStr);
        if (user && user.token) {
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${user.token}`
          };
        }
      } catch (e) {
        console.error("[Fetch Interceptor] Error parsing token:", e);
      }
    }
  }
  return originalFetch(url, options);
};

// 1. Check for Platform Root (Main App)
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 2. Check for Widget Root (Created by loader script for external embedding)
const mountWidget = () => {
  const widgetRootEl = document.getElementById('interact-widget-root');
  if (widgetRootEl) {
    // Only mount on the landing page (root path)
    if (window.location.pathname !== '/' && !window.location.pathname.includes('/demo/')) {
        console.log('[InterractAI] Not on landing page or demo, skipping widget mount.');
        return true; 
    }

    console.log('[InterractAI] Found widget root, rendering ChatWidget...');

    const config = window.InterractAI?.config || {};
    const root = ReactDOM.createRoot(widgetRootEl);
    root.render(
      <React.StrictMode>
        <AuthProvider> 
          <ChatWidget {...config} embedded={true} />
        </AuthProvider>
      </React.StrictMode>
    );
    return true;
  }
  return false;
};

// Try to mount immediately
if (!mountWidget()) {
  // If not found, it might be because the loader script is still running
  // We'll check again in a few ms
  console.log('[InterractAI] Widget root not found yet, waiting...');
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (mountWidget() || attempts > 20) {
      clearInterval(interval);
      if (attempts > 20) console.warn('[InterractAI] Widget root not found after 2 seconds.');
    }
  }, 100);
}


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
