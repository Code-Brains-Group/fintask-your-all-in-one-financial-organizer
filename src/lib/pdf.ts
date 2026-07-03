import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtKES, fmtDate } from "./finance";

export type MonthReport = {
  period: string;               // e.g. "2026-05"
  periodLabel: string;          // e.g. "May 2026"
  generatedBy: string;
  generatedAt: string;          // ISO
  income: number;
  expense: number;
  fees: number;
  net: number;
  txCount: number;
  byCategory: { name: string; value: number }[];
  topCategory?: string;
  insights: string[];
  nextMonthTips: string[];
};

// jsPDF's built-in Helvetica only supports WinAnsi. Strip anything outside that
// range (emoji, smart quotes, en/em dashes, arrows) so the PDF never renders
// tofu boxes for user-supplied names, category icons, or month labels.
const sanitize = (s: string) =>
  String(s ?? "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2022\u25CF\u25E6]/g, "-")
    .replace(/[\u2192\u21D2\u27A1]/g, ">")
    .replace(/\u00A0/g, " ")
    // Strip emoji / pictographs / symbols outside WinAnsi range.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const money = (n: number) => sanitize(fmtKES(n));

export function downloadMonthReport(r: MonthReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const periodLabel = sanitize(r.periodLabel);
  const generatedBy = sanitize(r.generatedBy) || "Unknown";
  const gen = new Date(r.generatedAt);
  const genDate = fmtDate(gen);
  const genTime = gen.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Header band
  doc.setFillColor(1, 117, 194);
  doc.rect(0, 0, W, 76, "F");
  doc.setTextColor(255);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("FinTask Monthly Report", 32, 34);
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  doc.text(periodLabel, 32, 56);

  // Meta block
  doc.setTextColor(80);
  doc.setFontSize(10);
  doc.text(`Prepared for: ${generatedBy}`, 32, 100);
  doc.text(`Generated on ${genDate} at ${genTime}`, 32, 116);
  doc.text(`Total transactions this month: ${r.txCount}`, 32, 132);

  // Summary table
  autoTable(doc, {
    startY: 152,
    head: [["Summary", "Amount"]],
    body: [
      ["Total income", money(r.income)],
      ["Total expenses", money(r.expense)],
      ["Transaction fees", money(r.fees)],
      [r.net >= 0 ? "Net savings" : "Net shortfall", money(r.net)],
    ],
    theme: "grid",
    headStyles: { fillColor: [1, 117, 194], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Category breakdown
  const catStart = (doc as any).lastAutoTable.finalY + 24;
  doc.setTextColor(30); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Where your money went", 32, catStart);
  autoTable(doc, {
    startY: catStart + 10,
    head: [["Category", "Amount spent", "Share of expenses"]],
    body: r.byCategory.length
      ? r.byCategory.map(c => [
          sanitize(c.name),
          money(c.value),
          r.expense > 0 ? ((c.value / r.expense) * 100).toFixed(1) + "%" : "-",
        ])
      : [["No expenses recorded for this month", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [52, 168, 83], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  const writeSection = (title: string, lines: string[], bullet: string, startY: number) => {
    let y = startY;
    if (y > H - 120) { doc.addPage(); y = 60; }
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(30);
    doc.text(title, 32, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
    lines.forEach(line => {
      const wrapped = doc.splitTextToSize(`${bullet}  ${sanitize(line)}`, W - 64);
      if (y + wrapped.length * 12 > H - 60) { doc.addPage(); y = 60; }
      doc.text(wrapped, 32, y);
      y += wrapped.length * 12 + 4;
    });
    return y + 12;
  };

  let y = (doc as any).lastAutoTable.finalY + 28;
  y = writeSection(
    "Highlights from this month",
    r.insights.length ? r.insights : ["No standout patterns to report this month."],
    "-",
    y,
  );
  y = writeSection(
    "Recommendations for next month",
    r.nextMonthTips.length ? r.nextMonthTips : ["Keep tracking your spending consistently to build a clearer picture."],
    ">",
    y,
  );

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text(
      `FinTask - ${periodLabel} - Confidential - Page ${i} of ${pages}`,
      32,
      H - 20,
    );
  }

  doc.save(`FinTask-Report-${r.period}.pdf`);
}

export function buildInsights(
  income: number,
  expense: number,
  byCat: { name: string; value: number }[],
  prevExpense?: number,
) {
  const out: string[] = [];
  const net = income - expense;
  if (income > 0) {
    const rate = ((net / income) * 100).toFixed(1);
    out.push(
      net >= 0
        ? `You kept ${rate}% of your income this month.`
        : `You spent ${Math.abs(Number(rate)).toFixed(1)}% more than you earned this month.`,
    );
  }
  if (byCat[0]) {
    const share = expense > 0 ? ((byCat[0].value / expense) * 100).toFixed(0) : "0";
    out.push(`Your biggest spending category was ${byCat[0].name}, totalling ${fmtKES(byCat[0].value)} (${share}% of expenses).`);
  }
  if (byCat[1]) {
    out.push(`Next was ${byCat[1].name} at ${fmtKES(byCat[1].value)}.`);
  }
  if (prevExpense !== undefined && prevExpense > 0) {
    const diff = ((expense - prevExpense) / prevExpense) * 100;
    out.push(
      diff >= 0
        ? `Overall spending rose by ${diff.toFixed(1)}% compared to last month.`
        : `Overall spending fell by ${Math.abs(diff).toFixed(1)}% compared to last month.`,
    );
  }
  return out;
}

export function buildTips(
  income: number,
  expense: number,
  byCat: { name: string; value: number }[],
) {
  const tips: string[] = [];
  if (byCat[0] && expense > 0 && byCat[0].value / expense > 0.35) {
    tips.push(`${byCat[0].name} took over a third of your spending. Set a monthly cap and track it weekly.`);
  }
  const net = income - expense;
  if (income > 0 && net / income < 0.1) {
    tips.push("Aim to save at least 10% of your income. Automate a transfer to savings on the day you get paid.");
  }
  if (net < 0) {
    tips.push("Trim your two largest categories by about 15% next month to bring your balance back into the positive.");
  }
  if (byCat.length > 5) {
    tips.push("Your spending is spread across many categories. Try a weekly cash allowance for discretionary items.");
  }
  tips.push("Review your recurring subscriptions and cancel any you have not used in the last 30 days.");
  return tips;
}
