import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlayCircle } from "lucide-react";
import HelpTour from "@/components/HelpTour";

const SECTIONS = [
  { id: "dashboard", icon: "🏠", title: "Dashboard", body: [
    "Your home view. Shows balances per wallet, monthly income vs expense, recent transactions, pending recurring approvals and task spend insights.",
    "If you only enabled Tasks, the Dashboard becomes your task overview instead.",
  ]},
  { id: "transactions", icon: "💸", title: "Transactions", body: [
    "Tap + New transaction. Pick income, expense or transfer.",
    "Choose a wallet, category, amount and date. M-Pesa fees auto-fill from the tier table you configured in Settings.",
    "Use the date filter chips (Today / Week / Month / Year / Custom) to slice your history.",
    "You can edit or delete any transaction from its row.",
    "Link a transaction to a task to track real spend on that task.",
  ]},
  { id: "budgets", icon: "📊", title: "Budgets & Plans", body: [
    "A budget = a list of items you intend to buy + a limit.",
    "Tick items as 'Purchased' and link the matching transaction so the spent bar reflects reality.",
    "New budgets can recur weekly / monthly / yearly with auto-renew, and you can pick custom start/end dates instead of calendar months.",
  ]},
  { id: "savings", icon: "🐷", title: "Savings Goals", body: [
    "Create a goal, set the target and (optionally) a deadline and source wallet.",
    "Add contributions any time — the progress bar updates automatically.",
  ]},
  { id: "recurring", icon: "🔁", title: "Recurring transactions", body: [
    "Define rules for things that repeat: rent, salary, Netflix, school fees.",
    "When a rule is due, a pending entry shows up on the Dashboard with Approve / Skip buttons.",
    "Approving inserts the transaction; if the rule is linked to a task, the cost is added to that task too.",
  ]},
  { id: "reports", icon: "📈", title: "Reports", body: [
    "See spend by category, wallet, and over time.",
    "Pick a date range and download a CSV for tax/audit/personal use.",
  ]},
  { id: "tasks", icon: "✅", title: "Tasks", body: [
    "Three views — List, Kanban Board (drag-and-drop), and Task Dashboard (charts).",
    "Each task can have a priority, due date, planned cost and labels.",
    "Spent vs Planned is computed from any transactions you link to the task.",
    "Tasks support calendar export (.ics or Google) with a 30-minute reminder.",
  ]},
  { id: "applications", icon: "🎓", title: "Applications", body: [
    "Track scholarships, jobs, internships and grants in one place.",
    "Statuses: saved → applied → interview → offer / rejected.",
    "Set a deadline and how many days in advance you want to be reminded.",
    "Add to Google Calendar or download .ics for any application.",
  ]},
  { id: "notifications", icon: "🔔", title: "Reminders & email notifications", body: [
    "Calendar: every task and application has buttons to add it to Google Calendar or download a .ics file with a 30-minute reminder.",
    "Email: enable in Settings → Notifications. You'll receive a daily digest covering due/overdue tasks, approaching application deadlines, pending recurring transactions and budgets close to/over their limit.",
  ]},
  { id: "settings", icon: "⚙️", title: "Settings", body: [
    "Profile — display name, currency, workspace focus.",
    "Wallets — add, rename, edit balance, delete.",
    "Categories — manage your spend/income categories.",
    "Transaction Costs — your M-Pesa (or other) fee tiers.",
    "Notifications — toggle email reminders + default lead time.",
    "You can also replay this tour from here.",
  ]},
];

export default function Help() {
  const [tour, setTour] = useState(false);
  return (
    <div className="space-y-6 max-w-3xl">
      {tour && <HelpTour force onClose={() => setTour(false)} />}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Getting started</h1>
          <p className="text-muted-foreground text-sm">A short guide to every module in FinTask.</p>
        </div>
        <Button onClick={() => setTour(true)}><PlayCircle className="h-4 w-4 mr-1" /> Replay tour</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quick start (60 seconds)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Add your wallets in <b>Settings → Wallets</b> with their current balances.</p>
          <p>2. Record a few <b>Transactions</b> — income and expenses.</p>
          <p>3. Create a <b>Budget</b> for the month and link items to transactions.</p>
          <p>4. Add a <b>Task</b> with a planned cost — link any transaction to it.</p>
          <p>5. Turn on <b>Email reminders</b> in Settings → Notifications.</p>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        {SECTIONS.map(s => (
          <AccordionItem key={s.id} value={s.id}>
            <AccordionTrigger className="text-left">
              <span className="flex items-center gap-2"><span className="text-xl">{s.icon}</span> {s.title}</span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {s.body.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
