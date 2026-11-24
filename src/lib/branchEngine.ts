import { humanizeCopy } from './humanizer';
import type {
  AccountProfile,
  AuthorityDossier,
  BrandBrain,
  CapturedLead,
  LeadMagnet,
  MonetizationOffer,
  PostItem,
  RadarItem,
} from './types';

export type DueBranchAlertType = 'auto-plug' | 'auto-rt' | 'auto-unrt' | 'auto-delete';

export interface DueBranchAlert {
  type: DueBranchAlertType;
  label: string;
  delayLabel: string;
}

/**
 * Pure Tweet Hunter 6-Branch Post Automation Evaluator.
 * Determines which timed follow-up branch reminders are due for a published/delivered post
 * without ever double-firing an already-sent alert.
 */
export function evaluatePostBranchAlerts(
  post: PostItem,
  nowMs: number,
  options?: { defaultAutoPlugMinutes?: number }
): DueBranchAlert[] {
  if (post.status !== 'published') return [];
  const deliveredIso = post.telegramDeliveredAt || post.publishedAt;
  if (!deliveredIso) return [];
  const deliveredMs = new Date(deliveredIso).getTime();
  if (Number.isNaN(deliveredMs) || nowMs < deliveredMs) return [];

  const elapsedMs = nowMs - deliveredMs;
  const alerts: DueBranchAlert[] = [];

  if (
    post.automations.autoPlugEnabled &&
    post.automations.autoPlugText.trim() &&
    !post.telegramAutoPlugSent
  ) {
    const mins = Math.max(
      1,
      post.automations.autoPlugDelayMinutes || options?.defaultAutoPlugMinutes || 30
    );
    if (elapsedMs >= mins * 60 * 1000) {
      alerts.push({
        type: 'auto-plug',
        label: 'Auto-Plug Reply',
        delayLabel: `+${mins}m`,
      });
    }
  }

  if (post.automations.autoRetweetEnabled && !post.telegramAutoRtSent) {
    const hours = Math.max(1, post.automations.autoRetweetDelayHours || 8);
    if (elapsedMs >= hours * 60 * 60 * 1000) {
      alerts.push({
        type: 'auto-rt',
        label: 'Auto-Retweet Boost',
        delayLabel: `+${hours}h`,
      });
    }
  }

  if (
    post.automations.autoRetweetEnabled &&
    post.telegramAutoRtSent &&
    !post.telegramAutoUnrtSent &&
    (post.automations.autoUnretweetAfterHours || 0) > 0
  ) {
    const unrtHours = Math.max(
      (post.automations.autoRetweetDelayHours || 8) + 2,
      post.automations.autoUnretweetAfterHours || 24
    );
    if (elapsedMs >= unrtHours * 60 * 60 * 1000) {
      alerts.push({
        type: 'auto-unrt',
        label: 'Clean Up Retweet (Auto-UnRT)',
        delayLabel: `+${unrtHours}h`,
      });
    }
  }

  if (
    post.automations.autoDeleteEnabled &&
    !post.telegramAutoDeleteSent &&
    (post.automations.autoDeleteAfterHours || 0) > 0
  ) {
    const delHours = Math.max(1, post.automations.autoDeleteAfterHours || 48);
    if (elapsedMs >= delHours * 60 * 60 * 1000) {
      alerts.push({
        type: 'auto-delete',
        label: 'Low-Performer Cleanup (Auto-Delete)',
        delayLabel: `+${delHours}h`,
      });
    }
  }

  return alerts;
}

export interface FourStepDmMessage {
  step: 1 | 2 | 3 | 4;
  title: string;
  goal: string;
  timing: string;
  message: string;
}

/**
 * Generates the exact 4-Step Free-PDF-to-Affiliate-Group DM Closing Sequence.
 * Designed for natural, zero-spam conversations that convert giveaway commenters into
 * Affiliate Group members.
 */
