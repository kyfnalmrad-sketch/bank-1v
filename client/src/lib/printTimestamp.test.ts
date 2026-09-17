import { describe, expect, it } from "vitest";
import { createPrintTimestamp } from "./printTimestamp";

describe("print timestamp", () => {
  it("uses the entered print date even when the device clock has another date", () => {
    const timestamp = createPrintTimestamp("Sana'a", new Date("2031-12-31T22:15:10Z"), "2026-09-23");

    expect(timestamp.date).toBe("2026-09-23");
    expect(timestamp.iso).toMatch(/^2026-09-23T/);
  });

  it("accepts the text date used by the independent YCB certificate", () => {
    const timestamp = createPrintTimestamp("Sana'a", new Date("2031-12-31T22:15:10Z"), "08 September 2026");

    expect(timestamp.date).toBe("2026-09-08");
  });

  it("uses the entered print time instead of the device clock time", () => {
    const timestamp = createPrintTimestamp("Dubai Main Branch", new Date("2031-12-31T22:15:10Z"), "2026-09-23", "08:45");

    expect(timestamp.time).toBe("08:45:00");
    expect(timestamp.iso).toBe("2026-09-23T08:45:00Z");
    expect(timestamp.timeZone).toBe("Asia/Dubai");
  });

  it("preserves an entered day 31 exactly", () => {
    const timestamp = createPrintTimestamp("Sana'a", new Date("2031-12-31T22:15:10Z"), "2026-08-31", "10:00");

    expect(timestamp.date).toBe("2026-08-31");
    expect(timestamp.iso).toBe("2026-08-31T10:00:00Z");
  });
});
