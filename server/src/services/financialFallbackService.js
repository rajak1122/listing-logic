const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.ipoplatform.com";
const DIRECTORY_URLS = [
  `${BASE_URL}/list-of-mainboard-ipos`,
  `${BASE_URL}/list-of-sme-ipos`,
];
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000;

// In-memory caches keep scheduled syncs from repeatedly downloading the same
// IPOPlatform pages in one server process.
const htmlCache = new Map();
const resultCache = new Map();
const directoryCache = new Map();

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const normalizeCompanyName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|private|pvt)\b/g, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const normalizeMetricLabel = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getCellTexts = ($, row) =>
  $(row)
    .children("th, td")
    .map((_, cell) => $(cell).text().replace(/\s+/g, " ").trim())
    .get();

const makePeriod = (year, month, day) => {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const isoDate = date.toISOString().slice(0, 10);
  const isFiscalYearEnd = month === 3 && day >= 28;
  const label = isFiscalYearEnd
    ? `FY ${year}`
    : `${String(day).padStart(2, "0")} ${date.toLocaleString("en-GB", {
        month: "short",
        timeZone: "UTC",
      })} ${year}`;

  return {
    isoDate,
    periodEnded: `${isoDate}T00:00:00.000Z`,
    financialYear: label,
  };
};

const expandYear = (yearText) => {
  const year = Number(yearText);
  if (!Number.isFinite(year)) return null;
  return String(yearText).length === 2 ? 2000 + year : year;
};

// Supports IPOPlatform headings such as 30-Jun-26, Jun-26, FY26 and FY 2026.
const parsePeriodHeader = (input) => {
  const text = String(input ?? "")
    .replace(/\*/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  let match = text.match(/^(\d{1,2})[\s/-]+([A-Za-z]{3,9})[\s/-]+(\d{2,4})$/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    const year = expandYear(match[3]);
    return month && year ? makePeriod(year, month, Number(match[1])) : null;
  }

  match = text.match(/^([A-Za-z]{3,9})[\s/-]+(\d{2,4})$/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const year = expandYear(match[2]);
    if (!month || !year) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return makePeriod(year, month, lastDay);
  }

  match = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match)
    return makePeriod(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^FY\s*[- ]?(20\d{2}|\d{2})$/i);
  if (match) return makePeriod(expandYear(match[1]), 3, 31);

  return null;
};

// Reads the first figure in a cell. On IPOPlatform's June stub-period Revenue
// cells, the first number is the actual stub-period figure and the next number
// is the annualised equivalent; we intentionally take the first number only.
const parseFinancialNumber = (input) => {
  if (input === null || input === undefined) return null;
  const raw = String(input)
    .replace(/\u00a0/g, " ")
    .trim();
  if (!raw || /^(?:-|—|–|n\/?a|na|nil|\[●\]|\[\s*●\s*\])$/i.test(raw))
    return null;

  const isParenthesesNegative = /^\(.*\)$/.test(raw);
  const match = raw.match(/[-+]?\s*\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(/[\s,]/g, ""));
  if (!Number.isFinite(number)) return null;
  return isParenthesesNegative && number > 0 ? -number : number;
};

