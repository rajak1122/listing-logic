const axios = require("axios");
const {
  fetchBseListingDayPrice,
} = require("../services/bseListingPriceService");

const BSE_HOME = "https://www.bseindia.com/";
const BSE_SEARCH = "https://api.bseindia.com/BseIndiaAPI/api/PeerSmartSearch/w";

const commonHeaders = {
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

const testBseSecuritySearch = async (req, res) => {
  const startedAt = Date.now();

  try {
    // A. Homepage warm-up
    const warmup = await axios.get(BSE_HOME, {
      headers: commonHeaders,
      timeout: 15000,
      validateStatus: () => true,
    });

    const setCookies = warmup.headers["set-cookie"] || [];

    const cookieHeader = setCookies
      .filter((cookie) => {
        const domain = cookie.match(/;\s*domain=([^;]+)/i)?.[1];
        return !domain || domain.toLowerCase().endsWith("bseindia.com");
      })
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    const cookieMetadata = setCookies.map((cookie) => ({
      name: cookie.split("=")[0],
      domain: cookie.match(/;\s*domain=([^;]+)/i)?.[1] || "host-only",
    }));

    // B. PeerSmartSearch request
    const search = await axios.get(BSE_SEARCH, {
      params: {
        Type: "SS",
        text: "Crystal Crop Protection",
      },
      headers: {
        ...commonHeaders,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body =
      typeof search.data === "string"
        ? search.data
        : JSON.stringify(search.data ?? "");

    return res.status(200).json({
      diagnostic: "BSE_COOKIE_WARMUP",
      server: "RENDER",
      warmup: {
        status: warmup.status,
        contentType: warmup.headers["content-type"] || null,
        cookieCount: setCookies.length,
        cookies: cookieMetadata,
      },
      search: {
        status: search.status,
        contentType: search.headers["content-type"] || null,
        responseLength: body.length,
        responsePreview: body.slice(0, 500),
      },
      totalResponseTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[BSE COOKIE DIAGNOSTIC]", {
      code: error.code,
      message: error.message,
      status: error.response?.status,
    });

    return res.status(200).json({
      diagnostic: "BSE_COOKIE_WARMUP",
      server: "RENDER",
      error: error.message,
      errorCode: error.code || null,
      upstreamStatus: error.response?.status || null,
      totalResponseTimeMs: Date.now() - startedAt,
    });
  }
};

const testBseListingPrice = async (req, res) => {
  const startedAt = Date.now();

  try {
    const result = await fetchBseListingDayPrice(
      "545032",
      "2026-11-27T00:00:00.000Z",
    );

    return res.status(200).json({
      success: true,
      diagnostic: "BSE_LISTING_PRICE",
      server: "RENDER",
      responseTimeMs: Date.now() - startedAt,
      data: result,
    });
  } catch (error) {
    console.error("[BSE LISTING DIAGNOSTIC]", error.message);

    return res.status(200).json({
      success: false,
      diagnostic: "BSE_LISTING_PRICE",
      server: "RENDER",
      responseTimeMs: Date.now() - startedAt,
      error: error.message,
    });
  }
};

module.exports = {
  testBseSecuritySearch,
  testBseListingPrice,
};
