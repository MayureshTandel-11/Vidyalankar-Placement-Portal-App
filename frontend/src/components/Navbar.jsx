import Logo from "./Logo";

const Navbar = () => (
  <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 backdrop-blur-sm shadow-sm">
    <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Logo className="h-8 w-auto flex-shrink-0" />
        <span className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 truncate">
          Vidyalankar Placement Portal
        </span>
      </div>
      <div className="text-xs sm:text-sm text-slate-500 flex-shrink-0 whitespace-nowrap">
        Secure
      </div>
    </div>
  </nav>
);

export default Navbar;
