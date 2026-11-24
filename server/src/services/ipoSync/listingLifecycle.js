const Ipo = require("../../models/Ipo");

const { isFiniteNumericValue, isValidListingPrice } = require("./dataMerge");

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

module.exports = {
  calculateListingGain,
  hasCompleteListingResult,
  promoteToListedIfComplete,
  scheduleListingRetry,
};
