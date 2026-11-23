const Ipo = require("../models/Ipo");

const {
  fetchOpenIpos,
  fetchBseIpoList,
  findBseIpo,
  fetchBseSubscription,
  fetchBseSecurityCode,
} = require("./scraperService");

const { fetchCompanyFinancials } = require("./chittorgarhFinancialService");
const {
  enrichFinancialHistoryWithFallback,
} = require("./financialFallbackService");
const { fetchBseListingDayBhavCopyData } = require("./bseBhavcopyService");

const parseSourceDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "string") {
    // DD-MM-YYYY HH:mm:ss
    const match = value.match(
      /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
    );

    if (match) {
      const [, day, month, year, hour = "00", minute = "00", second = "00"] =
        match;

      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
  }

  return new Date(value);
};

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

const isFiniteNumericValue = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const isValidListingPrice = (value) =>
  isFiniteNumericValue(value) && Number(value) > 0;

const calculateListingGain = (listingPrice, issuePrice) => {
  if (!isValidListingPrice(listingPrice) || !isValidListingPrice(issuePrice))
    return null;
  return (
    ((Number(listingPrice) - Number(issuePrice)) / Number(issuePrice)) * 100
  );
};

const hasCompleteListingResult = (ipo) =>
  isValidListingPrice(ipo?.actualListingPrice) &&
  isFiniteNumericValue(ipo?.actualListingGain);

// Promote only when an actual listing price and a numeric gain are both stored.
// A 0% or negative listing gain is still a valid completed listing result.
const promoteToListedIfComplete = async (ipo) => {
  if (!ipo) return false;
  if (ipo.status === "LISTED") return true;

  if (!isValidListingPrice(ipo.actualListingPrice)) return false;

  const computedGain = calculateListingGain(
    ipo.actualListingPrice,
    ipo.upperPriceBand,
  );
  const actualListingGain = isFiniteNumericValue(ipo.actualListingGain)
    ? Number(ipo.actualListingGain)
    : computedGain;

  if (!isFiniteNumericValue(actualListingGain)) return false;

  await Ipo.findOneAndUpdate(
    { _id: ipo._id },
    {
      status: "LISTED",
      actualListingGain,
      nextListingRetryAt: null,
      updatedAt: new Date(),
    },
    { returnDocument: "after", runValidators: true },
  );

  console.log(
    `[Status Update] ${ipo.companyName} → LISTED (opening ₹${Number(ipo.actualListingPrice)}, gain ${Number(actualListingGain).toFixed(2)}%)`,
  );
  return true;
};

const scheduleListingRetry = async (
  ipo,
  reason,
  retryAfterMs = 6 * 60 * 60 * 1000,
) => {
  const nextListingRetryAt = new Date(Date.now() + retryAfterMs);
  await Ipo.findOneAndUpdate(
    { _id: ipo._id },
    { nextListingRetryAt, updatedAt: new Date() },
    { returnDocument: "after", runValidators: true },
  );
  console.log(
    `[Listing Update] ${ipo.companyName} → ${reason}; retry after ${nextListingRetryAt.toISOString()}`,
  );
};

// Do not erase the last known subscription snapshot when the exchange endpoint
// has a transient empty response. Merge partial fresh values category-by-category.
const mergeSubscriptionDemand = (existing = {}, incoming = null) => {
  const oldData = toPlainObject(existing) || {};
  const newData = incoming || {};
  const pick = (next, previous) =>
    next !== null && next !== undefined && next !== ""
      ? next
      : (previous ?? null);

  const incomingUpdatedAt = newData.updatedAt
    ? parseSourceDate(newData.updatedAt)
    : null;
  return {
    qib: pick(newData.qib, oldData.qib),
    nii: pick(newData.nii, oldData.nii),
    retail: pick(newData.retail, oldData.retail),
    overallSubscriptionRate: pick(
      newData.total,
      oldData.overallSubscriptionRate ?? oldData.total,
    ),
    updatedAt:
      incomingUpdatedAt && !Number.isNaN(incomingUpdatedAt.getTime())
        ? incomingUpdatedAt
        : (oldData.updatedAt ?? null),
  };
};

