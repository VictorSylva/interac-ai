# InteracAI System Architecture

This document describes the high-level system architecture of the InteracAI platform, specifically geared towards a production deployment on Render.

## 1. High-Level Overview

InteracAI is composed of three main layers:
1. **Frontend**: A React-based web application.
2. **Backend Services**: A FastAPI core application with a Celery worker for background jobs.
3. **Argus OS**: Specialized AI camera/surveillance services (Argus OS Core and Perception module).

## 2. Component Details

### 2.1. Frontend (React)
- **Framework**: React (Create React App/Webpack) with TailwindCSS.
- **Hosting Strategy**: Can be hosted as a Static Site on Render, Firebase Hosting, or Vercel.
- **Authentication**: Firebase Authentication.
- **Features**: Dashboard, Organization Management, Billing interface, Workflow builder (React Flow).

### 2.2. Core Backend (FastAPI)
- **Framework**: FastAPI (Python).
- **Hosting Strategy**: Render Web Service (Docker runtime).
- **Database**: PostgreSQL (Render PostgreSQL).
- **Cache & Message Broker**: Redis (Render Redis).
- **Responsibilities**: 
  - Central API gateway for the dashboard.
  - Business automation and intelligence platform.
  - Paystack webhook handling.
  - WhatsApp webhook handling and messaging.

### 2.3. Background Workers (Celery)
- **Framework**: Celery.
- **Hosting Strategy**: Render Background Worker (shares the backend codebase).
- **Responsibilities**: 
  - Processing long-running AI workflows.
  - Handling heavy database migrations/seed tasks asynchronously.

### 2.4. Argus OS & Perception (Camera Services)
- **Framework**: FastAPI / Computer Vision libraries.
- **Responsibilities**: 
  - Ingesting video/image data from physical locations.
  - Running perception models (object detection, facial recognition).
  - Saving event clips and sending alerts to the core backend.
- **Storage**: Requires a persistent disk (Render Persistent Disk) to share clips between the perception module and the OS API.

## 3. External Integrations

| Provider | Purpose |
|---|---|
| **Paystack** | Subscription billing, payment links, and card processing. |
| **Meta / WhatsApp Cloud API** | Customer communication, business messaging templates. |
| **OpenRouter / Gemini** | AI Language Models for workflow processing. |
| **Firebase** | Authentication, client-side NoSQL (if used for real-time), and push messaging. |
| **SMTP** | Transactional emails (onboarding, password resets). |

## 4. Production Network Flow

1. **Client -> Frontend**: User loads the React application via CDN.
2. **Client -> Backend**: Authenticated REST requests sent to `api.interacai.com` (Render Web Service).
3. **Backend -> Database**: Synchronous and asynchronous queries to PostgreSQL.
4. **Backend -> Redis**: Task queueing for Celery.
5. **Worker -> External APIs**: Celery workers interact with OpenRouter and WhatsApp APIs.
6. **Webhooks -> Backend**: Paystack and Meta servers send POST requests directly to specific backend endpoints for verification and state updates.
