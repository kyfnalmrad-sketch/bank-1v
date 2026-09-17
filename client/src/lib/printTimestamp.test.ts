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
});
