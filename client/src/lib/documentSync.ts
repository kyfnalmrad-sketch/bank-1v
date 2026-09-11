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
  bankName?: "KURAIMI ISLAMIC BANK" | "YEMEN COMMERCIAL BANK";
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
const qrText = (value: string | undefined) => value?.trim() || "N/A";
const qrNumber = (value: number | undefined) => String(value ?? 0);

const hijriMonthNames: Record<string, string> = {
  "محرم": "Muharram",
  "صفر": "Safar",
  "ربيع الأول": "Rabi al-Awwal",
  "ربيع الآخر": "Rabi al-Thani",
  "جمادى الأولى": "Jumada al-Awwal",
  "جمادى الآخرة": "Jumada al-Thani",
  "رجب": "Rajab",
  "شعبان": "Sha'ban",
  "رمضان": "Ramadan",
  "شوال": "Shawwal",
  "ذو القعدة": "Dhu al-Qi'dah",
  "ذو الحجة": "Dhu al-Hijjah",
};

function formatHijriForQr(value: string | undefined) {
  if (!value) return "";
  const latinDigits = value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/هـ/g, "AH");
  return Object.entries(hijriMonthNames).reduce((result, [arabic, english]) => result.replace(arabic, english), latinDigits);
}

function verificationChecksum(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).toUpperCase().slice(-8).padStart(8, "0");
}

export function buildVerificationQrPayload(input: VerificationQrInput) {
  const typeLabel = input.documentType === "status" ? "ACCOUNT STATUS" : "ACCOUNT STATEMENT";
  const lines = [
    input.bankName || "KURAIMI ISLAMIC BANK",
    `TYPE=${typeLabel}`,
    `PAGE=${qrNumber(input.pageNumber)}/${qrNumber(input.pageCount)}`,
    `CLIENT=${qrText(input.customerName)}`,
    `ACCT=${qrText(input.accountNumber)}`,
    `PERIOD=${qrText(input.periodStart)}-${qrText(input.periodEnd)}`,
    `DATE=${qrText(input.issueDate)}`,
    `CUR=${qrText(input.currency)}`,
    `REF1=${qrText(input.firstReference)}`,
    `REFN=${qrText(input.lastReference)}`,
    `TX=${qrNumber(input.transactionCount)}`,
    `DEBIT=${qrNumber(input.debitCount)};${qrMoney(input.totalDebit)}`,
    `CREDIT=${qrNumber(input.creditCount)};${qrMoney(input.totalCredit)}`,
    `OPEN=${qrMoney(input.openingBalance)}`,
    `CLOSE=${qrMoney(input.closing)}`,
    `VERIFY=${qrText(input.reference)}`,
  ];
  const hijriDate = formatHijriForQr(input.issueDateHijri);
  if (hijriDate) lines.splice(7, 0, `HIJRI=${hijriDate}`);
  return lines.join("\n");
}

export function buildVerificationBarcodePayload(reference: string, pageNumber: number, pageCount: number, bankName: "KURAIMI ISLAMIC BANK" | "YEMEN COMMERCIAL BANK" = "KURAIMI ISLAMIC BANK") {
  const normalizedReference = qrText(reference).replace(/\s+/g, "-");
  const core = `${bankName}|VERIFY|STMT|REF=${normalizedReference}|PAGE=${pageNumber}/${pageCount}`;
  return `${core}|CHK=${verificationChecksum(core)}`;
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
    "YCB|YEMEN COMMERCIAL BANK",
    "DOC=STMT",
    `P=${input.pageNumber}/${input.pageCount}`,
    `N=${qrText(input.customerName)}`,
    `PP=${qrText(input.passport)}`,
    `A=${qrText(input.address)}`,
    `B=${qrText(input.branchName)}`,
    `AC=${qrText(input.accountNumber)}`,
    `C=${qrText(input.currency)}`,
    `T=${qrText(input.periodStart)}-${qrText(input.periodEnd)}`,
    `D=${qrText(input.issueDate)}`,
    `R1=${qrText(input.firstReference)}`,
    `RN=${qrText(input.lastReference)}`,
    `O=${qrNumber(input.transactionCount)}`,
    `CR=${qrNumber(input.creditCount)};${qrMoney(input.totalCredit)}`,
    `DR=${qrNumber(input.debitCount)};${qrMoney(input.totalDebit)}`,
    `OP=${qrMoney(input.openingBalance)}`,
    `CL=${qrMoney(input.closingBalance)}`,
    `REF=${qrText(input.statementReference)}`,
  ].join("\n");
}

/** YCB linear/PDF417 barcode: compact references and page reconciliation data. */
export function buildYcbStatementBarcodePayload(input: YcbStatementCodeInput) {
  const core = [
    "YCB",
    "STMT",
    `DOC=${qrText(input.statementReference).replace(/\s+/g, "-")}`,
    `PAGE=${input.pageNumber}/${input.pageCount}`,
    `REF1=${qrText(input.firstReference).replace(/\s+/g, "-")}`,
    `REFN=${qrText(input.lastReference).replace(/\s+/g, "-")}`,
    `OPS=${input.transactionCount}`,
    `OPEN=${qrMoney(input.openingBalance)}`,
    `CLOSE=${qrMoney(input.closingBalance)}`,
  ].join("|");
  return `${core}|CHK=${verificationChecksum(core)}`;
}
