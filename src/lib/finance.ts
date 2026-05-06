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

export type TxMethod = "direct" | "mpesa_withdraw" | "mpesa_send" | "mpesa_paybill" | "mpesa_buygoods" | "bank_to_mpesa" | "bank_transfer" | "custom";

export const METHOD_LABELS: Record<string, string> = {
  direct: "Direct / Cash",
  mpesa_withdraw: "M-Pesa Withdrawal",
  mpesa_send: "M-Pesa Send Money",
  mpesa_paybill: "M-Pesa Pay Bill",
  mpesa_buygoods: "M-Pesa Buy Goods",
  bank_to_mpesa: "Bank → M-Pesa",
  bank_transfer: "Bank Transfer",
  custom: "Custom",
};

export const METHOD_TO_TIER: Record<string, string> = {
  mpesa_withdraw: "withdrawal",
  mpesa_send: "send",
  mpesa_paybill: "paybill",
  mpesa_buygoods: "buygoods",
  bank_to_mpesa: "bank_to_mpesa",
  bank_transfer: "bank_transfer",
};

export const TASK_STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  todo:        { bg: "bg-warning-soft",  text: "text-warning",  border: "border-warning/30",  dot: "bg-warning",  label: "To Do" },
  in_progress: { bg: "bg-primary-soft",  text: "text-primary",  border: "border-primary/30",  dot: "bg-primary",  label: "In Progress" },
  done:        { bg: "bg-success-soft",  text: "text-success",  border: "border-success/30",  dot: "bg-success",  label: "Done" },
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
