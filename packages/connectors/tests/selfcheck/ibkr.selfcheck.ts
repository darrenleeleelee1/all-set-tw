import assert from "node:assert/strict";
import {
  createIbkrConnector,
  IbkrConnectionError,
  IbkrFlexFormatError,
  IbkrVerificationRequiredError,
  parseIbkrConfig,
  parseIbkrStatement,
} from "../../src/ibkr-flex";

const TOKEN = "123456789012345678901234";
const QUERY_ID = "987654";

assert.deepEqual(
  parseIbkrConfig({ flexToken: ` ${TOKEN} `, flexQueryId: QUERY_ID }),
  { flexToken: TOKEN, flexQueryId: QUERY_ID },
);
assert.deepEqual(parseIbkrConfig({}), {});
assert.throws(() => parseIbkrConfig({ flexQueryId: "abc" }));

const statementXml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="all-set" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="U1234567" fromDate="20260826" toDate="20260924" period="Last30CalendarDays" whenGenerated="20260925;031500">
<OpenPositions>
<OpenPosition accountId="U1234567" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="AAPL" description="APPLE INC" conid="265598" reportDate="20260924" position="10" markPrice="230.5" positionValue="2305" costBasisMoney="1800" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U1234567" currency="USD" assetCategory="STK" subCategory="ETF" symbol="VOO" description="VANGUARD S&amp;P 500 ETF" conid="136155102" reportDate="20260924" position="3.5" markPrice="550" positionValue="1925" costBasisMoney="1600" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U1234567" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="AAPL" description="APPLE INC" conid="265598" reportDate="20260924" position="4" markPrice="230.5" positionValue="922" levelOfDetail="LOT" />
<OpenPosition accountId="U1234567" currency="USD" assetCategory="OPT" subCategory="C" symbol="AAPL  261218C00250000" description="AAPL 18DEC26 250 C" conid="700000001" underlyingSymbol="AAPL" strike="250" expiry="20261218" putCall="C" multiplier="100" reportDate="20260924" position="-1" markPrice="5" positionValue="-500" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U1234567" currency="USD" assetCategory="FOP" subCategory="C" symbol="ESZ6 C6000" description="ES 18DEC26 6000 C" conid="700000002" reportDate="20260924" position="1" markPrice="50" positionValue="2500" levelOfDetail="SUMMARY" />
</OpenPositions>
<Trades>
<Trade accountId="U1234567" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="AAPL" description="APPLE INC" conid="265598" tradeID="4455667788" tradeDate="20260920" settleDateTarget="20260922" quantity="2" tradePrice="225" netCash="-451" buySell="BUY" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" assetCategory="STK" subCategory="ETF" symbol="VOO" description="VANGUARD S&amp;P 500 ETF" conid="136155102" tradeID="4455667799" tradeDate="20260921" settleDateTarget="20260923" quantity="-1" tradePrice="548" netCash="547" buySell="SELL" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" assetCategory="OPT" subCategory="C" symbol="AAPL  261218C00250000" description="AAPL 18DEC26 250 C" conid="700000001" tradeID="4455660000" tradeDate="20260921" settleDateTarget="20260922" quantity="1" tradePrice="5" netCash="-501" buySell="BUY" openCloseIndicator="O" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" assetCategory="OPT" subCategory="P" symbol="AAPL  260918P00200000" description="AAPL 18SEP26 200 P" conid="700000003" tradeID="4455661111" tradeDate="20260918" settleDateTarget="20260918" quantity="1" tradePrice="0" netCash="0" buySell="BUY" openCloseIndicator="C" notes="Ep" transactionType="BookTrade" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" assetCategory="FOP" subCategory="C" symbol="ESZ6 C6000" description="ES 18DEC26 6000 C" conid="700000002" tradeID="4455662222" tradeDate="20260921" settleDateTarget="20260922" quantity="1" tradePrice="50" netCash="-2502" buySell="BUY" openCloseIndicator="O" levelOfDetail="EXECUTION" />
<Order accountId="U1234567" currency="USD" assetCategory="STK" symbol="AAPL" tradeDate="20260920" quantity="2" netCash="-451" buySell="BUY" levelOfDetail="ORDER" />
</Trades>
<CashTransactions>
<CashTransaction accountId="U1234567" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="AAPL" description="AAPL(US0378331005) CASH DIVIDEND USD 0.26 PER SHARE" conid="265598" transactionID="9900112233" dateTime="20260915;202000" settleDate="20260915" amount="2.6" type="Dividends" levelOfDetail="DETAIL" />
<CashTransaction accountId="U1234567" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="AAPL" description="AAPL(US0378331005) CASH DIVIDEND - US TAX" conid="265598" transactionID="9900112244" dateTime="20260915;202000" settleDate="20260915" amount="-0.78" type="Withholding Tax" levelOfDetail="DETAIL" />
<CashTransaction accountId="U1234567" currency="USD" assetCategory="CASH" symbol="" description="CASH RECEIPTS / ELECTRONIC FUND TRANSFERS" conid="" transactionID="9900112255" dateTime="20260901" settleDate="20260901" amount="1000" type="Deposits/Withdrawals" levelOfDetail="DETAIL" />
</CashTransactions>
<EquitySummaryInBase>
<EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260922" cash="1100" stock="4000.5" options="-100" funds="999" total="5999.5" />
<EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260923" cash="1150" stock="4100" options="0" funds="0" total="5250" />
<EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260924" cash="1200.5" stock="4230" options="500" funds="0" total="5930.5" />
</EquitySummaryInBase>
<CashReport>
<CashReportCurrency accountId="U1234567" currency="BASE_SUMMARY" levelOfDetail="BaseCurrency" endingCash="1234.56" toDate="20260924" />
<CashReportCurrency accountId="U1234567" currency="USD" levelOfDetail="Currency" endingCash="1200.5" toDate="20260924" />
<CashReportCurrency accountId="U1234567" currency="TWD" levelOfDetail="Currency" endingCash="1000" toDate="20260924" />
</CashReport>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`;

const parsed = parseIbkrStatement(statementXml);

assert.deepEqual(
  parsed.investmentPositions.map((position) => ({
    sourceId: position.sourceId,
    assetType: position.assetType,
    symbol: position.symbol,
    name: position.name,
    quantity: position.quantity,
    marketValue: position.marketValue,
    currency: position.currency,
    asOfDate: position.asOfDate,
  })),
  [
    {
      sourceId: "ibkr:U1234567:265598",
      assetType: "stock",
      symbol: "AAPL",
      name: "APPLE INC",
      quantity: 10,
      marketValue: 2305,
      currency: "USD",
      asOfDate: "2026-09-24",
    },
    {
      sourceId: "ibkr:U1234567:136155102",
      assetType: "etf",
      symbol: "VOO",
      name: "VANGUARD S&P 500 ETF",
      quantity: 3.5,
      marketValue: 1925,
      currency: "USD",
      asOfDate: "2026-09-24",
    },
    {
      sourceId: "ibkr:U1234567:700000001",
      assetType: "option",
      symbol: "AAPL  261218C00250000",
      name: "AAPL 18DEC26 250 C",
      quantity: -1,
      marketValue: -500,
      currency: "USD",
      asOfDate: "2026-09-24",
    },
  ],
);
assert.deepEqual(parsed.investmentPositions[2]?.raw, {
  conid: "700000001",
  markPrice: "5",
  underlyingSymbol: "AAPL",
  strike: "250",
  expiry: "20261218",
  putCall: "C",
  multiplier: "100",
});

assert.deepEqual(
  parsed.investmentTransactions.map((transaction) => ({
    accountId: transaction.accountId,
    sourceId: transaction.sourceId,
    brokerName: transaction.brokerName,
    symbol: transaction.symbol,
    assetType: transaction.assetType,
    tradeDate: transaction.tradeDate,
    postedDate: transaction.postedDate,
    transactionCode: transaction.transactionCode,
    transactionName: transaction.transactionName,
    quantity: transaction.quantity,
    price: transaction.price,
    amount: transaction.amount,
    currency: transaction.currency,
  })),
  [
    {
      accountId: "ibkr:U1234567",
      sourceId: "trade:4455667788",
      brokerName: "Interactive Brokers",
      symbol: "AAPL",
      assetType: "stock",
      tradeDate: "2026-09-20",
      postedDate: "2026-09-22",
      transactionCode: "BUY",
      transactionName: "買進",
      quantity: 2,
      price: 225,
      amount: -451,
      currency: "USD",
    },
    {
      accountId: "ibkr:U1234567",
      sourceId: "trade:4455667799",
      brokerName: "Interactive Brokers",
      symbol: "VOO",
      assetType: "etf",
      tradeDate: "2026-09-21",
      postedDate: "2026-09-23",
      transactionCode: "SELL",
      transactionName: "賣出",
      quantity: 1,
      price: 548,
      amount: 547,
      currency: "USD",
    },
    {
      accountId: "ibkr:U1234567",
      sourceId: "trade:4455660000",
      brokerName: "Interactive Brokers",
      symbol: "AAPL  261218C00250000",
      assetType: "option",
      tradeDate: "2026-09-21",
      postedDate: "2026-09-22",
      transactionCode: "BUY",
      transactionName: "買進開倉",
      quantity: 1,
      price: 5,
      amount: -501,
      currency: "USD",
    },
    {
      accountId: "ibkr:U1234567",
      sourceId: "trade:4455661111",
      brokerName: "Interactive Brokers",
      symbol: "AAPL  260918P00200000",
      assetType: "option",
      tradeDate: "2026-09-18",
      postedDate: "2026-09-18",
      transactionCode: "BUY",
      transactionName: "到期",
      quantity: 1,
      price: 0,
      amount: 0,
      currency: "USD",
    },
    {
      accountId: "ibkr:U1234567",
      sourceId: "cash:9900112233",
      brokerName: "Interactive Brokers",
      symbol: "AAPL",
      assetType: "stock",
      tradeDate: "2026-09-15",
      postedDate: "2026-09-15",
      transactionCode: "Dividends",
      transactionName: "股息",
      quantity: undefined,
      price: undefined,
      amount: 2.6,
      currency: "USD",
    },
    {
      accountId: "ibkr:U1234567",
      sourceId: "cash:9900112244",
      brokerName: "Interactive Brokers",
      symbol: "AAPL",
      assetType: "stock",
      tradeDate: "2026-09-15",
      postedDate: "2026-09-15",
      transactionCode: "Withholding Tax",
      transactionName: "預扣稅",
      quantity: undefined,
      price: undefined,
      amount: -0.78,
      currency: "USD",
    },
  ],
);

assert.equal(
  parsed.bankBalanceSnapshots.length,
  2,
  "multi-currency cash accounts must not receive base-currency history",
);
assert.deepEqual(parsed.equityHistory, [
  {
    accountId: "ibkr:U1234567",
    date: "2026-09-22",
    currency: "USD",
    investmentValue: 3900.5,
    cash: 1100,
  },
  {
    accountId: "ibkr:U1234567",
    date: "2026-09-23",
    currency: "USD",
    investmentValue: 4100,
    cash: 1150,
  },
  {
    accountId: "ibkr:U1234567",
    date: "2026-09-24",
    currency: "USD",
    investmentValue: 4730,
    cash: 1200.5,
  },
]);
assert.deepEqual(emptyEquityHistory(), []);

assert.deepEqual(
  parsed.bankAccounts.map((account) => ({
    sourceId: account.sourceId,
    institutionName: account.institutionName,
    accountType: account.accountType,
    currency: account.currency,
  })),
  [
    {
      sourceId: "ibkr:U1234567:cash:USD",
      institutionName: "Interactive Brokers",
      accountType: "settlement_cash",
      currency: "USD",
    },
    {
      sourceId: "ibkr:U1234567:cash:TWD",
      institutionName: "Interactive Brokers",
      accountType: "settlement_cash",
      currency: "TWD",
    },
  ],
);
assert.deepEqual(
  parsed.bankBalanceSnapshots.map((snapshot) => ({
    accountId: snapshot.accountId,
    sourceId: snapshot.sourceId,
    balance: snapshot.balance,
    currency: snapshot.currency,
    asOfAt: snapshot.asOfAt,
  })),
  [
    {
      accountId: "ibkr:U1234567:cash:USD",
      sourceId: "ibkr:U1234567:cash:USD:2026-09-24",
      balance: 1200.5,
      currency: "USD",
      asOfAt: "2026-09-24",
    },
    {
      accountId: "ibkr:U1234567:cash:TWD",
      sourceId: "ibkr:U1234567:cash:TWD:2026-09-24",
      balance: 1000,
      currency: "TWD",
      asOfAt: "2026-09-24",
    },
  ],
);

assert.equal(
  parseIbkrStatement(statementXml.replaceAll("20260924", "2026-09-24"))
    .investmentPositions[0]?.asOfDate,
  "2026-09-24",
);
assert.throws(
  () => parseIbkrStatement(statementXml.replaceAll("20260924", "09/24/2026")),
  IbkrFlexFormatError,
);
assert.throws(
  () => parseIbkrStatement("<html>maintenance</html>"),
  IbkrFlexFormatError,
);
assert.throws(
  () =>
    parseIbkrStatement(
      `<FlexQueryResponse queryName="all-set" type="AF"><FlexStatements count="0" /></FlexQueryResponse>`,
    ),
  IbkrFlexFormatError,
);

const emptyStatement = parseIbkrStatement(
  `<FlexQueryResponse><FlexStatements count="1"><FlexStatement accountId="U1234567" toDate="20260924"><OpenPositions /><Trades /><CashTransactions /><CashReport /></FlexStatement></FlexStatements></FlexQueryResponse>`,
);
assert.deepEqual(emptyStatement.investmentPositions, []);
assert.deepEqual(emptyStatement.investmentTransactions, []);

function baseSummaryStatement(extra: string) {
  return `<FlexQueryResponse><FlexStatements count="1"><FlexStatement accountId="U1234567" toDate="20260925">${extra}<CashReport><CashReportCurrency accountId="U1234567" currency="BASE_SUMMARY" levelOfDetail="BaseCurrency" endingCash="4107.896973001" toDate="20260925" /></CashReport></FlexStatement></FlexStatements></FlexQueryResponse>`;
}

const inferredBase = parseIbkrStatement(
  baseSummaryStatement(
    `<OpenPositions><OpenPosition accountId="U1234567" currency="USD" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="NVDA" description="NVIDIA CORP" conid="4815747" reportDate="20260925" position="30" positionValue="6752.1" levelOfDetail="SUMMARY" /></OpenPositions>`,
  ),
);
assert.deepEqual(
  inferredBase.bankBalanceSnapshots.map((snapshot) => ({
    accountId: snapshot.accountId,
    balance: snapshot.balance,
    currency: snapshot.currency,
    asOfAt: snapshot.asOfAt,
  })),
  [
    {
      accountId: "ibkr:U1234567:cash:USD",
      balance: 4107.896973001,
      currency: "USD",
      asOfAt: "2026-09-25",
    },
  ],
);
assert.equal(inferredBase.bankAccounts[0]?.sourceId, "ibkr:U1234567:cash:USD");

const singleCashWithHistory = parseIbkrStatement(
  baseSummaryStatement(
    `<EquitySummaryInBase><EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260923" cash="3900" stock="6000" options="0" /><EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260924" cash="4000" stock="6100" options="0" /><EquitySummaryByReportDateInBase accountId="U1234567" currency="USD" reportDate="20260925" cash="4107.9" stock="6752.1" options="0" /></EquitySummaryInBase><OpenPositions><OpenPosition accountId="U1234567" currency="USD" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="NVDA" description="NVIDIA CORP" conid="4815747" reportDate="20260925" position="30" positionValue="6752.1" levelOfDetail="SUMMARY" /></OpenPositions>`,
  ),
);
assert.deepEqual(
  singleCashWithHistory.bankBalanceSnapshots.map((snapshot) => ({
    sourceId: snapshot.sourceId,
    balance: snapshot.balance,
    asOfAt: snapshot.asOfAt,
  })),
  [
    {
      sourceId: "ibkr:U1234567:cash:USD:2026-09-25",
      balance: 4107.896973001,
      asOfAt: "2026-09-25",
    },
    {
      sourceId: "ibkr:U1234567:cash:USD:2026-09-23",
      balance: 3900,
      asOfAt: "2026-09-23",
    },
    {
      sourceId: "ibkr:U1234567:cash:USD:2026-09-24",
      balance: 4000,
      asOfAt: "2026-09-24",
    },
  ],
);

const declaredBase = parseIbkrStatement(
  baseSummaryStatement(
    `<AccountInformation accountId="U1234567" currency="TWD" /><OpenPositions><OpenPosition accountId="U1234567" currency="USD" fxRateToBase="31.2" assetCategory="STK" subCategory="COMMON" symbol="NVDA" description="NVIDIA CORP" conid="4815747" reportDate="20260925" position="30" positionValue="6752.1" levelOfDetail="SUMMARY" /></OpenPositions>`,
  ),
);
assert.deepEqual(
  declaredBase.bankBalanceSnapshots.map((snapshot) => snapshot.currency),
  ["TWD"],
);

const unknownBase = parseIbkrStatement(baseSummaryStatement(""));
assert.deepEqual(unknownBase.bankAccounts, []);
assert.deepEqual(unknownBase.bankBalanceSnapshots, []);

function emptyEquityHistory() {
  return parseIbkrStatement(
    `<FlexQueryResponse><FlexStatements count="1"><FlexStatement accountId="U1234567" toDate="20260924"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>`,
  ).equityHistory;
}

function flexResponse(body: string) {
  return new Response(
    `<FlexStatementResponse timestamp="25 September, 2026 03:15 AM EDT">${body}</FlexStatementResponse>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

