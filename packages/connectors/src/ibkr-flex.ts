import type {
  AssetType,
  BankAccount,
  BankBalanceSnapshot,
  Connector,
  InvestmentPosition,
  InvestmentTransaction,
  SyncResult,
} from "@taiwan-fin-hub/core";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const FLEX_SEND_REQUEST_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
const FLEX_GET_STATEMENT_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";
const FLEX_API_VERSION = "3";
const FLEX_USER_AGENT = "taiwan-fin-hub/0.1 (IBKR Flex Web Service)";
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_DELAYS_MS = [
  3_000, 2_000, 3_000, 5_000, 8_000, 10_000, 15_000, 20_000,
];
const INSTITUTION_NAME = "Interactive Brokers";

const RETRYABLE_FLEX_CODES = new Set([
  1001, 1004, 1005, 1006, 1007, 1008, 1009, 1018, 1019, 1021,
]);
const USER_ACTION_FLEX_CODES = new Set([
  1010, 1011, 1012, 1013, 1014, 1015, 1016, 1020,
]);

const TRADE_NAMES: Record<string, string> = {
  BUY: "買進",
  SELL: "賣出",
};
const OPEN_CLOSE_SUFFIXES: Record<string, string> = {
  O: "開倉",
  C: "平倉",
};
const OPTION_EVENT_NAMES: Record<string, string> = {
  Ep: "到期",
  Ex: "履約",
  A: "被指派",
};
const SUPPORTED_ASSET_CATEGORIES = new Set(["STK", "OPT"]);
const CASH_TRANSACTION_NAMES: Record<string, string> = {
  Dividends: "股息",
  "Withholding Tax": "預扣稅",
  "Payment In Lieu Of Dividends": "替代股息",
};

export const ibkrConfigSchema = z.object({
  flexToken: z.string().trim().min(1).optional(),
  flexQueryId: z.string().trim().regex(/^\d+$/).optional(),
});

export type IbkrConfig = z.infer<typeof ibkrConfigSchema>;

export function parseIbkrConfig(config: unknown): IbkrConfig {
  return ibkrConfigSchema.parse(config);
}

export class IbkrVerificationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IbkrVerificationRequiredError";
  }
}

export class IbkrConnectionError extends Error {
  constructor(message = "Interactive Brokers 資料同步暫時無法完成。") {
    super(message);
    this.name = "IbkrConnectionError";
  }
}

export class IbkrFlexFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IbkrFlexFormatError";
  }
}

export type IbkrFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type IbkrConnectorOptions = {
  sleep?: (ms: number) => Promise<void>;
};

export type IbkrStatementData = {
  investmentPositions: Array<Omit<InvestmentPosition, "id" | "connectorId">>;
  investmentTransactions: Array<
    Omit<InvestmentTransaction, "id" | "connectorId">
  >;
  bankAccounts: Array<Omit<BankAccount, "id" | "connectorId">>;
  bankBalanceSnapshots: Array<Omit<BankBalanceSnapshot, "id" | "connectorId">>;
  equityHistory: IbkrEquityPoint[];
  lastReportDate?: string;
};

/** Daily account value from the NAV in Base section, in the account base currency. */
export type IbkrEquityPoint = {
  accountId: string;
  date: string;
  currency: string;
  investmentValue: number;
  cash?: number;
};

export type IbkrSyncResult = SyncResult<
  Omit<InvestmentPosition, "id" | "connectorId">
> & { equityHistory: IbkrEquityPoint[] };

export type IbkrConnector = Omit<
  Connector<IbkrConfig, Omit<InvestmentPosition, "id" | "connectorId">>,
  "sync"
> & {
  sync(config: IbkrConfig, cursor?: string): Promise<IbkrSyncResult>;
};

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) =>
    [
      "FlexStatement",
      "OpenPosition",
      "Trade",
      "CashTransaction",
      "CashReportCurrency",
      "EquitySummaryByReportDateInBase",
    ].includes(name),
});

