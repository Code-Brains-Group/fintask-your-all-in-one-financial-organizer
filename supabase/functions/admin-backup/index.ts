import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "profiles","user_roles","wallets","categories","cost_providers","cost_tiers",
  "transactions","budgets","budget_items","recurring_rules","pending_recurring",
  "savings_goals","savings_contributions","tasks","subtasks","task_assignees",
  "applications","groups","group_members","group_invites",
];

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

    const lines: string[] = [
      `-- FinTask backup`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- By: ${u.user.email}`,
      `BEGIN;`,
      ``,
    ];

    for (const t of TABLES) {
      const { data, error } = await admin.from(t).select("*");
      if (error) { lines.push(`-- ${t}: ${error.message}`); continue; }
      lines.push(`-- Table: ${t} (${data?.length ?? 0} rows)`);
      if (!data || data.length === 0) { lines.push(""); continue; }
      const cols = Object.keys(data[0]);
      for (const row of data) {
        const vals = cols.map((c) => esc((row as any)[c])).join(", ");
        lines.push(`INSERT INTO public.${t} (${cols.join(", ")}) VALUES (${vals});`);
      }
      lines.push("");
    }
    lines.push("COMMIT;");

    return new Response(lines.join("\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="fintask-backup-${new Date().toISOString().slice(0,10)}.sql"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
