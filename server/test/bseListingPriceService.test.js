const test = require("node:test");
const assert = require("node:assert/strict");

const {
  fetchBseListingDayPrice,
} = require("../src/services/bseListingPriceService");

const expectedDate = "2026-11-26T00:00:00.000Z";

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

const mockFetch = (t, response, options = {}) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    if (options.networkError) {
      throw new Error("Network failure");
    }

    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      json: async () => response,
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });
};

test("returns listing-day opening price for matching date", async (t) => {
  mockFetch(t, validResponse);

  const result = await fetchBseListingDayPrice("545031", expectedDate);

  assert.equal(result.openingPrice, 280);
  assert.equal(result.high, 283.5);
  assert.equal(result.low, 268);
  assert.equal(result.listingDate, "2026-11-26");
  assert.equal(result.source, "BSE_SCRIP_HEADER");
});

test("rejects when BSE quote date does not match listing date", async (t) => {
  mockFetch(t, {
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

test("rejects invalid BSE scrip code", async (t) => {
  await assert.rejects(
    () => fetchBseListingDayPrice("123", expectedDate),
    /Invalid BSE scrip code/,
  );
});

test("rejects when Header is missing", async (t) => {
  mockFetch(t, {});

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /does not contain Header/,
  );
});

test("rejects invalid opening price", async (t) => {
  mockFetch(t, {
    Header: {
      ...validResponse.Header,
      Open: "0",
    },
  });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /Invalid opening price/,
  );
});

test("rejects when BSE API returns HTTP error", async (t) => {
  mockFetch(t, {}, { ok: false, status: 503 });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /HTTP 503/,
  );
});

test("rejects when network request fails", async (t) => {
  mockFetch(t, {}, { networkError: true });

  await assert.rejects(
    () => fetchBseListingDayPrice("545031", expectedDate),
    /Network failure/,
  );
});
