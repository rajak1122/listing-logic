const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const {
  fetchOpenIpos,
  fetchBseIpoList,
} = require("../src/services/scraperService");

const makeScriptTickRow = (gmp = "GMP 0") =>
  [
    "BSE",
    "Example Limited",
    "10",
    "Band 100-110",
    "100",
    "Open 01-01-2026",
    "Close 03-01-2026",
    "Allotment 04-01-2026",
    "Credit 05-01-2026",
    "Listing 06-01-2026",
    "Emp Disc -",
    gmp,
    "Issue Size 100 Cr",
    "Subscription 2x",
    "Registrar ABC",
  ].join("|");

// ==========================================
// ScriptTick tests
// ==========================================

test("ScriptTick: network failure throws instead of returning empty data", async (t) => {
  t.mock.method(axios, "get", async () => {
    throw new Error("network offline");
  });

  await assert.rejects(fetchOpenIpos(), /ScriptTick.*network offline/);
});

test("ScriptTick: successful empty response returns an empty array", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: " \n \r\n ",
  }));

  assert.deepEqual(await fetchOpenIpos(), []);
});

test("ScriptTick: malformed response throws instead of appearing empty", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: "<html>Access denied</html>",
  }));

  await assert.rejects(fetchOpenIpos(), /Unexpected payload format/);
});

test("ScriptTick: missing GMP stays null instead of becoming zero", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: makeScriptTickRow("").replace(/\|/g, "|"),
  }));

  const result = await fetchOpenIpos();

  assert.equal(result.length, 1);
  assert.equal(result[0].gmp, null);
});

test("ScriptTick: genuine zero GMP remains zero", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: makeScriptTickRow("GMP 0"),
  }));

  const result = await fetchOpenIpos();

  assert.equal(result.length, 1);
  assert.equal(result[0].gmp, "0");
});

// ==========================================
// BSE IPO list tests
// ==========================================

test("BSE IPO list: network failure throws", async (t) => {
  t.mock.method(axios, "get", async () => {
    throw new Error("BSE unavailable");
  });

  await assert.rejects(fetchBseIpoList(), /BSE IPO List.*BSE unavailable/);
});

test("BSE IPO list: unexpected payload throws", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: {
      message: "Unexpected response",
    },
  }));

  await assert.rejects(fetchBseIpoList(), /Expected Table array/);
});

test("BSE IPO list: valid empty Table returns an empty array", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: {
      Table: [],
    },
  }));

  assert.deepEqual(await fetchBseIpoList(), []);
});

test("BSE IPO list: valid Table records are returned", async (t) => {
  const records = [{ Scrip_Name: "Example Limited", Scrip_cd: "12345" }];

  t.mock.method(axios, "get", async () => ({
    data: {
      Table: records,
    },
  }));

  assert.deepEqual(await fetchBseIpoList(), records);
});
