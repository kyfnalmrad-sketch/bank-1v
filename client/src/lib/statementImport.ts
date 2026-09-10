export type StatementColumnKey = "date" | "description" | "branch" | "debit" | "credit" | "balance" | "reference" | "amount" | "direction";

export type StatementColumnMap = Partial<Record<StatementColumnKey, number>>;

export type ImportedTransaction = {
  rowNumber: number;
  date: string;
  description: string;
  branch: string;
  debit: number;
  credit: number;
  balance: number | null;
  externalReference: string;
  operationNumber: string;
  rejected: boolean;
  rejectionReason?: string;
  personName?: string;
  suggestedDescription?: string;
  highlightColor?: string;
};

export type HeaderDiscovery = {
  headerRowIndex: number;
  headers: string[];
  map: StatementColumnMap;
  mappedFields: Array<{ key: StatementColumnKey; source: string }>;
};

const aliases: Record<StatementColumnKey, readonly string[]> = {
  date: ["date", "posting date", "transaction date", "value date", "تاريخ", "تاريخ الحركة"],
  description: ["description", "movement description", "narration", "details", "particular", "particulars", "وصف العملية", "الوصف", "بيان الحركة"],
  branch: ["branch", "branch name", "branch code", "الفرع", "اسم الفرع", "فرع"],
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

export function formatImportedDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return `${epoch.getUTCFullYear()}-${String(epoch.getUTCMonth() + 1).padStart(2, "0")}-${String(epoch.getUTCDate()).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const display = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (display) return `${display[3]}-${String(display[2]).padStart(2, "0")}-${String(display[1]).padStart(2, "0")}`;
  return text;
}

export function displayStatementDate(value: unknown) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
}

export function formatEnglishGregorianDate(value: unknown) {
  const normalized = formatImportedDate(value);
  const date = parseGregorianDate(normalized);
  if (!date) return String(value ?? "").trim();
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return displayStatementDate(value);
  }
}

function parseGregorianDate(value: unknown) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function toArabicDigits(value: unknown) {
  return String(value ?? "").replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

export function formatHijriDate(value: unknown) {
  const date = parseGregorianDate(value);
  if (!date) return "";
  try {
    const formatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.day} ${parts.month} ${parts.year} هـ`;
  } catch {
    return "";
  }
}

function fieldForHeader(value: unknown): StatementColumnKey | undefined {
  const header = normalizeHeader(value);
  if (!header || unsupportedHeader.test(header)) return undefined;
  return (Object.keys(normalizedAliases) as StatementColumnKey[]).find((key) => normalizedAliases[key].includes(header));
}

function isNumericCell(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  const cleaned = String(value ?? "").trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[٬,\s()]/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

function isDateCell(value: unknown) {
  if (typeof value === "number") return value >= 30_000 && value <= 80_000;
  const text = String(value ?? "").trim();
  return /^(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})$/.test(text);
}

function isReferenceCell(value: unknown) {
  const text = String(value ?? "").trim();
  return /^(?:[A-Z]{2,}[A-Z0-9-]{4,}|[A-Z]{1,}\d[A-Z0-9-]{3,})$/i.test(text);
}

type ColumnProfile = { index: number; date: number; reference: number; numeric: number; text: number; nonEmpty: number };

function inferMapFromSamples(matrix: unknown[][], headerRowIndex: number, initialMap: StatementColumnMap) {
  const samples = matrix.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())).slice(0, 12);
  const width = Math.max(0, ...samples.map((row) => row.length));
  const profiles: ColumnProfile[] = Array.from({ length: width }, (_, index) => ({ index, date: 0, reference: 0, numeric: 0, text: 0, nonEmpty: 0 }));
  for (const row of samples) {
    for (const profile of profiles) {
      const value = row[profile.index];
      if (String(value ?? "").trim() === "") continue;
      profile.nonEmpty += 1;
      if (isDateCell(value)) profile.date += 1;
      if (isReferenceCell(value)) profile.reference += 1;
      if (isNumericCell(value)) profile.numeric += 1;
      if (!isDateCell(value) && !isReferenceCell(value) && !isNumericCell(value)) profile.text += 1;
    }
  }
  const ratio = (profile: ColumnProfile, key: keyof Omit<ColumnProfile, "index" | "nonEmpty">) => profile.nonEmpty ? profile[key] / profile.nonEmpty : 0;
  const result: StatementColumnMap = { ...initialMap };
  const claimed = () => new Set(Object.values(result).filter((value): value is number => value !== undefined));
  const choose = (predicate: (profile: ColumnProfile) => boolean, after = -1) => profiles.find((profile) => profile.index > after && !claimed().has(profile.index) && predicate(profile))?.index;

  if (result.date === undefined) result.date = choose((profile) => ratio(profile, "date") >= 0.6);
  if (result.description === undefined && result.date !== undefined) {
    result.description = choose((profile) => ratio(profile, "text") >= 0.55, result.date);
  }
  if (result.reference === undefined && result.description !== undefined) {
    result.reference = choose((profile) => ratio(profile, "reference") >= 0.55, result.description);
  }
  const numericColumns = profiles
    .filter((profile) => !claimed().has(profile.index) && ratio(profile, "numeric") >= 0.45)
    .map((profile) => profile.index)
    .filter((index) => index > (result.description ?? -1));
  if (result.debit === undefined && numericColumns.length) result.debit = numericColumns.shift();
  if (result.credit === undefined && numericColumns.length) result.credit = numericColumns.shift();
  if (result.balance === undefined && numericColumns.length) result.balance = numericColumns.shift();
  return result;
}

