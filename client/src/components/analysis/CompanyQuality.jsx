import { useMemo, useState } from "react";

const METRICS = [
  {
    key: "revenueFromOperations",
    label: "Revenue from Operations",
    shortLabel: "Revenue",
    unit: "₹ Cr",
    color: "bg-cyan-400",
    barColor: "#22d3ee",
    format: "crore",
  },
  {
    key: "totalIncome",
    label: "Total Income",
    shortLabel: "Total Income",
    unit: "₹ Cr",
    color: "bg-slate-400",
    barColor: "#94a3b8",
    format: "crore",
  },
  {
    key: "profitAfterTax",
    label: "Profit After Tax (PAT)",
    shortLabel: "PAT",
    unit: "₹ Cr",
    color: "bg-emerald-400",
    barColor: "#34d399",
    format: "crore",
  },
  {
    key: "eps",
    label: "Earnings Per Share (EPS)",
    shortLabel: "EPS",
    unit: "₹",
    color: "bg-violet-400",
    barColor: "#a78bfa",
    format: "rupees",
  },
  {
    key: "netWorth",
    label: "Net Worth",
    shortLabel: "Net Worth",
    unit: "₹ Cr",
    color: "bg-sky-400",
    barColor: "#38bdf8",
    format: "crore",
  },
  {
    key: "totalBorrowing",
    label: "Total Borrowings",
    shortLabel: "Borrowings",
    unit: "₹ Cr",
    color: "bg-amber-400",
    barColor: "#fbbf24",
    format: "crore",
  },
  {
    key: "revenueGrowthYoy",
    label: "Revenue Growth (YoY)",
    shortLabel: "Revenue Growth",
    unit: "%",
    color: "bg-cyan-300",
    barColor: "#67e8f9",
    format: "percent",
  },
  {
    key: "patMargin",
    label: "PAT Margin",
    shortLabel: "PAT Margin",
    unit: "%",
    color: "bg-emerald-300",
    barColor: "#6ee7b7",
    format: "percent",
  },
  {
    key: "debtToEquity",
    label: "Debt / Equity",
    shortLabel: "Debt / Equity",
    unit: "x",
    color: "bg-orange-300",
    barColor: "#fdba74",
    format: "multiple",
  },
  {
    key: "roe",
    label: "Return on Equity (ROE)",
    shortLabel: "ROE",
    unit: "%",
    color: "bg-fuchsia-300",
    barColor: "#f0abfc",
    format: "percent",
  },
  {
    key: "peRatio",
    label: "P/E Ratio",
    shortLabel: "P/E",
    unit: "x",
    color: "bg-indigo-300",
    barColor: "#a5b4fc",
    format: "multiple",
  },
];

const isNumeric = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const getYearLabel = (item) =>
  String(item?.financialYear ?? item?.year ?? item?.fy ?? "Year unavailable");

