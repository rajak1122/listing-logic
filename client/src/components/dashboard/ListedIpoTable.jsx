import { useState } from "react";
import { useNavigate } from "react-router-dom";

const INITIAL_VISIBLE_COUNT = 10;

const parseListingRange = (range) => {
  const match = String(range ?? "").match(
    /(-?\d+(?:\.\d+)?)%\s*[-–—]\s*(-?\d+(?:\.\d+)?)%/,
  );

  return match ? [Number(match[1]), Number(match[2])] : null;
};

const getRangeColor = (value) => {
  if (value < 0) return "text-rose-400";
  if (value > 0) return "text-emerald-300";
  return "text-slate-300";
};

const ListedIpoTable = ({ ipos = [] }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const listedIpos = ipos
    .filter((ipo) => String(ipo.status || "").toUpperCase() === "LISTED")
    .sort((a, b) => {
      const dateA = a.tentativeListingDate
        ? new Date(a.tentativeListingDate).getTime()
        : 0;
      const dateB = b.tentativeListingDate
        ? new Date(b.tentativeListingDate).getTime()
        : 0;
      return dateB - dateA;
    });

  const visibleIpos = showAll
    ? listedIpos
    : listedIpos.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMoreIpos = listedIpos.length > INITIAL_VISIBLE_COUNT;

  if (listedIpos.length === 0) return null;

  return (
    <section className="glass-card w-full mt-8 mb-6">
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">
              Listed IPOs
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Track predicted vs actual listing performance
            </p>
          </div>
          <span className="text-xs sm:text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-full whitespace-nowrap">
            {listedIpos.length} IPOs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="pb-4 pr-6 font-medium">IPO</th>
                <th className="pb-4 pr-6 font-medium">Listing Date</th>
                <th className="pb-4 pr-6 font-medium">Estimated Gain</th>
                <th className="pb-4 pr-6 font-medium">Listing Price</th>
                <th className="pb-4 pr-6 font-medium">Actual Gain</th>
                <th className="pb-4 font-medium">Analysis</th>
              </tr>
            </thead>
            <tbody>
              {visibleIpos.map((ipo) => {
                const estimatedGain = ipo.evaluation?.estimatedListingGain;
                const estimatedRange = parseListingRange(estimatedGain);

                return (
                  <tr
                    key={ipo._id || ipo.id || ipo.companyName}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="py-4 pr-6">
                      <span className="font-medium text-white whitespace-nowrap">
                        {ipo.companyName}
                      </span>
                    </td>
                    <td className="py-4 pr-6 text-slate-400 whitespace-nowrap">
                      {ipo.tentativeListingDate
                        ? new Date(ipo.tentativeListingDate).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )
                        : "—"}
                    </td>
                    <td className="py-4 pr-6 font-medium whitespace-nowrap">
                      {estimatedRange ? (
                        <span className="inline-flex items-center gap-2">
                          <span className={getRangeColor(estimatedRange[0])}>
                            {estimatedRange[0]}%
                          </span>
                          <span className="text-slate-400">–</span>
                          <span className={getRangeColor(estimatedRange[1])}>
                            {estimatedRange[1]}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">{estimatedGain || "—"}</span>
                      )}
                    </td>
                    <td className="py-4 pr-6 font-mono text-slate-200 whitespace-nowrap">
                      {ipo.actualListingPrice != null
                        ? `₹${Number(ipo.actualListingPrice).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td
                      className={`py-4 pr-6 font-semibold whitespace-nowrap ${
                        ipo.actualListingGain != null
                          ? ipo.actualListingGain < 0
                            ? "text-rose-400"
                            : ipo.actualListingGain > 0
                              ? "text-emerald-300"
                              : "text-slate-300"
                          : "text-slate-400"
                      }`}
                    >
                      {ipo.actualListingGain != null
                        ? `${Number(ipo.actualListingGain).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/ipo/${ipo._id || ipo.id}`)}
                        className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-all whitespace-nowrap"
                      >
                        View Analysis →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMoreIpos && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="px-5 py-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15 hover:border-emerald-400/40 text-sm font-medium transition-all"
            >
              {showAll
                ? "Show Less ↑"
                : `Show More (${listedIpos.length - INITIAL_VISIBLE_COUNT} more) ↓`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ListedIpoTable;
