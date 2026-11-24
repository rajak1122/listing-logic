const { parseSourceDate } = require("./dateUtils");

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

const isFiniteNumericValue = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const isValidListingPrice = (value) =>
  isFiniteNumericValue(value) && Number(value) > 0;

// Parse GMP without converting a missing value into zero.
const parseGmpValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
};

// Preserve the last known snapshot when the new source value is missing.
const resolveGmpValue = (incoming, existing) => {
  return parseGmpValue(incoming) ?? existing ?? null;
};

// Do not erase the last known subscription snapshot when the exchange endpoint
// has a transient empty response. Merge partial fresh values category-by-category.
const mergeSubscriptionDemand = (existing = {}, incoming = null) => {
  const oldData = toPlainObject(existing) || {};
  const newData = incoming || {};
  const pick = (next, previous) =>
    next !== null && next !== undefined && next !== ""
      ? next
      : (previous ?? null);

  const incomingUpdatedAt = newData.updatedAt
    ? parseSourceDate(newData.updatedAt)
    : null;
  return {
    qib: pick(newData.qib, oldData.qib),
    nii: pick(newData.nii, oldData.nii),
    retail: pick(newData.retail, oldData.retail),
    overallSubscriptionRate: pick(
      newData.total,
      oldData.overallSubscriptionRate ?? oldData.total,
    ),
    updatedAt:
      incomingUpdatedAt && !Number.isNaN(incomingUpdatedAt.getTime())
        ? incomingUpdatedAt
        : (oldData.updatedAt ?? null),
  };
};

const mergeFinancialSnapshot = (existing = {}, incoming = {}) => {
  const oldData = toPlainObject(existing) || {};
  const newData = toPlainObject(incoming) || {};
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const merged = {};

  for (const key of keys) {
    const nextValue = newData[key];
    const previousValue = oldData[key];
    merged[key] =
      nextValue !== null && nextValue !== undefined
        ? nextValue
        : (previousValue ?? null);
  }

  return merged;
};

const historyRecordKey = (row) => {
  const item = toPlainObject(row) || {};
  if (item.periodEnded) {
    const parsed = new Date(item.periodEnded);
    if (!Number.isNaN(parsed.getTime()))
      return parsed.toISOString().slice(0, 10);
  }
  return String(item.financialYear || item.year || "")
    .trim()
    .toLowerCase();
};

const mergeFinancialHistory = (existing = [], incoming = []) => {
  const rowsByKey = new Map();

  for (const rawRow of [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ]) {
    const row = toPlainObject(rawRow) || {};
    const key = historyRecordKey(row);
    if (!key) continue;

    const previous = rowsByKey.get(key) || {};
    const merged = { ...previous };
    for (const [field, value] of Object.entries(row)) {
      // Null values from a partial scrape must not erase previously saved data.
      if (value !== null && value !== undefined && value !== "")
        merged[field] = value;
      else if (!(field in merged)) merged[field] = value ?? null;
    }
    rowsByKey.set(key, merged);
  }

  return [...rowsByKey.values()].sort((a, b) => {
    const dateA = a.periodEnded ? new Date(a.periodEnded).getTime() : 0;
    const dateB = b.periodEnded ? new Date(b.periodEnded).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return String(a.financialYear || "").localeCompare(
      String(b.financialYear || ""),
    );
  });
};

module.exports = {
  toPlainObject,
  isFiniteNumericValue,
  isValidListingPrice,
  parseGmpValue,
  resolveGmpValue,
  mergeSubscriptionDemand,
  mergeFinancialSnapshot,
  mergeFinancialHistory,
};
