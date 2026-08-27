/**
 * Design reference: mirror the Prototype 0.5.1 workflow and palette.
 * This web shell uses only original reference assets; it does not alter PDF templates.
 */
import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  Download,
  LoaderCircle,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { referenceAssets } from "@/lib/reference-assets";
import { trpc } from "@/lib/trpc";
import { MAX_TRANSACTIONS_PER_PAGE, renderAccountStatusPreview, renderStatementPreview } from "@/lib/documentPreview";
import { buildVerificationQrPayload, synchronizeDocumentData } from "@/lib/documentSync";
import { assemblePrintableStatementHtml, downloadDocumentPdf, openPrintWindow, selectPrintableDocument, type PrintDocumentKind } from "@/lib/printDocument";
import {
  buildImportedTransactions,
  discoverStatementHeader,
  statementFieldLabels,
  statementReferenceFromTransactions,
  reviewDescription,
  displayStatementDate,
  formatHijriDate,
  type ImportedTransaction,
  type StatementColumnMap,
} from "@/lib/statementImport";

type TabId = "account" | "transactions" | "training" | "review";
type Transaction = ImportedTransaction;

const tabs: { id: TabId; label: string }[] = [
  { id: "account", label: "Account Details" },
  { id: "transactions", label: "Transactions & Import" },
  { id: "training", label: "Account Status Statement" },
  { id: "review", label: "Review & Export" },
];

const defaultClient = {
  name: "",
  momaizNo: "",
  passport: "",
  branch: "",
  accountNumber: "",
  customerSince: "",
  dateOfBirth: "",
  accountType: "Current Account",
  currency: "USD",
  opening: "0.00",
  issueDate: "",
  issueDateHijri: "",
  printTime: "",
  correspondenceDate: "",
  periodStart: "",
  periodEnd: "",
};

function money(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function initialTab(): TabId {
  if (typeof window === "undefined") return "account";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return tabs.some((tab) => tab.id === requested) ? requested as TabId : "account";
}

function initialReviewPreview(): PrintDocumentKind | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("preview");
  return requested === "accountStatus" || requested === "accountStatement" ? requested : null;
}

