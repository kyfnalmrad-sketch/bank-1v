import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export type PrintableWindow = {
  document: Pick<Document, "open" | "write" | "close"> & Partial<Pick<Document, "querySelectorAll">>;
  focus: () => void;
  print: () => void;
  addEventListener: (type: "load", listener: () => void, options?: AddEventListenerOptions) => void;
};

export type PrintHost = { open: (url?: string, target?: string) => PrintableWindow | null };
export type PrintDocumentKind = "accountStatus" | "accountStatement" | "unified" | "unifiedAll";

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

function assemblePrintablePages(pages: string[]) {
  const validPages = pages.filter(Boolean);
  const [first, ...remaining] = validPages;
  if (!first) return "";

  const laterStyles = remaining
    .map((page) => page.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "")
    .join("");
  const laterBodies = remaining
    .map((page) => `<div class="print-page-break" aria-hidden="true"></div>${page.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ""}`)
    .join("");

  return first
    .replace(/<head([^>]*)>/i, `<head$1>${laterStyles}`)
    .replace("</head>", "<style>@media print{.print-page-break{display:block;height:0;break-before:page!important;page-break-before:always!important}.page{break-inside:avoid!important;break-after:page!important;page-break-inside:avoid!important;page-break-after:always!important}.page:last-of-type{break-after:auto!important;page-break-after:auto!important}}</style></head>")
    .replace("</body>", `${laterBodies}</body>`);
}

export function assemblePrintableStatementHtml(pages: string[]) {
  return assemblePrintablePages(pages);
}

function extractHtmlPart(html: string, tag: "head" | "body") {
  return Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => match[1])
    .join("\n");
}

function scopeCss(css: string, scope: string) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (full, selector: string, declarations: string) => {
    const trimmed = selector.trim();
    if (!trimmed || trimmed.startsWith("@") || /^(from|to|\d+%)$/.test(trimmed)) return full;
    const scoped = trimmed.split(",").map((part) => {
      const item = part.trim();
      if (!item) return item;
      if (item === "html" || item === "body" || item === "html,body") return scope;
      if (item.startsWith("html ")) return `${scope} ${item.slice(5)}`;
      if (item.startsWith("body ")) return `${scope} ${item.slice(5)}`;
      if (item === ":root") return scope;
      return `${scope} ${item}`;
    }).join(", ");
    return `${scoped}{${declarations}}`;
  });
}

function extractScopedStyles(html: string, scope: string) {
  return Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => scopeCss(match[1], scope))
    .join("\n");
}

