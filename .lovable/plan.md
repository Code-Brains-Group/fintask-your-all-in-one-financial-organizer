# Make the app feel like the user's own

Give every user control over their Dashboard, their Reports page, and let them build, save, share and export their own custom reports — all synced to their account.

## 1. Data model (Cloud)

Two new tables in the backend, both scoped to the user.

**`user_layouts`** — one row per user per surface (dashboard, reports)
- `user_id`, `surface` (`'dashboard' | 'reports'`), `widgets jsonb` (ordered array of `{ id, type, visible, size, settings }`), `updated_at`
- Unique on (`user_id`, `surface`)

**`custom_reports`** — user-defined reports
- `user_id`, `name`, `emoji`, `description`
- `config jsonb` — the builder output (see §3)
- `is_pinned bool` (show on dashboard), `share_token text unique nullable` (for public share link), `share_expires_at`
- RLS: owner full access; anonymous SELECT allowed **only** when `share_token` matches a caller-provided token via a `SECURITY DEFINER` RPC `get_shared_report(_token text)` — the table itself denies anon.

Both tables get proper GRANTs + RLS as required.

## 2. Customizable Dashboard & Reports

A new `useLayout(surface)` hook loads/saves the widget array to `user_layouts`, with a localStorage fallback so first paint is instant.

Widget shell:
- Each existing card on `Dashboard.tsx` and `Reports.tsx` is wrapped as a `<Widget id type>` with a drag handle, a "hide" button, and a settings gear (where relevant, e.g. date range on a chart).
- An **Edit layout** toggle in the page header reveals drag handles, hidden widgets, and a "+ Add widget" drawer listing everything available.
- Reordering uses `@dnd-kit/sortable` (already lightweight, works on touch).

Widget catalog (initial):
- **Dashboard:** KPIs (Income, Expenses, Net, Savings rate), Recent transactions, Upcoming recurring, Budget progress, Top categories, Savings goals progress, Tasks due today, Pinned custom reports
- **Reports:** Daily trend, Category pie, Income vs expense bars, Wallet breakdown, Closed months, Any pinned custom report

Users can add the same widget more than once with different settings (e.g. two "Top categories" cards for different date ranges).

## 3. Guided Custom Report Builder

Route: `/finance/reports/custom/new` and `/finance/reports/custom/:id`

Five-step wizard, each step validated before "Next":

1. **Basics** — name, emoji, optional description
2. **Data source** — Transactions / Budgets / Savings / Recurring (Finance only for now)
3. **Metric** — Sum of amount, Count, Average, Net (income − expense − fees); optional secondary metric for comparison
4. **Group by** — Category, Wallet, Day, Week, Month, Type, Tag; plus filters (date range preset, type, wallets, categories, min/max amount, text search)
5. **Visualize** — Chart type (bar, line, area, pie, stat cards, table), sort, top-N limit, color palette; live preview panel on the right updates as they tweak

The `config` object is a small typed schema (`ReportConfig`) so the same renderer powers preview, saved view, dashboard widget, and share page.

## 4. Custom reports library

New page `/finance/reports/custom` — grid of saved reports with:
- Open, Edit, Duplicate, Pin to dashboard, Share, Export (Excel / PDF via the existing `lib/pdf.ts`), Delete
- Empty state that pitches the builder with 3 one-click starter templates ("My top spending", "Monthly cashflow", "Wallet health")

Individual report page `/finance/reports/custom/:id` renders using the shared `<ReportRenderer config>` component and offers the same actions.

## 5. Sharing

- "Share" generates a short `share_token` and copies `${origin}/r/:token`
- Public route `/r/:token` fetches via the `get_shared_report` RPC (no auth), renders read-only with a subtle "Made in FinTask" footer
- Owner can revoke or set expiry from the report's Share dialog

## 6. Navigation & discovery

- Sidebar: add **Custom reports** under Finance
- Reports page header: **+ New custom report** button
- Dashboard edit mode: "Add pinned report" appears once the user has at least one

## Technical notes

- New files: `src/hooks/useLayout.ts`, `src/components/widgets/Widget.tsx`, `src/components/widgets/registry.tsx` (maps widget `type` → component + default settings), `src/components/reports/ReportRenderer.tsx`, `src/pages/CustomReports.tsx`, `src/pages/CustomReportBuilder.tsx`, `src/pages/CustomReportView.tsx`, `src/pages/SharedReport.tsx`, `src/lib/reportEngine.ts` (runs a `ReportConfig` against fetched rows)
- Refactor `Dashboard.tsx` and `Reports.tsx` to render from the widget registry instead of hardcoded JSX; existing charts move into widget components 1:1 so nothing is lost
- Add `@dnd-kit/core` and `@dnd-kit/sortable`
- All queries stay client-side against existing tables; the report engine is pure TS and reused for preview + export
- PDF/Excel export routes through existing `lib/pdf.ts` and `xlsx` — the renderer just hands them the resolved rows

## Out of scope for this pass

Tasks / Applications / Learning as data sources (Finance only, per your choice), multi-metric computed fields, and scheduled report emails — easy to add later on top of the same `ReportConfig` shape.
