export type FinancialAuditRow = {
  rowNumber: number;
  date: string;
  operationNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type FinancialAuditIssue = {
  type: "transaction" | "running-balance" | "credit-total" | "debit-total" | "closing-balance" | "page-boundary" | "duplicate" | "date-or-currency" | "unexplained";
  severity: "medium" | "high" | "critical";
  rowNumber?: number;
  date?: string;
  message: string;
  difference?: number;
};

export type FinancialAuditPage = {
  pageNumber: number;
  rowCount: number;
  totalCredit: number;
  totalDebit: number;
  openingBalance: number;
  closingBalance: number;
};

export type FinancialAuditResult = {
  isMatch: boolean;
  openingBalance: number;
  calculatedCredit: number;
  calculatedDebit: number;
  calculatedClosing: number;
  printedCredit?: number;
  printedDebit?: number;
  printedClosing?: number;
  issues: FinancialAuditIssue[];
  pages: FinancialAuditPage[];
};

const epsilon = 0.005;
const different = (a: number, b: number) => Math.abs(a - b) > epsilon;
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function auditFinancialStatement(input: {
  openingBalance: number;
  rows: FinancialAuditRow[];
  printedCredit?: number;
  printedDebit?: number;
  printedClosing?: number;
  pageSize?: number;
  periodStart?: string;
  periodEnd?: string;
  printDate?: string;
}): FinancialAuditResult {
  const rows = input.rows;
  const issues: FinancialAuditIssue[] = [];
  let previous = amount(input.openingBalance);
  let calculatedCredit = 0;
  let calculatedDebit = 0;
  const seen = new Map<string, number>();
  const pageSize = input.pageSize || 18;
  const pages: FinancialAuditPage[] = [];

  rows.forEach((row, index) => {
    const credit = amount(row.credit);
    const debit = amount(row.debit);
    const printedBalance = amount(row.balance);
    if (credit > epsilon && debit > epsilon) {
      issues.push({ type: "transaction", severity: "high", rowNumber: row.rowNumber, date: row.date, message: "العملية تحتوي إيداعًا وسحبًا معًا." });
    }
    const expected = previous + credit - debit;
    if (different(expected, printedBalance)) {
      issues.push({ type: "running-balance", severity: "critical", rowNumber: row.rowNumber, date: row.date, difference: printedBalance - expected, message: `فرق في الرصيد المتتابع: المتوقع ${expected.toFixed(2)} والمطبوع ${printedBalance.toFixed(2)}.` });
    }
    calculatedCredit += credit;
    calculatedDebit += debit;
    const duplicateKey = [row.date, credit || debit, row.operationNumber, row.description.trim().toLowerCase()].join("|");
    if (duplicateKey !== "|||" && seen.has(duplicateKey)) {
      issues.push({ type: "duplicate", severity: "high", rowNumber: row.rowNumber, date: row.date, message: `تكرار محتمل مع الصف ${seen.get(duplicateKey)}.` });
    } else if (duplicateKey !== "|||" ) seen.set(duplicateKey, row.rowNumber);
    previous = expected;
    const pageNumber = Math.floor(index / pageSize);
    const page = pages[pageNumber] || { pageNumber: pageNumber + 1, rowCount: 0, totalCredit: 0, totalDebit: 0, openingBalance: index === 0 ? amount(input.openingBalance) : 0, closingBalance: 0 };
    page.rowCount += 1;
    page.totalCredit += credit;
    page.totalDebit += debit;
    page.closingBalance = expected;
    pages[pageNumber] = page;
    if (index > 0 && index % pageSize === 0) {
      const prior = pages[pageNumber - 1];
      page.openingBalance = prior.closingBalance;
    }
    if ((input.periodStart && row.date && row.date < input.periodStart) || (input.periodEnd && row.date && row.date > input.periodEnd)) {
      issues.push({ type: "date-or-currency", severity: "high", rowNumber: row.rowNumber, date: row.date, message: "تاريخ العملية خارج فترة الكشف." });
    }
  });

  const calculatedClosing = amount(input.openingBalance) + calculatedCredit - calculatedDebit;
  if (input.printDate && input.periodEnd && input.printDate > input.periodEnd) {
    issues.push({ type: "date-or-currency", severity: "medium", message: "تاريخ الإصدار لاحق لنهاية الكشف؛ لا يمكن إثبات رصيد تاريخ الإصدار من هذا الكشف وحده." });
  }
  if (input.printedCredit !== undefined && different(calculatedCredit, input.printedCredit)) issues.push({ type: "credit-total", severity: "high", difference: input.printedCredit - calculatedCredit, message: `فرق إجمالي الإيداعات: المحسوب ${calculatedCredit.toFixed(2)} والمطبوع ${input.printedCredit.toFixed(2)}.` });
  if (input.printedDebit !== undefined && different(calculatedDebit, input.printedDebit)) issues.push({ type: "debit-total", severity: "high", difference: input.printedDebit - calculatedDebit, message: `فرق إجمالي السحوبات: المحسوب ${calculatedDebit.toFixed(2)} والمطبوع ${input.printedDebit.toFixed(2)}.` });
  if (input.printedClosing !== undefined && different(calculatedClosing, input.printedClosing)) issues.push({ type: "closing-balance", severity: "critical", difference: input.printedClosing - calculatedClosing, message: `فرق الرصيد النهائي: المحسوب ${calculatedClosing.toFixed(2)} والمطبوع ${input.printedClosing.toFixed(2)}.` });
  for (let i = 1; i < pages.length; i += 1) {
    if (different(pages[i].openingBalance, pages[i - 1].closingBalance)) issues.push({ type: "page-boundary", severity: "critical", message: `فرق في الرصيد المرحل بين الصفحة ${i} و${i + 1}.`, difference: pages[i].openingBalance - pages[i - 1].closingBalance });
  }
  return { isMatch: issues.length === 0, openingBalance: amount(input.openingBalance), calculatedCredit, calculatedDebit, calculatedClosing, printedCredit: input.printedCredit, printedDebit: input.printedDebit, printedClosing: input.printedClosing, issues, pages };
}
