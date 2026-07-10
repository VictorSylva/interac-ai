import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "mock_key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "mock_project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "mock_app_id"
};

// Initialize Firebase
let app;
let auth;
let db;

try {
  // Only initialize if we have a real key or just let it init with mock and fail gracefully later
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase initialization failed (expected during mock/dev without keys):", error);
  // Mock objects to prevent crash on import and allow "Demo Mode"
  auth = { 
      currentUser: null,
      onAuthStateChanged: (callback) => {
          // Verify if we have a "fake" session stored
          const demoUser = localStorage.getItem('demo_user_email');
          if (demoUser) {
              callback({ email: demoUser, uid: 'demo_uid_123', getIdToken: () => Promise.resolve('mock_token') });
          } else {
              callback(null);
          }
          return () => {}; // Unsubscribe function
      },
      signInWithEmailAndPassword: (email, password) => {
          localStorage.setItem('demo_user_email', email);
          window.location.reload(); // Simple reload to trigger onAuthStateChanged
          return Promise.resolve({ user: { email, uid: 'demo_uid_123' } });
      },
      createUserWithEmailAndPassword: (email, password) => {
          localStorage.setItem('demo_user_email', email);
          window.location.reload();
          return Promise.resolve({ user: { email, uid: 'demo_uid_123' } });
      },
      signOut: () => {
          localStorage.removeItem('demo_user_email');
          window.location.reload();
          return Promise.resolve();
      }
  }; 
  
  // Mock DB with empty collections structure if needed, but primarily auth is the blocker
  db = {
      collection: () => ({
          doc: () => ({
              get: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
              set: () => Promise.resolve(),
              collection: () => ({ add: () => Promise.resolve(), onSnapshot: () => () => {} })
          })
      })
  }; 
}

export { auth, db };
