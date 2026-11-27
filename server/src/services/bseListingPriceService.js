const BSE_API_BASE =
  "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w";

const BSE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.bseindia.com",
  Referer: "https://www.bseindia.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const parsePrice = (value) => {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
};

const parseBseDate = (value) => {
  if (!value || typeof value !== "string") return null;

  // Example: 26 Nov 26 | 12:46
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

  // Interpret the IPO date in Indian Standard Time.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const fetchBseListingDayPrice = async (
  scripCode,
  expectedListingDate,
) => {
  if (!/^\d{6}$/.test(String(scripCode))) {
    throw new Error("Invalid BSE scrip code");
  }

  const expectedDateKey = toDateKey(expectedListingDate);

  if (!expectedDateKey) {
    throw new Error("Invalid expected listing date");
  }

  const url = new URL(BSE_API_BASE);
  url.searchParams.set("Debtflag", "");
  url.searchParams.set("scripcode", String(scripCode));
  url.searchParams.set("seriesid", "");

  const response = await fetch(url, {
    method: "GET",
    headers: BSE_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`BSE API failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  const header = data?.Header;

  if (!header) {
    throw new Error("BSE API response does not contain Header");
  }

  const actualDateKey = parseBseDate(header.Ason);

  if (!actualDateKey) {
    throw new Error(`Unable to parse BSE Ason date: ${header.Ason}`);
  }

  if (actualDateKey !== expectedDateKey) {
    throw new Error(
      `BSE quote date mismatch. Expected ${expectedDateKey}, received ${actualDateKey}`,
    );
  }

  const openingPrice = parsePrice(header.Open);

  if (!openingPrice) {
    throw new Error("Invalid opening price returned by BSE");
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