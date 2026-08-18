import { describe, expect, it } from "vitest";
import { ensureRenderStagingSchema, getRenderPool } from "./renderPg";

describe("Render Postgres staging schema", () => {
  it("creates the required empty staging tables and reports their count", async () => {
    const result = await ensureRenderStagingSchema();
    expect(result.tableCount).toBeGreaterThanOrEqual(7);

    const tables = await getRenderPool().query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'staging_%' ORDER BY tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual(expect.arrayContaining([
      "staging_profiles",
      "staging_statements",
      "staging_transactions",
      "staging_imports",
      "staging_description_memory",
      "staging_person_name_memory",
      "staging_audit_log",
    ]));
  }, 30_000);
});
