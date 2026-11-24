const test = require("node:test");
const assert = require("node:assert/strict");

const Ipo = require("../src/models/Ipo");

const {
  parseSourceDate,
  parseGmpValue,
  resolveGmpValue,
  calculateListingGain,
  promoteToListedIfComplete,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
  createFullSyncRunner,
} = require("../src/services/ipoSyncService");

// ==========================================
// GMP SNAPSHOT TESTS
// ==========================================

test("GMP: genuine zero is a valid value", () => {
  assert.equal(parseGmpValue("0"), 0);
});

test("GMP: negative values are preserved", () => {
  assert.equal(parseGmpValue("-5.25"), -5.25);
});

test("GMP: missing or blank values return null", () => {
  assert.equal(parseGmpValue(null), null);
  assert.equal(parseGmpValue(undefined), null);
  assert.equal(parseGmpValue(""), null);
  assert.equal(parseGmpValue("   "), null);
  assert.equal(parseGmpValue("N/A"), null);
});

test("GMP: missing incoming value preserves existing snapshot", () => {
  assert.equal(resolveGmpValue(null, 12), 12);
  assert.equal(resolveGmpValue("", 8.5), 8.5);
});

test("GMP: genuine zero replaces an existing snapshot", () => {
  assert.equal(resolveGmpValue("0", 12), 0);
});

test("GMP: missing incoming and missing existing values remain null", () => {
  assert.equal(resolveGmpValue(null, null), null);
});

// ==========================================
// SUBSCRIPTION DATA MERGE TESTS
// ==========================================

test("Subscription: empty incoming data preserves the old snapshot", () => {
  const existing = {
    qib: 5.5,
    nii: 8.2,
    retail: 2.4,
    overallSubscriptionRate: 4.8,
    updatedAt: new Date("2026-11-20T10:00:00Z"),
  };

  const result = mergeSubscriptionDemand(existing, null);

  assert.equal(result.qib, 5.5);
  assert.equal(result.nii, 8.2);
  assert.equal(result.retail, 2.4);
  assert.equal(result.overallSubscriptionRate, 4.8);
  assert.equal(
    result.updatedAt.toISOString(),
    existing.updatedAt.toISOString(),
  );
});

test("Subscription: partial incoming data updates only available categories", () => {
  const existing = {
    qib: 5.5,
    nii: 8.2,
    retail: 2.4,
    overallSubscriptionRate: 4.8,
  };

  const result = mergeSubscriptionDemand(existing, {
    qib: 10.5,
    nii: null,
    retail: "",
    total: null,
  });

  assert.equal(result.qib, 10.5);
  assert.equal(result.nii, 8.2);
  assert.equal(result.retail, 2.4);
  assert.equal(result.overallSubscriptionRate, 4.8);
});

test("Subscription: genuine zero updates the corresponding category", () => {
  const result = mergeSubscriptionDemand({ qib: 5 }, { qib: 0 });

  assert.equal(result.qib, 0);
});

// ==========================================
// FINANCIAL SNAPSHOT TESTS
// ==========================================

test("Financial snapshot: null values never erase existing values", () => {
  const existing = {
    eps: 12.5,
    revenueGrowthYoy: 18,
    patMargin: 14,
  };

  const result = mergeFinancialSnapshot(existing, {
    eps: null,
    revenueGrowthYoy: null,
    patMargin: 16,
  });

  assert.equal(result.eps, 12.5);
  assert.equal(result.revenueGrowthYoy, 18);
  assert.equal(result.patMargin, 16);
});

test("Financial snapshot: new fields are added without losing old fields", () => {
  const result = mergeFinancialSnapshot({ eps: 12.5 }, { roe: 18 });

  assert.equal(result.eps, 12.5);
  assert.equal(result.roe, 18);
});

// ==========================================
// FINANCIAL HISTORY TESTS
// ==========================================

test("Financial history: matching periods merge without losing valid data", () => {
  const existing = [
    {
      financialYear: "FY2025",
      periodEnded: "2025-03-31",
      revenueFromOperations: 100,
      eps: 12,
      netWorth: 50,
    },
  ];

  const incoming = [
    {
      financialYear: "FY2025",
      periodEnded: "2025-03-31",
      revenueFromOperations: 120,
      eps: null,
      netWorth: null,
      profitAfterTax: 15,
    },
  ];

  const result = mergeFinancialHistory(existing, incoming);

  assert.equal(result.length, 1);
  assert.equal(result[0].revenueFromOperations, 120);
  assert.equal(result[0].eps, 12);
  assert.equal(result[0].netWorth, 50);
  assert.equal(result[0].profitAfterTax, 15);
});

