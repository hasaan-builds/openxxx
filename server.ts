import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { scoreCopy } from './src/lib/copyScorer';
import { buildRankedABVariations } from './src/lib/frameworks';
import { GITHUB_SKILL_REGISTRY, humanizeCopy } from './src/lib/humanizer';
import { findNextOpenSlot, pickEvergreenCandidate } from './src/lib/scheduler';
import type {
  AntigravityTask,
  AuthorityDossier,
  CarouselDeck,
  GhostPilotStore,
  LeadMagnet,
  PostItem,
  RadarItem,
} from './src/lib/types';
import {
  clearAntigravityResults,
  loadStore,
  patchStore,
  readAntigravityResults,
  saveStore,
  syncTasksToDisk,
} from './server/store';
import { extractUrlWithJinaReader, runLiveIndustryScan } from './server/scraper';
import {
  extractJsonFromModelOutput,
  normalizeAntigravityResults,
  type NormalizedAntigravityPayload,
} from './src/lib/antigravityNormalizer';
import {
  generateABVariationsWithGemini,
  generateAuthorityDossierWithGemini,
  generateLeadMagnetWithGemini,
  ghostwriteWithGemini,
  isGeminiConfigured,
} from './server/gemini';
import {
  createXOAuthUrl,
  exchangeXCodeForTokens,
  getDefaultCallbackUrl,
  isXOAuthConfigured,
  publishPostToX,
} from './server/xClient';
import {
  detectTelegramChatId,
  fetchTelegramInboxMessages,
  getTelegramBotInfo,
  sendTelegramMessage,
} from './server/telegramClient';
import {
  buildXIntentUrl,
  formatAutoPlugReminderForTelegram,
  formatGiveawayPackForTelegram,
  formatPostForTelegram,
  validateTelegramCredentials,
} from './src/lib/telegramFormatter';

const PORT = 3000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTelegramConfig(store: GhostPilotStore, accountId?: string) {
  const acc = store.accounts.find((a) => a.id === (accountId || store.activeAccountId)) || store.accounts[0];
  return acc?.telegram?.botToken ? acc.telegram : store.telegramConfig;
}

