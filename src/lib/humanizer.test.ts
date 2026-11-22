import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GITHUB_SKILL_REGISTRY,
  detectAiTells,
  humanizeCopy,
  simulateXHeavyRanker,
} from './humanizer';

test('humanizeCopy strips AI slop buzzwords, filler intros, hashtag spam, and excess em-dashes', () => {
  const robotic =
    "In today's fast-paced world, let's dive into how to delve into cutting-edge AI — it is a game-changer — a testament to synergy — not just faster, but better. #AI #Growth #Marketing";
  const tells = detectAiTells(robotic);
  assert.ok(tells.length >= 5, 'Should detect multiple AI writing tells');

  const res = humanizeCopy(robotic);
  assert.ok(!/delve|game-changer|testament to|fast-paced world|synergy/i.test(res.cleanedText));
  assert.ok(!/#AI/.test(res.cleanedText), 'Should strip hashtag spam');
  assert.ok(res.fixesApplied.length >= 4);
  assert.ok(res.humanScore >= 80);
});

test('simulateXHeavyRanker rewards author-reply triggers, proof, and bookmarks while flagging Tweet 1 link penalty', () => {
  const sTier = simulateXHeavyRanker([
    'After auditing 140 high-ticket sales calls, I found 1 phrase killing 60% of closes.\n\nHere are the 3 scripts that fixed it:\n• Pause 3 seconds after price\n• Ask what doing nothing costs\n• Mirror their exact words\n\nComment "CLOSE" and I\'ll send you the free PDF playbook.',
  ]);
  assert.equal(sTier.hasTweetOneLinkPenalty, false);
  assert.equal(sTier.grade, 'S');
  assert.ok(sTier.totalScore >= 88);

  const linkPenalized = simulateXHeavyRanker([
    'Check out my new guide here https://whop.com/my-offer',
  ]);
  assert.equal(linkPenalized.hasTweetOneLinkPenalty, true);
  assert.ok(linkPenalized.totalScore < sTier.totalScore - 25);
  assert.match(linkPenalized.topFix, /Auto-Plug/i);
});

test('GITHUB_SKILL_REGISTRY covers all 6 core GhostPilot engine sections', () => {
  const sections = new Set(GITHUB_SKILL_REGISTRY.map((s) => s.section));
  assert.equal(sections.size, 6);
  assert.ok(GITHUB_SKILL_REGISTRY.length >= 14);
});
