# MatchMaker AI

Dating profile optimizer. Free preview audit, $4.99 unlock for the full breakdown.

## Stack
- **Frontend:** React + Vite + Tailwind → Vercel
- **Backend:** Node + Express → Railway
- **DB:** MongoDB Atlas
- **AI:** Anthropic API (Claude)
- **Payments:** Stripe Checkout

## Project structure
```
matchmaker-ai/
  backend/      Express API (analyze, payments, mongo models)
  frontend/     React app (form + results/paywall page)
```

## How it flows
1. User fills out the form on `/` → `POST /api/analyze`.
2. Backend calls Claude once, stores the **full** result in Mongo, but only returns the
   free-preview slice (score, strengths, first red flag) to the client.
3. User lands on `/results/:analysisId` with that preview.
4. "Unlock" → `POST /api/payments/create-checkout-session` → redirected to Stripe Checkout.
5. Stripe webhook (`/api/payments/webhook`) marks the record `paid: true` server-side —
   never trust the client for this.
6. Stripe redirects back to `/results/:analysisId?paid=1` → frontend calls
   `GET /api/payments/unlock/:analysisId`, which only returns full data if `paid` is true.

This means the full audit is never sent to the browser until payment is verified
server-side — the only thing client-side payment confirmation does is trigger a refetch.

## Local setup

### 1. Backend
```bash
cd backend
cp .env.example .env   # fill in MongoDB URI, Anthropic key, Stripe keys
npm install
npm run dev             # runs on :4000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev              # runs on :5173, proxies /api to :4000
```

### 3. Stripe webhook (local testing)
```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```
Copy the `whsec_...` it prints into `backend/.env` as `STRIPE_WEBHOOK_SECRET`.

You'll also need a one-time **Price** object in the Stripe dashboard ($4.99, one-time) —
copy its ID into `STRIPE_PRICE_ID`.

## Deploy

**Backend → Railway**
- New project → deploy from this repo, root directory `backend/`
- Add all vars from `.env.example` in Railway's environment settings
- Add the Stripe webhook endpoint in the Stripe dashboard pointing at
  `https://<your-railway-domain>/api/payments/webhook`, copy the signing secret back into Railway

**Frontend → Vercel**
- New project → root directory `frontend/`
- Set `vite.config.js` proxy only applies locally — in production, point the frontend's
  fetch calls at your Railway backend URL (easiest: add a `VITE_API_URL` env var and swap
  `/api/...` for `${import.meta.env.VITE_API_URL}/api/...}` in `App.jsx` and `ResultsPage.jsx`,
  or add a Vercel rewrite to proxy `/api/*` to the Railway domain)

## Not built yet (from the roadmap)
- Photo analyzer / opening-message generator upsells
- Email capture + newsletter
- Analytics (GA + Stripe revenue tracking)
- Pricing A/B test scaffolding
