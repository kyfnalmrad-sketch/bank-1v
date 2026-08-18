import { describe, expect, it, vi } from "vitest";
import { assemblePrintableStatementHtml, openPrintWindow, selectPrintableDocument } from "./printDocument";

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
      expect(focus).toHaveBeenCalledTimes(1);
      expect(print).toHaveBeenCalledTimes(1);
    }
  });

  it("selects only the requested document HTML and preserves the statement header artifact", () => {
    const accountStatus = "<html><head></head><body><main id=\"account-status\"></main></body></html>";
    const accountStatement = "<html><head></head><body><img class=\"header-art\" src=\"original-header.png\"></body></html>";
    expect(selectPrintableDocument("accountStatus", accountStatus, accountStatement)).toEqual({ html: accountStatus, title: "Account Status Statement" });
    expect(selectPrintableDocument("accountStatement", accountStatus, accountStatement)).toEqual({ html: accountStatement, title: "Account Statement" });
    expect(selectPrintableDocument("accountStatement", accountStatus, accountStatement).html).toContain("header-art");
  });
});
