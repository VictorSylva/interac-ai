# Render Deployment Setup Guide

This guide explains how to deploy the InteracAI platform from a clean repository to a new Render account.

## Prerequisites
1. A Render.com account.
2. The GitHub repository linked to your Render account.
3. All production API keys ready (Paystack Live, WhatsApp, OpenRouter, Firebase).

## Step 1: Create the Database & Cache

1. **Create PostgreSQL**:
   - Go to Render Dashboard -> New -> PostgreSQL.
   - Name: `interact-db-prod`.
   - Select the desired region and tier.
   - *Save the Internal Database URL.*

2. **Create Redis**:
   - Go to Render Dashboard -> New -> Redis.
   - Name: `interact-redis-prod`.
   - Select the desired region and tier.
   - *Save the Internal Redis URL.*

## Step 2: Deploy the Core Backend (Web Service)

1. **Create Web Service**:
   - Dashboard -> New -> Web Service.
   - Connect the InteracAI GitHub repository.
   - **Name**: `interacai-api`.
   - **Environment**: Docker.
   - **Root Directory**: `backend`.
   - **Branch**: `main` (or `production`).
   
2. **Set Environment Variables**:
   - Add all variables listed in `production/environment-reference.md`.
   - Specifically bind `DATABASE_URL` and `REDIS_URL` to the internal URLs from Step 1.
   
3. **Deploy**:
   - Click "Create Web Service". Render will build the Docker container and start FastAPI.

## Step 3: Deploy Background Workers (Celery)

1. **Create Background Worker**:
   - Dashboard -> New -> Background Worker.
   - Connect the same repository.
   - **Name**: `interacai-worker`.
   - **Environment**: Docker.
   - **Root Directory**: `backend`.
   - **Start Command**: `celery -A celery_app worker --loglevel=info`.

2. **Set Environment Variables**:
   - Copy the exact same environment variables from the Web Service, ensuring `DATABASE_URL` and `REDIS_URL` match.

## Step 4: Deploy the Frontend

*(If hosting Frontend on Render as a Static Site)*

1. **Create Static Site**:
   - Dashboard -> New -> Static Site.
   - Connect the repository.
   - **Root Directory**: `frontend`.
   - **Build Command**: `npm install && npm run build`.
   - **Publish Directory**: `frontend/build`.

2. **Set Environment Variables**:
   - Add `REACT_APP_API_URL` pointing to the public URL of the Web Service created in Step 2.
   - Add all Firebase `REACT_APP_` variables.

3. **Rewrite Rules for React Router**:
   - Go to the "Redirects/Rewrites" tab of the Static Site.
   - Add a rule: Source `/*`, Destination `/index.html`, Action `Rewrite`.

## Step 5: (Optional) Deploy Argus OS

If deploying the physical camera surveillance component:
1. Create a **Private Service** (or Web Service if API needs public access) for `argus-os`. Root directory: `argus-os`.
2. Add a **Persistent Disk** mounted to `/var/lib/surveillance` to store video clips permanently.
