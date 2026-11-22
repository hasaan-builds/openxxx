import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_NICHE_CATALOG,
  buildAccountBrandBrainFromNiche,
  getNicheCatalogStats,
} from './nicheCatalog';

test('niche catalog covers all major market categories with deep sub-niches and micro-angles', () => {
  const stats = getNicheCatalogStats();
  assert.ok(stats.markets >= 15, `Expected at least 15 markets, got ${stats.markets}`);
  assert.ok(stats.subNiches >= 30, `Expected at least 30 sub-niches, got ${stats.subNiches}`);
  assert.ok(stats.microAngles >= 100, `Expected at least 100 micro-angles, got ${stats.microAngles}`);

  for (const market of MARKET_NICHE_CATALOG) {
    assert.ok(market.subNiches.length > 0, `Market ${market.name} must have sub-niches`);
    for (const sub of market.subNiches) {
      assert.ok(sub.subreddits.length > 0, `Sub-niche ${sub.name} must have subreddits`);
      assert.ok(sub.microAngles.length >= 3, `Sub-niche ${sub.name} must have micro-angles`);
    }
  }
});

test('buildAccountBrandBrainFromNiche locks a focused per-account BrandBrain and Whop offer', () => {
  const result = buildAccountBrandBrainFromNiche({
    marketId: 'real-estate',
    subNicheId: 'rental-cashflow-airbnb',
    microAngle: 'Analyzing rental property cashflow in 3 minutes',
    buyerGoal: 'Sell a Whop or Affiliate Course',
    offerName: 'Cashflow Deal Mastery',
    offerUrl: 'https://whop.com/cashflow-deal-mastery',
    offerPrice: '$97',
    giveawayKeyword: 'cashflow!',
  });

  assert.equal(result.nicheProfile.locked, true);
  assert.equal(result.nicheProfile.marketName, 'Real Estate & Property');
  assert.equal(result.nicheProfile.subNicheName, 'Rental Cashflow, BRRRR & Short-Term Rentals');
  assert.equal(result.brandBrain.niche, 'Rental Cashflow, BRRRR & Short-Term Rentals');
  assert.ok(result.brandBrain.subreddits.includes('realestateinvesting'));
  assert.equal(result.brandBrain.offers[0].platform, 'Whop');
  assert.equal(result.brandBrain.offers[0].giveawayKeyword, 'CASHFLOW');
});