export function buildFourStepAffiliateDmSequence(params: {
  magnet?: LeadMagnet;
  offer?: MonetizationOffer;
  niche: string;
  baseUrl?: string;
}): FourStepDmMessage[] {
  const { magnet, offer, niche, baseUrl } = params;
  const cleanBase = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const pdfTitle = magnet?.title || `${niche} Execution Playbook`;
  const pdfUrl = magnet ? `${cleanBase}/r/${magnet.slug}` : `${cleanBase}`;
  const keyword = magnet?.giveawayKeyword || 'GUIDE';
  const groupName = offer?.name || 'our private community';
  const groupUrl = offer?.url || 'https://whop.com';

  return [
    {
      step: 1,
      title: 'Step 1 · Deliver the Paid-Worth Freebie',
      goal: 'Instant goodwill & reciprocity — zero pitching in message 1.',
      timing: 'Immediately after they comment',
      message: `Hey! Saw your "${keyword}" comment — here is your free copy of "${pdfTitle}":\n\n${pdfUrl}\n\nStart with the 7-day checklist on page 4, that's the fastest win. Let me know once you've opened it!`,
    },
    {
      step: 2,
      title: 'Step 2 · Low-Friction Pain Question',
      goal: 'Start a real conversation and find their #1 bottleneck.',
      timing: '4–12 hours later (or right after they reply thanks)',
      message: `Quick question — out of everything in "${pdfTitle}", what is the main part of ${niche} you're trying to crack right now?`,
    },
    {
      step: 3,
      title: 'Step 3 · Diagnose & Mirror',
      goal: 'Prove competence by giving 1 sharp custom pointer before mentioning any link.',
      timing: 'After they share their bottleneck',
      message: `Totally makes sense — almost everyone gets stuck right there because they try to stitch random YouTube advice together alone. Fixing that 1 bottleneck with a proven daily template usually saves 2–3 months of trial and error.`,
    },
    {
      step: 4,
      title: 'Step 4 · Soft Affiliate Group Invite',
      goal: 'Recommend the Affiliate Group Offer like a helpful peer, zero pressure.',
      timing: 'Once they agree or ask how to speed it up',
      message: `If you want the exact templates, live teardowns, and people actually building this every day, I'd honestly look at ${groupName} (${offer?.priceLabel || 'group access'}).\n\nThat's the group I point beginners to when they want a real roadmap instead of guessing:\n${groupUrl}\n\nHappy to answer any quick questions about what's inside if you want!`,
    },
  ];
}

export interface ProfileFunnelKit {
  bioOptions: Array<{ angle: string; text: string; chars: number }>;
  bannerHeadline: string;
  bannerSubline: string;
  pinnedTweet: string;
}

/**
 * Generates an Alex Suzuki-style high-converting X Profile Funnel Kit
 * (Bio options under 160 chars, Banner copy, and a Pinned Giveaway Tweet).
 */
export function buildProfileFunnelKit(params: {
  account: AccountProfile;
  brain: BrandBrain;
  magnet?: LeadMagnet;
  offer?: MonetizationOffer;
  baseUrl?: string;
}): ProfileFunnelKit {
  const { brain, magnet, offer, baseUrl } = params;
  const niche = brain.niche || 'AI Automation';
  const cleanBase = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
  const pdfTitle = magnet?.title || `The ${niche} Playbook`;
  const pdfUrl = magnet ? `${cleanBase}/r/${magnet.slug}` : offer?.url || cleanBase;
  const keyword = magnet?.giveawayKeyword || offer?.giveawayKeyword || 'GUIDE';
  const groupName = offer?.name || 'our partner community';

  const trimToWordBoundary = (input: string, maxLen: number): string => {
    const clean = input.trim();
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > Math.floor(maxLen * 0.5) ? cut.slice(0, lastSpace) : cut).replace(/[:,\-–—&\s]+$/, '');
  };

  const shortPdf = trimToWordBoundary(pdfTitle, 34);
  const shortGroup = trimToWordBoundary(groupName, 28);

  const rawBios = [
    {
      angle: 'Free Value + Clear Promise',
      text: `Breaking down practical ${niche} systems you can run on a laptop.\nFree ${shortPdf} below ↓`,
    },
    {
      angle: 'Curator + Affiliate Group Bridge',
      text: `Daily ${niche} playbooks, prompts & teardowns (zero fluff).\nGrab my free PDF + ${shortGroup} link ↓`,
    },
    {
      angle: 'Zero-to-One Builder',
      text: `Documenting repeatable ${niche} workflows that actually work.\nBookmark my pinned playbook to start free today ↓`,
    },
  ];

  const bioOptions = rawBios.map((b) => {
    const humanized = humanizeCopy(b.text).cleanedText || b.text;
    const clean = trimToWordBoundary(humanized, 160);
    return { angle: b.angle, text: clean, chars: clean.length };
  });

  const pinnedTweet = humanizeCopy(
    `If you're trying to get real results with ${niche} without wasting months on vague advice, start here.\n\nI put together "${pdfTitle}" — completely free:\n\n• The exact system roadmap\n• 95% mistakes vs Top 1% playbook\n• Copy-paste scripts & 7-day checklist\n\nComment "${keyword}" and I'll reply with the link (or grab it straight from my bio: ${pdfUrl}).`
  ).cleanedText;

  return {
    bioOptions,
    bannerHeadline: `Practical ${niche} Systems. Zero Fluff.`,
    bannerSubline: `Follow for daily teardowns · Free Playbook in Bio`,
    pinnedTweet,
  };
}

