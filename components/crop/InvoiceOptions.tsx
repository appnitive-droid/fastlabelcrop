"use client";

export default function InvoiceOptions({ name, keepInvoices, onChange, disabled = false }: {
  name: string;
  keepInvoices: boolean;
  onChange: (keep: boolean) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="flex flex-wrap gap-4">
    <legend className="label-xs mb-2">Invoice</legend>
    {[true, false].map((keep) => <label key={String(keep)} className="flex items-center gap-2 text-sm">
      <input type="radio" name={name} checked={keepInvoices === keep} onChange={() => onChange(keep)} />
      {keep ? "Keep invoice" : "Remove invoice"}
    </label>)}
  </fieldset>;
}
