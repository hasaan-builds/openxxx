import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenReplyBookmarklet,
  buildXDirectReplyUrl,
  evaluateOpenReplySafetyPacing,
  extractPlainTextFromOembedHtml,
  parseXTweetUrl,
} from './openReplyEngine';
import type { OpenReplyItem } from './types';

test('parseXTweetUrl extracts tweetId, handle, and canonical URL from x.com and twitter.com links', () => {
  const xParsed = parseXTweetUrl('https://x.com/alexbuildsai/status/1892345678901234567?s=20&t=abc');
  assert.equal(xParsed.valid, true);
  assert.equal(xParsed.tweetId, '1892345678901234567');
  assert.equal(xParsed.authorHandle, '@alexbuildsai');
  assert.equal(xParsed.canonicalUrl, 'https://x.com/alexbuildsai/status/1892345678901234567');

  const twitterParsed = parseXTweetUrl('https://mobile.twitter.com/naval/status/1002103360646823936');
  assert.equal(twitterParsed.valid, true);
  assert.equal(twitterParsed.tweetId, '1002103360646823936');
  assert.equal(twitterParsed.authorHandle, '@naval');

  const bareId = parseXTweetUrl('1892345678901234567');
  assert.equal(bareId.valid, true);
  assert.equal(bareId.tweetId, '1892345678901234567');

  const invalid = parseXTweetUrl('https://example.com/not-a-tweet');
  assert.equal(invalid.valid, false);
});

test('buildXDirectReplyUrl generates native X in_reply_to intent URL when tweetId is present', () => {
  const url = buildXDirectReplyUrl({
    tweetId: '1892345678901234567',
    authorHandle: '@naval',
    replyText: 'Testing a real reply with specific insight.',
  });
  assert.ok(url.startsWith('https://x.com/intent/tweet?'));
  assert.ok(url.includes('in_reply_to=1892345678901234567'));
  assert.ok(url.includes('Testing+a+real+reply'));

  const handleFallback = buildXDirectReplyUrl({
    authorHandle: 'naval',
    replyText: 'Great framework on leverage.',
  });
  assert.ok(handleFallback.includes('%40naval+Great+framework'));
});

test('extractPlainTextFromOembedHtml strips HTML tags and decodes entities cleanly', () => {
  const html =
    '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Most solo founders &amp; builders skip step 1.<br><br>Ship the checklist first &mdash; then automate. <a href="https://t.co/xyz">pic.twitter.com/xyz</a></p>&mdash; Alex</blockquote>';
  const text = extractPlainTextFromOembedHtml(html);
  assert.equal(
    text,
    'Most solo founders & builders skip step 1.\n\nShip the checklist first — then automate.'
  );
});

test('evaluateOpenReplySafetyPacing enforces 45s cooldown and 12 replies/hour anti-shadowban cap', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const recentReply: OpenReplyItem = {
    id: 'or-1',
    targetTweetUrl: 'https://x.com/test/status/1234567890',
    targetTweetId: '1234567890',
    targetAuthorHandle: '@test',
    targetTweetText: 'Hello',
    replyText: 'Real insight',
    angle: 'Tactical Addition',
    goal: 'authority',
    executionMode: 'antigravity-direct',
    status: 'replied',
    createdAt: new Date(now.getTime() - 60000).toISOString(),
    repliedAt: new Date(now.getTime() - 20000).toISOString(), // 20s ago
  };

  const cooling = evaluateOpenReplySafetyPacing([recentReply], now);
  assert.equal(cooling.safeToSendNow, false);
  assert.equal(cooling.nextSafeInSeconds, 25);

  const safeLater = evaluateOpenReplySafetyPacing([recentReply], new Date(now.getTime() + 30000));
  assert.equal(safeLater.safeToSendNow, true);

  // 12 replies inside last hour triggers hourly cap
  const twelveReplies: OpenReplyItem[] = Array.from({ length: 12 }, (_, idx) => ({
    ...recentReply,
    id: `or-cap-${idx}`,
    repliedAt: new Date(now.getTime() - (idx + 2) * 120000).toISOString(),
  }));
  const capped = evaluateOpenReplySafetyPacing(twelveReplies, now);
  assert.equal(capped.safeToSendNow, false);
  assert.equal(capped.repliesLastHour, 12);
});

test('buildOpenReplyBookmarklet encodes app origin and openReplyUrl parameters', () => {
  const href = buildOpenReplyBookmarklet('http://localhost:3000/');
  assert.ok(href.startsWith('javascript:'));
  assert.ok(decodeURIComponent(href).includes('http://localhost:3000/?openReplyUrl='));
});
