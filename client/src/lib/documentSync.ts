import type { ImportedTransaction } from "./statementImport";

export type DocumentSyncResult = {
  acceptedRows: ImportedTransaction[];
  rejectedRows: ImportedTransaction[];
  statementRows: Array<ImportedTransaction & { balance: number }>;
  totalCredit: number;
  totalDebit: number;
  closing: number;
};

export function synchronizeDocumentData(transactions: ImportedTransaction[], openingBalance: number): DocumentSyncResult {
  const acceptedRows = transactions.filter((transaction) => !transaction.rejected);
  const rejectedRows = transactions.filter((transaction) => transaction.rejected);
  const totalCredit = acceptedRows.reduce((sum, transaction) => sum + transaction.credit, 0);
  const totalDebit = acceptedRows.reduce((sum, transaction) => sum + transaction.debit, 0);
  let runningBalance = openingBalance;
  const statementRows = acceptedRows.map((transaction) => {
    const calculatedBalance = runningBalance + transaction.credit - transaction.debit;
    const balance = transaction.balance ?? calculatedBalance;
    runningBalance = balance;
    return { ...transaction, balance };
  });
  return { acceptedRows, rejectedRows, statementRows, totalCredit, totalDebit, closing: statementRows.at(-1)?.balance ?? openingBalance + totalCredit - totalDebit };
}

export type VerificationQrInput = {
  reference: string;
  accountNumber: string;
  customerName?: string;
  documentType?: "statement" | "status";
  pageNumber?: number;
  pageCount?: number;
  periodStart?: string;
  periodEnd?: string;
  firstReference?: string;
  lastReference?: string;
  transactionCount: number;
  debitCount?: number;
  creditCount?: number;
  totalDebit?: number;
  totalCredit?: number;
  openingBalance?: number;
  currency: string;
  closing: number;
  issueDate?: string;
  issueDateHijri?: string;
};

const qrMoney = (value: number | undefined) => Number(value ?? 0).toFixed(2);
const qrDigits = (value: number | undefined) => String(value ?? 0).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
const qrText = (value: string | undefined) => value?.trim() || "—";

export function buildVerificationQrPayload(input: VerificationQrInput) {
  const typeLabel = input.documentType === "status" ? "بيان حالة" : "كشف حساب";
  const dateLine = input.issueDateHijri
    ? `التاريخ: ${qrText(input.issueDate)} | التاريخ الهجري: ${qrText(input.issueDateHijri)}`
    : `التاريخ: ${qrText(input.issueDate)}`;
  return [
    "الكريمي | عينة تدريبية غير رسمية",
    `الوثيقة: ${typeLabel}`,
    `الصفحة: ${qrDigits(input.pageNumber)}/${qrDigits(input.pageCount)}`,
    `العميل: ${qrText(input.customerName)}`,
    `الحساب: ${qrText(input.accountNumber)}`,
    `الفترة: ${qrText(input.periodStart)} - ${qrText(input.periodEnd)}`,
    dateLine,
    `العملة: ${qrText(input.currency)}`,
    `أول مرجع: ${qrText(input.firstReference)}`,
    `آخر مرجع: ${qrText(input.lastReference)}`,
    `العمليات: ${qrDigits(input.transactionCount)} | سحب: ${qrDigits(input.debitCount)} (${qrMoney(input.totalDebit)}) | إيداع: ${qrDigits(input.creditCount)} (${qrMoney(input.totalCredit)})`,
    `رصيد البداية: ${qrMoney(input.openingBalance)} | رصيد النهاية: ${qrMoney(input.closing)}`,
    `مرجع التحقق: ${qrText(input.reference)}`,
  ].join("\n");
}
