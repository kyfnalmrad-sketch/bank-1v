// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const { canvasMock, pdfMock } = vi.hoisted(() => {
  const canvasMock = vi.fn(async (target: HTMLElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2260;
    Object.defineProperty(canvas, "toDataURL", { value: vi.fn(() => "data:image/png;base64,preview") });
    (canvas as HTMLCanvasElement & { capturedText?: string }).capturedText = target.textContent || "";
    return canvas;
  });
  const pdfMock = vi.fn(() => ({
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    addPage: vi.fn(),
    setProperties: vi.fn(),
    setCreationDate: vi.fn(),
    output: vi.fn(() => "blob:generated-pdf"),
    save: vi.fn(),
  }));
  return { canvasMock, pdfMock };
});

vi.mock("html2canvas", () => ({ default: canvasMock }));
vi.mock("jspdf", () => ({ jsPDF: pdfMock }));

import { downloadDocumentPdf } from "./printDocument";

describe("PDF/PNG preview snapshot", () => {
  it("captures the existing preview page and preserves its displayed text", async () => {
    vi.spyOn(window, "open").mockImplementation(() => ({ focus: vi.fn() } as unknown as Window));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const previewDocument = document.implementation.createHTMLDocument("Account Statement Preview");
    const page = previewDocument.createElement("section");
    page.className = "page";
    page.textContent = "Displayed customer text — 05/08/2026 — TOTAL 120.00";
    page.getBoundingClientRect = () => ({ width: 794, height: 1123 } as DOMRect);
    previewDocument.body.appendChild(page);
    const displayedText = page.textContent;

    const result = await downloadDocumentPdf(
      "accountStatement",
      "<html><body>THIS MUST NOT BE USED</body></html>",
      "Customer",
      previewDocument,
    );

    expect(result).toBe(true);
    expect(canvasMock).toHaveBeenCalledTimes(1);
    expect(canvasMock.mock.calls[0]?.[0]).toBe(page);
    expect((canvasMock.mock.calls[0]?.[0] as HTMLElement).textContent).toBe(displayedText);
    expect((canvasMock.mock.calls[0]?.[0] as HTMLElement).textContent).not.toContain("THIS MUST NOT BE USED");
    expect(pdfMock).toHaveBeenCalledTimes(1);
  });
});
