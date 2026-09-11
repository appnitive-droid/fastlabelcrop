import { PDFDocument } from "pdf-lib";

/** Merge source PDFs (in order) into a single document. Pages are copied, never rasterized. */
export async function mergePdfs(inputs: Uint8Array[]): Promise<Uint8Array> {
  if (inputs.length < 2) {
    throw new Error("Select at least 2 PDFs to merge.");
  }
  const out = await PDFDocument.create();
  for (let i = 0; i < inputs.length; i++) {
    let src: Awaited<ReturnType<typeof PDFDocument.load>>;
    try {
      src = await PDFDocument.load(inputs[i], { ignoreEncryption: true });
    } catch {
      throw new Error(
        `File #${i + 1} could not be opened. It may be corrupted or password-protected.`
      );
    }
    try {
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      throw new Error(`Could not copy pages from file #${i + 1}.`);
    }
  }
  try {
    return await out.save();
  } catch {
    throw new Error("Could not generate the merged PDF. Please retry.");
  }
}

export async function getPageCount(data: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(data, { ignoreEncryption: true });
  return doc.getPageCount();
}
