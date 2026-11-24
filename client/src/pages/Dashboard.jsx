import React, { useState, useEffect } from "react";
import axios from "axios";
import { Navbar } from "../components/common/Navbar";
import { IpoCard } from "../components/dashboard/IpoCard";
import { FiSearch, FiLayers } from "react-icons/fi";
import UpcomingIpoTable from "../components/dashboard/UpcomingIpoTable";
import ClosedIpoTable from "../components/dashboard/ClosedIpoTable";
import ListedIpoTable from "../components/dashboard/ListedIpoTable";
import Footer from "../components/dashboard/Footer";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const Dashboard = () => {
  const [ipos, setIpos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const latestSyncTime = ipos.reduce((latest, ipo) => {
    if (!ipo.lastSynced) return latest;

    const current = new Date(ipo.lastSynced);

    return !latest || current > latest ? current : latest;
  }, null);

  const getTimeAgo = (date) => {
    if (!date) return "Not updated yet";

    const diffInMinutes = Math.floor(
      (Date.now() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Updated just now";
    if (diffInMinutes === 1) return "Updated 1 min ago";

    return `Updated ${diffInMinutes} min ago`;
  };

  const filteredIpos = ipos
    .filter((ipo) => {
      const matchesSearch = String(ipo.companyName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const ipoType = String(ipo.ipoType || "").toLowerCase();
      const classification = String(
        ipo.evaluation?.classification || ipo.classification || "",
      ).toUpperCase();

      const matchesFilter =
        filterStatus === "ALL" ||
        (filterStatus === "MAINBOARD" && ipoType === "mainboard") ||
        (filterStatus === "SME" && ipoType === "sme") ||
        (filterStatus === "TRENDING" &&
          ["STRONG LISTING SETUP", "MODERATE LISTING SETUP"].includes(
            classification,
          ));

      return ipo.status === "ACTIVE" && matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (filterStatus === "TRENDING") {
        const priority = {
          "STRONG LISTING SETUP": 1,
          "MODERATE LISTING SETUP": 2,
        };

        const aClassification = String(
          a.evaluation?.classification || a.classification || "",
        ).toUpperCase();

        const bClassification = String(
          b.evaluation?.classification || b.classification || "",
        ).toUpperCase();

        return (
          (priority[aClassification] || 99) - (priority[bClassification] || 99)
        );
      }

      return new Date(a.closeDate) - new Date(b.closeDate);
    });

  const upcomingIpos = ipos
    .filter((ipo) => ipo.status === "UPCOMING")
    .sort((a, b) => new Date(a.openDate) - new Date(b.openDate));

  useEffect(() => {
    fetchIpos();
  }, []);

  const fetchIpos = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/ipos`);
      setIpos(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch IPOs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-darkbg text-slate-100 relative overflow-clip">
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <Navbar onSyncSuccess={fetchIpos} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pt-8 pb-2 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search active IPOs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-card text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
            <FiLayers /> Total IPOs Evaluated:{" "}
            <span className="text-white font-semibold">{ipos.length}</span>
          </div>
        </div>

        <UpcomingIpoTable ipos={upcomingIpos} />

        <div className="mb-5 mt-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">
            Live IPOs
          </h2>
          <div className="flex gap-3 items-center">
            <p className="text-sm text-slate-400 mt-1">
              IPOs currently open for subscription
            </p>
            <div className="flex mt-1 items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {getTimeAgo(latestSyncTime)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: "All", value: "ALL" },
              { label: "Mainboard", value: "MAINBOARD" },
              { label: "SME", value: "SME" },
              { label: "Trending", value: "TRENDING" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  filterStatus === filter.value
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                    : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card h-64 animate-pulse p-6" />
            ))}
          </div>
        ) : filteredIpos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIpos.map((ipo) => (
              <IpoCard key={ipo._id || ipo.id} ipo={ipo} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center max-w-md mx-auto my-12">
            <p className="text-slate-400 text-sm">
              No IPOs found. Add one to see automatic scoring in action!
            </p>
          </div>
        )}

        <ClosedIpoTable ipos={ipos} />
        <ListedIpoTable ipos={ipos} />
      </main>

      <Footer />
    </div>
  );
};
