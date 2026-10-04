import { describe, expect, it } from "vitest";
import { listBankMemoryValues, rememberBankMemoryValue } from "./memory";

describe("bank memory adapter", () => {
  it("does not replace legacy storage when Supabase is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(listBankMemoryValues("bank_kuraimi", "branch")).resolves.toEqual({ data: [], source: "fallback" });
    await expect(rememberBankMemoryValue({ moduleKey: "bank_kuraimi", fieldKey: "branch", value: "Main" })).resolves.toEqual({ data: null, source: "fallback" });
  });
});