/**
 * Parses an Activity Flex Query XML statement into normalized stock, ETF and
 * option positions, trades, dividend cash flows, per-currency cash balances
 * and daily NAV history.
 */
export function parseIbkrStatement(xml: string): IbkrStatementData {
  const root = asNode(parseXml(xml).FlexQueryResponse);
  if (!root) {
    throw new IbkrFlexFormatError("IBKR Flex 回應不是 Activity Flex 報表。");
  }
  const statements = asNodes(asNode(root.FlexStatements)?.FlexStatement);
  if (statements.length === 0) {
    throw new IbkrFlexFormatError("IBKR Flex 報表沒有任何帳戶資料。");
  }

  return statements.map(parseFlexStatement).reduce<IbkrStatementData>(
    (merged, statement) => ({
      investmentPositions: [
        ...merged.investmentPositions,
        ...statement.investmentPositions,
      ],
      investmentTransactions: [
        ...merged.investmentTransactions,
        ...statement.investmentTransactions,
      ],
      bankAccounts: [...merged.bankAccounts, ...statement.bankAccounts],
      bankBalanceSnapshots: [
        ...merged.bankBalanceSnapshots,
        ...statement.bankBalanceSnapshots,
      ],
      equityHistory: [...merged.equityHistory, ...statement.equityHistory],
      lastReportDate: laterDate(
        merged.lastReportDate,
        statement.lastReportDate,
      ),
    }),
    {
      investmentPositions: [],
      investmentTransactions: [],
      bankAccounts: [],
      bankBalanceSnapshots: [],
      equityHistory: [],
    },
  );
}

export function createIbkrConnector(
  fetcher: IbkrFetch = globalThis.fetch.bind(globalThis),
  options: IbkrConnectorOptions = {},
): IbkrConnector {
  const sleep = options.sleep ?? defaultSleep;
  return {
    id: "ibkr",
    name: INSTITUTION_NAME,
    async sync(config) {
      const { flexToken, flexQueryId } = requireIbkrCredentials(config);
      const client = new FlexClient(fetcher, sleep, flexToken);
      const data = parseIbkrStatement(await client.fetchStatement(flexQueryId));
      return {
        records: data.investmentPositions,
        investmentTransactions: data.investmentTransactions,
        bankAccounts: data.bankAccounts,
        bankBalanceSnapshots: data.bankBalanceSnapshots,
        equityHistory: data.equityHistory,
        cursor: data.lastReportDate
          ? JSON.stringify({ lastReportDate: data.lastReportDate })
          : undefined,
      };
    },
  };
}

export function requireIbkrCredentials(
  config: IbkrConfig,
): Required<IbkrConfig> {
  if (!config.flexToken || !config.flexQueryId) {
    throw new IbkrVerificationRequiredError(
      "請先設定 Interactive Brokers Flex Token 與 Query ID。",
    );
  }
  return { flexToken: config.flexToken, flexQueryId: config.flexQueryId };
}

class FlexClient {
  constructor(
    private readonly fetcher: IbkrFetch,
    private readonly sleep: (ms: number) => Promise<void>,
    private readonly token: string,
  ) {}

  async fetchStatement(queryId: string) {
    const sendResponse = parseFlexServiceResponse(
      await this.get(FLEX_SEND_REQUEST_URL, queryId),
    );
    if (!sendResponse || sendResponse.status !== "Success") {
      throw flexError(sendResponse?.errorCode, sendResponse?.errorMessage);
    }
    if (!sendResponse.referenceCode) {
      throw new IbkrConnectionError("IBKR Flex 未回傳報表參考碼。");
    }
    const statementUrl = trustedStatementUrl(sendResponse.url);

    for (const delay of POLL_DELAYS_MS) {
      await this.sleep(delay);
      const body = await this.get(statementUrl, sendResponse.referenceCode);
      const pending = parseFlexServiceResponse(body);
      if (!pending) return body;
      if (!isRetryableFlexCode(pending.errorCode)) {
        throw flexError(pending.errorCode, pending.errorMessage);
      }
    }
    throw new IbkrConnectionError("IBKR Flex 報表產生逾時，將於下次同步重試。");
  }

