import { describe, expect, it, vi } from "vitest";
import { assemblePrintableStatementHtml, assembleUnifiedDocumentHtml, directPdfFilename, openPrintWindow, selectPrintableDocument, withPrintTitle } from "./printDocument";

describe("separate document printing", () => {
  it("combines only pages of the same account statement for a separate print job", () => {
    const first = "<!doctype html><html><head><style></style></head><body><section class=\"page\">first</section></body></html>";
    const second = "<!doctype html><html><head><style></style></head><body><section class=\"page\">second</section></body></html>";
    const html = assemblePrintableStatementHtml([first, second]);
    expect(html.match(/class=\"page\"/g)).toHaveLength(2);
    expect(html).not.toContain("Account Status Statement");
  });

  it("opens one separate print window with the correct title for each document", () => {
    for (const title of ["Account Status Statement", "Account Statement"]) {
      const write = vi.fn();
      const focus = vi.fn();
      const print = vi.fn();
      const fakeWindow = { document: { open: vi.fn(), write, close: vi.fn() }, focus, print, addEventListener: (_type: "load", listener: () => void) => listener() };
      const host = { open: vi.fn(() => fakeWindow) };
      expect(openPrintWindow("<html><head></head><body>statement</body></html>", title, host)).toBe(true);
      expect(host.open).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(expect.stringContaining(`<title>${title}</title>`));
      expect(write).toHaveBeenCalledWith(expect.stringContaining("print-asset-preservation"));
      expect(focus).toHaveBeenCalledTimes(1);
      expect(print).toHaveBeenCalledTimes(1);
    }
  });

  it("preserves the opener origin as the base for original logos and backgrounds in the print window", () => {
    const html = withPrintTitle("<html><head></head><body><img src=\"/manus-storage/logo.png\"></body></html>", "Account Statement", "https://bank-karimi-web-staging.onrender.com/");
    expect(html).toContain('<base href="https://bank-karimi-web-staging.onrender.com/">');
    expect(html).toContain("-webkit-print-color-adjust:exact");
    expect(html).toContain("print-color-adjust:exact");
  });

  it("selects only the requested document HTML and preserves the statement header artifact", () => {
    const accountStatus = "<html><head></head><body><main id=\"account-status\"></main></body></html>";
    const accountStatement = "<html><head></head><body><img class=\"header-art\" src=\"original-header.png\"></body></html>";
    expect(selectPrintableDocument("accountStatus", accountStatus, accountStatement)).toEqual({ html: accountStatus, title: "Account Status Statement" });
    expect(selectPrintableDocument("accountStatement", accountStatus, accountStatement)).toEqual({ html: accountStatement, title: "Account Statement" });
    expect(selectPrintableDocument("accountStatement", accountStatus, accountStatement).html).toContain("header-art");
  });

  it("combines the account status statement first and the full account statement after it", () => {
    const statement = "<html><head><style>.statement{color:red}</style></head><body><section class=\"page\">ACCOUNT STATEMENT</section></body></html>";
    const status = "<html><head><style>.status{color:blue}</style></head><body><section class=\"page\">ACCOUNT STATUS</section></body></html>";
    const html = assembleUnifiedDocumentHtml(statement, status);
    expect(html.indexOf("ACCOUNT STATUS")).toBeLessThan(html.indexOf("ACCOUNT STATEMENT"));
    expect(html).toContain("break-after:page");
    expect(html).toContain("break-before:page");
    expect(html).toContain("print-part+.print-part");
    expect(html).toContain(".print-part .page");
    expect(html).toContain(".statement{color:red}");
    expect(html).toContain(".status{color:blue}");
    expect(html).not.toContain("<iframe");
  });

  it("keeps nested print media rules valid while scoping unified statement styles", () => {
    const statement = "<html><head><style>.table{border:1px solid red}@media print{.head{display:flex!important}.cell{color:blue}}</style></head><body><section class=\"page\"><div class=\"table\"><div class=\"head\"><div class=\"cell\">Date</div></div></div></section></body></html>";
    const html = assembleUnifiedDocumentHtml(statement, "<html><head></head><body><section class=\"page\">STATUS</section></body></html>");
    expect(html).toContain("[data-print-part=account-statement] .table{border:1px solid red}");
    expect(html).toContain("@media print{[data-print-part=account-statement] .head{display:flex!important}[data-print-part=account-statement] .cell{color:blue}}");
    expect(html).not.toContain("@media print{.head{display:flex!important}.cell{color:blue}");
  });

  it("scopes root variables even when the official template puts a comment before :root", () => {
    const statement = "<html><head><style>/* official palette */ :root{--primary-dark:#1B365D}.head{background:var(--primary-dark)!important;color:#fff}</style></head><body><section class=\"page\"><div class=\"head\">Date</div></section></body></html>";
    const html = assembleUnifiedDocumentHtml(statement, "<html><head></head><body><section class=\"page\">STATUS</section></body></html>");
    expect(html).toContain("/* official palette */ [data-print-part=account-statement]{--primary-dark:#1B365D}");
    expect(html).toContain("[data-print-part=account-statement] .head{background:var(--primary-dark)!important;color:#fff}");
  });

  it("prints every statement page in the unified package, not only the first page", () => {
    const statement = "<html><head><style>.statement{color:red}</style></head><body><section class=\"page\">STATEMENT PAGE 1</section><section class=\"page\">STATEMENT PAGE 2</section></body></html>";
    const status = "<html><head><style>.status{color:blue}</style></head><body><section class=\"page\">ACCOUNT STATUS</section></body></html>";
    const html = assembleUnifiedDocumentHtml(statement, status);
    expect(html.match(/class=\"page\"/g)).toHaveLength(3);
    expect(html.indexOf("ACCOUNT STATUS")).toBeLessThan(html.indexOf("STATEMENT PAGE 1"));
    expect(html.indexOf("STATEMENT PAGE 1")).toBeLessThan(html.indexOf("STATEMENT PAGE 2"));
    expect(html).not.toContain("unified-page-frame");
  });

  it("extracts every full HTML page from a multi-page statement file", () => {
    const status = "<html><head><style>.status{color:blue}</style></head><body><section class=\"page\">STATUS</section></body></html>";
    const statement = [1, 2, 3].map((page) => `<html><head><style>.statement-${page}{color:red}</style></head><body><section class=\"page\">STATEMENT PAGE ${page}</section></body></html>`).join("");
    const html = assembleUnifiedDocumentHtml(statement, status);
    expect(html.match(/STATEMENT PAGE/g)).toHaveLength(3);
    expect(html.indexOf("STATEMENT PAGE 1")).toBeLessThan(html.indexOf("STATEMENT PAGE 2"));
    expect(html.indexOf("STATEMENT PAGE 2")).toBeLessThan(html.indexOf("STATEMENT PAGE 3"));
  });

  it("selects the unified print package and uses a stable filename", () => {
    const accountStatus = "<html><head></head><body>status</body></html>";
    const accountStatement = "<html><head></head><body>statement</body></html>";
    const selected = selectPrintableDocument("unified", accountStatus, accountStatement);
    expect(selected.title).toBe("Unified Account Statement Package");
    expect(selected.html.indexOf("status")).toBeLessThan(selected.html.indexOf("statement"));
    expect(directPdfFilename("unified", "2026-08-15")).toBe("Unified-Account-Statement-Package-20260815.pdf");
  });

  it("prints status, account statement, then quick statement in the all-in-one package", () => {
    const selected = selectPrintableDocument("unifiedAll", "<html><body>STATUS</body></html>", "<html><body>ACCOUNT</body></html>", "<html><body>QUICK</body></html>");
    expect(selected.title).toContain("Status, Account, Quick");
    expect(selected.html.indexOf("STATUS")).toBeLessThan(selected.html.indexOf("ACCOUNT"));
    expect(selected.html.indexOf("ACCOUNT")).toBeLessThan(selected.html.indexOf("QUICK"));
    expect(directPdfFilename("unifiedAll", "2026-08-15")).toBe("Unified-Status-Account-Quick-Package-20260815.pdf");
  });

  it("builds separate stable filenames for direct PDF downloads", () => {
    expect(directPdfFilename("accountStatus", "2026-08-15")).toBe("Account-Status-Statement-20260815.pdf");
    expect(directPdfFilename("accountStatement", "15/08/2026")).toBe("Account-Statement-15082026.pdf");
  });
});
