const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const {
  fetchBseListingDayPrice,
} = require("../src/services/bseListingPriceService");

const expectedDate = "2026-11-26T00:00:00.000Z";

const HOME_URL = "https://www.bseindia.com/";
const API_URL = "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w";

const validResponse = {
  Header: {
    Open: "280.00",
    High: "283.50",
    Low: "268.00",
    PrevClose: "272.00",
    LTP: "278.45",
    Ason: "26 Nov 26 | 12:46",
  },
};

const mockAxiosGet = (t, implementation) => {
  const originalGet = axios.get;

  axios.get = implementation;

  t.after(() => {
    axios.get = originalGet;
  });
};

const mockSuccessfulBseRequests = (t, apiResponse = validResponse) => {
  const calls = [];

  mockAxiosGet(t, async (url, config = {}) => {
    calls.push({ url, config });

    if (url === HOME_URL) {
      return {
        status: 200,
        headers: {
          "set-cookie": [
            "bm_s=test-session; Domain=.bseindia.com; Path=/; Secure",
            "hostOnly=test; Path=/",
          ],
        },
        data: "BSE Homepage",
      };
    }

    if (url.startsWith(API_URL)) {
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        data:
          typeof apiResponse === "string"
            ? apiResponse
            : JSON.stringify(apiResponse),
      };
    }

    throw new Error(`Unexpected request URL: ${url}`);
  });

  return calls;
};

test("returns listing-day opening price and forwards BSE session cookies", async (t) => {
  const calls = mockSuccessfulBseRequests(t);

  const result = await fetchBseListingDayPrice("545031", expectedDate);

  assert.equal(result.openingPrice, 280);
  assert.equal(result.high, 283.5);
  assert.equal(result.low, 268);
  assert.equal(result.listingDate, "2026-11-26");
  assert.equal(result.source, "BSE_SCRIP_HEADER");

  assert.equal(calls.length, 2);

  // Verify homepage warm-up happened first.
  assert.equal(calls[0].url, HOME_URL);

  // Verify compatible cookie was forwarded to BSE API.
  assert.equal(calls[1].config.headers.Cookie, "bm_s=test-session");

  assert.equal(calls[1].config.responseType, "text");
});

test("rejects when BSE quote date does not match listing date", async (t) => {
  mockSuccessfulBseRequests(t, {
    Header: {
      ...validResponse.Header,
      Ason: "27 Nov 26 | 10:00",
    },
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /date mismatch/,
  );
});

test("rejects invalid BSE scrip code without making a request", async (t) => {
  let requestCount = 0;

  mockAxiosGet(t, async () => {
    requestCount++;
    throw new Error("Request should not happen");
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("123", expectedDate),
    /Invalid BSE scrip code/,
  );

  assert.equal(requestCount, 0);
});

test("rejects when BSE response Header is missing", async (t) => {
  mockSuccessfulBseRequests(t, {});

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /does not contain Header/,
  );
});

test("rejects invalid opening price", async (t) => {
  mockSuccessfulBseRequests(t, {
    Header: {
      ...validResponse.Header,
      Open: "0",
    },
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /Invalid BSE opening price/,
  );
});

test("rejects when BSE API returns HTTP 403", async (t) => {
  mockAxiosGet(t, async (url) => {
    if (url === HOME_URL) {
      return {
        status: 200,
        headers: { "set-cookie": [] },
        data: "Homepage",
      };
    }

    return {
      status: 403,
      headers: { "content-type": "text/html" },
      data: "Access Denied",
    };
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /BSE API HTTP 403/,
  );
});

test("rejects when BSE returns HTML instead of JSON", async (t) => {
  mockSuccessfulBseRequests(t, "<html>Access Denied</html>");

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /BSE returned non-JSON response/,
  );
});

test("rejects when BSE API network request fails", async (t) => {
  mockAxiosGet(t, async (url) => {
    if (url === HOME_URL) {
      return {
        status: 200,
        headers: { "set-cookie": [] },
        data: "Homepage",
      };
    }

    throw new Error("Network failure");
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /Network failure/,
  );
});

test("continues API request when homepage cookie warm-up fails", async (t) => {
  let apiRequestReached = false;

  mockAxiosGet(t, async (url) => {
    if (url === HOME_URL) {
      throw new Error("Homepage unavailable");
    }

    apiRequestReached = true;

    return {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify(validResponse),
    };
  });

  const result = await fetchBseListingDayPrice("545031", expectedDate);

  assert.equal(apiRequestReached, true);
  assert.equal(result.openingPrice, 280);
});