async function processDueScheduledPosts(): Promise<number> {
  const store = loadStore();
  const now = Date.now();
  const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  let processed = 0;

  for (const post of store.posts) {
    const account =
      store.accounts.find((a) => a.id === post.accountId) || store.accounts[0];
    const tg = resolveTelegramConfig(store, account?.id);
    const tgReady = Boolean(tg?.enabled && tg.autoDeliverScheduled && tg.botToken && tg.chatId);

    // 1. Scheduled Main Post Delivery (Telegram $0 OR Official X API v2)
    if (post.status === 'queued' && post.scheduledAt && new Date(post.scheduledAt).getTime() <= now) {
      try {
        if (tgReady && account?.xMode !== 'live') {
          const linkedMagnet = store.leadMagnets.find(
            (m) => m.id === post.automations.linkedLeadMagnetId
          );
          const formatted = formatPostForTelegram({
            post,
            account,
            linkedMagnet,
            baseUrl,
          });
          await sendTelegramMessage({
            botToken: tg!.botToken,
            chatId: tg!.chatId,
            text: formatted.text,
            replyMarkup: formatted.replyMarkup,
          });
          post.status = 'published';
          post.publishedAt = new Date().toISOString();
          post.telegramDeliveredAt = post.publishedAt;
          post.errorMessage = undefined;
          if (tg) tg.lastSentAt = post.publishedAt;
          processed++;

          store.automationLogs.unshift({
            id: `log-tg-${Date.now()}-${processed}`,
            accountId: account.id,
            timestamp: new Date().toISOString(),
            type: 'telegram',
            mode: 'live',
            postId: post.id,
            message: `Sent scheduled ${post.format} to Telegram (${account.handle}) with 1-tap Post on X ($0) button.`,
          });
        } else {
          const result = await publishPostToX(post, account);
          post.status = 'published';
          post.publishedAt = new Date().toISOString();
          post.xTweetIds = result.tweetIds;
          post.errorMessage = undefined;
          processed++;

          store.automationLogs.unshift({
            id: `log-${Date.now()}-${processed}`,
            accountId: account.id,
            timestamp: new Date().toISOString(),
            type: 'publish',
            mode: result.mode,
            postId: post.id,
            message: `Published ${post.format} (${post.blocks.length} tweet${post.blocks.length > 1 ? 's' : ''}) via ${result.mode === 'live' ? 'Official X API v2' : 'Safe Sandbox'}.`,
          });
        }
      } catch (err) {
        post.status = 'failed';
        post.errorMessage = err instanceof Error ? err.message : 'Delivery error';
      }
    }

    // 2. Delayed Auto-Plug Reminder in Telegram (e.g. 30 minutes after scheduled post drop)
    if (
      post.status === 'published' &&
      post.telegramDeliveredAt &&
      !post.telegramAutoPlugSent &&
      post.automations.autoPlugEnabled &&
      post.automations.autoPlugText.trim() &&
      tg?.enabled &&
      tg.autoPlugReminderEnabled &&
      tg.botToken &&
      tg.chatId
    ) {
      const delayMs = Math.max(1, post.automations.autoPlugDelayMinutes || tg.autoPlugDelayMinutes || 30) * 60 * 1000;
      if (now - new Date(post.telegramDeliveredAt).getTime() >= delayMs) {
        try {
          const reminder = formatAutoPlugReminderForTelegram({ post, account });
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: reminder.text,
            replyMarkup: reminder.replyMarkup,
          });
          post.telegramAutoPlugSent = true;
          processed++;
          store.automationLogs.unshift({
            id: `log-tgplug-${Date.now()}-${processed}`,
            accountId: account.id,
            timestamp: new Date().toISOString(),
            type: 'auto-plug',
            mode: 'live',
            postId: post.id,
            message: `Sent Auto-Plug reply reminder to Telegram for ${account.handle}.`,
          });
        } catch {
          // Will retry on next tick
        }
      }
    }
  }

  // 3. Evergreen auto-recycle check if queue has fewer than 2 upcoming posts
  const upcomingCount = store.posts.filter((p) => p.status === 'queued').length;
  if (store.globalAutomationDefaults.evergreenEnabled && upcomingCount < 2) {
    const candidate = pickEvergreenCandidate(store.posts, new Date());
    if (candidate) {
      const nextSlot = findNextOpenSlot(store.queueSlots, store.posts, new Date());
      const recycled: PostItem = {
        ...candidate,
        id: `post-evergreen-${Date.now()}`,
        status: 'queued',
        scheduledAt: nextSlot,
        publishedAt: undefined,
        telegramDeliveredAt: undefined,
        telegramAutoPlugSent: false,
        xTweetIds: undefined,
        metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
        createdAt: new Date().toISOString(),
      };
      candidate.publishedAt = new Date().toISOString();
      store.posts.unshift(recycled);
      store.automationLogs.unshift({
        id: `log-ev-${Date.now()}`,
        accountId: recycled.accountId,
        timestamp: new Date().toISOString(),
        type: 'evergreen',
        mode: 'sandbox',
        postId: recycled.id,
        message: `Evergreen Engine recycled a top winner into your next open scheduled slot.`,
      });
      processed++;
    }
  }

  if (processed > 0) {
    store.automationLogs = store.automationLogs.slice(0, 60);
    saveStore(store);
  }
  return processed;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // --- CORE LOCAL DATABASE ROUTES ---
  app.get('/api/store', (_req, res) => {
    res.json(loadStore());
  });

  app.put('/api/store', (req, res) => {
    const updated = patchStore(req.body as Partial<GhostPilotStore>);
    if (req.body?.antigravityTasks) {
      syncTasksToDisk(updated.antigravityTasks);
    }
    res.json(updated);
  });

  app.get('/api/backup/export', (_req, res) => {
    res.json(loadStore());
  });

  app.post('/api/backup/import', (req, res) => {
    const incoming = req.body as GhostPilotStore;
    if (!incoming || !Array.isArray(incoming.accounts) || !incoming.brandBrain) {
      return res.status(400).json({ error: 'Invalid GhostPilot backup JSON format.' });
    }
    const saved = saveStore(incoming);
    syncTasksToDisk(saved.antigravityTasks || []);
    res.json(saved);
  });

  // --- APP 1: LIVE INDUSTRY RADAR & STORM AUTHORITY DOSSIER ---
  app.post('/api/radar/scan', async (req, res) => {
    try {
      const { niche, subreddits = [], customRssUrls = [], includeGithub = true } = req.body as {
        niche?: string;
        subreddits?: string[];
        customRssUrls?: string[];
        includeGithub?: boolean;
      };
      const store = loadStore();
      const activeAccount =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = activeAccount?.brandBrain || store.brandBrain;
      const targetNiche = (niche || activeBrain.niche || 'High-Ticket Sales').trim();
      const { items, liveCount } = await runLiveIndustryScan({
        niche: targetNiche,
        subreddits: subreddits.length ? subreddits : activeBrain.subreddits,
        customRssUrls: customRssUrls.length ? customRssUrls : activeBrain.customRssUrls,
        includeGithub,
        forceRefresh: Boolean((req.body as { forceRefresh?: boolean }).forceRefresh),
      });

      const activeAccountId = activeAccount?.id || store.activeAccountId;
      if (items.length > 0) {
        const tagged = items.map((item) => ({ ...item, accountId: activeAccountId }));
        const existingTitles = new Set(
          store.radarItems
            .filter((r) => (r.accountId || store.accounts[0]?.id) === activeAccountId)
            .map((r) => r.title.toLowerCase())
        );
        const fresh = tagged.filter((item) => !existingTitles.has(item.title.toLowerCase()));
        store.radarItems = [...fresh, ...store.radarItems].slice(0, 80);
        saveStore(store);
      }

      const accountRadar = store.radarItems.filter(
        (r) => (r.accountId || store.accounts[0]?.id) === activeAccountId
      );

      res.json({
        items: accountRadar,
        liveCount,
        message:
          liveCount > 0
            ? `Fetched ${liveCount} live signals across Reddit, Google News, GitHub, and RSS for "${targetNiche}".`
            : `Feeds were quiet or rate-limited right now — showing cached niche intel for "${targetNiche}".`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to scan live industry feeds.',
      });
    }
  });

  app.post('/api/research/dossier', async (req, res) => {
    try {
      const { niche, radarItemIds = [], useAntigravity = false } = req.body as {
        niche?: string;
        radarItemIds?: string[];
        useAntigravity?: boolean;
      };
      const store = loadStore();
      const activeAccount =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = activeAccount?.brandBrain || store.brandBrain;
      const targetNiche = (niche || activeBrain.niche).trim();
      const accountRadar = store.radarItems.filter(
        (r) => (r.accountId || store.accounts[0]?.id) === activeAccount?.id
      );
      const selectedRadar =
        radarItemIds.length > 0
          ? accountRadar.filter((r) => radarItemIds.includes(r.id))
          : accountRadar.slice(0, 8);

      if (useAntigravity) {
        const task: AntigravityTask = {
          id: `ag-dos-${Date.now()}`,
          accountId: store.activeAccountId,
          type: 'authority-dossier',
          title: `STORM 5-Angle Authority Dossier: ${targetNiche}`,
          status: 'pending',
          promptForIde: `Read antigravity-sync/tasks.json (task id: ag-dos-${Date.now()}). Act as a 10-year ${targetNiche} authority using Stanford STORM multi-perspective synthesis. Analyze the scraped pain points in contextPayload and write 5 posts + 1 carousel + 1 lead magnet playbook into antigravity-sync/results.json.`,
          contextPayload: {
            niche: targetNiche,
            scrapedIntel: selectedRadar,
            offers: activeBrain.offers,
          },
          createdAt: new Date().toISOString(),
        };
        store.antigravityTasks.unshift(task);
        saveStore(store);
        syncTasksToDisk(store.antigravityTasks);
        return res.json({ task, mode: 'antigravity' });
      }

      let dossier: AuthorityDossier;
      let mode = 'local-synthesis';
      let fallbackReason: string | undefined;

      if (isGeminiConfigured()) {
        try {
          dossier = await generateAuthorityDossierWithGemini({
            niche: targetNiche,
            radarItems: selectedRadar,
            brandBrain: activeBrain,
          });
          mode = 'gemini';
        } catch (err) {
          fallbackReason = err instanceof Error ? err.message : 'Gemini call failed';
          console.error('[GhostPilot] Dossier Gemini error:', fallbackReason);
          dossier = buildLocalAuthorityDossier(targetNiche, selectedRadar, {
            ...store,
            brandBrain: activeBrain,
          });
        }
      } else {
        dossier = buildLocalAuthorityDossier(targetNiche, selectedRadar, {
          ...store,
          brandBrain: activeBrain,
        });
      }

      dossier.accountId = store.activeAccountId;
      store.dossiers.unshift(dossier);
      saveStore(store);
      res.json({ dossier, mode, fallbackReason });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compile authority dossier.',
      });
    }
  });

  // --- APP 2: PREDICTIVE COPYWRITING & 5-VARIATION A/B ARENA ---
  app.post('/api/copy/ab-arena', async (req, res) => {
    try {
      const { topic, keyInsight, offerId, useGemini = true } = req.body as {
        topic: string;
        keyInsight?: string;
        offerId?: string;
        useGemini?: boolean;
      };
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const persona =
        activeBrain.personas.find((p) => p.id === activeBrain.activePersonaId) ||
        activeBrain.personas[0];
      const offer =
        activeBrain.offers.find((o) => o.id === offerId) || activeBrain.offers[0];

      let fallbackReason: string | undefined;
      if (useGemini && isGeminiConfigured()) {
        try {
          const variations = await generateABVariationsWithGemini({
            topic,
            keyInsight,
            brandBrain: activeBrain,
            persona,
            offer,
          });
          if (variations.length > 0) {
            return res.json({ variations, engine: 'gemini-4-hydrogen' });
          }
        } catch (err) {
          fallbackReason = err instanceof Error ? err.message : 'Gemini call failed';
          console.error('[GhostPilot] AB-Arena Gemini error:', fallbackReason);
        }
      }

      const variations = buildRankedABVariations({
        topic,
        keyInsight,
        brandBrain: activeBrain,
        persona,
        offer,
      });
      res.json({ variations, engine: 'blueprint-engine', fallbackReason });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'A/B copy generation failed.' });
    }
  });

  app.post('/api/copy/ghostwrite', async (req, res) => {
    try {
      const { action, text, tone } = req.body as {
        action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift' | 'reply';
        text: string;
        tone?: string;
      };
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const cleanInput = (text || '').trim();
      if (!cleanInput) {
        return res.status(400).json({ error: 'Enter a draft or idea first.' });
      }

      let fallbackReason: string | undefined;
      if (isGeminiConfigured()) {
        try {
          const blocks = await ghostwriteWithGemini({
            action,
            text: cleanInput,
            tone,
            brandBrain: activeBrain,
          });
          return res.json({ blocks, engine: 'gemini-4-hydrogen' });
        } catch (err) {
          fallbackReason = err instanceof Error ? err.message : 'Gemini call failed';
          console.error('[GhostPilot] Ghostwrite Gemini error:', fallbackReason);
        }
      }

      const blocks = localGhostwriteTransform(action, cleanInput, activeBrain.niche);
      res.json({ blocks, engine: 'local-copy-rules', fallbackReason });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Ghostwriter failed.' });
    }
  });

  // --- APP 4: LEAD MAGNET STUDIO (GAMMA PDF + BEACON SMART RESOURCE PAGE) ---
  app.post('/api/lead-magnets/generate', async (req, res) => {
    try {
      const { topic, format = 'Playbook', dossierId, offerId } = req.body as {
        topic: string;
        format?: LeadMagnet['format'];
        dossierId?: string;
        offerId?: string;
      };
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const dossier =
        store.dossiers.find((d) => d.id === dossierId) ||
        store.dossiers.find((d) => d.accountId === account.id);
      const offer =
        activeBrain.offers.find((o) => o.id === offerId) || activeBrain.offers[0];

      let leadMagnet: LeadMagnet;
      let engine = 'local-blueprint';
      let fallbackReason: string | undefined;

      if (isGeminiConfigured()) {
        try {
          leadMagnet = await generateLeadMagnetWithGemini({
            topic: topic || activeBrain.niche,
            format,
            dossier,
            offer,
            brandBrain: activeBrain,
            authorName: account.name,
            authorHandle: account.handle,
          });
          engine = 'gemini-4-hydrogen';
        } catch (err) {
          fallbackReason = err instanceof Error ? err.message : 'Gemini call failed';
          console.error('[GhostPilot] LeadMagnet Gemini error:', fallbackReason);
          leadMagnet = buildLocalLeadMagnet(topic || activeBrain.niche, format, dossier, offer, account);
        }
      } else {
        leadMagnet = buildLocalLeadMagnet(topic || activeBrain.niche, format, dossier, offer, account);
      }

      leadMagnet.accountId = store.activeAccountId;
      store.leadMagnets.unshift(leadMagnet);
      saveStore(store);
      res.json({ leadMagnet, engine, fallbackReason });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate lead magnet.' });
    }
  });

  // Beacon-style Hosted Smart Resource Page (/r/:slug) — Apple Editorial Styling
  app.get('/r/:slug', (req, res) => {
    const store = loadStore();
    const magnet = store.leadMagnets.find((m) => m.slug === req.params.slug);
    if (!magnet) {
      return res.status(404).send('<h1>Resource not found</h1>');
    }

    magnet.views += 1;
    saveStore(store);

    const allOffers = [
      ...store.brandBrain.offers,
      ...store.accounts.flatMap((a) => a.brandBrain?.offers || []),
    ];
    const offer = allOffers.find((o) => o.id === magnet.linkedOfferId);
    const sectionsHtml = magnet.sections
      .map(
        (sec, idx) => `
      <section class="card ${sec.type === 'offer-callout' ? 'card-offer' : ''}">
        <div class="kicker">0${idx + 1} · ${escapeHtml(sec.type.replace('-', ' '))}</div>
        <h2>${escapeHtml(sec.heading)}</h2>
        <p>${escapeHtml(sec.body)}</p>
        ${
          sec.bullets.length
            ? `<ul>${sec.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
            : ''
        }
      </section>`
      )
      .join('');

    const offerHtml = offer
      ? `<div class="cta-banner">
          <div class="kicker">Recommended Next Step · ${escapeHtml(offer.platform)}</div>
          <h2>${escapeHtml(offer.name)}</h2>
          <p>${escapeHtml(offer.promise)}</p>
          <a class="cta-btn" href="/r/${escapeHtml(magnet.slug)}/go" target="_blank" rel="noopener noreferrer">
            Access ${escapeHtml(offer.name)} (${escapeHtml(offer.priceLabel)}) →
          </a>
        </div>`
      : '';

    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(magnet.title)} — ${escapeHtml(magnet.authorName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; font-family: 'DM Sans', -apple-system, sans-serif; background: #F5F5F7; color: #1D1D1F; line-height: 1.65; -webkit-font-smoothing: antialiased; }
    .hero { background: #FFFFFF; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 72px 24px 64px; }
    .wrap { max-width: 740px; margin: 0 auto; }
    .kicker { font-size: 13px; font-weight: 600; color: #0071E3; margin-bottom: 12px; letter-spacing: -0.01em; }
    h1 { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: clamp(32px, 5vw, 48px); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 18px; color: #1D1D1F; }
    h2 { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 22px; letter-spacing: -0.02em; margin: 0 0 10px; line-height: 1.25; }
    .sub { color: #6E6E73; font-size: 18px; max-width: 620px; margin: 0 0 24px; line-height: 1.5; }
    .meta { font-size: 13px; color: #86868B; }
    .content { padding: 40px 24px 88px; }
    .card { background: #FFFFFF; border: 1px solid rgba(0,0,0,0.06); border-radius: 20px; padding: 32px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 12px 32px -18px rgba(0,0,0,0.08); }
    .card-offer { background: #F0F7FF; border-color: rgba(0,113,227,0.18); }
    ul { padding-left: 20px; margin: 14px 0 0; }
    li { margin-bottom: 8px; color: #515154; }
    .cta-banner { background: #1D1D1F; color: #F5F5F7; border-radius: 24px; padding: 36px; margin-top: 32px; }
    .cta-banner .kicker { color: #2997FF; }
    .cta-banner p { color: #A1A1A6; }
    .cta-btn { display: inline-block; margin-top: 16px; background: #0071E3; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 13px 24px; border-radius: 999px; }
    .cta-btn:hover { background: #0077ED; }
    .toolbar { display: flex; gap: 12px; margin-top: 24px; }
    .btn-ghost { background: rgba(0,0,0,0.05); color: #1D1D1F; border: none; padding: 10px 18px; border-radius: 999px; cursor: pointer; font-weight: 600; font-family: inherit; }
    .btn-ghost:hover { background: rgba(0,0,0,0.09); }
    @media print { .toolbar { display: none; } body { background: #fff; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <header class="hero">
    <div class="wrap">
      <div class="kicker">${escapeHtml(magnet.format)} · ${escapeHtml(magnet.niche)}</div>
      <h1>${escapeHtml(magnet.title)}</h1>
      <p class="sub">${escapeHtml(magnet.subtitle)}</p>
      <div class="meta">By ${escapeHtml(magnet.authorName)} (${escapeHtml(magnet.authorHandle)}) · ${magnet.views.toLocaleString()} views</div>
      <div class="toolbar">
        <button class="btn-ghost" onclick="window.print()">Print or Save as PDF</button>
      </div>
    </div>
  </header>
  <main class="content">
    <div class="wrap">
      ${sectionsHtml}
      ${offerHtml}
    </div>
  </main>
</body>
</html>`);
  });

  // Tracked affiliate/offer click redirect from Smart Resource Page
  app.get('/r/:slug/go', (req, res) => {
    const store = loadStore();
    const magnet = store.leadMagnets.find((m) => m.slug === req.params.slug);
    if (!magnet) return res.redirect('/');
    magnet.offerClicks += 1;
    const allOffers = [
      ...store.brandBrain.offers,
      ...store.accounts.flatMap((a) => a.brandBrain?.offers || []),
    ];
    const offer = allOffers.find((o) => o.id === magnet.linkedOfferId);
    if (offer) {
      offer.clicks += 1;
      saveStore(store);
      return res.redirect(offer.url);
    }
    saveStore(store);
    res.redirect(`/r/${magnet.slug}`);
  });

  // --- APP 5: PUBLISHING, SCHEDULER & OFFICIAL X OAUTH 2.0 PKCE ---
  app.post('/api/posts/:id/publish', async (req, res) => {
    const store = loadStore();
    const post = store.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const account = store.accounts.find((a) => a.id === post.accountId) || store.accounts[0];

    try {
      const result = await publishPostToX(post, account);
      post.status = 'published';
      post.publishedAt = new Date().toISOString();
      post.xTweetIds = result.tweetIds;
      post.errorMessage = undefined;

      store.automationLogs.unshift({
        id: `log-pub-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'publish',
        mode: result.mode,
        postId: post.id,
        message: `Published immediately (${post.blocks.length} tweet${post.blocks.length > 1 ? 's' : ''}) in ${result.mode === 'live' ? 'Live X API v2' : 'Safe Sandbox'} mode.`,
      });
      store.automationLogs = store.automationLogs.slice(0, 60);
      saveStore(store);
      res.json({ post, store });
    } catch (err) {
      post.status = 'failed';
      post.errorMessage = err instanceof Error ? err.message : 'Publishing error';
      saveStore(store);
      res.status(500).json({ error: post.errorMessage });
    }
  });

  app.post('/api/scheduler/tick', async (_req, res) => {
    const processed = await processDueScheduledPosts();
    res.json({ processed, store: loadStore() });
  });

  app.get('/api/x/config', (_req, res) => {
    const store = loadStore();
    const active = store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    res.json({
      configured: isXOAuthConfigured(),
      callbackUrl: getDefaultCallbackUrl(),
      mode: active?.xMode || 'sandbox',
      geminiConfigured: isGeminiConfigured(),
    });
  });

  app.get('/api/x/auth-url', (req, res) => {
    try {
      const redirectUri =
        typeof req.query.redirect_uri === 'string' && req.query.redirect_uri
          ? req.query.redirect_uri
          : getDefaultCallbackUrl();
      const url = createXOAuthUrl(redirectUri);
      res.json({ url });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Cannot create X OAuth URL.' });
    }
  });

  const handleXCallback: express.RequestHandler = async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state) {
      return res.status(400).send('<p>Authorization canceled or missing code. You may close this window.</p>');
    }

    try {
      const tokens = await exchangeXCodeForTokens(code, state);
      const store = loadStore();
      const active = store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      active.xConnected = true;
      active.xMode = 'live';
      active.xAccessToken = tokens.accessToken;
      active.xRefreshToken = tokens.refreshToken;
      active.xTokenExpiresAt = tokens.expiresAt;
      if (tokens.user) {
        active.name = tokens.user.name;
        active.handle = `@${tokens.user.username}`;
      }
      saveStore(store);

      res.send(`<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; padding: 32px; text-align: center;">
    <h2>X Account Connected</h2>
    <p>Authentication successful. Returning to GhostPilot...</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'X_OAUTH_SUCCESS' }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth error';
      res.status(500).send(`<p>X connection error: ${escapeHtml(msg)}</p>`);
    }
  };

  app.get(['/auth/x/callback', '/auth/x/callback/'], handleXCallback);

  app.post('/api/x/disconnect', (_req, res) => {
    const store = loadStore();
    const active = store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    active.xConnected = false;
    active.xMode = 'sandbox';
    active.xAccessToken = undefined;
    active.xRefreshToken = undefined;
    saveStore(store);
    res.json({ store });
  });

  // --- $0 TELEGRAM BOT AUTOPILOT ROUTES ---
  app.post('/api/telegram/detect-chat', async (req, res) => {
    try {
      const { botToken } = req.body as { botToken?: string };
      const check = validateTelegramCredentials(botToken || '');
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      const detected = await detectTelegramChatId(botToken!.trim());
      res.json(detected);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not detect Telegram Chat ID.',
      });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };
      const check = validateTelegramCredentials(botToken || '', chatId || '');
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      const store = loadStore();
      const active = store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const bot = await getTelegramBotInfo(botToken!.trim());
      const sampleTweet = `GhostPilot is connected to Telegram for ${active.handle} ($0 forever).\n\nEvery scheduled post, Auto-Plug reply, and Free PDF link will arrive right here.`;

      await sendTelegramMessage({
        botToken: botToken!.trim(),
        chatId: chatId!.trim(),
        text: `<b>GhostPilot Connected!</b>\n<i>Account: ${escapeHtml(active.handle)} · Bot: @${escapeHtml(bot.username)}</i>\n\n<pre>${escapeHtml(sampleTweet)}</pre>`,
        replyMarkup: {
          inline_keyboard: [[{ text: 'Test 1-Tap Post on X ($0)', url: buildXIntentUrl(sampleTweet) }]],
        },
      });

      const nextTg = {
        enabled: true,
        botToken: botToken!.trim(),
        chatId: chatId!.trim(),
        botUsername: bot.username,
        autoDeliverScheduled: active.telegram?.autoDeliverScheduled ?? true,
        autoPlugReminderEnabled: active.telegram?.autoPlugReminderEnabled ?? true,
        autoPlugDelayMinutes: active.telegram?.autoPlugDelayMinutes ?? 30,
        twoWayInboxEnabled: active.telegram?.twoWayInboxEnabled ?? true,
        lastUpdateId: active.telegram?.lastUpdateId,
        lastSentAt: new Date().toISOString(),
      };
      active.telegram = nextTg;
      store.telegramConfig = nextTg;
      saveStore(store);

      res.json({ ok: true, botUsername: bot.username, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to send test Telegram message.',
      });
    }
  });

  app.post('/api/telegram/send-post/:id', async (req, res) => {
    try {
      const store = loadStore();
      const post = store.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found.' });
      const account =
        store.accounts.find((a) => a.id === post.accountId) ||
        store.accounts.find((a) => a.id === store.activeAccountId) ||
        store.accounts[0];
      const tg = resolveTelegramConfig(store, account?.id);
      if (!tg?.botToken || !tg?.chatId) {
        return res.status(400).json({
          error: 'Connect your free Telegram Bot first under Accounts & Telegram (takes 30 seconds).',
        });
      }

      const origin =
        (typeof req.body?.origin === 'string' && req.body.origin) ||
        process.env.APP_URL ||
        'http://localhost:3000';
      const linkedMagnet = store.leadMagnets.find(
        (m) => m.id === post.automations.linkedLeadMagnetId
      );
      const formatted = formatPostForTelegram({
        post,
        account,
        linkedMagnet,
        baseUrl: origin,
      });

      await sendTelegramMessage({
        botToken: tg.botToken,
        chatId: tg.chatId,
        text: formatted.text,
        replyMarkup: formatted.replyMarkup,
      });

      const nowIso = new Date().toISOString();
      post.telegramDeliveredAt = nowIso;
      post.status = 'published';
      post.publishedAt = nowIso;
      tg.lastSentAt = nowIso;
      store.automationLogs.unshift({
        id: `log-tg-${Date.now()}`,
        accountId: account.id,
        timestamp: nowIso,
        type: 'telegram',
        mode: 'live',
        postId: post.id,
        message: `Sent post to Telegram for ${account.handle} (1-tap Post on X ready).`,
      });
      saveStore(store);

      res.json({ ok: true, post, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to send post to Telegram.',
      });
    }
  });

  app.post('/api/telegram/send-magnet/:id', async (req, res) => {
    try {
      const store = loadStore();
      const magnet = store.leadMagnets.find((m) => m.id === req.params.id);
      if (!magnet) return res.status(404).json({ error: 'Free PDF not found.' });
      const account =
        store.accounts.find((a) => a.id === magnet.accountId) ||
        store.accounts.find((a) => a.id === store.activeAccountId) ||
        store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const tg = resolveTelegramConfig(store, account?.id);
      if (!tg?.botToken || !tg?.chatId) {
        return res.status(400).json({
          error: 'Connect your free Telegram Bot first under Accounts & Telegram (takes 30 seconds).',
        });
      }

      const origin =
        (typeof req.body?.origin === 'string' && req.body.origin) ||
        process.env.APP_URL ||
        'http://localhost:3000';
      const offer = activeBrain.offers.find((o) => o.id === magnet.linkedOfferId) || activeBrain.offers[0];
      const payload = formatGiveawayPackForTelegram({
        magnet,
        offer,
        account,
        baseUrl: origin,
      });

      await sendTelegramMessage({
        botToken: tg.botToken,
        chatId: tg.chatId,
        text: payload.text,
        replyMarkup: payload.replyMarkup,
      });

      tg.lastSentAt = new Date().toISOString();
      saveStore(store);
      res.json({ ok: true, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to send Free PDF pack to Telegram.',
      });
    }
  });

  app.post('/api/telegram/poll-inbox', async (req, res) => {
    try {
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const tg = resolveTelegramConfig(store, account?.id);
      if (!tg?.botToken || !tg?.chatId) {
        return res.status(400).json({ error: 'Connect your Telegram Bot first.' });
      }

      const { messages, nextUpdateId } = await fetchTelegramInboxMessages(
        tg.botToken,
        tg.chatId,
        tg.lastUpdateId
      );
      if (typeof nextUpdateId === 'number') {
        tg.lastUpdateId = nextUpdateId;
      }

      let createdPosts = 0;
      const origin =
        (typeof req.body?.origin === 'string' && req.body.origin) ||
        process.env.APP_URL ||
        'http://localhost:3000';

      for (const msg of messages.slice(0, 4)) {
        const trimmed = msg.text.trim();
        const lower = trimmed.toLowerCase();

        // Slash Command: /help
        if (lower === '/help' || lower === '/start') {
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: [
              `<b>GhostPilot $0 Telegram Commands</b> (${account.handle})`,
              '',
              `• <code>/today</code> — Send your next queued post + 1-tap X button`,
              `• <code>/ideas</code> — Pull live 7-source ideas for ${activeBrain.niche}`,
              `• <code>/pdf your topic</code> — Build a Free PDF + Comment-to-PDF Reply Pack`,
              `• <code>/stats</code> — View queue count, PDFs & next scheduled drop`,
              `• <b>Paste any URL</b> (YouTube, Whop, article, GitHub) — Auto-converts into a humanized tweet!`,
            ].join('\n'),
          });
          continue;
        }

        // Slash Command: /stats
        if (lower === '/stats') {
          const accPosts = store.posts.filter((p) => !p.accountId || p.accountId === account.id);
          const ready = accPosts.filter((p) => p.status === 'queued' || p.status === 'draft').length;
          const accPdfs = store.leadMagnets.filter((m) => !m.accountId || m.accountId === account.id).length;
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: `<b>GhostPilot Status · ${account.handle}</b>\n\n• Niche: ${activeBrain.niche}\n• Ready Posts in Queue: <b>${ready}</b>\n• Free Giveaway PDFs: <b>${accPdfs}</b>\n• Drop Times: ${store.queueSlots.map((s) => s.time).join(', ')}`,
          });
          continue;
        }

        // Slash Command: /today
        if (lower === '/today') {
          const nextPost = store.posts
            .filter((p) => (!p.accountId || p.accountId === account.id) && p.status === 'queued')
            .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))[0];
          if (!nextPost) {
            await sendTelegramMessage({
              botToken: tg.botToken,
              chatId: tg.chatId,
              text: `No queued posts for ${account.handle} yet. Text me any URL or tap "Create Today's Posts ($0)" in GhostPilot!`,
            });
          } else {
            const payload = formatPostForTelegram({ post: nextPost, account, baseUrl: origin });
            await sendTelegramMessage({
              botToken: tg.botToken,
              chatId: tg.chatId,
              text: payload.text,
              replyMarkup: payload.replyMarkup,
            });
          }
          continue;
        }

        // Slash Command: /ideas
        if (lower === '/ideas') {
          const scan = await runLiveIndustryScan({
            niche: activeBrain.niche,
            subreddits: activeBrain.subreddits,
            customRssUrls: activeBrain.customRssUrls,
            includeGithub: true,
          });
          const top5 = scan.items.slice(0, 5);
          const lines = top5.map(
            (it, i) => `${i + 1}. <b>[${it.source}]</b> ${it.title.slice(0, 110)}\n${it.url}`
          );
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: `<b>Top 5 Live $0 Ideas · ${activeBrain.niche}</b>\n\n${lines.join('\n\n') || 'No fresh signals found right now.'}\n\n<i>Reply with any link above and I will write your post!</i>`,
          });
          continue;
        }

        // Slash Command: /pdf <topic>
        if (lower.startsWith('/pdf')) {
          const pdfTopic = trimmed.replace(/^\/pdf\s*/i, '').trim() || activeBrain.niche;
          const offer = activeBrain.offers[0];
          const newMagnet = buildLocalLeadMagnet(
            pdfTopic,
            'Playbook',
            store.dossiers[0],
            offer,
            account
          );
          newMagnet.accountId = account.id;
          store.leadMagnets.unshift(newMagnet);
          const pack = formatGiveawayPackForTelegram({
            magnet: newMagnet,
            offer,
            account,
            baseUrl: origin,
          });
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: `<b>Built your new Free PDF + Giveaway Reply Pack ($0)!</b>\n\n${pack.text}`,
            replyMarkup: pack.replyMarkup,
          });
          continue;
        }

        let topic = trimmed;
        let insight = `Practical lesson for ${activeBrain.niche} buyers.`;

        if (msg.url) {
          try {
            const extracted = await extractUrlWithJinaReader(msg.url);
            topic = extracted.title;
            insight = extracted.keyTakeaways[0] || extracted.markdown.slice(0, 220);
            store.radarItems.unshift({
              id: `tg-in-${Date.now()}-${createdPosts}`,
              accountId: account.id,
              source: extracted.engine === 'youtube-transcript' ? 'YouTube Transcript' : 'Custom RSS',
              sourceDetail: extracted.engine === 'youtube-transcript' ? 'YouTube Transcript ($0)' : 'Sent from Telegram',
              title: extracted.title,
              summary: extracted.keyTakeaways.join(' · ').slice(0, 260) || insight,
              url: extracted.url,
              niche: activeBrain.niche,
              signalScore: 95,
              publishedAt: new Date().toISOString(),
              painPointTag: 'Telegram Inbox Link',
            });
          } catch {
            // Fall back to raw message text
          }
        }

        const offer = activeBrain.offers[0];
        const variations = buildRankedABVariations({
          topic,
          keyInsight: insight,
          brandBrain: activeBrain,
          persona: activeBrain.personas[0],
          offer,
        });
        const best = variations[0];
        if (!best) continue;

        const humanizedBlocks = best.blocks.map((b) => humanizeCopy(b).cleanedText || b);
        const nextSlot = findNextOpenSlot(store.queueSlots, store.posts, new Date());
        const newPost: PostItem = {
          id: `post-tgin-${Date.now()}-${createdPosts}`,
          accountId: account.id,
          blocks: humanizedBlocks,
          status: 'queued',
          format: humanizedBlocks.length > 1 ? 'thread' : 'single',
          scheduledAt: nextSlot,
          frameworkName: best.frameworkName,
          trigger: best.trigger,
          predictiveScore: best.score.total,
          automations: {
            threadDelayMinutes: 0,
            autoPlugEnabled: Boolean(offer?.autoPlugTemplate),
            autoPlugText: offer?.autoPlugTemplate || '',
            autoPlugDelayMinutes: 30,
            autoPlugMinLikes: 0,
            autoRetweetEnabled: false,
            autoRetweetDelayHours: 8,
            autoUnretweetAfterHours: 24,
            autoDeleteEnabled: false,
            autoDeleteAfterHours: 0,
            isEvergreen: true,
            evergreenIntervalDays: 14,
            linkedOfferId: offer?.id,
          },
          metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
          createdAt: new Date().toISOString(),
        };
        store.posts.unshift(newPost);
        createdPosts++;

        const replyPayload = formatPostForTelegram({
          post: newPost,
          account,
          baseUrl: origin,
        });
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: `<b>Turned your Telegram note into a humanized queued post!</b>\n\n${replyPayload.text}`,
          replyMarkup: replyPayload.replyMarkup,
        });
      }

      saveStore(store);
      res.json({ checked: messages.length, createdPosts, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not check Telegram inbox.',
      });
    }
  });

  // --- ANTIGRAVITY IDE SKILLS PACK & GITHUB SKILL REGISTRY ---
  app.get('/api/skills/pack', (_req, res) => {
    const skillsDir = path.resolve(process.cwd(), 'antigravity-skills');
    const skillFiles: Array<{ name: string; path: string; content: string }> = [];
    if (fs.existsSync(skillsDir)) {
      const folders = fs.readdirSync(skillsDir).sort();
      for (const folder of folders) {
        const skillPath = path.join(skillsDir, folder, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          skillFiles.push({
            name: folder,
            path: `antigravity-skills/${folder}/SKILL.md`,
            content: fs.readFileSync(skillPath, 'utf-8'),
          });
        }
      }
    }
    res.json({
      totalGithubSkills: GITHUB_SKILL_REGISTRY.length,
      antigravitySkillCount: skillFiles.length,
      registry: GITHUB_SKILL_REGISTRY,
      skillFiles,
    });
  });

  // --- BUILT-IN $0 OPEN-SOURCE TOOL: JINA READER + YOUTUBE TRANSCRIPT EXTRACTOR ---
  app.post('/api/tools/extract-url', async (req, res) => {
    try {
      const { url, saveToRadar = true } = req.body as { url?: string; saveToRadar?: boolean };
      if (!url?.trim()) {
        return res.status(400).json({ error: 'Enter a YouTube, Whop, article, or GitHub repo URL.' });
      }
      const extracted = await extractUrlWithJinaReader(url);
      const store = loadStore();
      const activeAccount =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = activeAccount?.brandBrain || store.brandBrain;

      if (saveToRadar) {
        const isYoutube = extracted.engine === 'youtube-transcript';
        const radarItem: RadarItem = {
          id: `jina-${Date.now()}`,
          accountId: activeAccount.id,
          source: isYoutube ? 'YouTube Transcript' : 'Custom RSS',
          sourceDetail: isYoutube
            ? 'YouTube Transcript ($0)'
            : `Jina Reader (${new URL(extracted.url).hostname.replace(/^www\./, '')})`,
          title: extracted.title,
          summary: extracted.keyTakeaways[0] || extracted.markdown.slice(0, 240),
          url: extracted.url,
          niche: activeBrain.niche,
          signalScore: 93,
          publishedAt: new Date().toISOString(),
          painPointTag: isYoutube ? 'YouTube Video Breakdown' : 'Extracted Deep Source',
        };
        store.radarItems = [radarItem, ...store.radarItems].slice(0, 80);
        saveStore(store);
      }

      res.json({ ...extracted, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to extract URL.',
      });
    }
  });

  // Helper to import normalized Antigravity payload into the active account cleanly
  const ingestAntigravityPayload = (
    store: GhostPilotStore,
    normalized: NormalizedAntigravityPayload,
    taskId?: string
  ) => {
    const activeAccount =
      store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    const activeBrain = activeAccount?.brandBrain || store.brandBrain;
    const persona =
      activeBrain.personas.find((p) => p.id === activeBrain.activePersonaId) ||
      activeBrain.personas[0];

    let importedPosts = 0;
    let importedCarousels = 0;
    let importedMagnets = 0;

    for (const p of normalized.posts) {
      if (!p.blocks.length) continue;
      const scored = scoreCopy(p.blocks, { brandBrain: activeBrain, persona });
      const slot = findNextOpenSlot(store.queueSlots, store.posts, new Date());
      store.posts.unshift({
        id: `post-ag-${Date.now()}-${importedPosts}`,
        accountId: activeAccount.id,
        blocks: p.blocks,
        status: 'queued',
        format: p.format || (p.blocks.length > 1 ? 'thread' : 'single'),
        scheduledAt: slot,
        frameworkName: p.frameworkName || 'Antigravity Gemini 3.8 Flash',
        predictiveScore: scored.total,
        automations: {
          threadDelayMinutes: p.blocks.length > 1 ? 2 : 0,
          autoPlugEnabled: store.globalAutomationDefaults.autoPlugEnabled,
          autoPlugText: activeBrain.offers[0]?.autoPlugTemplate || '',
          autoPlugDelayMinutes: store.globalAutomationDefaults.autoPlugDelayMinutes,
          autoPlugMinLikes: 10,
          autoRetweetEnabled: store.globalAutomationDefaults.autoRetweetEnabled,
          autoRetweetDelayHours: store.globalAutomationDefaults.autoRetweetDelayHours,
          autoUnretweetAfterHours: store.globalAutomationDefaults.autoUnretweetAfterHours,
          autoDeleteEnabled: false,
          autoDeleteAfterHours: 72,
          isEvergreen: scored.total >= 84,
          evergreenIntervalDays: 21,
          linkedOfferId: activeBrain.offers[0]?.id,
        },
        metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
        createdAt: new Date().toISOString(),
      });
      importedPosts++;
    }

    for (const c of normalized.carousels) {
      const deck: CarouselDeck = {
        id: `car-ag-${Date.now()}-${importedCarousels}`,
        accountId: activeAccount.id,
        title: c.title,
        themeId: c.themeId || 'obsidian',
        authorName: activeAccount.name,
        authorHandle: activeAccount.handle,
        linkedOfferId: activeBrain.offers[0]?.id,
        slides: c.slides.map((s, idx) => ({
          id: `sl-ag-${Date.now()}-${idx}`,
          layout: s.layout || 'framework',
          eyebrow: s.eyebrow || `SLIDE ${idx + 1}`,
          headline: s.headline || '',
          body: s.body || '',
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
        })),
        createdAt: new Date().toISOString(),
      };
      store.carousels.unshift(deck);
      importedCarousels++;
    }

    for (const lm of normalized.leadMagnets) {
      const slug =
        lm.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 44) +
        '-' +
        String(Date.now()).slice(-4);
      store.leadMagnets.unshift({
        id: `lm-ag-${Date.now()}-${importedMagnets}`,
        accountId: activeAccount.id,
        slug,
        title: lm.title,
        subtitle: lm.subtitle || '',
        format: lm.format || 'Playbook',
        niche: activeBrain.niche,
        themeColor: '#0071E3',
        authorName: activeAccount.name,
        authorHandle: activeAccount.handle,
        linkedOfferId: activeBrain.offers[0]?.id,
        giveawayKeyword: lm.giveawayKeyword || 'GUIDE',
        sections: lm.sections.map((s, idx) => ({
          id: `sec-ag-${Date.now()}-${idx}`,
          type: s.type || 'framework',
          heading: s.heading || `Section ${idx + 1}`,
          body: s.body || '',
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
        })),
        views: 0,
        downloads: 0,
        offerClicks: 0,
        createdAt: new Date().toISOString(),
      });
      importedMagnets++;
    }

    if (importedPosts + importedCarousels + importedMagnets > 0) {
      if (taskId) {
        const task = store.antigravityTasks.find((t) => t.id === taskId);
        if (task) {
          task.status = 'imported';
          task.importedAt = new Date().toISOString();
        }
      }
      saveStore(store);
      syncTasksToDisk(store.antigravityTasks);
    }

    return { importedPosts, importedCarousels, importedMagnets };
  };

  // --- ANTIGRAVITY IDE ($0 GEMINI 3.8 FLASH / WEAK-MODEL-PROOF) BRIDGE ---
  app.post('/api/antigravity/tasks', (req, res) => {
    const { type = 'weekly-autopilot', title, goal } = req.body as {
      type?: AntigravityTask['type'];
      title?: string;
      goal?: string;
    };
    const store = loadStore();
    const activeAccount =
      store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    const activeBrain = activeAccount?.brandBrain || store.brandBrain;
    const accountRadar = store.radarItems
      .filter((r) => (r.accountId || store.accounts[0]?.id) === activeAccount.id)
      .slice(0, 5);
    const accountDossier =
      store.dossiers.find((d) => (d.accountId || store.accounts[0]?.id) === activeAccount.id) ||
      null;
    const accountMagnets = store.leadMagnets
      .filter((m) => (m.accountId || store.accounts[0]?.id) === activeAccount.id)
      .slice(0, 2);

    const id = `ag-${Date.now()}`;
    const taskTitle = title?.trim() || `Autopilot Task (${type}) — ${activeBrain.niche}`;

    // Compact, deterministic fill-in-the-blank prompt engineered to succeed 100% even on small/fast models
    const promptForIde = [
      `TASK: Complete GhostPilot task "${id}" for ${activeAccount.handle} (Niche: ${activeBrain.niche}).`,
      `GOAL: ${goal?.trim() || `Write 5 high-converting X posts (under 270 chars each, short lines, concrete numbers, zero AI clichés like "delve" or "game-changer") for ${activeBrain.niche} promoting "${activeBrain.offers[0]?.name || 'our free playbook'}".`}`,
      `CONTEXT FILE: Read antigravity-sync/tasks.json -> task "${id}".`,
      `OUTPUT: Write JSON into antigravity-sync/results.json (or paste it back into GhostPilot):`,
      `{"taskId":"${id}","posts":[{"blocks":["Tweet 1 text here"],"format":"single"},{"blocks":["Hook tweet","Step 1 + 2","Comment KEYWORD for the free PDF"],"format":"thread"}]}`,
    ].join('\n');

    const task: AntigravityTask = {
      id,
      accountId: activeAccount.id,
      type,
      title: taskTitle,
      status: 'pending',
      promptForIde,
      contextPayload: {
        account: { handle: activeAccount.handle, niche: activeBrain.niche },
        brandBrain: activeBrain,
        latestDossier: accountDossier,
        latestRadar: accountRadar,
        leadMagnets: accountMagnets.map((m) => ({
          title: m.title,
          slug: m.slug,
          keyword: m.giveawayKeyword,
        })),
      },
      createdAt: new Date().toISOString(),
    };

    store.antigravityTasks.unshift(task);
    saveStore(store);
    syncTasksToDisk(store.antigravityTasks);
    res.json({ task, store });
  });

  app.post('/api/antigravity/sync', (_req, res) => {
    const store = loadStore();
    const rawResults = readAntigravityResults();
    const normalized = normalizeAntigravityResults(rawResults);
    const counts = ingestAntigravityPayload(store, normalized, rawResults.taskId);
    if (counts.importedPosts + counts.importedCarousels + counts.importedMagnets > 0) {
      clearAntigravityResults();
    }
    res.json({ ...counts, store });
  });

  // Weak-model-proof direct paste importer (works even if a model replies in chat with messy markdown/JSON/plain text)
  app.post('/api/antigravity/import-raw', (req, res) => {
    try {
      const { rawText, taskId } = req.body as { rawText?: string; taskId?: string };
      const parsed = extractJsonFromModelOutput(rawText || '');
      const normalized = normalizeAntigravityResults(parsed);
      const total =
        normalized.posts.length + normalized.carousels.length + normalized.leadMagnets.length;
      if (total === 0) {
        return res.status(400).json({
          error: 'No posts, carousels, or lead magnets found in that text. Paste your model output and try again.',
        });
      }
      const store = loadStore();
      const inferredTaskId =
        taskId ||
        (parsed && typeof parsed === 'object' && typeof (parsed as { taskId?: unknown }).taskId === 'string'
          ? (parsed as { taskId: string }).taskId
          : undefined);
      const counts = ingestAntigravityPayload(store, normalized, inferredTaskId);
      res.json({ ...counts, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse model output.',
      });
    }
  });

  // Built-in <1s $0 Local Turbo Runner — works 100% offline/locally regardless of LLM speed or limits
  app.post('/api/antigravity/run-local-turbo', (req, res) => {
    const { goal } = req.body as { goal?: string };
    const store = loadStore();
    const activeAccount =
      store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    const activeBrain = activeAccount?.brandBrain || store.brandBrain;
    const persona =
      activeBrain.personas.find((p) => p.id === activeBrain.activePersonaId) ||
      activeBrain.personas[0];
    const offer = activeBrain.offers[0];
    const accountRadar = store.radarItems.filter(
      (r) => (r.accountId || store.accounts[0]?.id) === activeAccount.id
    );
    const accountDossier = store.dossiers.find(
      (d) => (d.accountId || store.accounts[0]?.id) === activeAccount.id
    );

    const topics = [
      ...(goal?.trim() ? [goal.trim()] : []),
      ...(accountRadar.slice(0, 2).map((r) => r.title)),
      ...(accountDossier?.angles.buyerPainPoints.slice(0, 2) || []),
      `${activeBrain.niche} step-by-step system`,
      `${activeBrain.niche} mistakes costing beginners money`,
    ].slice(0, 4);

    const generatedPosts = topics.map((topic, idx) => {
      const ranked = buildRankedABVariations({
        topic,
        keyInsight:
          accountDossier?.angles.coreFrameworks[idx % Math.max(1, accountDossier?.angles.coreFrameworks.length || 1)] ||
          accountRadar[idx]?.summary,
        brandBrain: activeBrain,
        persona,
        offer,
      });
      const winner = ranked[0];
      return {
        blocks: winner.blocks,
        format: (idx === 0 ? 'giveaway' : 'single') as PostItem['format'],
        frameworkName: `${winner.frameworkName} (Local Turbo)`,
      };
    });

    const counts = ingestAntigravityPayload(store, {
      posts: generatedPosts,
      carousels: [],
      leadMagnets: [],
    });

    res.json({ ...counts, store });
  });

  // --- VITE / STATIC FRONTEND SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start 60-second background scheduler engine
  setInterval(() => {
    void processDueScheduledPosts();
  }, 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GhostPilot server listening on http://0.0.0.0:${PORT}`);
  });
}

