export type PrintableWindow = {
  document: Pick<Document, "open" | "write" | "close"> & Partial<Pick<Document, "querySelectorAll">>;
  focus: () => void;
  print: () => void;
  addEventListener: (type: "load", listener: () => void, options?: AddEventListenerOptions) => void;
};

export type PrintHost = { open: (url?: string, target?: string) => PrintableWindow | null };
export type PrintDocumentKind = "accountStatus" | "accountStatement";

const safeTitle = (title: string) => title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const printAssetStyles = "<style id=\"print-asset-preservation\">@media print{html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}img{print-color-adjust:exact!important}}}</style>";

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
  const images = printWindow.document.querySelectorAll
    ? Array.from(printWindow.document.querySelectorAll("img"))
    : [];
  const print = () => {
    printWindow.focus();
    printWindow.print();
  };
  if (!images.length) {
    print();
    return;
  }
  void Promise.all(images.map(waitForImage)).then(print);
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

export function selectPrintableDocument(kind: PrintDocumentKind, accountStatusHtml: string, accountStatementHtml: string) {
  return kind === "accountStatus"
    ? { html: accountStatusHtml, title: "Account Status Statement" }
    : { html: accountStatementHtml, title: "Account Statement" };
}

export function directPdfFilename(kind: PrintDocumentKind, issueDate?: string) {
  const normalizedDate = String(issueDate || "").replace(/[^0-9]/g, "");
  const dateToken = normalizedDate.length >= 8
    ? normalizedDate.slice(0, 8)
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${kind === "accountStatus" ? "Account-Status-Statement" : "Account-Statement"}-${dateToken}.pdf`;
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

export async function downloadDocumentPdf(kind: PrintDocumentKind, html: string, issueDate?: string) {
  if (!html || typeof document === "undefined") return false;
  const selected = selectPrintableDocument(kind, html, html);
  const frame = document.createElement("iframe");
  frame.title = `${selected.title} PDF renderer`;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;background:#fff;pointer-events:none;";
  document.body.appendChild(frame);
  try {
    const loaded = waitForFrameLoad(frame);
    frame.srcdoc = withPrintTitle(selected.html, selected.title);
    await loaded;
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("PDF preview document is unavailable.");
    await frameDocument.fonts?.ready;
    await inlineFrameAssets(frameDocument);
    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>(".page"));
    if (!pages.length) throw new Error("No printable document page was found.");
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const canvas = await html2canvas(page, {
        backgroundColor: "#ffffff",
        imageTimeout: 12_000,
        logging: false,
        scale: 2,
        useCORS: true,
        width: page.offsetWidth,
        height: page.offsetHeight,
        windowWidth: page.scrollWidth,
      });
      if (index > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
    }
    pdf.save(directPdfFilename(kind, issueDate));
    return true;
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
