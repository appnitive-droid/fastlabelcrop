const fs = require("node:fs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
// Exercise the real TypeScript modules without adding a test runtime dependency.
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename
);
const { PDFDocument, degrees, rgb } = require("pdf-lib");
const { cropPdf, cropPdfPerPage } = require("../lib/pdf/crop.ts");
const { mergePdfs } = require("../lib/pdf/merge.ts");
const { OperationGate } = require("../lib/operation.ts");
const { processAdvancedItem, keepOriginal, canProcess, needsCropReview, changeAdvancedSettings } = require("../lib/pdf/advanced.ts");
const { defaultKeepInvoices } = require("../lib/pdf/platform-defaults.ts");
const { platformFromText, detectPdfPlatform } = require("../lib/pdf/detect-platform.ts");

async function sourcePdf(sizes = [[600, 800]]) {
  const doc = await PDFDocument.create();
  sizes.forEach((size, i) => {
    const page = doc.addPage(size);
    page.drawText(`PAGE ${i + 1}`, { x: 120, y: size[1] - 140, size: 24, color: rgb(0, 0, 0) });
  });
  return doc;
}

function closeBox(actual, expected) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 0.00001, `${key}: ${actual[key]} !== ${expected[key]}`);
  }
}

test("crop follows displayed coordinates at every right-angle rotation", async () => {
  const expected = [
    { x: 60, y: 320, width: 180, height: 320 },
    { x: 120, y: 80, width: 240, height: 240 },
    { x: 360, y: 160, width: 180, height: 320 },
    { x: 240, y: 480, width: 240, height: 240 },
  ];
  for (let i = 0; i < 4; i++) {
    const doc = await sourcePdf();
    doc.getPage(0).setRotation(degrees(i * 90));
    const originalContents = doc.getPage(0).node.Contents().toString();
    const out = await PDFDocument.load(await cropPdf(await doc.save(), { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }));
    closeBox(out.getPage(0).getCropBox(), expected[i]);
    assert.equal(out.getPage(0).getRotation().angle, i * 90);
    assert.equal(out.getPage(0).node.Contents().toString(), originalContents, "vector content stream remains in place");
  }
});

test("visible box intersection, nonzero origins, and mixed page sizes", async () => {
  const doc = await sourcePdf([[600, 800], [300, 500], [600, 800]]);
  doc.getPage(0).setCropBox(100, 100, 400, 600);
  doc.getPage(1).setMediaBox(-50, 30, 300, 500);
  doc.getPage(2).setCropBox(-100, 200, 800, 800);
  const bytes = await doc.save();
  const result = await PDFDocument.load(await cropPdf(bytes, { x: 0, y: 0, width: 1, height: 0.5 }));
  closeBox(result.getPage(0).getCropBox(), { x: 100, y: 400, width: 400, height: 300 });
  closeBox(result.getPage(1).getCropBox(), { x: -50, y: 280, width: 300, height: 250 });
  closeBox(result.getPage(2).getCropBox(), { x: 0, y: 500, width: 600, height: 300 });
  const perPage = await PDFDocument.load(await cropPdfPerPage(bytes, [null, { x: 0, y: 0, width: 1, height: 0.5 }, null]));
  closeBox(perPage.getPage(0).getCropBox(), doc.getPage(0).getCropBox());
  closeBox(perPage.getPage(2).getCropBox(), doc.getPage(2).getCropBox());
  await assert.rejects(cropPdf(bytes, { x: 1, y: 0, width: 0, height: 1 }), /too small/);
});

function item(data, platform, patch = {}) {
  return { id: platform, file: { name: `${platform}.pdf` }, data, platform,
    keepInvoices: false, rect: null, reviewed: false, manualOverride: false,
    readable: true, pageCount: 4, status: "pending", output: null, ...patch };
}

