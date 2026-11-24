import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBatchFourteenDayTopics,
  buildFourStepAffiliateDmSequence,
  buildPaidWorthLeadMagnet,
  buildProfileFunnelKit,
  buildValueReplySuggestions,
  evaluatePostBranchAlerts,
  exportCapturedLeadsToCsv,
  validateLeadEmail,
} from './branchEngine';
import type { AccountProfile, BrandBrain, PostItem } from './types';

const sampleAccount: AccountProfile = {
  id: 'acc-1',
  name: 'Alex Test',
  handle: '@alextest',
  bio: '',
  avatarUrl: '',
  followers: 42,
  verified: false,
  isPremium: false,
  xConnected: false,
  xMode: 'sandbox',
};

const sampleBrain: BrandBrain = {
  niche: 'AI Tools & Automation',
  subNiches: ['No-Code Workflows'],
  subreddits: ['automation'],
  customRssUrls: [],
  tone: 'Direct',
  voiceRules: [],
  bannedCliches: ['delve'],
  winningPhrases: [],
  weeklyMix: { singlePosts: 5, threads: 2, carousels: 2, giveaways: 2 },
  personas: [],
  activePersonaId: '',
  offers: [
    {
      id: 'off-1',
      name: 'AI Builders Guild',
      platform: 'Whop',
      url: 'https://whop.com/ai-builders',
      priceLabel: '$49/mo Affiliate',
      promise: 'Weekly AI workflows and live group breakdowns.',
      autoPlugTemplate: 'Join AI Builders Guild here: https://whop.com/ai-builders',
      giveawayKeyword: 'WORKFLOW',
      clicks: 0,
      leads: 0,
      estimatedRevenue: 0,
    },
  ],
};

function makePublishedPost(overrides: Partial<PostItem> = {}): PostItem {
  const deliveredAt = '2026-11-23T10:00:00.000Z';
  return {
    id: 'post-1',
    accountId: 'acc-1',
    blocks: ['Here is a real system for AI automation.'],
    status: 'published',
    format: 'single',
    publishedAt: deliveredAt,
    telegramDeliveredAt: deliveredAt,
    predictiveScore: 90,
    automations: {
      threadDelayMinutes: 0,
      autoPlugEnabled: true,
      autoPlugText: 'Grab the free playbook here: https://example.com/r/guide',
      autoPlugDelayMinutes: 30,
      autoPlugMinLikes: 0,
      autoRetweetEnabled: true,
      autoRetweetDelayHours: 8,
      autoUnretweetAfterHours: 24,
      autoDeleteEnabled: true,
      autoDeleteAfterHours: 48,
      isEvergreen: true,
      evergreenIntervalDays: 14,
    },
    metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
    createdAt: deliveredAt,
    ...overrides,
  };
}

test('evaluatePostBranchAlerts fires Auto-Plug, Auto-RT, Auto-UnRT, and Auto-Delete in exact sequence without double-firing', () => {
  const baseMs = new Date('2026-11-23T10:00:00.000Z').getTime();
  const post = makePublishedPost();

  // At +15m: nothing due yet
  assert.equal(evaluatePostBranchAlerts(post, baseMs + 15 * 60_000).length, 0);

  // At +31m: Auto-Plug fires
  const at31m = evaluatePostBranchAlerts(post, baseMs + 31 * 60_000);
  assert.deepEqual(at31m.map((a) => a.type), ['auto-plug']);

  // Mark Auto-Plug sent -> at +8h1m: Auto-RT fires, Auto-Plug does NOT repeat
  post.telegramAutoPlugSent = true;
  const at8h = evaluatePostBranchAlerts(post, baseMs + 8 * 3600_000 + 60_000);
  assert.deepEqual(at8h.map((a) => a.type), ['auto-rt']);

  // Mark Auto-RT sent -> at +25h: Auto-UnRT fires
  post.telegramAutoRtSent = true;
  const at25h = evaluatePostBranchAlerts(post, baseMs + 25 * 3600_000);
  assert.deepEqual(at25h.map((a) => a.type), ['auto-unrt']);

  // Mark Auto-UnRT sent -> at +49h: Auto-Delete fires
  post.telegramAutoUnrtSent = true;
  const at49h = evaluatePostBranchAlerts(post, baseMs + 49 * 3600_000);
  assert.deepEqual(at49h.map((a) => a.type), ['auto-delete']);

  // Once all sent -> zero alerts
  post.telegramAutoDeleteSent = true;
  assert.equal(evaluatePostBranchAlerts(post, baseMs + 96 * 3600_000).length, 0);
});