const mergeFinancialSnapshot = (existing = {}, incoming = {}) => {
  const oldData = toPlainObject(existing) || {};
  const newData = toPlainObject(incoming) || {};
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const merged = {};

  for (const key of keys) {
    const nextValue = newData[key];
    const previousValue = oldData[key];
    merged[key] =
      nextValue !== null && nextValue !== undefined
        ? nextValue
        : (previousValue ?? null);
  }

  return merged;
};

const historyRecordKey = (row) => {
  const item = toPlainObject(row) || {};
  if (item.periodEnded) {
    const parsed = new Date(item.periodEnded);
    if (!Number.isNaN(parsed.getTime()))
      return parsed.toISOString().slice(0, 10);
  }
  return String(item.financialYear || item.year || "")
    .trim()
    .toLowerCase();
};

const mergeFinancialHistory = (existing = [], incoming = []) => {
  const rowsByKey = new Map();

  for (const rawRow of [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ]) {
    const row = toPlainObject(rawRow) || {};
    const key = historyRecordKey(row);
    if (!key) continue;

    const previous = rowsByKey.get(key) || {};
    const merged = { ...previous };
    for (const [field, value] of Object.entries(row)) {
      // Null values from a partial scrape must not erase previously saved data.
      if (value !== null && value !== undefined && value !== "")
        merged[field] = value;
      else if (!(field in merged)) merged[field] = value ?? null;
    }
    rowsByKey.set(key, merged);
  }

  return [...rowsByKey.values()].sort((a, b) => {
    const dateA = a.periodEnded ? new Date(a.periodEnded).getTime() : 0;
    const dateB = b.periodEnded ? new Date(b.periodEnded).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return String(a.financialYear || "").localeCompare(
      String(b.financialYear || ""),
    );
  });
};

// Chittorgarh remains the primary source. IPOPlatform is consulted only when
// key historical fields are missing, and its source URL is stored separately.
const fetchCompanyFinancialsWithFallback = async (
  lookupName,
  companyName = lookupName,
) => {
  const primary = await fetchCompanyFinancials(lookupName);
  const fallback = await enrichFinancialHistoryWithFallback({
    companyName,
    primarySourceUrl: primary?.sourceUrl || null,
    financialHistory: primary?.financialHistory || [],
  });

  return {
    ...primary,
    financialHistory: fallback.financialHistory,
    financials: mergeFinancialSnapshot(
      primary?.financials,
      fallback.financialsPatch,
    ),
    fallbackSourceUrl: fallback.sourceUrl || null,
  };
};