export function discoverStatementHeader(matrix: unknown[][]): HeaderDiscovery | null {
  const candidates = matrix.map((row, rowIndex) => {
    const map: StatementColumnMap = {};
    const headers = row.map((cell) => String(cell ?? "").trim());
    row.forEach((cell, columnIndex) => {
      const source = String(cell ?? "").trim();
      const field = fieldForHeader(source);
      if (field !== undefined && map[field] === undefined) {
        map[field] = columnIndex;
      }
    });
    const inferredMap = inferMapFromSamples(matrix, rowIndex, map);
    const hasAmounts = inferredMap.debit !== undefined || inferredMap.credit !== undefined || (inferredMap.amount !== undefined && inferredMap.direction !== undefined);
    const headerPlausible = Object.keys(map).length > 0 || headers.filter(Boolean).length >= 3;
    const isUsable = headerPlausible && inferredMap.date !== undefined && inferredMap.description !== undefined && hasAmounts;
    const score = Object.keys(map).length * 10 + Object.keys(inferredMap).length + (isUsable ? 100 : 0);
    return { rowIndex, headers, map: inferredMap, isUsable, score };
  }).filter((candidate) => candidate.isUsable).sort((left, right) => right.score - left.score || left.rowIndex - right.rowIndex);

  const best = candidates[0];
  if (!best) return null;
  if (candidates[1]?.score === best.score) return null;
  const mappedFields = (Object.keys(best.map) as StatementColumnKey[])
    .filter((key) => best.map[key] !== undefined)
    .map((key) => ({ key, source: best.headers[best.map[key]!] || `Column ${best.map[key]! + 1}` }));
  return { headerRowIndex: best.rowIndex, headers: mappedFields.map((field) => field.source), map: best.map, mappedFields };
}

function extractNamedParty(description: string) {
  const matched = description.match(/(?:from|to|via|من|إلى|الى|عبر|:|\-|—)\s*([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s'.-]{2,})/i);
  return matched?.[1]?.trim().replace(/[.،,;]+$/, "") || undefined;
}

export function reviewDescription(input: unknown) {
  const description = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!description) return { accepted: false, description, reason: "Description is blank and cannot be included in the account statement." };
  if (forbiddenDescription.test(description)) return { accepted: false, description, reason: "Description is not accepted in this Staging edition." };
  const personName = extractNamedParty(description);
  if (genericTransfer.test(description)) return { accepted: false, description, reason: "Transfer description requires the name of a person or organisation.", personName };
  if (/(family\s*transfer|family\s*transfers|incoming(?:\s*transfer)?|personal\s*transfer|تحويل\s*عائلي|تحويل\s*وارد|استلام(?:\s*تحويل)?)/i.test(description) && !personName) {
    return { accepted: false, description, reason: "Description requires a person or organisation name to avoid an ambiguous transaction.", personName };
  }
  const suggestedDescription = /haseb|حاسب/i.test(description)
    ? "Payment via Haseb"
    : personName
      ? /^family\s*:|family\s*transfer|family\s*transfers|تحويل\s*عائلي/i.test(description)
        ? `Family transfer — ${personName}`
        : /^personal\s*:|personal\s*transfer/i.test(description)
          ? `Personal transfer — ${personName}`
          : /incoming|تحويل\s*وارد|استلام/i.test(description)
          ? `Incoming transfer from ${personName}`
          : undefined
      : undefined;
  return { accepted: true, description, personName, suggestedDescription };
}

function getCell(row: unknown[], index: number | undefined) {
  return index === undefined ? undefined : row[index];
}

function operationDateCode(value: string) {
  const iso = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) return `${iso[1].slice(-2)}${String(iso[2]).padStart(2, "0")}${String(iso[3]).padStart(2, "0")}`;
  const display = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (display) return `${display[3].slice(-2)}${String(display[2]).padStart(2, "0")}${String(display[1]).padStart(2, "0")}`;
  return "000000";
}

function threeLetters(seed: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  let result = "";
  for (let index = 0; index < 3; index += 1) {
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 1_103_515_245) + 12_345;
    result += alphabet[Math.abs(hash) % alphabet.length];
  }
  return result;
}

function operationNumber(date: string, seed: string, used: Set<string>) {
  const prefix = `FT${operationDateCode(date)}`;
  let collision = 0;
  let reference = `${prefix}${threeLetters(seed)}`;
  while (used.has(reference)) {
    collision += 1;
    reference = `${prefix}${threeLetters(`${seed}|${collision}`)}`;
  }
  used.add(reference);
  return reference;
}

export function buildImportedTransactions(rows: unknown[][], map: StatementColumnMap): ImportedTransaction[] {
  const usedOperationNumbers = new Set<string>();
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
      const date = formatImportedDate(getCell(row, map.date));
      const balance = balanceCell === undefined || String(balanceCell).trim() === "" ? null : asNumber(balanceCell);
      const internalOperationNumber = operationNumber(date, `${review.description}|${debit}|${credit}|${balance ?? ""}|${index}`, usedOperationNumbers);
      return {
        rowNumber: index + 1,
        date,
        description: review.description,
        branch: String(getCell(row, map.branch) ?? "").trim(),
        debit,
        credit,
        balance,
        externalReference: String(getCell(row, map.reference) ?? "").trim(),
        operationNumber: internalOperationNumber,
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
  date: "Date",
  description: "Description",
  branch: "Branch",
  debit: "Debit",
  credit: "Credit",
  balance: "Balance",
  reference: "External Reference",
  amount: "Amount",
  direction: "Transaction Type",
};
