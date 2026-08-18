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

export function buildVerificationQrPayload(input: { reference: string; accountNumber: string; transactionCount: number; currency: string; closing: number }) {
  return `ISSUER=BAK|DOC=WEBSTAGING|REF=${input.reference}|ACCOUNT=${input.accountNumber || "PENDING"}|COUNT=${input.transactionCount}|CURRENCY=${input.currency}|CLOSING=${input.closing.toFixed(2)}`;
}
