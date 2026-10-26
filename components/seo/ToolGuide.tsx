import Link from "next/link";
import { MAX_FILE_SIZE_BYTES, MAX_MERGE_FILES, formatBytes } from "@/lib/constants";
import type { Platform } from "@/lib/pdf/platform-defaults";

type Tool = Platform | "home" | "merge" | "advanced";
type Guide = {
  title: string;
  intro: string;
  steps: string[];
  question: string;
  answer: string;
};

const guides: Record<Tool, Guide> = {
  home: {
    title: "Prepare shipping label PDFs for printing",
    intro: "Choose a tool for the layout in your seller PDF. Amazon and Flipkart have dedicated workflows; Meesho lets you keep the invoice or crop the label. Use manual cropping for other layouts, or combine labels from several marketplaces with Advanced Cropping.",
    steps: [
      "Choose your marketplace and select a PDF from your device.",
      "Choose whether to keep invoices where available, or adjust the crop area in the manual editor.",
      "Download the result as a PDF. Check that the barcode and delivery address are complete before printing.",
    ],
    question: "Which tool should I choose for several PDF files?",
    answer: "Use Merge PDFs if your files are already ready to print. Use Advanced Cropping if you need to crop labels from different marketplaces before combining them into one document.",
  },
  amazon: {
    title: "How to crop Amazon shipping labels from a PDF",
    intro: "This Amazon label tool is designed for PDFs with shipping labels on odd-numbered pages and invoices on even-numbered pages. It extracts the label pages unchanged, or keeps both labels and invoices. To trim whitespace within a label page, use manual cropping.",
    steps: [
      "Select your Amazon shipping label PDF from your device.",
      "Choose labels only to remove the alternating invoice pages, or keep labels and invoices.",
      "Process the PDF and download the result. Check the output against your original before printing.",
    ],
    question: "What if my Amazon PDF has a different page layout?",
    answer: "The automatic workflow assumes alternating label and invoice pages. If your file uses another layout, use the manual PDF crop tool to select the area yourself and check every output page.",
  },
  flipkart: {
    title: "How to crop Flipkart shipping labels from a PDF",
    intro: "The Flipkart label crop tool looks for the separator between the shipping label at the top and the tax invoice below it. When the separator is detected, the tool crops the page to keep the label for printing.",
    steps: [
      "Select a Flipkart PDF containing shipping labels and tax invoices.",
      "Let the tool inspect each page and crop at the detected separator.",
      "Review any pages reported as undetected, then download and check your label PDF before printing.",
    ],
    question: "What happens if the separator cannot be detected?",
    answer: "Some layouts or scanned PDFs may not contain a detectable separator. Check the reported pages and use manual cropping when the automatic result does not match your label area.",
  },
  meesho: {
    title: "How to crop Meesho shipping labels or keep invoices",
    intro: "The Meesho PDF tool gives you a choice between keeping the original PDF with its invoice and removing the invoice by manually cropping the shipping label. Keeping the invoice is selected by default.",
    steps: [
      "Select your Meesho shipping label PDF.",
      "Keep the invoice to download the original, or choose Remove invoice to open the crop editor.",
      "If cropping, adjust the selection around the label and download the PDF. Check that no barcode or address has been cut off.",
    ],
    question: "Does Meesho cropping automatically find every label?",
    answer: "This workflow uses a manual crop selection when removing the invoice. Check that the selected area fits the pages in your file; different page layouts may need to be processed separately.",
  },
  manual: {
    title: "How to crop a shipping label PDF manually",
    intro: "Use manual PDF cropping when your marketplace is not listed or your label layout differs from the automatic tools. Select the part of the page you want to keep in the crop editor.",
    steps: [
      "Select the PDF and open its preview in the crop editor.",
      "Draw or adjust the crop box around the shipping label, keeping the full barcode and address inside it.",
      "Apply the crop and download the PDF. Review all pages because the same crop selection is applied throughout the file.",
    ],
    question: "Can I use one selection for PDFs with different page layouts?",
    answer: "A single crop area may cut off information on pages whose labels are in different positions. Split differently arranged labels into separate files and crop each layout before merging the results.",
  },
  merge: {
    title: "How to merge label, invoice and manifest PDFs",
    intro: `Combine up to ${MAX_MERGE_FILES} PDF files into one document. The merger keeps the pages from each file and lets you arrange the files before downloading, which is useful for collecting shipping labels or invoices into a single print job.`,
    steps: [
      "Select the PDF files you want to combine.",
      "Drag the files into the order you want in the final document.",
      "Merge and download the combined PDF, then check its page order before printing.",
    ],
    question: "Does merging also crop my labels?",
    answer: "The merger combines existing PDF pages. To remove invoice areas first, use a marketplace crop tool or Advanced Cropping, then merge the prepared files.",
  },
  advanced: {
    title: "How to crop and merge labels from several marketplaces",
    intro: "Prepare Amazon, Flipkart, Meesho and custom label PDFs in one workflow. Review the marketplace selection for each file, choose its invoice settings or crop area, and arrange the processed files into one PDF.",
    steps: [
      "Select your PDFs and check the marketplace assigned to each file.",
      "Review invoice settings and any manual crop selections, then process the files.",
      "Arrange the processed files in the merge workspace and download a combined PDF for printing.",
    ],
    question: "What if a file is assigned the wrong marketplace?",
    answer: "Change its marketplace before processing and review its settings again. Use the custom crop option when the file does not match a supported layout.",
  },
};

const tools: { tool: Tool; href: string; label: string }[] = [
  { tool: "amazon", href: "/crop/amazon", label: "Amazon label crop" },
  { tool: "flipkart", href: "/crop/flipkart", label: "Flipkart label crop" },
  { tool: "meesho", href: "/crop/meesho", label: "Meesho label crop" },
  { tool: "manual", href: "/crop/manual", label: "Manual PDF crop" },
  { tool: "advanced", href: "/advanced", label: "Crop and merge labels" },
  { tool: "merge", href: "/merge", label: "Merge PDFs" },
];

// Server-rendered guidance stays available before the interactive PDF tools load.
export default function ToolGuide({ tool }: { tool: Tool }) {
  const guide = guides[tool];
  return (
    <section aria-labelledby="tool-guide-title" className="mx-auto mt-12 max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
      <div>
        <h2 id="tool-guide-title" className="text-xl font-bold text-slate-900">{guide.title}</h2>
        <p className="mt-3">{guide.intro}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          {guide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{guide.question}</h3>
        <p className="mt-2">{guide.answer}</p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">File limits and privacy</h3>
        <p className="mt-2">Each PDF can be up to {formatBytes(MAX_FILE_SIZE_BYTES)}. Files are processed locally in your browser without being uploaded. Password-protected or damaged PDFs may need to be unlocked or exported again before they can be opened.</p>
      </div>
      <nav aria-label="Related PDF tools" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-5">
        {tools.filter((item) => item.tool !== tool).map((item) => (
          <Link key={item.href} href={item.href} className="font-medium text-accent-700 hover:underline">{item.label}</Link>
        ))}
      </nav>
    </section>
  );
}