function buildLocalAuthorityDossier(
  niche: string,
  radarItems: RadarItem[],
  store: GhostPilotStore
): AuthorityDossier {
  const topPain = radarItems.filter((r) => r.source === 'Reddit Pain-Point').slice(0, 3);
  const topNews = radarItems.filter((r) => r.source !== 'Reddit Pain-Point').slice(0, 3);
  const offer = store.brandBrain.offers[0];

  return {
    id: `dos-${Date.now()}`,
    niche,
    title: `${niche} — 5-Angle Authority Dossier`,
    createdAt: new Date().toISOString(),
    sourceCount: Math.max(1, radarItems.length),
    angles: {
      buyerPainPoints: [
        ...(topPain.map((p) => `${p.title} (${p.sourceDetail})`) || []),
        `Most ${niche} beginners drown in theory without a repeatable daily checklist.`,
        `Buyers distrust hype claims and want transparent numbers before clicking any link.`,
      ].slice(0, 4),
      coreFrameworks: [
        `The 3-Step ${niche} Diagnostic: Audit Current Leak -> Quantify Cost -> Deploy 1 Core System.`,
        `Value-First Authority Funnel: Live Industry Breakdown -> Free PDF Playbook -> ${offer?.name || 'Core Offer'}.`,
        `Weekly Content Mix: 2 Pain-Point Hooks, 2 Visual Carousels, 1 Comment-to-PDF Giveaway.`,
      ],
      contrarianTruths: [
        `In ${niche}, copying surface-level tactics fails — solving the top 1 buyer objection creates 80% of trust.`,
        `Giving away your best checklist for free converts 4x better than hiding basic tips behind a paywall.`,
      ],
      scriptsAndProof: [
        ...(topNews.map((n) => `Live Signal: ${n.title} — turn into a 4-slide breakdown carousel.`) || []),
        `Giveaway CTA Script: "I condensed 25 hours of ${niche} research into a free PDF playbook. Comment '${offer?.giveawayKeyword || 'GUIDE'}' and I'll send it over."`,
      ].slice(0, 4),
      offerBridges: [
        `Embed ${offer?.name || 'your main Whop offer'} on Page 3 and the Final Action Page of every free PDF Playbook.`,
        `Attach an Auto-Plug reply 20 minutes after every high-value ${niche} thread pointing to your Smart Resource Page.`,
      ],
    },
  };
}

