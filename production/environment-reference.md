# Environment Variable Reference

This document provides a complete inventory of every environment variable required by the InteracAI platform. Ensure these are securely configured in your production environment (e.g., Render Dashboard, Vercel/Netlify for Frontend).

## 1. Backend Service (`backend/.env`)

| Variable | Purpose | Required? | Dev Value | Prod Value | Secret? | Source |
|---|---|---|---|---|---|---|
| `ENV` | Application mode | Yes | `development` | `production` | No | System |
| `DEBUG` | Enable debug logs/tracebacks | No | `True` | `False` | No | System |
| `PORT` | API Port | Yes | `8000` | Render handles | No | System |
| `HOST` | Bind address | Yes | `0.0.0.0` | `0.0.0.0` | No | System |
| `SECRET_KEY` | JWT and session encryption | Yes | (dummy) | Generated secure hex | **Yes** | Internal |
| `DATABASE_URL` | Postgres Connection String | Yes | `postgresql+asyncpg://...` | Render DB URL | **Yes** | Render Postgres |
| `REDIS_URL` | Redis Connection String | Yes | `redis://localhost...` | Render Redis URL | **Yes** | Render Redis |
| `FRONTEND_URL` | Allowed origin for CORS/redirects | Yes | `http://localhost:3000` | e.g. `https://app.interacai.com` | No | Internal |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | No | `http://localhost:3000` | Prod domain | No | Internal |
| `OPENROUTER_API_KEY` | AI LLM routing API key | Yes | (dummy) | Real API Key | **Yes** | OpenRouter |
| `OPENROUTER_MODEL` | Default LLM model | Yes | `deepseek/deepseek-chat` | `deepseek/deepseek-chat` | No | Internal |
| `OPENROUTER_REFERER`| API tracking domain | No | `https://interacai.com` | `https://interacai.com` | No | Internal |
| `OPENROUTER_TITLE` | API tracking title | No | `"Interact AI"` | `"Interact AI"` | No | Internal |
| `COST_PER_TOKEN` | Billing logic fallback cost | Yes | `0.000002` | `0.000002` | No | Internal |
| `GEMINI_API_KEY` | Fallback AI provider | No | (dummy) | Real API Key | **Yes** | Google Cloud |
| `GEMINI_MODEL` | Fallback AI model | No | `gemini-1.5-pro` | `gemini-1.5-pro` | No | Internal |
| `WHATSAPP_VERIFY_TOKEN`| Meta webhook validation | Yes | (dummy) | Custom random string | **Yes** | Internal |
| `WHATSAPP_API_TOKEN` | Meta API Bearer Token | Yes | (dummy) | Permanent Page Token | **Yes** | Meta Developer |
| `WHATSAPP_PHONE_NUMBER_ID`| Target phone number ID | Yes | (dummy) | Prod Phone ID | No | Meta Developer |
| `PAYSTACK_SECRET_KEY` | Payment processing secret | Yes | `sk_test_...` | `sk_live_...` | **Yes** | Paystack |
| `PAYSTACK_PUBLIC_KEY` | Payment processing public | Yes | `pk_test_...` | `pk_live_...` | No | Paystack |
| `VAPID_PUBLIC_KEY` | Web push notification pub | Yes | (dummy) | Base64 string | No | Internal Generator|
| `VAPID_PRIVATE_KEY` | Web push notification priv | Yes | (dummy) | Base64 string | **Yes** | Internal Generator|
| `VAPID_EMAIL` | Web push contact | Yes | `mailto:admin@...` | `mailto:admin@...` | No | Internal |

## 2. Frontend Service (`frontend/.env`)

These variables are baked into the frontend build. **Do not put secrets here** except public API keys.

| Variable | Purpose | Required? | Dev Value | Prod Value | Secret? | Source |
|---|---|---|---|---|---|---|
| `REACT_APP_API_URL` | Backend API Endpoint | Yes | `http://localhost:8000` | e.g. `https://api.interacai.com` | No | Render Backend |
| `REACT_APP_FIREBASE_API_KEY` | Firebase Web SDK Key | Yes | (dummy) | Prod Firebase Key | No | Firebase Console |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes | (dummy) | `project.firebaseapp.com` | No | Firebase Console |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes | (dummy) | Prod Project ID | No | Firebase Console |
| `REACT_APP_FIREBASE_STORAGE_BUCKET`| Firebase Storage | Yes | (dummy) | `project.appspot.com` | No | Firebase Console |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`| Firebase Messaging | Yes | (dummy) | Prod Sender ID | No | Firebase Console |
| `REACT_APP_FIREBASE_APP_ID` | Firebase Web App ID | Yes | (dummy) | Prod App ID | No | Firebase Console |

## 3. Argus OS & Perception Services (`argus-os/.env` & `argus-os/perception/.env`)

Required for the physical AI camera and surveillance features.

| Variable | Purpose | Required? | Dev Value | Prod Value | Secret? | Source |
|---|---|---|---|---|---|---|
| `SECRET_KEY` | Internal auth encryption | Yes | (dummy) | Generated secure hex | **Yes** | Internal |
| `POSTGRES_SERVER` | DB Host | Yes | `postgres` | Internal DB URL | No | Render Postgres |
| `REDIS_HOST` | Cache Host | Yes | `redis` | Internal Cache URL | No | Render Redis |
| `FIRST_SUPERUSER_EMAIL`| Seed admin account | Yes | `admin@...` | Valid email | No | Internal |
| `FIRST_SUPERUSER_PASSWORD`| Seed admin password | Yes | `password` | Strong password | **Yes** | Internal |
| `BACKEND_API_URL` | OS API location | Yes | `http://argus_os:8001` | Internal URL | No | Internal |
| `STORAGE_DIR` | Shared volume for clips | Yes | `/var/lib/...` | Mounted disk path | No | Render Disk |
