const axios = require("axios");

const BSE_HOME = "https://www.bseindia.com/";

const BSE_API_BASE =
  "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w";

const BSE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.bseindia.com",
  Referer: "https://www.bseindia.com/",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const parsePrice = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  const price = Number(cleaned);

  return Number.isFinite(price) && price > 0 ? price : null;
};

const parseBseDate = (value) => {
  if (!value || typeof value !== "string") return null;

  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);

  if (!match) return null;

  const [, day, monthText, yearText] = match;

  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  const month = months[monthText.toLowerCase()];
  if (!month) return null;

  let year = Number(yearText);

  if (yearText.length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }

  return `${year}-${month}-${String(day).padStart(2, "0")}`;
};

const toDateKey = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// Acquire BSE session cookies that are valid for the API subdomain.
const getBseSessionCookies = async () => {
  const response = await axios.get(BSE_HOME, {
    headers: BSE_HEADERS,
    timeout: 10000,
  });

  const setCookies = Array.isArray(response.headers["set-cookie"])
    ? response.headers["set-cookie"]
    : [];

  const cookiePairs = setCookies
    .filter((cookie) => {
      const domain = cookie.match(/;\s*domain=([^;]+)/i)?.[1];

      if (!domain) return false;

      const normalizedDomain = domain.replace(/^\./, "").toLowerCase();

      return (
        normalizedDomain === "bseindia.com" ||
        normalizedDomain.endsWith(".bseindia.com")
      );
    })
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean);

  return [...new Set(cookiePairs)].join("; ");
};

const fetchBseListingDayPrice = async (scripCode, expectedListingDate) => {
  if (!/^\d{6}$/.test(String(scripCode))) {
    throw new Error("Invalid BSE scrip code");
  }

  const expectedDateKey = toDateKey(expectedListingDate);

  if (!expectedDateKey) {
    throw new Error("Invalid expected listing date");
  }

  // Step 1: Warm up BSE session.
  let cookieHeader = "";

  try {
    cookieHeader = await getBseSessionCookies();

    console.log(
      `[BSE LISTING COOKIE] ${scripCode}: ${
        cookieHeader ? "Session cookies acquired" : "No API-compatible cookies"
      }`,
    );
  } catch (error) {
    console.warn(
      `[BSE LISTING COOKIE] Warm-up failed for ${scripCode}:`,
      error.response?.status || error.message,
    );
  }

  // Step 2: Request listing-day quote.
  const url = new URL(BSE_API_BASE);

  url.searchParams.set("Debtflag", "");
  url.searchParams.set("scripcode", String(scripCode));
  url.searchParams.set("seriesid", "");

  let response;

  try {
    response = await axios.get(url.toString(), {
      timeout: 15000,
      responseType: "text",
      validateStatus: () => true,
      headers: {
        ...BSE_HEADERS,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
  } catch (error) {
    console.error("[BSE LISTING API] Network failure:", {
      scripCode,
      errorCode: error.code,
      message: error.message,
    });

    throw error;
  }

  const contentType = response.headers["content-type"] || "";

  const responseText =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data ?? "");

  const responsePreview = responseText.slice(0, 500);

  console.log("[BSE LISTING API] Response:", {
    scripCode,
    status: response.status,
    contentType,
    responseLength: responseText.length,
    responsePreview,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`BSE API HTTP ${response.status}: ${responsePreview}`);
  }

  // Step 3: Parse JSON safely.
  let data;

  try {
    data = JSON.parse(responseText.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      `BSE returned non-JSON response. Status: ${response.status}, Content-Type: ${contentType}, Preview: ${responsePreview}`,
    );
  }

  const header = data?.Header;

  if (!header) {
    throw new Error("BSE API response does not contain Header");
  }

  // Step 4: Strict listing-date verification.
  const actualDateKey = parseBseDate(header.Ason);

  if (!actualDateKey) {
    throw new Error(`Unable to parse BSE Ason date: ${header.Ason}`);
  }

  if (actualDateKey !== expectedDateKey) {
    throw new Error(
      `BSE quote date mismatch. Expected ${expectedDateKey}, received ${actualDateKey}`,
    );
  }

  // Only accept the verified session's Header.Open.
  const openingPrice = parsePrice(header.Open);

  if (!openingPrice) {
    throw new Error(`Invalid BSE opening price: ${header.Open}`);
  }

  return {
    listingDate: actualDateKey,
    openingPrice,
    high: parsePrice(header.High),
    low: parsePrice(header.Low),
    previousClose: parsePrice(header.PrevClose),
    ltp: parsePrice(header.LTP),
    asOn: header.Ason,
    source: "BSE_SCRIP_HEADER",
  };
};

module.exports = {
  fetchBseListingDayPrice,
};
