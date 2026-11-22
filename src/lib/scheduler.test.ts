import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countTweetChars,
  findNextOpenSlot,
  pickEvergreenCandidate,
  computeFrameworkRoi,
} from './scheduler';
import type { PostItem, QueueSlot } from './types';

function makePost(partial: Partial<PostItem>): PostItem {
  return {
    id: partial.id ?? 'p-1',
    accountId: 'acc-1',
    blocks: partial.blocks ?? ['Hello world'],
    status: partial.status ?? 'queued',
    format: partial.format ?? 'single',
    scheduledAt: partial.scheduledAt,
    publishedAt: partial.publishedAt,
    frameworkName: partial.frameworkName,
    predictiveScore: partial.predictiveScore ?? 80,
    automations: {
      threadDelayMinutes: 0,
      autoPlugEnabled: false,
      autoPlugText: '',
      autoPlugDelayMinutes: 30,
      autoPlugMinLikes: 10,
      autoRetweetEnabled: false,
      autoRetweetDelayHours: 6,
      autoUnretweetAfterHours: 24,
      autoDeleteEnabled: false,
      autoDeleteAfterHours: 72,
      isEvergreen: false,
      evergreenIntervalDays: 21,
      ...(partial.automations ?? {}),
    },
    metrics: {
      impressions: 1000,
      likes: 20,
      retweets: 5,
      replies: 4,
      bookmarks: 10,
      offerClicks: 8,
      ...(partial.metrics ?? {}),
    },
    createdAt: new Date().toISOString(),
  };
}

test('countTweetChars counts URLs as 23 characters per X standard', () => {
  const txt = 'Check out https://whop.com/some-very-long-affiliate-slug-url-here now!';
  // "Check out " (10) + 23 + " now!" (5) = 38
  assert.equal(countTweetChars(txt), 38);
});

test('findNextOpenSlot skips already-occupied slots', () => {
  const now = new Date('2026-11-23T08:00:00.000Z'); // Monday
  const dow = now.getDay();
  const slots: QueueSlot[] = [
    { id: 's1', dayOfWeek: dow, time: '09:00', label: 'Morning', enabled: true },
    { id: 's2', dayOfWeek: dow, time: '14:00', label: 'Afternoon', enabled: true },
  ];

  const occupiedDate = new Date(now);
  occupiedDate.setHours(9, 0, 0, 0);

  const existing = [makePost({ status: 'queued', scheduledAt: occupiedDate.toISOString() })];
  const nextIso = findNextOpenSlot(slots, existing, now);
  const nextDate = new Date(nextIso);
  assert.equal(nextDate.getHours(), 14);
});

test('pickEvergreenCandidate respects cooldown and selects highest engagement winner', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const recent = makePost({
    id: 'recent',
    status: 'published',
    publishedAt: '2026-11-20T12:00:00.000Z',
    automations: { isEvergreen: true, evergreenIntervalDays: 14 } as PostItem['automations'],
    metrics: { impressions: 50000, likes: 900, retweets: 100, replies: 50, bookmarks: 300, offerClicks: 40 },
  });
  const eligibleWinner = makePost({
    id: 'winner',
    status: 'published',
    publishedAt: '2026-10-20T12:00:00.000Z',
    automations: { isEvergreen: true, evergreenIntervalDays: 14 } as PostItem['automations'],
    metrics: { impressions: 20000, likes: 300, retweets: 45, replies: 22, bookmarks: 120, offerClicks: 25 },
  });
  const eligibleSmaller = makePost({
    id: 'smaller',
    status: 'published',
    publishedAt: '2026-10-15T12:00:00.000Z',
    automations: { isEvergreen: true, evergreenIntervalDays: 14 } as PostItem['automations'],
    metrics: { impressions: 4000, likes: 40, retweets: 5, replies: 3, bookmarks: 12, offerClicks: 4 },
  });

  const picked = pickEvergreenCandidate([recent, eligibleSmaller, eligibleWinner], now);
  assert.equal(picked?.id, 'winner');
});

test('computeFrameworkRoi aggregates published posts by copy framework accurately', () => {
  const posts = [
    makePost({
      id: '1',
      status: 'published',
      frameworkName: 'S-Tier Comment-to-PDF Giveaway',
      predictiveScore: 90,
      metrics: { impressions: 10000, likes: 200, retweets: 50, replies: 100, bookmarks: 150, offerClicks: 60 },
    }),
    makePost({
      id: '2',
      status: 'published',
      frameworkName: 'Contrarian Truth + Proof',
      predictiveScore: 82,
      metrics: { impressions: 8000, likes: 120, retweets: 20, replies: 40, bookmarks: 60, offerClicks: 12 },
    }),
  ];

  const rows = computeFrameworkRoi(posts);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].frameworkName, 'S-Tier Comment-to-PDF Giveaway');
  assert.equal(rows[0].totalOfferClicks, 60);
  assert.equal(rows[0].engagementRate, 5.0);
});
