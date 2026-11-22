import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXIntentUrl,
  formatAutoPlugReminderForTelegram,
  formatGiveawayPackForTelegram,
  formatPostForTelegram,
  validateTelegramCredentials,
} from './telegramFormatter';
import type { AccountProfile, LeadMagnet, PostItem } from './types';

const sampleAccount: AccountProfile = {
  id: 'acc-1',
  name: 'Maya Chen',
  handle: '@mayacloses',
  bio: 'High-ticket sales',
  avatarUrl: '',
  followers: 2400,
  verified: false,
  isPremium: false,
  xConnected: false,
  xMode: 'sandbox',
};

const sampleMagnet: LeadMagnet = {
  id: 'lm-1',
  accountId: 'acc-1',
  slug: 'calm-closing-playbook-1234',
  title: 'Calm Closing Playbook',
  subtitle: 'Handle objections cleanly',
  format: 'Playbook',
  niche: 'High-Ticket Sales',
  themeColor: '#0071E3',
  authorName: 'Maya Chen',
  authorHandle: '@mayacloses',
  giveawayKeyword: 'CLOSE',
  sections: [
    { id: 's1', type: 'framework', heading: 'The 3-Second Pause', body: 'Wait calmly.', bullets: [] },
    { id: 's2', type: 'script', heading: 'Price Objection Script', body: 'Ask why.', bullets: [] },
  ],
  views: 0,
  downloads: 0,
  offerClicks: 0,
  createdAt: new Date().toISOString(),
};

const samplePost: PostItem = {
  id: 'post-1',
  accountId: 'acc-1',
  blocks: ['Stop discounting on sales calls.\n\nAsk what feels risky instead.', 'Tweet 2 breakdown here.'],
  status: 'queued',
  format: 'thread',
  predictiveScore: 91,
  automations: {
    threadDelayMinutes: 0,
    autoPlugEnabled: true,
    autoPlugText: 'Grab the full free PDF here: https://example.com/r/calm-closing-playbook-1234',
    autoPlugDelayMinutes: 30,
    autoPlugMinLikes: 0,
    autoRetweetEnabled: false,
    autoRetweetDelayHours: 8,
    autoUnretweetAfterHours: 24,
    autoDeleteEnabled: false,
    autoDeleteAfterHours: 0,
    isEvergreen: true,
    evergreenIntervalDays: 14,
    linkedLeadMagnetId: 'lm-1',
  },
  metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, bookmarks: 0, offerClicks: 0 },
  createdAt: new Date().toISOString(),
};

test('validateTelegramCredentials accepts real bot tokens and numeric chat IDs', () => {
  assert.equal(validateTelegramCredentials('123456789:AAH_validBotTokenExample12345', '551234567').valid, true);
  assert.equal(validateTelegramCredentials('bad-token', '551234567').valid, false);
  assert.equal(validateTelegramCredentials('123456789:AAH_validBotTokenExample12345', 'not a chat id').valid, false);
});

test('formatPostForTelegram includes thread blocks, auto-plug, giveaway reply, and 1-tap X intent button', () => {
  const payload = formatPostForTelegram({
    post: samplePost,
    account: sampleAccount,
    linkedMagnet: sampleMagnet,
    baseUrl: 'https://ghostpilot.example.com',
  });

  assert.match(payload.text, /Tweet 1\/2/);
  assert.match(payload.text, /Tweet 2\/2/);
  assert.match(payload.text, /Auto-Plug Reply/);
  assert.match(payload.text, /Keyword: CLOSE/);
  assert.equal(payload.replyMarkup?.inline_keyboard[0][0].url, buildXIntentUrl(samplePost.blocks[0]));
  assert.equal(
    payload.replyMarkup?.inline_keyboard[1][0].url,
    'https://ghostpilot.example.com/r/calm-closing-playbook-1234'
  );
});

test('formatAutoPlugReminderForTelegram formats the delayed reply reminder cleanly', () => {
  const payload = formatAutoPlugReminderForTelegram({ post: samplePost, account: sampleAccount });
  assert.match(payload.text, /Auto-Plug Reminder/);
  assert.match(payload.text, /30m/);
  assert.match(payload.text, /Grab the full free PDF here/);
});

test('formatGiveawayPackForTelegram includes tweet, reply template, DM template, and PDF URL', () => {
  const payload = formatGiveawayPackForTelegram({
    magnet: sampleMagnet,
    account: sampleAccount,
    baseUrl: 'https://ghostpilot.example.com',
  });
  assert.match(payload.text, /1\. Giveaway Tweet/);
  assert.match(payload.text, /2\. Public Reply Template/);
  assert.match(payload.text, /3\. DM Template/);
  assert.match(payload.text, /Comment "CLOSE"/);
});
