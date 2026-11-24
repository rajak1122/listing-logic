import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { SignalBadge } from "../components/common/SignalBadge";
import { Navbar } from "../components/common/Navbar";
import Footer from "../components/dashboard/Footer";
import CompanyQuality from "../components/analysis/CompanyQuality";

const parseListingRange = (range) => {
  const match = String(range ?? "").match(
    /(-?\d+(?:\.\d+)?)%\s*[-–—]\s*(-?\d+(?:\.\d+)?)%/,
  );

  if (!match) return null;

  return [Number(match[1]), Number(match[2])];
};

const getRangeColor = (value) => {
  if (value < 0) return "text-rose-400";
  if (value > 0) return "text-emerald-300";
  return "text-slate-300";
};

const IpoAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ipo, setIpo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchIpo = async () => {
      setLoading(true);
      setFetchError(false);

      try {
        const response = await axios.get(
`${import.meta.env.VITE_API_BASE_URL || "https://listinglogic-api.onrender.com"}/api/ipos/${id}`,        );
        if (isMounted) setIpo(response.data?.data ?? null);
      } catch (error) {
        console.error("Failed to fetch IPO:", error);
        if (isMounted) {
          setIpo(null);
          setFetchError(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchIpo();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-darkBg text-slate-100">
        <Navbar />
        <main className="mx-auto mt-10 max-w-5xl px-4 text-sm text-slate-400">
          Loading analysis...
        </main>
        <Footer />
      </div>
    );
  }

  if (!ipo) {
    return (
      <div className="min-h-screen bg-darkBg text-slate-100">
        <Navbar />
        <main className="mx-auto mt-10 max-w-5xl px-4">
          <div className="glass-card p-6">
            <h1 className="text-lg font-semibold text-white">
              {fetchError ? "Unable to load IPO analysis" : "IPO not found"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {fetchError
                ? "Check the backend connection and try again."
                : "This IPO may have been removed or the link may be invalid."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/20"
            >
              Back to dashboard
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const {
    companyName,
    exchange,
    ipoType,
    openDate,
    closeDate,
    upperPriceBand,
    issueSizeCr,
  } = ipo;

  // V2 evaluation. Keep the page resilient if an older API response is cached.
  const evaluation = ipo.evaluation ?? {};
  const {
    demandScore = 0,
    demandMaxScore = 15,
    listingConfidence = 0,
    estimatedListingGain = "N/A",
    estimatedGainPoint = null,
    signalBadge = "NEUTRAL LISTING SETUP",
    negativeListingPossibility = "UNKNOWN",
    dataConfidence = null,
    categoryBreakdown = {},
    metrics = {},
    flags = [],
  } = evaluation;

  const scoreRows = [
    { label: "QIB Subscription", score: categoryBreakdown.qibScore, max: 4 },
    { label: "NII Subscription", score: categoryBreakdown.niiScore, max: 2 },
    {
      label: "Overall Subscription",
      score: categoryBreakdown.overallScore,
      max: 3,
    },
    { label: "GMP Yield", score: categoryBreakdown.gmpScore, max: 6 },
  ];

  const riskClasses = {
    HIGH: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    MODERATE: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    LOW: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
    NONE: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    UNKNOWN: "border-white/10 bg-white/5 text-slate-300",
  };
  const negativeRisk = String(
    negativeListingPossibility || "UNKNOWN",
  ).toUpperCase();

  const listingRange = parseListingRange(estimatedListingGain);

  return (
    <div className="min-h-screen bg-darkBg text-slate-100">
      <Navbar />
      <main className="mx-auto mt-6 w-full max-w-5xl px-3 pb-10 sm:mt-10 sm:px-4">
        <div className="glass-card p-4 sm:p-5">
          {/* IPO header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="break-words text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  {companyName}
                </h1>
                {exchange && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {exchange}
                  </span>
                )}
                {ipoType && (
                  <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                    {ipoType === "MainBoard" ? "Mainboard" : "SME"}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400 sm:text-sm">
                Price band:{" "}
                {upperPriceBand != null ? `₹${upperPriceBand}` : "N/A"}
                {issueSizeCr != null ? ` · Issue size: ₹${issueSizeCr} Cr` : ""}
              </p>
              {(openDate || closeDate) && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>
                    Open:{" "}
                    {openDate
                      ? new Date(openDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </span>
                  <span>
                    Close:{" "}
                    {closeDate
                      ? new Date(closeDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="Close analysis"
              className="shrink-0 rounded-lg p-1 text-xl font-bold text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          {/* Listing-only summary; fundamental quality is shown separately below. */}
          <section className="my-5 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-400">
                Listing Signal
              </span>
              <div className="mt-2">
                <SignalBadge badge={signalBadge} />
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400">
                Demand Score
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-cyan-300">
                {demandScore}
                <span className="text-sm text-slate-500">
                  {" "}
                  / {demandMaxScore}
                </span>
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400">
                Listing Confidence
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-cyan-300">
                {Number.isFinite(Number(listingConfidence))
                  ? Number(listingConfidence).toFixed(1)
                  : "N/A"}
                <span className="text-sm text-slate-500"> / 100</span>
              </p>
              {dataConfidence && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Data confidence: {dataConfidence}
                </p>
              )}
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400">
                Estimated Listing Range
              </span>
              <p className="mt-1 break-words font-mono text-xl font-bold">
                {listingRange ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className={getRangeColor(listingRange[0])}>
                      {listingRange[0]}%
                    </span>

                    <span className="text-slate-400">–</span>

                    <span className={getRangeColor(listingRange[1])}>
                      {listingRange[1]}%
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-300">{estimatedListingGain}</span>
                )}
              </p>
              {estimatedGainPoint != null && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Point estimate: {Number(estimatedGainPoint).toFixed(1)}%
                </p>
              )}
            </div>
          </section>

          {/* Listing Demand Engine */}
          <section className="rounded-xl border border-cyan-500/15 bg-white/[0.04] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Listing prediction
                </p>
                <h2 className="mt-1 text-base font-bold text-white">
                  Listing Demand Engine
                </h2>
              </div>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2 py-1 font-mono text-xs font-semibold text-cyan-200">
                {demandScore} / {demandMaxScore} pts
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-3">
                {scoreRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-400">{row.label}</span>
                    <span className="font-mono font-medium text-slate-200">
                      {row.score ?? 0} / {row.max}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-sm">
                  <span className="text-slate-400">Retail / RII</span>
                  <span className="font-mono text-slate-300">
                    Reported: {metrics.rii ?? "N/A"}x · Not scored in V2
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-white/5 bg-slate-950/25 p-3">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Input snapshot
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-slate-500">QIB</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {metrics.qib ?? "N/A"}x
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">NII</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {metrics.nii ?? "N/A"}x
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Overall subscription</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {metrics.overall ?? "N/A"}x
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">GMP</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {metrics.gmp != null ? `₹${metrics.gmp}` : "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">GMP yield</p>
                    <p className="mt-1 font-mono text-slate-200">
                      {metrics.gmpYield != null
                        ? `${Number(metrics.gmpYield).toFixed(1)}%`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">
                  Negative listing possibility:
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-semibold ${riskClasses[negativeRisk] ?? riskClasses.UNKNOWN}`}
                >
                  {negativeRisk}
                </span>
              </div>
              {Array.isArray(flags) && flags.length > 0 && (
                <span className="text-xs text-amber-200">
                  {flags.length} risk/data flag{flags.length === 1 ? "" : "s"}{" "}
                  detected
                </span>
              )}
            </div>

            {Array.isArray(flags) && flags.length > 0 && (
              <div className="mt-3 space-y-2">
                {flags.map((flag, index) => (
                  <div
                    key={`${flag}-${index}`}
                    className="rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100/80"
                  >
                    {String(flag).replaceAll("_", " ")}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historical company information is separate from listing scoring. */}
          <CompanyQuality
            financialHistory={ipo.financialHistory}
            financials={ipo.financials}
          />

          <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/20"
            >
              Close Analysis
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default IpoAnalysis;
