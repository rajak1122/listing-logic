const axios = require("axios");

const normalizeBseKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const parseBseCsvLine = (line) => {
  const fields = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      fields.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  fields.push(value.trim());

  return fields;
};

const fetchBseListingDayBhavCopyData = async (scripCode, listingDate) => {
  try {
    if (!/^\d{6}$/.test(String(scripCode || "")) || !listingDate) {
      return null;
    }

    const date = new Date(listingDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const part = (type) => parts.find((item) => item.type === type)?.value;

    const year = part("year");
    const month = part("month");
    const day = part("day");

    const dateKey = `${year}-${month}-${day}`;
    const fileDate = `${year}${month}${day}`;

    const url =
      `https://www.bseindia.com/download/BhavCopy/Equity/` +
      `BhavCopy_BSE_CM_0_0_0_${fileDate}_F_0000.CSV`;

    const response = await axios.get(url, {
      responseType: "text",
      timeout: 20000,
      transformResponse: [(data) => data],
      headers: {
        Accept: "text/csv,text/plain,*/*",
        Referer: "https://www.bseindia.com/",
        Origin: "https://www.bseindia.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
      },
    });

    const csv = String(response.data ?? "")
      .replace(/^\uFEFF/, "")
      .trim();

    if (!csv || csv.startsWith("<")) {
      console.warn(`[BSE BHAVCOPY] File unavailable for ${dateKey}`);
      return null;
    }

    const lines = csv.split(/\r?\n/).filter(Boolean);

    const headers = parseBseCsvLine(lines[0]);

    const headerIndexes = {};

    headers.forEach((header, index) => {
      headerIndexes[normalizeBseKey(header)] = index;
    });

    const requiredFields = ["fininstrmid", "traddt", "opnpric"];

    if (requiredFields.some((field) => headerIndexes[field] === undefined)) {
      console.warn("[BSE BHAVCOPY] Unexpected CSV headers:", headers);
      return null;
    }

    const getValue = (row, field) => row[headerIndexes[field]]?.trim() ?? "";

    for (let i = 1; i < lines.length; i++) {
      const row = parseBseCsvLine(lines[i]);

      const code = getValue(row, "fininstrmid").replace(/\.0$/, "");

      const tradeDate = getValue(row, "traddt");

      const segment = getValue(row, "sgmt");

      if (
        code !== String(scripCode) ||
        tradeDate !== dateKey ||
        (segment && segment !== "CM")
      ) {
        continue;
      }

      const parseOptionalNumber = (value) => {
        const raw = String(value ?? "")
          .trim()
          .replace(/,/g, "");

        if (!raw || raw === "-" || /^n\/?a$/i.test(raw)) {
          return null;
        }

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const openingPrice = parseOptionalNumber(getValue(row, "opnpric"));

      const high = parseOptionalNumber(getValue(row, "hghpric"));
      const low = parseOptionalNumber(getValue(row, "lwpric"));
      const close = parseOptionalNumber(getValue(row, "clspric"));
      const volume = parseOptionalNumber(getValue(row, "ttltradgvol"));

      if (openingPrice === null || openingPrice <= 0) {
        console.warn(`[BSE BHAVCOPY] Invalid opening price for ${scripCode}`);
        return null;
      }

      if (
        (high !== null && openingPrice > high) ||
        (low !== null && openingPrice < low) ||
        (high !== null && low !== null && high < low)
      ) {
        console.warn(`[BSE BHAVCOPY] Invalid OHLC range for ${scripCode}`);
        return null;
      }

      if (!Number.isFinite(openingPrice) || openingPrice <= 0) {
        console.warn(`[BSE BHAVCOPY] Invalid opening price for ${scripCode}`);
        return null;
      }

      if (
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        (openingPrice > high || openingPrice < low)
      ) {
        console.warn(`[BSE BHAVCOPY] Invalid OHLC range for ${scripCode}`);
        return null;
      }

      console.log("[BSE BHAVCOPY VERIFIED]", {
        scripCode,
        tradeDate,
        openingPrice,
        high,
        low,
        close,
        volume,
      });

      return {
        listingDate: tradeDate,
        openingPrice,
        high,
        low,
        close,
        volume,
        source: "BSE_BHAVCOPY",
      };
    }

    console.warn(
      `[BSE BHAVCOPY] No matching row for ${scripCode} on ${dateKey}`,
    );

    return null;
  } catch (error) {
    console.error(
      `[BSE BHAVCOPY] Failed for ${scripCode}:`,
      error.response?.status || error.message,
    );

    return null;
  }
};

module.exports = {
  fetchBseListingDayBhavCopyData,
  parseBseCsvLine,
};
