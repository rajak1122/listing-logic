const Ipo = require("../../models/Ipo");
const { fetchBseSecurityCode } = require("../scraperService");
const { fetchCompanyFinancialsWithFallback } = require("./financialService");
const { parseSourceDate } = require("./dateUtils");

const backfillClosedIpoListingDates = async () => {
  const closedIpos = await Ipo.find({
    status: "CLOSED",
    tentativeListingDate: null,
  })
    .select("_id companyName symbol")
    .lean();

  let updatedCount = 0;
  let failedCount = 0;

  console.log(
    `[Listing Date Backfill] Found ${closedIpos.length} CLOSED IPOs without listing dates.`,
  );

  for (const ipo of closedIpos) {
    try {
      const result = await fetchCompanyFinancialsWithFallback(
        ipo.symbol || ipo.companyName,
        ipo.companyName,
      );

      const listingDate = parseSourceDate(result?.tentativeListingDate);

      if (!listingDate || Number.isNaN(listingDate.getTime())) {
        console.warn(
          `[Listing Date Backfill] No valid date found for ${ipo.companyName}.`,
        );
        continue;
      }

      // Only update if the date is still missing.
      const updateResult = await Ipo.updateOne(
        {
          _id: ipo._id,
          status: "CLOSED",
          tentativeListingDate: null,
        },
        {
          $set: {
            tentativeListingDate: listingDate,
          },
        },
      );

      if (updateResult.modifiedCount > 0) {
        updatedCount++;

        console.log(
          `[Listing Date Backfill] ${ipo.companyName} → ${listingDate.toISOString()}`,
        );
      }
    } catch (error) {
      failedCount++;

      console.error(
        `[Listing Date Backfill] Failed for ${ipo.companyName}:`,
        error.message,
      );
    }
  }

  console.log(
    `[Listing Date Backfill] Completed. Updated: ${updatedCount}, Failed: ${failedCount}`,
  );

  return updatedCount;
};

const backfillClosedIpoScripCodes = async () => {
  const closedIpos = await Ipo.find({
    status: "CLOSED",
  })
    .select("_id companyName symbol bseScripCode")
    .lean();

  // Include missing and malformed security codes.
  const candidates = closedIpos.filter(
    (ipo) => !/^\d{6}$/.test(String(ipo.bseScripCode || "").trim()),
  );

  let updatedCount = 0;
  let failedCount = 0;

  console.log(
    `[Scrip Code Backfill] Found ${candidates.length} CLOSED IPO candidates.`,
  );

  for (const ipo of candidates) {
    try {
      const discoveredCode = await fetchBseSecurityCode(ipo.companyName, {
        symbol: ipo.symbol,
      });

      const scripCode = String(discoveredCode || "").trim();

      // Only accept a valid six-digit BSE security code.
      if (!/^\d{6}$/.test(scripCode)) {
        console.warn(
          `[Scrip Code Backfill] No valid BSE code found for ${ipo.companyName}.`,
        );
        continue;
      }

      // Avoid overwriting a valid code that may have been updated meanwhile.
      const updateResult = await Ipo.updateOne(
        {
          _id: ipo._id,
          status: "CLOSED",
          bseScripCode: ipo.bseScripCode ?? null,
        },
        {
          $set: {
            bseScripCode: scripCode,
          },
        },
      );

      if (updateResult.modifiedCount > 0) {
        updatedCount++;

        console.log(`[Scrip Code Backfill] ${ipo.companyName} → ${scripCode}`);
      }
    } catch (error) {
      failedCount++;

      console.error(
        `[Scrip Code Backfill] Failed for ${ipo.companyName}:`,
        error.message,
      );
    }
  }

  console.log(
    `[Scrip Code Backfill] Completed. Updated: ${updatedCount}, Failed: ${failedCount}`,
  );

  return updatedCount;
};

module.exports = {
  backfillClosedIpoListingDates,
  backfillClosedIpoScripCodes,
};
