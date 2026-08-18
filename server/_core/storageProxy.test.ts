import { describe, expect, it } from "vitest";
import { getWebStaticAssetUrl, isWebStaticAssetKey } from "./storageProxy";

describe("Render static asset fallback", () => {
  it("uses the stable Manus project origin only for the approved original Kuraimi assets", () => {
    expect(isWebStaticAssetKey("kuraimi-logo-reference_17f98fb5.png")).toBe(true);
    expect(isWebStaticAssetKey("untrusted-upload.png")).toBe(false);
    expect(getWebStaticAssetUrl("kuraimi-logo-reference_17f98fb5.png")).toBe(
      "https://bankkarimi-m62zu5vg.manus.space/manus-storage/kuraimi-logo-reference_17f98fb5.png",
    );
  });

  it("keeps the fallback scope limited to the immutable identity assets", () => {
    expect(isWebStaticAssetKey("kuraimi-footer-strip_74a0236b.png")).toBe(true);
    expect(isWebStaticAssetKey("kuraimi-footer-strip.png")).toBe(false);
    expect(isWebStaticAssetKey("../../account-data.csv")).toBe(false);
  });

  it("does not treat dynamically named files as cacheable identity assets", () => {
    expect(isWebStaticAssetKey("kuraimi-logo-reference_runtime.png")).toBe(false);
  });
});
