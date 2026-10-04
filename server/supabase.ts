import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConnectionStatus =
  | { configured: false; connected: false; reason: "missing_environment" }
  | { configured: true; connected: false; reason: "request_failed"; message: string }
  | {
      configured: true;
      connected: true;
      service: string;
      status: string;
      schemaVersion: string;
    };

type HealthCheckRow = {
  service: string;
  status: string;
  schema_version: string;
};

let client: SupabaseClient | null = null;

function readConfig() {
  return {
    url: process.env.SUPABASE_URL?.trim() ?? "",
    key:
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
      "",
  };
}

export function isSupabaseConfigured() {
  const config = readConfig();
  return Boolean(config.url && config.key);
}

export function getSupabaseClient() {
  if (client) return client;
  const config = readConfig();
  if (!config.url || !config.key) return null;
  client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { configured: false, connected: false, reason: "missing_environment" };
  }

  const { data, error } = await supabase
    .from("health_check")
    .select("service,status,schema_version")
    .limit(1)
    .maybeSingle<HealthCheckRow>();

  if (error || !data) {
    return {
      configured: true,
      connected: false,
      reason: "request_failed",
      message: error?.message ?? "health_check returned no row",
    };
  }

  return {
    configured: true,
    connected: true,
    service: data.service,
    status: data.status,
    schemaVersion: data.schema_version,
  };
}