const getYearSortValue = (item) => {
  if (item?.periodEnded) {
    const timestamp = new Date(item.periodEnded).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const label = getYearLabel(item);
  const match = label.match(/20\d{2}/);
  return match ? new Date(Number(match[0]), 2, 31).getTime() : 0;
};

const formatNumber = (value, format = "number") => {
  if (!isNumeric(value)) return "N/A";
  const number = Number(value);
  const formatted = number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  if (format === "crore") return `₹${formatted} Cr`;
  if (format === "rupees") return `₹${formatted}`;
  if (format === "percent") return `${formatted}%`;
  if (format === "multiple") return `${formatted}x`;
  return formatted;
};

const SNAPSHOT_METRICS = [
  { key: "eps", label: "Pre-IPO EPS", format: "rupees" },
  { key: "revenueGrowthYoy", label: "Revenue Growth", format: "percent" },
  { key: "patMargin", label: "PAT Margin", format: "percent" },
  { key: "debtToEquity", label: "Debt / Equity", format: "multiple" },
  { key: "roe", label: "ROE", format: "percent" },
  { key: "peRatio", label: "P/E Ratio", format: "multiple" },
];

/**
 * Company Quality is deliberately presentation-only: it does not affect the
 * Listing Demand Engine's score or estimated listing-gain range.
 * Expected financialHistory row shape:
 * { financialYear, totalIncome, revenueFromOperations, profitAfterTax, eps,
 *   netWorth, totalBorrowing, revenueGrowthYoy, patMargin, debtToEquity, roe, peRatio }
 */
const CompanyQuality = ({ financialHistory, financials }) => {
  const [selectedMetric, setSelectedMetric] = useState("revenueFromOperations");

  const history = useMemo(() => {
    if (!Array.isArray(financialHistory)) return [];

    return financialHistory
      .filter((row) => row && typeof row === "object")
      .map((row) => ({ ...row }))
      .sort((a, b) => getYearSortValue(a) - getYearSortValue(b));
  }, [financialHistory]);

  const availableMetrics = useMemo(
    () =>
      METRICS.filter((metric) =>
        history.some((row) => isNumeric(row[metric.key])),
      ),
    [history],
  );

  const activeMetric =
    availableMetrics.find((metric) => metric.key === selectedMetric) ??
    availableMetrics[0] ??
    null;

  const chartRows = activeMetric
    ? history.filter((row) => isNumeric(row[activeMetric.key]))
    : [];

  const maxAbsValue = Math.max(
    0,
    ...chartRows.map((row) => Math.abs(Number(row[activeMetric?.key]))),
  );

  const snapshotMetrics = SNAPSHOT_METRICS.filter((metric) =>
    isNumeric(financials?.[metric.key]),
  );

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Company fundamentals · historical view
          </p>
          <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
            Company Quality
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Review reported financial performance by reporting period. This
            section is informational and does not change the listing-demand
            prediction.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          {history.length > 0
            ? `${history.length} reporting periods`
            : "History pending"}
        </span>
      </div>

      {history.length > 0 && availableMetrics.length > 0 ? (
        <div className="mt-5">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Choose financial metric"
          >
            {availableMetrics.map((metric) => (
              <button
                key={metric.key}
                type="button"
                onClick={() => setSelectedMetric(metric.key)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  activeMetric?.key === metric.key
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {metric.shortLabel}
              </button>
            ))}
          </div>

          {activeMetric && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {activeMetric.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Values shown as reported · {activeMetric.unit}
                  </p>
                </div>
                <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-400">
                  {chartRows.length} data point
                  {chartRows.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-4">
                {chartRows.map((row, index) => {
                  const value = Number(row[activeMetric.key]);
                  const barWidth =
                    maxAbsValue > 0 ? (Math.abs(value) / maxAbsValue) * 48 : 0;
                  const left = value >= 0 ? 50 : 50 - barWidth;
                  const yearLabel = getYearLabel(row);

                  return (
                    <div
                      key={`${yearLabel}-${index}`}
                      className="flex w-full min-w-0 items-center gap-2 sm:gap-3"
                    >
                      <span
                        className="w-20 shrink-0 truncate text-[11px] text-slate-400 sm:w-28 sm:text-xs"
                        title={yearLabel}
                      >
                        {yearLabel}
                      </span>
                      <div
                        style={{
                          position: "relative",
                          height: "24px",
                          minWidth: 0,
                          flex: "1 1 0%",
                          overflow: "hidden",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.14)",
                          backgroundColor: "rgba(255,255,255,0.07)",
                        }}
                        aria-label={`${yearLabel} ${activeMetric.label}: ${formatNumber(value, activeMetric.format)}`}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: "50%",
                            width: "1px",
                            backgroundColor: "rgba(255,255,255,0.4)",
                            zIndex: 2,
                          }}
                        />
                        {barWidth > 0 && (
                          <div
                            style={{
                              display: "block",
                              position: "absolute",
                              top: "50%",
                              transform: "translateY(-50%)",
                              left: `${left}%`,
                              width: `${barWidth}%`,
                              height: "12px",
                              borderRadius: "3px",
                              backgroundColor:
                                value < 0 ? "#fb7185" : activeMetric.barColor,
                              minWidth: "3px",
                              zIndex: 1,
                            }}
                            title={`${yearLabel}: ${formatNumber(value, activeMetric.format)}`}
                          />
                        )}
                      </div>
                      <span
                        className={`w-24 shrink-0 text-right font-mono text-[11px] sm:w-32 sm:text-xs ${
                          value < 0 ? "text-rose-300" : "text-slate-200"
                        }`}
                      >
                        {formatNumber(value, activeMetric.format)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-sm ${activeMetric.color}`}
                  />{" "}
                  Positive
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-rose-400/80" />{" "}
                  Negative
                </span>
                <span className="ml-auto">Bars use a zero-centred scale</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-slate-950/20 px-4 py-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-emerald-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M4 19V5m0 14h16M8 15v-4m4 4V7m4 8v-6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-200">
            Historical financial data not available yet
          </h3>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500">
            The historical chart will appear when the backend saves year-wise
            records in <code className="text-slate-300">financialHistory</code>.
            No sample or estimated values are shown here.
          </p>
        </div>
      )}

      {snapshotMetrics.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Available financial snapshot
            </h3>
            <span className="text-[11px] text-slate-500">
              Not a historical trend
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {snapshotMetrics.map((metric) => (
              <div
                key={metric.key}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="text-[11px] text-slate-500">{metric.label}</p>
                <p className="mt-2 break-words font-mono text-sm font-semibold text-slate-100">
                  {formatNumber(financials[metric.key], metric.format)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Financial values are displayed separately from the Listing Demand
        Engine. Missing values remain unavailable until reported data is synced.
      </p>
    </section>
  );
};

export default CompanyQuality;
