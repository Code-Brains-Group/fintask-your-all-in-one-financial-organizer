// Sends a daily reminder digest to users who opted in.
// Triggered by pg_cron OR called manually from the UI for "Send me a test".
// Uses the queued send-transactional-email function (template: notification-digest).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.userId) targetUserId = body.userId;
  } catch (_) { /* noop */ }

  // Fetch users with email notifications on
  let q = supabase.from("profiles").select("id, display_name, notify_email, notify_tasks, notify_applications, notify_recurring, notify_budgets").eq("notify_email", true);
  if (targetUserId) q = q.eq("id", targetUserId);
  const { data: profiles, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const sentFor: string[] = [];

  for (const p of profiles || []) {
    const sections: { label: string; items: string[] }[] = [];

    if (p.notify_tasks) {
      const { data } = await supabase.from("tasks")
        .select("title, due_date, status").eq("user_id", p.id).neq("status", "done")
        .lte("due_date", in7).order("due_date");
      const items = (data || []).map(t =>
        `${t.due_date && t.due_date.slice(0, 10) < today ? "⚠️ Overdue" : "📅 Due " + (t.due_date?.slice(0, 10) || "")} — ${t.title}`);
      if (items.length) sections.push({ label: "Tasks", items });
    }

    if (p.notify_applications) {
      const { data } = await supabase.from("applications")
        .select("title, organization, deadline, reminder_days_before").eq("user_id", p.id)
        .not("deadline", "is", null).lte("deadline", in7);
      const items = (data || [])
        .filter(a => {
          const lead = a.reminder_days_before ?? 3;
          const cutoff = new Date(Date.now() + lead * 86400000).toISOString().slice(0, 10);
          return a.deadline <= cutoff;
        })
        .map(a => `🎓 ${a.title}${a.organization ? ` — ${a.organization}` : ""} (deadline ${a.deadline})`);
      if (items.length) sections.push({ label: "Applications", items });
    }

    if (p.notify_recurring) {
      const { data: pend } = await supabase.from("pending_recurring")
        .select("rule_id, due_date").eq("user_id", p.id).eq("status", "pending").lte("due_date", today);
      if (pend?.length) {
        const ruleIds = pend.map(x => x.rule_id);
        const { data: rules } = await supabase.from("recurring_rules").select("id, description, amount").in("id", ruleIds);
        const items = pend.map(p => {
          const r = rules?.find(r => r.id === p.rule_id);
          return `🔁 ${r?.description || "Recurring item"} — KES ${r?.amount || 0} due ${p.due_date}`;
        });
        if (items.length) sections.push({ label: "Recurring approvals", items });
      }
    }

    if (p.notify_budgets) {
      const { data: budgets } = await supabase.from("budgets").select("id, name, monthly_limit, period_start, period_end").eq("user_id", p.id);
      const { data: items } = await supabase.from("budget_items").select("budget_id, transaction_id, purchased").eq("user_id", p.id).eq("purchased", true);
      const txIds = (items || []).map(i => i.transaction_id).filter(Boolean) as string[];
      const { data: txs } = txIds.length
        ? await supabase.from("transactions").select("id, amount, fee").in("id", txIds)
        : { data: [] as any[] };
      const alerts: string[] = [];
      for (const b of budgets || []) {
        const linked = (items || []).filter(i => i.budget_id === b.id && i.transaction_id);
        const spent = linked.reduce((a, i) => {
          const t = txs?.find(t => t.id === i.transaction_id);
          return a + (t ? Number(t.amount) + Number(t.fee || 0) : 0);
        }, 0);
        const limit = Number(b.monthly_limit) || 0;
        if (limit && spent / limit >= 0.8) {
          alerts.push(`💸 ${b.name}: ${Math.round((spent / limit) * 100)}% of ${limit}`);
        }
      }
      if (alerts.length) sections.push({ label: "Budgets", items: alerts });
    }

    if (!sections.length) continue;

    const userResp = await supabase.auth.admin.getUserById(p.id);
    const email = userResp.data.user?.email;
    if (!email) continue;

    // Try the Lovable transactional email pipeline if it exists; otherwise log only.
    try {
      const resp = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notification-digest",
          recipientEmail: email,
          idempotencyKey: `digest-${p.id}-${today}`,
          templateData: { name: p.display_name || "there", sections },
        },
      });
      if (resp.error) console.warn("send-transactional-email failed", resp.error);
      else sentFor.push(email);
    } catch (e) {
      console.warn("transactional email pipeline not configured yet", String(e));
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sentFor.length, recipients: sentFor }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
