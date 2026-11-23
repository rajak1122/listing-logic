const mongoose = require("mongoose");

// One record per reported financial period, used by the Company Quality UI.
const financialHistorySchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    // Exact period end allows correct ordering of interim and annual statements.
    periodEnded: { type: Date, default: null },
    totalIncome: { type: Number, default: null },
    revenueFromOperations: { type: Number, default: null },
    profitAfterTax: { type: Number, default: null },
    eps: { type: Number, default: null },
    epsBasis: {
      type: String,
      enum: ["BASIC", "DILUTED", "REPORTED", null],
      default: null,
    },
    netWorth: { type: Number, default: null },
    totalBorrowing: { type: Number, default: null },
    revenueGrowthYoy: { type: Number, default: null },
    patMargin: { type: Number, default: null },
    debtToEquity: { type: Number, default: null },
    roe: { type: Number, default: null },
    peRatio: { type: Number, default: null },
    // Primary Chittorgarh source and secondary fallback provenance are kept separately.
    sourceUrl: { type: String, default: null, trim: true },
    fetchedAt: { type: Date, default: null },
    fallbackSourceUrl: { type: String, default: null, trim: true },
    fallbackFetchedAt: { type: Date, default: null },
  },
  { _id: false },
);

const ipoSchema = new mongoose.Schema(
  {
    // Core IPO identity and offering details
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      trim: true,
      default: null,
    },
    exchange: {
      type: String,
      enum: ["NSE", "BSE", "NSE & BSE"],
      default: "NSE",
    },
    ipoType: {
      type: String,
      enum: ["MainBoard", "SME"],
      default: null,
    },
    priceBand: {
      type: String,
      trim: true,
      default: null,
    },
    upperPriceBand: {
      type: Number,
      required: true,
    },
    issueSize: {
      type: String,
      trim: true,
      default: null,
    },
    issueSizeCr: {
      type: Number,
      default: null,
    },

    // IPO lifecycle and exchange identifiers
    status: {
      type: String,
      enum: ["ACTIVE", "UPCOMING", "CLOSED", "LISTED"],
      default: "UPCOMING",
    },
    openDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },
    tentativeListingDate: { type: Date, default: null },
    bseIpoNumber: { type: String, default: null, trim: true },
    bseIpoDirectoryCode: {
      type: String,
      default: null,
      trim: true,
    },
    bseScripCode: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value) =>
          value == null || value === "" || /^\d{6}$/.test(String(value)),

        message: ({ value }) =>
          `Invalid BSE Scrip Code "${value}". Expected a six-digit code or null.`,
      },
    },
    actualListingPrice: { type: Number, default: null },
    actualListingGain: { type: Number, default: null },
    // Throttle retries when an IPO has closed but exchange listing data is not available yet.
    nextListingRetryAt: { type: Date, default: null },

    // Current financial snapshot. Unknown values remain null, not zero.
    financials: {
      revenueGrowthYoy: { type: Number, default: null },
      revenueFromOperations: { type: Number, default: null },
      patMargin: { type: Number, default: null },
      debtToEquity: { type: Number, default: null },
      roe: { type: Number, default: null },
      peRatio: { type: Number, default: null },
      eps: { type: Number, default: null },
    },

    // Year-wise financial history for the separate Company Quality section.
    financialHistory: {
      type: [financialHistorySchema],
      default: [],
    },
    // Prevents repeated retries for missing historical pages on every scheduled sync.
    financialHistoryLastSynced: { type: Date, default: null },

    // Latest GMP snapshot used by the Listing Demand Engine.
    gmpData: {
      type: Number,
      default: null,
    },

    // Latest subscription snapshot used by the Listing Demand Engine.
    subscriptionDemand: {
      qib: { type: Number, default: null },
      nii: { type: Number, default: null },
      retail: { type: Number, default: null },
      overallSubscriptionRate: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    // Sync bookkeeping
    lastSynced: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Ipo", ipoSchema);
