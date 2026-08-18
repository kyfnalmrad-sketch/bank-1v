export type PrintableWindow = {
  document: Pick<Document, "open" | "write" | "close">;
  focus: () => void;
  print: () => void;
  addEventListener: (type: "load", listener: () => void, options?: AddEventListenerOptions) => void;
};

export type PrintHost = { open: (url?: string, target?: string) => PrintableWindow | null };
export type PrintDocumentKind = "accountStatus" | "accountStatement";

const safeTitle = (title: string) => title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function withPrintTitle(html: string, title: string) {
  return html.replace("<head>", `<head><title>${safeTitle(title)}</title>`);
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

export function openPrintWindow(html: string, title: string, host: PrintHost = window) {
  if (!html) return false;
  const printWindow = host.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(withPrintTitle(html, title));
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  }, { once: true });
  return true;
}
