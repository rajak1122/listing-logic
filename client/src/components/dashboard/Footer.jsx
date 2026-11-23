const Footer = () => {
  return (
    <footer className="mt-auto border-t border-white/10 bg-darkbg w-full">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">
            Listing<span className="text-emerald-400">Logic</span>
          </p>

          <p className="text-xs text-slate-500 mt-1">
            IPO Intelligence & Listing Gain Scoring
          </p>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} ListingLogic. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