test("Financial history: distinct periods are retained and sorted", () => {
  const result = mergeFinancialHistory(
    [
      {
        financialYear: "FY2025",
        periodEnded: "2025-03-31",
        eps: 12,
      },
    ],
    [
      {
        financialYear: "FY2024",
        periodEnded: "2024-03-31",
        eps: 10,
      },
    ],
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].financialYear, "FY2024");
  assert.equal(result[1].financialYear, "FY2025");
});

// ==========================================
// LISTING GAIN CALCULATION TESTS
// ==========================================

test("Listing gain: calculates positive listing gain", () => {
  assert.equal(calculateListingGain(120, 100), 20);
});

test("Listing gain: calculates zero percent gain", () => {
  assert.equal(calculateListingGain(100, 100), 0);
});

test("Listing gain: calculates negative listing gain", () => {
  assert.equal(calculateListingGain(90, 100), -10);
});

test("Listing gain: rejects zero or invalid issue prices", () => {
  assert.equal(calculateListingGain(100, 0), null);
  assert.equal(calculateListingGain(null, 100), null);
  assert.equal(calculateListingGain("invalid", 100), null);
});

// ==========================================
// IPO LIFECYCLE TESTS
// ==========================================

test("Lifecycle: incomplete listing result is not promoted", async (t) => {
  const calls = [];

  t.mock.method(Ipo, "findOneAndUpdate", async (...args) => {
    calls.push(args);
    return {};
  });

  const result = await promoteToListedIfComplete({
    _id: "ipo-1",
    status: "CLOSED",
    actualListingPrice: null,
    actualListingGain: null,
    upperPriceBand: 100,
  });

  assert.equal(result, false);
  assert.equal(calls.length, 0);
});

test("Lifecycle: valid listing price calculates and stores missing gain", async (t) => {
  const calls = [];

  t.mock.method(Ipo, "findOneAndUpdate", async (...args) => {
    calls.push(args);
    return {};
  });

  const result = await promoteToListedIfComplete({
    _id: "ipo-2",
    companyName: "Example Limited",
    status: "CLOSED",
    actualListingPrice: 120,
    actualListingGain: null,
    upperPriceBand: 100,
  });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].status, "LISTED");
  assert.equal(calls[0][1].actualListingGain, 20);
});

test("Lifecycle: zero percent listing gain is a valid completed result", async (t) => {
  const calls = [];

  t.mock.method(Ipo, "findOneAndUpdate", async (...args) => {
    calls.push(args);
    return {};
  });

  const result = await promoteToListedIfComplete({
    _id: "ipo-3",
    status: "CLOSED",
    actualListingPrice: 100,
    actualListingGain: 0,
    upperPriceBand: 100,
  });

  assert.equal(result, true);
  assert.equal(calls[0][1].actualListingGain, 0);
});

test("Lifecycle: negative listing gain is a valid completed result", async (t) => {
  const calls = [];

  t.mock.method(Ipo, "findOneAndUpdate", async (...args) => {
    calls.push(args);
    return {};
  });

  const result = await promoteToListedIfComplete({
    _id: "ipo-4",
    status: "CLOSED",
    actualListingPrice: 90,
    actualListingGain: -10,
    upperPriceBand: 100,
  });

  assert.equal(result, true);
  assert.equal(calls[0][1].status, "LISTED");
  assert.equal(calls[0][1].actualListingGain, -10);
});

test("Lifecycle: an already LISTED IPO is not updated again", async (t) => {
  const calls = [];

  t.mock.method(Ipo, "findOneAndUpdate", async (...args) => {
    calls.push(args);
    return {};
  });

  const result = await promoteToListedIfComplete({
    _id: "ipo-5",
    status: "LISTED",
  });

  assert.equal(result, true);
  assert.equal(calls.length, 0);
});

// ==========================================
// DATE PARSING TEST
// ==========================================

test("Date parser: DD-MM-YYYY is interpreted as IST midnight", () => {
  const result = parseSourceDate("25-11-2026");

  assert.equal(result.toISOString(), "2026-11-24T18:30:00.000Z");
});

