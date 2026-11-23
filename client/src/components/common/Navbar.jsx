import { useState } from "react";
import { FiTrendingUp, FiPlus } from "react-icons/fi";
import axios from 'axios';

export const Navbar = ({ onSyncSuccess }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await axios.post("http://localhost:5000/api/ipos/sync");
      console.log("Sync result:", res.data);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error("Failed to trigger live sync:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 !rounded-none border-b border-white/10 px-6 py-4 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-glowGreen">
            <FiTrendingUp className="text-2xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Listing<span className="text-emerald-400">Logic</span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              IPO Intelligence & Listing Gain Scoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Live Data Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? "Syncing..." : "Sync Live Data"}
          </button>

          <button className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition">
            + Analyze New IPO
          </button>
        </div>
      </div>
    </nav>
  );
};
