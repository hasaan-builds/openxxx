import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCopy, estimateReadingGrade } from './copyScorer';
import { buildRankedABVariations } from './frameworks';
import type { BrandBrain } from './types';

const sampleBrain: BrandBrain = {
  niche: 'High-Ticket Sales',
  subNiches: ['B2B Closing', 'DM Setting'],
  subreddits: ['sales'],
  customRssUrls: [],
  tone: 'Direct, tactical, zero fluff',
  voiceRules: ['Use short lines'],
  bannedCliches: ['delve', 'game-changer', 'unlock the power'],
  winningPhrases: ['objection', 'playbook', 'closing'],
  weeklyMix: { singlePosts: 5, threads: 2, carousels: 2, giveaways: 2 },
  personas: [
    {
      id: 'p1',
      name: 'Remote Closers',
      role: 'High-ticket sales reps',
      fears: ['ghosted calls'],
      desires: ['$10k/mo commission'],
      keywords: ['sales', 'objection', 'close', 'playbook'],
    },
  ],
  activePersonaId: 'p1',
  offers: [
    {
      id: 'o1',
      name: 'Closing Mastery on Whop',
      platform: 'Whop',
      url: 'https://whop.com/example-sales',
      priceLabel: '$97/mo',
      promise: 'Master discovery calls and close 30%+ of qualified leads.',
      autoPlugTemplate: 'Grab the full Whop program here -> https://whop.com/example-sales',
      giveawayKeyword: 'CLOSE',
      clicks: 120,
      leads: 45,
      estimatedRevenue: 1450,
    },
  ],
};

test('empty draft returns 0 predictive score', () => {
  const res = scoreCopy(['   ']);
  assert.equal(res.total, 0);
  assert.equal(res.grade, 'Needs Work');
});

test('strong structured hook outscores generic cliché-ridden AI tweet significantly', () => {
  const genericAi = scoreCopy(
    [
      'In today\'s fast-paced world, let\'s delve into how this game-changer can unlock the power of synergistic enterprise optimization methodologies.',
    ],
    { brandBrain: sampleBrain, persona: sampleBrain.personas[0] }
  );

  const sTierCopy = scoreCopy(
    [
      'I spent 38 hours breaking down 140 recorded $10k+ sales calls.\n\nMost reps lose the close in minute 4 because they pitch before diagnosing pain.\n\nHere is the exact 3-step objection playbook:\n1. Quantify the cost of inaction\n2. Ask "why fix this now?"\n3. Pitch only the gap they named\n\nComment "CLOSE" and I\'ll DM you the full PDF free.',
    ],
    { brandBrain: sampleBrain, persona: sampleBrain.personas[0] }
  );

  assert.ok(genericAi.clichesFound.length >= 2, 'should flag robotic AI clichés');
  assert.ok(sTierCopy.total >= 84, `expected S-Tier >= 84, got ${sTierCopy.total}`);
  assert.ok(
    sTierCopy.total - genericAi.total >= 30,
    `expected >= 30pt gap, got sTier=${sTierCopy.total} vs generic=${genericAi.total}`
  );
  assert.equal(sTierCopy.grade, 'S-Tier');
});

test('reading grade estimator returns sensible grade for plain prose', () => {
  const grade = estimateReadingGrade('Stop pitching features. Ask two clear questions first. Buyers close themselves.');
  assert.ok(grade >= 1 && grade <= 9, `unexpected grade: ${grade}`);
});

test('A/B arena builds 5 variations sorted highest predictive score first', () => {
  const variations = buildRankedABVariations({
    topic: 'handling the price objection on Zoom calls',
    keyInsight: 'diagnosing urgency before quoting price',
    brandBrain: sampleBrain,
    persona: sampleBrain.personas[0],
    offer: sampleBrain.offers[0],
  });

  assert.equal(variations.length, 5);
  for (let i = 1; i < variations.length; i++) {
    assert.ok(
      variations[i - 1].score.total >= variations[i].score.total,
      'variations must be ranked descending by predictive score'
    );
  }
});

test('scoreCopy classifies Eugene Schwartz awareness stage and X algorithm signals', () => {
  const giveaway = scoreCopy(
    [
      'I spent 30 hours building this free PDF playbook for SaaS founders.\n\nStep 1: Fix your landing hook\nStep 2: Add proof\n\nComment "PLAYBOOK" and I will DM you the free PDF.',
    ],
    { brandBrain: sampleBrain }
  );
  assert.equal(giveaway.awarenessStage, 'Most Aware');
  assert.ok(giveaway.algorithmSignals.bookmarkPull >= 70);
  assert.ok(giveaway.algorithmSignals.replyPull >= 70);

  const problemPost = scoreCopy(
    ['You are losing 50% of leads because of one fixable mistake on discovery calls.'],
    { brandBrain: sampleBrain }
  );
  assert.equal(problemPost.awarenessStage, 'Problem Aware');
});
