const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.chittorgarh.com";
const LISTING_REPORT_PATH = "/report/ipo-in-india-list-main-board-sme/82/all/";
const OLDEST_LOOKUP_YEAR = 2015;
const requestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// Caches the year-specific IPO directory so many IPO syncs do not repeatedly
// download the same directory page.
const listingDirectoryCache = new Map();

const normalizeCompanyName = (name) =>
  String(name ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const parseFinancialNumber = (value) => {
  if (value === null || value === undefined) return null;

  const raw = String(value)
    .replace(/\u00a0/g, " ")
    .trim();
  if (!raw || /^(?:-|—|–|n\/?a|na|nil|not\s+available)$/i.test(raw)) {
    return null;
  }

  const negativeByParentheses = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(/[₹,()%\s]/g, "")
    .replace(/(?:cr\.?|crores?|x)$/i, "");
  if (!normalized) return null;

  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;

  return negativeByParentheses && number > 0 ? -number : number;
};

const getCellTexts = ($, row) =>
  $(row)
    .children("th, td")
    .map((_, cell) => $(cell).text().replace(/\s+/g, " ").trim())
    .get();

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
  const monthText = date.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const label = isFiscalYearEnd
    ? `FY ${year}`
    : `${String(day).padStart(2, "0")} ${monthText} ${year}`;

  return { isoDate, financialYear: label, year, month, day };
};

