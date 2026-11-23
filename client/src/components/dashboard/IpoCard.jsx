import { SignalBadge } from "../common/SignalBadge";
import {
  FiDollarSign,
  FiBarChart2,
  FiPieChart,
  FiArrowRight,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const parseListingRange = (range) => {
  const match = String(range ?? "").match(
    /(-?\d+(?:\.\d+)?)%\s*-\s*(-?\d+(?:\.\d+)?)%/,
  );

  if (!match) return null;

  return [Number(match[1]), Number(match[2])];
};

const getRangeColor = (value) => {
  if (value < 0) return "text-red-400";
  if (value > 0) return "text-emerald-300";
  return "text-slate-300";
};

export const IpoCard = ({ ipo, onSelect }) => {
  const navigate = useNavigate();
  const {
    companyName,
    exchange,
    ipoType,
    openDate,
    closeDate,
    upperPriceBand,
    issueSizeCr,
    evaluation,
  } = ipo;

  const {
    totalScore = 0,
    maxScore = 30,
    estimatedListingGain = "0%",
    signalBadge = "AVOID",
    negativeListingPossibility = "NONE",
  } = evaluation || {};

  const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  const listingRange = parseListingRange(estimatedListingGain);

  return (
    <div className="glass-card p-6 flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
      {/* Card Header */}
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
              {companyName}
            </h3>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                {exchange}
              </span>

              {ipoType && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
                  {ipoType === "MainBoard" ? "Mainboard" : "SME"}
                </span>
              )}
            </div>
            {negativeListingPossibility === "HIGH" && (
              <div className="mt-3 text-xs text-red-400 font-medium">
                ⚠ Negative Listing Risk
              </div>
            )}
          </div>

          <SignalBadge badge={signalBadge} />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 my-4">
          {/* Price Band */}
          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <FiDollarSign className="text-cyan-400" size={14} />
              <span className="text-xs text-slate-400">Price Band</span>
            </div>

            <span className="font-semibold text-slate-200 text-sm">
              ₹{upperPriceBand}
            </span>
          </div>

          {/* Issue Size */}
          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <FiPieChart className="text-purple-400" size={14} />
              <span className="text-xs text-slate-400">Issue Size</span>
            </div>

            <span className="font-semibold text-slate-200 text-sm">
              ₹{issueSizeCr} Cr
            </span>
          </div>
          {(openDate || closeDate) && (
            <div className="mt-3 text-xs text-slate-400 flex justify-between">
              <span>
                Open:{" "}
                {openDate
                  ? new Date(openDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "-"}
              </span>

              <span>
                Close:{" "}
                {closeDate
                  ? new Date(closeDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "-"}
              </span>
            </div>
          )}
        </div>

        {/* Listing Score */}
        <div className="mt-5">
          <div className="flex justify-between items-center text-xs mb-2">
            <div className="flex items-center gap-2">
              <FiBarChart2 className="text-emerald-400" size={14} />
              <span className="text-slate-400">Listing Score</span>
            </div>

            <span className="font-bold text-emerald-400">
              {totalScore}
              <span className="text-slate-500"> / {maxScore}</span>
            </span>
          </div>

          <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(scorePercentage, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-slate-400">Est. Listing Gain</span>

          {listingRange ? (
            <span className="inline-flex items-center font-bold gap-2">
              <span className={getRangeColor(listingRange[0])}>
                {listingRange[0]}%
              </span>

              <span className="text-slate-400"> - </span>

              <span className={getRangeColor(listingRange[1])}>
                {listingRange[1]}%
              </span>
            </span>
          ) : (
            estimatedListingGain
          )}
        </div>

        {/* Detailed Analysis Button */}
        <button
          onClick={() => navigate(`/ipo/${ipo._id || ipo.id}`)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-slate-200 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:text-emerald-300 transition-all duration-200"
        >
          View Detailed Analysis
          <FiArrowRight
            size={15}
            className="group-hover:translate-x-1 transition-transform"
          />
        </button>
      </div>
    </div>
  );
};
