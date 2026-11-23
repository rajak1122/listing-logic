const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateIpoScore } = require('../src/services/scoringEngine');

const demandInputs = {
  upperPriceBand: 100,
  gmpData: 20,
  subscriptionDemand: {
    qib: 50,
    nii: 100,
    retail: 12,
    overallSubscriptionRate: 60,
  },
};

test('listing prediction is independent of financial data', () => {
  const profitable = calculateIpoScore({
    ...demandInputs,
    financials: { eps: 12.5, patMargin: 14, revenueGrowthYoy: 22, debtToEquity: 0.4, roe: 19 },
  });
  const lossMaking = calculateIpoScore({
    ...demandInputs,
    financials: { eps: -3.2, patMargin: -4, revenueGrowthYoy: -12, debtToEquity: 2.1, roe: -5 },
  });
  const noFinancials = calculateIpoScore(demandInputs);

  assert.equal(profitable.estimatedListingGain, lossMaking.estimatedListingGain);
  assert.equal(profitable.estimatedGainPoint, lossMaking.estimatedGainPoint);
  assert.deepEqual(profitable.probabilities, lossMaking.probabilities);
  assert.deepEqual(profitable.probabilities, noFinancials.probabilities);
  assert.deepEqual(profitable.flags, lossMaking.flags);
});

test('returns demand-only score and backward-compatible score aliases', () => {
  const result = calculateIpoScore(demandInputs);
  assert.equal(result.demandScore, 10);
  assert.equal(result.demandMaxScore, 15);
  assert.equal(result.totalScore, result.demandScore);
  assert.equal(result.maxScore, result.demandMaxScore);
  assert.equal(Object.hasOwn(result, 'fundamentalScore'), false);
  assert.equal(Object.hasOwn(result, 'fundamentalsAvailable'), false);
  assert.equal(Object.hasOwn(result.categoryBreakdown, 'growthScore'), false);
  assert.equal(Object.hasOwn(result.metrics, 'patMargin'), false);
});

test('uses demand-only maximum score when GMP is unavailable', () => {
  const result = calculateIpoScore({
    upperPriceBand: 100,
    gmpData: null,
    subscriptionDemand: {
      qib: 30,
      nii: 10,
      retail: null,
      overallSubscriptionRate: 20,
    },
  });

  assert.equal(result.predictionMode, 'DEMAND_ONLY');
  assert.equal(result.demandMaxScore, 9);
  assert.equal(result.maxScore, 9);
  assert.equal(result.totalScore, result.demandScore);
});

test('returns insufficient-data status without GMP or subscription values', () => {
  const result = calculateIpoScore({
    upperPriceBand: 100,
    gmpData: null,
    subscriptionDemand: {},
  });

  assert.equal(result.signalBadge, 'INSUFFICIENT DATA');
  assert.equal(result.estimatedListingGain, 'Insufficient data');
  assert.equal(result.probabilities, null);
});