const classifyMetric = (label) => {
  const metric = normalizeMetricLabel(label);

  if (
    /^(?:revenue growth|revenue growth yoy|revenue growth \(%\))$/.test(metric)
  ) {
    return { key: "revenueGrowthYoy", priority: 2 };
  }
  // IPOPlatform labels the operating-revenue row simply "Revenue" and notes
  // that it is Revenue from Operations in the restated financial statements.
  if (/^revenue\b/.test(metric) || /^revenue from operations\b/.test(metric)) {
    return { key: "revenueFromOperations", priority: 2 };
  }
  if (/^(?:total income|total revenue)$/.test(metric)) {
    return { key: "totalIncome", priority: 1 };
  }
  // Match the specific PAT Margin label first.
  if (/^pat margin\b/.test(metric)) {
    return { key: "patMargin", priority: 2 };
  }

  // Match generic PAT / Profit After Tax only after PAT Margin.
  if (/^(?:pat|profit after tax|profit after taxation)\b/.test(metric)) {
    return { key: "profitAfterTax", priority: 2 };
  }
  if (/^(?:eps|basic eps|diluted eps|earnings per share)\b/.test(metric)) {
    const basic =
      /\bbasic\b/.test(metric) || /post[- ]bonus basic eps/i.test(metric);
    const diluted = /\bdiluted\b/.test(metric);
    return {
      key: "eps",
      priority: basic ? 3 : diluted ? 2 : 1,
      epsBasis: basic ? "BASIC" : diluted ? "DILUTED" : "REPORTED",
    };
  }
  if (/^net worth\b|^networth\b/.test(metric)) {
    return { key: "netWorth", priority: 2 };
  }
  if (/^(?:total debt|total borrowings?|borrowings?)\b/.test(metric)) {
    return { key: "totalBorrowing", priority: 2 };
  }
  if (/^debt\s*\/\s*equity\b|^debt to equity\b|^d\/e\b/.test(metric)) {
    return { key: "debtToEquity", priority: 2 };
  }
  if (/^roe\b|^return on equity\b/.test(metric))
    return { key: "roe", priority: 2 };
  if (/^p\s*\/\s*e\b|^p\/e\b|^pe ratio\b/.test(metric)) {
    return { key: "peRatio", priority: 1 };
  }
  return null;
};

const createRecord = (period, sourceUrl, fetchedAt) => ({
  financialYear: period.financialYear,
  periodEnded: period.periodEnded,
  totalIncome: null,
  revenueFromOperations: null,
  profitAfterTax: null,
  eps: null,
  epsBasis: null,
  netWorth: null,
  totalBorrowing: null,
  revenueGrowthYoy: null,
  patMargin: null,
  debtToEquity: null,
  roe: null,
  peRatio: null,
  fallbackSourceUrl: sourceUrl,
  fallbackFetchedAt: fetchedAt,
});