function flexError(code: number, message: string) {
  return flexResponse(
    `<Status>Fail</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>${message}</ErrorMessage>`,
  );
}

function scriptedFetch(responses: Array<() => Response>) {
  const requests: Array<{ url: URL; userAgent: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({
      url,
      userAgent: new Headers(init?.headers).get("User-Agent"),
    });
    const next = responses.shift();
    assert.ok(next, `unexpected request to ${url.pathname}`);
    return next();
  };
  return { fetcher, requests };
}

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};

const happy = scriptedFetch([
  () =>
    flexResponse(
      `<Status>Success</Status><ReferenceCode>1122334455</ReferenceCode><Url>https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url>`,
    ),
  () =>
    flexError(
      1019,
      "Statement generation in progress. Please try again shortly.",
    ),
  () => new Response(statementXml, { headers: { "Content-Type": "text/xml" } }),
]);
const result = await createIbkrConnector(happy.fetcher, { sleep }).sync({
  flexToken: TOKEN,
  flexQueryId: QUERY_ID,
});

assert.equal(happy.requests.length, 3);
const [sendRequest, firstPoll, secondPoll] = happy.requests;
assert.equal(
  `${sendRequest?.url.origin}${sendRequest?.url.pathname}`,
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest",
);
assert.equal(sendRequest?.url.searchParams.get("t"), TOKEN);
assert.equal(sendRequest?.url.searchParams.get("q"), QUERY_ID);
assert.equal(sendRequest?.url.searchParams.get("v"), "3");
assert.equal(
  `${firstPoll?.url.origin}${firstPoll?.url.pathname}`,
  "https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement",
);
assert.equal(firstPoll?.url.searchParams.get("q"), "1122334455");
assert.equal(secondPoll?.url.searchParams.get("q"), "1122334455");
assert.ok(happy.requests.every((request) => request.userAgent));
assert.ok(sleeps.length >= 2 && sleeps.every((ms) => ms >= 1000));

