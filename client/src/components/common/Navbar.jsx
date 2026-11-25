import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  FiTrendingUp,
  FiRefreshCw,
  FiLogOut,
  FiShield,
  FiUsers,
  FiLoader,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const Navbar = ({ onSyncSuccess }) => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [adminProfile, setAdminProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");

  // Load backend role separately from Firebase identity.
  // A normal authenticated user is expected to receive 403 from /admins/me.
  useEffect(() => {
    let isMounted = true;

    const loadAdminProfile = async () => {
      setAdminProfile(null);
      setMessage("");

      if (!user) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const idToken = await user.getIdToken();

        const response = await fetch(`${API_BASE_URL}/api/admins/me`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          // 403 is the normal result for a signed-in non-admin user.
          if (response.status !== 401 && response.status !== 403) {
            console.error("[Admin Profile]", result.message);
          }
          return;
        }

        if (isMounted) {
          setAdminProfile(result.data || null);
        }
      } catch (error) {
        console.error("[Admin Profile]", error);
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    if (!authLoading) {
      loadAdminProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const isAdmin =
    adminProfile?.status === "ACTIVE" &&
    ["ADMIN", "SUPER_ADMIN"].includes(adminProfile?.role);

  const isSuperAdmin = isAdmin && adminProfile?.role === "SUPER_ADMIN";

  const handleSync = async () => {
    if (!user || !isAdmin) return;

    try {
      setMessage("");
      setIsSyncing(true);

      const idToken = await user.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/ipos/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Failed to synchronize IPO data.");
      }

      setMessage(result.message || "IPO synchronization completed.");

      if (onSyncSuccess) {
        await onSyncSuccess();
      }
    } catch (error) {
      console.error("[IPO Sync]", error);
      setMessage(error.message || "Unable to sync IPO data.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAdminProfile(null);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("[Logout]", error);
      setMessage("Unable to sign out. Please try again.");
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 px-4 sm:px-6 py-4 backdrop-blur-xl bg-[#0b0f19]/75">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <a href="/" className="flex items-center">
            <img
              src="/logo-icon.svg"
              alt="ListingLogic"
              className="h-10 w-auto object-contain"
            />
          </a>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Listing<span className="text-emerald-400">Logic</span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              IPO Intelligence & Listing Gain Scoring
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {authLoading || profileLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <FiLoader className="animate-spin" />
              <span className="hidden sm:inline">Loading account...</span>
            </div>
          ) : !user ? (
            <Link
              to="/login"
              className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition"
            >
              Sign in
            </Link>
          ) : (
            <>
              {isAdmin ? (
                <>
                  <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-400/[0.07] border border-emerald-400/15 text-emerald-400 text-[10px] font-semibold">
                    <FiShield />
                    {isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
                  </span>

                  {isSuperAdmin && (
                    <Link
                      to="/admin/manage"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-400/[0.08] border border-violet-400/20 hover:bg-violet-400/[0.15] text-violet-300 text-xs font-semibold transition"
                    >
                      <FiUsers />
                      <span className="hidden sm:inline">Manage Admins</span>
                    </Link>
                  )}

                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <FiRefreshCw className={isSyncing ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">
                      {isSyncing ? "Syncing..." : "Sync Live Data"}
                    </span>
                  </button>
                </>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-400 text-[10px]">
                  <FiUser />
                  Signed in
                </span>
              )}

              <button
                onClick={handleLogout}
                title={`Sign out ${user.email || "of your account"}`}
                aria-label="Sign out"
                className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition"
              >
                <FiLogOut />
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto mt-3 text-xs text-slate-300">
          {message}
        </div>
      )}
    </nav>
  );
};