const extractFinancialHistoryFromHtml = (
  html,
  sourceUrl,
  fetchedAt = new Date(),
) => {
  const $ = cheerio.load(html);
  const recordsByDate = new Map();
  const priorities = new Map();
  const bodyText = $("body").text();
  const postBonusBasic = /post[-\s]*bonus\s+basic\s+eps/i.test(bodyText);

  const ensurePeriod = (period) => {
    if (!recordsByDate.has(period.isoDate)) {
      recordsByDate.set(
        period.isoDate,
        createRecord(period, sourceUrl, fetchedAt),
      );
    }
    return recordsByDate.get(period.isoDate);
  };

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    let selectedHeader = null;

    rows.forEach((row, rowIndex) => {
      const cells = getCellTexts($, row);
      const periodCells = cells
        .map((cell, cellIndex) => ({
          cellIndex,
          period: parsePeriodHeader(cell),
        }))
        .filter((entry) => entry.period);

      if (
        periodCells.length >= 2 &&
        (!selectedHeader ||
          periodCells.length > selectedHeader.periodCells.length)
      ) {
        selectedHeader = { rowIndex, periodCells };
      }
    });

    if (!selectedHeader) return;

    rows.slice(selectedHeader.rowIndex + 1).forEach((row) => {
      const cells = getCellTexts($, row);
      if (cells.length < 2) return;

      const metric = classifyMetric(cells[0]);
      if (!metric) return;

      selectedHeader.periodCells.forEach(({ cellIndex, period }) => {
        if (cellIndex >= cells.length) return;
        const value = parseFinancialNumber(cells[cellIndex]);
        if (value === null) return;

        const record = ensurePeriod(period);
        const priorityKey = `${period.isoDate}:${metric.key}`;
        const previousPriority = priorities.get(priorityKey) ?? 0;
        if (metric.priority < previousPriority) return;

        record[metric.key] = value;
        priorities.set(priorityKey, metric.priority);
        if (metric.key === "eps") {
          record.epsBasis =
            metric.epsBasis === "REPORTED" && postBonusBasic
              ? "BASIC"
              : metric.epsBasis;
        }
      });
    });
  });

  const records = [...recordsByDate.values()].sort(
    (a, b) => new Date(a.periodEnded) - new Date(b.periodEnded),
  );

  // Prefer reported source ratios; only derive PAT margin when absent and the
  // correct Revenue-from-Operations denominator is available for that period.
  for (const row of records) {
    if (
      row.patMargin === null &&
      row.profitAfterTax !== null &&
      row.revenueFromOperations !== null &&
      row.revenueFromOperations !== 0
    ) {
      row.patMargin = Number(
        ((row.profitAfterTax / row.revenueFromOperations) * 100).toFixed(2),
      );
    }
  }

  const annualRecords = records.filter((row) => {
    const date = new Date(row.periodEnded);
    return date.getUTCMonth() === 2 && date.getUTCDate() >= 28;
  });
  for (const row of annualRecords) {
    if (row.revenueGrowthYoy !== null || row.revenueFromOperations === null)
      continue;
    const year = new Date(row.periodEnded).getUTCFullYear();
    const previous = annualRecords.find(
      (candidate) =>
        new Date(candidate.periodEnded).getUTCFullYear() === year - 1,
    );
    if (
      previous?.revenueFromOperations != null &&
      previous.revenueFromOperations !== 0
    ) {
      row.revenueGrowthYoy = Number(
        (
          ((row.revenueFromOperations - previous.revenueFromOperations) /
            previous.revenueFromOperations) *
          100
        ).toFixed(2),
      );
    }
  }

  return records.filter((row) =>
    [
      "revenueFromOperations",
      "profitAfterTax",
      "eps",
      "netWorth",
      "totalBorrowing",
      "revenueGrowthYoy",
      "patMargin",
      "debtToEquity",
      "roe",
      "peRatio",
    ].some((key) => row[key] !== null),
  );
};

const getSlugFromUrl = (url) => {
  if (!url) return null;
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const ipoIndex = parts.indexOf("ipo");
    if (ipoIndex >= 0 && parts[ipoIndex + 1]) return parts[ipoIndex + 1];
  } catch {
    // Ignore malformed source URLs.
  }
  return null;
};

const slugifyCompany = (name) => {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|private|pvt)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return slug.endsWith("-ipo") ? slug : `${slug}-ipo`;
};

const getHtml = async (url) => {
  const cached = htmlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.html;

  try {
    const response = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
    });
    const html = typeof response.data === "string" ? response.data : "";
    if (!html) return null;
    htmlCache.set(url, { html, expiresAt: Date.now() + CACHE_TTL_MS });
    return html;
  } catch (error) {
    htmlCache.set(url, {
      html: null,
      expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
    });
    console.warn(
      `[Financial Fallback] Request failed for ${url}: ${error.message}`,
    );
    return null;
  }
};

const parseFallbackPage = (html, url) => {
  if (!html) return null;
  const history = extractFinancialHistoryFromHtml(html, url, new Date());
  const hasTargetMetrics = history.some(
    (row) => row.revenueFromOperations !== null || row.eps !== null,
  );
  if (!hasTargetMetrics) return null;
  return { url, financialHistory: history };
};

