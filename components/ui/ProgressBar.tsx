import { Spinner } from "./primitives";

export default function ProgressBar({ label, value, detail }: {
  label: string;
  /** Omit when the work cannot be measured, such as single-PDF parsing. */
  value?: number;
  detail?: string;
}) {
  const percent = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return <div className="min-w-0 flex-1">
    <div className="mb-2 flex items-start gap-2.5 text-sm font-medium text-slate-600">
      <Spinner /><span className="min-w-0 break-all">{label}</span>
    </div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={percent} aria-valuetext={detail}
      className="h-2 overflow-hidden rounded-full bg-accent-100">
      <div className={percent === undefined
        ? "h-full w-1/3 animate-progress rounded-full bg-accent-600 motion-reduce:animate-none motion-reduce:translate-x-full"
        : "h-full rounded-full bg-accent-600 transition-[width] duration-200 motion-reduce:transition-none"}
        style={percent === undefined ? undefined : { width: `${percent}%` }} />
    </div>
    {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
  </div>;
}
