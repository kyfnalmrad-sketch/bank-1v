/**
 * Design reference: mirror the Prototype 0.5.1 workflow and palette.
 * This web shell uses only original reference assets; it does not alter PDF templates.
 */
import React, { ChangeEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { renderTadhamonFastStatementPages } from "@/lib/tadhamonFastStatementTemplate";
import { renderTadhamonOfficialStatusPreview } from "@/lib/tadhamonOfficialStatusTemplate";
import type { YcbStatementProfile, YcbStatementTransaction } from "@/lib/ycbStatementPreview";
import { MAX_TRANSACTIONS_PER_PAGE, renderAccountStatusPreview, renderStatementPreview } from "@/lib/documentPreview";
import { buildVerificationBarcodePayload, buildVerificationQrPayload, buildTadhamonStatementQrPayload, buildYcbStatementBarcodePayload, buildYcbStatementQrPayload, synchronizeDocumentData } from "@/lib/documentSync";
import { auditFinancialStatement } from "@/lib/financialAudit";
import { assemblePrintableStatementHtml, downloadDocumentPdf, openPrintWindow, preloadPrintAssets, selectPrintableDocument, type PrintDocumentKind } from "@/lib/printDocument";
import { getQuickHighlightConfig } from "@/lib/quickHighlightConfig";
import {
  buildImportedTransactions,
  discoverStatementHeader,
  extractStatementProfile,
  statementFieldLabels,
  statementReferenceFromTransactions,
  bankStatementReference,
  reviewDescription,
  displayStatementDate,
  formatHijriDate,
  formatEnglishGregorianDate,
  type ImportedTransaction,
  type StatementColumnMap,
} from "@/lib/statementImport";

const formatMorningTime = (value: string) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = Number(match[1]);
    return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]} AM`;
  }
  return "";
};
const todayIsoDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const shortPersonName = (value: string) => {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "—";
};
type TabId = "dashboard" | "account" | "transactions" | "review" | "fastStatement" | "barcodes" | "history" | "analytics";
type DateOfBirthPlacement = "none" | "status" | "statement" | "both";
type Transaction = ImportedTransaction;
type FieldMemory = Record<string, string[]>;
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
  closingBalanceOverride?: string;
  statementReferenceOverride?: string;
  fastHighlightColors?: Record<number, string>;
  fastMinimumDeposit?: string;
  fastWithdrawalColor?: string;
  fastKeyword?: string;
  fastKeywordColor?: string;
  fastRowsPerPage?: number;
  fieldMemory?: FieldMemory;
  lockedSignatureNames?: { employee: boolean; manager: boolean };
  ycbClient?: typeof defaultYcbClient;
  dateOfBirthPlacement: DateOfBirthPlacement;
};
type HistoryItem = { id: number; title: string; statement_reference: string | null; customer_name: string | null; account_number: string | null; created_at: string; updated_at: string };

const snapshotWorkspaceStorageKey = "bak-web-staging-workspace-key";
const quickSettingsStorageKey = (bank: "karimi" | "ycb" | "tadhamon") => `bak-web-staging-quick-settings-${bank}`;
type QuickLocalSettings = { rowsPerPage?: number; depositColor?: string; withdrawalColor?: string; keyword?: string; keywordColor?: string };
function loadQuickLocalSettings(bank: "karimi" | "ycb" | "tadhamon" | null): QuickLocalSettings {
  if (typeof window === "undefined" || !bank) return {};
  try { return JSON.parse(window.localStorage.getItem(quickSettingsStorageKey(bank)) || "{}") as QuickLocalSettings; } catch { return {}; }
}

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
  { id: "fastStatement", label: "طبعة كشف حساب سريع / Quick Statement" },
  { id: "barcodes", label: "فحص الرموز / QR & Barcode" },
  { id: "history", label: "السجلات / Records" },
  { id: "analytics", label: "المؤشرات / Analytics" },
];

const defaultClient = {
  name: "",
  nameAr: "",
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
  printDate: "",
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
  placeOfBirth: "",
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

function rememberFieldValue(key: string, value: string, limit = 120) {
  const clean = value.trim();
  if (!clean || typeof window === "undefined") return;
  const storageKey = `bak-web-staging-field-${key}`;
  const next = Array.from(new Set([clean, ...loadLocalList(storageKey)])).slice(0, limit);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}

function mergeFieldMemory(memory: FieldMemory, key: string, value: string, limit = 120): FieldMemory {
  const clean = value.trim();
  if (!clean) return memory;
  return { ...memory, [key]: Array.from(new Set([clean, ...(memory[key] || [])])).slice(0, limit) };
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
      referenceAssets.tadhamonStatusBackground,
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
  const quickHighlightConfig = getQuickHighlightConfig(selectedBank || "tadhamon");
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
  const initialQuickSettings = loadQuickLocalSettings(selectedBank);
  const [fastHighlightColors, setFastHighlightColors] = useState<Record<number, string>>({});
  const [fastMinimumDeposit, setFastMinimumDeposit] = useState("");
  const [fastKeyword, setFastKeyword] = useState(initialQuickSettings.keyword || "");
  const [fastKeywordColor, setFastKeywordColor] = useState(initialQuickSettings.keywordColor || quickHighlightConfig.keywordColor);
  const [fastDepositColor, setFastDepositColor] = useState(initialQuickSettings.depositColor || quickHighlightConfig.depositColor);
  const [fastWithdrawalColor, setFastWithdrawalColor] = useState(initialQuickSettings.withdrawalColor || quickHighlightConfig.withdrawalColor);
  const initialRowsPerPage = Math.min(30, Math.max(1, Math.floor(initialQuickSettings.rowsPerPage || 30)));
  const [fastRowsPerPage, setFastRowsPerPage] = useState(initialRowsPerPage);
  const [fastRowsPerPageInput, setFastRowsPerPageInput] = useState(String(initialRowsPerPage));
  const [lockedSignatureNames, setLockedSignatureNames] = useState({ employee: false, manager: false });
  const [totalCreditOverride, setTotalCreditOverride] = useState("");
  const [totalDebitOverride, setTotalDebitOverride] = useState("");
  const [closingBalanceOverride, setClosingBalanceOverride] = useState("");
  const [statementReferenceOverride, setStatementReferenceOverride] = useState("");
  const [registerDirty, setRegisterDirty] = useState(false);
  const [importNote, setImportNote] = useState("Choose an Excel file to analyse the statement columns before importing.");
  const [isReading, setIsReading] = useState(false);
  const [statusQrSource, setStatusQrSource] = useState("");
  const [statementQrSources, setStatementQrSources] = useState<string[]>([]);
  const [barcodeSources, setBarcodeSources] = useState<string[]>([]);
  const localMemoryPrefix = selectedBank === "ycb" ? "bak-web-staging-ycb" : selectedBank === "tadhamon" ? "bak-web-staging-tadhamon" : "bak-web-staging-karimi";
  const [descriptionMemory, setDescriptionMemory] = useState<string[]>(() => loadLocalList(`${localMemoryPrefix}-descriptions`));
  const [nameMemory, setNameMemory] = useState<string[]>(() => loadLocalList(`${localMemoryPrefix}-names`));
  const [fieldMemory, setFieldMemory] = useState<FieldMemory>(() => {
    const fields = ["name", "nameAr", "branch", "accountType", "accountNumber", "passport", "address", "placeOfBirth", "employeeName", "managerName"];
    return Object.fromEntries(fields.map((field) => [field, loadLocalList(`${localMemoryPrefix}-${field}`)]));
  });
  useEffect(() => {
    setDescriptionMemory(loadLocalList(`${localMemoryPrefix}-descriptions`));
    setNameMemory(loadLocalList(`${localMemoryPrefix}-names`));
    const fields = ["name", "nameAr", "branch", "accountType", "accountNumber", "passport", "address", "placeOfBirth", "employeeName", "managerName"];
    setFieldMemory(Object.fromEntries(fields.map((field) => [field, loadLocalList(`${localMemoryPrefix}-${field}`)])));
  }, [localMemoryPrefix]);
  useEffect(() => {
    const settings = loadQuickLocalSettings(selectedBank);
    const rows = Math.min(30, Math.max(1, Math.floor(settings.rowsPerPage || 30)));
    setFastRowsPerPage(rows);
    setFastRowsPerPageInput(String(rows));
    setFastDepositColor(settings.depositColor || quickHighlightConfig.depositColor);
    setFastWithdrawalColor(settings.withdrawalColor || quickHighlightConfig.withdrawalColor);
    setFastKeyword(settings.keyword || "");
    setFastKeywordColor(settings.keywordColor || quickHighlightConfig.keywordColor);
  }, [selectedBank]);
  useEffect(() => {
    if (!selectedBank || typeof window === "undefined") return;
    const settings: QuickLocalSettings = { rowsPerPage: fastRowsPerPage, depositColor: fastDepositColor, withdrawalColor: fastWithdrawalColor, keyword: fastKeyword, keywordColor: fastKeywordColor };
    window.localStorage.setItem(quickSettingsStorageKey(selectedBank), JSON.stringify(settings));
  }, [fastDepositColor, fastKeyword, fastKeywordColor, fastRowsPerPage, fastWithdrawalColor, selectedBank]);
  const [reviewPreview, setReviewPreview] = useState<PrintDocumentKind | null>(initialReviewPreview);
  const [downloadingDocument, setDownloadingDocument] = useState<PrintDocumentKind | null>(null);
  const workspaceKey = useMemo(() => `${getWorkspaceKey()}-${selectedBank || "selector"}`, [selectedBank]);
  const [snapshotState, setSnapshotState] = useState<"loading" | "restored" | "saved" | "error">("loading");
  const snapshotRestored = useRef(false);
  const skipSnapshotRestore = useRef(false);
  const skipNextSnapshotSave = useRef(false);
  const snapshotQuery = trpc.staging.loadSnapshot.useQuery({ workspaceKey }, { retry: false, refetchOnWindowFocus: false });
  const saveSnapshotMutation = trpc.staging.saveSnapshot.useMutation();
  const historyQuery = trpc.staging.listHistory?.useQuery({ workspaceKey }, { retry: false, refetchOnWindowFocus: false }) || { data: [], isLoading: false, isError: false, refetch: async () => ({}) };
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [historyRestoreState, setHistoryRestoreState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const getHistoryQuery = trpc.staging.getHistory?.useQuery({ id: selectedHistoryId || 1, workspaceKey }, { enabled: selectedHistoryId !== null, retry: false }) || { data: null, isLoading: false, isError: false };
  const createHistoryMutation = trpc.staging.createHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ saved: false }) };
  const updateHistoryMutation = trpc.staging.updateHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ saved: false }) };
  const deleteHistoryMutation = trpc.staging.deleteHistory?.useMutation() || { isPending: false, mutateAsync: async () => ({ deleted: false }) };
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [historyPreviewAfterRestore, setHistoryPreviewAfterRestore] = useState(false);

  const documentClient = useDeferredValue(client);
  const synchronizedDocuments = useMemo(() => synchronizeDocumentData(appliedTransactions, money(documentClient.opening)), [appliedTransactions, documentClient.opening]);
  const { acceptedRows, rejectedRows, statementRows, totalCredit, totalDebit, closing } = synchronizedDocuments;
  const reportedTotalCredit = totalCreditOverride.trim() === "" ? totalCredit : money(totalCreditOverride);
  const reportedTotalDebit = totalDebitOverride.trim() === "" ? totalDebit : money(totalDebitOverride);
  const hasTotalsOverride = totalCreditOverride.trim() !== "" || totalDebitOverride.trim() !== "";
  const calculatedClosing = hasTotalsOverride ? money(documentClient.opening) + reportedTotalCredit - reportedTotalDebit : closing;
  const reportedClosing = closingBalanceOverride.trim() === "" ? calculatedClosing : money(closingBalanceOverride);
  const financialAudit = useMemo(() => auditFinancialStatement({
    openingBalance: money(documentClient.opening),
    openingBalanceProvided: referenceSource !== "excel" && documentClient.opening.trim() !== "" || (referenceSource === "excel" && documentClient.opening.trim() !== "" && documentClient.opening.trim() !== "0.00"),
    rows: statementRows.map((row) => ({ rowNumber: row.rowNumber, date: row.date, operationNumber: row.operationNumber, description: row.description, debit: row.debit, credit: row.credit, balance: row.balance, balanceProvided: row.balanceProvided })),
    printedCredit: totalCreditOverride.trim() === "" ? undefined : reportedTotalCredit,
    printedDebit: totalDebitOverride.trim() === "" ? undefined : reportedTotalDebit,
    printedClosing: closingBalanceOverride.trim() === "" ? undefined : reportedClosing,
    periodStart: documentClient.periodStart || undefined,
    periodEnd: documentClient.periodEnd || undefined,
    printDate: documentClient.printDate || undefined,
  }), [documentClient.opening, documentClient.periodEnd, documentClient.periodStart, hasTotalsOverride, referenceSource, reportedClosing, reportedTotalCredit, reportedTotalDebit, statementRows, totalCreditOverride, totalDebitOverride]);
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
  const missingCustomerFields = useMemo(() => {
    const required = selectedBank === "karimi"
      ? [{ key: "name" as const, label: "اسم العميل / Customer name" }, { key: "momaizNo" as const, label: "رقم المميز / Momaiz No." }]
      : [{ key: "name" as const, label: "اسم العميل / Customer name" }, { key: "accountNumber" as const, label: "رقم الحساب / Account number" }];
    return required.filter(({ key }) => !documentClient[key].trim()).map(({ label }) => label);
  }, [documentClient, selectedBank]);
  const financialAuditGuidance = (issue: (typeof financialAudit.issues)[number]) => {
    const row = issue.rowNumber ? `الصف ${issue.rowNumber} / Row ${issue.rowNumber}` : "الإجمالي / Total";
    const solution = issue.type === "running-balance"
      ? "الحل: راجع الرصيد الافتتاحي ومبلغ العملية والرصيد في Excel. / Fix: check the opening balance, transaction amount, and Excel balance."
      : issue.type === "closing-balance"
        ? "الحل: راجع الرصيد النهائي المطبوع أو العمليات، ثم أعد الاستيراد عند الحاجة. / Fix: check the printed closing balance or transactions, then re-import if needed."
        : issue.type === "credit-total" || issue.type === "debit-total"
          ? "الحل: طابق الإجمالي المطبوع مع الصفوف المقبولة. / Fix: reconcile the printed total with accepted rows."
          : issue.type === "duplicate"
            ? "الحل: راجع التكرار واحذف الصف المكرر من Excel قبل الاستيراد. / Fix: review and remove the duplicate row in Excel."
            : issue.type === "transaction"
              ? "الحل: اجعل العملية إيداعًا أو سحبًا واحدًا فقط. / Fix: keep the transaction as either a credit or a debit."
              : issue.type === "date-or-currency"
                ? "الحل: صحح التاريخ أو العملة لتطابق فترة الكشف. / Fix: align the date or currency with the statement period."
                : "الحل: راجع بيانات الصفحة والرصيد المرحل. / Fix: review the page totals and carried balance.";
    return { row, solution };
  };
  const tabWarnings = [
    missingCustomerFields.length > 0 ? `بيانات العميل ناقصة: ${missingCustomerFields.join("، ")} / Missing: ${missingCustomerFields.join(", ")}` : "",
    acceptedRows.length === 0 ? "لم يتم اعتماد عمليات / No accepted transactions" : "",
    rejectedRows.length > 0 ? `${rejectedRows.length} صفوف تحتاج مراجعة / rows need review` : "",
    financialAudit.issues.length > 0 ? `تدقيق مالي: ${financialAudit.issues.length} ملاحظة — راجع الصف والسبب / Financial audit: ${financialAudit.issues.length} item(s) to review` : "",
  ].filter(Boolean);
  const generatedStatementReference = useMemo(() => bankStatementReference(
    selectedBank || "karimi",
    documentClient.accountNumber || documentClient.momaizNo,
    documentClient.name,
    statementRows.at(-1)?.operationNumber || "",
  ), [documentClient.accountNumber, documentClient.momaizNo, documentClient.name, selectedBank, statementRows]);
  const internalStatementReference = useMemo(() => generatedStatementReference || statementReferenceFromTransactions(appliedTransactions, documentClient.accountNumber || documentClient.momaizNo), [appliedTransactions, documentClient.accountNumber, documentClient.momaizNo, generatedStatementReference]);
  const excelStatementReference = useMemo(() => appliedTransactions.map((transaction) => transaction.externalReference).find(Boolean) || "", [appliedTransactions]);
  const statementReference = statementReferenceOverride.trim() || internalStatementReference;
  const visibleMappedFields = useMemo(() => mappedFields.filter((field) => referenceSource === "excel" || field.key !== "reference"), [mappedFields, referenceSource]);
  const firstTransactionDate = acceptedRows.find((transaction) => transaction.date)?.date || "";
  const lastTransactionDate = [...acceptedRows].reverse().find((transaction) => transaction.date)?.date || "";
  const issueDate = documentClient.issueDate || lastTransactionDate || firstTransactionDate || "PENDING";
  const periodStart = documentClient.periodStart || firstTransactionDate || "PENDING";
  const periodEnd = documentClient.periodEnd || lastTransactionDate || issueDate;
  const documentIssueDate = displayStatementDate(issueDate);
  const documentPrintDate = documentClient.printDate ? displayStatementDate(documentClient.printDate) : "";
  const documentPeriodStart = displayStatementDate(periodStart);
  const documentPeriodEnd = displayStatementDate(periodEnd);
  const printDateValue = documentClient.printDate;
  const printDateDay = printDateValue ? new Date(`${printDateValue}T12:00:00`).getDay() : -1;
  const isPrintHoliday = printDateDay === 4 || printDateDay === 5;
  const printHolidayLabel = printDateDay === 4 ? "الخميس" : "الجمعة";
  const statementPageCount = Math.max(1, Math.ceil(acceptedRows.length / MAX_TRANSACTIONS_PER_PAGE));
  const statementPageGroups = useMemo(() => Array.from({ length: statementPageCount }, (_, pageIndex) => statementRows.slice(pageIndex * MAX_TRANSACTIONS_PER_PAGE, (pageIndex + 1) * MAX_TRANSACTIONS_PER_PAGE)), [statementPageCount, statementRows]);
  const statementPageSummaries = useMemo(() => statementPageGroups.map((rows, pageIndex) => {
    const previousRow = pageIndex > 0 ? statementPageGroups[pageIndex - 1]?.at(-1) : undefined;
    return {
      debitCount: rows.filter((row) => row.debit > 0).length,
      creditCount: rows.filter((row) => row.credit > 0).length,
      totalDebit: rows.reduce((sum, row) => sum + row.debit, 0),
      totalCredit: rows.reduce((sum, row) => sum + row.credit, 0),
      openingBalance: previousRow?.balance ?? money(documentClient.opening),
      closingBalance: rows.at(-1)?.balance ?? previousRow?.balance ?? money(documentClient.opening),
      firstReference: rows.at(0)?.operationNumber || "",
      lastReference: rows.at(-1)?.operationNumber || "",
    };
  }), [documentClient.opening, statementPageGroups]);
  const ycbStatementProfile = useMemo<YcbStatementProfile>(() => ({
    customerName: documentClient.name,
    passport: documentClient.passport,
    address: ycbClient.address,
    dateOfBirth: ycbClient.dateOfBirth,
    placeOfBirth: ycbClient.placeOfBirth,
    branchName: documentClient.branch,
    accountNumber: documentClient.accountNumber,
    accountType: documentClient.accountType,
    currency: documentClient.currency,
    periodStart: documentPeriodStart,
    periodEnd: documentPeriodEnd,
    statementReference,
    openingBalance: money(documentClient.opening),
    closingBalance: reportedClosing,
    totalCredit: reportedTotalCredit,
    totalDebit: reportedTotalDebit,
    issueDate: documentPrintDate,
  }), [documentClient.accountNumber, documentClient.accountType, documentClient.branch, documentClient.currency, documentClient.name, documentClient.opening, documentClient.printDate, dateOfBirthPlacement, documentPrintDate, documentPeriodEnd, documentPeriodStart, reportedClosing, reportedTotalCredit, reportedTotalDebit, statementReference, ycbClient.address, ycbClient.dateOfBirth, ycbClient.placeOfBirth]);
  const ycbStatementTransactions = useMemo<YcbStatementTransaction[]>(() => statementRows.map((row) => ({
    date: displayStatementDate(row.date),
    reference: row.operationNumber,
    description: row.description,
    credit: row.credit,
    debit: row.debit,
    balance: row.balance,
    highlightColor: row.highlightColor,
  })), [statementRows]);
  const accountStatusHtml = useMemo(() => selectedBank === "ycb" ? renderYcbCertificateHtml({
    ...ycbClient,
    name: documentClient.name,
    passport: documentClient.passport,
    branch: documentClient.branch,
    customerSince: documentClient.customerSince,
    dateOfBirth: ycbClient.dateOfBirth || (dateOfBirthPlacement === "status" || dateOfBirthPlacement === "both" ? documentClient.dateOfBirth : ""),
    placeOfBirth: ycbClient.placeOfBirth,
    accountNumber: documentClient.accountNumber,
    accountType: documentClient.accountType,
    currency: documentClient.currency,
    opening: String(reportedClosing),
    issueDate: documentPrintDate,
    periodStart: client.periodStart || documentPeriodStart,
    periodEnd: client.periodEnd || documentPeriodEnd,
  }, statusQrSource || "/assets/ycb-certificate-qr.png") : selectedBank === "tadhamon" ? renderTadhamonOfficialStatusPreview({
    backgroundUri: referenceAssets.tadhamonStatusBackground,
    bankName: "Tadhamon Bank",
    qrUri: statusQrSource || "/assets/tadhamon-official-qr-client.png",
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: documentClient.name,
    momaizNo: documentClient.momaizNo,
    passport: documentClient.passport,
    dateOfBirth: formatEnglishGregorianDate(documentClient.dateOfBirth),
    placeOfBirth: documentClient.placeOfBirth,
    customerSince: formatEnglishGregorianDate(documentClient.customerSince),
    accountType: documentClient.accountType,
    accountNumber: documentClient.accountNumber,
    branchName: documentClient.branch,
    currency: documentClient.currency,
    opening: money(documentClient.opening),
    credit: reportedTotalCredit,
    debit: reportedTotalDebit,
    closing: reportedClosing,
    issueDate: formatEnglishGregorianDate(documentClient.printDate || issueDate),
    issueDateHijri: formatHijriDate(issueDate),
    printTime: formatMorningTime(documentClient.printTime),
    correspondenceDate: formatEnglishGregorianDate(documentClient.correspondenceDate),
    periodStart: documentPeriodStart,
    periodEnd: documentPeriodEnd,
    employeeName: documentClient.employeeName,
    managerName: documentClient.managerName,
    enclosurePages: statementPageCount,
    referenceNo: statementReference,
  }) : renderAccountStatusPreview({
    backgroundUri: referenceAssets.statementBackground,
    bankName: undefined,
    qrUri: statusQrSource || referenceAssets.qrLogo,
    qrLogoUri: referenceAssets.qrBrandLogo,
    customerName: documentClient.name,
    momaizNo: documentClient.momaizNo,
    passport: documentClient.passport,
    dateOfBirth: dateOfBirthPlacement === "status" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(documentClient.dateOfBirth) : "",
    customerSince: formatEnglishGregorianDate(documentClient.customerSince),
    accountType: documentClient.accountType,
    accountNumber: documentClient.accountNumber,
    branchName: documentClient.branch,
    currency: documentClient.currency,
    opening: money(documentClient.opening),
    credit: reportedTotalCredit,
    debit: reportedTotalDebit,
    closing: reportedClosing,
    issueDate: formatEnglishGregorianDate(documentClient.printDate || issueDate),
    issueDateHijri: formatHijriDate(issueDate),
    printTime: formatMorningTime(documentClient.printTime),
    correspondenceDate: formatEnglishGregorianDate(documentClient.correspondenceDate),
    employeeName: documentClient.employeeName,
    managerName: documentClient.managerName,
    enclosurePages: statementPageCount,
    referenceNo: statementReference,
  }), [documentClient, dateOfBirthPlacement, documentPrintDate, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statusQrSource, statementPageCount, statementReference, ycbClient]);
  const snapshotPayload = useMemo<SnapshotPayload>(() => ({ schemaVersion: 1, bankId: selectedBank === "ycb" ? "ycb" : selectedBank === "tadhamon" ? "tadhamon" : "karimi", client, referenceSource, includeBranch, fileName, columnMap, mappedFields, transactions, appliedTransactions, totalCreditOverride, totalDebitOverride, closingBalanceOverride, statementReferenceOverride, fastHighlightColors, fastMinimumDeposit, fastWithdrawalColor, fastKeyword, fastKeywordColor, fastRowsPerPage, fieldMemory, lockedSignatureNames, dateOfBirthPlacement, ycbClient: selectedBank === "ycb" ? ycbClient : undefined }), [appliedTransactions, client, columnMap, dateOfBirthPlacement, fastHighlightColors, fastKeyword, fastKeywordColor, fastMinimumDeposit, fastRowsPerPage, fastWithdrawalColor, fieldMemory, fileName, includeBranch, lockedSignatureNames, mappedFields, referenceSource, selectedBank, statementReferenceOverride, totalCreditOverride, totalDebitOverride, transactions, ycbClient, closingBalanceOverride]);

  useEffect(() => {
    if (skipSnapshotRestore.current) {
      skipSnapshotRestore.current = false;
      return;
    }
    if (snapshotQuery.isLoading || snapshotRestored.current) return;
    const payload = snapshotQuery.data?.payload as Partial<SnapshotPayload> | undefined;
    if (payload?.bankId && payload.bankId !== selectedBank) return;
    snapshotRestored.current = true;
    if (payload?.schemaVersion !== 1 || !(payload.client || (payload as Partial<SnapshotPayload> & { documentClient?: typeof defaultClient }).documentClient)) {
      setSnapshotState(snapshotQuery.isError ? "error" : "restored");
      if (snapshotQuery.isError) setImportNote("تعذر تحميل الحفظ التلقائي من قاعدة البيانات. يمكنك المتابعة محليًا، لكن لن يتم حفظ التغييرات على الخادم حتى يعود الاتصال. / Auto-save could not be loaded from the database.");
      return;
    }
    const restoredClient = { ...defaultClient, ...(payload.client || (payload as Partial<SnapshotPayload> & { documentClient?: typeof defaultClient }).documentClient) };
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
    setClosingBalanceOverride(typeof payload.closingBalanceOverride === "string" ? payload.closingBalanceOverride : "");
    setStatementReferenceOverride(typeof payload.statementReferenceOverride === "string" ? payload.statementReferenceOverride : "");
    setFastHighlightColors(payload.fastHighlightColors && typeof payload.fastHighlightColors === "object" ? payload.fastHighlightColors : {});
    setFastMinimumDeposit(typeof payload.fastMinimumDeposit === "string" ? payload.fastMinimumDeposit : "");
    setFastKeyword(typeof payload.fastKeyword === "string" ? payload.fastKeyword : "");
    setFastKeywordColor(typeof payload.fastKeywordColor === "string" ? payload.fastKeywordColor : "#dcfce7");
    const localRowsPerPage = loadQuickLocalSettings(selectedBank).rowsPerPage;
    const restoredRowsPerPage = typeof localRowsPerPage === "number" && Number.isFinite(localRowsPerPage) ? Math.min(30, Math.max(1, Math.floor(localRowsPerPage))) : typeof payload.fastRowsPerPage === "number" && Number.isFinite(payload.fastRowsPerPage) ? Math.min(30, Math.max(1, Math.floor(payload.fastRowsPerPage))) : 30;
    setFastRowsPerPage(restoredRowsPerPage);
    setFastRowsPerPageInput(String(restoredRowsPerPage));
    if (payload.fieldMemory && typeof payload.fieldMemory === "object") setFieldMemory(payload.fieldMemory);
    if (payload.lockedSignatureNames && typeof payload.lockedSignatureNames === "object") setLockedSignatureNames({ employee: payload.lockedSignatureNames.employee === true, manager: payload.lockedSignatureNames.manager === true });
    setSnapshotState("restored");
  }, [selectedBank, snapshotQuery.data, snapshotQuery.isError, snapshotQuery.isLoading]);

  useEffect(() => {
    if (skipNextSnapshotSave.current) {
      skipNextSnapshotSave.current = false;
      return;
    }
    if (!snapshotRestored.current || snapshotState === "loading") return;
    const timer = window.setTimeout(() => {
      saveSnapshotMutation.mutate({ workspaceKey, payload: snapshotPayload }, {
        onSuccess: (result) => { setSnapshotState(result.saved ? "saved" : "error"); if (!result.saved) setImportNote("فشل الحفظ التلقائي: قاعدة البيانات لم تؤكد العملية. / Auto-save was not confirmed by the database."); },
        onError: () => { setSnapshotState("error"); setImportNote("فشل الحفظ التلقائي بسبب تعذر الاتصال بقاعدة البيانات. / Auto-save failed because the database is unavailable."); },
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [saveSnapshotMutation, snapshotPayload, snapshotState, workspaceKey]);

  const saveCurrentSnapshot = async () => {
    setSnapshotState("loading");
    try {
      const result = await saveSnapshotMutation.mutateAsync({ workspaceKey, payload: snapshotPayload });
      setSnapshotState(result.saved ? "saved" : "error");
      setImportNote(result.saved ? "تم حفظ البيانات بنجاح. / Data saved successfully." : "فشل الحفظ: قاعدة البيانات لم تؤكد العملية. / Save was not confirmed by the database.");
    } catch {
      setSnapshotState("error");
      setImportNote("فشل الحفظ بسبب تعذر الاتصال بقاعدة البيانات. / Save failed because the database is unavailable.");
    }
  };

  const saveStatementHistory = async (payloadOverride?: SnapshotPayload) => {
    const payload = payloadOverride || snapshotPayload;
    const savedTransactions = Array.isArray(payload.transactions) ? payload.transactions : [];
    const customerName = documentClient.name.trim();
    const accountNumber = documentClient.accountNumber.trim();
    if (!customerName && !accountNumber && savedTransactions.length === 0) {
      setImportNote("لا يمكن حفظ سجل فارغ. أدخل اسم العميل أو رقم الحساب وأضف العمليات أولًا. / An empty record cannot be saved.");
      return false;
    }
    const title = `${customerName || "Untitled customer"} — ${documentPeriodStart} to ${documentPeriodEnd}`;
    const input = { title, reference: statementReference, customerName, accountNumber, payload };
    try {
      const result = editingHistoryId
        ? await updateHistoryMutation.mutateAsync({ id: editingHistoryId, ...input, workspaceKey })
        : await createHistoryMutation.mutateAsync({ ...input, workspaceKey });
      if (!result?.saved) {
        setImportNote("تعذر ترحيل السجل: قاعدة بيانات السجلات غير متاحة أو لم تؤكد الحفظ. / Record was not posted: the history database did not confirm the save.");
        return false;
      }
      if (!editingHistoryId && "id" in result && Number.isInteger(Number(result.id))) setEditingHistoryId(Number(result.id));
      await historyQuery.refetch();
      setActiveTab("history");
      return true;
    } catch (error) {
      console.error("Statement history save failed", error);
      setImportNote("تعذر ترحيل السجل. تحقق من اتصال قاعدة البيانات ثم حاول مرة أخرى. / The record could not be posted. Check the database connection and try again.");
      return false;
    }
  };
  const postToRecords = async () => {
    const importedTransactions = transactions.map((transaction) => ({ ...transaction }));
    const committedTransactions = importedTransactions.filter((transaction) => !transaction.rejected);
    const committedPayload: SnapshotPayload = {
      ...snapshotPayload,
      transactions: importedTransactions,
      appliedTransactions: committedTransactions,
    };
    setAppliedTransactions(committedTransactions);
    setRegisterDirty(false);
    const saved = await saveStatementHistory(committedPayload);
    if (saved) setImportNote("تم ترحيل الكشف إلى السجلات بنجاح / Statement posted to records successfully.");
    return saved;
  };
  const startNewData = () => {
    skipSnapshotRestore.current = true;
    skipNextSnapshotSave.current = true;
    snapshotRestored.current = true;
    setClient({ ...defaultClient, employeeName: lockedSignatureNames.employee ? client.employeeName : "", managerName: lockedSignatureNames.manager ? client.managerName : "" });
    setYcbClient({ ...defaultYcbClient });
    setReferenceSource("internal");
    setIncludeBranch(false);
    setFileName("");
    setRawRows([]);
    setColumnMap({});
    setMappedFields([]);
    setTransactions([]);
    setAppliedTransactions([]);
    setTotalCreditOverride("");
    setTotalDebitOverride("");
    setClosingBalanceOverride("");
    setStatementReferenceOverride("");
    setFastHighlightColors({});
    setFastMinimumDeposit("");
    setRegisterDirty(false);
    setEditingHistoryId(null);
    setSelectedHistoryId(null);
    setReviewPreview(null);
    setFastHighlightColors({});
    setActiveTab("account");
    setSnapshotState("restored");
    setImportNote("بيانات جديدة جاهزة للإدخال. البيانات المرحّلة سابقًا محفوظة في السجلات.");
  };
  const postAndStartNewData = async () => {
    const saved = await postToRecords();
    if (saved) startNewData();
  };

  const openStatementHistory = async (id: number | string, previewAfterRestore = false) => {
    const historyId = Number(id);
    if (!Number.isInteger(historyId) || historyId <= 0) {
      setHistoryRestoreState("error");
      setImportNote("تعذر فتح السجل: رقم السجل غير صالح. حدّث قائمة السجلات وحاول مرة أخرى. / Cannot open record: invalid record ID. Refresh and try again.");
      return;
    }
    setHistoryRestoreState("loading");
    setHistoryPreviewAfterRestore(previewAfterRestore);
    setSelectedHistoryId(historyId);
    setImportNote("جارٍ تحميل السجل كاملًا للتعديل… / Loading the complete record for editing…");
  };
  useEffect(() => {
    if (selectedHistoryId === null || getHistoryQuery.isLoading) return;
    const history = getHistoryQuery.data as { id?: number; title?: string; customer_name?: string | null; account_number?: string | null; payload?: unknown } | null;
    const returnedHistoryId = Number(history?.id);
    if (!history || !Number.isInteger(returnedHistoryId) || returnedHistoryId !== selectedHistoryId) {
      if (getHistoryQuery.isError || !history) { setHistoryRestoreState("error"); setImportNote("تعذر تحميل السجل المحدد. تحقق من اتصال قاعدة البيانات أو حدّث قائمة السجلات."); }
      return;
    }
    let rawPayload: any = history.payload;
    if (typeof rawPayload === "string") { try { rawPayload = JSON.parse(rawPayload); } catch { rawPayload = null; } }
    const payload = (rawPayload?.payload && typeof rawPayload.payload === "object" ? rawPayload.payload : rawPayload) as (Partial<SnapshotPayload> & { documentClient?: typeof defaultClient }) | null;
    const restoredClient = payload?.client || payload?.documentClient;
    if (!restoredClient) {
      setHistoryRestoreState("error");
      setImportNote(`السجل "${history.title || selectedHistoryId}" موجود، لكن بياناته القديمة غير قابلة للاستعادة.`);
      return;
    }
    setEditingHistoryId(returnedHistoryId);
    setClient({ ...defaultClient, ...restoredClient });
    if (payload?.ycbClient) setYcbClient({ ...defaultYcbClient, ...payload.ycbClient });
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
    setClosingBalanceOverride(typeof payload.closingBalanceOverride === "string" ? payload.closingBalanceOverride : "");
    setStatementReferenceOverride(typeof payload.statementReferenceOverride === "string" ? payload.statementReferenceOverride : "");
    setFastHighlightColors(payload.fastHighlightColors && typeof payload.fastHighlightColors === "object" ? payload.fastHighlightColors : {});
    setFastMinimumDeposit(typeof payload.fastMinimumDeposit === "string" ? payload.fastMinimumDeposit : "");
    setFastKeyword(typeof payload.fastKeyword === "string" ? payload.fastKeyword : "");
    setFastKeywordColor(typeof payload.fastKeywordColor === "string" ? payload.fastKeywordColor : "#dcfce7");
    const localRowsPerPage = loadQuickLocalSettings(selectedBank).rowsPerPage;
    const restoredRowsPerPage = typeof localRowsPerPage === "number" && Number.isFinite(localRowsPerPage) ? Math.min(30, Math.max(1, Math.floor(localRowsPerPage))) : typeof payload.fastRowsPerPage === "number" && Number.isFinite(payload.fastRowsPerPage) ? Math.min(30, Math.max(1, Math.floor(payload.fastRowsPerPage))) : 30;
    setFastRowsPerPage(restoredRowsPerPage);
    setFastRowsPerPageInput(String(restoredRowsPerPage));
    if (payload.fieldMemory && typeof payload.fieldMemory === "object") setFieldMemory(payload.fieldMemory);
    if (payload.lockedSignatureNames && typeof payload.lockedSignatureNames === "object") setLockedSignatureNames({ employee: payload.lockedSignatureNames.employee === true, manager: payload.lockedSignatureNames.manager === true });
    setHistoryRestoreState("success");
    setImportNote(`تمت استعادة السجل: ${history.title || "بدون اسم"} — العميل: ${history.customer_name || restoredClient.name || "—"} — الحساب: ${history.account_number || restoredClient.accountNumber || "—"} — العمليات: ${Array.isArray(payload.transactions) ? payload.transactions.length : 0}.`);
    setActiveTab(historyPreviewAfterRestore ? "review" : "account");
    if (historyPreviewAfterRestore) setReviewPreview("accountStatement");
    setHistoryPreviewAfterRestore(false);
    setSelectedHistoryId(null);
  }, [getHistoryQuery.data, getHistoryQuery.isError, getHistoryQuery.isLoading, historyPreviewAfterRestore, selectedHistoryId]);
  const deleteStatementHistory = async (id: number) => {
    if (!window.confirm("Delete this person's saved statement and all imported transactions?")) return;
    try {
      const result = await deleteHistoryMutation.mutateAsync({ id, workspaceKey });
      await historyQuery.refetch();
      setImportNote(result.deleted ? "تم حذف قاعدة بيانات الشخص المحدد من السجلات." : "تعذر حذف سجل الشخص المحدد من قاعدة البيانات.");
    } catch (error) {
      console.error("Statement history delete failed", error);
      setImportNote("فشل حذف السجل بسبب تعذر الاتصال بقاعدة البيانات. لم يتم حذف أي بيانات. / Delete failed because the database is unavailable; no data was deleted.");
    }
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
    customerName: documentClient.name,
    dateOfBirth: dateOfBirthPlacement === "statement" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(documentClient.dateOfBirth) : "",
    includeBranch,
    accountNumber: documentClient.accountNumber,
    momaizNo: documentClient.momaizNo,
    branchName: documentClient.branch,
    currency: documentClient.currency,
    issueDate: documentPrintDate,
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
  })), [barcodeSources, documentClient, closing, dateOfBirthPlacement, documentIssueDate, documentPeriodEnd, documentPeriodStart, includeBranch, statementPageCount, statementPageGroups, statementPageSummaries, statementQrSources, statementReference]);

  useEffect(() => {
    let cancelled = false;
    const firstSummary = statementPageSummaries[0];
    const statusPayload = buildVerificationQrPayload({ bankName: selectedBank === "ycb" ? "YEMEN COMMERCIAL BANK" : selectedBank === "tadhamon" ? "TADHAMON BANK" : "KURAIMI ISLAMIC BANK", documentType: "status", reference: statementReference, accountNumber: documentClient.accountNumber, customerName: documentClient.name, pageNumber: 1, pageCount: 1, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: firstSummary?.firstReference, lastReference: statementPageSummaries.at(-1)?.lastReference, transactionCount: acceptedRows.length, debitCount: acceptedRows.filter((row) => row.debit > 0).length, creditCount: acceptedRows.filter((row) => row.credit > 0).length, totalDebit: reportedTotalDebit, totalCredit: reportedTotalCredit, openingBalance: money(documentClient.opening), currency: documentClient.currency, closing: reportedClosing, issueDate: formatEnglishGregorianDate(documentClient.printDate || issueDate), issueDateHijri: formatHijriDate(issueDate) });
    QRCode.toDataURL(statusPayload, { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } })
      .then((source) => { if (!cancelled) setStatusQrSource(source); })
      .catch(() => { if (!cancelled) setStatusQrSource(""); });
    return () => { cancelled = true; };
  }, [acceptedRows, documentClient.accountNumber, documentClient.currency, documentClient.name, documentClient.opening, documentIssueDate, documentPeriodEnd, documentPeriodStart, issueDate, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statementPageSummaries, statementReference]);

  useEffect(() => {
    let cancelled = false;
    const buildInput = (rows: YcbStatementTransaction[], pageNumber: number) => ({ customerName: ycbStatementProfile.customerName, passport: ycbStatementProfile.passport, address: ycbStatementProfile.address, accountNumber: ycbStatementProfile.accountNumber, branchName: ycbStatementProfile.branchName, currency: ycbStatementProfile.currency, statementReference: ycbStatementProfile.statementReference, pageNumber, pageCount: statementPageCount, periodStart: ycbStatementProfile.periodStart, periodEnd: ycbStatementProfile.periodEnd, issueDate: ycbStatementProfile.issueDate, firstReference: rows[0]?.reference, lastReference: rows.at(-1)?.reference, transactionCount: rows.length, creditCount: rows.filter((row) => (row.credit || 0) > 0).length, debitCount: rows.filter((row) => (row.debit || 0) > 0).length, totalCredit: rows.reduce((sum, row) => sum + (row.credit || 0), 0), totalDebit: rows.reduce((sum, row) => sum + (row.debit || 0), 0), openingBalance: rows[0] ? rows[0].balance - (rows[0].credit || 0) + (rows[0].debit || 0) : ycbStatementProfile.openingBalance, closingBalance: rows.at(-1)?.balance ?? ycbStatementProfile.closingBalance });
    const ycbSources = Promise.all(ycbStatementTransactions.length ? statementPageGroups.map((rows, pageIndex) => QRCode.toDataURL(buildYcbStatementQrPayload(buildInput(ycbStatementTransactions.slice(pageIndex * MAX_TRANSACTIONS_PER_PAGE, (pageIndex + 1) * MAX_TRANSACTIONS_PER_PAGE), pageIndex + 1)), { width: 520, margin: 4, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } })) : [QRCode.toDataURL(buildYcbStatementQrPayload(buildInput([], 1)), { width: 520, margin: 4, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } })]);
    const legacySources = Promise.all(statementPageSummaries.map((summary, pageIndex) => QRCode.toDataURL(
      selectedBank === "tadhamon"
        ? buildTadhamonStatementQrPayload({ customerName: documentClient.name, dateOfBirth: formatEnglishGregorianDate(documentClient.dateOfBirth), address: documentClient.address, placeOfBirth: documentClient.placeOfBirth, accountNumber: documentClient.accountNumber, branchName: documentClient.branch, currency: documentClient.currency, statementReference, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd })
        : buildVerificationQrPayload({ bankName: "KURAIMI ISLAMIC BANK", documentType: "statement", reference: statementReference, accountNumber: documentClient.accountNumber, customerName: documentClient.name, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, firstReference: summary.firstReference, lastReference: summary.lastReference, transactionCount: statementPageGroups[pageIndex].length, debitCount: summary.debitCount, creditCount: summary.creditCount, totalDebit: summary.totalDebit, totalCredit: summary.totalCredit, openingBalance: money(documentClient.opening), currency: documentClient.currency, closing: summary.closingBalance, issueDate: documentPrintDate }),
      { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } })));
    (selectedBank === "ycb" ? ycbSources : legacySources).then((sources) => { if (!cancelled) setStatementQrSources(sources); }).catch(() => { if (!cancelled) setStatementQrSources([]); });
    return () => { cancelled = true; };
  }, [documentClient.accountNumber, documentClient.currency, documentClient.name, documentIssueDate, documentPeriodEnd, documentPeriodStart, selectedBank, statementPageCount, statementPageGroups, statementPageSummaries, statementReference, ycbStatementProfile, ycbStatementTransactions]);

  useEffect(() => {
    const values = selectedBank === "ycb"
      ? statementPageGroups.map((rows, pageIndex) => buildYcbStatementBarcodePayload({ customerName: ycbStatementProfile.customerName, passport: ycbStatementProfile.passport, address: ycbStatementProfile.address, accountNumber: ycbStatementProfile.accountNumber, branchName: ycbStatementProfile.branchName, currency: ycbStatementProfile.currency, statementReference: ycbStatementProfile.statementReference, pageNumber: pageIndex + 1, pageCount: statementPageCount, periodStart: ycbStatementProfile.periodStart, periodEnd: ycbStatementProfile.periodEnd, issueDate: ycbStatementProfile.issueDate, firstReference: rows[0]?.operationNumber, lastReference: rows.at(-1)?.operationNumber, transactionCount: rows.length, creditCount: rows.filter((row) => row.credit > 0).length, debitCount: rows.filter((row) => row.debit > 0).length, totalCredit: rows.reduce((sum, row) => sum + row.credit, 0), totalDebit: rows.reduce((sum, row) => sum + row.debit, 0), openingBalance: statementPageSummaries[pageIndex]?.openingBalance ?? ycbStatementProfile.openingBalance, closingBalance: statementPageSummaries[pageIndex]?.closingBalance ?? ycbStatementProfile.closingBalance }))
      : Array.from({ length: statementPageCount }, (_, pageIndex) => buildVerificationBarcodePayload(statementReference, pageIndex + 1, statementPageCount, selectedBank === "tadhamon" ? "TADHAMON BANK" : "KURAIMI ISLAMIC BANK", statementPageSummaries[pageIndex]?.lastReference, statementPageSummaries[pageIndex]?.closingBalance));
    const generated = values.map((value) => {
      const svg = bwipjs.toSVG({ bcid: "pdf417", text: value, scaleX: 2, scaleY: 2, padding: 4, includetext: false, backgroundcolor: "FFFFFF", barcolor: selectedBank === "ycb" ? "2D3192" : "6B5297" });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    setBarcodeSources(generated);
  }, [selectedBank, statementPageCount, statementReference, statementPageGroups, statementPageSummaries, ycbStatementProfile]);

  const updateClient = (key: keyof typeof defaultClient, value: string) => {
    if (key === "employeeName" && lockedSignatureNames.employee) return;
    if (key === "managerName" && lockedSignatureNames.manager) return;
    setClient((current) => ({ ...current, [key]: value }));
    const rememberedField = ["name", "nameAr", "branch", "accountType", "accountNumber", "passport", "address", "placeOfBirth", "employeeName", "managerName"].includes(key);
    if (rememberedField && value.trim()) {
      rememberFieldValue(`${localMemoryPrefix}-${key}`, value);
      setFieldMemory((current) => mergeFieldMemory(current, key, value));
    }
    if (selectedBank === "ycb") {
      const ycbKeyMap: Partial<Record<keyof typeof defaultClient, keyof typeof ycbClient>> = {
        name: "name", passport: "passport", branch: "branch", customerSince: "customerSince", dateOfBirth: "dateOfBirth", placeOfBirth: "placeOfBirth", accountNumber: "accountNumber", accountType: "accountType", currency: "currency", opening: "opening", issueDate: "issueDate",
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
    const nextRows = buildImportedTransactions(rows, map, referenceSource === "excel", selectedBank || "karimi");
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
      const importedProfile = extractStatementProfile(matrix, discovery.headerRowIndex);
      const clientProfileMap: Record<string, keyof typeof defaultClient> = {
        customerName: "name", passport: "passport", address: "address", branch: "branch", accountNumber: "accountNumber", customerSince: "customerSince", dateOfBirth: "dateOfBirth", placeOfBirth: "placeOfBirth", accountType: "accountType", currency: "currency", issueDate: "issueDate", printDate: "printDate", periodStart: "periodStart", periodEnd: "periodEnd", employeeName: "employeeName", managerName: "managerName",
      };
      Object.entries(clientProfileMap).forEach(([profileKey, clientKey]) => {
        const value = importedProfile[profileKey as keyof typeof importedProfile];
        if (value) updateClient(clientKey, value);
      });
      if (importedProfile.openingBalance) updateClient("opening", importedProfile.openingBalance);
      if (importedProfile.totalCredit) setTotalCreditOverride(importedProfile.totalCredit);
      if (importedProfile.totalDebit) setTotalDebitOverride(importedProfile.totalDebit);
      if (importedProfile.closingBalance) setClosingBalanceOverride(importedProfile.closingBalance);
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

  const updateTransaction = (rowNumber: number, field: "date" | "description" | "branch" | "externalReference" | "operationNumber" | "debit" | "credit" | "balance", input: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => {
      if (transaction.rowNumber !== rowNumber) return transaction;
      if (field === "branch") return { ...transaction, branch: input };
      if (field === "operationNumber") return { ...transaction, operationNumber: input };
      if (field === "description") {
        const review = reviewDescription(input);
        return { ...transaction, description: review.description, rejected: !review.accepted, rejectionReason: review.reason, personName: review.personName, suggestedDescription: review.suggestedDescription };
      }
      if (field === "date") return { ...transaction, date: input, dateChangedFromExcel: Boolean(transaction.sourceDate && input !== transaction.sourceDate) };
      if (field === "externalReference") return { ...transaction, externalReference: input };
      if (field === "balance") return { ...transaction, balance: input.trim() === "" ? null : money(input) };
      return { ...transaction, [field]: money(input) };
    }));
  };

  const updateTransactionHighlight = (rowNumber: number, color: string) => {
    setRegisterDirty(true);
    setTransactions((current) => current.map((transaction) => transaction.rowNumber === rowNumber
      ? { ...transaction, highlightColor: color || undefined }
      : transaction));
  };

  const updateFastHighlight = (rowNumber: number, color: string) => {
    setFastHighlightColors((current) => ({ ...current, [rowNumber]: color || quickHighlightConfig.depositColor }));
  };
  const highlightDepositsWhite = (minimum?: number) => {
    const next = { ...fastHighlightColors };
    transactions.forEach((transaction) => {
      if (transaction.credit > 0 && (minimum === undefined || transaction.credit >= minimum)) next[transaction.rowNumber] = fastDepositColor;
    });
    setFastHighlightColors(next);
    setImportNote(minimum === undefined ? `تم تلوين جميع عمليات الإيداع باللون المختار.` : `تم تلوين الإيداعات من ${formatMoney(minimum)} فأعلى باللون المختار.`);
  };
  const colorQuickStatement = () => {
    if (selectedBank === "tadhamon") return;
    const next = Object.fromEntries(transactions.map((transaction) => [transaction.rowNumber, transaction.credit > 0 ? fastDepositColor : transaction.debit > 0 ? fastWithdrawalColor : ""]));
    setFastHighlightColors(next);
    setImportNote(`تم تطبيق لون الإيداعات والسحوبات على كشف السريع فقط. لم تتغير ألوان سجل العمليات أو الكشف الرسمي.`);
  };
  const applyFastKeywordColor = () => {
    const keyword = fastKeyword.trim().toLocaleLowerCase();
    if (!keyword) { setImportNote("اكتب كلمة البحث أولاً."); return; }
    const next = { ...fastHighlightColors };
    let matches = 0;
    transactions.forEach((transaction) => {
      if (transaction.credit > 0 && String(transaction.description || "").toLocaleLowerCase().includes(keyword)) {
        next[transaction.rowNumber] = fastKeywordColor;
        matches += 1;
      }
    });
    setFastHighlightColors(next);
    setImportNote(`تم تلوين ${matches} إيداع يحتوي وصفه على كلمة: ${fastKeyword}`);
  };
  const applyFastRowsPerPage = () => {
    const requested = Number(fastRowsPerPageInput);
    const next = Number.isFinite(requested) && requested > 0 ? Math.min(30, Math.floor(requested)) : 30;
    setFastRowsPerPage(next);
    setFastRowsPerPageInput(String(next));
    if (selectedBank && typeof window !== "undefined") {
      const current = loadQuickLocalSettings(selectedBank);
      window.localStorage.setItem(quickSettingsStorageKey(selectedBank), JSON.stringify({ ...current, rowsPerPage: next }));
    }
    setImportNote(`تم تحديث الكشف السريع إلى ${next} عملية كحد أقصى لكل صفحة.`);
  };
  const removeTransaction = (rowNumber: number) => {
    setTransactions((current) => current.filter((transaction) => transaction.rowNumber !== rowNumber));
    setRegisterDirty(true);
    setImportNote("تم حذف العملية من سجل الإدخال. اضغط تحديث/اعتماد لتطبيق الحذف على الكشف والكشف السريع.");
  };
  const applyTransactionRegister = () => {
    setAppliedTransactions(transactions.map((transaction) => ({ ...transaction })));
    setRegisterDirty(false);
    setImportNote(`تم تحديث الكشف والكشف السريع بنجاح. ${transactions.filter((item) => !item.rejected).length} عملية معتمدة تقود المعاينة والطباعة والرموز.`);
  };

  const ycbApprovedStatementHtml = useMemo(() => {
    if (selectedBank !== "ycb") return "";
    return renderYcbStatementPages(ycbStatementProfile, ycbStatementTransactions, statementQrSources, barcodeSources, {});
  }, [barcodeSources, selectedBank, statementQrSources, ycbStatementProfile, ycbStatementTransactions]);
  const tadhamonStatementHtml = useMemo(() => {
    if (selectedBank !== "tadhamon") return "";
    const profile: YcbStatementProfile = {
      customerName: documentClient.name, passport: documentClient.passport, address: documentClient.address,
      placeOfBirth: documentClient.placeOfBirth,
      dateOfBirth: dateOfBirthPlacement === "statement" || dateOfBirthPlacement === "both" ? formatEnglishGregorianDate(documentClient.dateOfBirth) : "",
      branchName: documentClient.branch, accountNumber: documentClient.accountNumber, accountType: documentClient.accountType,
      currency: documentClient.currency, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd,
      statementReference, openingBalance: money(documentClient.opening), closingBalance: reportedClosing,
      totalCredit: reportedTotalCredit, totalDebit: reportedTotalDebit, issueDate: documentPrintDate,
      printTime: formatMorningTime(documentClient.printTime),
    };
    const rows: YcbStatementTransaction[] = statementRows.map((row) => ({ date: displayStatementDate(row.date), reference: row.operationNumber, description: row.description, credit: row.credit, debit: row.debit, balance: row.balance, highlightColor: row.highlightColor }));
    return assemblePrintableStatementHtml(renderTadhamonStatementPages(profile, rows, statementQrSources, barcodeSources, {}));
  }, [barcodeSources, documentClient, dateOfBirthPlacement, documentPrintDate, documentPeriodEnd, documentPeriodStart, fastKeyword, fastKeywordColor, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statementQrSources, statementReference, statementRows]);
  const quickStatementHtml = useMemo(() => {
    if (!selectedBank) return "";
    const profile = selectedBank === "ycb"
      ? { ...ycbStatementProfile, bankName: quickHighlightConfig.label, openingDate: ycbClient.customerSince || documentClient.customerSince, holderNameAr: "", statementTime: formatMorningTime(documentClient.printTime), qrUri: statementQrSources.at(-1) || barcodeSources.at(-1) || referenceAssets.qrLogo }
      : { customerName: documentClient.name, passport: documentClient.momaizNo || documentClient.passport, address: documentClient.address, placeOfBirth: documentClient.placeOfBirth, dateOfBirth: formatEnglishGregorianDate(documentClient.dateOfBirth), branchName: documentClient.branch, accountNumber: documentClient.accountNumber, accountType: documentClient.accountType, currency: documentClient.currency, periodStart: documentPeriodStart, periodEnd: documentPeriodEnd, statementReference, openingBalance: money(documentClient.opening), closingBalance: reportedClosing, totalCredit: reportedTotalCredit, totalDebit: reportedTotalDebit, issueDate: documentPrintDate, openingDate: documentClient.customerSince, holderNameAr: selectedBank === "tadhamon" ? documentClient.nameAr : "", statementTime: formatMorningTime(documentClient.printTime), qrUri: statementQrSources.at(-1) || barcodeSources.at(-1) || referenceAssets.qrLogo, bankName: quickHighlightConfig.label };
    const rows = statementRows.map((row) => ({ date: displayStatementDate(row.date), reference: row.operationNumber, description: row.description, credit: row.credit, debit: row.debit, balance: row.balance, highlightColor: fastHighlightColors[row.rowNumber] || ((row.credit || 0) > 0 ? fastDepositColor : (row.debit || 0) > 0 ? fastWithdrawalColor : "") }));
    const keyword = fastKeyword.trim().toLocaleLowerCase();
    const keywordHighlights = keyword ? Object.fromEntries(rows.filter((row) => (row.credit || 0) > 0 && String(row.description || "").toLocaleLowerCase().includes(keyword)).map((row) => [row.reference, fastKeywordColor])) : {};
    const fastHighlights = { ...Object.fromEntries(rows.filter((row) => ((row.credit || 0) > 0 || (row.debit || 0) > 0) && row.highlightColor).map((row) => [row.reference, row.highlightColor as string])), ...keywordHighlights };
    return renderTadhamonFastStatementPages(profile, rows, fastHighlights, fastRowsPerPage);
  }, [barcodeSources, documentClient, documentPrintDate, documentPeriodEnd, fastDepositColor, fastWithdrawalColor, quickHighlightConfig.label, reportedClosing, reportedTotalCredit, reportedTotalDebit, selectedBank, statementQrSources, statementReference, statementRows, fastHighlightColors, fastKeyword, fastKeywordColor, fastRowsPerPage, ycbClient.customerSince, ycbStatementProfile]);
  const printableStatementHtml = useMemo(() => selectedBank === "ycb" ? ycbApprovedStatementHtml : selectedBank === "tadhamon" ? tadhamonStatementHtml : assemblePrintableStatementHtml(statementPageHtml), [selectedBank, statementPageHtml, tadhamonStatementHtml, ycbApprovedStatementHtml]);

  const printDocument = (kind: PrintDocumentKind) => {
    if (isPrintHoliday) { setImportNote(`لا يمكن إصدار الكشف في يوم ${printHolidayLabel}. الخميس والجمعة عطلة. غيّر تاريخ الطباعة ثم حاول مرة أخرى.`); return; }
    const statementHtml = printableStatementHtml;
    const selected = selectPrintableDocument(kind, accountStatusHtml, statementHtml, quickStatementHtml);
    const person = client.name.trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
    if (!openPrintWindow(selected.html, person ? `${person} - ${selected.title}` : selected.title)) {
      setImportNote("The browser blocked the print window. Please allow pop-ups for this site and try again.");
    }
  };

  const downloadPdf = async (kind: PrintDocumentKind) => {
    if (isPrintHoliday) { setImportNote(`لا يمكن إصدار PDF في يوم ${printHolidayLabel}. الخميس والجمعة عطلة.`); return; }
    const statementHtml = printableStatementHtml;
    const selected = selectPrintableDocument(kind, accountStatusHtml, statementHtml, quickStatementHtml);
    setDownloadingDocument(kind);
    try {
      const previewTitle = kind === "accountStatus" ? "Account Status Statement print preview" : kind === "accountStatement" ? "Account Statement print preview" : "";
      const previewDocument = previewTitle
        ? document.querySelector<HTMLIFrameElement>(`iframe[title="${previewTitle}"]`)?.contentDocument || undefined
        : undefined;
      const opened = await downloadDocumentPdf(kind, selected.html, client.name, previewDocument);
      setImportNote(opened ? `${selected.title} downloaded as a flattened PDF image.` : "The PDF could not be created. Please try again after confirming the preview is fully visible.");
    } catch (error) {
      console.error("Direct PDF generation failed", error);
      setImportNote("The PDF could not be created. Please try again after confirming the preview is fully visible.");
    } finally {
      setDownloadingDocument(null);
    }
  };
  const openTadhamonStatement = () => {
    setReviewPreview("accountStatement");
    setActiveTab("review");
  };
  const refreshMainStatementPreview = () => {
    refreshAllDocumentData();
    setActiveTab("review");
    setReviewPreview("accountStatement");
  };

  const updateYcbClient = (key: keyof typeof ycbClient, value: string) => {
    setYcbClient((current) => ({ ...current, [key]: value }));
  };

  const refreshAllDocumentData = () => {
    const committedTransactions = transactions.map((transaction) => ({ ...transaction }));
    setAppliedTransactions(committedTransactions);
    setRegisterDirty(false);
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
    const refreshedPayload = { ...snapshotPayload, transactions: committedTransactions, appliedTransactions: committedTransactions };
    saveSnapshotMutation.mutate({ workspaceKey, payload: refreshedPayload }, {
      onSuccess: (result) => setSnapshotState(result.saved ? "saved" : "error"),
      onError: () => setSnapshotState("error"),
    });
    setImportNote(`تم تحديث البيانات بنجاح. ${committedTransactions.filter((item) => !item.rejected).length} عملية أصبحت معتمدة في الكشف والكشف السريع والرموز.`);
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
    setFastHighlightColors({});
    setFastMinimumDeposit("");
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
        {selectedBank && <button type="button" className={activeTab === "fastStatement" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("fastStatement")}><FileText size={18} /><span>كشف سريع — {quickHighlightConfig.label}<small>Quick Statement Print</small></span></button>}
        <button type="button" className={activeTab === "barcodes" ? "sidebar-link is-active" : "sidebar-link"} onClick={() => setActiveTab("barcodes")}><Receipt size={18} /><span>فحص الرموز<small>QR & Barcode Check</small></span></button>
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
        <div className="header-actions"><div className="reference-badge"><ShieldCheck size={17} /> {selectedBank === "ycb" ? "بنك اليمن التجاري · جلسة مستقلة" : selectedBank === "tadhamon" ? "بنك التضامن · جلسة مستقلة" : "بنك الكريمي · جلسة محمية"}</div><div className="header-quick-actions"><button type="button" className="secondary-button" onClick={() => void saveCurrentSnapshot()} disabled={snapshotState === "loading"}><Database size={15} /> حفظ</button><button type="button" className="secondary-button" onClick={() => void postToRecords()}><FolderOpen size={15} /> ترحيل</button><button type="button" className="secondary-button" onClick={startNewData}><FileText size={15} /> بيانات جديدة</button><button type="button" className="secondary-button" onClick={startNewData}><Trash2 size={15} /> مسح الجلسة</button><button type="button" className="secondary-button" onClick={() => void postAndStartNewData()}><FolderOpen size={15} /> ترحيل ومسح</button><button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={15} /> تحديث</button></div></div>
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
        <div><span>Staging database</span><strong>{stagingHealth.isLoading ? "Checking…" : stagingHealth.data?.database === "ready" ? `${stagingHealth.data.tableCount} tables ready` : "Unavailable"}</strong>{stagingHealth.data?.database === "error" && <small role="alert">{stagingHealth.data.message}</small>}<button type="button" className="secondary-button" onClick={() => void stagingHealth.refetch?.()} disabled={stagingHealth.isFetching}>{stagingHealth.isFetching ? "Checking…" : "تحديث اتصال قاعدة البيانات / Refresh DB"}</button></div>
        <div><span>Reference documents</span><strong>No visual changes</strong></div>
      </section>

      {tabWarnings.length > 0 && <aside className="tab-warning" role="status">
        <AlertTriangle size={18} />
        <div><strong>تنبيهات التبويبات المهمة / Important tab warnings</strong><span>{tabWarnings.join(" · ")}</span><small>تنبيه للمراجعة فقط — لا يمنع الحفظ أو الترحيل أو الطباعة. / Review only — saving, posting, and printing remain available.</small></div>
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

      {activeTab === "fastStatement" && selectedBank && <section className="panel print-preview-panel" dir="rtl">
        <div className="panel-heading"><div><h2>{quickHighlightConfig.label} — طبعة كشف حساب سريع / Quick Account Statement</h2><p className="hint">مسار مستقل وسريع يعتمد على نفس بيانات العميل والسجل المعتمد، ولا يغيّر القالب الرسمي أو تصميم بيان الحالة.</p></div><FileText size={26} className="heading-icon" /></div>
        <div className="review-grid"><div className="validation-card"><span>العميل / Customer</span><strong>{(selectedBank === "ycb" ? ycbClient.name : client.name) || "—"}</strong><small>{(selectedBank === "ycb" ? ycbClient.accountNumber : client.accountNumber) || "Account number required"}</small></div><div className="validation-card"><span>الرصيد الختامي / Closing</span><strong>{formatMoney(reportedClosing)}</strong><small>{selectedBank === "ycb" ? ycbClient.currency : client.currency}</small></div><div className="validation-card"><span>العمليات / Transactions</span><strong>{acceptedRows.length}</strong><small>From the applied register</small></div><div className="validation-card"><span>الفترة / Period</span><strong>{documentPeriodStart} — {documentPeriodEnd}</strong><small>Quick print only</small></div></div>
        <div className="actions"><span className="computed-field"><span>عدد العمليات لكل صفحة / Rows per page</span><strong>32</strong></span><label className="computed-field"><span>لون الكشف المعتمد / Active Statement Color</span><input className="transaction-edit-input" aria-label="لون الكشف المعتمد / Active Statement Color" type="color" value={fastDepositColor} onChange={(event) => setFastDepositColor(event.target.value)} /></label><button type="button" className="secondary-button" onClick={colorQuickStatement} disabled={selectedBank === "tadhamon"}><RefreshCcw size={17} /> تلوين الكشف السريع / Color Quick Statement</button><button type="button" className="secondary-button" onClick={() => highlightDepositsWhite()}><RefreshCcw size={17} /> تطبيق اللون على الإيداعات / Apply Color to Deposits</button><label className="computed-field"><span>لون عمليات الإيداع / Deposit Color</span><input className="transaction-edit-input" aria-label="لون الإيداعات / Deposit Color" type="color" value={fastDepositColor} onChange={(event) => setFastDepositColor(event.target.value)} /></label><label className="computed-field"><span>لون عمليات السحب / Withdrawal Color</span><input className="transaction-edit-input" aria-label="لون السحوبات / Withdrawal Color" type="color" value={fastWithdrawalColor} onChange={(event) => setFastWithdrawalColor(event.target.value)} /></label><label className="computed-field"><span>حد مبلغ الإيداع / Minimum Deposit</span><input className="transaction-edit-input" type="number" min="0" step="0.01" dir="ltr" value={fastMinimumDeposit} onChange={(event) => setFastMinimumDeposit(event.target.value)} placeholder="100.00" /></label><button type="button" className="secondary-button" onClick={() => { const minimum = money(fastMinimumDeposit); if (minimum > 0) highlightDepositsWhite(minimum); }} disabled={!fastMinimumDeposit.trim() || money(fastMinimumDeposit) <= 0}><RefreshCcw size={17} /> تحديث حسب المبلغ / Apply Minimum</button><div className="keyword-color-controls" style={{ display: "flex", gap: "10px", alignItems: "end", flexWrap: "wrap", width: "100%", padding: "12px", border: "1px solid #dbe3ec", borderRadius: "8px", background: "#f8fafc" }}><label className="computed-field"><span>كلمة البحث في الإيداعات / Deposit Keyword</span><input className="transaction-edit-input" value={fastKeyword} onChange={(event) => setFastKeyword(event.target.value)} placeholder="مثال: إيداع أو راتب" /></label><label className="computed-field"><span>لون الوصف المطابق / Match Color</span><input className="transaction-edit-input" aria-label="لون الكلمة المطابقة / Match Color" type="color" value={fastKeywordColor} onChange={(event) => setFastKeywordColor(event.target.value)} /></label><button type="button" className="secondary-button" onClick={applyFastKeywordColor} disabled={!fastKeyword.trim()}>تطبيق على الأوصاف المطابقة / Apply</button><small style={{ color: "#475569", width: "100%" }}>يتم تلوين الإيداعات المطابقة فقط؛ السحوبات وباقي العمليات لا تتغير، والخط يبقى أسوداً. / Deposits only; all other rows stay unchanged.</small></div><button type="button" className="preview-button" onClick={() => openPrintWindow(quickStatementHtml, `${quickHighlightConfig.label} — Quick Account Statement`)}><FileText size={17} /> معاينة / Preview</button><button type="button" onClick={() => void downloadDocumentPdf("accountStatement", quickStatementHtml, selectedBank === "ycb" ? ycbClient.name : client.name)}><Printer size={17} /> طباعة / Print</button><button type="button" className="unified-print-button" onClick={() => printDocument("unifiedAll")}><Printer size={17} /> طباعة موحدة / Unified Print</button></div>
        {transactions.length > 0 && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Reference</th><th>Color</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{transactions.map((row) => <tr key={`fast-${row.rowNumber}-${row.operationNumber}`}><td>{displayStatementDate(row.date)}</td><td dir="ltr">{row.operationNumber}</td><td><label className="operation-color-control"><span className="sr-only">لون العملية {row.operationNumber}</span><input aria-label={`Quick highlight ${row.operationNumber}`} type="color" value={fastHighlightColors[row.rowNumber] || fastDepositColor} onChange={(event) => updateFastHighlight(row.rowNumber, event.target.value)} /><select aria-label={`Quick preset color ${row.operationNumber}`} value={fastHighlightColors[row.rowNumber] || fastDepositColor} onChange={(event) => updateFastHighlight(row.rowNumber, event.target.value)}><option value={fastDepositColor}>لون البنك الافتراضي / Bank default</option><option value="#ffed00">أصفر فاتح</option><option value="#e5e7eb">أسود فاتح</option><option value="#dcfce7">أخضر فاتح</option><option value="#dbeafe">أزرق فاتح</option><option value="#fef9c3">أصفر خفيف</option><option value="#fee2e2">أحمر فاتح</option></select><button type="button" className="secondary-button" title="إرجاع لون الكشف الافتراضي" onClick={() => updateFastHighlight(row.rowNumber, fastDepositColor)}>إعادة</button></label></td><td>{row.description}</td><td>{row.debit ? formatMoney(row.debit) : "—"}</td><td>{row.credit ? formatMoney(row.credit) : "—"}</td><td>{formatMoney(row.balance || 0)}</td></tr>)}</tbody></table></div>}
        <div className="actions"><button type="button" className="unified-print-button" onClick={() => void downloadDocumentPdf("accountStatement", quickStatementHtml, selectedBank === "ycb" ? ycbClient.name : client.name)} disabled={downloadingDocument === "accountStatement"}><Printer size={17} /> {downloadingDocument === "accountStatement" ? "جارٍ تجهيز PDF…" : "حفظ الكشف السريع PNG/PDF"}</button><button type="button" className="unified-print-button" onClick={() => void downloadPdf("unifiedAll")} disabled={downloadingDocument === "unifiedAll"}><Printer size={17} /> {downloadingDocument === "unifiedAll" ? "جارٍ تجهيز الحزمة…" : "حفظ الموحد PNG/PDF"}</button></div><div className="document-frame-wrap"><iframe key={`quick-preview-${fastRowsPerPage}-${quickStatementHtml.length}`} className="document-frame" title={`${quickHighlightConfig.label} quick account statement preview`} srcDoc={quickStatementHtml} /></div>
      </section>}

      {activeTab === "barcodes" && <section className="panel print-preview-panel" dir="rtl">
        <div className="panel-heading"><div><h2>فحص QR وBarcode / Code Check</h2><p className="hint">فحص سريع يوضح رمز التحقق المستخدم في بيان الحالة وكل صفحة من صفحات الكشف.</p></div><Receipt size={26} className="heading-icon" /></div>
        <div className="review-grid"><div className="validation-card"><span>بيان الحالة</span><strong>{statusQrSource ? "جاهز للقراءة" : "غير متوفر"}</strong><small>QR status document</small></div><div className="validation-card"><span>صفحات الكشف</span><strong>{statementQrSources.length} QR</strong><small>{barcodeSources.length} Barcode</small></div><div className="validation-card"><span>حالة الرموز</span><strong>{statementQrSources.length || barcodeSources.length ? "محدّثة" : "تحتاج تحديث"}</strong><small>Generated from current applied data</small></div></div>
        <div className="table-wrap"><table><thead><tr><th>الصفحة</th><th>QR</th><th>Barcode</th><th>الحالة</th></tr></thead><tbody>{Array.from({ length: Math.max(statementQrSources.length, barcodeSources.length, 1) }, (_, index) => <tr key={`code-check-${index}`}><td dir="ltr">{index + 1}</td><td>{statementQrSources[index] ? <img src={statementQrSources[index]} alt={`QR page ${index + 1}`} style={{ width: 48, height: 48, objectFit: "contain" }} /> : "—"}</td><td>{barcodeSources[index] ? <img src={barcodeSources[index]} alt={`Barcode page ${index + 1}`} style={{ width: 150, height: 42, objectFit: "contain" }} /> : "—"}</td><td>{statementQrSources[index] || barcodeSources[index] ? "جاهز" : "غير متوفر"}</td></tr>)}</tbody></table></div>
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
            <label>اسم العميل / Customer name<input list="memory-name" value={client.name} onChange={(event) => updateClient("name", event.target.value)} placeholder="Name as shown on the statement" /><datalist id="memory-name">{fieldMemory.name?.map((value) => <option key={value} value={value} />)}</datalist></label>
            {selectedBank === "tadhamon" && <label>الاسم بالعربية / Arabic name<input dir="rtl" value={client.nameAr} onChange={(event) => updateClient("nameAr", event.target.value)} placeholder="الاسم كما يظهر في الكشف السريع" /></label>}
            {selectedBank === "ycb" && <><label>العنوان / Address <span className="field-note">يظهر في الكشف / Shown on statement</span><input value={ycbClient.address} onChange={(event) => updateYcbClient("address", event.target.value)} placeholder="Street, area, city" /></label><label>تاريخ الميلاد / Date of birth <span className="field-note">اختياري / Optional</span><input type="date" value={ycbClient.dateOfBirth} onChange={(event) => updateYcbClient("dateOfBirth", event.target.value)} /></label><label>مكان الميلاد / Place of birth <span className="field-note">اختياري / Optional</span><input value={ycbClient.placeOfBirth} onChange={(event) => updateYcbClient("placeOfBirth", event.target.value)} placeholder="City, country" /></label></>}
            {selectedBank === "tadhamon" && <><label>العنوان / Address <span className="field-note">يظهر في كشف التضامن / Shown on Tadhamon statement</span><input value={client.address} onChange={(event) => updateClient("address", event.target.value)} placeholder="Street, area, city" /></label><label>مكان الميلاد / Place of birth <span className="field-note">اختياري / Optional</span><input value={client.placeOfBirth} onChange={(event) => updateClient("placeOfBirth", event.target.value)} placeholder="City, country" /></label></>}
            {selectedBank !== "ycb" && <label>رقم المميز / Momaiz No.<input dir="ltr" value={client.momaizNo} onChange={(event) => updateClient("momaizNo", event.target.value)} /></label>}
            <label>رقم الجواز / Passport No. <span className="field-note">اختياري / Optional</span><input list="memory-passport" dir="ltr" value={client.passport} onChange={(event) => updateClient("passport", event.target.value)} /><datalist id="memory-passport">{fieldMemory.passport?.map((value) => <option key={value} value={value} />)}</datalist></label>
            <label className="wide">اسم الفرع / Branch name<input list="memory-branch" dir="ltr" value={client.branch} onChange={(event) => updateClient("branch", event.target.value)} placeholder="Branch Name" /><datalist id="memory-branch">{fieldMemory.branch?.map((value) => <option key={value} value={value} />)}</datalist></label>
            <label>تاريخ بدء العميل / Customer since {selectedBank === "tadhamon" && <span className="field-note">يظهر في بيان الحالة / Shown on status statement</span>}<input type="date" lang="en-GB" value={client.customerSince} onChange={(event) => updateClient("customerSince", event.target.value)} /></label>
            {selectedBank !== "ycb" && <label>تاريخ الميلاد / Date of birth <span className="field-note">اختياري / Optional</span><input type="date" lang="en-GB" value={client.dateOfBirth} onChange={(event) => updateClient("dateOfBirth", event.target.value)} /></label>}
            <label>نوع الحساب / Account Type<input list="memory-account-type" dir="ltr" value={client.accountType} onChange={(event) => updateClient("accountType", event.target.value)} /><datalist id="memory-account-type">{fieldMemory.accountType?.map((value) => <option key={value} value={value} />)}</datalist></label>
            <label>رقم الحساب / Account Number<input list="memory-account-number" dir="ltr" value={client.accountNumber} onChange={(event) => updateClient("accountNumber", event.target.value)} /><datalist id="memory-account-number">{fieldMemory.accountNumber?.map((value) => <option key={value} value={value} />)}</datalist></label>
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
        {(selectedBank === "karimi" || selectedBank === "tadhamon") && <section className="panel karimi-signature-panel">
          <h2>بيانات التوقيع / Signature Details</h2>
          <p className="hint">تظهر هذه البيانات في مستند البنك المختار، وترتبط تلقائيًا بمسار البيان.</p>
          <div className="grid">
            <label>اسم الموظف / Employee name<input list="memory-employee" value={client.employeeName} disabled={lockedSignatureNames.employee} onChange={(event) => updateClient("employeeName", event.target.value)} /><datalist id="memory-employee">{fieldMemory.employeeName?.map((value) => <option key={value} value={value} />)}</datalist><span className="field-note"><input type="checkbox" checked={lockedSignatureNames.employee} onChange={(event) => setLockedSignatureNames((current) => ({ ...current, employee: event.target.checked }))} /> تثبيت اسم الموظف / Keep fixed</span></label>
            <label>اسم المدير / Manager name<input list="memory-manager" value={client.managerName} disabled={lockedSignatureNames.manager} onChange={(event) => updateClient("managerName", event.target.value)} /><datalist id="memory-manager">{fieldMemory.managerName?.map((value) => <option key={value} value={value} />)}</datalist><span className="field-note"><input type="checkbox" checked={lockedSignatureNames.manager} onChange={(event) => setLockedSignatureNames((current) => ({ ...current, manager: event.target.checked }))} /> تثبيت اسم المدير / Keep fixed</span></label>
          </div>
        </section>}
        <section className="panel">
          <h2>بيان الحالة / Account Status Fields</h2>
          <p className="hint">هذه الحقول تظهر في بيان الحالة فقط / These fields appear only on the Account Status Statement. Totals update before printing.</p>
          <div className="grid">
            <label>تاريخ الإصدار / Issue Date<input type="date" lang="en-GB" value={client.issueDate} onChange={(event) => updateClient("issueDate", event.target.value)} /></label>
            <label>تاريخ الطباعة / Print Date <span className="field-note">اليوم الافتراضي / Today by default</span><input type="date" lang="en-GB" value={client.printDate} onChange={(event) => updateClient("printDate", event.target.value)} /><small style={{ color: isPrintHoliday ? "#b91c1c" : "#166534", fontWeight: 700 }}>{isPrintHoliday ? `تنبيه: ${printHolidayLabel} عطلة — الإصدار مرفوض.` : "يوم دوام — الإصدار مسموح."}</small></label>
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
            <label>إجمالي السحب / Total Debit <span className="field-note">قابل للتعديل / Editable</span><input aria-label="Total debit (editable)" inputMode="decimal" dir="ltr" value={totalDebitOverride} placeholder={formatMoney(totalDebit)} onChange={(event) => setTotalDebitOverride(event.target.value)} /></label><label>الرصيد الختامي / Closing Balance <span className="field-note">من Excel أو محسوب تلقائيًا / Excel or automatic</span><input aria-label="Closing balance (editable)" inputMode="decimal" dir="ltr" value={closingBalanceOverride} placeholder={formatMoney(calculatedClosing)} onChange={(event) => setClosingBalanceOverride(event.target.value)} /></label>
            <div className="computed-field"><span>الإيداع المعتمد / Reported Credit</span><strong>{formatMoney(reportedTotalCredit)}</strong><small>{totalCreditOverride.trim() ? "تعديل يدوي / Manual override" : "من الحركات المقبولة / From accepted transactions"}</small></div>
            <div className="computed-field"><span>السحب المعتمد / Reported Debit</span><strong>{formatMoney(reportedTotalDebit)}</strong><small>{totalDebitOverride.trim() ? "تعديل يدوي / Manual override" : "من الحركات المقبولة / From accepted transactions"}</small></div>
            <div className="computed-field"><span>الرصيد الختامي / Closing Balance</span><strong>{formatMoney(reportedClosing)}</strong></div>
            <div className="computed-field"><span>الحركات المقبولة / Accepted Transactions</span><strong>{acceptedRows.length}</strong></div>
            <label className="computed-field reference-field">مرجع الكشف / Statement Reference<input className="transaction-edit-input" dir="ltr" value={statementReferenceOverride || statementReference} onChange={(event) => setStatementReferenceOverride(event.target.value)} aria-label="Statement Reference" /><small>يُولد حسب البنك والحساب والعميل وآخر رقم عملية، ويمكن تغييره يدويًا.</small></label>
          </div>
        </section>
        <div className="actions"><button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={17} /> تحديث البيانات / Refresh document data</button>{selectedBank === "tadhamon" && <button type="button" className="preview-button" onClick={openTadhamonStatement}><FileText size={17} /> فتح كشف الحساب الأصلي / Open Original Account Statement</button>}</div>
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
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th>{includeBranch && <th>Branch</th>}{referenceSource === "excel" && <th>Excel Reference</th>}<th>Operation No.</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Highlight</th><th>Status</th><th>إجراء</th></tr></thead><tbody>
            {transactions.map((row) => <tr className={row.rejected || row.dateChangedFromExcel ? "invalid-row" : ""} key={`${row.rowNumber}-${row.operationNumber}`}><td><input className="transaction-edit-input" type="date" lang="en-GB" value={row.date} onChange={(event) => updateTransaction(row.rowNumber, "date", event.target.value)} />{row.dateChangedFromExcel && <small style={{ color: "#b91c1c", display: "block", fontWeight: 700 }}>تغير تاريخ Excel — راجع رقم المرجع</small>}</td><td><div className="description-cell"><input className="transaction-edit-input" value={row.description} onChange={(event) => updateTransaction(row.rowNumber, "description", event.target.value)} />{!row.rejected && row.suggestedDescription && row.suggestedDescription !== row.description && <button type="button" className="description-suggestion" onClick={() => applySuggestedDescription(row.operationNumber)}>Use suggestion: <b dir="ltr">{row.suggestedDescription}</b></button>}</div></td>{includeBranch && <td><input className="transaction-edit-input" value={row.branch} onChange={(event) => updateTransaction(row.rowNumber, "branch", event.target.value)} /></td>}{referenceSource === "excel" && <td><input className="transaction-edit-input" dir="ltr" value={row.externalReference} onChange={(event) => updateTransaction(row.rowNumber, "externalReference", event.target.value)} /></td>}<td><input className="transaction-edit-input" dir="ltr" aria-label={`Operation number ${row.rowNumber}`} value={row.operationNumber} onChange={(event) => updateTransaction(row.rowNumber, "operationNumber", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.debit || ""} onChange={(event) => updateTransaction(row.rowNumber, "debit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.credit || ""} onChange={(event) => updateTransaction(row.rowNumber, "credit", event.target.value)} /></td><td><input className="transaction-edit-input" type="number" step="0.01" value={row.balance ?? ""} onChange={(event) => updateTransaction(row.rowNumber, "balance", event.target.value)} /></td><td><label title="تلوين الحركة"><input aria-label={`Highlight ${row.operationNumber}`} type="checkbox" checked={Boolean(row.highlightColor)} onChange={(event) => updateTransactionHighlight(row.rowNumber, event.target.checked ? "#FEF08A" : "")} /> ✓</label><input aria-label={`Highlight color ${row.operationNumber}`} type="color" value={row.highlightColor || "#FEF08A"} onChange={(event) => updateTransactionHighlight(row.rowNumber, event.target.value)} /></td><td>{row.rejected ? <span className="row-alert"><AlertTriangle size={14} /> Rejected</span> : <span className="row-ok"><CheckCircle2 size={14} /> Ready for review</span>}</td><td><button type="button" className="secondary-button" title="حذف العملية" onClick={() => removeTransaction(row.rowNumber)}><Trash2 size={14} /> حذف</button></td></tr>)}
          </tbody></table></div>
          <div className="actions"><button type="button" onClick={applyTransactionRegister} disabled={!registerDirty}><CheckCircle2 size={17} /> {registerDirty ? "Apply Register Changes" : "Register Applied"}</button></div>
        </section>}
      </>}

      {activeTab === "history" && <section className="panel history-panel"><div className="panel-heading"><div><h2>Saved Statement History</h2><p className="hint">Open a saved statement to edit its data or transactions, then print it again.</p></div><Database size={26} className="heading-icon" /></div>{historyQuery.isLoading ? <p className="hint">Loading saved statements…</p> : historyQuery.isError ? <p className="tab-warning" role="alert">تعذر تحميل السجلات. تحقق من اتصال قاعدة البيانات ثم أعد المحاولة. / Could not load records. Check the database connection and try again.</p> : (historyQuery.data as HistoryItem[] || []).length === 0 ? <p className="hint">No saved statements yet. Save one from Review & Export.</p> : <div className="history-list">{(historyQuery.data as HistoryItem[]).map((item) => <article className="history-item" key={item.id}><div><strong>{item.title}</strong><small>{item.customer_name || "—"} · {item.account_number || "—"} · Updated {new Date(item.updated_at).toLocaleString()}</small></div><div className="actions"><button type="button" onClick={() => void openStatementHistory(item.id)} disabled={getHistoryQuery.isLoading}><FolderOpen size={16} /> {getHistoryQuery.isLoading && selectedHistoryId === item.id ? "Loading…" : "Edit / Restore"}</button><button type="button" className="preview-button" onClick={() => void openStatementHistory(item.id, true)} disabled={getHistoryQuery.isLoading}><Printer size={16} /> Print</button><button type="button" className="secondary-button" onClick={() => void deleteStatementHistory(item.id)} disabled={deleteHistoryMutation.isPending}><Trash2 size={16} /> Delete</button></div></article>)}</div>}</section>}
      {activeTab === "review" && <section className="panel review-panel">
        <div className="panel-heading"><div><span className="section-kicker">Step 3 of 3</span><h2>Review & Export</h2><p className="hint">{selectedBank === "ycb" ? "Review and print the approved Yemen Commercial Bank statement from one official template." : selectedBank === "tadhamon" ? "Review and print the approved Tadhamon Bank statement from its independent official template." : "Review the connected statement first, then print the Account Status Statement after it as one combined PDF/print job."}</p></div><FileText size={26} className="heading-icon" /></div>
        <div className="preview-assurance"><CheckCircle2 size={18} /><span><strong>Connected preview</strong> uses the applied register and shared customer fields. {selectedBank === "ycb" ? "The official YCB artwork, QR code, and page arrangement are preserved." : selectedBank === "tadhamon" ? "The official Tadhamon artwork, QR code, and page arrangement are preserved." : "The official AlKuraimi artwork, QR code, and page arrangement are preserved."}</span></div>
        {financialAudit.issues.length > 0 && <aside className="tab-warning" role="alert"><AlertTriangle size={18} /><div><strong>مراجعة التدقيق المالي / Financial Audit Review ({financialAudit.issues.length})</strong><small>هذه ملاحظات مراجعة وليست أخطاء حاجبة. الحفظ والطباعة متاحان مهما كان العدد. / Review notes only; they never block saving or printing.</small><ul className="audit-issue-list">{financialAudit.issues.map((issue, index) => { const guidance = financialAuditGuidance(issue); return <li key={`${issue.type}-${issue.rowNumber || "total"}-${index}`}><strong>{index + 1}. {guidance.row}</strong><span>{issue.message}</span><small>{guidance.solution}</small></li>; })}</ul></div></aside>}
          <div className="review-grid"><div className="validation-card"><span>Customer status / حالة العميل</span><strong>{missingCustomerFields.length === 0 ? "Ready for review / جاهز للمراجعة" : "Customer details required / بيانات ناقصة"}</strong><small>{missingCustomerFields.length > 0 ? `الناقص: ${missingCustomerFields.join("، ")} / Missing: ${missingCustomerFields.join(", ")}` : "الحقول الأساسية مكتملة. الحقول الأخرى اختيارية حسب نوع المستند."}</small></div><div className="validation-card"><span>Transaction status</span><strong>{acceptedRows.length ? `${acceptedRows.length} accepted transactions` : "No transactions imported"}</strong><small>{rejectedRows.length ? `${rejectedRows.length} rejected rows remain visible for review.` : "No rejected rows currently."}</small></div><div className="validation-card"><span>Page limit</span><strong>18 transactions per page</strong><small>Current estimate: {Math.max(1, Math.ceil(acceptedRows.length / MAX_TRANSACTIONS_PER_PAGE))} statement page(s).</small></div><div className="validation-card"><span>Local browser memory</span><strong>{descriptionMemory.length} descriptions · {nameMemory.length} names</strong><small>Stored in this browser only and not sent to another service.</small></div></div>
        <div className="review-actions" aria-label="Document actions / إجراءات المستندات">
          <div className="review-action-group">
            <span className="review-action-label">البيانات / Data</span>
            <button type="button" className="secondary-button" onClick={() => void saveStatementHistory()} disabled={createHistoryMutation.isPending || updateHistoryMutation.isPending}><Database size={17} /> {editingHistoryId ? "تحديث السجل / Update Record" : "حفظ السجل / Save Record"}</button>
            <button type="button" className="secondary-button" onClick={refreshAllDocumentData}><RefreshCcw size={17} /> تحديث البيانات / Refresh Data</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">المعاينة / Preview</span>
            <button type="button" className="secondary-button" onClick={refreshMainStatementPreview}><RefreshCcw size={16} /> تحديث معاينة الكشف الرئيسي / Refresh Main Statement</button>
            <button type="button" className="preview-button" onClick={() => setReviewPreview("accountStatus")}><FileText size={17} /> {selectedBank === "tadhamon" ? "معاينة بيان الحالة — بنك التضامن / Tadhamon Status Preview" : "معاينة بيان البنك / Bank Status Preview"}</button>
            <button type="button" className="preview-button" onClick={() => setReviewPreview("accountStatement")}><FileText size={17} /> View Account Statement</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">الطباعة / Print</span>
            <button type="button" className="unified-print-button" onClick={() => printDocument("accountStatus")}><Printer size={17} /> {selectedBank === "tadhamon" ? "طباعة بيان الحالة — بنك التضامن / Print Tadhamon Status" : "طباعة بيان البنك / Print Bank Status"}</button>
            <button type="button" className="unified-print-button" onClick={() => printDocument("unified")}><Printer size={17} /> الطباعة الموحدة للبيان والكشف / Unified: Status then Statement</button>
            <button type="button" className="unified-print-button" onClick={() => printDocument("accountStatement")}><Printer size={17} /> طباعة كشف الحساب / Print Account Statement</button>
          </div>
          <div className="review-action-group">
            <span className="review-action-label">حفظ PDF كصورة / Save Image PDF</span>
            <button type="button" className="preview-button" disabled={downloadingDocument === "accountStatus"} onClick={() => void downloadPdf("accountStatus")}><Download size={17} /> {downloadingDocument === "accountStatus" ? "جارٍ الفتح… / Opening…" : selectedBank === "tadhamon" ? "حفظ بيان الحالة — بنك التضامن PDF / Save Tadhamon Status PDF" : "حفظ بيان البنك PDF / Save Bank Status PDF"}</button>
            <button type="button" className="preview-button" disabled={downloadingDocument === "accountStatement"} onClick={() => void downloadPdf("accountStatement")}><Download size={17} /> {downloadingDocument === "accountStatement" ? "جارٍ الفتح… / Opening…" : "حفظ كشف الحساب PDF / Save Account Statement PDF"}</button>
          </div>
          <button type="button" className="secondary-button" onClick={downloadSessionJson}><RefreshCcw size={17} /> تنزيل جلسة JSON / Download Session JSON</button>
        </div>
        {reviewPreview && <section className="print-preview-panel" aria-label="Document preview before print"><div className="panel-heading"><div><h2>{reviewPreview === "accountStatus" ? "Account Status Statement Preview" : "Account Statement Preview"}</h2><p className="hint">{selectedBank === "tadhamon" && reviewPreview === "accountStatement" ? "The Tadhamon preview is isolated to the official statement template and current Tadhamon register." : "Review the original artwork, QR code, values, and page arrangement before printing or downloading."}</p></div><div className="actions"><button type="button" className="secondary-button" onClick={() => setReviewPreview(null)}>Close Preview</button><button type="button" className="preview-button" onClick={() => printDocument(reviewPreview)}><Printer size={17} /> طباعة / Print</button><button type="button" className="unified-print-button" onClick={() => void downloadPdf(reviewPreview)} disabled={downloadingDocument === reviewPreview}><Printer size={17} /> {downloadingDocument === reviewPreview ? "جارٍ تجهيز PDF…" : "حفظ PNG/PDF"}</button><button type="button" className="unified-print-button" onClick={() => void downloadPdf("unifiedAll")} disabled={downloadingDocument === "unifiedAll"}><Printer size={17} /> {downloadingDocument === "unifiedAll" ? "جارٍ تجهيز الحزمة…" : "حفظ الموحد PNG/PDF"}</button></div></div><div className="document-frame-wrap"><iframe className="document-frame" title={reviewPreview === "accountStatus" ? "Account Status Statement print preview" : "Account Statement print preview"} srcDoc={reviewPreview === "accountStatus" ? accountStatusHtml : printableStatementHtml} /></div></section>}
      </section>}

      <footer className="app-footer"><img src={referenceAssets.footerStrip} alt="Original footer reference"/><span>Independent Web Staging edition — Prototype 0.5.1 reference remains unchanged.</span></footer>
    </div>
  );
}
