# How to Set Up WhatsApp Business API

To connect InterractAI to WhatsApp, you need a Meta (Facebook) Developer account.

## Step 1: Create App

1. Go to [Meta Developers](https://developers.facebook.com/).
2. Click **My Apps** -> **Create App**.
3. Select **Other** -> **Next**.
4. Select **Business** -> **Next**.
5. Give it a name (e.g., "InterractAI") and create it.

## Step 2: Add WhatsApp Product

1. On the app dashboard, find **WhatsApp** and click **Set up**.
2. Detailed setup page will open.

## Step 3: Get Credentials

On the **API Setup** page (under WhatsApp -> API Setup):

### 1. Phone Number ID

- Copy the **Phone number ID** displayed (e.g., `123456789...`).
- **Env Var**: `WHATSAPP_PHONE_NUMBER_ID`

### 2. Access Token (API Token)

- For testing: Copy the **Temporary access token**. (Lasts 24h).
- For production: You need to create a "System User" in Business Settings to get a permanent token.
- **Env Var**: `WHATSAPP_API_TOKEN`

### 3. Verify Token

- This is a secret password YOU create. It can be anything.
- Example: `interact_secret_token`
- **Env Var**: `WHATSAPP_VERIFY_TOKEN`

## Step 4: Configure Webhook (Requires Live URL)

_You need to deploy to Render first to get your URL!_

1. Go to **WhatsApp** -> **Configuration**.
2. Click **Edit** under Webhook.
3. **Callback URL**: `https://<YOUR-RENDER-APP-URL>/whatsapp/webhook`
4. **Verify Token**: `interact_secret_token` (must match Env Var).
5. Click **Verify and Save**.
6. Under "Webhook fields", click **Manage** and subscribe to: `messages`.

---

**Recommendation**: Deploy to Render NOW with just the OpenAI Key. Once the app is live, you can finish Step 4.