  private async get(baseUrl: string, query: string) {
    const url = new URL(baseUrl);
    url.searchParams.set("t", this.token);
    url.searchParams.set("q", query);
    url.searchParams.set("v", FLEX_API_VERSION);

    const response = await this.fetcher(url, {
      headers: { "User-Agent": FLEX_USER_AGENT, Accept: "application/xml" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {
      throw new IbkrConnectionError(`IBKR Flex 連線失敗（${url.pathname}）。`);
    });
    if (!response.ok) {
      throw new IbkrConnectionError(
        `IBKR Flex 回應 HTTP ${response.status}（${url.pathname}）。`,
      );
    }
    return response.text();
  }
}

type FlexServiceResponse = {
  status?: string;
  referenceCode?: string;
  url?: string;
  errorCode?: number;
  errorMessage?: string;
};

function parseFlexServiceResponse(
  xml: string,
): FlexServiceResponse | undefined {
  const node = asNode(parseXml(xml).FlexStatementResponse);
  if (!node) return undefined;
  const errorCode = Number(text(node.ErrorCode));
  return {
    status: text(node.Status),
    referenceCode: text(node.ReferenceCode),
    url: text(node.Url),
    errorCode: Number.isInteger(errorCode) ? errorCode : undefined,
    errorMessage: text(node.ErrorMessage),
  };
}

function isRetryableFlexCode(code: number | undefined) {
  return code !== undefined && RETRYABLE_FLEX_CODES.has(code);
}

function flexError(code: number | undefined, message: string | undefined) {
  const detail = `IBKR Flex 錯誤 ${code ?? "未知"}：${message ?? "無錯誤訊息"}`;
  return code !== undefined && USER_ACTION_FLEX_CODES.has(code)
    ? new IbkrVerificationRequiredError(
        `${detail}。請確認 Flex Token 未過期、未設定 IP 限制，且 Query ID 為 Activity Flex Query。`,
      )
    : new IbkrConnectionError(detail);
}

function trustedStatementUrl(url: string | undefined) {
  if (!url) return FLEX_GET_STATEMENT_URL;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".interactivebrokers.com")
      ? `${parsed.origin}${parsed.pathname}`
      : FLEX_GET_STATEMENT_URL;
  } catch {
    return FLEX_GET_STATEMENT_URL;
  }
}

