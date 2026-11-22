# GhostPilot — Open-Source 5-in-1 X (Twitter) Creator & Digital Product Autopilot

**100% Free ($0/month) · Open Source · Built to Run Inside Antigravity IDE with Gemini 3.8 Flash**

GhostPilot combines five high-ticket creator tools into one simple, self-hosted app so anyone — even with zero coding experience — can research any niche, generate viral-scored copy, export PDF lead magnets and visual carousels, and schedule automated X (Twitter) posts that sell Whop courses, affiliate offers, or digital products.

---

## The 5 Engines Combined Inside GhostPilot

1. **Authority Research (`Stanford STORM` + `GummySearch` style — $0 Live Scraper)**
   - Scans public Reddit pain points, Google News RSS, GitHub Trending repos, Hacker News, and custom RSS feeds with zero paid API keys.
   - Compiles a **5-Angle Authority Dossier** (Buyer Pain Points, Core Frameworks, Contrarian Truths, Scripts & Proof, Offer Bridges).
2. **Predictive Copywriting Brain (`Anyword` + `Typeshare` style)**
   - Live **0–100 Predictive Performance Score** across 4 transparent pillars: Hook Stopping Power, Persuasion Psychology, Scroll Readability, and Conversion/Persona Fit.
   - Automatic AI-cliché detector + **12 proven persuasion frameworks** + **5-Variation A/B Copy Arena** that ranks the top winner automatically.
3. **Visual Carousel Studio (`PostNitro` style)**
   - 4:5 portrait slide builder with 4 studio themes, 6 layouts, and real 1-click **1080×1350 PNG** slide downloads.
4. **High-Ticket Lead Magnet PDF & Smart Page Studio (`Gamma` + `Beacon` style)**
   - Builds multi-page authority Playbooks, Swipe Files, and Checklists with embedded Whop/affiliate offer callouts.
   - Exports real `.pdf` files and hosts live mobile-friendly Smart Resource Pages at `/r/<slug>` with click tracking.
5. **100% TweetHunter-Style Growth & Monetization Suite**
   - Write & Thread Studio, AI Ghostwriter, Viral Library + Outlier Scores + Collections, My Queue & 7-Day Calendar, Custom Time Slots, Auto-Plug, Auto-RT/Un-RT, Evergreen Recycling, Auto-Delete, Auto-DM Giveaway Campaigns (with $0 X Free Tier Assisted Delivery), Engage Hub, Twitter CRM + CSV export, Analytics & Copy Framework ROI Attribution, and Multi-Account Switcher.

---

## Quick Start for Complete Beginners (Zero Cost)

### 1. Download & Start GhostPilot
Open the project folder in **Antigravity IDE** and open the terminal:

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

### 2. Where Is Your Data Saved? ($0 Unlimited)
GhostPilot stores everything locally in `data/ghostpilot-db.json`.
- Zero monthly database bills.
- Zero row limits.
- Click **Settings & X Setup → Download Backup** anytime to save a single-file backup.

### 3. Run 100% of Your AI Content Inside Antigravity IDE ($0 Extra API Cost)
Read [`ANTIGRAVITY_GUIDE.md`](./ANTIGRAVITY_GUIDE.md) for the exact 3-step click-and-paste workflow using Gemini 3.8 Flash inside Antigravity — plus how to install `morluto/rea` (`npx rea-agents setup`) to reverse-engineer any niche funnel.

### 4. Connect Your Official X (Twitter) Account (Free X Developer Tier)
1. Go to [developer.x.com](https://developer.x.com) and sign in.
2. Open **Projects & Apps** → select your App → scroll to **User authentication settings** → click **Set up**.
3. Choose **Read and write** permissions and **Web App, Automated App or Bot**.
4. Add your Callback URLs:
   - Local Antigravity IDE: `http://localhost:3000/auth/x/callback`
   - Hosted URL (if deployed): `https://<your-app-url>/auth/x/callback`
5. Go to **Keys and tokens** → scroll to **OAuth 2.0 Client ID and Client Secret** → copy both into a `.env` file:

```env
X_CLIENT_ID="your_client_id_here"
X_CLIENT_SECRET="your_client_secret_here"
```

6. Restart `npm run dev`, open **Settings & X Setup**, and click **Connect X Account**.

> **Safe Sandbox Mode:** You don't even need X keys to test GhostPilot. By default, GhostPilot runs in Safe Sandbox Mode so you can generate PDFs, carousels, A/B copy, and test your full queue safely before going live.
