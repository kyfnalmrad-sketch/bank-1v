import { describe, expect, it } from "vitest";
import { clearStatementHistory, ensureRenderStagingSchema, getRenderPool } from "./renderPg";

describe("Render Postgres staging schema", () => {
  it.skipIf(Boolean(process.env.RENDER_POSTGRES_URL))("does not claim to clear records when the database is unavailable", async () => {
    await expect(clearStatementHistory("workspace-bank-test-123456")).resolves.toEqual({ deleted: false, count: 0, reason: "database-unavailable" });
  });

  it.skipIf(!process.env.RENDER_POSTGRES_URL)("creates the required empty staging tables and reports their count", async () => {
    const result = await ensureRenderStagingSchema();
    expect(result.tableCount).toBeGreaterThanOrEqual(8);

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
      "staging_snapshots",
    ]));
  }, 30_000);
});
