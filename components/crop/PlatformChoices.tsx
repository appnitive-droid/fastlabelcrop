"use client";

import { platformLogo, type Platform } from "@/lib/pdf/platform-defaults";

const choices: { value: Platform; label: string }[] = [
  { value: "flipkart", label: "Flipkart" },
  { value: "amazon", label: "Amazon" },
  { value: "meesho", label: "Meesho" },
  { value: "manual", label: "Other" },
];

export default function PlatformChoices({ name, value, onChange, disabled }: {
  name: string;
  value: Platform | "";
  onChange: (platform: Platform) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="w-full min-w-0 max-w-lg">
    <legend className="label-xs mb-2">Marketplace</legend>
    <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
      {choices.map((choice) => <label key={choice.value}
        className={`relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-1 py-2 transition-colors focus-within:ring-2 focus-within:ring-accent-400 ${value === choice.value ? "border-accent-600 bg-accent-50" : "border-slate-200 bg-white hover:border-slate-300"} ${disabled ? "cursor-default opacity-60" : ""}`}>
        <input type="radio" name={name} value={choice.value} checked={value === choice.value}
          onChange={() => onChange(choice.value)} className="peer sr-only" />
        <span aria-hidden="true" className={`absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] font-bold ${value === choice.value ? "border-accent-600 bg-accent-600 text-white" : "border-slate-300 bg-white"}`}>{value === choice.value ? "✓" : ""}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={platformLogo(choice.value) || "/other.svg"} alt="" className="h-6 w-6 rounded-md bg-white object-contain p-0.5 sm:h-8 sm:w-8" />
        <span className="text-[11px] font-semibold leading-4 text-slate-800 sm:text-xs">{choice.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
