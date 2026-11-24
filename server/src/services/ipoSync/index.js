// Public service facade: keep existing import paths and exports compatible.

const { parseSourceDate } = require("./dateUtils");
const {
  parseGmpValue,
  resolveGmpValue,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
} = require("./dataMerge");
const {
  calculateListingGain,
  promoteToListedIfComplete,
} = require("./listingLifecycle");
const { syncActiveIposData } = require("./activeSync");
const { syncClosedIposData } = require("./closedSync");
const {
  backfillClosedIpoListingDates,
  backfillClosedIpoScripCodes,
} = require("./backfillService");
const { createFullSyncRunner, runFullIpoSync } = require("./syncCoordinator");

module.exports = {
  syncActiveIposData,
  syncClosedIposData,
  runFullIpoSync,
  backfillClosedIpoListingDates,
  backfillClosedIpoScripCodes,
  parseSourceDate,
  parseGmpValue,
  resolveGmpValue,
  calculateListingGain,
  promoteToListedIfComplete,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
  createFullSyncRunner,
};
