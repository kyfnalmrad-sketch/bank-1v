/**
 * Design reference: mirror the Prototype 0.5.1 workflow and palette.
 * This web shell uses only original reference assets; it does not alter PDF templates.
 */
import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import bwipjs from "bwip-js/browser";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  Download,
  Database,
  FolderOpen,
  LoaderCircle,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
  LockKeyhole,
  LogIn,
  LogOut,
  Shield,
  LayoutDashboard,
  BarChart3,
  PieChart,
  Users,
  Settings,
  ClipboardList,
  Building2,
  CreditCard,
  Receipt,
  HelpCircle,
} from "lucide-react";
import { referenceAssets } from "@/lib/reference-assets";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BankSelector, renderYcbCertificateHtml, YcbCertificateWorkspace } from "@/components/YcbCertificateWorkspace";
import { renderYcbStatementPages } from "@/components/YcbStatementWorkspace";
import { renderTadhamonStatementPages } from "@/lib/tadhamonOriginalStatementTemplate";
import type { YcbStatementProfile, YcbStatementTransaction } from "@/lib/ycbStatementPreview";
import { MAX_TRANSACTIONS_PER_PAGE, renderAccountStatusPreview, renderStatementPreview } from "@/lib/documentPreview";
import { buildVerificationBarcodePayload, buildVerificationQrPayload, buildTadhamonStatementQrPayload, buildYcbStatementBarcodePayload, buildYcbStatementQrPayload, synchronizeDocumentData } from "@/lib/documentSync";
import { assemblePrintableStatementHtml, downloadDocumentPdf, openPrintWindow, preloadPrintAssets, selectPrintableDocument, type PrintDocumentKind } from "@/lib/printDocument";
import {
  buildImportedTransactions,
  discoverStatementHeader,
  statementFieldLabels,
  statementReferenceFromTransactions,
  reviewDescription,
  displayStatementDate,
  formatHijriDate,
  formatEnglishGregorianDate,
  type ImportedTransaction,
  type StatementColumnMap,
} from "@/lib/statementImport";

type TabId = "dashboard" | "account" | "transactions" | "review" | "history" | "analytics";
type DateOfBirthPlacement = "none" | "status" | "statement" | "both";
type Transaction = ImportedTransaction;
type SnapshotPayload = {
  schemaVersion: 1;
  bankId: "karimi" | "ycb" | "tadhamon";
  client: typeof defaultClient;
  referenceSource: "internal" | "excel";
  includeBranch: boolean;
  fileName: string;
  columnMap: StatementColumnMap;
  mappedFields: Array<{ key: keyof typeof statementFieldLabels; source: string }>;
  transactions: Transaction[];
  appliedTransactions: Transaction[];
  totalCreditOverride: string;
  totalDebitOverride: string;
  ycbClient?: typeof defaultYcbClient;
  dateOfBirthPlacement: DateOfBirthPlacement;
};
type HistoryItem = { id: number; title: string; statement_reference: string | null; customer_name: string | null; account_number: string | null; created_at: string; updated_at: string };

const snapshotWorkspaceStorageKey = "bak-web-staging-workspace-key";

