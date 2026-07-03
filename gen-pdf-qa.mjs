import { downloadMonthReport, buildInsights, buildTips } from '/dev-server/src/lib/pdf.ts';
import fs from 'fs';
// Patch jsPDF save to write file
const r = {
  period: '2026-06', periodLabel: 'June 2026',
  generatedBy: 'Wangũi Kamau — Test • User',
  generatedAt: new Date('2026-07-03T09:15:00').toISOString(),
  income: 120000, expense: 87500, fees: 1250, net: 31250, txCount: 47,
  byCategory: [
    { name: '🍔 Food & Drinks', value: 32000 },
    { name: '🚗 Transport', value: 18500 },
    { name: '🏠 Rent', value: 25000 },
    { name: '📱 Airtime', value: 4000 },
  ],
  insights: buildInsights(120000, 87500, [
    { name: 'Food & Drinks', value: 32000 },
    { name: 'Transport', value: 18500 },
  ], 78000),
  nextMonthTips: buildTips(120000, 87500, [
    { name: 'Food & Drinks', value: 32000 },
    { name: 'Transport', value: 18500 },
  ]),
};
// override save
const jsPDF = (await import('jspdf')).default;
const orig = jsPDF.prototype.save;
jsPDF.prototype.save = function(name){ fs.writeFileSync('/tmp/pdfqa/'+name, Buffer.from(this.output('arraybuffer'))); };
downloadMonthReport(r);
console.log('done');
