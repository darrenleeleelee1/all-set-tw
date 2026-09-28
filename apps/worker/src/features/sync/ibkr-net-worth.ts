import type { IbkrEquityPoint } from "@taiwan-fin-hub/connectors";
import type {
  InvestmentPosition,
  NetWorthHistoryPoint,
} from "@taiwan-fin-hub/core";

type ValuedPosition = Pick<
  InvestmentPosition,
  "marketValue" | "currency" | "asOfDate"
>;
type RateToTwd = { currency: string; rateTwd: number };

/**
 * Builds TWD net worth history for IBKR investments. The chart treats
 * connector history as TWD, so a point is skipped rather than understated when
 * its currency lacks an exchange rate. Past NAV values use today's rate; the
 * statement date is valued from positions so it matches the holdings page.
 */
export function ibkrNetWorthHistory(
  positions: ValuedPosition[],
  equityHistory: Pick<
    IbkrEquityPoint,
    "date" | "currency" | "investmentValue"
  >[],
  rates: RateToTwd[],
  statementDate?: string,
): NetWorthHistoryPoint[] {
  const date = positions[0]?.asOfDate ?? statementDate;
  const rateByCurrency = new Map(
    rates.map(({ currency, rateTwd }) => [currency, rateTwd]),
  );
  const toTwd = (value: number, currency: string) => {
    const rate = currency === "TWD" ? 1 : rateByCurrency.get(currency);
    return rate === undefined ? undefined : value * rate;
  };

  const historyByDate = equityHistory
    .filter((point) => !date || point.date < date)
    .reduce((totals, point) => {
      const value = toTwd(point.investmentValue, point.currency);
      const previous = totals.get(point.date);
      totals.set(
        point.date,
        value === undefined || previous === null
          ? null
          : (previous ?? 0) + value,
      );
      return totals;
    }, new Map<string, number | null>());

  const positionValues = positions.map(({ marketValue, currency }) =>
    toTwd(marketValue ?? 0, currency),
  );
  const statementValue =
    date && positionValues.every((value) => value !== undefined)
      ? positionValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : undefined;

  return [
    ...historyByDate.entries(),
    ...(statementValue === undefined || !date
      ? []
      : ([[date, statementValue]] as const)),
  ]
    .flatMap(([pointDate, value]) =>
      value === null
        ? []
        : [
            {
              date: pointDate,
              netWorth: Math.round(value),
              assetType: "stock" as const,
            },
          ],
    )
    .sort((left, right) => left.date.localeCompare(right.date));
}