test("mixed marketplace processing preserves Amazon options and file/page order", async () => {
  const bytes = await (await sourcePdf([[600, 800], [601, 800], [602, 800], [603, 800]])).save();
  const amazon = await processAdvancedItem(item(bytes, "amazon"));
  assert.equal(amazon.outputPages, 2);
  const labels = await PDFDocument.load(amazon.output);
  assert.deepEqual(labels.getPages().map((p) => p.getWidth()), [600, 602]);
  const all = await processAdvancedItem(item(bytes, "amazon", { keepInvoices: true }));
  assert.equal(all.output, bytes);
  assert.equal(all.outputPages, 4);
  for (const platform of ["meesho", "manual"]) {
    const pending = item(bytes, platform);
    assert.equal(canProcess(pending), false);
    await assert.rejects(processAdvancedItem(pending), /review the crop/);
    const cropped = await processAdvancedItem({ ...pending, reviewed: true, rect: { x: 0, y: 0, width: 1, height: 0.5 } });
    const doc = await PDFDocument.load(cropped.output);
    assert.equal(doc.getPage(0).getHeight(), 400);
    assert.equal(doc.getPageCount(), 4);
  }
  const reordered = await PDFDocument.load(await mergePdfs([all.output, amazon.output]));
  assert.deepEqual(reordered.getPages().map((p) => p.getWidth()), [600, 601, 602, 603, 600, 602]);
  assert.equal(keepOriginal(amazon).output, bytes);
  assert.throws(() => keepOriginal({ ...amazon, readable: false }), /readable/);
});

test("Flipkart unresolved pages require a decision and retain their reports", async () => {
  // Stub only browser analysis; exercise the actual advanced-flow decision logic.
  const flipkart = require("../lib/pdf/flipkart.ts");
  const original = flipkart.cropFlipkartLabels;
  const bytes = await (await sourcePdf()).save();
  try {
    flipkart.cropFlipkartLabels = async () => ({ pdf: bytes, pages: [{ pageNumber: 1, detected: false, reason: "no-separator" }], detectedCount: 0, totalPages: 1 });
    const result = await processAdvancedItem(item(bytes, "flipkart", { pageCount: 1 }));
    assert.equal(result.status, "attention");
    assert.equal(result.report[0].reason, "no-separator");
    assert.equal(keepOriginal(result).status, "ready");
    const manual = await processAdvancedItem({ ...result, manualOverride: true, reviewed: true, rect: { x: 0, y: 0, width: 1, height: 0.5 } });
    assert.equal(manual.status, "ready");
    assert.equal((await PDFDocument.load(manual.output)).getPage(0).getHeight(), 400);
    flipkart.cropFlipkartLabels = async () => { throw new Error("Analysis failed"); };
    await assert.rejects(processAdvancedItem(item(bytes, "flipkart")), /Analysis failed/);
  } finally { flipkart.cropFlipkartLabels = original; }
});

test("reset and unmount invalidate pending uploads/merges without disturbing a newer operation", async () => {
  const gate = new OperationGate();
  const old = gate.begin();
  assert.equal(gate.begin(), null, "overlapping uploads are rejected");
  let complete;
  const pending = new Promise((resolve) => { complete = resolve; });
  let files = [];
  const upload = (async () => { await pending; if (gate.isCurrent(old)) files.push("old.pdf"); })();
  gate.invalidate();
  const current = gate.begin();
  complete();
  await upload;
  assert.deepEqual(files, [], "cleared files cannot reappear");
  gate.finish(old);
  assert.equal(gate.isCurrent(current), true, "stale finally cannot release the current lock");
  gate.invalidate();
  assert.equal(gate.isCurrent(current), false, "unmounted merges cannot publish results");
});

test("invalid files and cancelled processing cannot produce merge outputs", async () => {
  await assert.rejects(processAdvancedItem(item(new Uint8Array([1, 2, 3]), "amazon")));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(processAdvancedItem(item(await (await sourcePdf()).save(), "amazon"), controller.signal), { name: "AbortError" });
});

