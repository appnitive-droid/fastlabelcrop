import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>{children}</div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-accent-200 border-t-accent-600" />
      {label && <span className="text-sm font-medium text-slate-600">{label}</span>}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg shadow-card">
        📄
      </div>
      <p className="text-[15px] font-semibold text-slate-800">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "error",
  title,
  message,
  onRetry,
}: {
  tone?: "error" | "info" | "warn";
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const tones = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-accent-200 bg-accent-50 text-accent-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  } as const;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}
    >
      <span className="mt-0.5 font-bold">{tone === "error" ? "!" : "i"}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 opacity-90">{message}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-[13px] font-semibold shadow-sm hover:bg-white"
        >
          Retry
        </button>
      )}
    </div>
  );
}
