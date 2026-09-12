import type { ImportedTransaction } from "./statementImport";

export type DocumentSyncResult = {
  acceptedRows: ImportedTransaction[];
  rejectedRows: ImportedTransaction[];
  statementRows: Array<ImportedTransaction & { balance: number }>;
  totalCredit: number;
  totalDebit: number;
  closing: number;
};

export function synchronizeDocumentData(
  transactions: ImportedTransaction[],
  openingBalance: number
): DocumentSyncResult {
  const acceptedRows = transactions.filter(
    transaction => !transaction.rejected
  );
  const rejectedRows = transactions.filter(transaction => transaction.rejected);
  const totalCredit = acceptedRows.reduce(
    (sum, transaction) => sum + transaction.credit,
    0
  );
  const totalDebit = acceptedRows.reduce(
    (sum, transaction) => sum + transaction.debit,
    0
  );
  let runningBalance = openingBalance;
  const statementRows = acceptedRows.map(transaction => {
    const calculatedBalance =
      runningBalance + transaction.credit - transaction.debit;
    const balance = transaction.balance ?? calculatedBalance;
    runningBalance = balance;
    return { ...transaction, balance };
  });
  return {
    acceptedRows,
    rejectedRows,
    statementRows,
    totalCredit,
    totalDebit,
    closing:
      statementRows.at(-1)?.balance ??
      openingBalance + totalCredit - totalDebit,
  };
}

export type VerificationQrInput = {
  bankName?: "KURAIMI ISLAMIC BANK" | "YEMEN COMMERCIAL BANK" | "TADHAMON BANK";
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
const qrText = (value: string | undefined) => value?.trim() || "-";
const qrNumber = (value: number | undefined) => String(value ?? 0);
/** Keep names readable while removing repeated long names from printed codes. */
export function compactPersonName(value: string | undefined) {
  const words = (value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "-";
  if (words.length === 1) return words[0].slice(0, 18);
  return `${words[0].slice(0, 18)} ${words.at(-1)!.slice(0, 18)}`;
}
function compactCodeText(value: string | undefined, max = 32) {
  return qrText(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, max);
}
function bankCode(bankName: string | undefined) {
  if (bankName === "YEMEN COMMERCIAL BANK") return "YCB";
  if (bankName === "TADHAMON BANK") return "TAD";
  return "KIB";
}

const hijriMonthNames: Record<string, string> = {
  محرم: "Muharram",
  صفر: "Safar",
  "ربيع الأول": "Rabi al-Awwal",
  "ربيع الآخر": "Rabi al-Thani",
  "جمادى الأولى": "Jumada al-Awwal",
  "جمادى الآخرة": "Jumada al-Thani",
  رجب: "Rajab",
  شعبان: "Sha'ban",
  رمضان: "Ramadan",
  شوال: "Shawwal",
  "ذو القعدة": "Dhu al-Qi'dah",
  "ذو الحجة": "Dhu al-Hijjah",
};

function formatHijriForQr(value: string | undefined) {
  if (!value) return "";
  const latinDigits = value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/هـ/g, "AH");
  return Object.entries(hijriMonthNames).reduce(
    (result, [arabic, english]) => result.replace(arabic, english),
    latinDigits
  );
}

function verificationChecksum(value: string) {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).toUpperCase().slice(-8).padStart(8, "0");
}

