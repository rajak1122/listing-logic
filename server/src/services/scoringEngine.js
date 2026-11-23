/**
 * ListingLogic - IPO Listing Demand Engine (V2)
 *
 * Scope:
 * - Listing estimates use GMP yield as the anchor when available.
 * - Subscription demand confirms GMP, creates demand risk flags, and is the
 *   fallback when GMP is unavailable.
 * - Company financials are deliberately NOT read here. Historical financial
 *   information is presented separately in Company Quality.
 *
 * Score layout:
 * - demandScore / 15 when GMP is available (GMP 6 + QIB 4 + Overall 3 + NII 2)
 * - demandScore / 9 when GMP is missing (QIB 4 + Overall 3 + NII 2)
 *
 * The `totalScore` and `maxScore` return fields remain as demand-only aliases
 * for compatibility with older dashboard/card components. `fundamentalScore`
 * and all financial-quality score fields have been removed.
 */

// ----------------------------------------------------------------------
// CONFIG (all calibrated constants live here)
// ----------------------------------------------------------------------

const CONFIG = {
  // Point estimate from GMP yield (%). Piecewise-linear anchors, then linear above 5.
  // Below 5 the data shows listings sit around -7% when GMP <= 0.
  gmpAnchorsLow: [
    [-10, -16],
    [0, -6],
    [5, 2.5],
  ],
  gmpSlope: 0.9,
  gmpIntercept: -2,

  // Range offsets (percentage points around the estimate) by GMP tier.
  gmpRangeOffsets: {
    nonPositive: [-8, 8],
    low: [-6, 8], // 0-10
    mid: [-14, 12], // 10-30
    high: [-22, 28], // 30+
  },
  // Demand-only mode (no GMP): much wider, weaker model.
  demandOnlyRangeOffsets: {
    weak: [-10, 12],
    mid: [-14, 20],
    strong: [-20, 35],
  },

  // Smoothed outcome tables. n = IPOs in tier, high = gain >= 20%,
  // disc = gain < 0%, pos = gain > 0%.
  gmpTiers: [
    { max: 0, n: 10, high: 0, disc: 8, pos: 1 },
    { max: 10, n: 13, high: 0, disc: 2, pos: 7 },
    { max: 30, n: 14, high: 3, disc: 1, pos: 12 },
    { max: Infinity, n: 12, high: 11, disc: 0, pos: 12 },
  ],
  qibTiers: [
    { max: 3, n: 10, high: 0, disc: 7, pos: 3, medianGain: -2.3 },
    { max: 20, n: 13, high: 1, disc: 2, pos: 7, medianGain: 0.8 },
    { max: 100, n: 12, high: 3, disc: 1, pos: 10, medianGain: 14.4 },
    { max: Infinity, n: 14, high: 10, disc: 1, pos: 12, medianGain: 37.3 },
  ],
  overallTiers: [
    { max: 3, n: 13, high: 0, disc: 7, pos: 4, medianGain: -1.9 },
    { max: 10, n: 5, high: 0, disc: 2, pos: 2, medianGain: 0.0 },
    { max: 30, n: 5, high: 1, disc: 0, pos: 4, medianGain: 12.3 },
    { max: 100, n: 14, high: 4, disc: 2, pos: 11, medianGain: 11.7 },
    { max: Infinity, n: 12, high: 9, disc: 0, pos: 11, medianGain: 37.3 },
  ],

  weakDemand: { qibBelow: 3, overallBelow: 3 },
};

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const interp = (x, pts) => {
  if (x <= pts[0][0]) {
    // extend the first segment linearly
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[1];
    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  return null;
};

const findTier = (tiers, value) =>
  tiers.find((t) => value < t.max) || tiers[tiers.length - 1];
// gmp tiers use "<= max" for the first tier (GMP <= 0)
const findGmpTier = (tiers, gmpYield) =>
  gmpYield <= 0
    ? tiers[0]
    : tiers.find((t, i) => i > 0 && gmpYield < t.max) ||
      tiers[tiers.length - 1];

// Laplace-style smoothing so tiny samples never give 0% or 100%.
const smooth = (k, n) => (k + 0.5) / (n + 1);

const tierProbs = (t) => ({
  high: smooth(t.high, t.n),
  disc: smooth(t.disc, t.n),
  pos: smooth(t.pos, t.n),
});

const round5 = (x) => Math.round(x / 5) * 5;
const round1 = (x) => Math.round(x * 10) / 10;

const fmtRange = (lo, hi) => {
  let a = round5(lo);
  let b = round5(hi);
  if (b <= a) b = a + 5;
  return `${a}% - ${b}%`;
};

// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------

const calculateIpoScore = (ipo) => {
  const cfg = CONFIG;

  // ---------------- inputs ----------------
  const qib = toNum(ipo?.subscriptionDemand?.qib);
  const nii = toNum(ipo?.subscriptionDemand?.nii);
  const rii = toNum(ipo?.subscriptionDemand?.retail);
  const overall = toNum(ipo?.subscriptionDemand?.overallSubscriptionRate);

  const gmp = toNum(ipo?.gmpData);
  const issuePrice = toNum(ipo?.upperPriceBand);

  const hasGmp = gmp !== null && issuePrice !== null && issuePrice > 0;
  const gmpYield = hasGmp ? (gmp / issuePrice) * 100 : null;
  const hasDemand = qib !== null || overall !== null;

  const q = qib ?? 0;
  const o = overall ?? 0;
  const n = nii ?? 0;

  const flags = [];

  // ----------------------------------------------------------------
  // 1. DEMAND SCORE (15 points) - cut-offs set where outcomes change
  // ----------------------------------------------------------------

  // GMP yield - max 6
  let gmpScore = 0;
  if (hasGmp) {
    if (gmpYield >= 40) gmpScore = 6;
    else if (gmpYield >= 30) gmpScore = 5;
    else if (gmpYield >= 15) gmpScore = 3;
    else if (gmpYield >= 5) gmpScore = 2;
    else if (gmpYield > 0) gmpScore = 1;
  }

  // QIB - max 4
  let qibScore = 0;
  if (q >= 100) qibScore = 4;
  else if (q >= 50) qibScore = 3;
  else if (q >= 20) qibScore = 2;
  else if (q >= 3) qibScore = 1;

  // Overall - max 3
  let overallScore = 0;
  if (o >= 100) overallScore = 3;
  else if (o >= 30) overallScore = 2;
  else if (o >= 10) overallScore = 1;

  // NII - max 2
  let niiScore = 0;
  if (n >= 100) niiScore = 2;
  else if (n >= 30) niiScore = 1;

  // RII is reported but not scored (weakest relationship with listing gain).
  const riiScore = 0;

  const demandScore = gmpScore + qibScore + overallScore + niiScore;
  const demandMax = hasGmp ? 15 : 9;

  // Financial data is intentionally not used by the listing-demand engine.
  // Company Quality reads `ipo.financials` and `ipo.financialHistory` separately.

  // ----------------------------------------------------------------
  // 2. WEAK / UNCONFIRMED DEMAND CHECKS
  // ----------------------------------------------------------------

  const weakDemand =
    hasDemand &&
    (qib === null || qib < cfg.weakDemand.qibBelow) &&
    (overall === null || overall < cfg.weakDemand.overallBelow);

  if (weakDemand)
    flags.push("WEAK_DEMAND: QIB and overall subscription both under 3x");

  // GMP promising but subscription does not back it up
  const gmpUnconfirmed =
    hasGmp && gmpYield >= 10 && hasDemand && q < 10 && o < 10;
  if (gmpUnconfirmed)
    flags.push(
      "GMP_UNCONFIRMED: GMP is high but subscription is weak, so GMP may be inflated",
    );

  // ----------------------------------------------------------------
  // 3. ESTIMATE + RANGE + PROBABILITIES
  // ----------------------------------------------------------------

  let mode;
  let estimate;
  let rangeLow;
  let rangeHigh;
  let probs;
  let dataConfidence;

  if (hasGmp) {
    mode = "GMP_ANCHORED";
    estimate =
      gmpYield < 5
        ? interp(gmpYield, cfg.gmpAnchorsLow)
        : cfg.gmpSlope * gmpYield + cfg.gmpIntercept;

    const offs =
      gmpYield <= 0
        ? cfg.gmpRangeOffsets.nonPositive
        : gmpYield < 10
          ? cfg.gmpRangeOffsets.low
          : gmpYield < 30
            ? cfg.gmpRangeOffsets.mid
            : cfg.gmpRangeOffsets.high;

    rangeLow = estimate + offs[0];
    rangeHigh = estimate + offs[1];

    // Unconfirmed GMP: leave the estimate, widen the downside.
    if (gmpUnconfirmed) rangeLow -= 8;

    probs = tierProbs(findGmpTier(cfg.gmpTiers, gmpYield));
    dataConfidence = hasDemand ? "HIGH" : "MEDIUM";
  } else {
    mode = "DEMAND_ONLY";
    flags.push(
      "NO_GMP: GMP unavailable, estimate is provisional (demand-only model is much less accurate)",
    );

    const qt = findTier(cfg.qibTiers, q);
    const ot = findTier(cfg.overallTiers, o);
    estimate =
      qib !== null && overall !== null
        ? (qt.medianGain + ot.medianGain) / 2
        : qib !== null
          ? qt.medianGain
          : ot.medianGain;

    const level = estimate >= 25 ? "strong" : estimate >= 8 ? "mid" : "weak";
    const offs = cfg.demandOnlyRangeOffsets[level];
    rangeLow = estimate + offs[0];
    rangeHigh = estimate + offs[1];

    const pq = tierProbs(qt);
    const po = tierProbs(ot);
    probs =
      qib !== null && overall !== null
        ? {
            high: (pq.high + po.high) / 2,
            disc: (pq.disc + po.disc) / 2,
            pos: (pq.pos + po.pos) / 2,
          }
        : qib !== null
          ? pq
          : po;
    dataConfidence = hasDemand ? "LOW" : "NONE";
    if (!hasDemand)
      flags.push(
        "NO_DATA: no GMP and no subscription data, nothing to estimate from",
      );
  }

  // Adjust probabilities for known risk patterns
  let pHigh = probs.high;
  let pDisc = probs.disc;
  let pPos = probs.pos;

  if (weakDemand) {
    pDisc = Math.max(pDisc, 0.45);
    pHigh = Math.min(pHigh, 0.08);
    pPos = Math.min(pPos, 0.5);
  }
  if (gmpUnconfirmed) {
    pHigh = pHigh * 0.7;
    pDisc = Math.max(pDisc, 0.2);
  }
  pPos = Math.max(
    0.02,
    Math.min(0.98, pPos - Math.max(0, pDisc - probs.disc) * 0.5),
  );

  // If we have nothing to go on, say so instead of faking a number.
  const noData = mode === "DEMAND_ONLY" && !hasDemand;

  // ----------------------------------------------------------------
  // 4. OUTPUT FIELDS
  // ----------------------------------------------------------------

  const listingConfidence =
    demandMax > 0 ? Number(((demandScore / demandMax) * 100).toFixed(2)) : 0;

  let estimatedListingGain = noData
    ? "Insufficient data"
    : fmtRange(rangeLow, rangeHigh);

  let negativeListingPossibility = "NONE";
  if (noData) negativeListingPossibility = "UNKNOWN";
  else if (pDisc >= 0.5) negativeListingPossibility = "HIGH";
  else if (pDisc >= 0.2) negativeListingPossibility = "MODERATE";
  else if (pDisc >= 0.08) negativeListingPossibility = "LOW";

  let signalBadge = "NEUTRAL LISTING SETUP";
  if (noData) {
    signalBadge = "INSUFFICIENT DATA";
  } else if (
    estimate >= 20 &&
    pHigh >= 0.55 &&
    !weakDemand &&
    !gmpUnconfirmed
  ) {
    signalBadge = "STRONG LISTING SETUP";
  } else if (estimate >= 8 && pDisc < 0.3) {
    signalBadge = "MODERATE LISTING SETUP";
  } else if (estimate < 0 || pDisc >= 0.4) {
    signalBadge = "LOW LISTING CONFIDENCE";
  }

  // Demand-only mode is provisional: never show STRONG without a GMP.
  if (mode === "DEMAND_ONLY" && signalBadge === "STRONG LISTING SETUP") {
    signalBadge = "MODERATE LISTING SETUP";
  }

  return {
    // Primary demand-only fields
    demandScore,
    demandMaxScore: demandMax,
    listingConfidence,
    estimatedListingGain,
    negativeListingPossibility,
    signalBadge,
    classification: signalBadge,

    // Prediction details
    predictionMode: mode,
    dataConfidence,
    estimatedGainPoint: noData ? null : round1(estimate),
    rangeLowPct: noData ? null : round1(rangeLow),
    rangeHighPct: noData ? null : round1(rangeHigh),
    probabilities: noData
      ? null
      : {
          highGain20Plus: Number(pHigh.toFixed(2)),
          discount: Number(pDisc.toFixed(2)),
          premium: Number(pPos.toFixed(2)),
        },
    flags,

    // Backward-compatible aliases. These now represent the demand score only.
    totalScore: demandScore,
    maxScore: demandMax,

    categoryBreakdown: {
      qibScore,
      niiScore,
      riiScore,
      overallScore,
      gmpScore,
    },

    // Demand/listing inputs only; financial metrics stay on the IPO document.
    metrics: {
      qib,
      nii,
      rii,
      overall,
      gmp,
      gmpYield: gmpYield === null ? null : round1(gmpYield),
    },
  };
};

module.exports = {
  calculateIpoScore,
  CONFIG,
};
