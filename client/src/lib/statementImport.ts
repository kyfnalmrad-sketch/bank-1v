export type StatementColumnKey = "date" | "description" | "debit" | "credit" | "balance" | "reference" | "amount" | "direction";

export type StatementColumnMap = Partial<Record<StatementColumnKey, number>>;

export type ImportedTransaction = {
  rowNumber: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  externalReference: string;
  operationNumber: string;
  rejected: boolean;
  rejectionReason?: string;
  personName?: string;
  suggestedDescription?: string;
};

export type HeaderDiscovery = {
  headerRowIndex: number;
  headers: string[];
  map: StatementColumnMap;
  mappedFields: Array<{ key: StatementColumnKey; source: string }>;
};

const aliases: Record<StatementColumnKey, readonly string[]> = {
  date: ["date", "posting date", "transaction date", "value date", "تاريخ", "تاريخ الحركة"],
  description: ["description", "movement description", "narration", "details", "وصف العملية", "الوصف", "بيان الحركة"],
  debit: ["debit", "debit amount", "withdrawal", "مدين", "مبلغ مدين"],
  credit: ["credit", "credit amount", "deposit", "دائن", "مبلغ دائن"],
  balance: ["balance", "running balance", "الرصيد", "الرصيد الجاري"],
  reference: ["reference", "external reference", "ref no", "reference no", "المرجع", "المرجع الخارجي", "رقم المرجع"],
  amount: ["amount", "transaction amount", "المبلغ"],
  direction: ["type", "transaction type", "movement type", "نوع العملية", "النوع"],
};

const creditDirections = new Set(["credit", "deposit", "cr", "دائن", "ايداع", "إيداع"]);
const debitDirections = new Set(["debit", "withdrawal", "dr", "مدين", "سحب"]);
const unsupportedHeader = /^(one|two|three|column\s*\d+|field\s*\d+)$/i;
const forbiddenDescription = /(utility\s*bill|utility\s*payment|internet|online\s*(purchase|withdrawal|payment)?|web\s*purchase|شراء\s*عبر\s*(الانترنت|الإنترنت)|سحب\s*عبر\s*(الانترنت|الإنترنت)|دفع\s*(الانترنت|الإنترنت)|مبهم)/i;
const genericTransfer = /^(family\s*transfers?|family\s*transfer|incoming(?:\s*transfer)?|personal\s*transfer|تحويل\s*عائلي|تحويل\s*وارد|استلام(?:\s*تحويل)?)\s*$/i;

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\s_.\-/#]+/g, " ")
    .trim();
}

const normalizedAliases = Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, values.map(normalizeHeader)])) as Record<StatementColumnKey, string[]>;

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٬/g, "")
    .replace(/،/g, ".")
    .replace(/[,$\s]/g, "");
  const negative = /^\(.*\)$/.test(normalized) || normalized.startsWith("-");
  const parsed = Number(normalized.replace(/[()]/g, "").replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function formatImportedDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return `${String(epoch.getUTCDate()).padStart(2, "0")}/${String(epoch.getUTCMonth() + 1).padStart(2, "0")}/${epoch.getUTCFullYear()}`;
  }
  return String(value ?? "").trim();
}

function fieldForHeader(value: unknown): StatementColumnKey | undefined {
  const header = normalizeHeader(value);
  if (!header || unsupportedHeader.test(header)) return undefined;
  return (Object.keys(normalizedAliases) as StatementColumnKey[]).find((key) => normalizedAliases[key].includes(header));
}

export function discoverStatementHeader(matrix: unknown[][]): HeaderDiscovery | null {
  const candidates = matrix.map((row, rowIndex) => {
    const map: StatementColumnMap = {};
    const headers: string[] = [];
    row.forEach((cell, columnIndex) => {
      const source = String(cell ?? "").trim();
      const field = fieldForHeader(source);
      if (field !== undefined && map[field] === undefined) {
        map[field] = columnIndex;
        headers[columnIndex] = source;
      }
    });
    const hasAmounts = map.debit !== undefined || map.credit !== undefined || (map.amount !== undefined && map.direction !== undefined);
    const isUsable = map.date !== undefined && map.description !== undefined && hasAmounts;
    const score = Object.keys(map).length + (isUsable ? 100 : 0);
    return { rowIndex, headers, map, isUsable, score };
  }).filter((candidate) => candidate.isUsable).sort((left, right) => right.score - left.score || left.rowIndex - right.rowIndex);

  const best = candidates[0];
  if (!best) return null;
  const mappedFields = (Object.keys(best.map) as StatementColumnKey[])
    .filter((key) => best.map[key] !== undefined)
    .map((key) => ({ key, source: best.headers[best.map[key]!] }));
  return { headerRowIndex: best.rowIndex, headers: best.headers.filter(Boolean), map: best.map, mappedFields };
}