export interface ValueReplySuggestion {
  id: string;
  angle: 'Practical Addition' | 'Contrarian Edge' | 'Sharp Question';
  text: string;
}

/**
 * Generates 3 non-sycophantic, high-signal Reply-Guy responses for 0-follower cold start.
 * Explicitly bans generic "Great post!" / "100% agree!" slop.
 */
export function buildValueReplySuggestions(params: {
  targetHandle: string;
  targetTopic: string;
  niche: string;
}): ValueReplySuggestion[] {
  const topic = (params.targetTopic || params.niche).trim();
  const niche = params.niche || 'this space';
  const shortTopic = topic.length > 90 ? `${topic.slice(0, 87)}...` : topic;

  const candidates: Array<{ angle: ValueReplySuggestion['angle']; raw: string }> = [
    {
      angle: 'Practical Addition',
      raw: `The piece most beginners miss on "${shortTopic}" is doing step 1 before automating anything. Once you map the bottleneck on one page, half the tools become unnecessary.`,
    },
    {
      angle: 'Contrarian Edge',
      raw: `Unpopular take in ${niche}: people obsess over complex setups when 80% of the result comes from repeating one simple 20-minute daily loop around this.`,
    },
    {
      angle: 'Sharp Question',
      raw: `Curious on your take here — for someone starting from zero in ${niche} today, would you tackle "${shortTopic.slice(0, 48)}" first or build distribution before touching it?`,
    },
  ];

  return candidates.map((c, idx) => ({
    id: `reply-${idx + 1}`,
    angle: c.angle,
    text: (humanizeCopy(c.raw).cleanedText || c.raw).slice(0, 260),
  }));
}

/**
 * Builds an authentic 7-section "Paid-Worth" Free PDF Playbook that reads like a $49-$97 product
 * rather than thin 3-bullet AI fluff, while naturally bridging to the user's Affiliate Group Offer.
 */
