import Link from "next/link";

export function Hero() {
  return (
    <section className="animate-fadeUp pt-8 text-center sm:pt-10">
      <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
        Crop Shipping Labels &amp; Merge PDFs Online
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-500">
        Free online tool for e-commerce sellers to crop Flipkart, Amazon and
        Meesho shipping labels from PDFs and merge PDFs — fast, private and
        100% in-browser. No uploads, no sign-up.
      </p>
    </section>
  );
}

const PLATFORMS = [
  {
    slug: "amazon",
    name: "Amazon",
    logo: "/amazon.png",
    desc: "Get print-ready shipping labels instantly.",
    cta: "Crop Amazon Label",
  },
  {
    slug: "flipkart",
    name: "Flipkart",
    logo: "/flipkart.png",
    desc: "Get print-ready shipping labels instantly.",
    cta: "Crop Flipkart Label",
  },
  {
    slug: "meesho",
    name: "Meesho",
    logo: "/meesho.png",
    desc: "Get print-ready shipping labels instantly.",
    cta: "Crop Meesho Label",
  },
  {
    slug: "manual",
    name: "Other",
    tag: "✂",
    tagCls: "bg-slate-200 text-slate-700",
    desc: "Any other marketplace or PDF — draw the crop box yourself, fully manual.",
    cta: "Crop Custom PDF",
  },
];

export function PlatformCards() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLATFORMS.map((p, i) => (
        <div
          key={p.slug}
          className="card animate-fadeUp flex flex-col p-6 transition-shadow hover:shadow-pop"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {"logo" in p && p.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.logo}
              alt={`${p.name} logo`}
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain p-1"
            />
          ) : (
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold ${"tagCls" in p ? p.tagCls : ""}`}
            >
              {"tag" in p ? p.tag : ""}
            </span>
          )}
          <h3 className="mt-4 text-[16px] font-bold tracking-tight text-slate-900">{p.name}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">{p.desc}</p>
          <Link
            href={`/crop/${p.slug}`}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-[0.99]"
          >
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function MergePromoCard() {
  return (
    <div className="card animate-fadeUp relative mt-4 overflow-hidden border-slate-900/10 bg-slate-900 p-6 text-white sm:p-8">
      <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/90">
            ⧉ &nbsp;Bulk friendly · up to 20 PDFs
          </p>
          <h3 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
            Merge multiple PDFs into one document
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/70">
            Drop in invoices, labels, or manifests — reorder with drag &amp; drop
            and export a single print-ready file. Everything stays on your device.
          </p>
        </div>
        <Link
          href="/merge"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-white px-6 text-[15px] font-bold text-slate-900 shadow transition hover:bg-slate-100 active:scale-[0.99]"
        >
          Merge PDFs →
        </Link>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/[0.06]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-white/[0.04]"
      />
    </div>
  );
}

export function TrustRow() {
  const items = [
    ["🔒", "Private by design", "No uploads, no servers — files stay with you."],
    ["⚡", "Instant & vector-sharp", "Real PDF ops via pdf-lib. No rasterizing."],
    ["🖨", "Print-ready output", "Cropped labels & merged docs download as PDF."],
  ] as const;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {items.map(([icon, t, d]) => (
        <div key={t} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[16px]">
            {icon}
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">{t}</span>
            <span className="block text-[13px] text-slate-500">{d}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
