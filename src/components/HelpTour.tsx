import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const TOUR_STEPS = [
  { icon: "🏠", title: "Welcome to FinTask", body: "FinTask combines money tracking, task management, and application/scholarship tracking. Let's take a quick tour." },
  { icon: "🧩", title: "Modules — pick what you need", body: "FinTask has three modules: Finance, Tasks and Applications. You ticked some at signup, but you can add or remove any of them anytime in Settings → Modules.", path: "/settings" },
  { icon: "💸", title: "Transactions", body: "Record income, expenses and transfers between wallets. M-Pesa fees auto-calculate. Filter by Today / Week / Month / Year or a custom range.", path: "/finance/transactions" },
  { icon: "📊", title: "Budgets & Plans", body: "List what you plan to buy, set a limit, then link real transactions. Budgets can recur weekly, monthly or yearly with auto-renew.", path: "/finance/budgets" },
  { icon: "🐷", title: "Savings Goals", body: "Set targets, contribute over time, watch progress bars fill up.", path: "/finance/savings" },
  { icon: "🔁", title: "Recurring", body: "Define rules (rent, salary, subscriptions). Tick 'Align to fiscal period' to snap them to your custom month/year start. Pending entries land on the Dashboard for one-tap Approve/Skip.", path: "/finance/recurring" },
  { icon: "📈", title: "Reports", body: "Charts and breakdowns by category, wallet and time period — using your custom fiscal month/year. Export to CSV.", path: "/finance/reports" },
  { icon: "✅", title: "Tasks", body: "List, Kanban board, or task dashboard. Drag cards between columns. Attach a planned cost and link transactions to see real spend per task.", path: "/tasks" },
  { icon: "🎓", title: "Applications", body: "Track scholarships and job applications with deadlines, statuses and reminders. Add to Google Calendar in one click.", path: "/applications" },
  { icon: "🔔", title: "Reminders & Calendar", body: "Tasks and applications can be exported to your calendar (.ics or Google) and you can opt in to email reminders in Settings → Notifications." },
  { icon: "⚙️", title: "Make it yours", body: "Tweak modules, fiscal period, wallets, categories, fee tiers, notification prefs and replay this tour anytime from Settings." },
];

export default function HelpTour({ force, onClose }: { force?: boolean; onClose?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (force) { setOpen(true); setStep(0); return; }
    if (!user) return;
    supabase.from("profiles").select("tour_completed").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data && !data.tour_completed) setOpen(true); });
  }, [user, force]);

  const finish = async () => {
    setOpen(false);
    if (user) await supabase.from("profiles").update({ tour_completed: true }).eq("id", user.id);
    onClose?.();
  };
  const s = TOUR_STEPS[step];
  const next = () => {
    if (s.path) navigate(s.path);
    if (step + 1 < TOUR_STEPS.length) setStep(step + 1);
    else finish();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="text-4xl mb-2">{s.icon}</div>
          <DialogTitle className="text-xl">{s.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
        <div className="flex items-center gap-1 mt-2">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="flex justify-between gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button size="sm" onClick={next}>{step + 1 === TOUR_STEPS.length ? "Done" : "Next"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