const reportLinksFromHtml = (html, preferredSlug = null) => {
  if (!html) return [];
  const $ = cheerio.load(html);
  const links = [];
  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href || !/\/ipo\/financial-report\//i.test(href)) return;
    const absolute = new URL(href, BASE_URL).href;
    if (!links.includes(absolute)) links.push(absolute);
  });
  if (preferredSlug) {
    const preferred = normalizeCompanyName(preferredSlug);
    links.sort((a, b) => {
      const slugFromReportUrl = (url) => {
        try {
          const parts = new URL(url).pathname.split("/").filter(Boolean);
          const reportIndex = parts.indexOf("financial-report");
          return normalizeCompanyName(parts[reportIndex + 1] || "");
        } catch {
          return "";
        }
      };
      const aMatch =
        slugFromReportUrl(a).includes(preferred) ||
        preferred.includes(slugFromReportUrl(a));
      const bMatch =
        slugFromReportUrl(b).includes(preferred) ||
        preferred.includes(slugFromReportUrl(b));
      return Number(bMatch) - Number(aMatch);
    });
  }
  return links;
};

const fetchReportFromProfile = async (profileUrl) => {
  const html = await getHtml(profileUrl);
  if (!html) return null;
  let preferredSlug = null;
  try {
    const parts = new URL(profileUrl).pathname.split("/").filter(Boolean);
    const ipoIndex = parts.indexOf("ipo");
    if (ipoIndex >= 0 && parts[ipoIndex + 1])
      preferredSlug = parts[ipoIndex + 1];
  } catch {
    // Profile URL was already validated by the caller.
  }
  const reportLinks = reportLinksFromHtml(html, preferredSlug);
  for (const reportUrl of reportLinks) {
    const reportHtml = await getHtml(reportUrl);
    const parsed = parseFallbackPage(reportHtml, reportUrl);
    if (parsed) return parsed;
  }
  return null;
};