const syncActiveIposData = async () => {
  // --------------------------------
  // 1. Fetch IPO sources
  // --------------------------------
  const [liveOpenIpos, bseIpos] = await Promise.all([
    fetchOpenIpos(),
    fetchBseIpoList(),
  ]);

  let syncedCount = 0;

  // --------------------------------
  // 2. Process only BSE-matched IPOs
  // --------------------------------
  for (const item of liveOpenIpos) {
    const existingIpo = await Ipo.findOne({ companyName: item.companyName });

    // A completed listing is terminal for the regular live-IPO sync.
    // Do this before subscription and financial fetches to avoid repeat API work.
    if (await promoteToListedIfComplete(existingIpo)) {
      console.log(`[Sync Skip] ${item.companyName}: status LISTED`);
      continue;
    }

    const matchedBseIpo = findBseIpo(
      item.companyName,
      bseIpos,
      existingIpo?.bseIpoDirectoryCode,
    );

    if (!matchedBseIpo) {
      if (item.companyName.toLowerCase().includes("srit")) {
        console.log("[SRIT BSE MATCH FAILED]", item.companyName);
      }

      continue;
    }

    // --------------------------------
    // 3. Fetch current subscription data
    // --------------------------------
    const subscription = await fetchBseSubscription(matchedBseIpo.IPO_NO);

    // --------------------------------
    // 4. Fetch company financials
    // --------------------------------
    const {
      financials,
      financialHistory = [],
      issueSizeCr: chittorgarhIssueSizeCr,
      tentativeListingDate,
    } = await fetchCompanyFinancialsWithFallback(
      item.symbol || item.companyName,
      item.companyName,
    );

    // --------------------------------
    // 5. Prepare price data
    // --------------------------------
    const priceBand = item.priceBand || matchedBseIpo.Price_Band || "";

    const priceParts = priceBand
      .split("-")
      .map((value) => Number(value.trim()));

    const upperPriceBand =
      priceParts.length > 1
        ? priceParts[priceParts.length - 1]
        : Number(priceParts[0] || 0);

    // Preserve any previously saved listing result. Never reset a completed
    // result to null just because a later source response is empty.
    const existingBseCode = String(existingIpo?.bseScripCode || "").trim();

    let resolvedBseScripCode = /^\d{6}$/.test(existingBseCode)
      ? existingBseCode
      : null;
    let actualListingPrice = isValidListingPrice(
      existingIpo?.actualListingPrice,
    )
      ? Number(existingIpo.actualListingPrice)
      : null;
    let actualListingGain = isFiniteNumericValue(existingIpo?.actualListingGain)
      ? Number(existingIpo.actualListingGain)
      : null;

    const parsedTentativeListingDate = tentativeListingDate
      ? new Date(tentativeListingDate)
      : null;
    const listingDateHasPassed =
      parsedTentativeListingDate &&
      !Number.isNaN(parsedTentativeListingDate.getTime()) &&
      parsedTentativeListingDate <= new Date();

    if (
      listingDateHasPassed &&
      !isValidListingPrice(actualListingPrice) &&
      upperPriceBand > 0
    ) {
      // BSE IPO catalogue codes can be short IPO identifiers, not market
      // security codes. Use only six-digit security codes for market-price APIs.
      let actualBseScripCode = resolvedBseScripCode;
      if (!/^\d{6}$/.test(String(actualBseScripCode || ""))) {
        actualBseScripCode = await fetchBseSecurityCode(item.companyName);
      }
      if (/^\d{6}$/.test(String(actualBseScripCode || ""))) {
        resolvedBseScripCode = String(actualBseScripCode);
        const listingData = await fetchBseListingDayBhavCopyData(
          actualBseScripCode,
          parsedTentativeListingDate,
        );

        if (isValidListingPrice(listingData?.openingPrice)) {
          actualListingPrice = Number(listingData.openingPrice);
        }
      }

      if (isValidListingPrice(actualListingPrice)) {
        actualListingGain = calculateListingGain(
          actualListingPrice,
          upperPriceBand,
        );
      }
    }

    // --------------------------------
    // 6. Prepare issue size
    // --------------------------------
    const parsedIssueSize = Number.parseFloat(
      item.issueSize?.replace(/[^\d.]/g, ""),
    );

    const scriptTickIssueSizeCr = Number.isFinite(parsedIssueSize)
      ? parsedIssueSize
      : null;

    const issueSizeCr = scriptTickIssueSizeCr ?? chittorgarhIssueSizeCr;

    // --------------------------------
    // 7. Build IPO document
    // --------------------------------
    const parsedGmp = Number.parseFloat(item.gmp);

    const gmpValue = Number.isFinite(parsedGmp) ? parsedGmp : null;

    const now = new Date();

    let ipoStatus = "ACTIVE";

    const openDate = matchedBseIpo.Start_Dt
      ? new Date(matchedBseIpo.Start_Dt)
      : null;

    const closeDate = matchedBseIpo.End_Dt
      ? new Date(matchedBseIpo.End_Dt)
      : null;

    if (closeDate) {
      closeDate.setHours(23, 59, 59, 999);
    }

    if (openDate && now < openDate) {
      ipoStatus = "UPCOMING";
    } else if (closeDate && now > closeDate) {
      ipoStatus = "CLOSED";
    }

    if (
      isValidListingPrice(actualListingPrice) &&
      isFiniteNumericValue(actualListingGain)
    ) {
      ipoStatus = "LISTED";
    }

    const finalFinancials = mergeFinancialSnapshot(
      existingIpo?.financials,
      financials,
    );
    const finalFinancialHistory = mergeFinancialHistory(
      existingIpo?.financialHistory,
      financialHistory,
    );

    const ipoData = {
      companyName: item.companyName,

      exchange: "BSE",

      ipoType: matchedBseIpo.eXCHANGE_PLATFORM || null,

      openDate,
      closeDate,

      tentativeListingDate:
        tentativeListingDate || existingIpo?.tentativeListingDate || null,

      bseScripCode: resolvedBseScripCode,

      bseIpoNumber: matchedBseIpo.IPO_NO ? String(matchedBseIpo.IPO_NO) : null,

      bseIpoDirectoryCode:
        matchedBseIpo.Scrip_cd != null
          ? String(matchedBseIpo.Scrip_cd)
          : existingIpo?.bseIpoDirectoryCode || null,

      actualListingPrice,
      actualListingGain,
      nextListingRetryAt:
        ipoStatus === "LISTED"
          ? null
          : (existingIpo?.nextListingRetryAt ?? null),

      priceBand,

      upperPriceBand,

      issueSize: item.issueSize || null,

      issueSizeCr,

      status: ipoStatus,

      // Current GMP
      gmpData: gmpValue,

      // Current subscription snapshot. Preserve last known values if BSE returns
      // an empty/partial response so a temporary fetch failure does not erase data.
      subscriptionDemand: mergeSubscriptionDemand(
        existingIpo?.subscriptionDemand,
        subscription,
      ),

      // Current financial snapshot and year-wise history for Company Quality.
      financials: finalFinancials,
      financialHistory: finalFinancialHistory,
      ...(financialHistory.length
        ? { financialHistoryLastSynced: new Date() }
        : {}),

      lastSynced: new Date(),
    };

    // --------------------------------
    // 8. Save / update IPO
    // --------------------------------
    await Ipo.findOneAndUpdate({ companyName: item.companyName }, ipoData, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    });

    syncedCount++;
  }
  await closeExpiredActiveIpos();

  return syncedCount;
};