export function buildPaidWorthLeadMagnet(params: {
  topic: string;
  format: LeadMagnet['format'];
  dossier?: AuthorityDossier;
  offer?: MonetizationOffer;
  account: AccountProfile;
  niche?: string;
  requireEmailGate?: boolean;
}): LeadMagnet {
  const { topic, format, dossier, offer, account } = params;
  const niche = params.niche || dossier?.niche || account.brandBrain?.niche || topic;
  const cleanTopic = topic.trim() || niche;
  const title = `${cleanTopic}: The Complete ${format}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 46) +
    '-' +
    String(Date.now()).slice(-4);

  const now = Date.now();
  const groupName = offer?.name || 'Recommended Partner Community';

  return {
    id: `lm-${now}`,
    accountId: account.id,
    slug,
    title,
    subtitle: `A practical, step-by-step ${niche} field manual with diagnostic frameworks, copy-paste scripts, common trap fixes, and a 7-day execution checklist.`,
    format,
    niche,
    themeColor: '#0071E3',
    authorName: account.name,
    authorHandle: account.handle,
    linkedOfferId: offer?.id,
    giveawayKeyword: offer?.giveawayKeyword || 'PLAYBOOK',
    requireEmailGate: params.requireEmailGate ?? true,
    perceivedValueLabel: '$97 Value · Free Edition',
    views: 0,
    downloads: 0,
    offerClicks: 0,
    createdAt: new Date().toISOString(),
    sections: [
      {
        id: `sec-${now}-1`,
        type: 'takeaway',
        heading: `01. Executive Reality Check: Why Most ${cleanTopic} Attempts Stall`,
        body: `Most beginners jump straight into random tactics without isolating the single bottleneck holding back results in ${niche}. Before you install another tool or chase another trend, lock in these 4 non-negotiable truths:`,
        bullets: (dossier?.angles.buyerPainPoints.length
          ? dossier.angles.buyerPainPoints.slice(0, 4)
          : [
              `Mistake #1: Consuming 10 hours of scattered tutorials with zero written execution order.`,
              `Mistake #2: Copying big accounts' surface-level hooks instead of their underlying distribution system.`,
              `Mistake #3: Skipping proof and specificity — vague advice never earns bookmarks or DMs.`,
              `The Fix: Run one measurable 30-minute daily workflow for 14 straight days before tweaking variables.`,
            ]
        ).map((b) => humanizeCopy(b).cleanedText || b),
      },
      {
        id: `sec-${now}-2`,
        type: 'framework',
        heading: `02. The 4-Part ${cleanTopic} Operating System`,
        body: `Follow these four phases in strict sequence. Do not skip Phase 1 — every downstream conversion depends on getting your angle and offer alignment sharp first:`,
        bullets: (dossier?.angles.coreFrameworks.length
          ? dossier.angles.coreFrameworks.slice(0, 4)
          : [
              `Phase 1 (Signal Mining): Extract 5 real buyer complaints from active communities every Monday morning.`,
              `Phase 2 (Asset Packaging): Turn the #1 painful complaint into a focused, zero-fluff playbook or teardown.`,
              `Phase 3 (Distribution Loop): Pair 1 daily value post with 10 targeted replies under established ${niche} voices.`,
              `Phase 4 (Conversion Bridge): Deliver the free resource fast, ask 1 diagnostic question, and invite qualified leads to ${groupName}.`,
            ]
        ).map((b) => humanizeCopy(b).cleanedText || b),
      },
      {
        id: `sec-${now}-3`,
        type: 'comparison',
        heading: `03. What 95% Do Wrong vs. The Top 1% Playbook`,
        body: `Use this side-by-side audit table to spot leaks in your current ${niche} setup within 60 seconds:`,
        bullets: [
          `95% Approach: Post random AI-generated tips with zero follow-up -> Top 1% Approach: Publish 1 specific proof-backed breakdown with an Auto-Plug link 30 minutes later.`,
          `95% Approach: Give away thin 1-page summaries people forget -> Top 1% Approach: Deliver paid-grade checklists & scripts so readers immediately trust your recommendations.`,
          `95% Approach: Wait passively for followers at 0 audience -> Top 1% Approach: Spend 15 minutes daily adding sharp, contrarian replies under 10 big niche accounts.`,
          `95% Approach: Drop cold affiliate links in Tweet 1 (killed by the X link penalty) -> Top 1% Approach: Keep Tweet 1 link-free and route interested readers via reply or DM.`,
        ],
      },
      {
        id: `sec-${now}-4`,
        type: 'script',
        heading: `04. Word-for-Word Swipe File & Copy-Paste Prompts`,
        body: `Adapt these proven templates directly into your daily workflow — replace the bracketed placeholders with your exact ${niche} details:`,
        bullets: (dossier?.angles.scriptsAndProof.length
          ? [
              ...dossier.angles.scriptsAndProof.slice(0, 2),
              `Giveaway Hook: "I spent 20 hours mapping the exact ${cleanTopic} workflow so you don't have to guess. Comment '${offer?.giveawayKeyword || 'PLAYBOOK'}' and I'll send you the full checklist free."`,
              `DM Follow-Up: "Glad you grabbed it! Quick question — which step in the ${cleanTopic} checklist is the biggest bottleneck for you right now?"`,
            ]
          : [
              `Hook Formula: "Most people in ${niche} spend 10 hours a week on [low-leverage task]. Here is the 3-step system that cuts it to 30 minutes (bookmark this):"`,
              `Giveaway Post: "I built a step-by-step ${cleanTopic} field manual with exact prompts + 7-day checklist. Comment '${offer?.giveawayKeyword || 'PLAYBOOK'}' and I'll send it free."`,
              `Auto-Plug Reply (+30m): "If you want the full copy-paste templates from this breakdown, I put them in a free page here -> [Your Link]"`,
              `DM Diagnostic Bridge: "Out of the 4 phases in the guide, which one are you trying to get working first?"`,
            ]
        ).map((b) => humanizeCopy(b).cleanedText || b),
      },
      {
        id: `sec-${now}-5`,
        type: 'checklist',
        heading: `05. Your 7-Day Zero-Cost Execution Sprint`,
        body: `Print or save this page and check off one focused block per day for the next 7 days:`,
        bullets: [
          `Day 1: Tighten your X Bio (under 160 chars) + pin your strongest free resource post to the top of your profile.`,
          `Day 2: Build a list of 15 active ${niche} accounts (10k–200k followers) and leave 10 high-value replies.`,
          `Day 3: Publish 1 step-by-step thread breaking down a real mistake costing ${niche} beginners time or money.`,
          `Day 4: Post a 4-slide visual carousel summarizing Phase 1–4 from Section 02 above.`,
          `Day 5: Launch 1 Comment-to-PDF giveaway post and deliver the link fast to every commenter.`,
          `Day 6: Follow up with warm commenters using the Step 2 diagnostic question (zero hard pitch).`,
          `Day 7: Audit your top 2 posts by bookmarks & profile clicks, mark them Evergreen, and batch next week's queue.`,
        ],
      },
      {
        id: `sec-${now}-6`,
        type: 'worksheet',
        heading: `06. Troubleshooting Traps (When Results Feel Slow)`,
        body: `Every operator hits friction in Weeks 1–3. Diagnose the exact symptom below instead of quitting early:`,
        bullets: [
          `Low Views (<100 impressions)? You have a distribution problem, not a writing problem — double your daily Reply-Guy comments under big accounts for 7 days.`,
          `High Views, Low Bookmarks? Your hook worked, but the body was too abstract — add numbered steps, exact tool names, or copy-paste scripts.`,
          `Comments on Giveaway, Zero Link Clicks? Make your free resource preview concrete (show exact chapters & checklists) and send the link within 2 hours.`,
          `Clicks to ${groupName}, Low Conversions? Warm leads with a 2-message DM check-in first so they see why the community solves their exact bottleneck.`,
        ],
      },
      {
        id: `sec-${now}-7`,
        type: 'offer-callout',
        heading: offer
          ? `07. Ready to Go Faster? Inside ${offer.name}`
          : `07. Your Recommended Next Step`,
        body:
          offer?.promise ||
          `You can implement everything in this playbook solo for $0. When you want direct feedback, live teardowns, and accountability with operators executing in ${niche} every day, join our recommended group below.`,
        bullets: [
          offer
            ? `Partner Group Offer: ${offer.name} (${offer.priceLabel || 'Community Access'}) on ${offer.platform}`
            : `Full implementation community & live breakdowns`,
          `Direct step-by-step support so you avoid months of trial and error`,
          `Tap the button below to check current access details`,
        ],
      },
    ],
  };
}

