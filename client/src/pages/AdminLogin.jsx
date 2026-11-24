import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiLock,
  FiShield,
  FiLoader,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.98 6.19c4.65-4.29 6.82-10.61 6.82-17.84Z"
    />
    <path
      fill="#FBBC05"
      d="M10.54 28.59A14.4 14.4 0 0 1 9.77 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.98-6.19Z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.9-5.61l-7.98-6.19c-2.21 1.49-5.03 2.37-7.92 2.37-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
    />
  </svg>
);

const getLoginErrorMessage = (error) => {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "The Google sign-in window was closed before sign-in completed.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups and try again.";
    case "auth/cancelled-popup-request":
      return "A sign-in request is already in progress. Please try again.";
    case "auth/network-request-failed":
      return "A network error interrupted sign-in. Check your connection and retry.";
    default:
      return error?.message || "Google sign-in failed. Please try again.";
  }
};

const AdminLogin = () => {
  const { user, loading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Existing authenticated users should not remain on the login page.
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  const handleLogin = async () => {
    try {
      setError("");
      setIsLoggingIn(true);

      await loginWithGoogle();

      // Every Google-authenticated user enters the same public IPO workspace.
      // Admin permissions are checked independently by protected backend APIs.
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[Google Sign-in]", {
        code: err.code,
        message: err.message,
      });

      setError(getLoginErrorMessage(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen bg-darkbg flex items-center justify-center px-5">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl border border-emerald-400/30 border-t-emerald-400 animate-spin" />
          <p className="text-sm text-slate-400">
            {user ? "Opening your workspace..." : "Initializing secure sign-in..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkbg text-slate-100 flex items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.025] pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-300 transition"
          >
            <FiArrowLeft />
            Back to ListingLogic
          </Link>
        </div>

        <div className="glass-card p-8 sm:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/10 border border-emerald-400/30 flex items-center justify-center shadow-glowGreen">
                <FiShield className="text-3xl text-emerald-400" />
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Listing<span className="text-emerald-400">Logic</span>
            </h1>

            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 mt-2">
              IPO Intelligence Platform
            </p>
          </div>

          <div className="text-center mb-7">
            <h2 className="text-xl font-semibold text-white">
              Welcome to your research workspace
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Sign in with Google to explore IPO information, demand indicators
              and listing analysis.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-400/[0.08] border border-red-400/20 p-3.5 text-xs leading-relaxed text-red-300"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="group relative w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border border-emerald-400/30 hover:border-emerald-400/60 hover:from-emerald-500/20 hover:to-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center">
                {isLoggingIn ? <FiLoader className="animate-spin text-emerald-300" /> : <GoogleMark />}
              </div>
              <span className="text-sm font-semibold text-slate-100">
                {isLoggingIn ? "Connecting..." : "Continue with Google"}
              </span>
            </div>

            <FiArrowRight className="text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </button>

          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[10px] uppercase tracking-widest text-slate-600">
              Secure authentication
            </span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <FiLock className="text-emerald-400/70" />
            Authentication powered by Firebase
          </div>

          <p className="text-[11px] text-center text-slate-600 leading-relaxed mt-5">
            Google sign-in is available to all users. Administrative
            permissions are granted separately and are not required to explore
            the platform.
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          ListingLogic © 2026 · Independent IPO research project
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
