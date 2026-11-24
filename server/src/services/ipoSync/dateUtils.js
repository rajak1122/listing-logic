// Centralized source-date parsing. Naive source dates are interpreted as IST.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseSourceDate = (value, { endOfDay = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const input = String(value).trim();

  if (!input) return null;

  // Explicit timezone values are already unambiguous instants.
  const hasExplicitTimezone = /[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(
    input,
  );

  if (hasExplicitTimezone) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const createIstDate = (
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
    dateOnly = false,
  ) => {
    const validDate = new Date(Date.UTC(year, month - 1, day));

    if (
      validDate.getUTCFullYear() !== year ||
      validDate.getUTCMonth() !== month - 1 ||
      validDate.getUTCDate() !== day ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }

    // Date-only close dates should include the complete IST calendar day.
    if (endOfDay && dateOnly) {
      hour = 23;
      minute = 59;
      second = 59;
      millisecond = 999;
    }

    const utcMilliseconds = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      millisecond,
    );

    return new Date(utcMilliseconds - IST_OFFSET_MS);
  };

  // YYYY-MM-DD, optionally followed by a time without a timezone.
  const isoMatch = input.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  );

  if (isoMatch) {
    const [, year, month, day, hour, minute, second, millisecond] = isoMatch;

    return createIstDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0),
      Number((millisecond || "0").padEnd(3, "0")),
      !hour,
    );
  }

  // DD-MM-YYYY or DD/MM/YYYY, optionally followed by time.
  const dayFirstMatch = input.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (dayFirstMatch) {
    const [, day, month, year, hour, minute, second] = dayFirstMatch;

    return createIstDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0),
      0,
      !hour,
    );
  }

  // Formats such as 25-Nov-2026.
  const namedMonthMatch = input.match(
    /^(\d{1,2})[-\s]+([A-Za-z]{3,9})[-,\s]+(\d{4})$/,
  );

  if (namedMonthMatch) {
    const [, day, monthName, year] = namedMonthMatch;
    const month = MONTH_NAMES[monthName.toLowerCase()];

    if (!month) return null;

    return createIstDate(Number(year), month, Number(day), 0, 0, 0, 0, true);
  }

  // Unknown formats are rejected instead of relying on server-local timezone.
  return null;
};

module.exports = { parseSourceDate };
