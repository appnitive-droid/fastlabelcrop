"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader({
  title,
  subtitle,
  logoSrc,
  logoAlt,
}: {
  title?: string;
  subtitle?: string;
  logoSrc?: string | null;
  logoAlt?: string;
}) {
  const pathname = usePathname();
  const link = (href: string, label: string) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-[15px] font-extrabold text-white shadow-sm">
            ✂
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">Fastlabelcrop</span>
            <span className="block text-[11px] font-medium text-slate-500">
              100% in-browser PDF tools
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {link("/merge", "Merge PDFs")}
        </nav>
      </div>
      {(title || subtitle) && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <div className="container-x flex items-center gap-3.5 py-5">
            {logoSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={logoAlt || "logo"}
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-card"
              />
            )}
            <div className="min-w-0">
              {title && (
                <h1 className="animate-fadeUp text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {title}
                </h1>
              )}
              {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-x flex flex-col items-center justify-between gap-3 py-8 text-center sm:flex-row sm:text-left">
        <p className="text-[13px] text-slate-500">
          <span className="font-semibold text-slate-700">Fastlabelcrop</span> — your files are
          processed locally in your browser and never uploaded.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Private by design · No server uploads
        </p>
      </div>
    </footer>
  );
}