export function assembleUnifiedDocumentHtml(accountStatementHtml: string, accountStatusHtml: string) {
  const parts = [
    { html: accountStatusHtml, scope: "[data-print-part=account-status]" },
    { html: accountStatementHtml, scope: "[data-print-part=account-statement]" },
  ].filter((part) => part.html);
  if (!parts.length) return "";
  const styles = parts.map((part) => extractScopedStyles(part.html, part.scope)).join("\n");
  const bodies = parts.map((part) => `<section class="print-part" data-print-part="${part.scope.includes("status") ? "account-status" : "account-statement"}">${extractHtmlPart(part.html, "body")}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}
    @page{size:A4 portrait;margin:0}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    html,body{margin:0;padding:0;background:#fff}
    .print-part{display:block;break-after:page;page-break-after:always}
    .print-part+.print-part{break-before:page;page-break-before:always}
    .print-part .page{break-inside:avoid!important;page-break-inside:avoid!important;break-after:page!important;page-break-after:always!important}
    .print-part:last-child .page:last-of-type{break-after:auto!important;page-break-after:auto!important}
    .print-part:last-child{break-after:auto;page-break-after:auto}
  </style></head><body>${bodies}</body></html>`;
}

export function assembleUnifiedAllDocumentHtml(accountStatusHtml: string, accountStatementHtml: string, quickStatementHtml: string) {
  const parts = [
    { html: accountStatusHtml, scope: "[data-print-part=account-status]", key: "account-status" },
    { html: accountStatementHtml, scope: "[data-print-part=account-statement]", key: "account-statement" },
    { html: quickStatementHtml, scope: "[data-print-part=quick-statement]", key: "quick-statement" },
  ].filter((part) => part.html);
  if (!parts.length) return "";
  const styles = parts.map((part) => extractScopedStyles(part.html, part.scope)).join("\n");
  const bodies = parts.map((part) => `<section class="print-part" data-print-part="${part.key}">${extractHtmlPart(part.html, "body")}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}
    @page{size:A4 portrait;margin:0}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    html,body{margin:0;padding:0;background:#fff}
    .print-part{display:block;break-after:page;page-break-after:always}
    .print-part+.print-part{break-before:page;page-break-before:always}
    .print-part .page{break-inside:avoid!important;page-break-inside:avoid!important;break-after:page!important;page-break-after:always!important}
    .print-part:last-child .page:last-of-type{break-after:auto!important;page-break-after:auto!important}
    .print-part:last-child{break-after:auto;page-break-after:auto}
  </style></head><body>${bodies}</body></html>`;
}

export function selectPrintableDocument(kind: PrintDocumentKind, accountStatusHtml: string, accountStatementHtml: string, quickStatementHtml = "") {
  if (kind === "accountStatus") return { html: accountStatusHtml, title: "Account Status Statement" };
  if (kind === "unified") return { html: assembleUnifiedDocumentHtml(accountStatementHtml, accountStatusHtml), title: "Unified Account Statement Package" };
  if (kind === "unifiedAll") return { html: assembleUnifiedAllDocumentHtml(accountStatusHtml, accountStatementHtml, quickStatementHtml), title: "Unified Statement Package — Status, Account, Quick" };
  return { html: accountStatementHtml, title: "Account Statement" };
}

export function directPdfFilename(kind: PrintDocumentKind, issueDate?: string, customerName?: string) {
  const normalizedDate = String(issueDate || "").replace(/[^0-9]/g, "");
  const dateToken = normalizedDate.length >= 8
    ? normalizedDate.slice(0, 8)
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = kind === "accountStatus" ? "Account-Status-Statement" : kind === "unifiedAll" ? "Unified-Status-Account-Quick-Package" : kind === "unified" ? "Unified-Account-Statement-Package" : "Account-Statement";
  const person = String(customerName || "").trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
  return `${person ? `${person} - ` : ""}${prefix}-${dateToken}.pdf`;
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

export async function downloadDocumentPdf(kind: PrintDocumentKind, html: string, customerName = "") {
  if (!html || typeof window === "undefined") return false;
  const selected = selectPrintableDocument(kind, html, html);
  const person = customerName.trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
  const title = person ? `${person} - ${selected.title}` : selected.title;
  const fileName = directPdfFilename(kind, undefined, customerName);

  // Flatten every rendered page into one raster image before creating the PDF.
  // This intentionally removes selectable/movable HTML, text, and SVG objects
  // from the downloaded document while preserving the visual preview exactly.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-100000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);

  try {
    const frameLoaded = waitForFrameLoad(frame);
    frame.srcdoc = withPrintTitle(selected.html, title);
    await frameLoaded;
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("Unable to access the PDF preview.");
    await inlineFrameAssets(frameDocument);
    await Promise.all(Array.from(frameDocument.images).map(waitForImage));

    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>(".page"));
    const targets = pages.length ? pages : [frameDocument.body];
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
        imageTimeout: 15000,
        width: target.scrollWidth,
        height: target.scrollHeight,
      });
      if (index > 0) pdf.addPage();
      const imageData = canvas.toDataURL("image/jpeg", 0.96);
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(imageData, "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
    }

    pdf.setProperties({ title, subject: "Flattened visual statement PDF", creator: "Bank statement system" });
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error("Unable to create flattened PDF", error);
    return false;
  } finally {
    frame.remove();
  }
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
