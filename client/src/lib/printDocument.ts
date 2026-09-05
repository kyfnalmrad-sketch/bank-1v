export type PrintableWindow = {
  document: Pick<Document, "open" | "write" | "close"> & Partial<Pick<Document, "querySelectorAll">>;
  focus: () => void;
  print: () => void;
  addEventListener: (type: "load", listener: () => void, options?: AddEventListenerOptions) => void;
};

export type PrintHost = { open: (url?: string, target?: string) => PrintableWindow | null };
export type PrintDocumentKind = "accountStatus" | "accountStatement" | "unified";

const safeTitle = (title: string) => title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const printAssetStyles = "<style id=\"print-asset-preservation\">@media print{html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}img{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>";
const preloadedAssets = new Map<string, Promise<void>>();

/** Warm the browser cache before a print window is opened; this does not alter the print markup. */
export function preloadPrintAssets(urls: string[], baseHref = currentBaseHref()) {
  if (typeof window === "undefined") return Promise.resolve();
  const tasks = urls.filter(shouldInlineAsset).map((url) => {
    const absolute = new URL(url, baseHref).href;
    if (!preloadedAssets.has(absolute)) {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.src = absolute;
      preloadedAssets.set(absolute, new Promise<void>((resolve) => {
        if (image.complete) { resolve(); return; }
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      }));
    }
    return preloadedAssets.get(absolute)!;
  });
  return Promise.all(tasks).then(() => undefined);
}

function currentBaseHref() {
  if (typeof window === "undefined") return "http://localhost/";
  return `${window.location.origin}/`;
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
      if (timeout) clearTimeout(timeout);
      resolve();
    };
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
    timeout = setTimeout(done, 4000);
  });
}

function printAfterAssetsLoad(printWindow: PrintableWindow) {
  const print = () => {
    printWindow.focus();
    printWindow.print();
  };
  const frameDocument = printWindow.document as unknown as Document;
  if (!printWindow.document.querySelectorAll) {
    print();
    return;
  }
  void inlineFrameAssets(frameDocument)
    .catch((error) => {
      console.warn("Unable to inline one or more document assets before printing", error);
    })
    .then(() => {
      const images = Array.from(frameDocument.querySelectorAll("img"));
      return Promise.all(images.map(waitForImage));
    })
    .then(print);
}

export function withPrintTitle(html: string, title: string, baseHref = currentBaseHref()) {
  return html.replace("<head>", `<head><base href="${safeTitle(baseHref)}"><title>${safeTitle(title)}</title>${printAssetStyles}`);
}

export function assemblePrintableStatementHtml(pages: string[]) {
  const [first, ...remaining] = pages;
  if (!first) return "";
  const laterBodies = remaining.map((page) => page.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || "").join("");
  return first
    .replace("</style>", ".page{break-after:page}.page:last-child{break-after:auto}</style>")
    .replace("</body>", `${laterBodies}</body>`);
}

function extractHtmlPart(html: string, tag: "head" | "body") {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

const escapeSrcdoc = (html: string) => html.replace(/&/g, "&amp;").replace(/'/g, "&#39;");

export function assembleUnifiedDocumentHtml(accountStatementHtml: string, accountStatusHtml: string) {
  if (!accountStatementHtml && !accountStatusHtml) return "";
  const statementFrame = accountStatementHtml ? `<iframe class="unified-page-frame" title="Account Statement" srcdoc='${escapeSrcdoc(accountStatementHtml)}'></iframe>` : "";
  const statusFrame = accountStatusHtml ? `<iframe class="unified-page-frame" title="Account Status Statement" srcdoc='${escapeSrcdoc(accountStatusHtml)}'></iframe>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.unified-page-frame{display:block;width:210mm;height:297mm;border:0;margin:0;padding:0;break-after:page;page-break-after:always}.unified-page-frame:last-child{break-after:auto;page-break-after:auto}</style></head><body>${statusFrame}${statementFrame}</body></html>`;
}

export function selectPrintableDocument(kind: PrintDocumentKind, accountStatusHtml: string, accountStatementHtml: string) {
  if (kind === "accountStatus") return { html: accountStatusHtml, title: "Account Status Statement" };
  if (kind === "unified") return { html: assembleUnifiedDocumentHtml(accountStatementHtml, accountStatusHtml), title: "Unified Account Statement Package" };
  return { html: accountStatementHtml, title: "Account Statement" };
}

export function directPdfFilename(kind: PrintDocumentKind, issueDate?: string) {
  const normalizedDate = String(issueDate || "").replace(/[^0-9]/g, "");
  const dateToken = normalizedDate.length >= 8
    ? normalizedDate.slice(0, 8)
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = kind === "accountStatus" ? "Account-Status-Statement" : kind === "unified" ? "Unified-Account-Statement-Package" : "Account-Statement";
  return `${prefix}-${dateToken}.pdf`;
}

function waitForFrameLoad(frame: HTMLIFrameElement) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("PDF preview did not load in time.")), 12_000);
    frame.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function shouldInlineAsset(url: string) {
  return Boolean(url) && !url.startsWith("data:") && !url.startsWith("blob:") && !url.startsWith("#");
}

async function assetToDataUrl(url: string, baseHref: string) {
  const response = await fetch(new URL(url, baseHref).href, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Unable to load document asset (${response.status}).`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(new Error("Unable to decode document asset.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function inlineFrameAssets(frameDocument: Document) {
  const baseHref = frameDocument.querySelector("base")?.href || window.location.href;
  const cached = new Map<string, Promise<string>>();
  const inline = (url: string) => {
    const absolute = new URL(url, baseHref).href;
    if (!cached.has(absolute)) cached.set(absolute, assetToDataUrl(absolute, baseHref));
    return cached.get(absolute)!;
  };

  const images = Array.from(frameDocument.querySelectorAll<HTMLImageElement>("img")).filter((image) => shouldInlineAsset(image.getAttribute("src") || ""));
  await Promise.all(images.map(async (image) => {
      image.src = await inline(image.getAttribute("src") || "");
      image.decoding = "async";
      image.fetchPriority = "high";
  }));

  const styles = Array.from(frameDocument.querySelectorAll("style"));
  await Promise.all(styles.map(async (style) => {
    const source = style.textContent || "";
    const matches = Array.from(source.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g));
    const replacements = await Promise.all(matches.map(async (match) => {
      const rawUrl = match[2].trim();
      return shouldInlineAsset(rawUrl) ? { rawUrl, dataUrl: await inline(rawUrl) } : null;
    }));
    let next = source;
    for (const replacement of replacements) {
      if (replacement) next = next.replaceAll(replacement.rawUrl, replacement.dataUrl);
    }
    style.textContent = next;
  }));
  await Promise.all(Array.from(frameDocument.querySelectorAll<HTMLImageElement>("img")).map(waitForImage));
}

export async function downloadDocumentPdf(kind: PrintDocumentKind, html: string) {
  if (!html || typeof window === "undefined") return false;
  const selected = selectPrintableDocument(kind, html, html);
  // The browser print engine preserves the reference CSS layout. Rendering the
  // whole A4 page through html2canvas can clip transformed table-cell content.
  return openPrintWindow(selected.html, selected.title);
}

export function openPrintWindow(html: string, title: string, host: PrintHost = window) {
  if (!html) return false;
  const printWindow = host.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(withPrintTitle(html, title));
  printWindow.addEventListener("load", () => {
    printAfterAssetsLoad(printWindow);
  }, { once: true });
  printWindow.document.close();
  return true;
}