// Handles headings like "30 Jun 2026", "Jun 30, 2026", "31-Mar-2025",
// "2025-03-31", and financial-year labels like "FY 2025".
const parsePeriodHeader = (input) => {
  const text = String(input ?? "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  let match = text.match(/^(\d{1,2})[\s/-]+([A-Za-z]{3,9})[\s,-]+(20\d{2})$/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    return month ? makePeriod(Number(match[3]), month, Number(match[1])) : null;
  }

  match = text.match(/^([A-Za-z]{3,9})[\s/-]+(\d{1,2}),?[\s,-]+(20\d{2})$/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    return month ? makePeriod(Number(match[3]), month, Number(match[2])) : null;
  }

  match = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return makePeriod(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
  if (match) {
    return makePeriod(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  match = text.match(/^FY\s*[- ]?(20\d{2}|\d{2})$/i);
  if (match) {
    const digits = Number(match[1]);
    const year = match[1].length === 2 ? 2000 + digits : digits;
    return makePeriod(year, 3, 31);
  }

  match = text.match(/^(20\d{2})[-/](\d{2})$/);
  if (match) return makePeriod(Number(match[1]), 3, 31);

  return null;
};

const normalizeMetricLabel = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const classifyHistoricalMetric = (label) => {
  const metric = normalizeMetricLabel(label);

  if (/^(total income|total revenue)$/.test(metric)) {
    return { key: "totalIncome", priority: 1 };
  }
  if (
    /^revenue from operations(?:\s*\(.*\))?$/.test(metric) ||
    (/^revenue\b/.test(metric) && !/^revenue growth\b/.test(metric)) ||
    /^(net sales|sales turnover)$/.test(metric)
  ) {
    return { key: "revenueFromOperations", priority: 1 };
  }
  if (/^(profit after tax|profit after taxation|pat)$/.test(metric)) {
    return { key: "profitAfterTax", priority: 1 };
  }

  // The old /^eps\b/ condition only matched labels starting with "EPS" and
  // missed labels such as "Basic EPS" and "Diluted EPS".
  const basicEps =
    /\bbasic\s+(?:eps|earnings?\s+per\s+share)\b/.test(metric) ||
    /^(?:eps|earnings?\s+per\s+share)\b.*\bbasic\b/.test(metric);
  const dilutedEps =
    /\bdiluted\s+(?:eps|earnings?\s+per\s+share)\b/.test(metric) ||
    /^(?:eps|earnings?\s+per\s+share)\b.*\bdiluted\b/.test(metric);
  const genericEps = /^(?:eps|earnings?\s+per\s+share)\b/.test(metric);
  if (basicEps || dilutedEps || genericEps) {
    return {
      key: "eps",
      priority: basicEps ? 3 : dilutedEps ? 2 : 1,
      epsBasis: basicEps ? "BASIC" : dilutedEps ? "DILUTED" : "REPORTED",
    };
  }
  if (/^(net worth|networth)$/.test(metric)) {
    return { key: "netWorth", priority: 1 };
  }
  if (/^(total borrowings?|borrowings?)$/.test(metric)) {
    return { key: "totalBorrowing", priority: 1 };
  }
  if (/^roe(?:\s|$|\()/.test(metric) || metric === "roe") {
    return { key: "roe", priority: 2 };
  }
  if (/^ronw(?:\s|$|\()/.test(metric) || metric === "ronw") {
    return { key: "roe", priority: 1 };
  }
  if (/^pat margin$/.test(metric)) {
    return { key: "patMargin", priority: 1 };
  }
  if (/^(debt\s*\/\s*equity|debt to equity)$/.test(metric)) {
    return { key: "debtToEquity", priority: 1 };
  }
  if (/^(p\s*\/\s*e(?:\s+ratio)?|p\/e ratio)(?:\s*\(x\))?$/.test(metric)) {
    return { key: "peRatio", priority: 1 };
  }
  if (
    /^(revenue growth|revenue growth yoy|revenue growth \(%\))$/.test(metric)
  ) {
    return { key: "revenueGrowthYoy", priority: 1 };
  }

  return null;
};

const createHistoryRecord = (period, sourceUrl, fetchedAt) => ({
  financialYear: period.financialYear,
  periodEnded: `${period.isoDate}T00:00:00.000Z`,
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
  sourceUrl,
  fetchedAt,
});

const extractFinancialHistoryFromHtml = (
  html,
  sourceUrl = null,
  fetchedAt = new Date(),
) => {
  const $ = cheerio.load(html);
  const historyByDate = new Map();
  const metricPriorities = new Map();

  const ensurePeriodRecord = (period) => {
    if (!historyByDate.has(period.isoDate)) {
      historyByDate.set(
        period.isoDate,
        createHistoryRecord(period, sourceUrl, fetchedAt),
      );
    }
    return historyByDate.get(period.isoDate);
  };

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    let selectedHeader = null;

    // Find the strongest row of period/date headers within this table.
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

    const perPeriodEpsPriority = new Map();
    const perPeriodRoePriority = new Map();

    rows.slice(selectedHeader.rowIndex + 1).forEach((row) => {
      const cells = getCellTexts($, row);
      if (cells.length < 2) return;

      const metric = classifyHistoricalMetric(cells[0]);
      if (!metric) return;

      selectedHeader.periodCells.forEach(({ cellIndex, period }) => {
        if (cellIndex >= cells.length) return;
        const value = parseFinancialNumber(cells[cellIndex]);
        if (value === null) return;

        const record = ensurePeriodRecord(period);
        const priorityKey = `${period.isoDate}:${metric.key}`;
        const currentPriority = metricPriorities.get(priorityKey) ?? 0;
        if (metric.priority < currentPriority) return;

        if (metric.key === "eps") {
          const epsPriority = perPeriodEpsPriority.get(period.isoDate) ?? 0;
          if (metric.priority < epsPriority) return;
          perPeriodEpsPriority.set(period.isoDate, metric.priority);
        }
        if (metric.key === "roe") {
          const roePriority = perPeriodRoePriority.get(period.isoDate) ?? 0;
          if (metric.priority < roePriority) return;
          perPeriodRoePriority.set(period.isoDate, metric.priority);
        }

        record[metric.key] = value;
        if (metric.key === "eps") {
          record.epsBasis = metric.epsBasis ?? "REPORTED";
        }
        metricPriorities.set(priorityKey, metric.priority);
      });
    });
  });

  const records = [...historyByDate.values()].sort(
    (a, b) => new Date(a.periodEnded) - new Date(b.periodEnded),
  );

  // Derive PAT margin from the matching period's Revenue from Operations.
  // Total Income is not a substitute denominator because the ratio definition
  // may differ. Debt/Equity is kept source-reported: Borrowings / Net Worth may
  // not match the issuer's published ratio definition.
  for (const record of records) {
    if (
      record.patMargin === null &&
      record.profitAfterTax !== null &&
      record.revenueFromOperations !== null &&
      record.revenueFromOperations !== 0
    ) {
      record.patMargin = Number(
        ((record.profitAfterTax / record.revenueFromOperations) * 100).toFixed(
          2,
        ),
      );
    }
  }

  // Calculate YoY growth only between two consecutive March year-end records;
  // do not compare a partial quarter with a full year.
  const annualRecords = records.filter((record) => {
    const date = new Date(record.periodEnded);
    return date.getUTCMonth() === 2 && date.getUTCDate() >= 28;
  });

  for (let index = 0; index < annualRecords.length; index += 1) {
    const current = annualRecords[index];
    if (current.revenueGrowthYoy !== null) continue;

    const currentYear = new Date(current.periodEnded).getUTCFullYear();
    const previous = annualRecords.find(
      (row) => new Date(row.periodEnded).getUTCFullYear() === currentYear - 1,
    );
    if (!previous) continue;

    // Compare the same metric across both years. Prefer operating revenue when
    // both periods have it; otherwise use total income only when both have it.
    let currentRevenue = null;
    let previousRevenue = null;
    if (
      current.revenueFromOperations !== null &&
      previous.revenueFromOperations !== null
    ) {
      currentRevenue = current.revenueFromOperations;
      previousRevenue = previous.revenueFromOperations;
    } else if (current.totalIncome !== null && previous.totalIncome !== null) {
      currentRevenue = current.totalIncome;
      previousRevenue = previous.totalIncome;
    }

    if (
      currentRevenue !== null &&
      previousRevenue !== null &&
      previousRevenue !== 0
    ) {
      current.revenueGrowthYoy = Number(
        (((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(
          2,
        ),
      );
    }
  }

  return records.filter((record) =>
    [
      "totalIncome",
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
    ].some((key) => record[key] !== null),
  );
};

const extractPreIpoEps = ($) => {
  let result = null;

  $("table").each((_, table) => {
    if (result !== null) return;
    const rows = $(table).find("tr").toArray();
    let preIpoIndex = -1;
    let postIpoIndex = -1;
    let headerIndex = -1;

    rows.forEach((row, rowIndex) => {
      const cells = getCellTexts($, row).map((cell) =>
        normalizeMetricLabel(cell),
      );
      const preIndex = cells.findIndex((cell) =>
        /pre[\s-]*(ipo|issue)/i.test(cell),
      );
      const postIndex = cells.findIndex((cell) =>
        /post[\s-]*(ipo|issue)/i.test(cell),
      );
      if (preIndex >= 0 && postIndex >= 0) {
        preIpoIndex = preIndex;
        postIpoIndex = postIndex;
        headerIndex = rowIndex;
      }
    });

    if (preIpoIndex < 0 || postIpoIndex < 0) return;

    rows.slice(headerIndex + 1).forEach((row) => {
      if (result !== null) return;
      const cells = getCellTexts($, row);
      if (/^eps\b/i.test(cells[0] ?? "")) {
        result = parseFinancialNumber(cells[preIpoIndex]);
      }
    });
  });

  return result;
};

const extractTentativeListingDate = ($) => {
  let listingDate = null;

  $("table tr").each((_, row) => {
    if (listingDate) return;
    const cells = getCellTexts($, row);
    if (normalizeMetricLabel(cells[0]) !== "listing date" || !cells[1]) return;

    const value = cells[1].replace(/T$/, "").trim();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) listingDate = parsed;
  });

  return listingDate;
};

const fetchListingDirectory = async (year) => {
  if (listingDirectoryCache.has(year)) return listingDirectoryCache.get(year);

  const requestPromise = (async () => {
    try {
      const response = await axios.get(
        `${BASE_URL}${LISTING_REPORT_PATH}?year=${year}`,
        { headers: requestHeaders, timeout: 15000 },
      );
      const $ = cheerio.load(response.data);
      const links = [];

      $("a[href]").each((_, link) => {
        const href = $(link).attr("href");
        if (!href || !href.includes("/ipo/")) return;

        const title = $(link).attr("title") || "";
        const text = $(link).text().trim();
        links.push({
          href: new URL(href, BASE_URL).href,
          content: normalizeCompanyName(`${title} ${text}`),
          slug: normalizeCompanyName(
            href.split("/").filter(Boolean).slice(-2, -1)[0] || "",
          ),
        });
      });

      return links;
    } catch (error) {
      console.warn(
        `[Chittorgarh Directory] ${year} lookup failed: ${error.message}`,
      );
      return [];
    }
  })();

  listingDirectoryCache.set(year, requestPromise);
  return requestPromise;
};

const findChittorgarhIpoUrl = async (companyName) => {
  const normalizedCompany = normalizeCompanyName(companyName);
  if (!normalizedCompany) return null;

  const aliases = {
    acevector: "https://www.chittorgarh.com/ipo/snapdeal-ipo/2543/",
  };
  if (aliases[normalizedCompany]) return aliases[normalizedCompany];

  const searchCompany = normalizedCompany.replace(/india$/, "");
  const searchPrefix = searchCompany.slice(0, 8);
  const currentYear = new Date().getFullYear();

  for (let year = currentYear; year >= OLDEST_LOOKUP_YEAR; year -= 1) {
    const links = await fetchListingDirectory(year);

    const exact = links.find(
      (link) =>
        (link.content.includes(searchCompany) ||
          link.slug.includes(searchCompany)) &&
        searchCompany.length > 0,
    );
    if (exact) {
      console.log(`[Chittorgarh URL] ${companyName} → ${exact.href}`);
      return exact.href;
    }

    const prefix = links.find(
      (link) =>
        searchPrefix.length >= 8 &&
        (link.content.startsWith(searchPrefix) ||
          link.slug.startsWith(searchPrefix)),
    );
    if (prefix) {
      console.log(
        `[Chittorgarh URL] ${companyName} → ${prefix.href} (prefix match)`,
      );
      return prefix.href;
    }
  }

  console.warn(`[Chittorgarh URL] No IPO page found for ${companyName}`);
  return null;
};

const emptyFinancialResult = () => ({
  financials: {
    revenueGrowthYoy: null,
    patMargin: null,
    debtToEquity: null,
    roe: null,
    peRatio: null,
    eps: null,
  },
  financialHistory: [],
  issueSizeCr: null,
  tentativeListingDate: null,
  sourceUrl: null,
});

const fetchCompanyFinancials = async (symbol) => {
  const emptyResult = emptyFinancialResult();

  try {
    const url = await findChittorgarhIpoUrl(symbol);
    if (!url) {
      console.warn(
        `[Chittorgarh Financials] IPO page not found for: ${symbol}`,
      );
      return emptyResult;
    }

    const response = await axios.get(url, {
      headers: requestHeaders,
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const pageText = $("body").text();
    const fetchedAt = new Date();

    let issueSizeCr = null;
    const issueSizeMatch = pageText.match(
      /Total\s*Issue\s*Size.*?agg\.\s*up\s*to\s*₹\s*([\d,]+(?:\.\d+)?)\s*Cr/i,
    );
    if (issueSizeMatch) issueSizeCr = parseFinancialNumber(issueSizeMatch[1]);

    const financialHistory = extractFinancialHistoryFromHtml(
      response.data,
      url,
      fetchedAt,
    );

    const preIpoEps = extractPreIpoEps($);
    const latestFirst = [...financialHistory].sort(
      (a, b) => new Date(b.periodEnded) - new Date(a.periodEnded),
    );
    const latestAnnual = latestFirst.find((row) => {
      const date = row.periodEnded ? new Date(row.periodEnded) : null;
      return date && date.getUTCMonth() === 2 && date.getUTCDate() >= 28;
    });

    const firstAvailable = (key) =>
      latestFirst.find((row) => row[key] !== null && row[key] !== undefined)?.[
        key
      ] ?? null;

    const financials = {
      revenueGrowthYoy:
        latestAnnual?.revenueGrowthYoy ?? firstAvailable("revenueGrowthYoy"),
      revenueFromOperations: firstAvailable("revenueFromOperations"),
      patMargin: firstAvailable("patMargin"),
      debtToEquity: firstAvailable("debtToEquity"),
      roe: firstAvailable("roe"),
      peRatio: firstAvailable("peRatio"),
      // Keep the Pre-IPO EPS snapshot for the existing V2 risk adjustment.
      eps: preIpoEps ?? latestAnnual?.eps ?? firstAvailable("eps"),
    };

    const tentativeListingDate = extractTentativeListingDate($);

    console.log(
      `[Chittorgarh Financials] ${symbol}: periods=${financialHistory.length}, EPS=${financials.eps ?? "N/A"}, URL=${url}`,
    );

    return {
      financials,
      financialHistory,
      issueSizeCr,
      tentativeListingDate,
      sourceUrl: url,
    };
  } catch (error) {
    console.error(
      `[Chittorgarh Financials] Failed for ${symbol}:`,
      error.message,
    );
    return emptyResult;
  }
};

module.exports = {
  fetchCompanyFinancials,
  findChittorgarhIpoUrl,
  parseFinancialNumber,
  parsePeriodHeader,
  extractFinancialHistoryFromHtml,
};
