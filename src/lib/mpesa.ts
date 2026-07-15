import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type MpesaStatementRow = {
  id: string;
  receipt: string;
  date: string;
  time: string;
  description: string;
  status: string;
  amount: number;
  balance: number;
  isCharge: boolean;
};

type TextPoint = { text: string; x: number; y: number };

const receiptLine = /^([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/;
const statusPattern = /\s+(Completed|Failed|Reversed|Cancelled|Pending)\s+/i;
const moneyPattern = /-?\d[\d,]*\.\d{2}/g;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const numberFrom = (value: string) => Number(value.replace(/,/g, ""));

function linesFrom(items: TextPoint[]) {
  const groups: { y: number; points: TextPoint[] }[] = [];
  items
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .forEach((point) => {
      const group = groups.find((candidate) => Math.abs(candidate.y - point.y) < 2.5);
      if (group) group.points.push(point);
      else groups.push({ y: point.y, points: [point] });
    });

  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => clean(group.points.sort((a, b) => a.x - b.x).map((point) => point.text).join(" ")))
    .filter(Boolean);
}

const isPageFurniture = (line: string) =>
  /^(Page \d+ of \d+|Receipt No\.|Disclaimer:|Statement Verification Code|For self-help dial|prompts to enter|ELZC4NCA)/i.test(line) ||
  /Data Protection Act|Safaricom PLC|www\.safaricom\.co\.ke/i.test(line);

export async function parseMpesaStatement(file: File, password: string): Promise<MpesaStatementRow[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data, password: password || undefined }).promise;
  const rows: MpesaStatementRow[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const points = content.items.flatMap((raw) => {
      if (!("str" in raw) || !raw.str.trim()) return [];
      return [{ text: raw.str, x: raw.transform[4], y: raw.transform[5] }];
    });
    const lines = linesFrom(points);
    let current: MpesaStatementRow | null = null;

    for (const line of lines) {
      const start = line.match(receiptLine);
      if (start) {
        const [, receipt, date, time, remainder] = start;
        const status = remainder.match(statusPattern);
        if (!status || status.index === undefined) {
          current = null;
          continue;
        }

        const description = clean(remainder.slice(0, status.index));
        const amounts = remainder.slice(status.index + status[0].length).match(moneyPattern) || [];
        if (amounts.length < 2) {
          current = null;
          continue;
        }

        const amount = numberFrom(amounts[amounts.length - 2]);
        const balance = numberFrom(amounts[amounts.length - 1]);
        current = {
          id: `${receipt}-${pageNumber}-${rows.length}`,
          receipt,
          date,
          time,
          description,
          status: status[1],
          amount,
          balance,
          isCharge: /\bcharge\b/i.test(description),
        };
        rows.push(current);
        continue;
      }

      if (current && !isPageFurniture(line) && !/^M-PESA STATEMENT|^SUMMARY|^DETAILED STATEMENT/i.test(line)) {
        current.description = clean(`${current.description} ${line}`);
        current.isCharge = /\bcharge\b/i.test(current.description);
      }
      if (isPageFurniture(line)) current = null;
    }
  }

  await pdf.destroy();
  if (!rows.length) throw new Error("No M-PESA transactions were found. Check that this is a detailed Safaricom M-PESA statement.");
  return rows.filter((row) => row.status.toLowerCase() === "completed" && row.amount !== 0);
}

export function mpesaMethod(description: string) {
  const details = description.trim();
  if (/pay\s*bill?/i.test(details)) return "mpesa_paybill";
  if (/^customer transfer to\b/i.test(details)) return "mpesa_send";
  if (/^customer payment to small\b/i.test(details)) return "mpesa_send";
  if (/^merchant payment\b/i.test(details)) return "mpesa_buygoods";
  if (/withdrawal/i.test(details)) return "mpesa_withdraw";
  if (/transfer|send money/i.test(details)) return "mpesa_send";
  if (/from bank|bank .* via api/i.test(details)) return "bank_to_mpesa";
  return "direct";
}
