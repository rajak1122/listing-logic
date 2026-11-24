import { Link } from "react-router-dom";
import {
  FiActivity,
  FiArrowRight,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiDatabase,
  FiLayers,
  FiShield,
  FiTrendingUp,
  FiPieChart,
  FiLock,
} from "react-icons/fi";

const featureCards = [
  {
    icon: FiLayers,
    title: "IPO overview",
    description:
      "Explore upcoming, live, closed and listed IPOs in one organised research workspace.",
    tag: "Track the lifecycle",
  },
  {
    icon: FiActivity,
    title: "Demand intelligence",
    description:
      "Review available GMP references and QIB, NII and retail subscription activity to understand market demand.",
    tag: "Understand momentum",
  },
  {
    icon: FiBarChart2,
    title: "Company quality",
    description:
      "View available financial metrics and historical financial information separately from listing-demand analysis.",
    tag: "Add financial context",
  },
  {
    icon: FiTrendingUp,
    title: "Listing outcomes",
    description:
      "Compare available listing information with earlier analysis and observe how IPO outcomes developed.",
    tag: "Learn from outcomes",
  },
];

const workflow = [
  {
    number: "01",
    title: "Explore IPO data",
    description:
      "Start with IPO details, issue structure, dates and the information available from tracked sources.",
  },
  {
    number: "02",
    title: "Review demand signals",
    description:
      "Understand subscription categories and GMP references where reliable data is available.",
  },
  {
    number: "03",
    title: "Consider company context",
    description:
      "Review financial information separately, so demand indicators and company fundamentals are not confused.",
  },
  {
    number: "04",
    title: "Observe listing outcomes",
    description:
      "Where actual listing information is available, compare it with the earlier research view.",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-darkbg text-slate-100 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute -top-52 -left-40 w-[620px] h-[620px] rounded-full bg-emerald-500/[0.09] blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] -right-56 w-[620px] h-[620px] rounded-full bg-cyan-500/[0.07] blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-20 border-b border-white/[0.07] bg-[#0b0f19]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glowGreen">
              <FiTrendingUp className="text-xl" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-wide text-white">
                Listing<span className="text-emerald-400">Logic</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                IPO intelligence
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs text-slate-400">
            <a href="#platform" className="hover:text-white transition">Platform</a>
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#about" className="hover:text-white transition">About</a>
            <a href="#disclaimer" className="hover:text-white transition">Risk disclaimer</a>
          </nav>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/15 hover:border-emerald-400/50 text-xs font-semibold transition"
          >
            Sign in
            <FiArrowUpRight />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-5 sm:px-7 pt-16 sm:pt-24 pb-20">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/[0.07] border border-emerald-400/20 text-emerald-300 text-[10px] font-semibold tracking-[0.14em] uppercase mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Independent IPO research workspace
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] leading-[1.08] font-bold tracking-tight text-white max-w-3xl">
                Understand IPO demand.
                <span className="block mt-2 bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                  Study the listing landscape.
                </span>
              </h1>

              <p className="mt-7 text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
                ListingLogic brings IPO details, subscription activity, GMP
                references, company financial context and listing outcomes
                together in one research workspace.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-[#07120f] text-sm font-bold shadow-lg shadow-emerald-950/30 hover:brightness-110 transition"
                >
                  Continue with Google
                  <FiArrowRight />
                </Link>

                <a
                  href="#platform"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 text-sm font-semibold hover:bg-white/[0.07] transition"
                >
                  Explore the platform
                  <FiArrowUpRight />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-7 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <FiLock className="text-emerald-400" />
                  Google authentication
                </span>
                <span className="inline-flex items-center gap-2">
                  <FiShield className="text-emerald-400" />
                  Admin access managed separately
                </span>
              </div>
            </div>

            {/* Product preview: illustrative UI, not live market values */}
            <div className="relative">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 blur-2xl" />
              <div className="glass-card relative p-5 sm:p-6 shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between gap-3 pb-5 border-b border-white/[0.08]">
                  <div>
                    <p className="text-sm font-semibold text-white">IPO research workspace</p>
                    <p className="text-[10px] text-slate-500 mt-1">A unified view of available information</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-[9px] text-cyan-300 font-semibold">
                    PRODUCT PREVIEW
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-xl bg-white/[0.035] border border-white/[0.07] p-4">
                    <FiDatabase className="text-emerald-400 text-lg mb-3" />
                    <p className="text-xs text-slate-300 font-semibold">IPO information</p>
                    <p className="text-[10px] text-slate-500 mt-1">Dates · Issue details</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] border border-white/[0.07] p-4">
                    <FiActivity className="text-cyan-300 text-lg mb-3" />
                    <p className="text-xs text-slate-300 font-semibold">Demand indicators</p>
                    <p className="text-[10px] text-slate-500 mt-1">GMP · Subscription</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] border border-white/[0.07] p-4">
                    <FiPieChart className="text-violet-300 text-lg mb-3" />
                    <p className="text-xs text-slate-300 font-semibold">Company context</p>
                    <p className="text-[10px] text-slate-500 mt-1">Financials · History</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] border border-white/[0.07] p-4">
                    <FiTrendingUp className="text-amber-300 text-lg mb-3" />
                    <p className="text-xs text-slate-300 font-semibold">Listing outcomes</p>
                    <p className="text-[10px] text-slate-500 mt-1">Actuals · Comparisons</p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-gradient-to-r from-emerald-400/[0.08] to-cyan-400/[0.06] border border-emerald-400/15 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                    <FiCheckCircle />
                    Separate the signals
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400 mt-2">
                    Listing-demand analysis and company financial quality are
                    presented as distinct research perspectives.
                  </p>
                </div>

                <p className="text-[9px] text-slate-600 mt-4 text-center">
                  Illustrative interface preview · Not live market data
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Platform features */}
        <section id="platform" className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-5 sm:px-7 py-20">
            <div className="max-w-2xl mb-10">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold">
                One research workspace
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                The IPO picture, organised.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mt-3">
                Move from issue details to demand signals, company context and
                observed listing outcomes without treating any single metric
                as the complete story.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="glass-card p-5 sm:p-6 hover:border-emerald-400/25 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/15 flex items-center justify-center text-emerald-300">
                      <Icon className="text-xl" />
                    </div>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-400/80 font-semibold mt-5">
                      {feature.tag}
                    </p>
                    <h3 className="text-base font-semibold text-white mt-2">
                      {feature.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-400 mt-3">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-5 sm:px-7 py-20">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-semibold">
                Research flow
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                From IPO data to a clearer view.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mt-4">
                ListingLogic organises available information and displays
                analytical perspectives. It does not remove uncertainty from
                IPO investing.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 mt-7 text-sm text-emerald-300 hover:text-emerald-200 font-semibold transition"
              >
                Explore ListingLogic
                <FiArrowRight />
              </Link>
            </div>

            <div className="space-y-3">
              {workflow.map((step) => (
                <div
                  key={step.number}
                  className="glass-card p-5 flex gap-4 sm:gap-5"
                >
                  <div className="text-sm font-bold text-emerald-400/80 tabular-nums pt-0.5">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Methodology / data note */}
        <section className="max-w-7xl mx-auto px-5 sm:px-7 pb-20">
          <div className="glass-card p-6 sm:p-8 grid md:grid-cols-[auto_1fr] gap-5 items-start">
            <div className="w-12 h-12 rounded-xl bg-cyan-400/[0.08] border border-cyan-400/20 flex items-center justify-center text-cyan-300">
              <FiBarChart2 className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Analysis is a perspective, not a promise.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mt-2">
                Demand indicators, GMP references and subscription information
                depend on source availability and update timing. Company
                financial information is shown as supporting context and is
                kept distinct from listing-demand analysis. Scores and
                classifications reflect the platform's methodology; they are
                not calibrated probabilities or guarantees of returns.
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-5 sm:px-7 py-20">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold">
                About the project
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                Built from curiosity about markets and technology.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed mt-5">
                ListingLogic is an independent project built by a computer
                science student with an interest in financial markets, data
                analysis and technology. The goal is to bring scattered IPO
                information into a structured workspace and make the research
                process easier to examine.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed mt-3">
                It is a technology and learning project, not a substitute for
                independently verifying information or seeking qualified financial guidance.
              </p>
            </div>
          </div>
        </section>

        {/* Risk disclaimer */}
        <section id="disclaimer" className="max-w-7xl mx-auto px-5 sm:px-7 py-16">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.045] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-amber-300">
              <FiShield className="text-lg" />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em]">
                Important investment risk warning
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-4">
              Investments in securities, including IPOs, are subject to market
              risks. ListingLogic provides information, analytical scores and
              opinions for educational and informational purposes only. These
              views are the platform's own analytical perspective and do not
              constitute investment advice, a recommendation to apply for or
              avoid an IPO, or a promise of listing gains or returns. Data may
              be delayed, incomplete or subject to change. Always verify
              information independently, read the relevant offer documents
              and make investment decisions at your own discretion and risk.
            </p>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="max-w-7xl mx-auto px-5 sm:px-7 pb-20">
          <div className="glass-card p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-cyan-500/[0.06] pointer-events-none" />
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold">
                Start exploring
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                Bring your IPO research into focus.
              </h2>
              <p className="text-sm text-slate-400 mt-3 max-w-xl mx-auto">
                Sign in with your Google account to open the ListingLogic
                research workspace.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 mt-7 px-6 py-3 rounded-xl bg-emerald-400 text-[#07120f] text-sm font-bold hover:brightness-110 transition"
              >
                Continue with Google
                <FiArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.07] bg-[#0b0f19]/70">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white">
              Listing<span className="text-emerald-400">Logic</span>
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              Independent IPO research and technology project
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-slate-500">
            <a href="#platform" className="hover:text-slate-300 transition">Platform</a>
            <a href="#about" className="hover:text-slate-300 transition">About</a>
            <a href="#disclaimer" className="hover:text-slate-300 transition">Risk disclaimer</a>
            <Link to="/login" className="hover:text-slate-300 transition">Sign in</Link>
          </div>
          <p className="text-[10px] text-slate-600">
            © 2026 ListingLogic
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
