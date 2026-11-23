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

const ClosedIpoTable = ({ ipos }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const closedIpos = ipos
    .filter((ipo) => ipo.status === "CLOSED")
    .sort((a, b) => {
      const dateA = a.closeDate ? new Date(a.closeDate).getTime() : 0;
      const dateB = b.closeDate ? new Date(b.closeDate).getTime() : 0;
      return dateB - dateA;
    });

  const visibleIpos = showAll
    ? closedIpos
    : closedIpos.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMoreIpos = closedIpos.length > INITIAL_VISIBLE_COUNT;

  if (closedIpos.length === 0) {
    return null;
  }

  return (
    <section className="glass-card w-full mt-8 mb-8">
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">
              Closed IPOs
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Ipo's that are scheduled to be listed.
            </p>
          </div>

          <span className="text-xs sm:text-sm text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-3 py-1.5 rounded-full whitespace-nowrap">
            {closedIpos.length} IPOs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="pb-4 pr-6 font-medium">IPO</th>
                <th className="pb-4 pr-6 font-medium">Tentative Listing</th>
                <th className="pb-4 pr-6 font-medium">Estimated Gain</th>
                <th className="pb-4 pr-6 font-medium">Final Subscription</th>
                <th className="pb-4 font-medium">Analysis</th>
              </tr>
            </thead>

            <tbody>
              {visibleIpos.map((ipo) => {
                const evaluation = ipo.evaluation;
                const estimatedGain = evaluation?.estimatedListingGain;
                const estimatedRange = parseListingRange(estimatedGain);
                return (
                  <tr
                    key={ipo._id || ipo.id}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="py-4 pr-6">
                      <span className="font-medium text-white">
                        {ipo.companyName}
                      </span>
                    </td>

                    <td className="py-4 pr-6 text-slate-400">
                      {ipo.tentativeListingDate
                        ? new Date(ipo.tentativeListingDate).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
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
                        <span className="text-slate-300">
                          {estimatedGain || "—"}
                        </span>
                      )}
                    </td>

                    <td className="py-4 pr-6">
                      <div className="font-semibold text-cyan-300">
                        {ipo.subscriptionDemand?.overallSubscriptionRate != null
                          ? `${Number(
                              ipo.subscriptionDemand.overallSubscriptionRate,
                            ).toFixed(2)}x`
                          : "—"}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        QIB{" "}
                        {ipo.subscriptionDemand?.qib != null
                          ? `${Number(ipo.subscriptionDemand.qib).toFixed(2)}x`
                          : "—"}
                        {" · "}
                        NII{" "}
                        {ipo.subscriptionDemand?.nii != null
                          ? `${Number(ipo.subscriptionDemand.nii).toFixed(2)}x`
                          : "—"}
                        {" · "}
                        Retail{" "}
                        {ipo.subscriptionDemand?.retail != null
                          ? `${Number(ipo.subscriptionDemand.retail).toFixed(2)}x`
                          : "—"}
                      </div>
                    </td>

                    <td className="py-4">
                      <button
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
              className="px-5 py-2.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15 hover:border-cyan-400/40 text-sm font-medium transition-all"
            >
              {showAll
                ? "Show Less ↑"
                : `Show More (${closedIpos.length - INITIAL_VISIBLE_COUNT} more) ↓`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ClosedIpoTable;
