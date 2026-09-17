export type PrintTimestamp = {
  iso: string;
  date: string;
  time: string;
  timeZone: string;
};

const DEFAULT_TIME_ZONE = "Asia/Aden";

export function branchTimeZone(branch: string): string {
  const normalized = String(branch || "").toLocaleLowerCase();
  if (/(dubai|uae|دبي|الإمارات)/.test(normalized)) return "Asia/Dubai";
  if (/(riyadh|saudi|الرياض|السعودية)/.test(normalized)) return "Asia/Riyadh";
  if (/(cairo|مصر|القاهرة)/.test(normalized)) return "Africa/Cairo";
  if (/(sana|sanaa|صنعاء|اليمن|aden|عدن)/.test(normalized)) return DEFAULT_TIME_ZONE;
  return DEFAULT_TIME_ZONE;
}

export function createPrintTimestamp(branch: string, now = new Date()): PrintTimestamp {
  const timeZone = branchTimeZone(branch);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const time = `${values.hour}:${values.minute}:${values.second}`;
  return { iso: now.toISOString(), date, time, timeZone };
}

export function displayPrintTime(timestamp: PrintTimestamp): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timestamp.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(timestamp.iso));
}
