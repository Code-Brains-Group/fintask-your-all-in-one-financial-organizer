import { jsPDF } from "jspdf";
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

export function downloadMonthReport(r: MonthReport, password: string) {
  if (!password) throw new Error("A password is required to protect this PDF.");
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      userPassword: password,
      ownerPassword: `${password}:fintask-owner`,
      userPermissions: ["print"],
    },
  });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const periodLabel = sanitize(r.periodLabel);
  const generatedBy = sanitize(r.generatedBy) || "Unknown";
  const gen = new Date(r.generatedAt);
  const genDate = fmtDate(gen);
  const genTime = gen.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Statement-style masthead, inspired by the compact hierarchy of an M-PESA statement.
  doc.setDrawColor(35, 166, 52);
  doc.setLineWidth(1.2);
  doc.line(32, 34, W - 32, 34);
  doc.setTextColor(35, 166, 52);
  doc.setFontSize(21); doc.setFont("helvetica", "bold");
  doc.text("FINTASK MONTHLY STATEMENT", W / 2, 66, { align: "center" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.setTextColor(95);
  doc.text("A clear record of your month in money", W / 2, 82, { align: "center" });

  doc.setFillColor(245, 251, 246);
  doc.roundedRect(32, 102, W - 64, 58, 5, 5, "F");
  doc.setFontSize(9); doc.setTextColor(35, 166, 52); doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR", 46, 120);
  doc.text("STATEMENT PERIOD", W / 2 + 12, 120);
  doc.setFontSize(11); doc.setTextColor(35); doc.setFont("helvetica", "normal");
  doc.text(generatedBy, 46, 139);
  doc.text(periodLabel, W / 2 + 12, 139);
  doc.setFontSize(8); doc.setTextColor(105);
  doc.text(`Generated ${genDate} at ${genTime}`, 46, 152);
  doc.text(`${r.txCount} recorded transactions`, W / 2 + 12, 152);

  // Summary table
  autoTable(doc, {
    startY: 184,
    head: [["MONTHLY SUMMARY", "AMOUNT"]],
    body: [
      ["Total income", money(r.income)],
      ["Total expenses", money(r.expense)],
      ["Transaction fees", money(r.fees)],
      [r.net >= 0 ? "Net savings" : "Net shortfall", money(r.net)],
    ],
    theme: "grid",
    headStyles: { fillColor: [35, 166, 52], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 251, 246] },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Category breakdown
  const catStart = (doc as any).lastAutoTable.finalY + 24;
  doc.setTextColor(30); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("SPENDING BREAKDOWN", 32, catStart);
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
    headStyles: { fillColor: [35, 166, 52], textColor: 255, fontStyle: "bold" },
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
    "MONTH HIGHLIGHTS",
    r.insights.length ? r.insights : ["No standout patterns to report this month."],
    "-",
    y,
  );
  y = writeSection(
    "NEXT MONTH FOCUS",
    r.nextMonthTips.length ? r.nextMonthTips : ["Keep tracking your spending consistently to build a clearer picture."],
    ">",
    y,
  );

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(35, 166, 52); doc.setLineWidth(0.6);
    doc.line(32, H - 34, W - 32, H - 34);
    doc.setFontSize(8); doc.setTextColor(120);
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
