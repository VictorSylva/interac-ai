const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// For Staging builds, we default to the staging backend unless overridden by environment variables
export const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (isLocal ? "http://localhost:8000" : "https://interacai-backend-staging.onrender.com");

if (process.env.NODE_ENV !== 'production' || window.location.hostname.includes('firebaseapp')) {
    console.log(`[Staging Config] API: ${API_BASE_URL} | Mode: ${isLocal ? 'Dev' : 'Staging/Test'}`);
}
