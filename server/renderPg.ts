/**
 * Render Postgres is used only for the disposable Staging dataset.
 * The URL stays in RENDER_POSTGRES_URL and is never returned to the client.
 */
import { Pool } from "pg";

let renderPool: Pool | undefined;

export function getDatabaseConnectionString() {
  return process.env.RENDER_POSTGRES_URL || process.env.EXTERNAL_POSTGRES_URL || process.env.DATABASE_URL;
}

function hasDatabaseConnection() {
  return Boolean(getDatabaseConnectionString());
}

export function getRenderPool() {
  if (!renderPool) {
    const connectionString = getDatabaseConnectionString();
    if (!connectionString) throw new Error("Database connection is not configured. Set RENDER_POSTGRES_URL or EXTERNAL_POSTGRES_URL.");
    // Render's external Postgres endpoint presents a self-signed certificate.
    // Keep TLS enabled while allowing that certificate so the staging database
    // can be reached by the save, restore, and statement-history paths.
    renderPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
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
  `CREATE TABLE IF NOT EXISTS staging_snapshots (
    id BIGSERIAL PRIMARY KEY,
    workspace_key VARCHAR(160) NOT NULL UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staging_statement_history (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(240) NOT NULL,
    statement_reference VARCHAR(120),
    customer_name TEXT,
    account_number VARCHAR(120),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function ensureRenderStagingSchema() {
  const client = await getRenderPool().connect();
  try {
    for (const statement of schemaStatements) await client.query(statement);
    await client.query("ALTER TABLE staging_statement_history ADD COLUMN IF NOT EXISTS workspace_key VARCHAR(160) NOT NULL DEFAULT 'karimi'");
    await client.query("CREATE INDEX IF NOT EXISTS staging_statement_history_workspace_idx ON staging_statement_history (workspace_key, updated_at DESC)");
    const result = await client.query<{ table_count: string }>(
      "SELECT COUNT(*)::text AS table_count FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'staging_%'",
    );
    return { tableCount: Number(result.rows[0]?.table_count ?? 0) };
  } finally {
    client.release();
  }
}

export function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown database error");
  if (/not configured/i.test(message)) return "لم يتم إعداد رابط قاعدة البيانات. أضف RENDER_POSTGRES_URL أو EXTERNAL_POSTGRES_URL في Web Service ثم أعد التشغيل.";
  if (/password authentication failed|authentication/i.test(message)) return "فشل تسجيل الدخول إلى قاعدة البيانات. راجع اسم المستخدم وكلمة المرور في رابط الاتصال.";
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return "تعذر العثور على خادم قاعدة البيانات. راجع اسم المضيف في رابط الاتصال.";
  if (/ECONNREFUSED|timeout|timed out|connection terminated/i.test(message)) return "تعذر الوصول إلى قاعدة البيانات. راجع حالة قاعدة البيانات والسماح بالاتصال الخارجي.";
  return "تعذر الاتصال بقاعدة البيانات. راجع رابط الاتصال وسجلات الخدمة.";
}

export type RenderSnapshotPayload = Record<string, unknown>;

export async function getRenderSnapshot(workspaceKey: string) {
  if (!hasDatabaseConnection()) return null;
  await ensureRenderStagingSchema();
  const result = await getRenderPool().query<{ payload: RenderSnapshotPayload; updated_at: string }>(
    "SELECT payload, updated_at FROM staging_snapshots WHERE workspace_key = $1 LIMIT 1",
    [workspaceKey],
  );
  const row = result.rows[0];
  return row ? { payload: row.payload, updatedAt: row.updated_at } : null;
}

export async function saveRenderSnapshot(workspaceKey: string, payload: RenderSnapshotPayload) {
  if (!hasDatabaseConnection()) return { saved: false as const, reason: "database-unavailable" as const };
  await ensureRenderStagingSchema();
  await getRenderPool().query(
    `INSERT INTO staging_snapshots (workspace_key, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (workspace_key)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [workspaceKey, JSON.stringify(payload)],
  );
  return { saved: true as const };
}

function historyBank(workspaceKey: string) {
  const bank = workspaceKey.split("-").at(-1);
  return bank === "ycb" || bank === "tadhamon" ? bank : "karimi";
}

function historyWorkspaceKeys(workspaceKey: string) {
  const keys = [workspaceKey];
  // Before bank isolation, saved Karimi records used the database default key.
  if (historyBank(workspaceKey) === "karimi") keys.push("karimi");
  return Array.from(new Set(keys));
}

function historyScopeSql(workspaceKey: string) {
  return { keys: historyWorkspaceKeys(workspaceKey), bank: historyBank(workspaceKey) };
}

export async function listStatementHistory(workspaceKey: string) {
  if (!hasDatabaseConnection()) return [];
  await ensureRenderStagingSchema();
  const scope = historyScopeSql(workspaceKey);
  const result = await getRenderPool().query(
    `SELECT id, title, statement_reference, customer_name, account_number, created_at, updated_at
     FROM staging_statement_history
     WHERE (workspace_key = ANY($1::varchar[]) OR payload->>'bankId' = $2)
       AND payload <> '{}'::jsonb
     ORDER BY updated_at DESC, id DESC`, [scope.keys, scope.bank],
  );
  return result.rows;
}

export async function getStatementHistory(id: number, workspaceKey: string) {
  if (!hasDatabaseConnection()) return null;
  await ensureRenderStagingSchema();
  const scope = historyScopeSql(workspaceKey);
  const result = await getRenderPool().query(
    `SELECT id, title, statement_reference, customer_name, account_number, payload, created_at, updated_at
     FROM staging_statement_history
     WHERE id = $1 AND (workspace_key = ANY($2::varchar[]) OR payload->>'bankId' = $3)
     LIMIT 1`, [id, scope.keys, scope.bank],
  );
  return result.rows[0] ?? null;
}

export async function createStatementHistory(payload: RenderSnapshotPayload, title: string, reference: string, customerName: string, accountNumber: string, workspaceKey: string) {
  if (!hasDatabaseConnection()) return { saved: false as const, reason: "database-unavailable" as const };
  await ensureRenderStagingSchema();
  const result = await getRenderPool().query<{ id: string }>(
    `INSERT INTO staging_statement_history (title, statement_reference, customer_name, account_number, payload, workspace_key)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
    [title, reference || null, customerName || null, accountNumber || null, JSON.stringify(payload), workspaceKey],
  );
  return { saved: true as const, id: Number(result.rows[0].id) };
}

export async function updateStatementHistory(id: number, payload: RenderSnapshotPayload, title: string, reference: string, customerName: string, accountNumber: string, workspaceKey: string) {
  if (!hasDatabaseConnection()) return { saved: false as const, reason: "database-unavailable" as const };
  await ensureRenderStagingSchema();
  const scope = historyScopeSql(workspaceKey);
  const result = await getRenderPool().query(
    `UPDATE staging_statement_history SET title = $2, statement_reference = $3, customer_name = $4, account_number = $5, payload = $6::jsonb, updated_at = NOW()
     WHERE id = $1 AND (workspace_key = ANY($7::varchar[]) OR payload->>'bankId' = $8)`,
    [id, title, reference || null, customerName || null, accountNumber || null, JSON.stringify(payload), scope.keys, scope.bank],
  );
  return result.rowCount === 1 ? { saved: true as const } : { saved: false as const, reason: "not-found" as const };
}

export async function deleteStatementHistory(id: number, workspaceKey: string) {
  if (!hasDatabaseConnection()) return { deleted: false as const, reason: "database-unavailable" as const };
  await ensureRenderStagingSchema();
  const scope = historyScopeSql(workspaceKey);
  const result = await getRenderPool().query("DELETE FROM staging_statement_history WHERE id = $1 AND (workspace_key = ANY($2::varchar[]) OR payload->>'bankId' = $3)", [id, scope.keys, scope.bank]);
  return result.rowCount === 1 ? { deleted: true as const } : { deleted: false as const, reason: "not-found" as const };
}