function buildLocalLeadMagnet(
  topic: string,
  format: LeadMagnet['format'],
  dossier: AuthorityDossier | undefined,
  offer: GhostPilotStore['brandBrain']['offers'][number] | undefined,
  account: GhostPilotStore['accounts'][number]
): LeadMagnet {
  const title = `The 2026 ${topic} ${format}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 46) +
    '-' +
    String(Date.now()).slice(-4);

  return {
    id: `lm-${Date.now()}`,
    slug,
    title,
    subtitle: `Step-by-step frameworks, buyer pain-point fixes, and plug-and-play scripts for ${topic}.`,
    format,
    niche: dossier?.niche || topic,
    themeColor: '#0284C7',
    authorName: account.name,
    authorHandle: account.handle,
    linkedOfferId: offer?.id,
    giveawayKeyword: offer?.giveawayKeyword || 'GUIDE',
    views: 0,
    downloads: 0,
    offerClicks: 0,
    createdAt: new Date().toISOString(),
    sections: [
      {
        id: `sec-${Date.now()}-1`,
        type: 'takeaway',
        heading: `Why Most People Fail at ${topic}`,
        body: `Instead of guessing, top operators anchor everything around real buyer pain points and repeatable daily execution.`,
        bullets: dossier?.angles.buyerPainPoints.slice(0, 3) || [
          'Skipping diagnosis and jumping straight to generic pitches',
          'Inconsistent execution without a measurable checklist',
        ],
      },
      {
        id: `sec-${Date.now()}-2`,
        type: 'framework',
        heading: `Core S-Tier ${topic} Frameworks`,
        body: 'Apply these proven mental models in sequence:',
        bullets: dossier?.angles.coreFrameworks.slice(0, 3) || [
          'Step 1: Isolate the single highest-cost bottleneck',
          'Step 2: Quantify the upside of solving it in 30 days',
          'Step 3: Execute with a repeatable 15-minute daily routine',
        ],
      },
      {
        id: `sec-${Date.now()}-3`,
        type: 'script',
        heading: 'Word-for-Word Templates & Proof',
        body: 'Copy and adapt these directly into your workflow today:',
        bullets: dossier?.angles.scriptsAndProof.slice(0, 3) || [
          'Lead with 1 specific observation instead of a generic intro.',
          'Offer a concrete free diagnostic before pitching any link.',
        ],
      },
      {
        id: `sec-${Date.now()}-4`,
        type: 'checklist',
        heading: '7-Day Execution Checklist',
        body: 'Check off each action item this week to lock in momentum:',
        bullets: [
          'Pick 1 high-pain buyer problem to solve publicly',
          'Share 1 visual carousel breaking down the exact mechanism',
          'Track replies and follow up with helpful clarity',
        ],
      },
      {
        id: `sec-${Date.now()}-5`,
        type: 'offer-callout',
        heading: offer ? `Next Step: ${offer.name}` : 'Recommended Next Step',
        body: offer?.promise || 'Ready to accelerate your results with full templates and live breakdowns?',
        bullets: [
          offer ? `Platform: ${offer.platform} (${offer.priceLabel})` : 'Complete step-by-step vault',
          'Direct access included via the button below',
        ],
      },
    ],
  };
}

function localGhostwriteTransform(
  action: 'rewrite' | 'finish' | 'expand-thread' | 'hooks' | 'tone-shift' | 'reply',
  text: string,
  niche: string
): string[] {
  const firstSentence = text.split(/[.!?\n]/)[0]?.trim() || text;
  if (action === 'expand-thread') {
    return [
      `Most people in ${niche} overlook this:\n\n${firstSentence}.\n\nHere is the exact 3-step breakdown (bookmark this thread) 🧵👇`,
      `1/ The Hidden Leak:\n\n${text.slice(0, 210)}`,
      `2/ What Top 1% Operators Do Instead:\n\nReplace guesswork with a simple daily checklist, measure 1 real metric, and document every win.`,
      `3/ Your 5-Minute Action Today:\n\nPick 1 bottleneck from above and fix it before tonight. Save this thread so you can revisit Step 2.`,
    ];
  }
  if (action === 'hooks') {
    return [
      `Stop guessing on ${niche}.\n\n${firstSentence} — and fixing this 1 detail changes your results in 14 days.\n\nHere's the exact breakdown 👇`,
    ];
  }
  if (action === 'finish') {
    return [
      `${text}\n\nThe exact 3-step shortcut:\n1. Diagnose the real bottleneck first\n2. Cut 80% of low-leverage busywork\n3. Turn every win into reusable proof\n\nSave this before your next sprint.`,
    ];
  }
  if (action === 'reply') {
    return [
      `Spot on — especially the diagnosis piece. Most people in ${niche} skip straight to tactics before isolating the real leak, which is why their conversion stalls.`,
    ];
  }
  return [
    `Unpopular truth in ${niche}:\n\n${firstSentence}.\n\nMost people do the opposite and wonder why results stall.\n\nFix this 1 habit first — save this as a reminder.`,
  ];
}

startServer().catch((err) => {
  console.error('Failed to start GhostPilot server:', err);
  process.exit(1);
});