function extractNamedParty(description: string) {
  const matched = description.match(/(?:from|to|via|من|إلى|الى|عبر|:|\-|—)\s*([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s'.]{2,})/i);
  return matched?.[1]?.trim().replace(/[.،,;]+$/, "") || undefined;
}

export function reviewDescription(input: unknown) {
  const description = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!description) return { accepted: false, description, reason: "الوصف فارغ ولا يمكن إدراجه في كشف الحساب." };
  if (forbiddenDescription.test(description)) return { accepted: false, description, reason: "الوصف مصنف كغير مقبول في نسخة Staging." };
  const personName = extractNamedParty(description);
  if (genericTransfer.test(description)) return { accepted: false, description, reason: "التحويل يحتاج اسم الشخص أو الجهة ضمن الوصف.", personName };
  if (/(family\s*transfer|family\s*transfers|incoming(?:\s*transfer)?|personal\s*transfer|تحويل\s*عائلي|تحويل\s*وارد|استلام(?:\s*تحويل)?)/i.test(description) && !personName) {
    return { accepted: false, description, reason: "الوصف يحتاج اسم الشخص أو الجهة لتجنب سجل مبهم.", personName };
  }
  const suggestedDescription = /haseb|حاسب/i.test(description)
    ? "Payment via Haseb"
    : personName
      ? /family\s*transfer|family\s*transfers|تحويل\s*عائلي/i.test(description)
        ? `Family transfer from ${personName}`
        : /incoming|personal\s*transfer|تحويل\s*وارد|استلام/i.test(description)
          ? `Incoming transfer from ${personName}`
          : undefined
      : undefined;
  return { accepted: true, description, personName, suggestedDescription };
}

function getCell(row: unknown[], index: number | undefined) {
  return index === undefined ? undefined : row[index];
}

function operationNumber(index: number) {
  return `FT${String(index + 1).padStart(6, "0")}`;
}

export function buildImportedTransactions(rows: unknown[][], map: StatementColumnMap): ImportedTransaction[] {
  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row, index) => {
      const amount = asNumber(getCell(row, map.amount));
      const direction = normalizeHeader(getCell(row, map.direction));
      const derivedCredit = creditDirections.has(direction) ? Math.abs(amount) : !direction && amount > 0 ? Math.abs(amount) : 0;
      const derivedDebit = debitDirections.has(direction) ? Math.abs(amount) : !direction && amount < 0 ? Math.abs(amount) : 0;
      const review = reviewDescription(getCell(row, map.description));
      const debit = map.debit === undefined ? derivedDebit : Math.abs(asNumber(getCell(row, map.debit)));
      const credit = map.credit === undefined ? derivedCredit : Math.abs(asNumber(getCell(row, map.credit)));
      const balanceCell = getCell(row, map.balance);
      return {
        rowNumber: index + 1,
        date: formatImportedDate(getCell(row, map.date)),
        description: review.description,
        debit,
        credit,
        balance: balanceCell === undefined || String(balanceCell).trim() === "" ? null : asNumber(balanceCell),
        externalReference: String(getCell(row, map.reference) ?? "").trim(),
        operationNumber: operationNumber(index),
        rejected: !review.accepted,
        rejectionReason: review.reason,
        personName: review.personName,
        suggestedDescription: review.suggestedDescription,
      };
    });
}

export function statementReferenceFromTransactions(transactions: Pick<ImportedTransaction, "date">[], accountOrMomaiz = "") {
  const date = transactions.map((transaction) => transaction.date).find(Boolean) || "";
  const iso = date.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/) || date.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  const ymd = iso
    ? iso[1].length === 4
      ? `${iso[1]}${String(iso[2]).padStart(2, "0")}${String(iso[3]).padStart(2, "0")}`
      : `${iso[3]}${String(iso[2]).padStart(2, "0")}${String(iso[1]).padStart(2, "0")}`
    : "PENDING";
  const suffix = String(accountOrMomaiz).replace(/\D/g, "").slice(-4).padStart(4, "0") || "0000";
  return `BAK-ACCT-${ymd}-${suffix}`;
}

export const statementFieldLabels: Record<StatementColumnKey, string> = {
  date: "التاريخ",
  description: "الوصف",
  debit: "المدين",
  credit: "الدائن",
  balance: "الرصيد",
  reference: "المرجع الخارجي",
  amount: "المبلغ",
  direction: "نوع الحركة",
};
