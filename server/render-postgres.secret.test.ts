import { describe, expect, it } from "vitest";

describe("Render Postgres staging secret", () => {
  it.skipIf(!process.env.RENDER_POSTGRES_URL)("connects using the protected URL and runs a read-only identity query", async () => {
    const url = process.env.RENDER_POSTGRES_URL;
    expect(url).toMatch(/^postgres(?:ql)?:\/\//);

    const { Client } = await import("pg");
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    });

    try {
      await client.connect();
      const result = await client.query<{ database_name: string }>("select current_database() as database_name");
      expect(result.rows[0]?.database_name).toBe("bank_karimi_staging");
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 30_000);
});
