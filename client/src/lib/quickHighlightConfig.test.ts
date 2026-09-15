import { describe, expect, it } from "vitest";
import { getQuickHighlightConfig, QUICK_HIGHLIGHT_CONFIG } from "./quickHighlightConfig";

describe("quick statement bank highlight configuration", () => {
  it("keeps an independent deposit color for each bank", () => {
    expect(getQuickHighlightConfig("tadhamon").depositColor).toBe("#ffed00");
    expect(getQuickHighlightConfig("ycb").depositColor).toBe("#fef08a");
    expect(getQuickHighlightConfig("karimi").depositColor).toBe("#e5e7eb");
    expect(new Set(Object.values(QUICK_HIGHLIGHT_CONFIG).map((config) => config.depositColor)).size).toBe(3);
  });

  it("does not expose official-document colors as part of the config", () => {
    expect(Object.keys(QUICK_HIGHLIGHT_CONFIG)).toEqual(["tadhamon", "ycb", "karimi"]);
  });
});