test("Date parser: date-only close date includes the full IST day", () => {
  const result = parseSourceDate("25-11-2026", { endOfDay: true });

  assert.equal(result.toISOString(), "2026-11-25T18:29:59.999Z");
});

test("Date parser: ISO datetime without timezone is interpreted as IST", () => {
  const result = parseSourceDate("2026-11-25T10:30:00");

  assert.equal(result.toISOString(), "2026-11-25T05:00:00.000Z");
});

test("Date parser: explicit timezone is respected", () => {
  const result = parseSourceDate("2026-11-25T10:30:00+05:30");

  assert.equal(result.toISOString(), "2026-11-25T05:00:00.000Z");
});

// ==========================================
// SYNC LOCK TESTS
// ==========================================

test("Sync runner: runs active and closed sync sequentially", async () => {
  const calls = [];

  const runner = createFullSyncRunner({
    syncActive: async () => {
      calls.push("active");
      return 3;
    },

    syncClosed: async () => {
      calls.push("closed");
      return 2;
    },
  });

  const result = await runner({ trigger: "test" });

  assert.deepEqual(calls, ["active", "closed"]);
  assert.equal(result.skipped, false);
  assert.equal(result.activeSyncedCount, 3);
  assert.equal(result.closedUpdatedCount, 2);
});

test("Sync runner: skips a concurrent full sync", async () => {
  let releaseActive;

  const activeGate = new Promise((resolve) => {
    releaseActive = resolve;
  });

  const runner = createFullSyncRunner({
    syncActive: () => activeGate,
    syncClosed: async () => 2,
  });

  const firstRun = runner({ trigger: "manual" });

  // The first call has synchronously acquired the lock before awaiting syncActive.
  const secondResult = await runner({ trigger: "scheduled" });

  assert.equal(secondResult.skipped, true);
  assert.equal(secondResult.reason, "SYNC_ALREADY_RUNNING");

  releaseActive(3);

  const firstResult = await firstRun;

  assert.equal(firstResult.skipped, false);
  assert.equal(firstResult.activeSyncedCount, 3);
});

test("Sync runner: releases lock when a sync fails", async () => {
  let shouldFail = true;

  const runner = createFullSyncRunner({
    syncActive: async () => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("Simulated upstream failure");
      }

      return 1;
    },

    syncClosed: async () => 2,
  });

  await assert.rejects(runner(), /Simulated upstream failure/);

  const retryResult = await runner();

  assert.equal(retryResult.skipped, false);
  assert.equal(retryResult.activeSyncedCount, 1);
  assert.equal(retryResult.closedUpdatedCount, 2);
});

test("Sync runner: does not start when another instance owns the distributed lock", async () => {
  let syncCalls = 0;

  const runner = createFullSyncRunner({
    acquireLock: async () => null,
    syncActive: async () => {
      syncCalls++;
      return 1;
    },
    syncClosed: async () => 2,
  });

  const result = await runner({ trigger: "test" });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "SYNC_ALREADY_RUNNING");
  assert.equal(syncCalls, 0);
});

test("Sync runner: renews and releases its distributed lock", async () => {
  const calls = [];

  const lock = {
    lockKey: "test-sync-lock",
    ownerToken: "test-owner",
  };

  const runner = createFullSyncRunner({
    acquireLock: async () => {
      calls.push("acquire");
      return lock;
    },

    renewLock: async (receivedLock) => {
      assert.deepEqual(receivedLock, lock);
      calls.push("renew");
      return true;
    },

    releaseLock: async (receivedLock) => {
      assert.deepEqual(receivedLock, lock);
      calls.push("release");
    },

    syncActive: async () => {
      calls.push("active");
      return 3;
    },

    syncClosed: async () => {
      calls.push("closed");
      return 2;
    },
  });

  const result = await runner({ trigger: "test" });

  assert.equal(result.skipped, false);

  assert.deepEqual(calls, ["acquire", "active", "renew", "closed", "release"]);
});

test("Sync runner: releases distributed lock after a failed sync", async () => {
  let released = false;

  const runner = createFullSyncRunner({
    acquireLock: async () => ({
      lockKey: "test-sync-lock",
      ownerToken: "test-owner",
    }),

    renewLock: async () => true,

    releaseLock: async () => {
      released = true;
    },

    syncActive: async () => {
      throw new Error("Simulated sync failure");
    },

    syncClosed: async () => 0,
  });

  await assert.rejects(runner(), /Simulated sync failure/);

  assert.equal(released, true);
});