export function validateLeadEmail(email: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, normalized, error: 'Enter your email address to unlock the full playbook.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    return { valid: false, normalized, error: 'Please enter a valid email address (e.g. you@domain.com).' };
  }
  return { valid: true, normalized };
}

function escapeCsvCell(value: string): string {
  const safe = String(value ?? '');
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportCapturedLeadsToCsv(leads: CapturedLead[]): string {
  const header = ['Email', 'Source PDF', 'Slug', 'Captured At'].join(',');
  const rows = leads.map((lead) =>
    [
      escapeCsvCell(lead.email),
      escapeCsvCell(lead.sourcePdfTitle),
      escapeCsvCell(lead.sourceSlug),
      escapeCsvCell(lead.capturedAt),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export interface BatchTopicPlan {
  topic: string;
  format: PostItem['format'];
  insight?: string;
}

/**
 * Generates a balanced 14-day Alex Suzuki-style batch topic plan mixing single authority posts,
 * step-by-step threads, giveaway hooks, and carousel teasers.
 */
export function buildBatchFourteenDayTopics(params: {
  niche: string;
  offerName?: string;
  radarItems: RadarItem[];
  dossier?: AuthorityDossier;
  count?: number;
}): BatchTopicPlan[] {
  const count = Math.max(1, Math.min(30, params.count || 14));
  const niche = params.niche || 'AI Automation';
  const offer = params.offerName || 'our recommended community';

  const baseTopics: BatchTopicPlan[] = [
    ...params.radarItems.slice(0, 6).map((r, i) => ({
      topic: r.title,
      format: (i % 3 === 0 ? 'thread' : 'single') as PostItem['format'],
      insight: r.summary,
    })),
    ...(params.dossier?.angles.buyerPainPoints.slice(0, 3).map((p) => ({
      topic: p,
      format: 'single' as PostItem['format'],
    })) || []),
    { topic: `The $0 laptop workflow for ${niche} beginners`, format: 'giveaway' },
    { topic: `5 mistakes keeping beginners stuck at 0 results in ${niche}`, format: 'thread' },
    { topic: `What 95% do wrong vs Top 1% in ${niche}`, format: 'carousel' },
    { topic: `How to replace expensive ${niche} subscriptions with a simple daily loop`, format: 'single' },
    { topic: `Free ${niche} checklist + exact swipe file (Comment to grab)`, format: 'giveaway' },
    { topic: `Why consistency beats complicated tools in ${niche}`, format: 'single' },
    { topic: `The 30-minute daily ${niche} routine anyone can stick to`, format: 'thread' },
    { topic: `Inside the exact ${niche} roadmap inside ${offer}`, format: 'single' },
    { topic: `Stop consuming ${niche} tutorials without this 1 filter`, format: 'single' },
    { topic: `My complete 7-day ${niche} starter sprint (Free PDF inside)`, format: 'giveaway' },
  ];

  const results: BatchTopicPlan[] = [];
  for (let i = 0; i < count; i++) {
    const item = baseTopics[i % baseTopics.length];
    results.push({ ...item });
  }
  return results;
}
