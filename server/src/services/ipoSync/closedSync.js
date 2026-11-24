const Ipo = require("../../models/Ipo");

const {
  fetchOpenIpos,
  fetchBseIpoList,
  fetchBseSubscription,
  fetchBseSecurityCode,
} = require("../scraperService");
const { fetchBseListingDayBhavCopyData } = require("../bseBhavcopyService");
const { fetchCompanyFinancialsWithFallback } = require("./financialService");
const { parseSourceDate } = require("./dateUtils");
const {
  isFiniteNumericValue,
  isValidListingPrice,
  parseGmpValue,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
} = require("./dataMerge");
const {
  calculateListingGain,
  promoteToListedIfComplete,
  scheduleListingRetry,
} = require("./listingLifecycle");

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
      const parsedGmp = parseGmpValue(matchingScriptTickIpo.gmp);
      const gmpUpdate = {
        lastSynced: new Date(),
      };

      // Only overwrite the stored GMP when a usable numeric value arrives.
      // A genuine 0 is valid and must be preserved as zero.
      if (Number.isFinite(parsedGmp)) {
        gmpUpdate.gmpData = parsedGmp;
      }

      await Ipo.findOneAndUpdate({ _id: ipo._id }, gmpUpdate, {
        returnDocument: "after",
        runValidators: true,
      });

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
      parseSourceDate(ipo.tentativeListingDate) <= listingCheckNow &&
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

module.exports = { syncClosedIposData };
