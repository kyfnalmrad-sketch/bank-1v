/**
 * Render Postgres is used only for the disposable Staging dataset.
 * The URL stays in RENDER_POSTGRES_URL and is never returned to the client.
 */
import { Pool } from "pg";

let renderPool: Pool | undefined;

export function getRenderPool() {
  if (!renderPool) {
    const connectionString = process.env.RENDER_POSTGRES_URL;
    if (!connectionString) throw new Error("Render Postgres is not configured");
    renderPool = new Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 3 });
  }
  return renderPool;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS staging_profiles (
    id BIGSERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    momaiz_no VARCHAR(80) NOT NULL,
    passport_no VARCHAR(120),
    branch_name TEXT,
    account_number VARCHAR(120),
    account_type VARCHAR(120),
    currency VARCHAR(12) NOT NULL DEFAULT 'USD',
    customer_since DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_statements (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT REFERENCES staging_profiles(id) ON DELETE SET NULL,
    statement_reference VARCHAR(120) NOT NULL,
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_imports (
    id BIGSERIAL PRIMARY KEY,
    original_filename TEXT NOT NULL,
    sheet_name TEXT,
    column_map JSONB NOT NULL DEFAULT '{}'::jsonb,
    accepted_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_transactions (
    id BIGSERIAL PRIMARY KEY,
    statement_id BIGINT REFERENCES staging_statements(id) ON DELETE CASCADE,
    import_id BIGINT REFERENCES staging_imports(id) ON DELETE SET NULL,
    transaction_date DATE,
    description TEXT NOT NULL,
    transaction_side VARCHAR(12) NOT NULL,
    debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    running_balance NUMERIC(18,2),
    external_reference VARCHAR(180),
    operation_number VARCHAR(80) NOT NULL,
    is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_description_memory (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_person_name_memory (
    id BIGSERIAL PRIMARY KEY,
    person_name TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    event_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function ensureRenderStagingSchema() {
  const client = await getRenderPool().connect();
  try {
    for (const statement of schemaStatements) await client.query(statement);
    const result = await client.query<{ table_count: string }>(
      "SELECT COUNT(*)::text AS table_count FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'staging_%'",
    );
    return { tableCount: Number(result.rows[0]?.table_count ?? 0) };
  } finally {
    client.release();
  }
}
