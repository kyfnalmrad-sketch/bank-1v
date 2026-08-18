/**
 * Design reference: mirror the Prototype 0.5.1 workflow and palette.
 * This web shell uses only original reference assets; it does not alter PDF templates.
 */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { referenceAssets } from "@/lib/reference-assets";
import { trpc } from "@/lib/trpc";

type TabId = "account" | "transactions" | "training" | "review" | "printing";
type ColumnKey = "date" | "description" | "debit" | "credit" | "balance" | "reference";

type Transaction = {
  rowNumber: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  externalReference: string;
  operationNumber: string;
  rejected?: boolean;
  rejectionReason?: string;
};

const tabs: { id: TabId; label: string }[] = [
  { id: "account", label: "بيانات الحساب" },
  { id: "transactions", label: "الحركات والاستيراد" },
  { id: "training", label: "بيان الحالة" },
  { id: "review", label: "المراجعة والتصدير" },
  { id: "printing", label: "الطباعة الموحدة" },
];

const defaultClient = {
  name: "",
  momaizNo: "",
  passport: "",
  branch: "",
  accountNumber: "",
  customerSince: "",
  accountType: "Current Account",
  currency: "USD",
  opening: "0.00",
};

const blockedDescription = /(utility\s*bill|internet|online|web\s*purchase|online\s*purchase|online\s*withdrawal|شراء\s*عبر\s*(الانترنت|الإنترنت)|سحب\s*عبر\s*(الانترنت|الإنترنت)|دفع\s*(الانترنت|الإنترنت)|مبهم)/i;

const aliases: Record<ColumnKey, string[]> = {
  date: ["date", "transactiondate", "valuedate", "التاريخ", "تاريخ"],
  description: ["description", "movementdescription", "narration", "details", "الوصف", "بيان", "الحركة"],
  debit: ["debit", "withdrawal", "dr", "مدين", "سحب"],
  credit: ["credit", "deposit", "cr", "دائن", "ايداع", "إيداع"],
  balance: ["balance", "runningbalance", "الرصيد", "الرصيدالجاري"],
  reference: ["reference", "refno", "ref", "externalreference", "المرجع", "رقمالمرجع"],
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_.\-/#]+/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function money(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: unknown) {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
  }
  return String(value ?? "").trim();
}

function operationNumber(index: number) {
  return `FT260818${String(index + 1).padStart(4, "0")}`;
}