test("Meesho defaults to keeping the invoice and bypasses stale crop settings", async () => {
  const bytes = await (await sourcePdf([[600, 800], [601, 800]])).save();
  assert.equal(defaultKeepInvoices("meesho"), true);
  assert.equal(defaultKeepInvoices("amazon"), false);
  const selected = changeAdvancedSettings(item(bytes, "", { file: { name: "meesho.pdf" } }), { platform: "meesho" });
  assert.equal(selected.keepInvoices, true);
  assert.equal(needsCropReview(selected), false);
  assert.equal(canProcess(selected), true);
  // A hidden stale rectangle must never crop a Keep invoice file.
  const kept = await processAdvancedItem({ ...selected, manualOverride: true, reviewed: true, rect: { x: 0, y: 0, width: 1, height: 0.5 } });
  assert.equal(kept.output, bytes);
  assert.equal(kept.outputName, "meesho.pdf");
  assert.equal(kept.outputPages, 2);
  assert.equal(kept.status, "ready");
  assert.equal(kept.warning, undefined);
});

test("Meesho invoice toggles invalidate outputs and require a fresh removal review", async () => {
  const bytes = await (await sourcePdf()).save();
  const base = changeAdvancedSettings(item(bytes, "meesho"), { platform: "meesho" });
  const kept = await processAdvancedItem(base);
  const remove = changeAdvancedSettings(kept, { keepInvoices: false });
  assert.equal(remove.output, null);
  assert.equal(remove.reviewed, false);
  assert.equal(needsCropReview(remove), true);
  assert.equal(canProcess(remove), false);
  await assert.rejects(processAdvancedItem(remove), /review the crop/);
  const reviewed = changeAdvancedSettings(remove, { rect: { x: 0, y: 0, width: 1, height: 0.5 }, reviewed: true, manualOverride: true });
  const cropped = await processAdvancedItem(reviewed);
  assert.equal((await PDFDocument.load(cropped.output)).getPage(0).getHeight(), 400);
  const keepAgain = changeAdvancedSettings(cropped, { keepInvoices: true });
  assert.equal(keepAgain.output, null);
  assert.equal(keepAgain.reviewed, false);
  assert.equal(keepAgain.manualOverride, false);
  assert.equal((await processAdvancedItem(keepAgain)).output, bytes);
  const removeAgain = changeAdvancedSettings(keepAgain, { keepInvoices: false });
  assert.equal(canProcess(removeAgain), false);
  const amazon = changeAdvancedSettings(keepAgain, { platform: "amazon" });
  assert.equal(amazon.keepInvoices, false);
  assert.equal(canProcess(amazon), true);
});

test("platform detection recognizes Ekart aliases, dash variants, and split text items", () => {
  for (const text of ["Flipkart", "FLIPKART SHIPPING", "Ekart Logistics", "E-kart", "E KART", "E–Kart", "E—kart", "E‑KART", "E - k a r t", "F l i p k a r t", "ＦＬＩＰＫＡＲＴ"]) {
    assert.deepEqual(platformFromText(text), { platform: "flipkart", basis: "text-match" }, text);
  }
  for (const text of ["Amazon Seller Services", "www.amazon.in", "ＡＭＡＺＯＮ", "A m a z o n", "Am azon", "Ama\u00adzon"]) {
    assert.deepEqual(platformFromText(text), { platform: "amazon", basis: "text-match" }, text);
  }
  assert.deepEqual(platformFromText("mees\u200bho"), { platform: "meesho", basis: "text-match" });
});

test("Meesho fallback requires readable text; conflicting known platforms stay unselected", () => {
  for (const text of ["Shipping label 12345", "amazonian forest and flipkartish text", "Invoice with no marketplace brand"]) {
    assert.deepEqual(platformFromText(text), { platform: "meesho", basis: "fallback" });
  }
  for (const text of ["", " \n\t", "\u200b"]) {
    assert.deepEqual(platformFromText(text), { platform: null, basis: "no-text" });
  }
  for (const text of ["Flipkart order via Amazon", "E-kart delivery Amazon", "E K A R T and A m a z o n"]) {
    assert.deepEqual(platformFromText(text), { platform: null, basis: "mixed" });
  }
  assert.deepEqual(platformFromText("Meesho invoice and Flipkart label"), { platform: "flipkart", basis: "text-match" });
});

