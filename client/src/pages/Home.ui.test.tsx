// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const qrDataUrl = "data:image/png;base64,QR";

vi.mock("@/lib/trpc", () => ({
  trpc: { staging: {
    health: { useQuery: () => ({ isLoading: false, data: { tableCount: 8 } }) },
    loadSnapshot: { useQuery: () => ({ isLoading: false, isError: false, data: null }) },
    saveSnapshot: { useMutation: () => ({ mutate: vi.fn((_input, options) => options?.onSuccess?.({ saved: true })), mutateAsync: vi.fn(async () => ({ saved: true })) }) },
  } },
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => qrDataUrl) } }));
vi.mock("jsbarcode", () => ({ default: vi.fn((svg: SVGElement) => svg.setAttribute("data-generated", "barcode")) }));

import Home from "./Home";

function makeLedgerFile() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Date", "Description", "Reference", "Debit", "Credit", "Balance"],
    ["04/08/2026", "Cash deposit", "EXT-1", "", 100, 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Ledger");
  const binary = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const file = new File([binary], "ledger.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => binary });
  return file;
}

function mockPrintWindow() {
  const write = vi.fn();
  const printWindow = {
    document: { open: vi.fn(), write, close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: (_type: "load", listener: () => void) => listener(),
  };
  return { write, open: vi.fn(() => printWindow) };
}

describe("Home applied transaction register", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies an edited date to the printed account statement while each print button opens only its matching document", async () => {
    const host = mockPrintWindow();
    vi.stubGlobal("open", host.open);
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Transactions & Import" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeLedgerFile()] } });
    await screen.findByText("Editable Transaction Register");

    const dateInput = screen.getByDisplayValue("2026-08-04") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Register Changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Review & Export" }));

    fireEvent.click(screen.getByRole("button", { name: "View Account Statement" }));
    const preview = await screen.findByTitle("Account Statement print preview");
    expect(preview.getAttribute("srcdoc")).toContain("header-art");
    expect(preview.getAttribute("srcdoc")).toContain("05/08/2026");

    fireEvent.click(screen.getByRole("button", { name: "Print Account Status / Save PDF" }));
    await waitFor(() => expect(host.open).toHaveBeenCalledTimes(1));
    expect(host.write).toHaveBeenLastCalledWith(expect.stringContaining("<title>Account Status Statement</title>"));

    fireEvent.click(screen.getByRole("button", { name: "Print Account Statement / Save PDF" }));
    await waitFor(() => expect(host.open).toHaveBeenCalledTimes(2));
    const statementHtml = host.write.mock.calls.at(-1)?.[0] as string;
    expect(statementHtml).toContain("<title>Account Statement</title>");
    expect(statementHtml).toContain("header-art");
    expect(statementHtml).toContain("05/08/2026");
  });
});
