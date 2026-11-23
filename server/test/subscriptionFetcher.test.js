const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractBseSubscriptionRows,
  parseBseSubscriptionRows,
} = require('../src/services/scraperService');

test('unwraps lower-case table1 BSE payload and parses category multiples', () => {
  const payload = {
    table1: [
      { SRNo: '1', col2: 'Qualified Institutional Buyers', col5: '3.25', Maxdt: '14-10-2026 17:00:00' },
      { SRNo: '2', col2: 'Non-Institutional Buyers', col5: '7.40', Maxdt: '14-10-2026 17:00:00' },
      { SRNo: '3', col2: 'Individual Investors', col5: '1.80', Maxdt: '14-10-2026 17:00:00' },
      { SRNo: '4', col2: 'Total', col5: '4.02', Maxdt: '14-10-2026 17:00:00' },
    ],
  };
  const rows = extractBseSubscriptionRows(payload);
  assert.equal(rows.length, 4);
  assert.deepEqual(parseBseSubscriptionRows(rows), {
    qib: 3.25, nii: 7.4, retail: 1.8, total: 4.02, updatedAt: '14-10-2026 17:00:00',
  });
});

test('unwraps capitalized Table1 and handles named category/multiple fields', () => {
  const payload = {
    Table: [],
    Table1: [
      { Category: 'QIB', SubscriptionMultiple: '5.12x' },
      { InvestorCategory: 'NII / HNI', SubscriptionRate: '6.2 times' },
      { CategoryName: 'Retail Individual Investors', SubscriptionMultiple: '2.01' },
      { Particulars: 'Total Subscription', SubscriptionMultiple: '4.88' },
    ],
  };
  const rows = extractBseSubscriptionRows(payload);
  assert.equal(rows.length, 4);
  assert.deepEqual(parseBseSubscriptionRows(rows), {
    qib: 5.12, nii: 6.2, retail: 2.01, total: 4.88, updatedAt: null,
  });
});

test('accepts a top-level row array and does not require SRNo when category labels exist', () => {
  const rows = [
    { col2: 'Qualified Institutional Buyers', col5: '3.5' },
    { col2: 'Non Institutional Buyers', col5: '4.6' },
    { col2: 'Retail Individual Investors', col5: '2.1' },
    { col2: 'Total', col5: '3.9' },
  ];
  assert.deepEqual(parseBseSubscriptionRows(extractBseSubscriptionRows(rows)), {
    qib: 3.5, nii: 4.6, retail: 2.1, total: 3.9, updatedAt: null,
  });
});

test('returns null for payloads with no usable subscription multiples', () => {
  assert.deepEqual(extractBseSubscriptionRows({ data: { message: 'no rows' } }), []);
  assert.equal(parseBseSubscriptionRows([]), null);
  assert.equal(parseBseSubscriptionRows([{ col2: 'Total', col5: 'N/A' }]), null);
});
