const Ipo = require("../../models/Ipo");

const {
  fetchOpenIpos,
  fetchBseIpoList,
  findBseIpo,
  fetchBseSubscription,
  fetchBseSecurityCode,
} = require("../scraperService");
const { fetchBseListingDayBhavCopyData } = require("../bseBhavcopyService");
const { fetchCompanyFinancialsWithFallback } = require("./financialService");
const { parseSourceDate } = require("./dateUtils");
const {
  isFiniteNumericValue,
  isValidListingPrice,
  resolveGmpValue,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
} = require("./dataMerge");
const {
  calculateListingGain,
  promoteToListedIfComplete,
} = require("./listingLifecycle");

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

    const parsedTentativeListingDate = parseSourceDate(tentativeListingDate);
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
    const gmpValue = resolveGmpValue(item.gmp, existingIpo?.gmpData);

    const now = new Date();

    let ipoStatus = "ACTIVE";

    const openDate = parseSourceDate(matchedBseIpo.Start_Dt);

    const closeDate = parseSourceDate(matchedBseIpo.End_Dt, { endOfDay: true });

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

module.exports = { syncActiveIposData, closeExpiredActiveIpos };