export default function Home() {
  const stagingHealth = trpc.staging.health.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [client, setClient] = useState(defaultClient);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<ColumnKey, number>>>({});
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [importNote, setImportNote] = useState("اختر ملف Excel لتحليل الأعمدة قبل اعتماد الاستيراد.");
  const [isReading, setIsReading] = useState(false);
  const [qrSource, setQrSource] = useState("");
  const [descriptionMemory, setDescriptionMemory] = useState<string[]>(() => JSON.parse(localStorage.getItem("bak-web-staging-descriptions") || "[]"));
  const [nameMemory, setNameMemory] = useState<string[]>(() => JSON.parse(localStorage.getItem("bak-web-staging-names") || "[]"));

  const acceptedRows = useMemo(() => transactions.filter((item) => !item.rejected), [transactions]);
  const rejectedRows = useMemo(() => transactions.filter((item) => item.rejected), [transactions]);
  const totalCredit = useMemo(() => acceptedRows.reduce((sum, row) => sum + row.credit, 0), [acceptedRows]);
  const totalDebit = useMemo(() => acceptedRows.reduce((sum, row) => sum + row.debit, 0), [acceptedRows]);
  const closing = useMemo(() => money(client.opening) + totalCredit - totalDebit, [client.opening, totalCredit, totalDebit]);

  useEffect(() => {
    const payload = `ISSUER=BAK|DOC=WEBSTAGING|ACCOUNT=${client.accountNumber || "PENDING"}|COUNT=${acceptedRows.length}|CURRENCY=${client.currency}|CLOSING=${closing.toFixed(2)}`;
    QRCode.toDataURL(payload, { width: 220, margin: 1, color: { dark: "#6b5297", light: "#ffffff" } })
      .then(setQrSource)
      .catch(() => setQrSource(""));
  }, [acceptedRows.length, client.accountNumber, client.currency, closing]);

  const updateClient = (key: keyof typeof defaultClient, value: string) => {
    setClient((current) => ({ ...current, [key]: value }));
  };

  const detectMap = (inputHeaders: string[]) => {
    const next: Partial<Record<ColumnKey, number>> = {};
    (Object.keys(aliases) as ColumnKey[]).forEach((key) => {
      const position = inputHeaders.findIndex((header) => aliases[key].some((alias) => normalize(header).includes(normalize(alias))));
      if (position >= 0) next[key] = position;
    });
    return next;
  };

  const buildTransactions = (rows: unknown[][], map: Partial<Record<ColumnKey, number>>) => {
    const descriptionIndex = map.description;
    const nextRows: Transaction[] = rows
      .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
      .map((row, index) => {
        const description = descriptionIndex === undefined ? "" : String(row[descriptionIndex] ?? "").trim();
        const rejected = blockedDescription.test(description);
        return {
          rowNumber: index + 1,
          date: map.date === undefined ? "" : formatDate(row[map.date]),
          description,
          debit: map.debit === undefined ? 0 : money(row[map.debit]),
          credit: map.credit === undefined ? 0 : money(row[map.credit]),
          balance: map.balance === undefined || String(row[map.balance] ?? "").trim() === "" ? null : money(row[map.balance]),
          externalReference: map.reference === undefined ? "" : String(row[map.reference] ?? "").trim(),
          operationNumber: operationNumber(index),
          rejected,
          rejectionReason: rejected ? "الوصف مصنف كمرفوض أو غير مناسب للمراجعة." : undefined,
        };
      });
    setTransactions(nextRows);
    const acceptedDescriptions = nextRows.filter((item) => !item.rejected && item.description).map((item) => item.description);
    const extractedNames = acceptedDescriptions.map((description) => description.match(/(?:incoming|personal|family)\s*:\s*([^–—\-]+)/i)?.[1]?.trim()).filter((item): item is string => Boolean(item));
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
    setImportNote(`تم تحليل ${nextRows.length} صفًا: ${nextRows.filter((item) => !item.rejected).length} مقبول للمراجعة و${nextRows.filter((item) => item.rejected).length} مرفوض.`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
      const headerRowIndex = matrix.findIndex((row) => Array.isArray(row) && detectMap(row.map((cell) => String(cell))).description !== undefined);
      if (headerRowIndex < 0) {
        setImportNote("لم يتم التعرف على صف العناوين تلقائيًا. راجع ملف Excel أو أعد تسميـة الأعمدة.");
        setHeaders([]);
        setTransactions([]);
        return;
      }
      const nextHeaders = matrix[headerRowIndex].map((cell) => String(cell));
      const nextMap = detectMap(nextHeaders);
      const nextRows = matrix.slice(headerRowIndex + 1);
      setHeaders(nextHeaders);
      setColumnMap(nextMap);
      setRawRows(nextRows);
      buildTransactions(nextRows, nextMap);
      setActiveTab("transactions");
    } catch {
      setImportNote("تعذر قراءة ملف Excel. استخدم ملف XLSX أو XLS مدعومًا.");
    } finally {
      setIsReading(false);
    }
  };

  const applyColumnMap = () => {
    if (!headers.length || !rawRows.length) return;
    buildTransactions(rawRows, columnMap);
    setImportNote("تمت إعادة التحليل بعد اعتماد خريطة الأعمدة الحالية. راجع الصفوف قبل أي ربط خارجي.");
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <img src={referenceAssets.logo} className="reference-logo" alt="Prototype 0.5.1 reference logo" />
          <div>
            <p className="eyebrow">نسخة ويب منفصلة للمراجعة الداخلية</p>
            <h1>نظام إنشاء كشوف الحساب</h1>
            <p className="bank-name">Bank Al Karimi</p>
          </div>
        </div>
        <div className="reference-badge"><ShieldCheck size={17} /> مرجع التصميم: Prototype 0.5.1 محفوظ</div>
      </header>

      <section className="reference-strip" aria-label="حالة النسخة">
        <div><span>وضع العمل</span><strong>Web Staging</strong></div>
        <div><span>قاعدة Staging</span><strong>{stagingHealth.isLoading ? "جاري التحقق" : stagingHealth.data ? `${stagingHealth.data.tableCount} جداول جاهزة` : "غير متاحة"}</strong></div>
        <div><span>المستندات المرجعية</span><strong>دون تغيير بصري</strong></div>
      </section>

      <nav className="ui-tabs" aria-label="أقسام النظام">
        {tabs.map((tab) => (
          <button key={tab.id} className={`ui-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "account" && <>
        <section className="panel">
          <h2>إعدادات المستند</h2>
          <div className="grid">
            <label>البنك<select value="KURAIMI" disabled><option>بنك الكريمي / Bank Al Karimi</option></select></label>
            <label>لغة المستند<select defaultValue="en"><option value="en">الإنجليزية</option><option value="ar">العربية</option></select></label>
            <label>العملة<select value={client.currency} onChange={(event) => updateClient("currency", event.target.value)}><option>USD</option><option>YER</option><option>SAR</option></select></label>
          </div>
        </section>
        <section className="panel">
          <h2>بيانات العميل والحساب</h2>
          <div className="grid">
            <label>اسم العميل<input value={client.name} onChange={(event) => updateClient("name", event.target.value)} placeholder="الاسم كما سيظهر في البيان" /></label>
            <label>الرقم المميز Momaiz No.<input dir="ltr" value={client.momaizNo} onChange={(event) => updateClient("momaizNo", event.target.value)} /></label>
            <label>رقم جواز السفر <span className="field-note">اختياري</span><input dir="ltr" value={client.passport} onChange={(event) => updateClient("passport", event.target.value)} /></label>
            <label className="wide">اسم الفرع<input dir="ltr" value={client.branch} onChange={(event) => updateClient("branch", event.target.value)} placeholder="Branch Name" /></label>
            <label>عميل منذ<input value={client.customerSince} onChange={(event) => updateClient("customerSince", event.target.value)} placeholder="15/01/2020" /></label>
            <label>رقم الحساب<input dir="ltr" value={client.accountNumber} onChange={(event) => updateClient("accountNumber", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>البيانات المالية</h2>
          <div className="grid">
            <label>الرصيد الافتتاحي<input inputMode="decimal" dir="ltr" value={client.opening} onChange={(event) => updateClient("opening", event.target.value)} /></label>
            <div className="computed-field"><span>إجمالي الدائن المستورد</span><strong>{formatMoney(totalCredit)}</strong></div>
            <div className="computed-field"><span>إجمالي المدين المستورد</span><strong>{formatMoney(totalDebit)}</strong></div>
            <div className="computed-field"><span>الرصيد الختامي المحسوب</span><strong>{formatMoney(closing)}</strong></div>
            <div className="computed-field"><span>عدد الحركات المقبولة</span><strong>{acceptedRows.length}</strong></div>
          </div>
        </section>
      </>}

      {activeTab === "transactions" && <>
        <section className="panel">
          <h2>استيراد العمليات وحفظ البيانات</h2>
          <div className="import-zone">
            <div className="import-icon"><FileSpreadsheet size={28} /></div>
            <div><strong>استيراد ملف Excel</strong><p>سيعرض النظام خريطة الأعمدة ثم يصنف الصفوف للمراجعة داخل جلسة Staging.</p></div>
            <label className="upload-button">{isReading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />} اختيار Excel<input type="file" accept=".xlsx,.xls" onChange={handleFile} /></label>
          </div>
          <p className="hint" aria-live="polite">{fileName ? `الملف المحدد: ${fileName} — ` : ""}{importNote}</p>
        </section>
        {headers.length > 0 && <section className="panel">
          <h2>خريطة أعمدة Excel</h2>
          <p className="hint">راجع الأعمدة المكتشفة قبل اعتمادها. لا تحفظ هذه المرحلة أي بيانات خارج الجلسة.</p>
          <div className="grid column-grid">
            {(Object.keys(aliases) as ColumnKey[]).map((key) => <label key={key}>{({ date: "التاريخ", description: "الوصف", debit: "المدين", credit: "الدائن", balance: "الرصيد", reference: "المرجع الخارجي" } as Record<ColumnKey, string>)[key]}
              <select value={columnMap[key] ?? ""} onChange={(event) => setColumnMap((current) => ({ ...current, [key]: event.target.value === "" ? undefined : Number(event.target.value) }))}>
                <option value="">غير محدد</option>
                {headers.map((header, index) => <option value={index} key={`${header}-${index}`}>{header || `عمود ${index + 1}`}</option>)}
              </select>
            </label>)}
          </div>
          <div className="actions"><button onClick={applyColumnMap} type="button"><CheckCircle2 size={17} /> اعتماد خريطة الأعمدة</button></div>
        </section>}
        <section className="panel workflow-panel">
          <h2>مسار العمل</h2>
          <ol className="workflow-steps"><li>اختر ملف Excel.</li><li>راجع خريطة الأعمدة.</li><li>افحص الصفوف المقبولة والمرفوضة.</li><li>انتقل إلى المعاينة والمراجعة.</li></ol>
        </section>
        {transactions.length > 0 && <section className="panel preview-panel">
          <div className="panel-heading"><div><h2>معاينة الحركات القابلة للمراجعة</h2><p className="hint">العمليات المرفوضة تبقى ظاهرة للتدقيق ولا تُستبدل تلقائيًا.</p></div><span className="summary-chip">{acceptedRows.length} مقبول · {rejectedRows.length} مرفوض</span></div>
          <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الوصف</th><th>المرجع الخارجي</th><th>رقم العملية</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody>
            {transactions.map((row) => <tr className={row.rejected ? "invalid-row" : ""} key={`${row.rowNumber}-${row.operationNumber}`}><td>{row.date || "—"}</td><td>{row.description || "—"}</td><td dir="ltr">{row.externalReference || "—"}</td><td dir="ltr">{row.operationNumber}</td><td>{row.debit ? formatMoney(row.debit) : "—"}</td><td>{row.credit ? formatMoney(row.credit) : "—"}</td><td>{row.balance === null ? "—" : formatMoney(row.balance)}</td><td>{row.rejected ? <span className="row-alert"><AlertTriangle size={14} /> مرفوض</span> : <span className="row-ok"><CheckCircle2 size={14} /> للمراجعة</span>}</td></tr>)}
          </tbody></table></div>
        </section>}
      </>}

      {activeTab === "training" && <section className="panel statement-preview-panel">
        <div className="panel-heading"><div><h2>Account Status Statement</h2><p className="hint">معاينة مرجعية تعتمد الخلفية والشعار الأصليين دون تغيير.</p></div><button className="secondary-button" type="button" onClick={() => setActiveTab("review")}><ChevronLeft size={16} /> انتقل للمراجعة</button></div>
        <div className="statement-paper account-paper">
          <img className="paper-background" src={referenceAssets.statementBackground} alt="Original account statement page background" />
          <img className="paper-qr" src={qrSource || referenceAssets.qrLogo} alt="Staging verification QR" />
          <div className="paper-correspondence"><strong>Date:</strong> —<br/><strong>Enclosures:</strong> Statement PDF — {Math.max(1, Math.ceil(acceptedRows.length / 20))} page</div>
          <div className="paper-content">
            <p className="paper-attestation">This statement reflects the account information recorded by AlKuraimi Islamic Microfinance Bank as of the selected statement date.</p>
            <div className="paper-identity"><span><b>Customer Name:</b> {client.name || "—"}</span><span><b>Momaiz No.:</b> {client.momaizNo || "—"}</span>{client.passport && <span><b>Passport Number:</b> {client.passport}</span>}<span><b>Statement Reference:</b> WEB-STAGING</span></div>
            <table className="document-table"><thead><tr><th>Account Type</th><th>Account Number</th><th>Branch Name</th><th>Account Currency</th></tr></thead><tbody><tr><td>{client.accountType}</td><td>{client.accountNumber || "—"}</td><td>{client.branch || "—"}</td><td>{client.currency}</td></tr></tbody></table>
            <table className="document-table balance-table"><thead><tr><th colSpan={2}>BALANCE SUMMARY</th></tr></thead><tbody><tr><th>Opening Balance</th><td>{formatMoney(money(client.opening))}</td></tr><tr><th>Total Credits</th><td>{formatMoney(totalCredit)}</td></tr><tr><th>Total Debits</th><td>{formatMoney(totalDebit)}</td></tr><tr><th>Closing Balance</th><td>{formatMoney(closing)}</td></tr></tbody></table>
            <p className="paper-attestation paper-closing">Issued by AlKuraimi Islamic Microfinance Bank as of the statement date.</p>
          </div>
        </div>
      </section>}

      {activeTab === "review" && <section className="panel review-panel">
        <div className="panel-heading"><div><h2>المراجعة والتصدير</h2><p className="hint">تحقق من المدخلات قبل نقلها إلى مرحلة PDF أو Google Sheets.</p></div><FileText size={26} className="heading-icon" /></div>
        <div className="review-grid"><div className="validation-card"><span>حالة العميل</span><strong>{client.name && client.momaizNo ? "مكتملة للمراجعة" : "تحتاج بيانات العميل"}</strong><small>اسم العميل والرقم المميز مطلوبان في البيان.</small></div><div className="validation-card"><span>حالة العمليات</span><strong>{acceptedRows.length ? `${acceptedRows.length} حركة مقبولة` : "لم تُستورد حركات"}</strong><small>{rejectedRows.length ? `${rejectedRows.length} صف مرفوض ظاهر للتدقيق.` : "لا توجد صفوف مرفوضة حاليًا."}</small></div><div className="validation-card"><span>حد الصفحة</span><strong>20 حركة لكل صفحة</strong><small>التقدير الحالي: {Math.max(1, Math.ceil(acceptedRows.length / 20))} صفحة كشف.</small></div><div className="validation-card"><span>ذاكرة المتصفح المحلية</span><strong>{descriptionMemory.length} وصف · {nameMemory.length} اسم</strong><small>مخزنة في هذا المتصفح فقط، ولا تُرسل لأي خدمة.</small></div></div>
        <div className="actions document-actions"><button type="button" onClick={() => setActiveTab("training")}><FileText size={17} /> معاينة بيان الحالة</button><button type="button" className="preview-button" onClick={() => setActiveTab("printing")}><Printer size={17} /> معاينة الطباعة الموحدة</button><button type="button" className="secondary-button" onClick={downloadSessionJson}><RefreshCcw size={17} /> تنزيل جلسة JSON</button></div>
      </section>}

      {activeTab === "printing" && <section className="panel printing-panel">
        <div className="panel-heading"><div><h2>طباعة ملف موحد</h2><p className="hint">ترتيب النسخة المرجعية: بيان الحالة أولًا، ثم كشف الحساب.</p></div><Printer size={26} className="heading-icon" /></div>
        <div className="combined-preview"><div className="combined-page"><span className="page-number">1</span><img src={referenceAssets.statementBackground} alt="Account status document reference"/><strong>Account Status Statement</strong><small>قالب مرجعي أصلي — معاينة ويب</small></div><div className="combined-divider"/><div className="combined-page statement-page"><span className="page-number">2</span><img src={referenceAssets.logo} alt="Statement header reference"/><strong>Statement</strong><small>{acceptedRows.length} حركة للمراجعة · حتى 20 حركة للصفحة</small></div></div>
        <div className="print-note"><ShieldCheck size={19} /> وظيفة التصدير النهائي إلى PDF وربط Google Sheets ستُفعّل بعد إقرار اختبار الواجهة وخريطة الأعمدة محليًا.</div>
      </section>}

      <footer className="app-footer"><img src={referenceAssets.footerStrip} alt="Original footer reference"/><span>نسخة ويب Staging مستقلة — لا تعدّل Prototype 0.5.1 المرجعي.</span></footer>
    </div>
  );
}
