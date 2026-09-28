import type { InvestmentTransactionRow } from "@/data/investments/types";
import { formatCurrency, formatNumber } from "@/shared/format/financial";

export function tradeDisplay(trade: InvestmentTransactionRow) {
  if (trade.amount != null && trade.price != null && trade.price !== 1)
    return formatCurrency(trade.amount, trade.currency);
  if (trade.quantity != null)
    return `${formatNumber(trade.quantity)} ${trade.assetType === "option" ? "口" : "股"}`;
  return "金額未提供";
}
