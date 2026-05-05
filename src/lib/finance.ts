export const fmtKES = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}KES ${Math.abs(v).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export type TxMethod = "direct" | "mpesa_withdraw" | "mpesa_send" | "mpesa_paybill" | "mpesa_buygoods" | "custom";

export const METHOD_LABELS: Record<string, string> = {
  direct: "Direct / Cash",
  mpesa_withdraw: "M-Pesa Withdrawal",
  mpesa_send: "M-Pesa Send Money",
  mpesa_paybill: "M-Pesa Pay Bill",
  mpesa_buygoods: "M-Pesa Buy Goods",
  custom: "Custom",
};

export const METHOD_TO_TIER: Record<string, string> = {
  mpesa_withdraw: "withdrawal",
  mpesa_send: "send",
  mpesa_paybill: "paybill",
  mpesa_buygoods: "buygoods",
};

export type Tier = { min_amount: number; max_amount: number; fee: number; tx_type: string };

export function lookupFee(amount: number, method: string, tiers: Tier[]): number {
  if (!amount || method === "direct") return 0;
  const txType = METHOD_TO_TIER[method];
  if (!txType) return 0;
  const match = tiers.find(
    (t) => t.tx_type === txType && amount >= Number(t.min_amount) && amount <= Number(t.max_amount)
  );
  return match ? Number(match.fee) : 0;
}