const fetchDirectoryLinks = async (directoryUrl) => {
  const cached = directoryCache.get(directoryUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.links;

  const html = await getHtml(directoryUrl);
  if (!html) return [];
  const $ = cheerio.load(html);
  const links = [];
  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href || !/\/ipo\//i.test(href) || /\/financial-report\//i.test(href))
      return;
    const absolute = new URL(href, BASE_URL).href;
    const text = $(anchor).attr("title") || $(anchor).text().trim();
    links.push({
      url: absolute,
      text,
      normalized: normalizeCompanyName(`${text} ${href}`),
    });
  });
  directoryCache.set(directoryUrl, {
    links,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return links;
};

const findProfileUrlsFromDirectory = async (companyName) => {
  const target = normalizeCompanyName(companyName);
  if (!target || target.length < 4) return [];

  const found = [];
  for (const directoryUrl of DIRECTORY_URLS) {
    const links = await fetchDirectoryLinks(directoryUrl);
    // Exact company identity first; only use contains-match when it is not a
    // very short name to avoid returning a different issuer.
    const exact = links.filter((link) => {
      const urlSlug = getSlugFromUrl(link.url);
      const normalizedSlug = normalizeCompanyName(urlSlug);
      return (
        normalizedSlug === target ||
        normalizedSlug === `${target}ipo` ||
        normalizeCompanyName(link.text) === target ||
        (target.length >= 7 &&
          (normalizedSlug.startsWith(target) ||
            link.normalized.includes(target)))
      );
    });
    for (const link of exact)
      if (!found.includes(link.url)) found.push(link.url);
  }
  return found;
};

const fetchIpoPlatformReport = async ({ companyName, primarySourceUrl }) => {
  const slugs = [
    ...new Set(
      [getSlugFromUrl(primarySourceUrl), slugifyCompany(companyName)].filter(
        Boolean,
      ),
    ),
  ];

  // Fast path: most Chittorgarh IPO slugs have a matching IPOPlatform report slug.
  for (const slug of slugs) {
    const reportUrl = `${BASE_URL}/ipo/financial-report/${slug}/`;
    const parsed = parseFallbackPage(await getHtml(reportUrl), reportUrl);
    if (parsed) return parsed;
  }

  // Some reports have a numeric suffix. The IPO's profile page exposes the
  // canonical financial-report URL with its correct ID.
  for (const slug of slugs) {
    const profileUrl = `${BASE_URL}/ipo/${slug}/`;
    const found = await fetchReportFromProfile(profileUrl);
    if (found) return found;
  }

  // Last resort: find the exact IPO on IPOPlatform's Mainboard/SME directories,
  // then follow its profile page to the canonical financial report URL.
  const profileUrls = await findProfileUrlsFromDirectory(companyName);
  for (const profileUrl of profileUrls) {
    const found = await fetchReportFromProfile(profileUrl);
    if (found) return found;
  }

  return null;
};

const mergeHistory = (primaryHistory = [], fallbackHistory = []) => {
  const byDate = new Map();
  const primaryRows = Array.isArray(primaryHistory) ? primaryHistory : [];
  const fallbackRows = Array.isArray(fallbackHistory) ? fallbackHistory : [];

  for (const row of primaryRows) {
    const date = row.periodEnded ? new Date(row.periodEnded) : null;
    const key =
      date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : String(row.financialYear || "").toLowerCase();
    if (key) byDate.set(key, { ...row });
  }

  const authoritativeFallbackFields = [
    "revenueFromOperations",
    "profitAfterTax",
    "eps",
    "epsBasis",
    "netWorth",
    "totalBorrowing",
    "revenueGrowthYoy",
    "patMargin",
    "debtToEquity",
    "roe",
    "peRatio",
  ];

  for (const fallbackRow of fallbackRows) {
    const date = fallbackRow.periodEnded
      ? new Date(fallbackRow.periodEnded)
      : null;
    const key =
      date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : String(fallbackRow.financialYear || "").toLowerCase();
    if (!key) continue;

    const previous = byDate.get(key) || {};
    const merged = { ...previous };
    if (!merged.financialYear) merged.financialYear = fallbackRow.financialYear;
    if (!merged.periodEnded) merged.periodEnded = fallbackRow.periodEnded;

    for (const field of authoritativeFallbackFields) {
      const value = fallbackRow[field];
      if (value !== null && value !== undefined && value !== "")
        merged[field] = value;
    }

    // Keep the Chittorgarh URL as the primary sourceUrl and store provenance for
    // secondary-source fields separately.
    if (fallbackRow.fallbackSourceUrl)
      merged.fallbackSourceUrl = fallbackRow.fallbackSourceUrl;
    if (fallbackRow.fallbackFetchedAt)
      merged.fallbackFetchedAt = fallbackRow.fallbackFetchedAt;
    byDate.set(key, merged);
  }

  const mergedRows = [...byDate.values()].sort(
    (a, b) => new Date(a.periodEnded || 0) - new Date(b.periodEnded || 0),
  );

  // Recompute annual YoY growth from Revenue from Operations when both years
  // are available; do not annualise or compare interim data with full years.
  const annualRows = mergedRows.filter((row) => {
    if (!row.periodEnded) return false;
    const date = new Date(row.periodEnded);
    return date.getUTCMonth() === 2 && date.getUTCDate() >= 28;
  });
  for (const row of annualRows) {
    if (row.revenueFromOperations == null) continue;
    const year = new Date(row.periodEnded).getUTCFullYear();
    const prev = annualRows.find(
      (candidate) =>
        new Date(candidate.periodEnded).getUTCFullYear() === year - 1 &&
        candidate.revenueFromOperations != null,
    );
    if (prev && prev.revenueFromOperations !== 0) {
      row.revenueGrowthYoy = Number(
        (
          ((row.revenueFromOperations - prev.revenueFromOperations) /
            prev.revenueFromOperations) *
          100
        ).toFixed(2),
      );
    }
  }

  return mergedRows;
};

const buildFinancialsPatch = (history = []) => {
  const sorted = [...history].sort(
    (a, b) => new Date(a.periodEnded || 0) - new Date(b.periodEnded || 0),
  );
  const latestFirst = [...sorted].reverse();
  const findLatest = (key) =>
    latestFirst.find((row) => row[key] !== null && row[key] !== undefined)?.[
      key
    ];
  const latestAnnual = [...sorted].reverse().find((row) => {
    if (!row.periodEnded || row.revenueGrowthYoy == null) return false;
    const date = new Date(row.periodEnded);
    return date.getUTCMonth() === 2 && date.getUTCDate() >= 28;
  });
  const patch = {};
  const latestMetricPeriod = [
    ["revenueFromOperations", findLatest("revenueFromOperations")],
    ["patMargin", findLatest("patMargin")],
    ["debtToEquity", findLatest("debtToEquity")],
    ["roe", findLatest("roe")],
    ["peRatio", findLatest("peRatio")],
  ];
  for (const [key, value] of latestMetricPeriod) {
    if (value !== undefined && value !== null) patch[key] = value;
  }
  if (latestAnnual?.revenueGrowthYoy != null) {
    patch.revenueGrowthYoy = latestAnnual.revenueGrowthYoy;
  }
  // Deliberately do not patch financials.eps: it is the separate Pre-IPO EPS
  // snapshot used by the current Listing Demand / risk logic.
  return patch;
};

const shouldFetchFallback = (history) => {
  if (!Array.isArray(history) || history.length === 0) return true;
  return history.some(
    (row) =>
      row &&
      (row.revenueFromOperations === null ||
        row.revenueFromOperations === undefined ||
        row.eps === null ||
        row.eps === undefined ||
        row.patMargin === null ||
        row.patMargin === undefined ||
        row.debtToEquity === null ||
        row.debtToEquity === undefined ||
        row.roe === null ||
        row.roe === undefined),
  );
};

const enrichFinancialHistoryWithFallback = async ({
  companyName,
  primarySourceUrl = null,
  financialHistory = [],
} = {}) => {
  const primaryRows = Array.isArray(financialHistory) ? financialHistory : [];
  if (!shouldFetchFallback(primaryRows)) {
    return {
      financialHistory: primaryRows,
      financialsPatch: {},
      sourceUrl: null,
      usedFallback: false,
    };
  }

  const cacheKey = `${normalizeCompanyName(companyName)}|${primarySourceUrl || ""}`;
  let cached = resultCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    const result = await fetchIpoPlatformReport({
      companyName,
      primarySourceUrl,
    });
    cached = {
      result,
      expiresAt: Date.now() + (result ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
    };
    resultCache.set(cacheKey, cached);
  }

  if (!cached.result || !cached.result.financialHistory?.length) {
    console.warn(
      `[Financial Fallback] No usable IPOPlatform financial history for ${companyName}`,
    );
    return {
      financialHistory: primaryRows,
      financialsPatch: {},
      sourceUrl: null,
      usedFallback: false,
    };
  }

  const { url, financialHistory: fallbackRows } = cached.result;
  const enrichedHistory = mergeHistory(primaryRows, fallbackRows);
  const financialsPatch = buildFinancialsPatch(enrichedHistory);
  const epsCount = fallbackRows.filter(
    (row) => row.eps !== null && row.eps !== undefined,
  ).length;
  const revenueCount = fallbackRows.filter(
    (row) =>
      row.revenueFromOperations !== null &&
      row.revenueFromOperations !== undefined,
  ).length;

  console.log(
    `[Financial Fallback] ${companyName}: merged ${fallbackRows.length} fallback periods; EPS rows=${epsCount}; operating-revenue rows=${revenueCount}; source=${url}`,
  );

  return {
    financialHistory: enrichedHistory,
    financialsPatch,
    sourceUrl: url,
    usedFallback: true,
  };
};

module.exports = {
  parsePeriodHeader,
  parseFinancialNumber,
  extractFinancialHistoryFromHtml,
  enrichFinancialHistoryWithFallback,
};
