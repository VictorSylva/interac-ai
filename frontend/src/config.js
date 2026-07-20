const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const rawApiUrl = process.env.REACT_APP_API_URL || 
  (isLocal ? "http://localhost:8000" : "https://interacai-backend-staging-9q3u.onrender.com");

// Ensure clean URL with no trailing slashes
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

if (process.env.NODE_ENV !== 'production' || window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp')) {
    console.log(`[InteracAI Config] API: ${API_BASE_URL} | Mode: ${isLocal ? 'Dev' : 'Staging/Production'}`);
}
