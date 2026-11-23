const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePeriodHeader,
  parseFinancialNumber,
  extractFinancialHistoryFromHtml,
} = require("../src/services/financialFallbackService");

const fusionCxFixture = `
<!doctype html>
<html><body>
<p>Notes: The EPS represents post-bonus basic EPS.</p>
<h3>Balance Sheet</h3>
<table>
  <thead><tr><th>Financials (₹ in Cr.)</th><th>30-Jun-26</th><th>FY26</th><th>FY25</th><th>FY24</th></tr></thead>
  <tbody>
    <tr><td>Net Worth</td><td>619.64</td><td>560.60</td><td>358.36</td><td>271.10</td></tr>
    <tr><td>Total Debt</td><td>238.12</td><td>266.85</td><td>306.72</td><td>210.50</td></tr>
  </tbody>
</table>
<h3>Profit &amp; Loss</h3>
<table>
  <thead><tr><th>Financials (₹ in Cr.)</th><th>30-Jun-26</th><th>FY26</th><th>FY25</th><th>FY24</th></tr></thead>
  <tbody>
    <tr><td>Revenue Annualised basis</td><td>490.48<br>1,961.92</td><td>1,818.13</td><td>1,329.29</td><td>991.30</td></tr>
    <tr><td>PAT Annualised basis</td><td>55.70<br>222.80</td><td>169.84</td><td>74.31</td><td>36.20</td></tr>
  </tbody>
</table>
<h3>Key Performance Indicators</h3>
<table>
  <thead><tr><th>Particulars (₹ In Cr.)</th><th>Jun-26</th><th>FY26</th><th>FY25</th><th>FY24</th></tr></thead>
  <tbody>
    <tr><td>PAT Margin (%)</td><td>11.36</td><td>9.34</td><td>5.59</td><td>3.65</td></tr>
    <tr><td>EPS (₹)</td><td>4.41</td><td>13.47</td><td>5.90</td><td>2.88</td></tr>
    <tr><td>ROE (%)</td><td>8.99</td><td>30.30</td><td>20.74</td><td>13.35</td></tr>
    <tr><td>Debt to Equity</td><td>0.38</td><td>0.48</td><td>0.86</td><td>0.78</td></tr>
  </tbody>
</table>
</body></html>`;

test("parse IPOPlatform fiscal-year and stub-period headers", () => {
  assert.equal(parsePeriodHeader("FY26").isoDate, "2026-03-31");
  assert.equal(parsePeriodHeader("FY 2024").isoDate, "2024-03-31");
  assert.equal(parsePeriodHeader("30-Jun-26").isoDate, "2026-06-30");
  assert.equal(parsePeriodHeader("Jun-26").isoDate, "2026-06-30");
});

test("parse financial numbers including the first number in an annualised stub cell", () => {
  assert.equal(parseFinancialNumber("1,818.13"), 1818.13);
  assert.equal(parseFinancialNumber("490.48 1,961.92"), 490.48);
  assert.equal(parseFinancialNumber("(12.50)"), -12.5);
  assert.equal(parseFinancialNumber("[●]"), null);
});

test("extract revenue from operations, annual EPS, and source-reported ratios by period", () => {
  const sourceUrl =
    "https://www.ipoplatform.com/ipo/financial-report/fusion-cx-ipo/4152";
  const rows = extractFinancialHistoryFromHtml(
    fusionCxFixture,
    sourceUrl,
    new Date("2026-10-14T00:00:00Z"),
  );
  const byDate = new Map(
    rows.map((row) => [
      new Date(row.periodEnded).toISOString().slice(0, 10),
      row,
    ]),
  );

  assert.equal(rows.length, 4);
  assert.equal(byDate.get("2024-03-31").eps, 2.88);
  assert.equal(byDate.get("2025-03-31").eps, 5.9);
  assert.equal(byDate.get("2026-03-31").eps, 13.47);
  assert.equal(byDate.get("2026-06-30").eps, 4.41);
  assert.equal(byDate.get("2026-03-31").epsBasis, "BASIC");
  assert.equal(byDate.get("2026-03-31").revenueFromOperations, 1818.13);
  assert.equal(
    Number(byDate.get("2026-06-30").revenueFromOperations.toFixed(2)),
    490.48,
  );
  assert.equal(byDate.get("2026-03-31").patMargin, 9.34);
  assert.equal(byDate.get("2026-03-31").debtToEquity, 0.48);
  assert.equal(byDate.get("2026-03-31").revenueGrowthYoy, 36.77);
  assert.equal(byDate.get("2026-03-31").fallbackSourceUrl, sourceUrl);
});
