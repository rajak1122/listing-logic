const { fetchCompanyFinancials } = require("../chittorgarhFinancialService");
const {
  enrichFinancialHistoryWithFallback,
} = require("../financialFallbackService");
const { mergeFinancialSnapshot } = require("./dataMerge");

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

module.exports = { fetchCompanyFinancialsWithFallback };