test('buildPaidWorthLeadMagnet builds 7 structured paid-grade sections with email gate enabled by default', () => {
  const magnet = buildPaidWorthLeadMagnet({
    topic: 'Local AI Lead Engine',
    format: 'Playbook',
    offer: sampleBrain.offers[0],
    account: sampleAccount,
    niche: sampleBrain.niche,
  });

  assert.equal(magnet.sections.length, 7);
  assert.equal(magnet.requireEmailGate, true);
  assert.ok(magnet.sections.some((s) => s.type === 'comparison'));
  assert.ok(magnet.sections.some((s) => s.type === 'checklist'));
  assert.ok(magnet.sections.some((s) => s.type === 'script'));
  assert.ok(magnet.sections.some((s) => s.type === 'offer-callout'));
});

test('buildFourStepAffiliateDmSequence keeps Message 1 pitch-free and Message 4 bridging to Affiliate Group', () => {
  const magnet = buildPaidWorthLeadMagnet({
    topic: 'AI Playbook',
    format: 'Playbook',
    offer: sampleBrain.offers[0],
    account: sampleAccount,
  });
  const steps = buildFourStepAffiliateDmSequence({
    magnet,
    offer: sampleBrain.offers[0],
    niche: sampleBrain.niche,
    baseUrl: 'https://demo.local',
  });

  assert.equal(steps.length, 4);
  assert.ok(steps[0].message.includes(`/r/${magnet.slug}`));
  assert.ok(!steps[0].message.includes('https://whop.com/ai-builders'));
  assert.ok(steps[3].message.includes('https://whop.com/ai-builders'));
});

test('buildProfileFunnelKit respects X 160-character bio limit and builds pinned giveaway tweet', () => {
  const kit = buildProfileFunnelKit({
    account: sampleAccount,
    brain: sampleBrain,
    offer: sampleBrain.offers[0],
  });
  assert.equal(kit.bioOptions.length, 3);
  for (const bio of kit.bioOptions) {
    assert.ok(bio.chars <= 160);
    assert.ok(bio.text.length > 20);
  }
  assert.ok(kit.pinnedTweet.includes('WORKFLOW'));
});

test('buildValueReplySuggestions generates 3 non-generic human replies under 260 chars', () => {
  const replies = buildValueReplySuggestions({
    targetHandle: '@bigcreator',
    targetTopic: 'Building a $0 AI workflow on a laptop',
    niche: 'AI Automation',
  });
  assert.equal(replies.length, 3);
  for (const r of replies) {
    assert.ok(r.text.length > 30 && r.text.length <= 260);
    assert.ok(!/great post|100% agree/i.test(r.text));
  }
});

test('validateLeadEmail and exportCapturedLeadsToCsv handle validation and RFC-4180 escaping', () => {
  assert.equal(validateLeadEmail('').valid, false);
  assert.equal(validateLeadEmail('not-an-email').valid, false);
  const ok = validateLeadEmail('  Lead.User@Example.COM ');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'lead.user@example.com');

  const csv = exportCapturedLeadsToCsv([
    {
      id: 'l-1',
      email: 'lead@example.com',
      sourcePdfTitle: 'The "Complete", 7-Day Playbook',
      sourceSlug: 'playbook-1234',
      sourcePdfId: 'lm-1',
      capturedAt: '2026-11-23T12:00:00.000Z',
    },
  ]);
  assert.ok(csv.startsWith('Email,Source PDF,Slug,Captured At\n'));
  assert.ok(csv.includes('"The ""Complete"", 7-Day Playbook"'));
});

test('buildBatchFourteenDayTopics returns exact requested count with varied formats', () => {
  const plan = buildBatchFourteenDayTopics({
    niche: 'AI Automation',
    offerName: 'AI Builders Guild',
    radarItems: [],
    count: 14,
  });
  assert.equal(plan.length, 14);
  const formats = new Set(plan.map((p) => p.format));
  assert.ok(formats.has('giveaway'));
  assert.ok(formats.has('thread'));
  assert.ok(formats.has('single'));
});
