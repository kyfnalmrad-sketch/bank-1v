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
import { renderAccountStatusPreview, renderStatementPreview } from "@/lib/documentPreview";
import {
  buildImportedTransactions,
  discoverStatementHeader,
  statementFieldLabels,
  statementReferenceFromTransactions,
  type ImportedTransaction,
  type StatementColumnMap,
} from "@/lib/statementImport";

type TabId = "account" | "transactions" | "training" | "review" | "printing";
type Transaction = ImportedTransaction;

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
  const [importNote, setImportNote] = useState("اختر ملف Excel لتحليل الأعمدة قبل اعتماد الاستيراد.");
  const [isReading, setIsReading] = useState(false);
  const [qrSource, setQrSource] = useState("");
  const [descriptionMemory, setDescriptionMemory] = useState<string[]>(() => loadLocalList("bak-web-staging-descriptions"));
  const [nameMemory, setNameMemory] = useState<string[]>(() => loadLocalList("bak-web-staging-names"));

  const acceptedRows = useMemo(() => transactions.filter((item) => !item.rejected), [transactions]);
  const rejectedRows = useMemo(() => transactions.filter((item) => item.rejected), [transactions]);
  const totalCredit = useMemo(() => acceptedRows.reduce((sum, row) => sum + row.credit, 0), [acceptedRows]);
  const totalDebit = useMemo(() => acceptedRows.reduce((sum, row) => sum + row.debit, 0), [acceptedRows]);
  const closing = useMemo(() => money(client.opening) + totalCredit - totalDebit, [client.opening, totalCredit, totalDebit]);
  const internalStatementReference = useMemo(() => statementReferenceFromTransactions(transactions, client.accountNumber || client.momaizNo), [client.accountNumber, client.momaizNo, transactions]);
  const excelStatementReference = useMemo(() => transactions.map((transaction) => transaction.externalReference).find(Boolean) || "", [transactions]);
  const statementReference = referenceSource === "excel" && excelStatementReference ? excelStatementReference : internalStatementReference;
  const visibleMappedFields = useMemo(() => mappedFields.filter((field) => referenceSource === "excel" || field.key !== "reference"), [mappedFields, referenceSource]);
  const firstTransactionDate = acceptedRows.find((transaction) => transaction.date)?.date || "";
  const lastTransactionDate = [...acceptedRows].reverse().find((transaction) => transaction.date)?.date || "";
  const issueDate = client.issueDate || lastTransactionDate || firstTransactionDate || "PENDING";
  const periodStart = client.periodStart || firstTransactionDate || "PENDING";
  const periodEnd = client.periodEnd || lastTransactionDate || issueDate;
  const statementPageCount = Math.max(1, Math.ceil(acceptedRows.length / 20));
  const accountStatusHtml = useMemo(() => renderAccountStatusPreview({
    backgroundUri: referenceAssets.statementBackground,
    qrUri: qrSource || referenceAssets.qrLogo,
    customerName: client.name,
    momaizNo: client.momaizNo,
    passport: client.passport,
    dateOfBirth: client.dateOfBirth,
    customerSince: client.customerSince,
    accountType: client.accountType,
    accountNumber: client.accountNumber,
    branchName: client.branch,
    currency: client.currency,
    opening: money(client.opening),
    credit: totalCredit,
    debit: totalDebit,
    closing,
    issueDate,
    issueDateHijri: client.issueDateHijri,
    printTime: client.printTime,
    correspondenceDate: client.correspondenceDate,
    enclosurePages: statementPageCount,
    referenceNo: statementReference,
  }), [client, closing, issueDate, qrSource, statementPageCount, statementReference, totalCredit, totalDebit]);
  const statementPageHtml = useMemo(() => Array.from({ length: statementPageCount }, (_, pageIndex) => renderStatementPreview({
    headerUri: referenceAssets.headerStrip,
    qrUri: qrSource || referenceAssets.qrLogo,
    customerName: client.name,
    accountNumber: client.accountNumber,
    momaizNo: client.momaizNo,
    branchName: client.branch,
    currency: client.currency,
    issueDate,
    periodStart,
    periodEnd,
    statementReference,
    pageNumber: pageIndex + 1,
    pageCount: statementPageCount,
    closing,
    transactions: acceptedRows.slice(pageIndex * 20, (pageIndex + 1) * 20).map((row) => ({ date: row.date, description: row.description, operationNumber: row.operationNumber, debit: row.debit, credit: row.credit, balance: row.balance })),
  })), [acceptedRows, client, closing, issueDate, periodEnd, periodStart, qrSource, statementPageCount, statementReference]);

  useEffect(() => {
    const payload = `ISSUER=BAK|DOC=WEBSTAGING|REF=${statementReference}|ACCOUNT=${client.accountNumber || "PENDING"}|COUNT=${acceptedRows.length}|CURRENCY=${client.currency}|CLOSING=${closing.toFixed(2)}`;
    QRCode.toDataURL(payload, { width: 220, margin: 1, color: { dark: "#6b5297", light: "#ffffff" } })
      .then(setQrSource)
      .catch(() => setQrSource(""));
  }, [acceptedRows.length, client.accountNumber, client.currency, closing, statementReference]);

  const updateClient = (key: keyof typeof defaultClient, value: string) => {
    setClient((current) => ({ ...current, [key]: value }));
  };

  const applySuggestedDescription = (operationNumber: string) => {
    setTransactions((current) => current.map((transaction) => transaction.operationNumber === operationNumber && transaction.suggestedDescription
      ? { ...transaction, description: transaction.suggestedDescription, suggestedDescription: undefined }
      : transaction));
  };

  const buildTransactions = (rows: unknown[][], map: StatementColumnMap) => {
    const nextRows = buildImportedTransactions(rows, map);
    setTransactions(nextRows);
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
      const discovery = discoverStatementHeader(matrix);
      if (!discovery) {
        setImportNote("لم يتم العثور على صف كشف حساب صالح. نحتاج: التاريخ، الوصف، و(مدين/دائن) أو (المبلغ/نوع الحركة). لم تُستورد أي أعمدة عشوائية.");
        setMappedFields([]);
        setTransactions([]);
        return;
      }
      const nextRows = matrix.slice(discovery.headerRowIndex + 1);
      setColumnMap(discovery.map);
      setMappedFields(discovery.mappedFields);
      setRawRows(nextRows);
      buildTransactions(nextRows, discovery.map);
      setActiveTab("transactions");
    } catch {
      setImportNote("تعذر قراءة ملف Excel. استخدم ملف XLSX أو XLS مدعومًا.");
    } finally {
      setIsReading(false);
      event.currentTarget.value = "";
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
            <label>مصدر الرقم المرجعي<select value={referenceSource} onChange={(event) => setReferenceSource(event.target.value as "internal" | "excel")}><option value="internal">توليد داخلي ثابت</option><option value="excel">استخدام مرجع Excel</option></select></label>
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
            <label>تاريخ الميلاد <span className="field-note">اختياري</span><input type="date" value={client.dateOfBirth} onChange={(event) => updateClient("dateOfBirth", event.target.value)} /></label>
            <label>نوع الحساب<input dir="ltr" value={client.accountType} onChange={(event) => updateClient("accountType", event.target.value)} /></label>
            <label>رقم الحساب<input dir="ltr" value={client.accountNumber} onChange={(event) => updateClient("accountNumber", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>حقول بيان الحالة</h2>
          <p className="hint">هذه الحقول تظهر في بيان الحالة فقط، بينما يعتمد إجمالي الأرصدة وعدد الصفحات على ملف الحركات المستورد.</p>
          <div className="grid">
            <label>تاريخ إصدار البيان<input type="date" value={client.issueDate} onChange={(event) => updateClient("issueDate", event.target.value)} /></label>
            <label>تاريخ الإصدار الهجري<input dir="rtl" value={client.issueDateHijri} onChange={(event) => updateClient("issueDateHijri", event.target.value)} placeholder="مثال: 02 صفر 1448 هـ" /></label>
            <label>وقت الطباعة<input type="time" value={client.printTime} onChange={(event) => updateClient("printTime", event.target.value)} /></label>
            <label>تاريخ المراسلة<input type="date" value={client.correspondenceDate} onChange={(event) => updateClient("correspondenceDate", event.target.value)} /></label>
          </div>
        </section>
        <section className="panel">
          <h2>حقول كشف الحساب</h2>
          <p className="hint">اترك تاريخ البداية والنهاية فارغين ليُستنتجا من أول وآخر حركة مقبولة في ملف Excel.</p>
          <div className="grid">
            <label>بداية فترة الكشف<input type="date" value={client.periodStart} onChange={(event) => updateClient("periodStart", event.target.value)} /></label>
            <label>نهاية فترة الكشف<input type="date" value={client.periodEnd} onChange={(event) => updateClient("periodEnd", event.target.value)} /></label>
            <div className="computed-field"><span>عدد صفحات الكشف</span><strong>{statementPageCount}</strong><small>20 حركة كحد أقصى لكل صفحة.</small></div>
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
            <div className="computed-field reference-field"><span>رقم البيان الداخلي</span><strong dir="ltr">{statementReference}</strong><small>ثابت البنية، ويعتمد على تاريخ أول حركة مستوردة.</small></div>
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
        {mappedFields.length > 0 && <section className="panel import-summary-panel">
          <h2>أعمدة كشف الحساب المعتمدة</h2>
          <p className="hint">يُعرض فقط ما وُجد بالفعل في صف العناوين. لا ينشئ النظام أعمدة One أو Two أو Three ولا يخمّن أسماء أعمدة من صفوف البيانات.</p>
          <div className="mapped-fields">{visibleMappedFields.map((field) => <div className="mapped-field" key={field.key}><span>{statementFieldLabels[field.key]}</span><strong dir="ltr">{field.source}</strong></div>)}</div>
        </section>}
        <section className="panel workflow-panel">
          <h2>مسار العمل</h2>
          <ol className="workflow-steps"><li>اختر ملف Excel.</li><li>راجع خريطة الأعمدة.</li><li>افحص الصفوف المقبولة والمرفوضة.</li><li>انتقل إلى المعاينة والمراجعة.</li></ol>
        </section>
        {transactions.length > 0 && <section className="panel preview-panel">
          <div className="panel-heading"><div><h2>معاينة الحركات القابلة للمراجعة</h2><p className="hint">العمليات المرفوضة تبقى ظاهرة للتدقيق ولا تُستبدل تلقائيًا.</p></div><span className="summary-chip">{acceptedRows.length} مقبول · {rejectedRows.length} مرفوض</span></div>
          <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الوصف</th>{referenceSource === "excel" && <th>مرجع Excel</th>}<th>رقم العملية</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody>
            {transactions.map((row) => <tr className={row.rejected ? "invalid-row" : ""} key={`${row.rowNumber}-${row.operationNumber}`}><td>{row.date || "—"}</td><td><div className="description-cell"><span>{row.description || "—"}</span>{!row.rejected && row.suggestedDescription && row.suggestedDescription !== row.description && <button type="button" className="description-suggestion" onClick={() => applySuggestedDescription(row.operationNumber)}>اعتماد: <b dir="ltr">{row.suggestedDescription}</b></button>}</div></td>{referenceSource === "excel" && <td dir="ltr">{row.externalReference || "—"}</td>}<td dir="ltr">{row.operationNumber}</td><td>{row.debit ? formatMoney(row.debit) : "—"}</td><td>{row.credit ? formatMoney(row.credit) : "—"}</td><td>{row.balance === null ? "—" : formatMoney(row.balance)}</td><td>{row.rejected ? <span className="row-alert"><AlertTriangle size={14} /> مرفوض</span> : <span className="row-ok"><CheckCircle2 size={14} /> للمراجعة</span>}</td></tr>)}
          </tbody></table></div>
        </section>}
      </>}

      {activeTab === "training" && <section className="panel statement-preview-panel">
        <div className="panel-heading"><div><h2>Account Status Statement</h2><p className="hint">معاينة HTML مبنية من قواعد قالب Prototype 0.5.1 المرجعي دون إعادة تصميم.</p></div><button className="secondary-button" type="button" onClick={() => setActiveTab("review")}><ChevronLeft size={16} /> انتقل للمراجعة</button></div>
        <div className="document-frame-wrap"><iframe className="document-frame" title="Account Status Statement reference preview" srcDoc={accountStatusHtml} /></div>
      </section>}

      {activeTab === "review" && <section className="panel review-panel">
        <div className="panel-heading"><div><h2>المراجعة والتصدير</h2><p className="hint">تحقق من المدخلات قبل نقلها إلى مرحلة PDF أو Google Sheets.</p></div><FileText size={26} className="heading-icon" /></div>
        <div className="review-grid"><div className="validation-card"><span>حالة العميل</span><strong>{client.name && client.momaizNo ? "مكتملة للمراجعة" : "تحتاج بيانات العميل"}</strong><small>اسم العميل والرقم المميز مطلوبان في البيان.</small></div><div className="validation-card"><span>حالة العمليات</span><strong>{acceptedRows.length ? `${acceptedRows.length} حركة مقبولة` : "لم تُستورد حركات"}</strong><small>{rejectedRows.length ? `${rejectedRows.length} صف مرفوض ظاهر للتدقيق.` : "لا توجد صفوف مرفوضة حاليًا."}</small></div><div className="validation-card"><span>حد الصفحة</span><strong>20 حركة لكل صفحة</strong><small>التقدير الحالي: {Math.max(1, Math.ceil(acceptedRows.length / 20))} صفحة كشف.</small></div><div className="validation-card"><span>ذاكرة المتصفح المحلية</span><strong>{descriptionMemory.length} وصف · {nameMemory.length} اسم</strong><small>مخزنة في هذا المتصفح فقط، ولا تُرسل لأي خدمة.</small></div></div>
        <div className="actions document-actions"><button type="button" onClick={() => setActiveTab("training")}><FileText size={17} /> معاينة بيان الحالة</button><button type="button" className="preview-button" onClick={() => setActiveTab("printing")}><Printer size={17} /> معاينة الطباعة الموحدة</button><button type="button" className="secondary-button" onClick={downloadSessionJson}><RefreshCcw size={17} /> تنزيل جلسة JSON</button></div>
      </section>}

      {activeTab === "printing" && <section className="panel printing-panel">
        <div className="panel-heading"><div><h2>طباعة ملف موحد</h2><p className="hint">تسلسل منظم للمعاينة: بيان الحالة أولًا ثم {statementPageCount} صفحة من كشف الحساب، بحد أقصى 20 حركة في كل صفحة.</p></div><Printer size={26} className="heading-icon" /></div>
        <div className="document-sequence"><div><span className="document-order">1</span><h3>Account Status Statement</h3><div className="document-frame-wrap"><iframe className="document-frame" title="Combined preview account status" srcDoc={accountStatusHtml} /></div></div>{statementPageHtml.map((html, pageIndex) => <div key={`statement-page-${pageIndex}`}><span className="document-order">{pageIndex + 2}</span><h3>Statement — page {pageIndex + 1} of {statementPageCount}</h3><div className="document-frame-wrap"><iframe className="document-frame" title={`Combined preview statement page ${pageIndex + 1}`} srcDoc={html} /></div></div>)}</div>
        <div className="print-note"><ShieldCheck size={19} /> المعاينة تعرض تسلسل الصفحات كما سيُستخدم في ملف الطباعة الموحد. تصدير PDF الفعلي يبقى خطوة اختبار منفصلة قبل اعتماده للمراجعة.</div>
      </section>}

      <footer className="app-footer"><img src={referenceAssets.footerStrip} alt="Original footer reference"/><span>نسخة ويب Staging مستقلة — لا تعدّل Prototype 0.5.1 المرجعي.</span></footer>
    </div>
  );
}