export function buildVerificationQrPayload(input: VerificationQrInput) {
  const typeLabel = input.documentType === "status" ? "S" : "T";
  const fields = [
    `V2|B=${bankCode(input.bankName)}|D=${typeLabel}`,
    `P=${qrNumber(input.pageNumber)}/${qrNumber(input.pageCount)}`,
    `N=${compactPersonName(input.customerName)}`,
    `A=${compactCodeText(input.accountNumber, 20)}`,
    `R=${compactCodeText(input.reference, 24)}`,
    `T=${compactCodeText(input.periodStart, 10)}-${compactCodeText(input.periodEnd, 10)}`,
    `O=${qrMoney(input.openingBalance)}|L=${qrMoney(input.closing)}`,
  ];
  if (input.firstReference || input.lastReference)
    fields.push(
      `F=${compactCodeText(input.firstReference, 14)}-${compactCodeText(input.lastReference, 14)}`
    );
  if (input.documentType === "status") {
    const hijriDate = formatHijriForQr(input.issueDateHijri);
    if (hijriDate) fields.push(`H=${compactCodeText(hijriDate, 20)}`);
  }
  return fields.join("|");
}
export type TadhamonStatementQrInput = {
  customerName?: string;
  dateOfBirth?: string;
  address?: string;
  placeOfBirth?: string;
  accountNumber: string;
  branchName?: string;
  currency: string;
  statementReference: string;
  pageNumber: number;
  pageCount: number;
  periodStart?: string;
  periodEnd?: string;
};

/** Tadhamon QR: compact identity and statement locator payload; transaction details stay out for fast scanning. */
export function buildTadhamonStatementQrPayload(
  input: TadhamonStatementQrInput
) {
  return [
    "V2|B=TAD|D=T",
    `P=${input.pageNumber}/${input.pageCount}`,
    `N=${compactPersonName(input.customerName)}`,
    `A=${compactCodeText(input.accountNumber, 20)}`,
    `R=${compactCodeText(input.statementReference, 24)}`,
    `T=${compactCodeText(input.periodStart, 10)}-${compactCodeText(input.periodEnd, 10)}`,
  ].join("|");
}
export function buildVerificationBarcodePayload(
  reference: string,
  pageNumber: number,
  pageCount: number,
  bankName:
    | "KURAIMI ISLAMIC BANK"
    | "YEMEN COMMERCIAL BANK"
    | "TADHAMON BANK" = "KURAIMI ISLAMIC BANK"
) {
  const core = `V2|B=${bankCode(bankName)}|D=STMT|R=${compactCodeText(reference, 32)}|P=${pageNumber}/${pageCount}`;
  return `${core}|C=${verificationChecksum(core)}`;
}
export type YcbStatementCodeInput = {
  customerName?: string;
  passport?: string;
  address?: string;
  accountNumber: string;
  branchName?: string;
  currency: string;
  statementReference: string;
  pageNumber: number;
  pageCount: number;
  periodStart?: string;
  periodEnd?: string;
  issueDate?: string;
  firstReference?: string;
  lastReference?: string;
  transactionCount: number;
  creditCount: number;
  debitCount: number;
  totalCredit: number;
  totalDebit: number;
  openingBalance: number;
  closingBalance: number;
};

/** YCB QR: identity, customer details, balances, and the page's operations summary. */
export function buildYcbStatementQrPayload(input: YcbStatementCodeInput) {
  return [
    "V2|B=YCB|D=T",
    `P=${input.pageNumber}/${input.pageCount}`,
    `N=${compactPersonName(input.customerName)}`,
    `A=${compactCodeText(input.accountNumber, 20)}`,
    `R=${compactCodeText(input.statementReference, 24)}`,
    `T=${compactCodeText(input.periodStart, 10)}-${compactCodeText(input.periodEnd, 10)}`,
    `F=${compactCodeText(input.firstReference, 14)}-${compactCodeText(input.lastReference, 14)}`,
    `O=${qrMoney(input.openingBalance)}|L=${qrMoney(input.closingBalance)}`,
  ].join("|");
}
/** YCB linear/PDF417 barcode: compact references and page reconciliation data. */
export function buildYcbStatementBarcodePayload(input: YcbStatementCodeInput) {
  const core = [
    "V2",
    "B=YCB",
    "D=S",
    `R=${compactCodeText(input.statementReference, 24)}`,
    `P=${input.pageNumber}/${input.pageCount}`,
    `F=${compactCodeText(input.firstReference, 12)}-${compactCodeText(input.lastReference, 12)}`,
    `L=${qrMoney(input.closingBalance)}`,
  ].join("|");
  return `${core}|C=${verificationChecksum(core)}`;
}