function parseFlexStatement(statement: XmlNode): IbkrStatementData {
  const accountId = attr(statement, "accountId");
  if (!accountId) {
    throw new IbkrFlexFormatError("IBKR Flex 報表缺少帳號。");
  }
  const statementDate = optionalFlexDate(attr(statement, "toDate"));
  const accountSourceId = `ibkr:${accountId}`;

  const investmentPositions = asNodes(
    asNode(statement.OpenPositions)?.OpenPosition,
  )
    .filter((row) => attr(row, "levelOfDetail") !== "LOT")
    .filter(isSupportedAsset)
    .map((row) => ({
      sourceId: `${accountSourceId}:${attr(row, "conid")}`,
      assetType: assetTypeOf(row),
      symbol: attr(row, "symbol"),
      name: attr(row, "description") ?? attr(row, "symbol") ?? "",
      quantity: number(attr(row, "position")),
      marketValue: number(attr(row, "positionValue")),
      currency: attr(row, "currency") ?? "USD",
      asOfDate: requireFlexDate(attr(row, "reportDate") ?? statementDate),
      raw: pick(row, [
        "conid",
        "listingExchange",
        "markPrice",
        "costBasisMoney",
        "fifoPnlUnrealized",
        "underlyingSymbol",
        "strike",
        "expiry",
        "putCall",
        "multiplier",
      ]),
    }));

  const trades = asNodes(asNode(statement.Trades)?.Trade)
    .filter(
      (row) => (attr(row, "levelOfDetail") ?? "EXECUTION") === "EXECUTION",
    )
    .filter(isSupportedAsset)
    .map((row) => {
      const quantity = number(attr(row, "quantity"));
      const side = attr(row, "buySell")?.toUpperCase();
      return {
        ...transactionBase(accountSourceId, row),
        sourceId: `trade:${attr(row, "tradeID")}`,
        tradeDate: requireFlexDate(attr(row, "tradeDate")),
        postedDate: optionalFlexDate(attr(row, "settleDateTarget")),
        transactionCode: side,
        transactionName: tradeName(row, side),
        quantity: quantity === undefined ? undefined : Math.abs(quantity),
        price: number(attr(row, "tradePrice")),
        amount: number(attr(row, "netCash")),
        raw: pick(row, [
          "conid",
          "tradeID",
          "ibCommission",
          "tradeMoney",
          "openCloseIndicator",
          "notes",
        ]),
      };
    });

  const cashTransactions = asNodes(
    asNode(statement.CashTransactions)?.CashTransaction,
  )
    .filter((row) => attr(row, "levelOfDetail") !== "SUMMARY")
    .filter(isSupportedAsset)
    .map((row) => {
      const type = attr(row, "type");
      return {
        ...transactionBase(accountSourceId, row),
        sourceId: `cash:${attr(row, "transactionID")}`,
        tradeDate: requireFlexDate(attr(row, "dateTime")),
        postedDate: optionalFlexDate(attr(row, "settleDate")),
        transactionCode: type,
        transactionName: type
          ? (CASH_TRANSACTION_NAMES[type] ?? type)
          : undefined,
        quantity: undefined,
        price: undefined,
        amount: number(attr(row, "amount")),
        raw: pick(row, ["conid", "transactionID", "description"]),
      };
    });

  const cashReportRows = asNodes(
    asNode(statement.CashReport)?.CashReportCurrency,
  );
  const currencyRows = cashReportRows.filter(
    (row) => attr(row, "levelOfDetail") !== "BaseCurrency",
  );
  const baseCurrency = baseCurrencyOf(statement);
  const cashRows = (
    currencyRows.length > 0
      ? currencyRows.map((row) => ({ row, currency: attr(row, "currency") }))
      : cashReportRows
          .filter((row) => attr(row, "levelOfDetail") === "BaseCurrency")
          .map((row) => ({ row, currency: baseCurrency }))
  ).flatMap(({ row, currency }) => {
    const balance = number(attr(row, "endingCash"));
    const asOfAt = optionalFlexDate(attr(row, "toDate")) ?? statementDate;
    return currency &&
      /^[A-Z]{3}$/.test(currency) &&
      balance !== undefined &&
      asOfAt
      ? [
          {
            currency,
            balance,
            asOfAt,
            sourceId: `${accountSourceId}:cash:${currency}`,
          },
        ]
      : [];
  });

  const equityHistory: IbkrEquityPoint[] = asNodes(
    asNode(statement.EquitySummaryInBase)?.EquitySummaryByReportDateInBase,
  ).flatMap((row) => {
    const date = optionalFlexDate(attr(row, "reportDate"));
    const currency = attr(row, "currency");
    const stock = number(attr(row, "stock"));
    const options = number(attr(row, "options"));
    if (!date || !currency || (stock === undefined && options === undefined))
      return [];
    return [
      {
        accountId: accountSourceId,
        date,
        currency,
        investmentValue: (stock ?? 0) + (options ?? 0),
        cash: number(attr(row, "cash")),
      },
    ];
  });
  const [singleCashRow] = cashRows.length === 1 ? cashRows : [];
  const cashHistory = singleCashRow
    ? equityHistory.flatMap((point) =>
        point.currency === singleCashRow.currency &&
        point.cash !== undefined &&
        point.date < singleCashRow.asOfAt
          ? [
              {
                accountId: singleCashRow.sourceId,
                sourceId: `${singleCashRow.sourceId}:${point.date}`,
                balance: point.cash,
                currency: point.currency,
                asOfAt: point.date,
              },
            ]
          : [],
      )
    : [];

  return {
    investmentPositions,
    investmentTransactions: [...trades, ...cashTransactions],
    bankAccounts: cashRows.map((row) => ({
      sourceId: row.sourceId,
      institutionName: INSTITUTION_NAME,
      accountName: `IBKR ${accountId} ${row.currency} 現金`,
      accountType: "settlement_cash" as const,
      currency: row.currency,
    })),
    bankBalanceSnapshots: [
      ...cashRows.map((row) => ({
        accountId: row.sourceId,
        sourceId: `${row.sourceId}:${row.asOfAt}`,
        balance: row.balance,
        currency: row.currency,
        asOfAt: row.asOfAt,
      })),
      ...cashHistory,
    ],
    equityHistory,
    lastReportDate: statementDate,
  };
}

