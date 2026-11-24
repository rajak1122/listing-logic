const axios = require("axios");

/**
 * Fetch active IPO data from ScriptTick.
 *
 * A successful empty response returns [].
 * A network failure or unexpected payload throws an error so that
 * the sync process cannot mistake an upstream outage for an empty dataset.
 */
const fetchOpenIpos = async () => {
  let response;

  try {
    response = await axios.get("https://www.scripttick.live/data/entries.txt", {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } catch (error) {
    console.error(
      "[ScriptTick] Request failed:",
      error.response?.status || error.code || error.message,
    );

    throw new Error(`[ScriptTick] Unable to fetch IPO data: ${error.message}`);
  }

  if (typeof response.data !== "string") {
    throw new Error(
      "[ScriptTick] Unexpected response format. Expected text data.",
    );
  }

  const lines = response.data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // A genuinely empty successful response is different from a failed request.
  if (lines.length === 0) {
    console.warn("[ScriptTick] Successful response contained no IPO rows.");
    return [];
  }

  const fetchedIpos = [];

  for (const line of lines) {
    const parts = line.split("|");

    if (parts.length < 12) continue;

    const [
      exchange,
      companyName,
      faceValue,
      priceBand,
      lotSize,
      openDate,
      closeDate,
      allotmentDate,
      creditDate,
      listingDate,
      empDisc,
      gmp,
      issueSize,
      subscription,
      registrar,
    ] = parts;

    if (!companyName?.trim()) continue;

    const parsedGmp = gmp?.replace(/^GMP\s*/i, "").trim();

    fetchedIpos.push({
      companyName: companyName.trim(),

      priceBand: priceBand?.replace(/^Band\s*/i, "").trim() || null,

      // Preserve a missing GMP as null, not an artificial zero.
      // A genuine source value of "0" remains zero.
      gmp: parsedGmp || null,

      dates: {
        open: openDate?.replace(/^Open\s*/i, "").trim() || null,
        close: closeDate?.replace(/^Close\s*/i, "").trim() || null,

        allotment: allotmentDate?.replace(/^Allotment\s*/i, "").trim() || null,

        credit: creditDate?.replace(/^Credit\s*/i, "").trim() || null,

        listing: listingDate?.replace(/^Listing\s*/i, "").trim() || null,
      },

      exchange: exchange?.trim() || null,

      issueSize: issueSize?.replace(/^Issue Size\s*/i, "").trim() || null,

      subscription:
        subscription?.replace(/^Subscription\s*/i, "").trim() || null,

      status: "ACTIVE",
    });
  }

  if (fetchedIpos.length === 0) {
    throw new Error(
      `[ScriptTick] Unexpected payload format. ` +
        `${lines.length} non-empty lines received but no valid IPO records were parsed.`,
    );
  }

  console.log(
    `[ScriptTick] Successfully parsed ${fetchedIpos.length} IPO records.`,
  );

  return fetchedIpos;
};

/**
 * Fetch the BSE public issue list.
 *
 * Validate the expected payload structure instead of silently
 * treating an unexpected response as an empty IPO list.
 */
const fetchBseIpoList = async () => {
  let response;

  try {
    response = await axios.get(
      "https://api.bseindia.com/BseIndiaAPI/api/GetPublicIssue_par_updated/w?flag=1",
      {
        timeout: 15000,
        insecureHTTPParser: true,

        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Origin: "https://www.bseindia.com",
          Referer: "https://www.bseindia.com/",

          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        },
      },
    );
  } catch (error) {
    console.error(
      "[BSE IPO List] Request failed:",
      error.response?.status || error.code || error.message,
    );

    throw new Error(
      `[BSE IPO List] Unable to fetch public issues: ${error.message}`,
    );
  }

  const bseIpos = response.data?.Table;

  if (!Array.isArray(bseIpos)) {
    throw new Error(
      "[BSE IPO List] Unexpected response format. Expected Table array.",
    );
  }

  console.log(
    `[BSE IPO List] Successfully received ${bseIpos.length} records.`,
  );

  return bseIpos;
};

// ==========================================
// BSE IPO COMPANY NAME MATCHING
// ==========================================

const normalizeCompanyName = (name) => {
  return name
    ?.toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

const findBseIpo = (companyName, bseIpos, bseIpoDirectoryCode) => {
  // Prefer the previously verified BSE directory code.
  if (bseIpoDirectoryCode) {
    const byDirectoryCode = bseIpos.find(
      (ipo) => String(ipo.Scrip_cd) === String(bseIpoDirectoryCode),
    );

    if (byDirectoryCode) return byDirectoryCode;
  }

  // Fall back to normalized company-name matching.
  const normalizedName = normalizeCompanyName(companyName);

  return bseIpos.find(
    (ipo) => normalizeCompanyName(ipo.Scrip_Name) === normalizedName,
  );
};

const normalizeBseLookupValue = (value) =>
  String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const extractBseSecurityCandidates = (html) => {
  const candidates = new Map();

  const addCandidate = (candidate) => {
    if (!/^\d{6}$/.test(candidate.code)) return;

    candidates.set(candidate.code, {
      ...candidates.get(candidate.code),
      ...candidate,
    });
  };

  // Format 1: liclick('SCRIP_CODE', 'COMPANY_NAME')
  const clickMatches = [
    ...html.matchAll(/liclick\s*\(\s*['"](\d{6})['"]\s*,\s*['"]([^'"]+)['"]/gi),
  ];

  for (const match of clickMatches) {
    addCandidate({
      code: match[1],
      name: match[2],
    });
  }

  // Format 2: <strong>SYMBOL</strong> ISIN SCRIP_CODE
  const structuredMatches = [
    ...html.matchAll(
      /<strong[^>]*>\s*([^<]+?)\s*<\/strong>\s*([A-Z]{2}[A-Z0-9]{9,})\s*(?:<[^>]+>\s*)?(\d{6})/gi,
    ),
  ];

  for (const match of structuredMatches) {
    addCandidate({
      symbol: match[1],
      isin: match[2],
      code: match[3],
    });
  }

  return [...candidates.values()];
};

const fetchBseSecurityCode = async (
  companyName,
  { symbol = null, isin = null } = {},
) => {
  try {
    const searchTerms = [
      { value: isin, type: "isin" },
      { value: symbol, type: "symbol" },
      { value: companyName, type: "company" },
    ].filter((item) => item.value);

    for (const searchTerm of searchTerms) {
      const response = await axios.get(
        "https://api.bseindia.com/BseIndiaAPI/api/PeerSmartSearch/w",
        {
          params: {
            Type: "SS",
            text: searchTerm.value,
          },
          timeout: 15000,
          insecureHTTPParser: true,
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Origin: "https://www.bseindia.com",
            Referer: "https://www.bseindia.com/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
          },
        },
      );

      const rawData = response.data;

      const rawText = Buffer.isBuffer(rawData)
        ? rawData.toString("utf8")
        : typeof rawData === "string"
          ? rawData
          : JSON.stringify(rawData ?? "");

      const html = rawText.replace(/&nbsp;/gi, " ").trim();

      const candidates = extractBseSecurityCandidates(html);

      if (!candidates.length) continue;

      const normalizedSearch = normalizeBseLookupValue(searchTerm.value);

      const exactMatches = candidates.filter((candidate) => {
        if (
          searchTerm.type === "isin" &&
          candidate.isin?.toUpperCase() === normalizedSearch
        ) {
          return true;
        }

        if (
          searchTerm.type === "symbol" &&
          normalizeBseLookupValue(candidate.symbol) === normalizedSearch
        ) {
          return true;
        }

        if (
          candidate.name &&
          normalizeBseLookupValue(candidate.name) ===
            normalizeBseLookupValue(companyName)
        ) {
          return true;
        }

        return false;
      });

      if (exactMatches.length === 1) {
        console.log(
          `[BSE SECURITY SEARCH] ${companyName} → ${exactMatches[0].code}`,
        );

        return exactMatches[0].code;
      }

      // Company-name search: accept a single unambiguous result only.
      if (searchTerm.type === "company" && candidates.length === 1) {
        console.log(
          `[BSE SECURITY SEARCH] ${companyName} → ${candidates[0].code} (single result)`,
        );

        return candidates[0].code;
      }

      if (exactMatches.length > 1 || candidates.length > 1) {
        console.warn(
          `[BSE SECURITY SEARCH] Ambiguous results for ${companyName}:`,
          candidates.map((item) => item.code),
        );

        return null;
      }
    }

    console.warn(`[BSE SECURITY SEARCH] No verified result for ${companyName}`);

    return null;
  } catch (error) {
    console.error(
      `[BSE SECURITY SEARCH] Failed for ${companyName}:`,
      error.message,
    );

    return null;
  }
};

/** Normalize BSE payload keys so different API casing/wrappers are supported. */
const normalizeBseKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const parseSubscriptionMultiple = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).replace(/,/g, "").trim();
  if (!raw || /^(?:-|—|–|n\/?a|na|nil|not available)$/i.test(raw)) return null;

  // BSE sometimes formats a multiple as "3.45x" or "3.45 times".
  const match = raw.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
};

const getBseField = (row, aliases) => {
  if (!row || typeof row !== "object") return null;
  const wanted = new Set(aliases.map(normalizeBseKey));
  for (const [key, value] of Object.entries(row)) {
    if (
      wanted.has(normalizeBseKey(key)) &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }
  return null;
};

/**
 * BSE has returned subscription payloads under several wrapper names over time
 * (table1, Table1, Table, data, etc.). Unwrap those safely instead of assuming
 * one exact casing. Also accepts a JSON string response.
 */
const extractBseSubscriptionRows = (payload) => {
  const preferredWrappers = [
    "table",
    "table1",
    "rows",
    "records",
    "subscriptiondata",
    "categorydemand",
    "subscriptiondetails",
    "items",
    "data",
    "result",
    "response",
    "payload",
  ];
  const visited = new Set();

  const walk = (value, depth = 0) => {
    if (depth > 6 || value === null || value === undefined) return [];

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || !(trimmed.startsWith("{") || trimmed.startsWith("[")))
        return [];
      try {
        return walk(JSON.parse(trimmed), depth + 1);
      } catch {
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      );
    }

    if (typeof value !== "object" || visited.has(value)) return [];
    visited.add(value);

    const keys = Object.keys(value);
    const normalizedKeys = new Set(keys.map(normalizeBseKey));
    const looksLikeRow =
      normalizedKeys.has("col2") ||
      normalizedKeys.has("col5") ||
      normalizedKeys.has("category") ||
      normalizedKeys.has("categoryname") ||
      normalizedKeys.has("investorcategory") ||
      normalizedKeys.has("srno") ||
      normalizedKeys.has("subscriptionmultiple") ||
      normalizedKeys.has("subscriptionrate");
    if (looksLikeRow) return [value];

    // Try known wrapper names first. Continue to the next wrapper if an earlier
    // wrapper exists but is empty, e.g. { Table: [], Table1: [...] }.
    for (const wrapperName of preferredWrappers) {
      for (const [key, child] of Object.entries(value)) {
        if (normalizeBseKey(key) !== wrapperName) continue;
        const rows = walk(child, depth + 1);
        if (rows.length) return rows;
      }
    }

    // Last resort: inspect nested arrays/objects for a row collection.
    for (const child of Object.values(value)) {
      if (!child || typeof child !== "object") continue;
      const rows = walk(child, depth + 1);
      if (rows.length) return rows;
    }
    return [];
  };

  return walk(payload);
};

const describeBsePayload = (payload, rows = []) => {
  if (typeof payload === "string") {
    return `type=string length=${payload.length} preview=${payload.slice(0, 180).replace(/\s+/g, " ")}`;
  }
  if (Array.isArray(payload)) return `type=array rows=${payload.length}`;
  if (!payload || typeof payload !== "object") return `type=${typeof payload}`;

  const keys = Object.keys(payload);
  const firstRowKeys =
    rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]) : [];
  return `keys=[${keys.slice(0, 20).join(",")}] rows=${rows.length} firstRowKeys=[${firstRowKeys.join(",")}]`;
};

const parseBseSubscriptionRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const categoryLabel = (row) => {
    const explicit = getBseField(row, [
      "col2",
      "category",
      "categoryName",
      "investorCategory",
      "investorType",
      "applicantCategory",
      "categoryDescription",
      "particulars",
      "description",
      "name",
    ]);
    if (explicit !== null) return String(explicit).trim();

    // Some payload variants have no col2 label. Inspect string fields but exclude
    // timestamps and serial numbers so category recognition can still work.
    return Object.entries(row)
      .filter(
        ([key, value]) =>
          typeof value === "string" &&
          !/(?:date|time|srno|serial|col\d+)/i.test(key),
      )
      .map(([, value]) => value.trim())
      .filter(Boolean)
      .join(" ");
  };

  const normalizedCategory = (row) => normalizeBseKey(categoryLabel(row));
  const serialNumber = (row) => {
    const raw = getBseField(row, [
      "SRNo",
      "SrNo",
      "SerialNo",
      "SerialNumber",
      "col1",
    ]);
    const parsed = Number.parseInt(
      String(raw ?? "").replace(/[^0-9]/g, ""),
      10,
    );
    return Number.isFinite(parsed) ? parsed : null;
  };

  const findByCategory = (kind) =>
    rows.find((row) => {
      const label = normalizedCategory(row);
      if (kind === "qib") {
        return (
          label.includes("qualifiedinstitutional") ||
          label === "qib" ||
          label.startsWith("qib(")
        );
      }
      if (kind === "nii") {
        return (
          label.includes("noninstitutional") ||
          label === "nii" ||
          label.startsWith("nii") ||
          label.includes("hni")
        );
      }
      if (kind === "retail") {
        return (
          !label.includes("noninstitutional") &&
          (label.includes("individualinvestor") ||
            label.includes("retail") ||
            label === "rii")
        );
      }
      if (kind === "total")
        return (
          label === "total" ||
          label.startsWith("total") ||
          label === "overall" ||
          label.includes("overallsubscription")
        );
      return false;
    });

  const subscriptionValue = (row) => {
    if (!row) return null;
    const direct = getBseField(row, [
      "col5",
      "subscriptionMultiple",
      "subscriptionRate",
      "subscriptionX",
      "numberOfTimes",
      "noOfTimes",
      "timesSubscribed",
      "multiple",
      "times",
    ]);
    if (direct !== null) return parseSubscriptionMultiple(direct);

    // Handle named fields such as "Subscription (x)" without accidentally
    // treating shares offered/bid or application counts as a multiple.
    for (const [key, value] of Object.entries(row)) {
      const normalized = normalizeBseKey(key);
      if (
        (normalized.includes("subscription") ||
          normalized.includes("multiple") ||
          normalized === "times") &&
        !/(?:shares|offered|bid|application|amount|count|date)/.test(normalized)
      ) {
        const parsed = parseSubscriptionMultiple(value);
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };

  const qibRow =
    findByCategory("qib") || rows.find((row) => serialNumber(row) === 1);
  const niiRow =
    findByCategory("nii") || rows.find((row) => serialNumber(row) === 2);
  const retailRow =
    findByCategory("retail") || rows.find((row) => serialNumber(row) === 3);
  const totalRow = findByCategory("total");

  const qib = subscriptionValue(qibRow);
  const nii = subscriptionValue(niiRow);
  const retail = subscriptionValue(retailRow);
  const total = subscriptionValue(totalRow);
  const hasAnyValue = [qib, nii, retail, total].some((value) => value !== null);
  if (!hasAnyValue) return null;

  const updatedAt =
    rows
      .map((row) =>
        getBseField(row, [
          "Maxdt",
          "updatedAt",
          "lastUpdated",
          "updatedDate",
          "dateUpdated",
        ]),
      )
      .find((value) => value !== null) ?? null;

  return { qib, nii, retail, total, updatedAt };
};

/**
 * Fetch BSE category-wise IPO subscription data. Tries both known BSE endpoints,
 * tolerates response wrapper/key variations, merges partial category results, and
 * returns null only when no category multiple is available.
 */
const fetchBseSubscription = async (ipoNo) => {
  if (ipoNo === null || ipoNo === undefined || String(ipoNo).trim() === "")
    return null;

  const sanitizedIpoNo = String(ipoNo)
    .replace(/\s+/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();

  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,ta;q=0.8",
    Origin: "https://www.bseindia.com",
    Referer: "https://www.bseindia.com/",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  };

  const endpoints = [
    {
      name: "current-category-demand",
      url: "https://api.bseindia.com/BseIndiaAPI/api/Pubissues_GetBkbldgCatdem_PAR_bbnew_ng/w",
    },
    {
      name: "cumulative-category-demand",
      url: "https://api.bseindia.com/BseIndiaAPI/api/Pubissues_BBS_CumultveCatdem_ng/w",
    },
  ];

  const combined = {
    qib: null,
    nii: null,
    retail: null,
    total: null,
    updatedAt: null,
  };
  let anyValue = false;

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        insecureHTTPParser: true,
        params: { IPO_NO: sanitizedIpoNo },
        headers,
        timeout: 12000,
      });

      const rows = extractBseSubscriptionRows(response.data);
      const parsed = parseBseSubscriptionRows(rows);

      if (!parsed) {
        console.warn(
          `[BSE Subscription] IPO ${sanitizedIpoNo} ${endpoint.name}: no usable category multiples; ${describeBsePayload(response.data, rows)}`,
        );
        continue;
      }

      for (const key of ["qib", "nii", "retail", "total"]) {
        // Prefer the current endpoint; use the fallback only to fill missing categories.
        if (
          (combined[key] === null || combined[key] === undefined) &&
          parsed[key] !== null &&
          parsed[key] !== undefined
        ) {
          combined[key] = parsed[key];
        }
        if (combined[key] !== null && combined[key] !== undefined)
          anyValue = true;
      }
      if (!combined.updatedAt && parsed.updatedAt)
        combined.updatedAt = parsed.updatedAt;

      console.log(
        `[BSE Subscription] IPO ${sanitizedIpoNo} ${endpoint.name}: QIB=${combined.qib ?? "N/A"}, NII=${combined.nii ?? "N/A"}, Retail=${combined.retail ?? "N/A"}, Total=${combined.total ?? "N/A"}`,
      );

      // Stop once all four headline values are available; otherwise consult the
      // other endpoint to fill missing categories.
      if (
        [combined.qib, combined.nii, combined.retail, combined.total].every(
          (value) => value !== null,
        )
      )
        break;
    } catch (error) {
      console.warn(
        `[BSE Subscription] IPO ${sanitizedIpoNo} ${endpoint.name} request failed: ${error.response?.status || error.code || error.message}`,
      );
    }
  }

  if (!anyValue) {
    console.warn(
      `[BSE Subscription] No usable subscription values found for IPO ${sanitizedIpoNo}`,
    );
    return null;
  }

  return {
    ...combined,
    QIB: combined.qib,
    NII: combined.nii,
    RII: combined.retail,
    Overall: combined.total,
    source: "BSE",
  };
};

module.exports = {
  fetchOpenIpos,
  fetchBseIpoList,
  normalizeCompanyName,
  findBseIpo,
  fetchBseSubscription,
  extractBseSubscriptionRows,
  parseBseSubscriptionRows,
  fetchBseSecurityCode,
};