function getWorkspaceKey() {
  if (typeof window === "undefined") return "server-preview-workspace";
  const existing = window.localStorage.getItem(snapshotWorkspaceStorageKey);
  if (existing) return existing;
  const generated = window.crypto?.randomUUID?.() || `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(snapshotWorkspaceStorageKey, generated);
  return generated;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "لوحة التحكم / Dashboard" },
  { id: "account", label: "الإدخال / Data Entry" },
  { id: "transactions", label: "استيراد Excel / Excel Import" },
  { id: "review", label: "المعاينة والطباعة / Preview & Print" },
  { id: "history", label: "السجلات / Records" },
  { id: "analytics", label: "المؤشرات / Analytics" },
];

const defaultClient = {
  name: "",
  momaizNo: "",
  passport: "",
  branch: "",
  accountNumber: "",
  customerSince: "",
  dateOfBirth: "",
  address: "",
  placeOfBirth: "",
  accountType: "Current Account",
  currency: "USD",
  opening: "0.00",
  issueDate: "",
  issueDateHijri: "",
  printTime: "",
  correspondenceDate: "",
  periodStart: "",
  periodEnd: "",
  employeeName: "",
  managerName: "",
};

const defaultYcbClient = {
  name: "Ahmed Mohammed Al-Qahtani",
  address: "Sana’a — Bab Al-Yemen",
  passport: "",
  branch: "Sana’a Main Branch",
  customerSince: "15/01/2020",
  dateOfBirth: "",
  accountNumber: "YCB-0045827319",
  accountType: "Current Account",
  currency: "YER",
  opening: "1250000",
  issueDate: "08 September 2026",
  referenceNumber: "YCB-DEMO-2026-091",
  customerServiceName: "Sarah Abdullah Al-Maqtari",
  branchManagerName: "Khaled Ali Al-Hadrami",
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

function clearSessionToken() {
  try {
    sessionStorage.removeItem("manus-cookie");
  } catch {}
}

function LoginScreen({ login, pending, error }: { login: (password: string) => Promise<unknown>; pending: boolean; error: unknown }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const submit = async () => {
    if (!password) { setMessage("أدخل كلمة المرور للمتابعة."); return; }
    setMessage("");
    try {
      const result = await login(password) as { authenticated?: boolean };
      if (!result.authenticated) setMessage("كلمة المرور غير صحيحة.");
    } catch { setMessage("تعذر تسجيل الدخول الآن. حاول مرة أخرى."); }
  };
  return <main className="login-shell" dir="rtl">
    <div className="login-glow login-glow-one" />
    <div className="login-glow login-glow-two" />
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><div className="login-mark"><Shield size={24} /></div><div><strong>نظام إصدار كشفي</strong><span>منصة إصدار ومراجعة الكشوف</span></div></div>
      <div className="login-divider" />
      <p className="login-kicker">دخول آمن للموظفين</p>
      <h1 id="login-title">مرحبًا بك من جديد</h1>
      <p className="login-copy">أدخل كلمة المرور للوصول إلى مساحة إصدار الكشوف وإدارتها بأمان.</p>
      <label className="login-password-label" htmlFor="site-password">كلمة المرور</label>
      <input id="site-password" className="login-password-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} autoComplete="current-password" />
      <button className="login-button" type="button" onClick={() => void submit()} disabled={pending}><LogIn size={19} /> {pending ? "جارٍ التحقق…" : "دخول إلى النظام"}</button>
      {Boolean(message || error) && <p className="login-error" role="alert">{message || "تعذر تسجيل الدخول."}</p>}
      <div className="login-security"><LockKeyhole size={16} /><span>اتصال محمي</span><span className="login-dot" /> <span>الجلسة تنتهي تلقائيًا بعد 6 ساعات</span></div>
      <p className="login-footnote">الوصول مخصص للمستخدمين المصرح لهم فقط.</p>
    </section>
  </main>;
}

export default function Home() {
  const { user, loading, logout, login, loginPending, loginError } = useAuth();
  useEffect(() => {
    if (!user && !loading) clearSessionToken();
  }, [loading, user]);

  if (loading) return <main className="login-shell"><div className="login-loading"><Shield size={24} className="spin" /> جارٍ التحقق من الجلسة…</div></main>;
  if (!user) return <LoginScreen login={login} pending={loginPending} error={loginError} />;

  return <AuthenticatedHome user={user} logout={logout} />;
}

function AuthenticatedHome({ user, logout }: { user: { name?: string | null; email?: string | null }; logout: () => Promise<void> }) {
  useEffect(() => {
    void preloadPrintAssets([
      referenceAssets.statementBackground,
      referenceAssets.headerStrip,
      referenceAssets.footerStrip,
      referenceAssets.centralLogo,
      referenceAssets.qrLogo,
      referenceAssets.qrBrandLogo,
    ]);
  }, []);
  const handleSecureLogout = async () => { clearSessionToken(); await logout(); };
  const stagingHealth = trpc.staging.health.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [selectedBank, setSelectedBank] = useState<"karimi" | "ycb" | "tadhamon" | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("bak-web-staging-selected-bank");
    return saved === "karimi" || saved === "ycb" || saved === "tadhamon" ? saved : null;
  });
  const [ycbClient, setYcbClient] = useState(defaultYcbClient);
  const [showYcbCertificate, setShowYcbCertificate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [client, setClient] = useState(defaultClient);
  const [fileName, setFileName] = useState("");
  const [referenceSource, setReferenceSource] = useState<"internal" | "excel">("internal");
  const [includeBranch, setIncludeBranch] = useState(false);
  const [dateOfBirthPlacement, setDateOfBirthPlacement] = useState<DateOfBirthPlacement>("both");
  const [columnMap, setColumnMap] = useState<StatementColumnMap>({});
  const [mappedFields, setMappedFields] = useState<Array<{ key: keyof typeof statementFieldLabels; source: string }>>([]);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appliedTransactions, setAppliedTransactions] = useState<Transaction[]>([]);
  const [totalCreditOverride, setTotalCreditOverride] = useState("");
  const [totalDebitOverride, setTotalDebitOverride] = useState("");
  const [registerDirty, setRegisterDirty] = useState(false);
  const [importNote, setImportNote] = useState("Choose an Excel file to analyse the statement columns before importing.");
  const [isReading, setIsReading] = useState(false);
  const [statusQrSource, setStatusQrSource] = useState("");
  const [statementQrSources, setStatementQrSources] = useState<string[]>([]);
  const [barcodeSources, setBarcodeSources] = useState<string[]>([]);
  const localMemoryPrefix = selectedBank === "ycb" ? "bak-web-staging-ycb" : selectedBank === "tadhamon" ? "bak-web-staging-tadhamon" : "bak-web-staging-karimi";
  const [descriptionMemory, setDescriptionMemory] = useState<string[]>(() => loadLocalList(`${localMemoryPrefix}-descriptions`));
  const [nameMemory, setNameMemory] = useState<string[]>(() => loadLocalList(`${localMemoryPrefix}-names`));
  useEffect(() => {
    setDescriptionMemory(loadLocalList(`${localMemoryPrefix}-descriptions`));
    setNameMemory(loadLocalList(`${localMemoryPrefix}-names`));
  }, [localMemoryPrefix]);
  const [reviewPreview, setReviewPreview] = useState<PrintDocumentKind | null>(initialReviewPreview);
  const [downloadingDocument, setDownloadingDocument] = useState<PrintDocumentKind | null>(null);
  const workspaceKey = useMemo(() => `${getWorkspaceKey()}-${selectedBank || "selector"}`, [selectedBank]);
  const [snapshotState, setSnapshotState] = useState<"loading" | "restored" | "saved" | "error">("loading");
  const snapshotRestored = useRef(false);
  const snapshotQuery = trpc.staging.loadSnapshot.useQuery({ workspaceKey }, { retry: false, refetchOnWindowFocus: false });
  const saveSnapshotMutation = trpc.staging.saveSnapshot.useMutation();
  const historyQuery = trpc.staging.listHistory?.useQuery({ workspaceKey }, { retry: false, refetchOnWindowFocus: false }) || { data: [], isLoading: false, refetch: async () => ({}) };
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const getHistoryQuery = trpc.staging.getHistory?.useQuery({ id: selectedHistoryId || 1, workspaceKey }, { enabled: selectedHistoryId !== null, retry: false }) || { data: null };
  const createHistoryMutation = trpc.staging.createHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ saved: false }) };
  const updateHistoryMutation = trpc.staging.updateHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ saved: false }) };
  const deleteHistoryMutation = trpc.staging.deleteHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ deleted: false }) };
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);

  const synchronizedDocuments = useMemo(() => synchronizeDocumentData(appliedTransactions, money(client.opening)), [appliedTransactions, client.opening]);
  const { acceptedRows, rejectedRows, statementRows, totalCredit, totalDebit, closing } = synchronizedDocuments;
  const reportedTotalCredit = totalCreditOverride.trim() === "" ? totalCredit : money(totalCreditOverride);
  const reportedTotalDebit = totalDebitOverride.trim() === "" ? totalDebit : money(totalDebitOverride);
  const hasTotalsOverride = totalCreditOverride.trim() !== "" || totalDebitOverride.trim() !== "";
  const reportedClosing = hasTotalsOverride ? money(client.opening) + reportedTotalCredit - reportedTotalDebit : closing;
  const draftRejectedRows = useMemo(() => transactions.filter((item) => item.rejected), [transactions]);
  const uniquePeopleCount = useMemo(() => new Set(acceptedRows.map((row) => row.personName || row.description.trim()).filter(Boolean)).size, [acceptedRows]);
  const duplicatePeopleCount = Math.max(0, acceptedRows.length - uniquePeopleCount);
  const customerQualityRate = acceptedRows.length ? Math.round((uniquePeopleCount / acceptedRows.length) * 100) : 0;
  const duplicateRate = acceptedRows.length ? Math.round((duplicatePeopleCount / acceptedRows.length) * 100) : 0;
  const operationBars = useMemo(() => {
    const counts = new Map<string, number>();
    acceptedRows.forEach((row) => counts.set(row.date || "N/A", (counts.get(row.date || "N/A") || 0) + 1));
    return Array.from(counts.entries()).slice(-14);
  }, [acceptedRows]);
  const tabWarnings = [
    !client.name || (selectedBank === "ycb" ? !client.accountNumber : !client.momaizNo) ? "بيانات العميل ناقصة / Customer details are incomplete" : "",
    acceptedRows.length === 0 ? "لم يتم اعتماد عمليات / No accepted transactions" : "",
    rejectedRows.length > 0 ? `${rejectedRows.length} صفوف تحتاج مراجعة / rows need review` : "",
  ].filter(Boolean);
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
  const ycbStatementProfile = useMemo<YcbStatementProfile>(() => ({
    customerName: client.name,
    passport: client.passport,
    address: ycbClient.address,
    dateOfBirth: dateOfBirthPlacement === "statement" || dateOfBirthPlacement === "both" ? ycbClient.dateOfBirth : "",
    branchName: client.branch,
    accountNumber: client.accountNumber,
    accountType: client.accountType,
    currency: client.currency,
    periodStart: documentPeriodStart,
    periodEnd: documentPeriodEnd,
    statementReference,
    openingBalance: money(client.opening),
    closingBalance: reportedClosing,
    totalCredit: reportedTotalCredit,
    totalDebit: reportedTotalDebit,
    issueDate: documentIssueDate,
  }), [client.accountNumber, client.accountType, client.branch, client.currency, client.name, client.opening, dateOfBirthPlacement, documentIssueDate, documentPeriodEnd, documentPeriodStart, reportedClosing, reportedTotalCredit, reportedTotalDebit, statementReference, ycbClient.address, ycbClient.dateOfBirth]);
  const ycbStatementTransactions = useMemo<YcbStatementTransaction[]>(() => statementRows.map((row) => ({
    date: displayStatementDate(row.date),
    reference: row.operationNumber,
    description: row.description,
    credit: row.credit,
    debit: row.debit,
    balance: row.balance,
    highlightColor: row.highlightColor,
  })), [statementRows]);
  const accountStatusHtml = useMemo(() => selectedBank === "ycb" ? renderYcbCertificateHtml(dateOfBirthPlacement === "status" || dateOfBirthPlacement === "both" ? ycbClient : { ...ycbClient, dateOfBirth: "" }) : renderAccountStatusPreview({
    backgroundUri: selectedBank === "tadhamon" ? "/assets/tadhamon/STMTDM1-official-background.png" : referenceAssets.statementBackground,
    bankName: selectedBank === "tadhamon" ? "Tadhamon Bank" : undefined,
    qrUri: statusQrSource || referenceAssets.qrLogo,
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: client.name,
    momaizNo: client.momaizNo,
    passport: client.passport,
    dateOfBirth: dateOfBirthPlacement === "status" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(client.dateOfBirth) : "",
    customerSince: formatEnglishGregorianDate(client.customerSince),
    accountType: client.accountType,
    accountNumber: client.accountNumber,
    branchName: client.branch,
    currency: client.currency,
    opening: money(client.opening),
    credit: reportedTotalCredit,
    debit: reportedTotalDebit,
    closing: reportedClosing,
    issueDate: formatEnglishGregorianDate(issueDate),
    issueDateHijri: formatHijriDate(issueDate),
    printTime: client.printTime,
    correspondenceDate: formatEnglishGregorianDate(client.correspondenceDate),
    employeeName: client.employeeName,
    managerName: client.managerName,
    enclosurePages: statementPageCount,
    referenceNo: statementReference,
  }), [client, dateOfBirthPlacement, documentIssueDate, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statusQrSource, statementPageCount, statementReference, ycbClient]);
  const snapshotPayload = useMemo<SnapshotPayload>(() => ({ schemaVersion: 1, bankId: selectedBank === "ycb" ? "ycb" : selectedBank === "tadhamon" ? "tadhamon" : "karimi", client, referenceSource, includeBranch, fileName, columnMap, mappedFields, transactions, appliedTransactions, totalCreditOverride, totalDebitOverride, dateOfBirthPlacement, ycbClient: selectedBank === "ycb" ? ycbClient : undefined }), [appliedTransactions, client, columnMap, dateOfBirthPlacement, fileName, includeBranch, mappedFields, referenceSource, selectedBank, totalCreditOverride, totalDebitOverride, transactions, ycbClient]);

  useEffect(() => {
    if (snapshotQuery.isLoading || snapshotRestored.current) return;
    const payload = snapshotQuery.data?.payload as Partial<SnapshotPayload> | undefined;
    if (payload?.bankId && payload.bankId !== selectedBank) return;
    snapshotRestored.current = true;
    if (payload?.schemaVersion !== 1 || !payload.client) {
      setSnapshotState(snapshotQuery.isError ? "error" : "restored");
      return;
    }
    const restoredClient = { ...defaultClient, ...payload.client };
    setClient(restoredClient);
    if (selectedBank === "ycb") {
      // Older YCB snapshots stored shared customer fields only in `client`.
      // Backfill the independent certificate workspace without changing Karimi data.
      if (!payload.ycbClient) {
        setYcbClient((current) => ({
          ...current,
          name: restoredClient.name,
          passport: restoredClient.passport,
          branch: restoredClient.branch,
          customerSince: restoredClient.customerSince,
          dateOfBirth: restoredClient.dateOfBirth,
          accountNumber: restoredClient.accountNumber,
          accountType: restoredClient.accountType,
          currency: restoredClient.currency,
          opening: restoredClient.opening,
          issueDate: restoredClient.issueDate,
        }));
      } else {
        setYcbClient({
          ...defaultYcbClient,
          ...payload.ycbClient,
          customerSince: payload.ycbClient.customerSince || restoredClient.customerSince,
        });
      }
    }
    setReferenceSource(payload.referenceSource === "excel" ? "excel" : "internal");
    setIncludeBranch(payload.includeBranch === true);
    setDateOfBirthPlacement(payload.dateOfBirthPlacement === "none" || payload.dateOfBirthPlacement === "status" || payload.dateOfBirthPlacement === "statement" || payload.dateOfBirthPlacement === "both" ? payload.dateOfBirthPlacement : "both");
    setFileName(typeof payload.fileName === "string" ? payload.fileName : "");
    setColumnMap(payload.columnMap && typeof payload.columnMap === "object" ? payload.columnMap : {});
    setMappedFields(Array.isArray(payload.mappedFields) ? payload.mappedFields : []);
    setTransactions(Array.isArray(payload.transactions) ? payload.transactions : []);
    setAppliedTransactions(Array.isArray(payload.appliedTransactions) ? payload.appliedTransactions : []);
    setTotalCreditOverride(typeof payload.totalCreditOverride === "string" ? payload.totalCreditOverride : "");
    setTotalDebitOverride(typeof payload.totalDebitOverride === "string" ? payload.totalDebitOverride : "");
    setSnapshotState("restored");
  }, [selectedBank, snapshotQuery.data, snapshotQuery.isError, snapshotQuery.isLoading]);

  useEffect(() => {
    if (!snapshotRestored.current || snapshotState === "loading") return;
    const timer = window.setTimeout(() => {
      saveSnapshotMutation.mutate({ workspaceKey, payload: snapshotPayload }, {
        onSuccess: (result) => setSnapshotState(result.saved ? "saved" : "error"),
        onError: () => setSnapshotState("error"),
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [saveSnapshotMutation, snapshotPayload, snapshotState, workspaceKey]);

  const saveCurrentSnapshot = async () => {
    setSnapshotState("loading");
    try {
      const result = await saveSnapshotMutation.mutateAsync({ workspaceKey, payload: snapshotPayload });
      setSnapshotState(result.saved ? "saved" : "error");
    } catch {
      setSnapshotState("error");
    }
  };

  const saveStatementHistory = async () => {
    const title = `${client.name || "Untitled customer"} — ${documentPeriodStart} to ${documentPeriodEnd}`;
    const input = { title, reference: statementReference, customerName: client.name, accountNumber: client.accountNumber, payload: snapshotPayload };
    try {
      if (editingHistoryId) await updateHistoryMutation.mutateAsync({ id: editingHistoryId, ...input, workspaceKey });
      else await createHistoryMutation.mutateAsync({ ...input, workspaceKey });
      await historyQuery.refetch(); setActiveTab("history");
    } catch { setImportNote("The statement could not be saved to the history database."); }
  };
  const postToRecords = async () => {
    applyTransactionRegister();
    await saveStatementHistory();
    setActiveTab("history");
    setImportNote("تم ترحيل الكشف إلى السجلات / Statement posted to records.");
  };

  const openStatementHistory = async (id: number) => {
    setSelectedHistoryId(id);
    setActiveTab("account");
  };

  useEffect(() => {
    const payload = (getHistoryQuery.data as { payload?: Partial<SnapshotPayload> } | null)?.payload;
    if (selectedHistoryId !== null && payload?.client) {
      if (!payload?.client) return;
      setEditingHistoryId(selectedHistoryId); setClient({ ...defaultClient, ...payload.client });
      setReferenceSource(payload.referenceSource === "excel" ? "excel" : "internal"); setIncludeBranch(payload.includeBranch === true); setDateOfBirthPlacement(payload.dateOfBirthPlacement === "none" || payload.dateOfBirthPlacement === "status" || payload.dateOfBirthPlacement === "statement" || payload.dateOfBirthPlacement === "both" ? payload.dateOfBirthPlacement : "both"); setFileName(payload.fileName || ""); setColumnMap(payload.columnMap || {}); setMappedFields(payload.mappedFields || []);
      setTransactions(payload.transactions || []); setAppliedTransactions(payload.appliedTransactions || []); setTotalCreditOverride(payload.totalCreditOverride || ""); setTotalDebitOverride(payload.totalDebitOverride || ""); setActiveTab("account");
      setSelectedHistoryId(null);
    }
  }, [getHistoryQuery.data, selectedHistoryId]);

  const deleteStatementHistory = async (id: number) => {
    if (!window.confirm("Delete this saved statement?")) return;
    await deleteHistoryMutation.mutateAsync({ id, workspaceKey }); await historyQuery.refetch();
  };

  const snapshotStatusLabel = snapshotQuery.isLoading || snapshotState === "loading"
    ? "Saving or restoring…"
    : snapshotState === "saved"
      ? "Saved to database"
      : snapshotState === "error"
        ? "Database unavailable"
        : "Restored from database";

  const statementPageHtml = useMemo(() => Array.from({ length: statementPageCount }, (_, pageIndex) => renderStatementPreview({
    headerUri: referenceAssets.headerStrip,
    qrUri: statementQrSources[pageIndex] || referenceAssets.qrLogo,
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: client.name,
    dateOfBirth: dateOfBirthPlacement === "statement" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(client.dateOfBirth) : "",
    includeBranch,
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
      transactions: statementPageGroups[pageIndex].map((row) => ({ date: displayStatementDate(row.date), description: row.description, branch: row.branch, operationNumber: row.operationNumber, debit: row.debit, credit: row.credit, balance: row.balance })),
  })), [barcodeSources, client, closing, dateOfBirthPlacement, documentIssueDate, documentPeriodEnd, documentPeriodStart, includeBranch, statementPageCount, statementPageGroups, statementPageSummaries, statementQrSources, statementReference]);

  useEffect(() => {
    let cancelled = false;
    const firstSummary = statementPageSummaries[0];
    const statusPayload = buildVerificationQrPayload({ bankName: selectedBank === "ycb" ? "YEMEN COMMERCIAL BANK" : selectedBank === "tadhamon" ? "TADHAMON BANK" : "KURAIMI ISLAMIC BANK", documentType: "status", reference: statementReference, accountNumber: client.accountNumber, customerName: client.name, pageNumber: 1, pageCount: 1, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: firstSummary?.firstReference, lastReference: statementPageSummaries.at(-1)?.lastReference, transactionCount: acceptedRows.length, debitCount: acceptedRows.filter((row) => row.debit > 0).length, creditCount: acceptedRows.filter((row) => row.credit > 0).length, totalDebit: reportedTotalDebit, totalCredit: reportedTotalCredit, openingBalance: money(client.opening), currency: client.currency, closing: reportedClosing, issueDate: formatEnglishGregorianDate(issueDate), issueDateHijri: formatHijriDate(issueDate) });
    QRCode.toDataURL(statusPayload, { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } })
      .then((source) => { if (!cancelled) setStatusQrSource(source); })
      .catch(() => { if (!cancelled) setStatusQrSource(""); });
    return () => { cancelled = true; };
  }, [acceptedRows, client.accountNumber, client.currency, client.name, client.opening, documentIssueDate, documentPeriodEnd, documentPeriodStart, issueDate, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statementPageSummaries, statementReference]);

  useEffect(() => {
    let cancelled = false;
    const buildInput = (rows: YcbStatementTransaction[], pageNumber: number) => ({ customerName: ycbStatementProfile.customerName, passport: ycbStatementProfile.passport, address: ycbStatementProfile.address, accountNumber: ycbStatementProfile.accountNumber, branchName: ycbStatementProfile.branchName, currency: ycbStatementProfile.currency, statementReference: ycbStatementProfile.statementReference, pageNumber, pageCount: statementPageCount, periodStart: ycbStatementProfile.periodStart, periodEnd: ycbStatementProfile.periodEnd, issueDate: ycbStatementProfile.issueDate, firstReference: rows[0]?.reference, lastReference: rows.at(-1)?.reference, transactionCount: rows.length, creditCount: rows.filter((row) => (row.credit || 0) > 0).length, debitCount: rows.filter((row) => (row.debit || 0) > 0).length, totalCredit: rows.reduce((sum, row) => sum + (row.credit || 0), 0), totalDebit: rows.reduce((sum, row) => sum + (row.debit || 0), 0), openingBalance: rows[0] ? rows[0].balance - (rows[0].credit || 0) + (rows[0].debit || 0) : ycbStatementProfile.openingBalance, closingBalance: rows.at(-1)?.balance ?? ycbStatementProfile.closingBalance });
    const ycbSources = Promise.all(ycbStatementTransactions.length ? statementPageGroups.map((rows, pageIndex) => QRCode.toDataURL(buildYcbStatementQrPayload(buildInput(ycbStatementTransactions.slice(pageIndex * MAX_TRANSACTIONS_PER_PAGE, (pageIndex + 1) * MAX_TRANSACTIONS_PER_PAGE), pageIndex + 1)), { width: 520, margin: 4, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } })) : [QRCode.toDataURL(buildYcbStatementQrPayload(buildInput([], 1)), { width: 520, margin: 4, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } })]);
    const legacySources = Promise.all(statementPageSummaries.map((summary, pageIndex) => QRCode.toDataURL(
      selectedBank === "tadhamon"
        ? buildTadhamonStatementQrPayload({ customerName: client.name, dateOfBirth: formatEnglishGregorianDate(client.dateOfBirth), address: client.address, placeOfBirth: client.placeOfBirth, accountNumber: client.accountNumber, branchName: client.branch, currency: client.currency, statementReference, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd })
        : buildVerificationQrPayload({ bankName: "KURAIMI ISLAMIC BANK", documentType: "statement", reference: statementReference, accountNumber: client.accountNumber, customerName: client.name, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: summary.firstReference, lastReference: summary.lastReference, transactionCount: statementPageGroups[pageIndex].length, debitCount: summary.debitCount, creditCount: summary.creditCount, totalDebit: summary.totalDebit, totalCredit: summary.totalCredit, openingBalance: money(client.opening), currency: client.currency, closing: summary.closingBalance, issueDate: documentIssueDate }),
      { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } })));
    (selectedBank === "ycb" ? ycbSources : legacySources).then((sources) => { if (!cancelled) setStatementQrSources(sources); }).catch(() => { if (!cancelled) setStatementQrSources([]); });
    return () => { cancelled = true; };
  }, [client.accountNumber, client.currency, client.name, documentIssueDate, documentPeriodEnd, documentPeriodStart, selectedBank, statementPageCount, statementPageGroups, statementPageSummaries, statementReference, ycbStatementProfile, ycbStatementTransactions]);

  useEffect(() => {
    const values = selectedBank === "ycb"
      ? statementPageGroups.map((rows, pageIndex) => buildYcbStatementBarcodePayload({ customerName: ycbStatementProfile.customerName, passport: ycbStatementProfile.passport, address: ycbStatementProfile.address, accountNumber: ycbStatementProfile.accountNumber, branchName: ycbStatementProfile.branchName, currency: ycbStatementProfile.currency, statementReference: ycbStatementProfile.statementReference, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: ycbStatementProfile.periodStart, periodEnd: ycbStatementProfile.periodEnd, issueDate: ycbStatementProfile.issueDate, firstReference: rows[0]?.operationNumber, lastReference: rows.at(-1)?.operationNumber, transactionCount: rows.length, creditCount: rows.filter((row) => row.credit > 0).length, debitCount: rows.filter((row) => row.debit > 0).length, totalCredit: rows.reduce((sum, row) => sum + row.credit, 0), totalDebit: rows.reduce((sum, row) => sum + row.debit, 0), openingBalance: statementPageSummaries[pageIndex]?.openingBalance ?? ycbStatementProfile.openingBalance, closingBalance: statementPageSummaries[pageIndex]?.closingBalance ?? ycbStatementProfile.closingBalance }))
      : Array.from({ length: statementPageCount }, (_, pageIndex) => buildVerificationBarcodePayload(statementReference, pageIndex + 1, statementPageCount, selectedBank === "tadhamon" ? "TADHAMON BANK" : "KURAIMI ISLAMIC BANK"));
    const generated = values.map((value) => {
      const svg = bwipjs.toSVG({ bcid: "pdf417", text: value, scaleX: 2, scaleY: 2, padding: 4, backgroundcolor: "FFFFFF", barcolor: selectedBank === "ycb" ? "2D3192" : "6B5297" });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    setBarcodeSources(generated);
  }, [selectedBank, statementPageCount, statementReference, statementPageGroups, statementPageSummaries, ycbStatementProfile]);

  const updateClient = (key: keyof typeof defaultClient, value: string) => {
    setClient((current) => ({ ...current, [key]: value }));
    if (selectedBank === "ycb") {
      const ycbKeyMap: Partial<Record<keyof typeof defaultClient, keyof typeof ycbClient>> = {
        name: "name", passport: "passport", branch: "branch", customerSince: "customerSince", dateOfBirth: "dateOfBirth", accountNumber: "accountNumber", accountType: "accountType", currency: "currency", opening: "opening", issueDate: "issueDate",
      };
      const ycbKey = ycbKeyMap[key];
      if (ycbKey) setYcbClient((current) => ({ ...current, [ycbKey]: value }));
    }
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
      localStorage.setItem(`${localMemoryPrefix}-descriptions`, JSON.stringify(next));
      return next;
    });
    setNameMemory((current) => {
      const next = Array.from(new Set([...extractedNames, ...current])).slice(0, 220);
      localStorage.setItem(`${localMemoryPrefix}-names`, JSON.stringify(next));
      return next;
    });
    setImportNote(`${nextRows.length} rows analysed: ${nextRows.filter((item) => !item.rejected).length} ready for review and ${nextRows.filter((item) => item.rejected).length} rejected.`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileInput = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    const fileIdentity = file.name.toLowerCase();
    const currentBankLabel = selectedBank === "ycb" ? "بنك اليمن التجاري" : selectedBank === "tadhamon" ? "بنك التضامن" : "بنك الكريمي";
    const otherBankLabel = selectedBank === "ycb" ? "بنك الكريمي" : selectedBank === "tadhamon" ? "بنك اليمن التجاري أو الكريمي" : "بنك اليمن التجاري أو التضامن";
    const looksLikeOtherBank = selectedBank === "ycb"
      ? /karimi|kuraimi|alkuraimi|الكريمي/.test(fileIdentity)
      : selectedBank === "tadhamon"
        ? /karimi|kuraimi|alkuraimi|الكريمي|ycb|yemen|commercial|اليمن|التجاري/.test(fileIdentity)
        : /ycb|yemen|commercial|اليمن|التجاري|tadhamon|تضامن/.test(fileIdentity);
    if (looksLikeOtherBank && !window.confirm(`تنبيه: اسم الملف يبدو تابعاً لـ ${otherBankLabel} بينما المسار الحالي هو ${currentBankLabel}. هل تريد استيراده إلى المسار الحالي؟`)) {
      setImportNote(`تم إلغاء الاستيراد: الملف يبدو تابعاً لـ ${otherBankLabel}.`);
      fileInput.value = "";
      return;
    }
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

  const updateTransaction = (operationNumber: string, field: "date" | "description" | "branch" | "externalReference" | "debit" | "credit" | "balance", input: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => {
      if (transaction.operationNumber !== operationNumber) return transaction;
      if (field === "branch") return { ...transaction, branch: input };
      if (field === "description") {
        const review = reviewDescription(input);
        return { ...transaction, description: review.description, rejected: !review.accepted, rejectionReason: review.reason, personName: review.personName, suggestedDescription: review.suggestedDescription };
      }
      if (field === "date" || field === "externalReference") return { ...transaction, [field]: input };
      if (field === "balance") return { ...transaction, balance: input.trim() === "" ? null : money(input) };
      return { ...transaction, [field]: money(input) };
    }));
  };

  const updateTransactionHighlight = (operationNumber: string, color: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => transaction.operationNumber === operationNumber
      ? { ...transaction, highlightColor: color || undefined }
      : transaction));
  };

  const applyTransactionRegister = () => {
    setAppliedTransactions(transactions);
    setRegisterDirty(false);
    setImportNote(`Register changes applied. ${transactions.filter((item) => !item.rejected).length} accepted transaction(s) now drive the documents, QR code, and print output.`);
  };

  const ycbApprovedStatementHtml = useMemo(() => {
    if (selectedBank !== "ycb") return "";
    const highlights = Object.fromEntries(ycbStatementTransactions.filter((row) => row.highlightColor).map((row) => [row.reference, row.highlightColor as string]));
    return renderYcbStatementPages(ycbStatementProfile, ycbStatementTransactions, statementQrSources, barcodeSources, highlights);
  }, [barcodeSources, selectedBank, statementQrSources, ycbStatementProfile, ycbStatementTransactions]);
  const tadhamonStatementHtml = useMemo(() => {
    if (selectedBank !== "tadhamon") return "";
    const profile: YcbStatementProfile = {
      customerName: client.name, passport: client.passport, address: client.address,
      placeOfBirth: client.placeOfBirth,
      dateOfBirth: dateOfBirthPlacement === "statement" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(client.dateOfBirth) : "",
      branchName: client.branch, accountNumber: client.accountNumber, accountType: client.accountType,
      currency: client.currency, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd,
      statementReference, openingBalance: money(client.opening), closingBalance: reportedClosing,
      totalCredit: reportedTotalCredit, totalDebit: reportedTotalDebit, issueDate: documentIssueDate,
      printTime: client.printTime,
    };
    const rows: YcbStatementTransaction[] = statementRows.map((row) => ({ date: displayStatementDate(row.date), reference: row.operationNumber, description: row.description, credit: row.credit, debit: row.debit, balance: row.balance, highlightColor: row.highlightColor }));
    const highlights = Object.fromEntries(rows.filter((row) => row.highlightColor).map((row) => [row.reference, row.highlightColor as string]));
    return renderTadhamonStatementPages(profile, rows, statementQrSources, barcodeSources, highlights);
  }, [barcodeSources, client, dateOfBirthPlacement, documentIssueDate, documentPeriodEnd, documentPeriodStart, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statementQrSources, statementReference, statementRows]);
  const printableStatementHtml = useMemo(() => selectedBank === "ycb" ? ycbApprovedStatementHtml : selectedBank === "tadhamon" ? tadhamonStatementHtml : assemblePrintableStatementHtml(statementPageHtml), [selectedBank, statementPageHtml, tadhamonStatementHtml, ycbApprovedStatementHtml]);

  const printDocument = (kind: PrintDocumentKind) => {
    const statementHtml = printableStatementHtml;
    const selected = selectPrintableDocument(kind, accountStatusHtml, statementHtml);
    if (!openPrintWindow(selected.html, selected.title)) {
      setImportNote("The browser blocked the print window. Please allow pop-ups for this site and try again.");
    }
  };

  const downloadPdf = async (kind: PrintDocumentKind) => {
    const statementHtml = printableStatementHtml;
    const selected = selectPrintableDocument(kind, accountStatusHtml, statementHtml);
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

  const updateYcbClient = (key: keyof typeof ycbClient, value: string) => {
    setYcbClient((current) => ({ ...current, [key]: value }));
  };

  const refreshAllDocumentData = () => {
    if (selectedBank === "ycb") {
      setYcbClient((current) => ({
        ...current,
        name: client.name,
        passport: client.passport,
        branch: client.branch,
        customerSince: client.customerSince,
        dateOfBirth: client.dateOfBirth,
        accountNumber: client.accountNumber,
        accountType: client.accountType,
        currency: client.currency,
        opening: client.opening,
        issueDate: client.issueDate,
      }));
    }
    setReviewPreview(null);
    setImportNote("تم تحديث بيانات المعاينة والطباعة من المدخلات الحالية / Document data refreshed.");
  };

  const selectBank = (bank: "karimi" | "ycb" | "tadhamon") => {
    window.localStorage.setItem("bak-web-staging-selected-bank", bank);
    snapshotRestored.current = false;
    setSnapshotState("loading");
    setReviewPreview(null);
    setDownloadingDocument(null);
    setRawRows([]);
    setTransactions([]);
    setAppliedTransactions([]);
    setColumnMap({});
    setMappedFields([]);
    setTotalCreditOverride("");
    setTotalDebitOverride("");
    setRegisterDirty(false);
    setFileName("");
    setClient(bank === "ycb" ? { ...defaultClient, name: ycbClient.name, passport: ycbClient.passport, branch: ycbClient.branch, customerSince: ycbClient.customerSince, dateOfBirth: ycbClient.dateOfBirth, accountNumber: ycbClient.accountNumber, accountType: ycbClient.accountType, currency: ycbClient.currency, opening: ycbClient.opening, issueDate: ycbClient.issueDate } : { ...defaultClient });
    setSelectedBank(bank);
    setShowYcbCertificate(false);
    setActiveTab("account");
  };
  const switchBank = () => selectBank(selectedBank === "ycb" ? "karimi" : selectedBank === "tadhamon" ? "karimi" : "ycb");
  if (selectedBank === null) {
    return <BankSelector onSelect={selectBank} onLogout={() => void handleSecureLogout()} />;
  }
  if (selectedBank === "ycb" && showYcbCertificate) {
    return <YcbCertificateWorkspace client={ycbClient} onChange={updateYcbClient} onBack={() => setShowYcbCertificate(false)} />;
  }
  return (
    <div key={selectedBank} className="app-shell" dir="rtl">
      <div className="desktop-fan desktop-fan-one" aria-hidden="true" />
      <div className="desktop-fan desktop-fan-two" aria-hidden="true" />
      <nav className="bank-workspace-tabs" aria-label="مساحات البنوك">
        <button type="button" className={selectedBank === "karimi" ? "is-active" : ""} onClick={() => selectBank("karimi")}><strong>بنك الكريمي <span>AlKuraimi Bank</span></strong><small>مساحة مستقلة · Independent workspace</small></button>
        <button type="button" className={selectedBank === "ycb" ? "is-active" : ""} onClick={() => selectBank("ycb")}><strong>البنك التجاري اليمني <span>Yemen Commercial Bank</span></strong><small>YCB · مساحة مستقلة · Independent workspace</small></button>
        <button type="button" className={selectedBank === "tadhamon" ? "is-active" : ""} onClick={() => selectBank("tadhamon")}><strong>بنك التضامن <span>Tadhamon Bank</span></strong><small>مساحة مستقلة · Independent workspace</small></button><a className="bank-conduct-link" href="https://good-conduct-training.onrender.com/" target="_blank" rel="noreferrer">حسن السيرة والسلوك</a>
      </nav>
      <aside className="desktop-sidebar" aria-label="التنقل الرئيسي / Main navigation">
        <div className="sidebar-brand"><span className="sidebar-logo"><Shield size={24} /></span><div><strong>{selectedBank === "ycb" ? "البنك التجاري اليمني" : selectedBank === "tadhamon" ? "بنك التضامن" : "بنك الكريمي"}</strong><small>{selectedBank === "ycb" ? "Yemen Commercial Bank" : selectedBank === "tadhamon" ? "Tadhamon Bank" : "AlKuraimi Bank"}</small></div></div>
        <div className="sidebar-section-label">مساحة العمل / Workspace</div>
        <button type="button" className={activeTab === "dashboard" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("dashboard")}><LayoutDashboard size={18} /><span>لوحة التحكم<small>Dashboard</small></span></button>
        <button type="button" className={activeTab === "account" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("account")}><Building2 size={18} /><span>الإدخال<small>Data Entry</small></span></button>
        <button type="button" className={activeTab === "transactions" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("transactions")}><Receipt size={18} /><span>استيراد Excel<small>Excel Import</small></span></button>
        <button type="button" className={activeTab === "review" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => { setActiveTab("review"); setReviewPreview("accountStatement"); }}><ClipboardList size={18} /><span>معاينة البيان<small>Statement Preview</small></span></button>
        <button type="button" className={activeTab === "history" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("history")}><Receipt size={18} /><span>السجلات<small>Records</small></span></button>
        <button type="button" className={activeTab === "analytics" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("analytics")}><BarChart3 size={18} /><span>المؤشرات<small>Analytics</small></span></button>
        <div className="sidebar-spacer" />
        <button type="button" className="sidebar-link"><Users size={18} /><span>المستخدمون<small>Users</small></span></button>
        <button type="button" className="sidebar-link"><Settings size={18} /><span>الإعدادات<small>Settings</small></span></button>
        <button type="button" className="sidebar-link sidebar-help"><HelpCircle size={18} /><span>المساعدة<small>Help & Support</small></span></button>
      </aside>
      <header className="app-header">
        <div className="brand-row">
          <div className="reference-logo system-mark" aria-label="نظام إصدار كشفي"><Shield size={30} /></div>
          <div>
            <p className="eyebrow">منصة داخلية لإصدار ومراجعة الكشوف</p>
          <h1>نظام إصدار كشفي</h1>
          <p className="bank-name">{selectedBank === "ycb" ? "البنك التجاري اليمني · منصة إصدار ومراجعة الكشوف" : selectedBank === "tadhamon" ? "بنك التضامن · منصة إصدار ومراجعة الكشوف" : "بنك الكريمي · منصة إصدار ومراجعة الكشوف"}</p>
          </div>
        </div>
        <div className="header-actions"><div className="reference-badge"><ShieldCheck size={17} /> {selectedBank === "ycb" ? "بنك اليمن التجاري · جلسة مستقلة" : selectedBank === "tadhamon" ? "بنك التضامن · جلسة مستقلة" : "بنك الكريمي · جلسة محمية"}</div><div className="header-quick-actions"><button type="button" className="secondary-button" onClick={() => void saveCurrentSnapshot()} disabled={snapshotState === "loading"}><Database size={15} /> حفظ</button><button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={15} /> تحديث</button></div></div>
      </header>

      <nav className="sr-only" aria-label="System sections">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="session-bar" role="status">
        <div className="session-user"><span className="session-avatar">{(user.name || user.email || "مستخدم").slice(0, 1).toUpperCase()}</span><span><b>{user.name || "مستخدم مصادق"}</b><small>{user.email || "جلسة عمل آمنة"}</small></span></div>
        <div className="session-meta"><span><LockKeyhole size={14} /> جلسة آمنة · تنتهي بعد 6 ساعات</span><button type="button" onClick={() => void handleSecureLogout()}><LogOut size={15} /> تسجيل الخروج</button></div>
      </div>

      <section className="reference-strip" aria-label="Staging status">
        <div><span>Work mode</span><strong>نظام إصدار كشفي</strong></div>
        <div><span>Staging database</span><strong>{stagingHealth.isLoading ? "Checking…" : stagingHealth.data ? `${stagingHealth.data.tableCount} tables ready` : "Unavailable"}</strong></div>
        <div><span>Reference documents</span><strong>No visual changes</strong></div>
      </section>

      {tabWarnings.length > 0 && <aside className="tab-warning" role="status">
        <AlertTriangle size={18} />
        <div><strong>تنبيهات التبويبات المهمة / Important tab warnings</strong><span>{tabWarnings.join(" · ")}</span></div>
      </aside>}

      {activeTab === "dashboard" && <section className="panel dashboard-panel" dir="rtl">
        <div className="panel-heading"><div><h2>لوحة التحكم / Dashboard</h2><p className="hint">ملخص مباشر للمدخلات والعمليات والسجلات. يمكنك الانتقال بين التبويبات دون ترتيب إلزامي.</p></div><LayoutDashboard size={26} className="heading-icon" /></div>
        <div className="metric-grid metric-grid-focused">
          <div className="metric-card"><span>إجمالي العملاء / Total Customers</span><strong>{acceptedRows.length}</strong><small>كل السجلات المقبولة / Accepted records</small><em className="metric-trend">البيانات الحالية</em></div>
          <div className="metric-card metric-card-primary"><span>عملاء بدون تكرار / Unique Customers</span><strong>{uniquePeopleCount}</strong><small>هويات عملاء مختلفة / Distinct identities</small><em className="metric-trend">{customerQualityRate}% من العملاء</em></div>
          <div className="metric-card metric-card-alert"><span>التكرار المكتشف / Duplicate Records</span><strong>{duplicatePeopleCount}</strong><small>سجلات تحتاج مراجعة / Need review</small><em className="metric-trend">{duplicateRate}% من الإجمالي</em></div>
          <div className="metric-card metric-card-quality"><span>جودة بيانات العملاء / Customer Data Quality</span><strong>{customerQualityRate}%</strong><small>نسبة العملاء بدون تكرار / Unique ratio</small><div className="quality-track"><i style={{ width: `${customerQualityRate}%` }} /></div></div>
        </div>
        <div className="dashboard-grid">
          <div className="chart-card"><h3>العمليات اليومية / Daily Operations <BarChart3 size={18} /></h3><div className="bar-chart" aria-label="Daily operations chart">{(operationBars.length ? operationBars : [["N/A", 0] as [string, number]]).map(([date, count]) => <div className="bar-item" key={date}><span style={{ height: `${Math.max(6, Math.min(100, count * 12))}%` }} title={`${date}: ${count}`} /><small>{date}</small></div>)}</div></div>
          <div className="chart-card"><h3>توزيع العملاء / Customer Quality <PieChart size={18} /></h3><div className="status-donut quality-donut" style={{ "--quality": `${customerQualityRate}%` } as React.CSSProperties}><div><strong>{customerQualityRate}%</strong><small>Unique</small></div></div><div className="legend"><span><i className="legend-ok" /> بدون تكرار / Unique: {uniquePeopleCount}</span><span><i className="legend-warn" /> مكرر / Duplicate: {duplicatePeopleCount}</span></div></div>
        </div>
        <div className="actions"><button type="button" onClick={() => void saveCurrentSnapshot()}><Database size={17} /> حفظ / Save</button><button type="button" className="unified-print-button" onClick={() => void postToRecords()}><FolderOpen size={17} /> ترحيل إلى السجلات / Post to Records</button></div>
      </section>}

      {activeTab === "analytics" && <section className="panel analytics-panel" dir="rtl">
        <div className="panel-heading"><div><h2>المؤشرات / Analytics</h2><p className="hint">رسوم توضيحية للعمليات والأفراد والسجلات الحالية.</p></div><BarChart3 size={26} className="heading-icon" /></div>
        <div className="metric-grid metric-grid-focused"><div className="metric-card"><span>إجمالي العملاء / Total Customers</span><strong>{acceptedRows.length}</strong><small>All accepted records</small></div><div className="metric-card metric-card-primary"><span>بدون تكرار / Unique Customers</span><strong>{uniquePeopleCount}</strong><small>{customerQualityRate}% data quality</small></div><div className="metric-card metric-card-alert"><span>التكرار / Duplicate Records</span><strong>{duplicatePeopleCount}</strong><small>{duplicateRate}% requires review</small></div><div className="metric-card metric-card-quality"><span>جودة البيانات / Data Quality</span><strong>{customerQualityRate}%</strong><small>Unique customer ratio</small></div></div>
        <div className="dashboard-grid"><div className="chart-card"><h3>مقارنة العملاء / Customer Comparison</h3><div className="comparison-bars"><div><span>بدون تكرار / Unique</span><i style={{ width: `${customerQualityRate}%` }}><b>{uniquePeopleCount}</b></i></div><div><span>مكرر / Duplicate</span><i className="duplicate-bar" style={{ width: `${duplicateRate}%` }}><b>{duplicatePeopleCount}</b></i></div></div></div><div className="chart-card"><h3>مراجعة البيانات / Data Review</h3><div className="review-score"><strong>{customerQualityRate >= 90 ? "ممتاز / Excellent" : customerQualityRate >= 70 ? "جيد / Good" : "يحتاج مراجعة / Review"}</strong><span>{acceptedRows.length ? `${duplicatePeopleCount} سجل مكرر من أصل ${acceptedRows.length}` : "أضف بيانات العملاء لبدء التحليل"}</span></div></div></div>
      </section>}

      {activeTab === "account" && <>
        <section className="panel intake-hero" aria-labelledby="intake-title">
          <div className="intake-hero-copy">
            <span className="section-kicker">Controlled data-entry flow</span>
            <h2 id="intake-title">إدخال واحد، مراجعة كاملة</h2>
            <p>{selectedBank === "ycb" ? "مساحة البنك التجاري اليمني: أدخل البيانات مرة واحدة، ثم راجع الكشف والبيان والتصدير من نفس السجل." : selectedBank === "tadhamon" ? "مساحة بنك التضامن: أدخل البيانات مرة واحدة، ثم راجع الكشف الرسمي والتصدير من مسار مستقل." : "مساحة بنك الكريمي: أدخل البيانات مرة واحدة، ثم راجع البيان والكشف والتصدير من نفس السجل."}</p>
          </div>
          <div className="intake-steps" aria-label="Data entry steps">
            <div className="intake-step is-current"><span>1</span><div><strong>المعلومات / Customer Details</strong><small>الحقول المطلوبة / Required fields</small></div></div>
            <div className="intake-step"><span>2</span><div><strong>الاستيراد / Excel Register</strong><small>{transactions.length ? `${transactions.length} rows loaded` : "استيراد ومراجعة / Import and review"}</small></div></div>
            <div className="intake-step"><span>3</span><div><strong>المعاينة / Statement Preview</strong><small>{acceptedRows.length ? "مرتبطة بالحركات المقبولة / Connected" : "بعد الاستيراد / After import"}</small></div></div>
          </div>
        </section>
        <section className="panel">
          <h2>إعدادات الإدخال / Data Entry Settings</h2>
          <div className="grid">
            <label>النظام / System<select value="STATEMENTS" disabled><option>نظام إصدار كشفي / Statement Issuance</option></select></label>
            <label>لغة المستند / Document Language<select value="en" disabled><option value="en">ثنائي اللغة / Bilingual</option></select></label>
            <label>العملة / Currency<select value={client.currency} onChange={(event) => updateClient("currency", event.target.value)}><option>USD</option><option>YER</option><option>SAR</option></select></label>
            <label>مصدر المرجع / Reference source<select value={referenceSource} onChange={(event) => setReferenceSource(event.target.value as "internal" | "excel")}><option value="internal">Generate internal reference</option><option value="excel">Use Excel reference</option></select></label>
            <label>عمود الفرع / Statement branch column<select value={includeBranch ? "yes" : "no"} onChange={(event) => setIncludeBranch(event.target.value === "yes")}><option value="no">Do not add Branch column</option><option value="yes">Add Branch column from Excel</option></select></label>
            <label>تاريخ الميلاد / Date of birth<select value={dateOfBirthPlacement} onChange={(event) => setDateOfBirthPlacement(event.target.value as DateOfBirthPlacement)}><option value="none">لا يظهر / Do not include</option><option value="status">في البيان فقط / Account Status only</option><option value="statement">في الكشف فقط / Account Statement only</option><option value="both">في البيان والكشف / Both documents</option></select></label>
          </div>
          <div className="actions"><button type="button" className="secondary-button" onClick={() => void saveCurrentSnapshot()} disabled={snapshotState === "loading"}><Database size={17} /> Save snapshot to database</button><span className="hint" aria-live="polite">{snapshotStatusLabel}</span></div>
        </section>
        <section className="panel">
          <h2>المعلومات الشخصية / Customer Information</h2>
          <div className="grid">
            <label>اسم العميل / Customer name<input value={client.name} onChange={(event) => updateClient("name", event.target.value)} placeholder="Name as shown on the statement" /></label>
            {selectedBank === "ycb" && <><label>العنوان / Address <span className="field-note">يظهر في الكشف / Shown on statement</span><input value={ycbClient.address} onChange={(event) => updateYcbClient("address", event.target.value)} placeholder="Street, area, city" /></label><label>تاريخ الميلاد / Date of Birth <span className="field-note">اختياري / Optional</span><input type="date" value={ycbClient.dateOfBirth} onChange={(event) => updateYcbClient("dateOfBirth", event.target.value)} /></label></>}
            {selectedBank === "tadhamon" && <><label>العنوان / Address <span className="field-note">يظهر في كشف التضامن / Shown on Tadhamon statement</span><input value={client.address} onChange={(event) => updateClient("address", event.target.value)} placeholder="Street, area, city" /></label><label>مكان الميلاد / Place of birth <span className="field-note">اختياري / Optional</span><input value={client.placeOfBirth} onChange={(event) => updateClient("placeOfBirth", event.target.value)} placeholder="City, country" /></label></>}
            {selectedBank !== "ycb" && <label>رقم المميز / Momaiz No.<input dir="ltr" value={client.momaizNo} onChange={(event) => updateClient("momaizNo", event.target.value)} /></label>}
            <label>رقم الجواز / Passport No. <span className="field-note">اختياري / Optional</span><input dir="ltr" value={client.passport} onChange={(event) => updateClient("passport", event.target.value)} /></label>
            <label className="wide">اسم الفرع / Branch name<input dir="ltr" value={client.branch} onChange={(event) => updateClient("branch", event.target.value)} placeholder="Branch Name" /></label>
            <label>تاريخ بدء العميل / Customer since<input lang="en-GB" value={client.customerSince} onChange={(event) => updateClient("customerSince", event.target.value)} placeholder="15/01/2020" /></label>
            {selectedBank !== "ycb" && <label>تاريخ الميلاد / Date of birth <span className="field-note">اختياري / Optional</span><input type="date" lang="en-GB" value={client.dateOfBirth} onChange={(event) => updateClient("dateOfBirth", event.target.value)} /></label>}
            <label>نوع الحساب / Account Type<input dir="ltr" value={client.accountType} onChange={(event) => updateClient("accountType", event.target.value)} /></label>
            <label>رقم الحساب / Account Number<input dir="ltr" value={client.accountNumber} onChange={(event) => updateClient("accountNumber", event.target.value)} /></label>
          </div>
        </section>
        {selectedBank === "ycb" && <>
          <section className="panel ycb-entry-panel">
            <h2>معلومات الشهادة / Certificate Information</h2>
            <p className="hint">حقول خاصة بالبنك التجاري اليمني فقط / YCB-only fields. The optional reference appears in the certificate header.</p>
            <div className="grid">
              <label>الرقم المرجعي / Reference Number <span className="field-note">اختياري / Optional</span><input aria-label="Reference number" dir="ltr" value={ycbClient.referenceNumber} onChange={(event) => updateYcbClient("referenceNumber", event.target.value)} placeholder="YCB-2026-001" /></label>
            </div>
          </section>
          <section className="panel ycb-entry-panel">
            <h2>بيانات الاعتماد / Authorization Information</h2>
            <p className="hint">تُستخدم هذه الأسماء في توقيع شهادة YCB فقط / These names remain separate from the AlKuraimi workspace.</p>
            <div className="grid">
              <label>خدمة العملاء / Customer Service<input aria-label="Customer Service" dir="ltr" value={ycbClient.customerServiceName} onChange={(event) => updateYcbClient("customerServiceName", event.target.value)} placeholder="Authorized employee name" /></label>
              <label>مدير الفرع / Branch Manager<input aria-label="Branch Manager" dir="ltr" value={ycbClient.branchManagerName} onChange={(event) => updateYcbClient("branchManagerName", event.target.value)} placeholder="Branch manager name" /></label>
            </div>
          </section>
        </>}
        {selectedBank === "karimi" && <section className="panel karimi-signature-panel">
          <h2>بيانات التوقيع / Signature Details</h2>
          <p className="hint">تظهر هذه البيانات في بيان الكريمي فقط، وبنفس لون قالب البيان.</p>
          <div className="grid">
            <label>اسم الموظف / Employee name<input value={client.employeeName} onChange={(event) => updateClient("employeeName", event.target.value)} /></label>
            <label>اسم المدير / Manager name<input value={client.managerName} onChange={(event) => updateClient("managerName", event.target.value)} /></label>
          </div>
        </section>}
        <section className="panel">
          <h2>بيان الحالة / Account Status Fields</h2>
          <p className="hint">هذه الحقول تظهر في بيان الحالة فقط / These fields appear only on the Account Status Statement. Totals update before printing.</p>
          <div className="grid">
            <label>تاريخ الإصدار / Issue Date<input type="date" lang="en-GB" value={client.issueDate} onChange={(event) => updateClient("issueDate", event.target.value)} /></label>
            <label>التاريخ الهجري / Hijri Issue Date <span className="field-note">تلقائي / Automatic</span><input dir="rtl" value={formatHijriDate(issueDate)} readOnly placeholder="Calculated from issue date" /></label>
            <label>وقت الطباعة / Print Time<input type="time" lang="en-GB" value={client.printTime} onChange={(event) => updateClient("printTime", event.target.value)} /></label>
            <label>تاريخ المراسلة / Correspondence Date<input type="date" lang="en-GB" value={client.correspondenceDate} onChange={(event) => updateClient("correspondenceDate", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>فترة كشف الحساب / Account Statement Period</h2>
          <p className="hint">اترك التاريخين فارغين لاستخدام أول وآخر حركة مقبولة / Leave dates blank to derive them from accepted Excel transactions.</p>
          <div className="grid">
            <label>بداية الكشف / Statement Start Date<input type="date" lang="en-GB" value={client.periodStart} onChange={(event) => updateClient("periodStart", event.target.value)} /></label>
            <label>نهاية الكشف / Statement End Date<input type="date" lang="en-GB" value={client.periodEnd} onChange={(event) => updateClient("periodEnd", event.target.value)} /></label>
            <div className="computed-field"><span>صفحات الكشف / Statement Pages</span><strong>{statementPageCount}</strong><small>حد أقصى 18 حركة / Maximum 18 transactions per page.</small></div>
          </div>
        </section>
        <section className="panel">
          <h2>البيانات المالية / Financial Details</h2>
          <p className="hint">مصدر موحد للبيان والكشف / Shared source for both documents. Closing balance is calculated automatically.</p>
          <div className="grid">
            <label>الرصيد الافتتاحي / Opening Balance<input inputMode="decimal" dir="ltr" value={client.opening} onChange={(event) => updateClient("opening", event.target.value)} /></label>
            <label>إجمالي الإيداع / Total Credit <span className="field-note">قابل للتعديل / Editable</span><input aria-label="Total credit (editable)" inputMode="decimal" dir="ltr" value={totalCreditOverride} placeholder={formatMoney(totalCredit)} onChange={(event) => setTotalCreditOverride(event.target.value)} /></label>
            <label>إجمالي السحب / Total Debit <span className="field-note">قابل للتعديل / Editable</span><input aria-label="Total debit (editable)" inputMode="decimal" dir="ltr" value={totalDebitOverride} placeholder={formatMoney(totalDebit)} onChange={(event) => setTotalDebitOverride(event.target.value)} /></label>
            <div className="computed-field"><span>الإيداع المعتمد / Reported Credit</span><strong>{formatMoney(reportedTotalCredit)}</strong><small>{totalCreditOverride.trim() ? "تعديل يدوي / Manual override" : "من الحركات المقبولة / From accepted transactions"}</small></div>
            <div className="computed-field"><span>السحب المعتمد / Reported Debit</span><strong>{formatMoney(reportedTotalDebit)}</strong><small>{totalDebitOverride.trim() ? "تعديل يدوي / Manual override" : "من الحركات المقبولة / From accepted transactions"}</small></div>
            <div className="computed-field"><span>الرصيد الختامي / Closing Balance</span><strong>{formatMoney(reportedClosing)}</strong></div>
            <div className="computed-field"><span>الحركات المقبولة / Accepted Transactions</span><strong>{acceptedRows.length}</strong></div>
            <div className="computed-field reference-field"><span>مرجع الكشف / Statement Reference</span><strong dir="ltr">{statementReference}</strong><small>مرجع ثابت مبني على أول تاريخ مستورد / Stable reference.</small></div>
          </div>
        </section>
        <div className="actions"><button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={17} /> تحديث البيانات / Refresh document data</button></div>
      </>}

      {activeTab === "transactions" && <>
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">Step 2 of 3</span><h2>Transaction Import</h2><p className="hint">Only the accepted register drives totals, QR verification, and the connected statement preview.</p></div><FileSpreadsheet size={26} className="heading-icon" /></div>
          <div className="connection-status" role="status"><span className={acceptedRows.length ? "connection-dot is-live" : "connection-dot"} /><div><strong>{acceptedRows.length ? "Preview connection is live" : "Preview connection is waiting"}</strong><small>{acceptedRows.length ? `${acceptedRows.length} accepted transaction(s) are ready for the document preview.` : "Import and apply the register to connect transaction data to the preview."}</small></div></div>
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
        {transactions.length > 0 && <section className="panel preview-panel">
          <div className="panel-heading"><div><h2>Editable Transaction Register</h2><p className="hint">Edit the values directly, then apply the register to update the financial totals, documents, QR code, and print output together. Rejected transactions remain visible for review and are re-evaluated when the description changes.</p></div><span className="summary-chip">{transactions.filter((item) => !item.rejected).length} accepted · {draftRejectedRows.length} rejected</span></div>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th>{includeBranch && <th>Branch</th>}{referenceSource === "excel" && <th>Excel Reference</th>}<th>Operation No.</th><th>Debit</th><th>Credit</th><th>Balance</th>{selectedBank === "ycb" && <th>Highlight</th>}<th>Status</th></tr></thead><tbody>
            {transactions.map((row) => <tr className={row.rejected ? "invalid-row" : ""} key={`${row.rowNumber}-${row.operationNumber}`}><td><input className="transaction-edit-input" type="date" lang="en-GB" value={row.date} onChange={(event) => updateTransaction(row.operationNumber, "date", event.target.value)} /></td><td><div className="description-cell"><input className="transaction-edit-input" value={row.description} onChange={(event) => updateTransaction(row.operationNumber, "description", event.target.value)} />{!row.rejected && row.suggestedDescription && row.suggestedDescription !== row.description && <button type="button" className="description-suggestion" onClick={() => applySuggestedDescription(row.operationNumber)}>Use suggestion: <b dir="ltr">{row.suggestedDescription}</b></button>}</div></td>{includeBranch && <td><input className="transaction-edit-input" value={row.branch} onChange={(event) => updateTransaction(row.operationNumber, "branch", event.target.value)} /></td>}{referenceSource === "excel" && <td><input className="transaction-edit-input" dir="ltr" value={row.externalReference} onChange={(event) => updateTransaction(row.operationNumber, "externalReference", event.target.value)} /></td>}<td dir="ltr">{row.operationNumber}</td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.debit || ""} onChange={(event) => updateTransaction(row.operationNumber, "debit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.credit || ""} onChange={(event) => updateTransaction(row.operationNumber, "credit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.balance ?? ""} onChange={(event) => updateTransaction(row.operationNumber, "balance", event.target.value)} /></td>{selectedBank === "ycb" && <td><label title="تلوين الحركة"><input aria-label={`Highlight ${row.operationNumber}`} type="checkbox" checked={Boolean(row.highlightColor)} onChange={(event) => updateTransactionHighlight(row.operationNumber, event.target.checked ? "#FEF08A" : "")} /> ✓</label><input aria-label={`Highlight color ${row.operationNumber}`} type="color" value={row.highlightColor || "#FEF08A"} onChange={(event) => updateTransactionHighlight(row.operationNumber, event.target.value)} /></td>}<td>{row.rejected ? <span className="row-alert"><AlertTriangle size={14} /> Rejected</span> : <span className="row-ok"><CheckCircle2 size={14} /> Ready for review</span>}</td></tr>)}
          </tbody></table></div>
          <div className="actions"><button type="button" onClick={applyTransactionRegister} disabled={!registerDirty}><CheckCircle2 size={17} /> {registerDirty ? "Apply Register Changes" : "Register Applied"}</button></div>
        </section>}
      </>}

      {activeTab === "history" && <section className="panel history-panel"><div className="panel-heading"><div><h2>Saved Statement History</h2><p className="hint">Open a saved statement to edit its data or transactions, then print it again.</p></div><Database size={26} className="heading-icon" /></div>{historyQuery.isLoading ? <p className="hint">Loading saved statements…</p> : (historyQuery.data as HistoryItem[] || []).length === 0 ? <p className="hint">No saved statements yet. Save one from Review & Export.</p> : <div className="history-list">{(historyQuery.data as HistoryItem[]).map((item) => <article className="history-item" key={item.id}><div><strong>{item.title}</strong><small>{item.customer_name || "—"} · {item.account_number || "—"} · Updated {new Date(item.updated_at).toLocaleString()}</small></div><div className="actions"><button type="button" onClick={() => void openStatementHistory(item.id)} disabled={getHistoryQuery.isLoading}><FolderOpen size={16} /> {getHistoryQuery.isLoading && selectedHistoryId === item.id ? "Loading…" : "Edit"}</button><button type="button" className="preview-button" onClick={() => { void openStatementHistory(item.id); setReviewPreview("accountStatement"); }}><Printer size={16} /> Print</button><button type="button" className="secondary-button" onClick={() => void deleteStatementHistory(item.id)} disabled={deleteHistoryMutation.isPending}><Trash2 size={16} /> Delete</button></div></article>)}</div>}</section>}
      {activeTab === "review" && <section className="panel review-panel">
        <div className="panel-heading"><div><span className="section-kicker">Step 3 of 3</span><h2>Review & Export</h2><p className="hint">{selectedBank === "ycb" ? "Review and print the approved Yemen Commercial Bank statement from one official template." : selectedBank === "tadhamon" ? "Review and print the approved Tadhamon Bank statement from its independent official template." : "Review the connected statement first, then print the Account Status Statement after it as one combined PDF/print job."}</p></div><FileText size={26} className="heading-icon" /></div>
        <div className="preview-assurance"><CheckCircle2 size={18} /><span><strong>Connected preview</strong> uses the applied register and shared customer fields. {selectedBank === "ycb" ? "The official YCB artwork, QR code, and page arrangement are preserved." : selectedBank === "tadhamon" ? "The official Tadhamon artwork, QR code, and page arrangement are preserved." : "The official AlKuraimi artwork, QR code, and page arrangement are preserved."}</span></div>
          <div className="review-grid"><div className="validation-card"><span>Customer status</span><strong>{client.name && (selectedBank === "ycb" || selectedBank === "tadhamon" ? client.accountNumber : client.momaizNo) ? "Ready for review" : "Customer details required"}</strong><small>{selectedBank === "ycb" ? "Customer name and account number are required for YCB." : selectedBank === "tadhamon" ? "Customer name and account number are required for Tadhamon." : "Customer name and Momaiz No. are required on the statement."}</small></div><div className="validation-card"><span>Transaction status</span><strong>{acceptedRows.length ? `${acceptedRows.length} accepted transactions` : "No transactions imported"}</strong><small>{rejectedRows.length ? `${rejectedRows.length} rejected rows remain visible for review.` : "No rejected rows currently."}</small></div><div className="validation-card"><span>Page limit</span><strong>18 transactions per page</strong><small>Current estimate: {Math.max(1, Math.ceil(acceptedRows.length / MAX_TRANSACTIONS_PER_PAGE))} statement page(s).</small></div><div className="validation-card"><span>Local browser memory</span><strong>{descriptionMemory.length} descriptions · {nameMemory.length} names</strong><small>Stored in this browser only and not sent to another service.</small></div></div>
        <div className="review-actions" aria-label="Document actions / إجراءات المستندات">
          <div className="review-action-group">
            <span className="review-action-label">البيانات / Data</span>
            <button type="button" className="secondary-button" onClick={() => void saveStatementHistory()} disabled={createHistoryMutation.isPending || updateHistoryMutation.isPending}><Database size={17} /> {editingHistoryId ? "تحديث السجل / Update Record" : "حفظ السجل / Save Record"}</button>
            <button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={17} /> تحديث البيانات / Refresh Data</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">المعاينة / Preview</span>
            <button type="button" className="preview-button" onClick={() => setReviewPreview("accountStatus")}><FileText size={17} /> معاينة بيان البنك / Bank Status Preview</button>
            <button type="button" className="preview-button" onClick={() => setReviewPreview("accountStatement")}><FileText size={17} /> View Account Statement</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">الطباعة / Print</span>
            <button type="button" className="unified-print-button" onClick={() => printDocument("accountStatus")}><Printer size={17} /> طباعة بيان البنك / Print Bank Status</button>
            <button type="button" className="unified-print-button" onClick={() => printDocument("unified")}><Printer size={17} /> طباعة موحدة: البيان ثم الكشف / Unified: Status then Statement</button>
            <button type="button" className="unified-print-button" onClick={() => printDocument("accountStatement")}><Printer size={17} /> طباعة كشف الحساب / Print Account Statement</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">حفظ PDF / Save PDF</span>
            <button type="button" className="preview-button" disabled={downloadingDocument === "accountStatus"} onClick={() => void downloadPdf("accountStatus")}><Download size={17} /> {downloadingDocument === "accountStatus" ? "جارٍ الفتح… / Opening…" : "حفظ بيان البنك PDF / Save Bank Status PDF"}</button>
            <button type="button" className="preview-button" disabled={downloadingDocument === "accountStatement"} onClick={() => void downloadPdf("accountStatement")}><Download size={17} /> {downloadingDocument === "accountStatement" ? "جارٍ الفتح… / Opening…" : "حفظ كشف الحساب PDF / Save Account Statement PDF"}</button>
          </div>
          <button type="button" className="secondary-button" onClick={downloadSessionJson}><RefreshCcw size={17} /> تنزيل جلسة JSON / Download Session JSON</button>
        </div>
        {reviewPreview && <section className="print-preview-panel" aria-label="Document preview before print"><div className="panel-heading"><div><h2>{reviewPreview === "accountStatus" ? "Account Status Statement Preview" : "Account Statement Preview"}</h2><p className="hint">Review the original artwork, QR code, values, and page arrangement before printing or downloading.</p></div><button type="button" className="secondary-button" onClick={() => setReviewPreview(null)}>Close Preview</button></div><div className="document-frame-wrap"><iframe className="document-frame" title={reviewPreview === "accountStatus" ? "Account Status Statement print preview" : "Account Statement print preview"} srcDoc={reviewPreview === "accountStatus" ? accountStatusHtml : printableStatementHtml} /></div></section>}
      </section>}

      <footer className="app-footer"><img src={referenceAssets.footerStrip} alt="Original footer reference"/><span>Independent Web Staging edition — Prototype 0.5.1 reference remains unchanged.</span></footer>
    </div>
  );
}
