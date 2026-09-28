import { describe, expect, it } from "vitest";
import { ibkrNetWorthHistory } from "../../../src/features/sync/ibkr-net-worth";

const usdRate = [{ currency: "USD", rateTwd: 31.77 }];
const equity = (date: string, investmentValue: number, currency = "USD") => ({
  accountId: "ibkr:U1",
  date,
  currency,
  investmentValue,
});

describe("ibkrNetWorthHistory", () => {
  it("converts every position to TWD on the statement date", () => {
    expect(
      ibkrNetWorthHistory(
        [
          { marketValue: 1000, currency: "USD", asOfDate: "2026-09-25" },
          { marketValue: 500.5, currency: "USD", asOfDate: "2026-09-25" },
          { marketValue: -120, currency: "USD", asOfDate: "2026-09-25" },
        ],
        [],
        usdRate,
      ),
    ).toEqual([{ date: "2026-09-25", netWorth: 43858, assetType: "stock" }]);
  });

  it("keeps TWD positions without a rate", () => {
    expect(
      ibkrNetWorthHistory(
        [{ marketValue: 1000, currency: "TWD", asOfDate: "2026-09-25" }],
        [],
        [],
      ),
    ).toEqual([{ date: "2026-09-25", netWorth: 1000, assetType: "stock" }]);
  });

  it("skips the statement point when any currency has no exchange rate", () => {
    expect(
      ibkrNetWorthHistory(
        [
          { marketValue: 1000, currency: "USD", asOfDate: "2026-09-25" },
          { marketValue: 1000, currency: "HKD", asOfDate: "2026-09-25" },
        ],
        [],
        usdRate,
      ),
    ).toEqual([]);
  });

  it("records zero when the statement has no positions", () => {
    expect(ibkrNetWorthHistory([], [], usdRate, "2026-09-25")).toEqual([
      { date: "2026-09-25", netWorth: 0, assetType: "stock" },
    ]);
  });

  it("adds converted NAV history before the statement date", () => {
    expect(
      ibkrNetWorthHistory(
        [{ marketValue: 1000, currency: "USD", asOfDate: "2026-09-25" }],
        [
          equity("2026-09-24", 900),
          equity("2026-09-23", 800.4),
          equity("2026-09-25", 12345),
        ],
        usdRate,
      ),
    ).toEqual([
      { date: "2026-09-23", netWorth: 25429, assetType: "stock" },
      { date: "2026-09-24", netWorth: 28593, assetType: "stock" },
      { date: "2026-09-25", netWorth: 31770, assetType: "stock" },
    ]);
  });

  it("skips NAV history in a currency without an exchange rate", () => {
    expect(
      ibkrNetWorthHistory(
        [],
        [equity("2026-09-24", 900, "HKD")],
        usdRate,
        "2026-09-25",
      ),
    ).toEqual([{ date: "2026-09-25", netWorth: 0, assetType: "stock" }]);
  });
});