function baseCurrencyOf(statement: XmlNode) {
  const declared = attr(asNode(statement.AccountInformation) ?? {}, "currency");
  if (declared) return declared;
  const inferred = new Set(
    [
      ...asNodes(asNode(statement.OpenPositions)?.OpenPosition),
      ...asNodes(asNode(statement.Trades)?.Trade),
      ...asNodes(asNode(statement.CashTransactions)?.CashTransaction),
    ]
      .filter((row) => number(attr(row, "fxRateToBase")) === 1)
      .flatMap((row) => attr(row, "currency") ?? []),
  );
  return inferred.size === 1 ? [...inferred][0] : undefined;
}

function transactionBase(accountSourceId: string, row: XmlNode) {
  return {
    accountId: accountSourceId,
    brokerName: INSTITUTION_NAME,
    symbol: attr(row, "symbol"),
    name: attr(row, "description"),
    assetType: assetTypeOf(row),
    currency: attr(row, "currency") ?? "USD",
  };
}

function isSupportedAsset(row: XmlNode) {
  return SUPPORTED_ASSET_CATEGORIES.has(attr(row, "assetCategory") ?? "");
}

function assetTypeOf(row: XmlNode): AssetType {
  if (attr(row, "assetCategory") === "OPT") return "option";
  return attr(row, "subCategory") === "ETF" ? "etf" : "stock";
}

function tradeName(row: XmlNode, side: string | undefined) {
  if (!side) return undefined;
  const sideName = TRADE_NAMES[side] ?? side;
  if (attr(row, "assetCategory") !== "OPT") return sideName;

  const event = attr(row, "notes")
    ?.split(";")
    .map((code) => OPTION_EVENT_NAMES[code.trim()])
    .find(Boolean);
  if (event) return event;
  return `${sideName}${OPEN_CLOSE_SUFFIXES[attr(row, "openCloseIndicator") ?? ""] ?? ""}`;
}

function parseXml(xml: string): XmlNode {
  try {
    return xmlParser.parse(xml) as XmlNode;
  } catch {
    throw new IbkrFlexFormatError("IBKR Flex 回應不是有效的 XML。");
  }
}

function requireFlexDate(value: string | undefined) {
  const date = optionalFlexDate(value);
  if (!date) {
    throw new IbkrFlexFormatError("IBKR Flex 報表缺少日期欄位。");
  }
  return date;
}

function optionalFlexDate(value: string | undefined) {
  const datePart = value?.split(/[;,\s]/)[0]?.trim();
  if (!datePart) return undefined;
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(datePart);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  throw new IbkrFlexFormatError(
    "IBKR Flex 日期格式無法辨識，請將 Flex Query 的 Date Format 設為 yyyyMMdd。",
  );
}

function laterDate(left: string | undefined, right: string | undefined) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function asNode(value: unknown): XmlNode | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlNode)
    : undefined;
}

function asNodes(value: unknown): XmlNode[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const node = asNode(item);
        return node ? [node] : [];
      })
    : [];
}

function attr(node: XmlNode, name: string) {
  return text(node[name]);
}

function text(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function number(value: string | undefined) {
  if (value === undefined) return undefined;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pick(node: XmlNode, keys: string[]) {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = attr(node, key);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
