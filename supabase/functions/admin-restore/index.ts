import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Restore order respects foreign keys.
const TABLE_ORDER = [
  "profiles", "user_roles", "wallets", "categories", "cost_providers", "cost_tiers",
  "groups", "group_members", "group_invites",
  "transactions", "budgets", "budget_items", "recurring_rules", "pending_recurring",
  "savings_goals", "savings_contributions", "tasks", "subtasks", "task_assignees",
  "applications", "income_plans", "plan_allocations", "plan_templates",
  "closed_months", "custom_reports", "user_layouts",
  "learning_paths", "learning_periods", "learning_deliverables", "learning_reflections",
];
const ALLOWED = new Set(TABLE_ORDER);

type Row = Record<string, unknown>;

/** Split a VALUES tuple body into raw SQL literal tokens. */
function splitValues(body: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") { cur += "''"; i++; }
        else { inStr = false; cur += ch; }
      } else cur += ch;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === "(") { depth++; cur += ch; continue; }
    if (ch === ")") { depth--; cur += ch; continue; }
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseLiteral(tok: string): unknown {
  let t = tok.trim();
  if (/^null$/i.test(t)) return null;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  // strip trailing casts like ::jsonb / ::text[]
  let cast: string | null = null;
  const castMatch = t.match(/::([a-zA-Z_ \[\]]+)$/);
  if (castMatch) { cast = castMatch[1].trim().toLowerCase(); t = t.slice(0, castMatch.index).trim(); }
  if (t.startsWith("'") && t.endsWith("'")) {
    const raw = t.slice(1, -1).replace(/''/g, "'");
    if (cast === "jsonb" || cast === "json") {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw;
  }
  const n = Number(t);
  if (!Number.isNaN(n) && t !== "") return n;
  return t;
}

/** Parse a SQL dump of INSERT statements into { table: rows[] }. */
function parseDump(sql: string): Record<string, Row[]> {
  const result: Record<string, Row[]> = {};
  const re = /INSERT\s+INTO\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1];
    const cols = m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // read the tuple(s) after VALUES
    let i = re.lastIndex;
    while (i < sql.length && /\s/.test(sql[i])) i++;
    while (sql[i] === "(") {
      let depth = 0, inStr = false, start = i;
      for (; i < sql.length; i++) {
        const ch = sql[i];
        if (inStr) {
          if (ch === "'") { if (sql[i + 1] === "'") i++; else inStr = false; }
          continue;
        }
        if (ch === "'") { inStr = true; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") { depth--; if (depth === 0) { i++; break; } }
      }
      const tuple = sql.slice(start + 1, i - 1);
      const vals = splitValues(tuple);
      const row: Row = {};
      cols.forEach((c, idx) => { row[c] = parseLiteral(vals[idx] ?? "NULL"); });
      (result[table] ||= []).push(row);
      while (i < sql.length && /[\s,]/.test(sql[i])) i++;
      if (sql[i] !== "(") break;
    }
    re.lastIndex = i;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => null) as { sql?: string; dryRun?: boolean } | null;
    if (!body?.sql || typeof body.sql !== "string") return json({ error: "Provide the backup SQL in the 'sql' field" }, 400);
    if (body.sql.length > 12_000_000) return json({ error: "Backup file too large (max ~12MB)" }, 400);

    const parsed = parseDump(body.sql);
    const tables = Object.keys(parsed);
    if (tables.length === 0) return json({ error: "No INSERT statements found. Upload a data backup file (not the schema dump)." }, 400);

    const skipped = tables.filter((t) => !ALLOWED.has(t));
    const summary: { table: string; rows: number; inserted: number; error?: string }[] = [];

    if (body.dryRun) {
      for (const t of TABLE_ORDER) if (parsed[t]) summary.push({ table: t, rows: parsed[t].length, inserted: 0 });
      return json({ dryRun: true, summary, skipped });
    }

    for (const t of TABLE_ORDER) {
      const rows = parsed[t];
      if (!rows?.length) continue;
      let inserted = 0;
      let lastError: string | undefined;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await admin.from(t).upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
        if (error) lastError = error.message; else inserted += chunk.length;
      }
      summary.push({ table: t, rows: rows.length, inserted, error: lastError });
    }

    return json({ ok: true, summary, skipped, restoredBy: u.user.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
