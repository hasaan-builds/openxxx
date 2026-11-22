import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../server/seedData';
import {
  computeAccountJourneyProgress,
  mergeScopedPatchIntoStore,
  scopeStoreToAccount,
} from './accountScope';

test('scopeStoreToAccount isolates posts, PDFs, radar, and CRM strictly per Twitter account', () => {
  const full = createInitialStore();

  const primaryScoped = scopeStoreToAccount(full, 'acc-primary');
  const secondaryScoped = scopeStoreToAccount(full, 'acc-secondary');

  // Primary account owns the seeded High-Ticket Sales assets
  assert.ok(primaryScoped.leadMagnets.length > 0);
  assert.ok(primaryScoped.radarItems.length > 0);
  assert.ok(primaryScoped.posts.length > 0);

  // Secondary AI account starts clean with zero leaked High-Ticket Sales assets
  assert.equal(secondaryScoped.leadMagnets.length, 0);
  assert.equal(secondaryScoped.radarItems.length, 0);
  assert.equal(secondaryScoped.posts.length, 0);
  assert.ok(secondaryScoped.queueSlots.length >= 6);
  assert.equal(secondaryScoped.brandBrain.niche, 'AI Agents & Vibe Coding');
});

test('mergeScopedPatchIntoStore preserves other accounts data when updating one account', () => {
  const full = createInitialStore();
  const primaryPostCountBefore = full.posts.filter((p) => p.accountId === 'acc-primary').length;

  const patch = mergeScopedPatchIntoStore(full, 'acc-secondary', {
    posts: [
      {
        id: 'post-ai-1',
        accountId: 'acc-secondary',
        blocks: ['Top 3 local AI repos you can run for $0 today.'],
        status: 'queued',
        format: 'single',
        predictiveScore: 88,
        automations: {
          threadDelayMinutes: 0,
          autoPlugEnabled: false,
          autoPlugText: '',
          autoPlugDelayMinutes: 10,
          autoPlugMinLikes: 5,
          autoRetweetEnabled: false,
          autoRetweetDelayHours: 6,
          autoUnretweetAfterHours: 24,
          autoDeleteEnabled: false,
          autoDeleteAfterHours: 48,
          isEvergreen: false,
          evergreenIntervalDays: 21,
        },
        metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const mergedPosts = patch.posts || [];
  assert.equal(
    mergedPosts.filter((p) => p.accountId === 'acc-primary').length,
    primaryPostCountBefore
  );
  assert.equal(mergedPosts.filter((p) => p.accountId === 'acc-secondary').length, 1);
});

test('computeAccountJourneyProgress guides a fresh account step-by-step from stage 1 to 5', () => {
  const full = createInitialStore();
  const secondaryScoped = scopeStoreToAccount(full, 'acc-secondary');
  const secondaryAcc = full.accounts.find((a) => a.id === 'acc-secondary')!;

  const progress = computeAccountJourneyProgress(secondaryScoped, secondaryAcc);
  assert.equal(progress.stages[0].completed, true); // niche locked
  assert.equal(progress.stages[1].completed, false); // radar not scanned yet
  assert.equal(progress.nextStage?.id, 'research');
});
