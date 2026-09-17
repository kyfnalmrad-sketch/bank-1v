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

/** Builds print metadata from the selected document date/time when provided. */
export function createPrintTimestamp(branch: string, now = new Date(), dateOverride = "", timeOverride = ""): PrintTimestamp {
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
  const systemDate = `${values.year}-${values.month}-${values.day}`;
  const parsedOverride = /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)
    ? dateOverride
    : (() => {
      const parsed = dateOverride ? new Date(dateOverride) : undefined;
      return parsed && !Number.isNaN(parsed.getTime())
        ? `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`
        : "";
    })();
  const date = parsedOverride || systemDate;
  const systemTime = `${values.hour}:${values.minute}:${values.second}`;
  const parsedTime = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeOverride);
  const time = parsedTime
    ? `${String(Number(parsedTime[1])).padStart(2, "0")}:${parsedTime[2]}:${parsedTime[3] || "00"}`
    : systemTime;
  // Keep the selected calendar date/time stable when jsPDF serializes /CreationDate.
  const iso = date === systemDate && time === systemTime ? now.toISOString() : `${date}T${time}Z`;
  return { iso, date, time, timeZone };
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
