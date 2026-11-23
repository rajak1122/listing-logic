import React from "react";

export const SignalBadge = ({ badge }) => {
  const normalizedBadge = typeof badge === "string" ? badge.toUpperCase() : "";

  const getBadgeConfig = () => {
    switch (normalizedBadge) {
      case "STRONG LISTING SETUP":
      case "SUPER TIER":
      case "MUST APPLY":
        return {
          styles:
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
          dotColor: "bg-emerald-400 animate-pulse",
          label: badge,
        };

      case "MODERATE LISTING SETUP":
      case "GOOD FOR LISTING POP":
      case "APPLY (LISTING ONLY)":
      case "MODERATE APPLY":
        return {
          styles:
            "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]",
          dotColor: "bg-cyan-400",
          label: badge,
        };

      case "NEUTRAL LISTING SETUP":
      case "GOOD FOR LONG TERM":
      case "HOLD / LONG TERM":
        return {
          styles:
            "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
          dotColor: "bg-amber-400",
          label: badge,
        };

      case "LOW LISTING CONFIDENCE":
      case "CAUTION":
      case "WEAK ISSUE":
      case "AVOID":
        return {
          styles:
            "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
          dotColor: "bg-rose-400",
          label: badge,
        };

      case "INSUFFICIENT DATA":
        return {
          styles: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          dotColor: "bg-slate-400",
          label: badge,
        };

      default:
        // Protect the UI if the scoring engine returns a new or missing badge value.
        return {
          styles: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          dotColor: "bg-slate-400",
          label:
            typeof badge === "string" && badge.trim()
              ? badge
              : "UNKNOWN SIGNAL",
        };
    }
  };

  const { styles, dotColor, label } = getBadgeConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border backdrop-blur-md transition-all duration-300 ${styles}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
};

export default SignalBadge;