test("detected and fallback platforms use defaults; manual overrides remain authoritative", async () => {
  const bytes = await (await sourcePdf()).save();
  for (const text of ["Meesho Shipping Label", "Invoice 123"]) {
    const detection = platformFromText(text);
    const selected = changeAdvancedSettings(item(bytes, "", { detection }), { platform: detection.platform });
    assert.equal(selected.platform, "meesho");
    assert.equal(selected.keepInvoices, true);
    const ready = await processAdvancedItem(selected);
    const overridden = changeAdvancedSettings(ready, { platform: "amazon" });
    assert.equal(overridden.platform, "amazon");
    assert.equal(overridden.keepInvoices, false);
    assert.equal(overridden.output, null);
    assert.deepEqual(overridden.detection, detection);
  }
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await detectPdfPlatform(bytes, controller.signal), { platform: null, basis: "unavailable" });
});

test("PDF extraction errors and empty text cannot trigger the Meesho fallback", async () => {
  const render = require("../lib/pdf/render.ts");
  const original = render.getPdfSampleText;
  try {
    render.getPdfSampleText = async () => { throw new Error("Worker unavailable"); };
    assert.deepEqual(await detectPdfPlatform(new Uint8Array()), { platform: null, basis: "unavailable" });
    render.getPdfSampleText = async () => "";
    assert.deepEqual(await detectPdfPlatform(new Uint8Array()), { platform: null, basis: "no-text" });
    render.getPdfSampleText = async () => "E-kart Logistics";
    assert.deepEqual(await detectPdfPlatform(new Uint8Array()), { platform: "flipkart", basis: "text-match" });
  } finally { render.getPdfSampleText = original; }
});

test("detection times out after five seconds and aborts pending text extraction", async (t) => {
  const render = require("../lib/pdf/render.ts");
  const original = render.getPdfSampleText;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let readSignal;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    render.getPdfSampleText = (_bytes, signal) => {
      readSignal = signal;
      started();
      return new Promise(() => {});
    };
    const pending = detectPdfPlatform(new Uint8Array());
    await ready;
    t.mock.timers.tick(5000);
    assert.deepEqual(await pending, { platform: null, basis: "unavailable" });
    assert.equal(readSignal.aborted, true);
  } finally { render.getPdfSampleText = original; t.mock.timers.reset(); }
});

test("cancelling detection aborts extraction and never returns a fallback selection", async () => {
  const render = require("../lib/pdf/render.ts");
  const original = render.getPdfSampleText;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let readSignal;
  try {
    render.getPdfSampleText = (_bytes, signal) => {
      readSignal = signal;
      started();
      return new Promise(() => {});
    };
    const controller = new AbortController();
    const pending = detectPdfPlatform(new Uint8Array(), controller.signal);
    await ready;
    controller.abort();
    assert.deepEqual(await pending, { platform: null, basis: "unavailable" });
    assert.equal(readSignal.aborted, true);
  } finally { render.getPdfSampleText = original; }
});

test("paint yield completes promptly after a frame and also works in background tabs", async (t) => {
  const { yieldForPaint } = require("../lib/yield-for-paint.ts");
  const saved = { window: global.window, raf: global.requestAnimationFrame, cancel: global.cancelAnimationFrame };
  let frameCallback;
  let cancelled = false;
  global.window = {};
  global.requestAnimationFrame = (callback) => { frameCallback = callback; return 1; };
  global.cancelAnimationFrame = () => { cancelled = true; };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const foreground = yieldForPaint();
    frameCallback(0);
    t.mock.timers.tick(0);
    await foreground;
    const background = yieldForPaint();
    t.mock.timers.tick(100);
    await background;
    assert.equal(cancelled, true, "a suspended animation frame is cancelled by the fallback");
  } finally {
    if (saved.window === undefined) delete global.window; else global.window = saved.window;
    if (saved.raf === undefined) delete global.requestAnimationFrame; else global.requestAnimationFrame = saved.raf;
    if (saved.cancel === undefined) delete global.cancelAnimationFrame; else global.cancelAnimationFrame = saved.cancel;
    t.mock.timers.reset();
  }
});
