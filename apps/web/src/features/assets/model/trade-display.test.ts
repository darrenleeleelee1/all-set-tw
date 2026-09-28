import { describe, expect, it } from "vitest";
import type { InvestmentTransactionRow } from "@/data/investments/types";
import { tradeDisplay } from "./trade-display";

function trade(
  overrides: Partial<InvestmentTransactionRow>,
): InvestmentTransactionRow {
  return {
    id: "trade",
    connectorId: "ibkr",
    accountId: "ibkr:U1",
    sourceId: "trade:1",
    currency: "USD",
    ...overrides,
  };
}

describe("tradeDisplay", () => {
  it("shows the cash amount when a real price is known", () => {
    expect(tradeDisplay(trade({ amount: -451, price: 225 }))).toBe("−US$451");
  });

  it("counts stock quantities in shares when the amount is unknown", () => {
    expect(tradeDisplay(trade({ assetType: "stock", quantity: 93 }))).toBe(
      "93 股",
    );
  });

  it("counts option quantities in contracts", () => {
    expect(
      tradeDisplay(trade({ assetType: "option", quantity: 2, price: 1 })),
    ).toBe("2 口");
  });

  it("falls back when neither amount nor quantity is available", () => {
    expect(tradeDisplay(trade({}))).toBe("金額未提供");
  });
});
