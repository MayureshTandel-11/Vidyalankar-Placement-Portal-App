import { useEffect } from "react";
import { motion as Motion } from "framer-motion";
import { Loader2, X } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export const Spinner = ({ className = "" }) => (
  <Loader2 className={cn("h-5 w-5 animate-spin text-red-600", className)} aria-hidden="true" />
);

export const PrimaryButton = ({ children, className = "", loading = false, disabled = false, ...props }) => (
  <Motion.button
    whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
    {...props}
    disabled={disabled || loading}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white shadow-[0_14px_30px_-16px_rgba(220,38,38,0.9)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-[0_20px_38px_-18px_rgba(220,38,38,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
      className
    )}
  >
    {loading ? <Spinner className="h-4 w-4 text-white" /> : null}
    {children}
  </Motion.button>
);

export const SectionTitle = ({ title, subtitle, className = "" }) => (
  <div className={cn("space-y-1.5 xs:space-y-2", className)}>
    <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-red-700 via-red-600 to-red-500 bg-clip-text">
      {title}
    </h2>
    {subtitle ? <p className="text-xs xs:text-sm text-slate-600">{subtitle}</p> : null}
  </div>
);

export const StatusMessage = ({ type = "success", message, className = "" }) => {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-rose-200/90 bg-rose-50/85 text-rose-700"
      : "border-emerald-200/90 bg-emerald-50/85 text-emerald-700";

  return <p className={cn("rounded-xl xs:rounded-2xl border px-3 xs:px-4 py-2 xs:py-3 text-xs xs:text-sm backdrop-blur-sm", styles, className)}>{message}</p>;
};

export const EmptyState = ({ title, subtitle, className = "" }) => (
  <div className={cn("glass-panel flex min-h-40 xs:min-h-44 flex-col items-center justify-center px-3 xs:px-6 py-6 xs:py-8 text-center rounded-xl xs:rounded-2xl", className)}>
    <p className="text-base xs:text-lg font-semibold text-slate-800">{title}</p>
    {subtitle ? <p className="mt-2 max-w-md text-xs xs:text-sm text-slate-500">{subtitle}</p> : null}
  </div>
);

export const Modal = ({
  open,
  title,
  subtitle,
  onClose,
  children,
  className = "",
  contentClassName = "",
  closeLabel = "Close modal",
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-2.5 xs:p-3 sm:p-5 backdrop-blur-sm",
        className
      )}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="glass-panel flex h-[min(95vh,800px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200/80 bg-white/70 px-3 sm:px-5 py-3 sm:py-4 backdrop-blur-md gap-2">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-xs sm:text-sm text-slate-500 line-clamp-2">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-xl border border-slate-200/90 bg-white/80 p-1.5 xs:p-2 text-slate-600 transition hover:border-red-200 hover:text-red-600 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </header>
        <div className={cn("modal-scrollbar flex-1 overflow-y-auto p-3 xs:p-4 sm:p-5", contentClassName)}>{children}</div>
      </div>
    </div>
  );
};
