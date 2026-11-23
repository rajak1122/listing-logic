const UpcomingIpoTable = ({ ipos = [] }) => {
  if (!ipos.length) {
    return null;
  }

  return (
    <section className="glass-card w-full p-5 sm:p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            Upcoming IPOs
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            IPOs scheduled to open soon
          </p>
        </div>

        <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
          {ipos.length} IPO{ipos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-white/10">
              <th className="pb-3 pr-6 font-medium">IPO</th>
              <th className="pb-3 pr-6 font-medium">Type</th>
              <th className="pb-3 pr-6 font-medium">Open</th>
              <th className="pb-3 pr-6 font-medium">Close</th>
              <th className="pb-3 pr-6 font-medium">Price Band</th>
              <th className="pb-3 font-medium">Issue Size</th>
            </tr>
          </thead>

          <tbody>
            {ipos.map((ipo) => (
              <tr
                key={ipo._id || ipo.id}
                className="border-b border-white/5 last:border-0"
              >
                <td className="py-4 pr-6">
                  <span className="font-medium text-slate-200">
                    {ipo.companyName}
                  </span>
                </td>

                <td className="py-4 pr-6">
                  {ipo.ipoType && (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
                      {ipo.ipoType === "MainBoard" ? "Mainboard" : "SME"}
                    </span>
                  )}
                </td>

                <td className="py-4 pr-6 text-slate-400">
                  {ipo.openDate
                    ? new Date(ipo.openDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "-"}
                </td>

                <td className="py-4 pr-6 text-slate-400">
                  {ipo.closeDate
                    ? new Date(ipo.closeDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "-"}
                </td>

                <td className="py-4 pr-6 text-slate-300">
                  ₹{ipo.priceBand || "-"}
                </td>

                <td className="py-4 text-slate-300">
                  {ipo.issueSizeCr != null ? `₹${ipo.issueSizeCr} Cr` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UpcomingIpoTable;
