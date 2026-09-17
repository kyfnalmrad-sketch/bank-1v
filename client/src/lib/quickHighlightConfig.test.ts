import { describe, expect, it } from "vitest";
import { getQuickHighlightConfig, QUICK_HIGHLIGHT_CONFIG } from "./quickHighlightConfig";
import { renderTadhamonFastStatement } from "./tadhamonFastStatementTemplate";
import { renderYcbStatementPages } from "@/components/YcbStatementWorkspace";

const profile = {
  customerName: "Test Customer",
  passport: "P-1",
  address: "Sana'a",
  placeOfBirth: "Sana'a",
  dateOfBirth: "01 January 1990",
  branchName: "Main Branch",
  accountNumber: "ACC-1",
  accountType: "Current Account",
  currency: "YER",
  periodStart: "01 January 2026",
  periodEnd: "31 January 2026",
  statementReference: "REF-1",
  openingBalance: 100,
  closingBalance: 250,
  totalCredit: 200,
  totalDebit: 50,
  issueDate: "31 January 2026",
};

const transactions = [
  { date: "01/01/2026", reference: "CR-1", description: "Deposit", credit: 200, debit: 0, balance: 300 },
  { date: "02/01/2026", reference: "DR-1", description: "Withdrawal", credit: 0, debit: 50, balance: 250 },
];

describe("quick statement bank highlight configuration", () => {
  it("keeps an independent deposit color for each bank", () => {
    expect(getQuickHighlightConfig("tadhamon").depositColor).toBe("#ffed00");
    expect(getQuickHighlightConfig("ycb").depositColor).toBe("#fef08a");
    expect(getQuickHighlightConfig("karimi").depositColor).toBe("#e5e7eb");
    expect(new Set(Object.values(QUICK_HIGHLIGHT_CONFIG).map((config) => config.depositColor)).size).toBe(3);
  });

  it("keeps an independent withdrawal color for each bank", () => {
    expect(getQuickHighlightConfig("ycb").withdrawalColor).toBe("#dbeafe");
    expect(getQuickHighlightConfig("karimi").withdrawalColor).toBe("#fee2e2");
    expect(getQuickHighlightConfig("tadhamon").withdrawalColor).toBe("#ffed00");
  });

  it("does not expose official-document colors as part of the config", () => {
    expect(Object.keys(QUICK_HIGHLIGHT_CONFIG)).toEqual(["tadhamon", "ycb", "karimi"]);
  });

  it("renders YCB and Karimi deposit colors in quick statements independently", () => {
    const ycb = getQuickHighlightConfig("ycb");
    const karimi = getQuickHighlightConfig("karimi");
    const ycbHtml = renderTadhamonFastStatement({ ...profile, bankName: ycb.label }, transactions, { "CR-1": ycb.depositColor });
    const karimiHtml = renderTadhamonFastStatement({ ...profile, bankName: karimi.label }, transactions, { "CR-1": karimi.depositColor });

    expect(ycbHtml).toContain(`--highlight-color:${ycb.depositColor}`);
    expect(karimiHtml).toContain(`--highlight-color:${karimi.depositColor}`);
    expect(ycbHtml).not.toContain(`--highlight-color:${karimi.depositColor}`);
    expect(karimiHtml).not.toContain(`--highlight-color:${ycb.depositColor}`);
  });

  it("keeps quick colors out of the official YCB statement template", () => {
    const html = renderYcbStatementPages(profile, transactions, [], [], {});
    expect(html).not.toContain("--highlight-color");
    expect(html).not.toContain(getQuickHighlightConfig("ycb").depositColor);
  });
});
