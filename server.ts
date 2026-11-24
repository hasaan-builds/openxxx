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
  setTelegramBotCommands,
} from './server/telegramClient';
import {
  buildXIntentUrl,
  formatAutoPlugReminderForTelegram,
  formatBranchAlertForTelegram,
  formatFourStepDmForTelegram,
  formatGiveawayPackForTelegram,
  formatPostForTelegram,
  formatReplyGuyPackForTelegram,
  validateTelegramCredentials,
} from './src/lib/telegramFormatter';
import {
  buildBatchFourteenDayTopics,
  buildFourStepAffiliateDmSequence,
  buildPaidWorthLeadMagnet,
  buildValueReplySuggestions,
  evaluatePostBranchAlerts,
  validateLeadEmail,
} from './src/lib/branchEngine';

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

    // 2. Full Tweet Hunter Post-Publish Branch Alerts (Auto-Plug, Auto-RT, Auto-UnRT, Auto-Delete)
    if (post.status === 'published' && tg?.enabled && tg.botToken && tg.chatId) {
      const dueAlerts = evaluatePostBranchAlerts(post, now, {
        defaultAutoPlugMinutes: tg.autoPlugDelayMinutes || 30,
      });

      for (const alert of dueAlerts) {
        if (alert.type === 'auto-plug' && !tg.autoPlugReminderEnabled) continue;
        try {
          const payload =
            alert.type === 'auto-plug'
              ? formatAutoPlugReminderForTelegram({ post, account })
              : formatBranchAlertForTelegram({
                  type: alert.type,
                  post,
                  account,
                  delayLabel: alert.delayLabel,
                });

          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: payload.text,
            replyMarkup: payload.replyMarkup,
          });

          if (alert.type === 'auto-plug') post.telegramAutoPlugSent = true;
          if (alert.type === 'auto-rt') post.telegramAutoRtSent = true;
          if (alert.type === 'auto-unrt') post.telegramAutoUnrtSent = true;
          if (alert.type === 'auto-delete') post.telegramAutoDeleteSent = true;
          processed++;

          store.automationLogs.unshift({
            id: `log-branch-${alert.type}-${Date.now()}-${processed}`,
            accountId: account.id,
            timestamp: new Date().toISOString(),
            type: alert.type,
            mode: 'live',
            postId: post.id,
            message: `Sent ${alert.label} (${alert.delayLabel}) to Telegram for ${account.handle}.`,
          });
        } catch {
          // Will retry on next scheduler tick
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

  // --- BRANCH 1: VIRAL TWEET LIBRARY 1-CLICK REMIX ---
  app.post('/api/viral/remix', async (req, res) => {
    try {
      const { viralText, hookFormula, scheduleNow = false } = req.body as {
        viralText?: string;
        hookFormula?: string;
        scheduleNow?: boolean;
      };
      if (!viralText?.trim()) {
        return res.status(400).json({ error: 'Provide a viral tweet to remix.' });
      }
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const offer = activeBrain.offers[0];

      let blocks: string[] = [];
      if (isGeminiConfigured()) {
        try {
          blocks = await ghostwriteWithGemini({
            action: 'rewrite',
            text: `Remix this proven viral structure (${hookFormula || 'viral hook'}) for the "${activeBrain.niche}" niche and subtly align it with "${offer?.name || 'our free playbook'}":\n\n${viralText.trim()}`,
            brandBrain: activeBrain,
          });
        } catch {
          // Fall back to deterministic local remix
        }
      }

      if (blocks.length === 0) {
        const cleanHook = viralText.trim().split('\n')[0].slice(0, 110);
        blocks = [
          humanizeCopy(
            `Everyone in ${activeBrain.niche} talks about tactics.\n\nHere is what actually moves the needle (inspired by "${cleanHook}"):\n\n1. Fix 1 painful beginner leak\n2. Give away a paid-grade checklist free\n3. Route warm leads into ${offer?.name || 'your main system'}\n\nSave this and run it for 14 days.`
          ).cleanedText,
        ];
      } else {
        blocks = blocks.map((b) => humanizeCopy(b).cleanedText || b);
      }

      let createdPost: PostItem | undefined;
      if (scheduleNow) {
        const scored = scoreCopy(blocks, { brandBrain: activeBrain });
        const slot = findNextOpenSlot(store.queueSlots, store.posts, new Date());
        createdPost = {
          id: `post-remix-${Date.now()}`,
          accountId: account.id,
          blocks,
          status: 'queued',
          format: blocks.length > 1 ? 'thread' : 'single',
          scheduledAt: slot,
          frameworkName: `Viral Remix (${hookFormula || 'Proven Hook'})`,
          predictiveScore: scored.total,
          automations: {
            threadDelayMinutes: 0,
            autoPlugEnabled: Boolean(offer?.autoPlugTemplate),
            autoPlugText: offer?.autoPlugTemplate || '',
            autoPlugDelayMinutes: store.globalAutomationDefaults.autoPlugDelayMinutes || 30,
            autoPlugMinLikes: 0,
            autoRetweetEnabled: store.globalAutomationDefaults.autoRetweetEnabled,
            autoRetweetDelayHours: store.globalAutomationDefaults.autoRetweetDelayHours || 8,
            autoUnretweetAfterHours: store.globalAutomationDefaults.autoUnretweetAfterHours || 24,
            autoDeleteEnabled: store.globalAutomationDefaults.autoDeleteEnabled,
            autoDeleteAfterHours: store.globalAutomationDefaults.autoDeleteAfterHours || 48,
            isEvergreen: true,
            evergreenIntervalDays: 14,
            linkedOfferId: offer?.id,
          },
          metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
          createdAt: new Date().toISOString(),
        };
        store.posts.unshift(createdPost);
        saveStore(store);
      }

      res.json({ blocks, post: createdPost, store });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Viral remix failed.' });
    }
  });

  // --- BRANCH 5: REPLY-GUY VALUE REPLY GENERATOR ---
  app.post('/api/engage/reply-suggestions', async (req, res) => {
    try {
      const { targetHandle = '@creator', targetTopic = '' } = req.body as {
        targetHandle?: string;
        targetTopic?: string;
      };
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;

      const replies = buildValueReplySuggestions({
        targetHandle,
        targetTopic: targetTopic.trim() || activeBrain.niche,
        niche: activeBrain.niche,
      });

      if (isGeminiConfigured() && targetTopic.trim()) {
        try {
          const aiBlocks = await ghostwriteWithGemini({
            action: 'reply',
            text: `Target ${targetHandle} posted about: "${targetTopic.trim()}". Write 1 sharp, non-sycophantic Reply-Guy comment adding genuine ${activeBrain.niche} insight (under 220 chars, zero "great post").`,
            brandBrain: activeBrain,
          });
          if (aiBlocks[0]) {
            replies[0] = {
              id: 'reply-ai-1',
              angle: 'Practical Addition',
              text: (humanizeCopy(aiBlocks[0]).cleanedText || aiBlocks[0]).slice(0, 250),
            };
            return res.json({ replies, engine: 'gemini-hybrid' });
          }
        } catch {
          // Local suggestions remain ready
        }
      }

      res.json({ replies, engine: 'local-reply-engine' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Reply generator failed.' });
    }
  });

  // --- APP 4: PAID-WORTH LEAD MAGNET STUDIO (7-CHAPTER PLAYBOOK + EMAIL-GATED SMART VAULT) ---
  app.post('/api/lead-magnets/generate', async (req, res) => {
    try {
      const {
        topic,
        format = 'Playbook',
        dossierId,
        offerId,
        requireEmailGate = true,
      } = req.body as {
        topic: string;
        format?: LeadMagnet['format'];
        dossierId?: string;
        offerId?: string;
        requireEmailGate?: boolean;
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

      const baseline = buildPaidWorthLeadMagnet({
        topic: topic || activeBrain.niche,
        format,
        dossier,
        offer,
        account,
        niche: activeBrain.niche,
        requireEmailGate,
      });

      let leadMagnet: LeadMagnet = baseline;
      let engine = 'paid-worth-local';
      let fallbackReason: string | undefined;

      if (isGeminiConfigured()) {
        try {
          const aiMagnet = await generateLeadMagnetWithGemini({
            topic: topic || activeBrain.niche,
            format,
            dossier,
            offer,
            brandBrain: activeBrain,
            authorName: account.name,
            authorHandle: account.handle,
          });
          // Merge Gemini's rich topic-specific sections with our guaranteed 7-chapter Paid-Worth structure
          const mergedSections = [
            ...aiMagnet.sections.slice(0, 4),
            ...baseline.sections.filter(
              (s) => s.type === 'comparison' || s.type === 'checklist' || s.type === 'worksheet' || s.type === 'offer-callout'
            ),
          ].slice(0, 7);
          leadMagnet = {
            ...aiMagnet,
            requireEmailGate,
            perceivedValueLabel: '$97 Value · Free Edition',
            sections: mergedSections.length >= 6 ? mergedSections : baseline.sections,
          };
          engine = 'gemini-paid-worth';
        } catch (err) {
          fallbackReason = err instanceof Error ? err.message : 'Gemini call failed';
          console.error('[GhostPilot] LeadMagnet Gemini error:', fallbackReason);
        }
      }

      leadMagnet.accountId = store.activeAccountId;
      store.leadMagnets.unshift(leadMagnet);
      saveStore(store);
      res.json({ leadMagnet, engine, fallbackReason });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate lead magnet.' });
    }
  });

  // Email Lead Capture Endpoint for Hosted Paid-Worth Vault (/r/:slug/capture)
  app.post('/r/:slug/capture', (req, res) => {
    const store = loadStore();
    const magnet = store.leadMagnets.find((m) => m.slug === req.params.slug);
    if (!magnet) {
      return res.status(404).json({ error: 'Resource not found.' });
    }
    const { email } = req.body as { email?: string };
    const check = validateLeadEmail(email || '');
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    if (!Array.isArray(store.capturedLeads)) {
      store.capturedLeads = [];
    }
    const alreadyExists = store.capturedLeads.some(
      (l) => l.email === check.normalized && l.sourcePdfId === magnet.id
    );
    if (!alreadyExists) {
      store.capturedLeads.unshift({
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: magnet.accountId || store.activeAccountId,
        email: check.normalized,
        sourcePdfId: magnet.id,
        sourcePdfTitle: magnet.title,
        sourceSlug: magnet.slug,
        capturedAt: new Date().toISOString(),
      });
    }
    magnet.downloads += 1;

    const allOffers = [
      ...store.brandBrain.offers,
      ...store.accounts.flatMap((a) => a.brandBrain?.offers || []),
    ];
    const offer = allOffers.find((o) => o.id === magnet.linkedOfferId);
    if (offer) {
      offer.leads += 1;
    }

    saveStore(store);
    res.json({ ok: true, unlocked: true, email: check.normalized });
  });

  // Hosted Paid-Worth Smart Resource Vault (/r/:slug) — With Optional $0 Email Capture Gate
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
    const gateActive = Boolean(magnet.requireEmailGate);
    const tocListHtml = magnet.sections
      .map((sec, idx) => `<li><strong>0${idx + 1}.</strong> ${escapeHtml(sec.heading.replace(/^0?\d+\.\s*/, ''))}</li>`)
      .join('');

    const sectionsHtml = magnet.sections
      .map(
        (sec, idx) => `
      <section class="card ${sec.type === 'offer-callout' ? 'card-offer' : ''} ${sec.type === 'comparison' ? 'card-compare' : ''}">
        <div class="kicker">Chapter 0${idx + 1} · ${escapeHtml(sec.type.replace('-', ' '))}</div>
        <h2>${escapeHtml(sec.heading)}</h2>
        <p>${escapeHtml(sec.body)}</p>
        ${
          sec.bullets.length
            ? `<ul class="${sec.type === 'checklist' ? 'checklist' : ''}">${sec.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
            : ''
        }
      </section>`
      )
      .join('');

    const offerHtml = offer
      ? `<div class="cta-banner">
          <div class="kicker">Recommended Affiliate Group · ${escapeHtml(offer.platform)}</div>
          <h2>${escapeHtml(offer.name)}</h2>
          <p>${escapeHtml(offer.promise)}</p>
          <a class="cta-btn" href="/r/${escapeHtml(magnet.slug)}/go" target="_blank" rel="noopener noreferrer">
            Explore ${escapeHtml(offer.name)} (${escapeHtml(offer.priceLabel)}) →
          </a>
        </div>`
      : '';

    const gateHtml = gateActive
      ? `<section id="email-gate-card" class="card gate-card">
          <div class="kicker">${escapeHtml(magnet.perceivedValueLabel || '$97 Value · Free Edition')} · Instant Unlock</div>
          <h2>Unlock All ${magnet.sections.length} Chapters + Copy-Paste Templates Free</h2>
          <p>Inside this complete ${escapeHtml(magnet.format.toLowerCase())}:</p>
          <ul class="toc-list">${tocListHtml}</ul>
          <form id="lead-capture-form" class="gate-form">
            <label for="lead-email" class="sr-only">Email address</label>
            <input id="lead-email" name="email" type="email" required placeholder="Enter your best email to unlock instantly..." />
            <button type="submit" id="lead-submit-btn">Unlock Full Playbook Free →</button>
          </form>
          <p id="lead-error" class="gate-error" role="alert"></p>
          <p class="gate-note">100% free · Instant browser unlock + print-ready PDF · Zero spam.</p>
        </section>`
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
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    .hero { background: #FFFFFF; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 64px 24px 56px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .kicker { font-size: 13px; font-weight: 600; color: #0071E3; margin-bottom: 10px; letter-spacing: -0.01em; }
    h1 { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: clamp(30px, 5vw, 46px); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 16px; color: #1D1D1F; }
    h2 { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 21px; letter-spacing: -0.02em; margin: 0 0 10px; line-height: 1.25; }
    .sub { color: #515154; font-size: 17px; max-width: 640px; margin: 0 0 22px; line-height: 1.5; }
    .meta { font-size: 13px; color: #6E6E73; }
    .content { padding: 36px 24px 88px; }
    .card { background: #FFFFFF; border: 1px solid rgba(0,0,0,0.06); border-radius: 20px; padding: 30px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 12px 32px -18px rgba(0,0,0,0.08); }
    .card-offer { background: #F0F7FF; border-color: rgba(0,113,227,0.18); }
    .card-compare { background: #FAFAFC; }
    .gate-card { border-color: rgba(0,113,227,0.25); }
    ul { padding-left: 20px; margin: 14px 0 0; }
    li { margin-bottom: 9px; color: #3A3A3C; }
    .toc-list { list-style: none; padding-left: 0; margin: 14px 0 22px; }
    .toc-list li { padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 14px; }
    .checklist { list-style: none; padding-left: 0; }
    .checklist li::before { content: '☐  '; color: #0071E3; font-weight: 700; }
    .gate-form { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .gate-form input { flex: 1; min-width: 220px; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.14); font-size: 15px; font-family: inherit; }
    .gate-form button { background: #0071E3; color: #fff; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit; }
    .gate-form button:hover { background: #0077ED; }
    .gate-error { color: #DC2626; font-size: 13px; margin: 10px 0 0; min-height: 18px; }
    .gate-note { color: #6E6E73; font-size: 12px; margin: 8px 0 0; }
    .hidden { display: none; }
    .cta-banner { background: #1D1D1F; color: #F5F5F7; border-radius: 24px; padding: 36px; margin-top: 28px; }
    .cta-banner .kicker { color: #2997FF; }
    .cta-banner p { color: #A1A1A6; }
    .cta-btn { display: inline-block; margin-top: 16px; background: #0071E3; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 13px 24px; border-radius: 999px; }
    .cta-btn:hover { background: #0077ED; }
    .toolbar { display: flex; gap: 12px; margin-top: 22px; }
    .btn-ghost { background: rgba(0,0,0,0.05); color: #1D1D1F; border: none; padding: 10px 18px; border-radius: 999px; cursor: pointer; font-weight: 600; font-family: inherit; }
    .btn-ghost:hover { background: rgba(0,0,0,0.09); }
    @media print { .toolbar, #email-gate-card { display: none; } body { background: #fff; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <header class="hero">
    <div class="wrap">
      <div class="kicker">${escapeHtml(magnet.format)} · ${escapeHtml(magnet.niche)} · ${escapeHtml(magnet.perceivedValueLabel || '$97 Value · Free Edition')}</div>
      <h1>${escapeHtml(magnet.title)}</h1>
      <p class="sub">${escapeHtml(magnet.subtitle)}</p>
      <div class="meta">By ${escapeHtml(magnet.authorName)} (${escapeHtml(magnet.authorHandle)}) · ${magnet.sections.length} chapters · ${magnet.views.toLocaleString()} views</div>
      <div id="print-toolbar" class="toolbar ${gateActive ? 'hidden' : ''}">
        <button class="btn-ghost" onclick="window.print()">Print or Save Full Playbook as PDF</button>
      </div>
    </div>
  </header>
  <main class="content">
    <div class="wrap">
      ${gateHtml}
      <div id="playbook-body" class="${gateActive ? 'hidden' : ''}">
        ${sectionsHtml}
        ${offerHtml}
      </div>
    </div>
  </main>
  ${
    gateActive
      ? `<script>
    (function() {
      var slug = ${JSON.stringify(magnet.slug)};
      var key = 'gp_unlocked_' + slug;
      var gate = document.getElementById('email-gate-card');
      var body = document.getElementById('playbook-body');
      var toolbar = document.getElementById('print-toolbar');
      function unlock() {
        if (gate) gate.classList.add('hidden');
        if (body) body.classList.remove('hidden');
        if (toolbar) toolbar.classList.remove('hidden');
      }
      try { if (localStorage.getItem(key) === '1') unlock(); } catch (e) {}
      var form = document.getElementById('lead-capture-form');
      if (!form) return;
      form.addEventListener('submit', async function(ev) {
        ev.preventDefault();
        var input = document.getElementById('lead-email');
        var errEl = document.getElementById('lead-error');
        var btn = document.getElementById('lead-submit-btn');
        errEl.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Unlocking...';
        try {
          var res = await fetch('/r/' + encodeURIComponent(slug) + '/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: input.value })
          });
          var data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not unlock.');
          try { localStorage.setItem(key, '1'); } catch (e) {}
          unlock();
        } catch (err) {
          errEl.textContent = err.message || 'Please enter a valid email.';
          btn.disabled = false;
          btn.textContent = 'Unlock Full Playbook Free →';
        }
      });
    })();
  </script>`
      : ''
  }
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

  let telegramPollerBusy = false;

  async function processTelegramInboxAndAutoPair(originUrl?: string): Promise<{
    checked: number;
    createdPosts: number;
    autoPaired?: boolean;
    store: GhostPilotStore;
  }> {
    const store = loadStore();
    const account =
      store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
    const activeBrain = account?.brandBrain || store.brandBrain;
    const tg = resolveTelegramConfig(store, account?.id);
    if (!tg?.botToken) {
      throw new Error('Connect your Telegram Bot Token first.');
    }

    const origin =
      originUrl ||
      process.env.APP_URL ||
      'http://localhost:3000';

    // Auto-pair Chat ID the instant the user taps Start or sends "hi" to their bot!
    if (!tg.chatId) {
      try {
        const detected = await detectTelegramChatId(tg.botToken);
        tg.chatId = detected.chatId;
        tg.botUsername = detected.botUsername;
        tg.enabled = true;
        tg.twoWayInboxEnabled = true;
        tg.autoPlugReminderEnabled = true;
        tg.lastUpdateId = detected.lastUpdateId;
        if (store.telegramConfig) {
          store.telegramConfig = { ...store.telegramConfig, ...tg };
        } else {
          store.telegramConfig = { ...tg };
        }
        saveStore(store);

        await setTelegramBotCommands(tg.botToken).catch(() => undefined);
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: [
            `<b>GhostPilot $0 Autopilot Connected!</b>`,
            '',
            `Active X Account: <b>${account.handle}</b> (${activeBrain.niche})`,
            `Chat ID <code>${tg.chatId}</code> auto-paired with zero setup!`,
            '',
            `<b>Try any command right here:</b>`,
            `• <code>/today</code> — Get your next post + 1-tap Post on X button`,
            `• <code>/ideas</code> — Scan 7 live $0 sources for fresh ideas`,
            `• <code>/pdf your topic</code> — Build a Free PDF + Giveaway Reply Pack`,
            `• <code>/stats</code> — Queue count & schedule`,
            `• Or paste <b>any YouTube / Whop / article link</b> to turn it into a tweet!`,
          ].join('\n'),
        });

        const firstQueued = store.posts
          .filter((p) => (!p.accountId || p.accountId === account.id) && p.status === 'queued')
          .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))[0];
        if (firstQueued) {
          const sample = formatPostForTelegram({ post: firstQueued, account, baseUrl: origin });
          await sendTelegramMessage({
            botToken: tg.botToken,
            chatId: tg.chatId,
            text: `<b>Here is your next ready post (tap below to post on X for $0):</b>\n\n${sample.text}`,
            replyMarkup: sample.replyMarkup,
          });
        }
        return { checked: 1, createdPosts: 0, autoPaired: true, store };
      } catch {
        return { checked: 0, createdPosts: 0, autoPaired: false, store };
      }
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

    for (const msg of messages.slice(0, 4)) {
      const trimmed = msg.text.trim();
      const lower = trimmed.toLowerCase();

      // Slash Command: /help or /start
      if (lower === '/help' || lower === '/start') {
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: [
            `<b>GhostPilot $0 TweetHunter Commands</b> (${account.handle})`,
            '',
            `• <code>/today</code> — Send your next queued post + 1-tap X button`,
            `• <code>/ideas</code> — Pull live 7-source ideas for ${activeBrain.niche}`,
            `• <code>/pdf your topic</code> — Build a 7-Chapter Paid-Worth PDF + Giveaway Pack`,
            `• <code>/replies</code> — Get today's Reply-Guy targets + 3 value replies`,
            `• <code>/dm</code> — Get your 4-Step Free-PDF to Affiliate Group DM scripts`,
            `• <code>/stats</code> — View queue, PDFs, captured email leads & affiliate clicks`,
            `• <b>Paste any URL</b> (YouTube, Whop, article, GitHub) — Auto-converts into a humanized tweet!`,
          ].join('\n'),
        });
        continue;
      }

      // Slash Command: /stats
      if (lower === '/stats') {
        const accPosts = store.posts.filter((p) => !p.accountId || p.accountId === account.id);
        const ready = accPosts.filter((p) => p.status === 'queued' || p.status === 'draft').length;
        const accPdfs = store.leadMagnets.filter((m) => !m.accountId || m.accountId === account.id);
        const accLeads = (store.capturedLeads || []).filter((l) => !l.accountId || l.accountId === account.id).length;
        const affiliateClicks = accPdfs.reduce((sum, m) => sum + (m.offerClicks || 0), 0);
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: `<b>GhostPilot Status · ${account.handle}</b>\n\n• Niche: ${activeBrain.niche}\n• Ready Posts in Queue: <b>${ready}</b>\n• Paid-Worth Free PDFs: <b>${accPdfs.length}</b>\n• Captured Email Leads: <b>${accLeads}</b>\n• Affiliate Group Clicks: <b>${affiliateClicks}</b>\n• Drop Times: ${Array.from(new Set(store.queueSlots.map((s) => s.time))).join(', ')}`,
        });
        continue;
      }

      // Slash Command: /replies
      if (lower === '/replies') {
        const accContacts = store.crmContacts.filter((c) => !c.accountId || c.accountId === account.id);
        const sampleReplies = buildValueReplySuggestions({
          targetHandle: accContacts[0]?.handle || '@creator',
          targetTopic: accContacts[0]?.latestTweet || activeBrain.niche,
          niche: activeBrain.niche,
        });
        const pack = formatReplyGuyPackForTelegram({
          account,
          niche: activeBrain.niche,
          targets: accContacts,
          sampleReplies,
        });
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: pack.text,
          replyMarkup: pack.replyMarkup,
        });
        continue;
      }

      // Slash Command: /dm
      if (lower === '/dm') {
        const accMagnet = store.leadMagnets.find((m) => !m.accountId || m.accountId === account.id);
        const offer = activeBrain.offers[0];
        const steps = buildFourStepAffiliateDmSequence({
          magnet: accMagnet,
          offer,
          niche: activeBrain.niche,
          baseUrl: origin,
        });
        const dmPack = formatFourStepDmForTelegram({ account, steps });
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: dmPack.text,
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
            text: `No queued posts for ${account.handle} yet. Text me any URL or tap "Batch 14 Posts ($0)" in GhostPilot!`,
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
        const newMagnet = buildPaidWorthLeadMagnet({
          topic: pdfTopic,
          format: 'Playbook',
          dossier: store.dossiers[0],
          offer,
          account,
          niche: activeBrain.niche,
          requireEmailGate: true,
        });
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
          text: `<b>Built your 7-Chapter Paid-Worth Free PDF + Giveaway Pack ($0)!</b>\n\n${pack.text}`,
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

    if (messages.length > 0 || typeof nextUpdateId === 'number') {
      saveStore(store);
    }
    return { checked: messages.length, createdPosts, store };
  }

  app.post('/api/telegram/poll-inbox', async (req, res) => {
    try {
      const origin =
        (typeof req.body?.origin === 'string' && req.body.origin) ||
        process.env.APP_URL ||
        'http://localhost:3000';
      const result = await processTelegramInboxAndAutoPair(origin);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not check Telegram inbox.',
      });
    }
  });

  app.post('/api/telegram/send-branch-pack', async (req, res) => {
    try {
      const { pack, origin } = req.body as { pack?: 'replies' | 'dm'; origin?: string };
      const store = loadStore();
      const account =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const activeBrain = account?.brandBrain || store.brandBrain;
      const tg = resolveTelegramConfig(store, account?.id);
      if (!tg?.botToken || !tg?.chatId) {
        return res.status(400).json({
          error: 'Connect your free Telegram Bot first under Accounts & Telegram (takes 30 seconds).',
        });
      }

      const cleanOrigin = origin || process.env.APP_URL || 'http://localhost:3000';
      if (pack === 'replies') {
        const accContacts = store.crmContacts.filter(
          (c) => !c.accountId || c.accountId === account.id
        );
        const sampleReplies = buildValueReplySuggestions({
          targetHandle: accContacts[0]?.handle || '@creator',
          targetTopic: accContacts[0]?.latestTweet || activeBrain.niche,
          niche: activeBrain.niche,
        });
        const formatted = formatReplyGuyPackForTelegram({
          account,
          niche: activeBrain.niche,
          targets: accContacts,
          sampleReplies,
        });
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: formatted.text,
          replyMarkup: formatted.replyMarkup,
        });
      } else {
        const accMagnet = store.leadMagnets.find(
          (m) => !m.accountId || m.accountId === account.id
        );
        const offer = activeBrain.offers[0];
        const steps = buildFourStepAffiliateDmSequence({
          magnet: accMagnet,
          offer,
          niche: activeBrain.niche,
          baseUrl: cleanOrigin,
        });
        const formatted = formatFourStepDmForTelegram({ account, steps });
        await sendTelegramMessage({
          botToken: tg.botToken,
          chatId: tg.chatId,
          text: formatted.text,
        });
      }

      tg.lastSentAt = new Date().toISOString();
      saveStore(store);
      res.json({ ok: true, store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not send pack to Telegram.',
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

  // Built-in <1s $0 Local Turbo & 14-Day Batch Runner — works 100% offline/locally
  app.post('/api/antigravity/run-local-turbo', (req, res) => {
    const { goal, count = 4 } = req.body as { goal?: string; count?: number };
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

    const safeCount = Math.max(1, Math.min(30, Number(count) || 4));
    const batchPlans = buildBatchFourteenDayTopics({
      niche: activeBrain.niche,
      offerName: offer?.name,
      radarItems: accountRadar,
      dossier: accountDossier,
      count: safeCount,
    });

    const cleanGoal = (goal || '').trim();
    const isMetaPrompt = /^(create|write|generate|make)\s+(ready-to-post|daily|viral)?\s*(tweets|posts|threads)/i.test(
      cleanGoal
    );
    if (cleanGoal && !isMetaPrompt && cleanGoal.length <= 90 && batchPlans.length > 0) {
      batchPlans[0] = { topic: cleanGoal, format: 'giveaway' };
    }

    const generatedPosts = batchPlans.map((plan, idx) => {
      const ranked = buildRankedABVariations({
        topic: plan.topic,
        keyInsight:
          plan.insight ||
          accountDossier?.angles.coreFrameworks[
            idx % Math.max(1, accountDossier?.angles.coreFrameworks.length || 1)
          ],
        brandBrain: activeBrain,
        persona,
        offer,
      });
      const winner = ranked[idx % Math.max(1, ranked.length)] || ranked[0];
      const humanized = winner.blocks.map((b) => humanizeCopy(b).cleanedText || b);
      return {
        blocks: humanized,
        format: plan.format,
        frameworkName: `${winner.frameworkName} (${safeCount >= 14 ? '14-Day Batch' : 'Local Turbo'})`,
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

  // Start 8-second live Two-Way Telegram Bot Auto-Pair & Slash-Command Poller ($0)
  setInterval(() => {
    if (telegramPollerBusy) return;
    const st = loadStore();
    const tg = resolveTelegramConfig(st, st.activeAccountId);
    if (!tg?.botToken) return;
    if (tg.chatId && tg.twoWayInboxEnabled === false) return;
    telegramPollerBusy = true;
    void processTelegramInboxAndAutoPair(process.env.APP_URL)
      .catch(() => undefined)
      .finally(() => {
        telegramPollerBusy = false;
      });
  }, 8 * 1000);

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