function loadLocalList(key: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 300) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const stagingHealth = trpc.staging.health.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [client, setClient] = useState(defaultClient);
  const [fileName, setFileName] = useState("");
  const [referenceSource, setReferenceSource] = useState<"internal" | "excel">("internal");
  const [columnMap, setColumnMap] = useState<StatementColumnMap>({});
  const [mappedFields, setMappedFields] = useState<Array<{ key: keyof typeof statementFieldLabels; source: string }>>([]);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appliedTransactions, setAppliedTransactions] = useState<Transaction[]>([]);
  const [registerDirty, setRegisterDirty] = useState(false);
  const [importNote, setImportNote] = useState("Choose an Excel file to analyse the statement columns before importing.");
  const [isReading, setIsReading] = useState(false);
  const [statusQrSource, setStatusQrSource] = useState("");
  const [statementQrSources, setStatementQrSources] = useState<string[]>([]);
  const [barcodeSources, setBarcodeSources] = useState<string[]>([]);
  const [descriptionMemory, setDescriptionMemory] = useState<string[]>(() => loadLocalList("bak-web-staging-descriptions"));
  const [nameMemory, setNameMemory] = useState<string[]>(() => loadLocalList("bak-web-staging-names"));
  const [reviewPreview, setReviewPreview] = useState<PrintDocumentKind | null>(initialReviewPreview);
  const [downloadingDocument, setDownloadingDocument] = useState<PrintDocumentKind | null>(null);

  const synchronizedDocuments = useMemo(() => synchronizeDocumentData(appliedTransactions, money(client.opening)), [appliedTransactions, client.opening]);
  const { acceptedRows, rejectedRows, statementRows, totalCredit, totalDebit, closing } = synchronizedDocuments;
  const draftRejectedRows = useMemo(() => transactions.filter((item) => item.rejected), [transactions]);
  const internalStatementReference = useMemo(() => statementReferenceFromTransactions(appliedTransactions, client.accountNumber || client.momaizNo), [appliedTransactions, client.accountNumber, client.momaizNo]);
  const excelStatementReference = useMemo(() => appliedTransactions.map((transaction) => transaction.externalReference).find(Boolean) || "", [appliedTransactions]);
  const statementReference = referenceSource === "excel" && excelStatementReference ? excelStatementReference : internalStatementReference;
  const visibleMappedFields = useMemo(() => mappedFields.filter((field) => referenceSource === "excel" || field.key !== "reference"), [mappedFields, referenceSource]);
  const firstTransactionDate = acceptedRows.find((transaction) => transaction.date)?.date || "";
  const lastTransactionDate = [...acceptedRows].reverse().find((transaction) => transaction.date)?.date || "";
  const issueDate = client.issueDate || lastTransactionDate || firstTransactionDate || "PENDING";
  const periodStart = client.periodStart || firstTransactionDate || "PENDING";
  const periodEnd = client.periodEnd || lastTransactionDate || issueDate;
  const documentIssueDate = displayStatementDate(issueDate);
  const documentPeriodStart = displayStatementDate(periodStart);
  const documentPeriodEnd = displayStatementDate(periodEnd);
  const statementPageCount = Math.max(1, Math.ceil(acceptedRows.length / MAX_TRANSACTIONS_PER_PAGE));
  const statementPageGroups = useMemo(() => Array.from({ length: statementPageCount }, (_, pageIndex) => statementRows.slice(pageIndex * MAX_TRANSACTIONS_PER_PAGE, (pageIndex + 1) * MAX_TRANSACTIONS_PER_PAGE)), [statementPageCount, statementRows]);
  const statementPageSummaries = useMemo(() => statementPageGroups.map((rows, pageIndex) => {
    const previousRow = pageIndex > 0 ? statementPageGroups[pageIndex - 1]?.at(-1) : undefined;
    return {
      debitCount: rows.filter((row) => row.debit > 0).length,
      creditCount: rows.filter((row) => row.credit > 0).length,
      totalDebit: rows.reduce((sum, row) => sum + row.debit, 0),
      totalCredit: rows.reduce((sum, row) => sum + row.credit, 0),
      openingBalance: previousRow?.balance ?? money(client.opening),
      closingBalance: rows.at(-1)?.balance ?? previousRow?.balance ?? money(client.opening),
      firstReference: rows.at(0)?.operationNumber || "",
      lastReference: rows.at(-1)?.operationNumber || "",
    };
  }), [client.opening, statementPageGroups]);
  const accountStatusHtml = useMemo(() => renderAccountStatusPreview({
    backgroundUri: referenceAssets.statementBackground,
    qrUri: statusQrSource || referenceAssets.qrLogo,
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: client.name,
    momaizNo: client.momaizNo,
    passport: client.passport,
    dateOfBirth: displayStatementDate(client.dateOfBirth),
    customerSince: displayStatementDate(client.customerSince),
    accountType: client.accountType,
    accountNumber: client.accountNumber,
    branchName: client.branch,
    currency: client.currency,
    opening: money(client.opening),
    credit: totalCredit,
    debit: totalDebit,
    closing,
    issueDate: documentIssueDate,
    issueDateHijri: formatHijriDate(issueDate),
    printTime: client.printTime,
    correspondenceDate: displayStatementDate(client.correspondenceDate),
    enclosurePages: statementPageCount,
    referenceNo: statementReference,
  }), [client, closing, documentIssueDate, statusQrSource, statementPageCount, statementReference, totalCredit, totalDebit]);
  const statementPageHtml = useMemo(() => Array.from({ length: statementPageCount }, (_, pageIndex) => renderStatementPreview({
    headerUri: referenceAssets.headerStrip,
    qrUri: statementQrSources[pageIndex] || referenceAssets.qrLogo,
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: client.name,
    accountNumber: client.accountNumber,
    momaizNo: client.momaizNo,
    branchName: client.branch,
    currency: client.currency,
    issueDate: documentIssueDate,
    periodStart: documentPeriodStart,
    periodEnd: documentPeriodEnd,
    statementReference,
    pageNumber: pageIndex + 1,
    pageCount: statementPageCount,
    barcodeUri: barcodeSources[pageIndex] || "",
    barcodeLabel: `REF P${pageIndex + 1} of ${statementPageCount}`,
    closing: statementPageSummaries[pageIndex]?.closingBalance ?? closing,
    pageSummary: statementPageSummaries[pageIndex],
    transactions: statementPageGroups[pageIndex].map((row) => ({ date: displayStatementDate(row.date), description: row.description, operationNumber: row.operationNumber, debit: row.debit, credit: row.credit, balance: row.balance })),
  })), [barcodeSources, client, closing, documentIssueDate, documentPeriodEnd, documentPeriodStart, statementPageCount, statementPageGroups, statementPageSummaries, statementQrSources, statementReference]);

  useEffect(() => {
    const firstSummary = statementPageSummaries[0];
    const statusPayload = buildVerificationQrPayload({ documentType: "status", reference: statementReference, accountNumber: client.accountNumber, customerName: client.name, pageNumber: 1, pageCount: 1, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: firstSummary?.firstReference, lastReference: statementPageSummaries.at(-1)?.lastReference, transactionCount: acceptedRows.length, debitCount: acceptedRows.filter((row) => row.debit > 0).length, creditCount: acceptedRows.filter((row) => row.credit > 0).length, totalDebit, totalCredit, openingBalance: money(client.opening), currency: client.currency, closing, issueDate: documentIssueDate, issueDateHijri: formatHijriDate(issueDate) });
    QRCode.toDataURL(statusPayload, { width: 260, margin: 4, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } })
      .then(setStatusQrSource)
      .catch(() => setStatusQrSource(""));
  }, [acceptedRows, client.accountNumber, client.currency, client.name, client.opening, closing, documentIssueDate, documentPeriodEnd, documentPeriodStart, issueDate, statementPageSummaries, statementReference, totalCredit, totalDebit]);

  useEffect(() => {
    Promise.all(statementPageSummaries.map((summary, pageIndex) => QRCode.toDataURL(buildVerificationQrPayload({ documentType: "statement", reference: statementReference, accountNumber: client.accountNumber, customerName: client.name, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: summary.firstReference, lastReference: summary.lastReference, transactionCount: statementPageGroups[pageIndex].length, debitCount: summary.debitCount, creditCount: summary.creditCount, totalDebit: summary.totalDebit, totalCredit: summary.totalCredit, openingBalance: summary.openingBalance, currency: client.currency, closing: summary.closingBalance, issueDate: documentIssueDate }), { width: 240, margin: 4, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } }))).then(setStatementQrSources).catch(() => setStatementQrSources([]));
  }, [client.accountNumber, client.currency, client.name, documentIssueDate, documentPeriodEnd, documentPeriodStart, issueDate, statementPageCount, statementPageGroups, statementPageSummaries, statementReference]);

  useEffect(() => {
    const values = Array.from({ length: statementPageCount }, (_, pageIndex) => `BAK ${statementReference} P${pageIndex + 1} OF ${statementPageCount}`);
    const generated = values.map((value) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, value, { format: "CODE128", width: 1, height: 24, displayValue: false, margin: 0, lineColor: "#6b5297", background: "#ffffff" });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
    });
    setBarcodeSources(generated);
  }, [statementPageCount, statementReference]);

  const updateClient = (key: keyof typeof defaultClient, value: string) => {
    setClient((current) => ({ ...current, [key]: value }));
  };

  const applySuggestedDescription = (operationNumber: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => transaction.operationNumber === operationNumber && transaction.suggestedDescription
      ? { ...transaction, description: transaction.suggestedDescription, suggestedDescription: undefined }
      : transaction));
  };

  const buildTransactions = (rows: unknown[][], map: StatementColumnMap) => {
    const nextRows = buildImportedTransactions(rows, map);
    setTransactions(nextRows);
    setAppliedTransactions(nextRows);
    setRegisterDirty(false);
    const acceptedDescriptions = nextRows.filter((item) => !item.rejected && item.description).map((item) => item.description);
    const extractedNames = nextRows.map((item) => item.personName).filter((item): item is string => Boolean(item));
    setDescriptionMemory((current) => {
      const next = Array.from(new Set([...acceptedDescriptions, ...current])).slice(0, 300);
      localStorage.setItem("bak-web-staging-descriptions", JSON.stringify(next));
      return next;
    });
    setNameMemory((current) => {
      const next = Array.from(new Set([...extractedNames, ...current])).slice(0, 220);
      localStorage.setItem("bak-web-staging-names", JSON.stringify(next));
      return next;
    });
    setImportNote(`${nextRows.length} rows analysed: ${nextRows.filter((item) => !item.rejected).length} ready for review and ${nextRows.filter((item) => item.rejected).length} rejected.`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileInput = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
      const discovery = discoverStatementHeader(matrix);
      if (!discovery) {
        setImportNote("No valid statement header was found. Required: Date, Description, and either Debit/Credit or Amount/Transaction Type. No random columns were imported.");
        setMappedFields([]);
        setTransactions([]);
        setAppliedTransactions([]);
        setRegisterDirty(false);
        return;
      }
      const nextRows = matrix.slice(discovery.headerRowIndex + 1);
      setColumnMap(discovery.map);
      setMappedFields(discovery.mappedFields);
      setRawRows(nextRows);
      buildTransactions(nextRows, discovery.map);
      setActiveTab("transactions");
    } catch {
      setImportNote("The Excel file could not be read. Please use a supported XLSX or XLS file.");
    } finally {
      setIsReading(false);
      fileInput.value = "";
    }
  };

  const downloadSessionJson = () => {
    const payload = { client, importedAt: new Date().toISOString(), acceptedRows, rejectedRows };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bank-karimi-web-staging-session.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateTransaction = (operationNumber: string, field: "date" | "description" | "externalReference" | "debit" | "credit" | "balance", input: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => {
      if (transaction.operationNumber !== operationNumber) return transaction;
      if (field === "description") {
        const review = reviewDescription(input);
        return { ...transaction, description: review.description, rejected: !review.accepted, rejectionReason: review.reason, personName: review.personName, suggestedDescription: review.suggestedDescription };
      }
      if (field === "date" || field === "externalReference") return { ...transaction, [field]: input };
      if (field === "balance") return { ...transaction, balance: input.trim() === "" ? null : money(input) };
      return { ...transaction, [field]: money(input) };
    }));
  };

  const applyTransactionRegister = () => {
    setAppliedTransactions(transactions);
    setRegisterDirty(false);
    setImportNote(`Register changes applied. ${transactions.filter((item) => !item.rejected).length} accepted transaction(s) now drive the documents, QR code, and print output.`);
  };

  const printableStatementHtml = useMemo(() => assemblePrintableStatementHtml(statementPageHtml), [statementPageHtml]);

  const printDocument = (kind: PrintDocumentKind) => {
    const selected = selectPrintableDocument(kind, accountStatusHtml, printableStatementHtml);
    if (!openPrintWindow(selected.html, selected.title)) {
      setImportNote("The browser blocked the print window. Please allow pop-ups for this site and try again.");
    }
  };

  const downloadPdf = async (kind: PrintDocumentKind) => {
    const selected = selectPrintableDocument(kind, accountStatusHtml, printableStatementHtml);
    setDownloadingDocument(kind);
    try {
      const opened = await downloadDocumentPdf(kind, selected.html);
      setImportNote(opened ? `${selected.title} print dialog opened. Choose Save as PDF to create the file.` : "The PDF print window could not be opened. Please allow pop-ups for this site and try again.");
    } catch (error) {
      console.error("Direct PDF generation failed", error);
      setImportNote("The PDF could not be created. Please try again after confirming the preview is fully visible.");
    } finally {
      setDownloadingDocument(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <img src={referenceAssets.logo} className="reference-logo" alt="Prototype 0.5.1 reference logo" />
          <div>
            <p className="eyebrow">Separate web edition for internal review</p>
            <h1>Account Statement System</h1>
            <p className="bank-name">Bank Al Karimi</p>
          </div>
        </div>
        <div className="reference-badge"><ShieldCheck size={17} /> Prototype 0.5.1 design reference preserved</div>
      </header>

      <section className="reference-strip" aria-label="Staging status">
        <div><span>Work mode</span><strong>Web Staging</strong></div>
        <div><span>Staging database</span><strong>{stagingHealth.isLoading ? "Checking…" : stagingHealth.data ? `${stagingHealth.data.tableCount} tables ready` : "Unavailable"}</strong></div>
        <div><span>Reference documents</span><strong>No visual changes</strong></div>
      </section>

      <nav className="ui-tabs" aria-label="System sections">
        {tabs.map((tab) => (
          <button key={tab.id} className={`ui-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "account" && <>
        <section className="panel">
          <h2>Document Settings</h2>
          <div className="grid">
            <label>Bank<select value="KURAIMI" disabled><option>Bank Al Karimi</option></select></label>
            <label>Document language<select value="en" disabled><option value="en">English</option></select></label>
            <label>Currency<select value={client.currency} onChange={(event) => updateClient("currency", event.target.value)}><option>USD</option><option>YER</option><option>SAR</option></select></label>
            <label>Reference source<select value={referenceSource} onChange={(event) => setReferenceSource(event.target.value as "internal" | "excel")}><option value="internal">Generate internal reference</option><option value="excel">Use Excel reference</option></select></label>
          </div>
        </section>
        <section className="panel">
          <h2>Customer & Account Details</h2>
          <div className="grid">
            <label>Customer name<input value={client.name} onChange={(event) => updateClient("name", event.target.value)} placeholder="Name as shown on the statement" /></label>
            <label>Momaiz No.<input dir="ltr" value={client.momaizNo} onChange={(event) => updateClient("momaizNo", event.target.value)} /></label>
            <label>Passport number <span className="field-note">Optional</span><input dir="ltr" value={client.passport} onChange={(event) => updateClient("passport", event.target.value)} /></label>
            <label className="wide">Branch name<input dir="ltr" value={client.branch} onChange={(event) => updateClient("branch", event.target.value)} placeholder="Branch Name" /></label>
            <label>Customer since<input lang="en-GB" value={client.customerSince} onChange={(event) => updateClient("customerSince", event.target.value)} placeholder="15/01/2020" /></label>
            <label>Date of birth <span className="field-note">Optional</span><input type="date" lang="en-GB" value={client.dateOfBirth} onChange={(event) => updateClient("dateOfBirth", event.target.value)} /></label>
            <label>Account type<input dir="ltr" value={client.accountType} onChange={(event) => updateClient("accountType", event.target.value)} /></label>
            <label>Account number<input dir="ltr" value={client.accountNumber} onChange={(event) => updateClient("accountNumber", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>Account Status Statement Fields</h2>
          <p className="hint">These fields appear only on the Account Status Statement. Totals and page count are calculated from the imported transaction file.</p>
          <div className="grid">
            <label>Issue date<input type="date" lang="en-GB" value={client.issueDate} onChange={(event) => updateClient("issueDate", event.target.value)} /></label>
            <label>Hijri issue date <span className="field-note">Automatic</span><input dir="rtl" value={formatHijriDate(issueDate)} readOnly placeholder="Calculated from issue date" /></label>
            <label>Print time<input type="time" lang="en-GB" value={client.printTime} onChange={(event) => updateClient("printTime", event.target.value)} /></label>
            <label>Correspondence date<input type="date" lang="en-GB" value={client.correspondenceDate} onChange={(event) => updateClient("correspondenceDate", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>Account Statement Fields</h2>
          <p className="hint">Leave the start and end dates blank to derive them from the first and last accepted Excel transaction.</p>
          <div className="grid">
            <label>Statement start date<input type="date" lang="en-GB" value={client.periodStart} onChange={(event) => updateClient("periodStart", event.target.value)} /></label>
            <label>Statement end date<input type="date" lang="en-GB" value={client.periodEnd} onChange={(event) => updateClient("periodEnd", event.target.value)} /></label>
            <div className="computed-field"><span>Statement pages</span><strong>{statementPageCount}</strong><small>Maximum 19 transactions per page.</small></div>
          </div>
        </section>
        <section className="panel">
          <h2>Financial Details</h2>
          <div className="grid">
            <label>Opening balance<input inputMode="decimal" dir="ltr" value={client.opening} onChange={(event) => updateClient("opening", event.target.value)} /></label>
            <div className="computed-field"><span>Imported total credit</span><strong>{formatMoney(totalCredit)}</strong></div>
            <div className="computed-field"><span>Imported total debit</span><strong>{formatMoney(totalDebit)}</strong></div>
            <div className="computed-field"><span>Calculated closing balance</span><strong>{formatMoney(closing)}</strong></div>
            <div className="computed-field"><span>Accepted transactions</span><strong>{acceptedRows.length}</strong></div>
            <div className="computed-field reference-field"><span>Statement reference</span><strong dir="ltr">{statementReference}</strong><small>Stable structure based on the first imported transaction date.</small></div>
          </div>
        </section>
      </>}

      {activeTab === "transactions" && <>
        <section className="panel">
          <h2>Transaction Import</h2>
          <div className="import-zone">
            <div className="import-icon"><FileSpreadsheet size={28} /></div>
            <div><strong>Import Excel file</strong><p>The system identifies statement columns, then classifies rows for review within this Staging session.</p></div>
            <label className="upload-button">{isReading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />} Choose Excel<input type="file" accept=".xlsx,.xls" onChange={handleFile} /></label>
          </div>
          <p className="hint" aria-live="polite">{fileName ? `Selected file: ${fileName} — ` : ""}{importNote}</p>
        </section>
        {mappedFields.length > 0 && <section className="panel import-summary-panel">
          <h2>Detected Statement Columns</h2>
          <p className="hint">Only fields detected from the file are shown. The system does not create One, Two, or Three columns and does not invent headings from transaction rows.</p>
          <div className="mapped-fields">{visibleMappedFields.map((field) => <div className="mapped-field" key={field.key}><span>{statementFieldLabels[field.key]}</span><strong dir="ltr">{field.source}</strong></div>)}</div>
        </section>}
        <section className="panel workflow-panel">
          <h2>Workflow</h2>
          <ol className="workflow-steps"><li>Choose an Excel file.</li><li>Review the detected columns.</li><li>Review accepted and rejected rows.</li><li>Open the document preview and export options.</li></ol>
        </section>
        {transactions.length > 0 && <section className="panel preview-panel">
          <div className="panel-heading"><div><h2>Editable Transaction Register</h2><p className="hint">Edit the values directly, then apply the register to update the financial totals, documents, QR code, and print output together. Rejected transactions remain visible for review and are re-evaluated when the description changes.</p></div><span className="summary-chip">{transactions.filter((item) => !item.rejected).length} accepted · {draftRejectedRows.length} rejected</span></div>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th>{referenceSource === "excel" && <th>Excel Reference</th>}<th>Operation No.</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Status</th></tr></thead><tbody>
            {transactions.map((row) => <tr className={row.rejected ? "invalid-row" : ""} key={`${row.rowNumber}-${row.operationNumber}`}><td><input className="transaction-edit-input" type="date" lang="en-GB" value={row.date} onChange={(event) => updateTransaction(row.operationNumber, "date", event.target.value)} /></td><td><div className="description-cell"><input className="transaction-edit-input" value={row.description} onChange={(event) => updateTransaction(row.operationNumber, "description", event.target.value)} />{!row.rejected && row.suggestedDescription && row.suggestedDescription !== row.description && <button type="button" className="description-suggestion" onClick={() => applySuggestedDescription(row.operationNumber)}>Use suggestion: <b dir="ltr">{row.suggestedDescription}</b></button>}</div></td>{referenceSource === "excel" && <td><input className="transaction-edit-input" dir="ltr" value={row.externalReference} onChange={(event) => updateTransaction(row.operationNumber, "externalReference", event.target.value)} /></td>}<td dir="ltr">{row.operationNumber}</td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.debit || ""} onChange={(event) => updateTransaction(row.operationNumber, "debit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.credit || ""} onChange={(event) => updateTransaction(row.operationNumber, "credit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.balance ?? ""} onChange={(event) => updateTransaction(row.operationNumber, "balance", event.target.value)} /></td><td>{row.rejected ? <span className="row-alert"><AlertTriangle size={14} /> Rejected</span> : <span className="row-ok"><CheckCircle2 size={14} /> Ready for review</span>}</td></tr>)}
          </tbody></table></div>
          <div className="actions"><button type="button" onClick={applyTransactionRegister} disabled={!registerDirty}><CheckCircle2 size={17} /> {registerDirty ? "Apply Register Changes" : "Register Applied"}</button></div>
        </section>}
      </>}

      {activeTab === "training" && <section className="panel statement-preview-panel">
        <div className="panel-heading"><div><h2>Account Status Statement</h2><p className="hint">HTML preview based on the Prototype 0.5.1 reference rules without redesign.</p></div><button className="secondary-button" type="button" onClick={() => setActiveTab("review")}><ChevronLeft size={16} /> Back to review</button></div>
        <div className="document-frame-wrap"><iframe className="document-frame" title="Account Status Statement reference preview" srcDoc={accountStatusHtml} /></div>
        <div className="actions"><button type="button" onClick={() => printDocument("accountStatus")}><Printer size={17} /> Print / Save PDF</button><button type="button" className="preview-button" disabled={downloadingDocument === "accountStatus"} onClick={() => void downloadPdf("accountStatus")}><Download size={17} /> {downloadingDocument === "accountStatus" ? "Opening print…" : "Print / Save Account Status PDF"}</button></div>
      </section>}

      {activeTab === "review" && <section className="panel review-panel">
        <div className="panel-heading"><div><h2>Review & Export</h2><p className="hint">Review inputs before printing one document at a time.</p></div><FileText size={26} className="heading-icon" /></div>
          <div className="review-grid"><div className="validation-card"><span>Customer status</span><strong>{client.name && client.momaizNo ? "Ready for review" : "Customer details required"}</strong><small>Customer name and Momaiz No. are required on the statement.</small></div><div className="validation-card"><span>Transaction status</span><strong>{acceptedRows.length ? `${acceptedRows.length} accepted transactions` : "No transactions imported"}</strong><small>{rejectedRows.length ? `${rejectedRows.length} rejected rows remain visible for review.` : "No rejected rows currently."}</small></div><div className="validation-card"><span>Page limit</span><strong>19 transactions per page</strong><small>Current estimate: {Math.max(1, Math.ceil(acceptedRows.length / MAX_TRANSACTIONS_PER_PAGE))} statement page(s).</small></div><div className="validation-card"><span>Local browser memory</span><strong>{descriptionMemory.length} descriptions · {nameMemory.length} names</strong><small>Stored in this browser only and not sent to another service.</small></div></div>
        <div className="actions document-actions"><button type="button" onClick={() => setReviewPreview("accountStatus")}><FileText size={17} /> View Account Status Statement</button><button type="button" className="preview-button" onClick={() => setReviewPreview("accountStatement")}><FileText size={17} /> View Account Statement</button><button type="button" onClick={() => printDocument("accountStatus")}><Printer size={17} /> Print Account Status / Save PDF</button><button type="button" className="preview-button" onClick={() => printDocument("accountStatement")}><Printer size={17} /> Print Account Statement / Save PDF</button><button type="button" disabled={downloadingDocument === "accountStatus"} onClick={() => void downloadPdf("accountStatus")}><Download size={17} /> {downloadingDocument === "accountStatus" ? "Opening print…" : "Print / Save Account Status PDF"}</button><button type="button" className="preview-button" disabled={downloadingDocument === "accountStatement"} onClick={() => void downloadPdf("accountStatement")}><Download size={17} /> {downloadingDocument === "accountStatement" ? "Opening print…" : "Print / Save Account Statement PDF"}</button><button type="button" className="secondary-button" onClick={downloadSessionJson}><RefreshCcw size={17} /> Download JSON Session</button></div>
        {reviewPreview && <section className="print-preview-panel" aria-label="Document preview before print"><div className="panel-heading"><div><h2>{reviewPreview === "accountStatus" ? "Account Status Statement Preview" : "Account Statement Preview"}</h2><p className="hint">Review the original artwork, QR code, values, and page arrangement before printing or downloading.</p></div><button type="button" className="secondary-button" onClick={() => setReviewPreview(null)}>Close Preview</button></div><div className="document-frame-wrap"><iframe className="document-frame" title={reviewPreview === "accountStatus" ? "Account Status Statement print preview" : "Account Statement print preview"} srcDoc={reviewPreview === "accountStatus" ? accountStatusHtml : printableStatementHtml} /></div></section>}
      </section>}

      <footer className="app-footer"><img src={referenceAssets.footerStrip} alt="Original footer reference"/><span>Independent Web Staging edition — Prototype 0.5.1 reference remains unchanged.</span></footer>
    </div>
  );
}