assert.equal(result.records.length, 3);
assert.equal(result.investmentTransactions?.length, 6);
assert.equal(result.bankAccounts?.length, 2);
assert.equal(result.bankBalanceSnapshots?.length, 2);
assert.equal(result.netWorthHistory, undefined);
assert.equal(result.equityHistory.length, 3);
assert.ok(result.cursor);
assert.ok(!result.cursor.includes(TOKEN));
assert.deepEqual(JSON.parse(result.cursor), { lastReportDate: "2026-09-24" });

await assert.rejects(
  createIbkrConnector(
    async () => {
      throw new Error("must not fetch without credentials");
    },
    { sleep },
  ).sync({}),
  IbkrVerificationRequiredError,
);

for (const code of [1012, 1013, 1014, 1015]) {
  const denied = scriptedFetch([() => flexError(code, "Token is invalid.")]);
  await assert.rejects(
    createIbkrConnector(denied.fetcher, { sleep }).sync({
      flexToken: TOKEN,
      flexQueryId: QUERY_ID,
    }),
    (error: unknown) =>
      error instanceof IbkrVerificationRequiredError &&
      error.message.includes(String(code)) &&
      !error.message.includes(TOKEN),
  );
}

const neverReady = scriptedFetch([
  () =>
    flexResponse(
      `<Status>Success</Status><ReferenceCode>1122334455</ReferenceCode><Url>https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url>`,
    ),
  ...Array.from(
    { length: 20 },
    () => () => flexError(1019, "Statement generation in progress."),
  ),
]);
await assert.rejects(
  createIbkrConnector(neverReady.fetcher, { sleep }).sync({
    flexToken: TOKEN,
    flexQueryId: QUERY_ID,
  }),
  (error: unknown) =>
    error instanceof IbkrConnectionError && !error.message.includes(TOKEN),
);
assert.ok(neverReady.requests.length <= 10);

const untrustedUrl = scriptedFetch([
  () =>
    flexResponse(
      `<Status>Success</Status><ReferenceCode>1122334455</ReferenceCode><Url>https://evil.example.com/GetStatement</Url>`,
    ),
  () => new Response(statementXml),
]);
await createIbkrConnector(untrustedUrl.fetcher, { sleep }).sync({
  flexToken: TOKEN,
  flexQueryId: QUERY_ID,
});
assert.equal(
  untrustedUrl.requests[1]?.url.hostname,
  "ndcdyn.interactivebrokers.com",
);

const httpFailure = scriptedFetch([
  () => new Response("Service Unavailable", { status: 503 }),
]);
await assert.rejects(
  createIbkrConnector(httpFailure.fetcher, { sleep }).sync({
    flexToken: TOKEN,
    flexQueryId: QUERY_ID,
  }),
  IbkrConnectionError,
);

console.log("IBKR Flex connector self-check passed.");
