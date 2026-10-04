import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

export type MemoryValue = {
  id: string;
  app_code: "bankv1" | "good";
  module_key: string;
  field_key: string;
  value_text: string;
  label_ar: string | null;
  label_en: string | null;
  usage_count: number;
  updated_at: string;
};

export type MemoryResult<T> = {
  data: T;
  source: "supabase" | "fallback";
};

function getMemoryClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = process.env.SUPABASE_URL?.trim();
  if (serviceRoleKey && url) {
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getSupabaseClient();
}

function normalize(value: string) {
  return value.trim().replace(/\\s+/g, " ");
}

export async function listBankMemoryValues(
  moduleKey: string,
  fieldKey?: string,
  limit = 120,
): Promise<MemoryResult<MemoryValue[]>> {
  const client = getMemoryClient();
  if (!client) return { data: [], source: "fallback" };

  let query = client
    .from("memory_values")
    .select("id,app_code,module_key,field_key,value_text,label_ar,label_en,usage_count,updated_at")
    .eq("app_code", "bankv1")
    .eq("module_key", moduleKey)
    .eq("is_active", true)
    .order("usage_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (fieldKey) query = query.eq("field_key", fieldKey);

  const { data, error } = await query;
  if (error) {
    console.warn("Supabase memory read failed; legacy storage remains active", error.message);
    return { data: [], source: "fallback" };
  }
  return { data: (data ?? []) as MemoryValue[], source: "supabase" };
}

export async function rememberBankMemoryValue(input: {
  moduleKey: string;
  fieldKey: string;
  value: string;
  labelAr?: string;
  labelEn?: string;
}): Promise<MemoryResult<MemoryValue | null>> {
  const value = normalize(input.value);
  if (!value) return { data: null, source: "fallback" };

  const client = getMemoryClient();
  if (!client) return { data: null, source: "fallback" };

  const { data: existing, error: existingError } = await client
    .from("memory_values")
    .select("id,usage_count")
    .eq("app_code", "bankv1")
    .eq("module_key", input.moduleKey)
    .eq("field_key", input.fieldKey)
    .eq("value_text", value)
    .maybeSingle();
  if (existingError) {
    console.warn("Supabase memory lookup failed; legacy storage remains active", existingError.message);
    return { data: null, source: "fallback" };
  }

  const payload = {
    app_code: "bankv1" as const,
    module_key: input.moduleKey,
    field_key: input.fieldKey,
    value_text: value,
    label_ar: input.labelAr?.trim() || null,
    label_en: input.labelEn?.trim() || null,
    usage_count: existing ? Number(existing.usage_count ?? 0) + 1 : 1,
    is_active: true,
  };
  const result = existing
    ? await client.from("memory_values").update(payload).eq("id", existing.id).select("id,app_code,module_key,field_key,value_text,label_ar,label_en,usage_count,updated_at").single()
    : await client.from("memory_values").insert(payload).select("id,app_code,module_key,field_key,value_text,label_ar,label_en,usage_count,updated_at").single();
  if (result.error) {
    console.warn("Supabase memory write failed; legacy storage remains active", result.error.message);
    return { data: null, source: "fallback" };
  }
  return { data: result.data as MemoryValue, source: "supabase" };
}