const closeExpiredActiveIpos = async () => {
  const now = new Date();

  const result = await Ipo.updateMany(
    {
      status: "ACTIVE",
      closeDate: { $lt: now },
    },
    {
      $set: {
        status: "CLOSED",
        updatedAt: now,
      },
    },
  );

  console.log(
    `[Status Update] ${result.modifiedCount} IPOs moved ACTIVE → CLOSED`,
  );

  return result.modifiedCount;
};

const syncClosedIposData = async () => {
  // LISTED is terminal: no repeated GMP/subscription/financial sync for it.
  // Only CLOSED IPOs remain eligible for listing-result completion and retries.
  const closedIpos = await Ipo.find({ status: "CLOSED" });
  if (!closedIpos.length) {
    console.log("[Sync] No CLOSED IPOs awaiting listing results");
    return 0;
  }

  // Fetch broad live sources only when there are CLOSED records to process.
  const [liveIpos, bseIpos] = await Promise.all([
    fetchOpenIpos(),
    fetchBseIpoList(),
  ]);

  let updatedCount = 0;

  // --------------------------------
  // 3. Process CLOSED IPOs
  // --------------------------------
  for (const ipo of closedIpos) {
    // Recover any record where price/gain persisted but status transition did not.
    if (await promoteToListedIfComplete(ipo)) {
      console.log(
        `[Sync Skip] ${ipo.companyName}: listing result already complete`,
      );
      continue;
    }

    // Backfill historical financials once for closed IPOs still awaiting a listing result.
    // Failed/empty lookups are retried no more than once every 7 days.
    const lastFinancialAttempt = ipo.financialHistoryLastSynced
      ? new Date(ipo.financialHistoryLastSynced).getTime()
      : 0;
    const retryWindowMs = 7 * 24 * 60 * 60 * 1000;
    const currentHistory = Array.isArray(ipo.financialHistory)
      ? ipo.financialHistory
      : [];
    const historyMissing = currentHistory.length === 0;
    const epsMissing =
      ipo.financials?.eps === null || ipo.financials?.eps === undefined;
    const fallbackMetricsMissing = currentHistory.some(
      (row) =>
        row &&
        (row.revenueFromOperations === null ||
          row.revenueFromOperations === undefined ||
          row.eps === null ||
          row.eps === undefined),
    );
    const shouldFetchFinancials =
      (historyMissing || epsMissing || fallbackMetricsMissing) &&
      (!lastFinancialAttempt ||
        Date.now() - lastFinancialAttempt >= retryWindowMs);

    if (shouldFetchFinancials) {
      const result = await fetchCompanyFinancialsWithFallback(
        ipo.symbol || ipo.companyName,
        ipo.companyName,
      );
      const fetchedHistory = Array.isArray(result?.financialHistory)
        ? result.financialHistory
        : [];
      const mergedHistory = mergeFinancialHistory(
        ipo.financialHistory,
        fetchedHistory,
      );
      const mergedSnapshot = mergeFinancialSnapshot(
        ipo.financials,
        result?.financials,
      );
      const hasSnapshotData = Object.values(result?.financials || {}).some(
        (value) => value !== null && value !== undefined,
      );

      if (fetchedHistory.length || hasSnapshotData) {
        const update = {
          financials: mergedSnapshot,
          financialHistory: mergedHistory,
          financialHistoryLastSynced: new Date(),
          lastSynced: new Date(),
        };
        if (
          !ipo.issueSizeCr &&
          result?.issueSizeCr !== null &&
          result?.issueSizeCr !== undefined
        ) {
          update.issueSizeCr = result.issueSizeCr;
        }
        if (!ipo.tentativeListingDate && result?.tentativeListingDate) {
          update.tentativeListingDate = result.tentativeListingDate;
        }

        await Ipo.findOneAndUpdate({ _id: ipo._id }, update, {
          returnDocument: "after",
          runValidators: true,
        });
        updatedCount++;
        console.log(
          `[Company Quality] ${ipo.companyName}: saved ${mergedHistory.length} historical periods`,
        );
      } else {
        await Ipo.findOneAndUpdate(
          { _id: ipo._id },
          { financialHistoryLastSynced: new Date() },
          { returnDocument: "after", runValidators: true },
        );
        console.warn(
          `[Company Quality] No Chittorgarh history returned for ${ipo.companyName}`,
        );
      }
    }

    const matchingScriptTickIpo = liveIpos.find(
      (item) =>
        item.companyName?.toLowerCase().trim() ===
        ipo.companyName?.toLowerCase().trim(),
    );

    // --------------------------------
    // 3A. Update current GMP if ScriptTick match exists
    // --------------------------------
    if (matchingScriptTickIpo) {
      const parsedGmp = Number.parseFloat(matchingScriptTickIpo.gmp);

      const gmpValue = Number.isFinite(parsedGmp) ? parsedGmp : null;

      await Ipo.findOneAndUpdate(
        { _id: ipo._id },
        {
          gmpData: gmpValue,
          lastSynced: new Date(),
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      updatedCount++;
    }

    // --------------------------------
    // 3C. Refresh subscription data
    // --------------------------------
    const ipoNumber = ipo.bseIpoNumber;

    console.log(`[Subscription] ${ipo.companyName} → IPO_NO: ${ipoNumber}`);

    if (ipoNumber) {
      const subscription = await fetchBseSubscription(ipoNumber);

      // console.log(
      //   `[Subscription] ${ipo.companyName} → Response:`,
      //   subscription,
      // );

      if (subscription) {
        await Ipo.findOneAndUpdate(
          { _id: ipo._id },
          {
            subscriptionDemand: mergeSubscriptionDemand(
              ipo.subscriptionDemand,
              subscription,
            ),
            lastSynced: new Date(),
          },
          {
            returnDocument: "after",
            runValidators: true,
          },
        );

        updatedCount++;
      } else {
        console.warn(
          `[Subscription] ${ipo.companyName}: BSE returned no usable values; keeping stored subscription snapshot`,
        );
      }
    }

    // --------------------------------
    // 3D. Discover and persist BSE security code
    // --------------------------------
    const listingCheckNow = new Date();

    const listingRetryDue =
      !ipo.nextListingRetryAt ||
      new Date(ipo.nextListingRetryAt) <= listingCheckNow;

    let actualBseScripCode = String(ipo.bseScripCode || "").trim();

    // Discover security code once the listing date is reached.
    if (
      ipo.tentativeListingDate &&
      new Date(ipo.tentativeListingDate) <= listingCheckNow &&
      !/^\d{6}$/.test(actualBseScripCode) &&
      listingRetryDue
    ) {
      const discoveredCode = await fetchBseSecurityCode(ipo.companyName, {
        symbol: ipo.symbol,
        isin: ipo.isin,
      });

      if (/^\d{6}$/.test(String(discoveredCode || ""))) {
        actualBseScripCode = String(discoveredCode);

        await Ipo.findOneAndUpdate(
          { _id: ipo._id },
          {
            $set: {
              bseScripCode: actualBseScripCode,
              bseIpoDirectoryCode: ipo.bseIpoDirectoryCode,
              nextListingRetryAt: null,
              updatedAt: new Date(),
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
          },
        );

        ipo.bseScripCode = actualBseScripCode;
        ipo.nextListingRetryAt = null;

        console.log(
          `[BSE SECURITY SAVED] ${ipo.companyName} → ${actualBseScripCode}`,
        );
      } else {
        await scheduleListingRetry(
          ipo,
          "BSE security code not available yet",
          30 * 60 * 1000,
        );
      }
    }

    // --------------------------------
    // 3E. Capture actual listing price
    // --------------------------------

    const listingDateReached =
      ipo.tentativeListingDate &&
      new Date(ipo.tentativeListingDate) <= listingCheckNow;

    const validSecurityCode = /^\d{6}$/.test(actualBseScripCode);

    if (
      listingDateReached &&
      validSecurityCode &&
      isValidListingPrice(ipo.upperPriceBand) &&
      !isValidListingPrice(ipo.actualListingPrice) &&
      listingRetryDue
    ) {
      console.log(
        `[Listing Update] Checking ${ipo.companyName} → BSE ${actualBseScripCode}`,
      );

      // Fetch the exact listing-day opening price from BSE Bhavcopy.
      const listingData = await fetchBseListingDayBhavCopyData(
        actualBseScripCode,
        ipo.tentativeListingDate,
      );

      const actualListingPrice = isValidListingPrice(listingData?.openingPrice)
        ? Number(listingData.openingPrice)
        : null;

      const actualListingGain =
        actualListingPrice !== null
          ? calculateListingGain(actualListingPrice, ipo.upperPriceBand)
          : null;

      if (
        isValidListingPrice(actualListingPrice) &&
        isFiniteNumericValue(actualListingGain)
      ) {
        await Ipo.findOneAndUpdate(
          { _id: ipo._id },
          {
            $set: {
              bseScripCode: actualBseScripCode,
              actualListingPrice,
              actualListingGain,
              status: "LISTED",
              nextListingRetryAt: null,
              lastSynced: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
          },
        );

        updatedCount++;

        console.log(
          `[Listing Update] ${ipo.companyName} → LISTED: opening ₹${actualListingPrice}, gain ${actualListingGain.toFixed(2)}%`,
        );
      } else {
        await scheduleListingRetry(
          ipo,
          "BSE listing-day Bhavcopy unavailable or opening price invalid",
        );
      }
    }
  }
};

module.exports = {
  syncActiveIposData,
  syncClosedIposData,
};
