2025-08-07T10:19:24.318Z [info] [TradeAction/ManualSession] 🚀 ENHANCED MANUAL EXECUTION MODE - Starting session for Volatility 50 (1s) Index
2025-08-07T10:19:24.318Z [info] [TradeAction/ManualSession] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 12, Execution Mode: safe, Bulk Trades: 6, Account: demo, Strategy: Odd
2025-08-07T10:19:24.318Z [info] [TradeAction/ManualSession] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-07T10:19:24.318Z [info] [TradeAction/ManualSession] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9',
  currentDigit: 9,
  consecutiveCount: 4,
  patternType: 'odd_after_evens'
}
2025-08-07T10:19:24.318Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 50 (1s) Index -> 1HZ50V
2025-08-07T10:19:24.406Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:24.517Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:24.906Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:24.926Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] Latest price for Volatility 50 (1s) Index: 213988.92
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] Fetched 20 ticks for pattern analysis
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] Recent digits: [2, 0, 9, 5, 6, 8, 5, 6, 0, 2]
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9',
  currentDigit: 9,
  consecutiveCount: 4,
  patternType: 'odd_after_evens'
}
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] ✅ Pattern validation passed: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] Pattern Details - Type: odd_after_evens, Consecutive: 4, Current Digit: 9
2025-08-07T10:19:24.926Z [info] [TradeAction/ManualSession] 🛡️ SAFE MODE: Implementing two-tick execution strategy
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode] 🛡️ Implementing two-tick execution strategy for 6 trades
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode] Initial Price Point: 213988.92, Contract Type: DIGITODD
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode] Batch distribution: 4 trades on first tick, 2 trades on second tick
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode] 📊 Executing first batch (4 trades) on current favorable tick
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode/Batch1] Executing 4 trades at price 213988.92
2025-08-07T10:19:24.927Z [info] [TradeAction/SafeMode/Batch1] Trade 1/4 - Entry Price: 213988.92
2025-08-07T10:19:24.928Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:24.927Z
2025-08-07T10:19:24.938Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:25.012Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 84ms. Authorizing...
2025-08-07T10:19:25.012Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:25.111Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:25.111Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:25.111Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:25.220Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 90cf74b4-0512-9ab5-2664-0bf18cbb6d0d, Proposal Spot: 214005.37. Buying contract...
2025-08-07T10:19:25.220Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 90cf74b4-0512-9ab5-2664-0bf18cbb6d0d
2025-08-07T10:19:25.220Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"90cf74b4-0512-9ab5-2664-0bf18cbb6d0d","price":2}
2025-08-07T10:19:25.314Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9771.77,"buy_price":2,"contract_id":290324750628,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561965,"shortcode":"DIGITODD_1HZ50V_3.87_1754561965_5T","start_time":1754561965,"transaction_id":578456859208}. Duration: 387ms.
2025-08-07T10:19:25.314Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9771.77,"buy_price":2,"contract_id":290324750628,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561965,"shortcode":"DIGITODD_1HZ50V_3.87_1754561965_5T","start_time":1754561965,"transaction_id":578456859208}
2025-08-07T10:19:25.315Z [info] [DerivService/placeTrade] Forgetting subscription 90cf74b4-0512-9ab5-2664-0bf18cbb6d0d after buy message processed (Error: false).
2025-08-07T10:19:25.327Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9771.77,"buy_price":2,"con', WasClean: true. Duration: 399ms.
2025-08-07T10:19:25.466Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214005.37,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:24.926Z"),
    derivContractId: 290324750628,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324750628,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214005.37,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:25.466Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214005.37,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:24.926Z"),
    derivContractId: 290324750628,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324750628,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214005.37,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:25.965Z [info] [TradeAction/SafeMode/Batch1] Trade 2/4 - Entry Price: 213988.92
2025-08-07T10:19:25.965Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:25.965Z
2025-08-07T10:19:26.075Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 109ms. Authorizing...
2025-08-07T10:19:26.075Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:26.276Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:26.276Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:26.276Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:26.345Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: dc962555-32ca-5fbf-b087-fff6127da6e3, Proposal Spot: 214042.03. Buying contract...
2025-08-07T10:19:26.345Z [info] [DerivService/placeTrade] Stored proposal subscription ID: dc962555-32ca-5fbf-b087-fff6127da6e3
2025-08-07T10:19:26.345Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"dc962555-32ca-5fbf-b087-fff6127da6e3","price":2}
2025-08-07T10:19:26.446Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9769.77,"buy_price":2,"contract_id":290324751688,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561966,"shortcode":"DIGITODD_1HZ50V_3.87_1754561966_5T","start_time":1754561966,"transaction_id":578456861768}. Duration: 480ms.
2025-08-07T10:19:26.446Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9769.77,"buy_price":2,"contract_id":290324751688,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561966,"shortcode":"DIGITODD_1HZ50V_3.87_1754561966_5T","start_time":1754561966,"transaction_id":578456861768}
2025-08-07T10:19:26.446Z [info] [DerivService/placeTrade] Forgetting subscription dc962555-32ca-5fbf-b087-fff6127da6e3 after buy message processed (Error: false).
2025-08-07T10:19:26.449Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214042.03,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.026Z"),
    derivContractId: 290324751688,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324751688,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214042.03,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:26.449Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214042.03,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.026Z"),
    derivContractId: 290324751688,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324751688,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214042.03,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:26.457Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9769.77,"buy_price":2,"con', WasClean: true. Duration: 491ms.
2025-08-07T10:19:31.822Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 79ms. Authorizing...
2025-08-07T10:19:31.822Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:31.948Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:31.948Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:31.948Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:31.989Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 60054dfc-39bd-46c8-01e5-f31511988132, Proposal Spot: 214054.29. Buying contract...
2025-08-07T10:19:31.989Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 60054dfc-39bd-46c8-01e5-f31511988132
2025-08-07T10:19:31.990Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"60054dfc-39bd-46c8-01e5-f31511988132","price":2}
2025-08-07T10:19:32.068Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9761.77,"buy_price":2,"contract_id":290324759628,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561972,"shortcode":"DIGITODD_1HZ50V_3.87_1754561972_5T","start_time":1754561972,"transaction_id":578456875868}. Duration: 326ms.
2025-08-07T10:19:32.068Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9761.77,"buy_price":2,"contract_id":290324759628,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561972,"shortcode":"DIGITODD_1HZ50V_3.87_1754561972_5T","start_time":1754561972,"transaction_id":578456875868}
2025-08-07T10:19:32.068Z [info] [DerivService/placeTrade] Forgetting subscription 60054dfc-39bd-46c8-01e5-f31511988132 after buy message processed (Error: false).
2025-08-07T10:19:32.070Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214054.29,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:30.973Z"),
    derivContractId: 290324759628,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324759628,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214054.29,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:32.070Z [error] [TradeAction/SafeMode/Batch2] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214054.29,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:30.973Z"),
    derivContractId: 290324759628,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324759628,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214054.29,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:32.071Z [info] [TradeAction/SafeMode/Batch2] Batch completed: 0/2 successful
2025-08-07T10:19:32.071Z [info] [TradeAction/SafeMode] 🎯 Safe mode execution completed: 0/6 trades successful
2025-08-07T10:19:32.071Z [info] [TradeAction/ManualSession] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-07T10:19:32.071Z [info] [TradeAction/ManualSession] ✅ Successful trades: 0/6
2025-08-07T10:19:32.071Z [info] [TradeAction/ManualSession] ❌ Failed trades: 6/6
2025-08-07T10:19:32.071Z [info] [TradeAction/ManualSession] 📊 Execution mode: SAFE
2025-08-07T10:19:32.078Z [error] ⨯ ReferenceError: contractType is not defined
    at w (.next/server/chunks/6595.js:133:30661) {
  digest: '3988716653'
}
2025-08-07T10:19:26.950Z [info] [TradeAction/SafeMode/Batch1] Trade 3/4 - Entry Price: 213988.92
2025-08-07T10:19:26.950Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:26.949Z
2025-08-07T10:19:27.027Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 77ms. Authorizing...
2025-08-07T10:19:27.027Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:27.123Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:27.123Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:27.123Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:27.223Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 8976a8a2-506f-f944-bb2c-a62f9ae42db4, Proposal Spot: 214027.84. Buying contract...
2025-08-07T10:19:27.224Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 8976a8a2-506f-f944-bb2c-a62f9ae42db4
2025-08-07T10:19:27.224Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"8976a8a2-506f-f944-bb2c-a62f9ae42db4","price":2}
2025-08-07T10:19:27.309Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9767.77,"buy_price":2,"contract_id":290324753548,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561967,"shortcode":"DIGITODD_1HZ50V_3.87_1754561967_5T","start_time":1754561967,"transaction_id":578456864568}. Duration: 360ms.
2025-08-07T10:19:27.309Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9767.77,"buy_price":2,"contract_id":290324753548,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561967,"shortcode":"DIGITODD_1HZ50V_3.87_1754561967_5T","start_time":1754561967,"transaction_id":578456864568}
2025-08-07T10:19:27.309Z [info] [DerivService/placeTrade] Forgetting subscription 8976a8a2-506f-f944-bb2c-a62f9ae42db4 after buy message processed (Error: false).
2025-08-07T10:19:27.312Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214027.84,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.126Z"),
    derivContractId: 290324753548,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324753548,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 3,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214027.84,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:27.312Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 3 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214027.84,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.126Z"),
    derivContractId: 290324753548,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324753548,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 3,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214027.84,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:27.316Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9767.77,"buy_price":2,"con', WasClean: true. Duration: 367ms.
2025-08-07T10:19:27.812Z [info] [TradeAction/SafeMode/Batch1] Trade 4/4 - Entry Price: 213988.92
2025-08-07T10:19:27.812Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:27.812Z
2025-08-07T10:19:27.893Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 80ms. Authorizing...
2025-08-07T10:19:27.893Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:28.021Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:28.021Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:28.021Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:28.065Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: c9cd0687-323d-0b45-e89a-db1daba2d7e8, Proposal Spot: 214027.84. Buying contract...
2025-08-07T10:19:28.065Z [info] [DerivService/placeTrade] Stored proposal subscription ID: c9cd0687-323d-0b45-e89a-db1daba2d7e8
2025-08-07T10:19:28.065Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"c9cd0687-323d-0b45-e89a-db1daba2d7e8","price":2}
2025-08-07T10:19:28.277Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9765.77,"buy_price":2,"contract_id":290324754748,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561968,"shortcode":"DIGITODD_1HZ50V_3.87_1754561968_5T","start_time":1754561968,"transaction_id":578456866428}. Duration: 464ms.
2025-08-07T10:19:28.277Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9765.77,"buy_price":2,"contract_id":290324754748,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561968,"shortcode":"DIGITODD_1HZ50V_3.87_1754561968_5T","start_time":1754561968,"transaction_id":578456866428}
2025-08-07T10:19:28.277Z [info] [DerivService/placeTrade] Forgetting subscription c9cd0687-323d-0b45-e89a-db1daba2d7e8 after buy message processed (Error: false).
2025-08-07T10:19:28.279Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214027.84,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.226Z"),
    derivContractId: 290324754748,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324754748,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 4,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214027.84,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:28.279Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 4 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214027.84,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:25.226Z"),
    derivContractId: 290324754748,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324754748,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 4,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214027.84,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:28.279Z [info] [TradeAction/SafeMode/Batch1] Batch completed: 0/4 successful
2025-08-07T10:19:28.279Z [info] [TradeAction/SafeMode] ⏳ Waiting for second favorable tick for remaining 2 trades
2025-08-07T10:19:28.302Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9765.77,"buy_price":2,"con', WasClean: true. Duration: 489ms.
2025-08-07T10:19:30.356Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:30.454Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:30.857Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":1,"end":"latest","style":"ticks"}
2025-08-07T10:19:30.873Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T10:19:30.873Z [info] [TradeAction/SafeMode] 📊 Executing second batch (2 trades) on second tick - Price: 214052.2
2025-08-07T10:19:30.873Z [info] [TradeAction/SafeMode/Batch2] Executing 2 trades at price 214052.2
2025-08-07T10:19:30.873Z [info] [TradeAction/SafeMode/Batch2] Trade 1/2 - Entry Price: 214052.2
2025-08-07T10:19:30.873Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:30.873Z
2025-08-07T10:19:30.880Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:30.943Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 69ms. Authorizing...
2025-08-07T10:19:30.943Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T10:19:31.044Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T10:19:31.044Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T10:19:31.045Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ50V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-07T10:19:31.104Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 05f00bce-6a9b-4e47-e49f-4d830082c16e, Proposal Spot: 214052.2. Buying contract...
2025-08-07T10:19:31.104Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 05f00bce-6a9b-4e47-e49f-4d830082c16e
2025-08-07T10:19:31.104Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"05f00bce-6a9b-4e47-e49f-4d830082c16e","price":2}
2025-08-07T10:19:31.239Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9763.77,"buy_price":2,"contract_id":290324758708,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561971,"shortcode":"DIGITODD_1HZ50V_3.87_1754561971_5T","start_time":1754561971,"transaction_id":578456874248}. Duration: 366ms.
2025-08-07T10:19:31.239Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9763.77,"buy_price":2,"contract_id":290324758708,"longcode":"Win payout if the last digit of Volatility 50 (1s) Index is odd after 5 ticks.","payout":3.87,"purchase_time":1754561971,"shortcode":"DIGITODD_1HZ50V_3.87_1754561971_5T","start_time":1754561971,"transaction_id":578456874248}
2025-08-07T10:19:31.239Z [info] [DerivService/placeTrade] Forgetting subscription 05f00bce-6a9b-4e47-e49f-4d830082c16e after buy message processed (Error: false).
2025-08-07T10:19:31.241Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214052.2,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:30.873Z"),
    derivContractId: 290324758708,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324758708,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214052.2,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:31.241Z [error] [TradeAction/SafeMode/Batch2] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ50V",
    type: "DigitsEvenOdd (DIGITODD)",
    amount: 2,
    price: 214052.2,
    totalValue: 2,
    status: "OPEN",
    openTime: new Date("2025-08-07T10:19:30.873Z"),
    derivContractId: 290324758708,
                     ~~~~~~~~~~~~
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    metadata: {
      instrument: "Volatility 50 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: 290324758708,
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 4,
        patternType: "odd_after_evens"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 214052.2,
      buyPrice: 2
    }
  }
}

Argument `derivContractId`: Invalid value provided. Expected String or Null, provided Int.
2025-08-07T10:19:31.256Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9763.77,"buy_price":2,"con', WasClean: true. Duration: 382ms.
2025-08-07T10:19:31.742Z [info] [TradeAction/SafeMode/Batch2] Trade 2/2 - Entry Price: 214052.2
2025-08-07T10:19:31.742Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ50V at 2025-08-07T10:19:31.742Z

2025-08-07T10:19:24.256Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:17.626Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: CR8821305. Code: 1000, Reason: Balance successfully retrieved for CR8821305., WasClean: true. Duration: 89581ms.
2025-08-07T10:19:17.627Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: Balance successfully retrieved for VRTC13200397., WasClean: true. Duration: 89608ms.
2025-08-07T10:19:17.669Z [info] [TradeAction/Session] Starting AI session. User: 17315277, Account: VRTC13200397, Trade Type: DigitsEvenOdd, Total Stake: 2
2025-08-07T10:19:17.669Z [info] [TradeAction/Session] Execution Mode: safe, Bulk Trades: 1, Selected Instrument: Volatility 50 (1s) Index
2025-08-07T10:19:17.669Z [info] [TradeAction/Session] Environment: Vercel Serverless, 1s Index: true
2025-08-07T10:19:17.670Z [info] [TradeAction/Session] CRITICAL FIX: Available volatility indices for data fetching: [
  'Volatility 10 Index',
  'Volatility 25 Index',
  'Volatility 50 Index',
  'Volatility 75 Index',
  'Volatility 100 Index',
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index'
]
2025-08-07T10:19:17.670Z [info] [TradeAction/Session] Processing Volatility 10 Index -> API Symbol: R_10
2025-08-07T10:19:17.670Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 10 Index (1s index: false)
2025-08-07T10:19:17.739Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:17.834Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:18.240Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_10","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:18.358Z [info] [DerivService/getTicks] Closing WebSocket for R_10. Ticks received successfully
2025-08-07T10:19:18.358Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 Index -> R_10: 25 ticks
2025-08-07T10:19:18.358Z [info] [TradeAction/Session] Processing Volatility 25 Index -> API Symbol: R_25
2025-08-07T10:19:18.358Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 25 Index (1s index: false)
2025-08-07T10:19:18.363Z [info] [DerivService/getTicks] WebSocket connection closed for R_10. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:18.414Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:18.552Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:18.914Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_25","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:18.932Z [info] [DerivService/getTicks] Closing WebSocket for R_25. Ticks received successfully
2025-08-07T10:19:18.932Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 Index -> R_25: 25 ticks
2025-08-07T10:19:18.932Z [info] [TradeAction/Session] Processing Volatility 50 Index -> API Symbol: R_50
2025-08-07T10:19:18.932Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 50 Index (1s index: false)
2025-08-07T10:19:18.940Z [info] [DerivService/getTicks] WebSocket connection closed for R_25. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:19.017Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:19.129Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:19.518Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_50","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:19.554Z [info] [DerivService/getTicks] Closing WebSocket for R_50. Ticks received successfully
2025-08-07T10:19:19.555Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 Index -> R_50: 25 ticks
2025-08-07T10:19:19.555Z [info] [TradeAction/Session] Processing Volatility 75 Index -> API Symbol: R_75
2025-08-07T10:19:19.555Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 75 Index (1s index: false)
2025-08-07T10:19:19.578Z [info] [DerivService/getTicks] WebSocket connection closed for R_50. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:19.632Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:19.772Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:20.133Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_75","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:20.274Z [info] [DerivService/getTicks] Closing WebSocket for R_75. Ticks received successfully
2025-08-07T10:19:20.274Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 Index -> R_75: 25 ticks
2025-08-07T10:19:20.274Z [info] [TradeAction/Session] Processing Volatility 100 Index -> API Symbol: R_100
2025-08-07T10:19:20.274Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 100 Index (1s index: false)
2025-08-07T10:19:20.305Z [info] [DerivService/getTicks] WebSocket connection closed for R_75. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:20.358Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:20.490Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:20.859Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:20.880Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T10:19:20.880Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 Index -> R_100: 25 ticks
2025-08-07T10:19:20.881Z [info] [TradeAction/Session] Processing Volatility 10 (1s) Index -> API Symbol: 1HZ10V
2025-08-07T10:19:20.881Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 10 (1s) Index (1s index: true)
2025-08-07T10:19:20.890Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:20.954Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:21.061Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:21.455Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ10V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:21.513Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ10V. Ticks received successfully
2025-08-07T10:19:21.513Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 (1s) Index -> 1HZ10V: 20 ticks
2025-08-07T10:19:21.513Z [info] [TradeAction/Session] Processing Volatility 25 (1s) Index -> API Symbol: 1HZ25V
2025-08-07T10:19:21.513Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 25 (1s) Index (1s index: true)
2025-08-07T10:19:21.522Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ10V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:21.591Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:21.717Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:22.092Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ25V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:22.109Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ25V. Ticks received successfully
2025-08-07T10:19:22.110Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 (1s) Index -> 1HZ25V: 20 ticks
2025-08-07T10:19:22.110Z [info] [TradeAction/Session] Processing Volatility 50 (1s) Index -> API Symbol: 1HZ50V
2025-08-07T10:19:22.110Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 50 (1s) Index (1s index: true)
2025-08-07T10:19:22.118Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ25V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:22.262Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:22.428Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:22.762Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:22.781Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T10:19:22.782Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 (1s) Index -> 1HZ50V: 20 ticks
2025-08-07T10:19:22.782Z [info] [TradeAction/Session] Processing Volatility 75 (1s) Index -> API Symbol: 1HZ75V
2025-08-07T10:19:22.782Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 75 (1s) Index (1s index: true)
2025-08-07T10:19:22.789Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:22.859Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:22.989Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:23.360Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:23.379Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-07T10:19:23.380Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 (1s) Index -> 1HZ75V: 20 ticks
2025-08-07T10:19:23.380Z [info] [TradeAction/Session] Processing Volatility 100 (1s) Index -> API Symbol: 1HZ100V
2025-08-07T10:19:23.380Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 100 (1s) Index (1s index: true)
2025-08-07T10:19:23.391Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:23.460Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:23.568Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:23.960Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:23.976Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 (1s) Index -> 1HZ100V: 20 ticks
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Available instruments with data: Volatility 10 Index, Volatility 25 Index, Volatility 50 Index, Volatility 75 Index, Volatility 100 Index, Volatility 10 (1s) Index, Volatility 25 (1s) Index, Volatility 50 (1s) Index, Volatility 75 (1s) Index, Volatility 100 (1s) Index
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Available API symbols with data: R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Calling AI for session strategy. TradeType: DigitsEvenOdd, TotalStake: 2
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Using pattern-based strategy: {
  shouldTrade: true,
  contractType: 'DIGITODD',
  reasoning: 'Pattern trigger: 3 consecutive Even digits (8,2,0) followed by Odd digit (9)'
}
2025-08-07T10:19:23.976Z [info] [TradeAction/Session] Pattern-based trades using safe mode: 5 tick duration
2025-08-07T10:19:23.977Z [info] [TradeAction/Session] AI Session Strategy received. Overall Reasoning: Pattern-based DIGITODD strategy: Pattern trigger: 3 consecutive Even digits (8,2,0) followed by Odd digit (9)
2025-08-07T10:19:23.977Z [info] [TradeAction/Session] AI proposes 1 trades.
2025-08-07T10:19:23.977Z [info] [TradeAction/TickTiming] Safe mode: Implementing split-tick execution for 1 bulk trades
2025-08-07T10:19:23.977Z [info] [TradeAction/TickTiming] Safe mode: ≤5 trades - executing per-tick on consecutive ticks
2025-08-07T10:19:23.977Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T10:19:23.977Z [info] [TradeAction/SingleTrade] Processing AI proposed trade for: undefined (Deriv: R_100), Turbo Mode: false
2025-08-07T10:19:23.978Z [error] [TradeAction/SingleTrade] AI proposal for undefined is incomplete. Skipping. {
  derivContractType: 'DIGITODD',
  stake: 2,
  duration: 5,
  durationUnit: 't',
  barrier: undefined,
  reasoning: 'Pattern trigger: 3 consecutive Even digits (8,2,0) followed by Odd digit (9) (Trade 1/1, safe mode)'
}
2025-08-07T10:19:23.978Z [info] [TradeAction/Session] Finished Volatility AI session. Total results processed: 1

2025-08-07T10:19:32.561Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9761.77,"buy_price":2,"con', WasClean: true. Duration: 338ms.
2025-08-07T10:19:32.564Z [info] [TradeAction/Session] Starting AI session. User: 17315277, Account: VRTC13200397, Trade Type: DigitsEvenOdd, Total Stake: 2
2025-08-07T10:19:32.564Z [info] [TradeAction/Session] Execution Mode: safe, Bulk Trades: 1, Selected Instrument: Volatility 50 (1s) Index
2025-08-07T10:19:32.564Z [info] [TradeAction/Session] Environment: Vercel Serverless, 1s Index: true
2025-08-07T10:19:32.565Z [info] [TradeAction/Session] CRITICAL FIX: Available volatility indices for data fetching: [
  'Volatility 10 Index',
  'Volatility 25 Index',
  'Volatility 50 Index',
  'Volatility 75 Index',
  'Volatility 100 Index',
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index'
]
2025-08-07T10:19:32.565Z [info] [TradeAction/Session] Processing Volatility 10 Index -> API Symbol: R_10
2025-08-07T10:19:32.565Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 10 Index (1s index: false)
2025-08-07T10:19:32.641Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:32.781Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:33.142Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_10","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:33.217Z [info] [DerivService/getTicks] Closing WebSocket for R_10. Ticks received successfully
2025-08-07T10:19:33.217Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 Index -> R_10: 25 ticks
2025-08-07T10:19:33.217Z [info] [TradeAction/Session] Processing Volatility 25 Index -> API Symbol: R_25
2025-08-07T10:19:33.217Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 25 Index (1s index: false)
2025-08-07T10:19:33.231Z [info] [DerivService/getTicks] WebSocket connection closed for R_10. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:33.321Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:33.425Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:33.822Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_25","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:33.842Z [info] [DerivService/getTicks] Closing WebSocket for R_25. Ticks received successfully
2025-08-07T10:19:33.842Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 Index -> R_25: 25 ticks
2025-08-07T10:19:33.842Z [info] [TradeAction/Session] Processing Volatility 50 Index -> API Symbol: R_50
2025-08-07T10:19:33.842Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 50 Index (1s index: false)
2025-08-07T10:19:33.860Z [info] [DerivService/getTicks] WebSocket connection closed for R_25. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:33.925Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:34.028Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:34.425Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_50","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:34.446Z [info] [DerivService/getTicks] Closing WebSocket for R_50. Ticks received successfully
2025-08-07T10:19:34.446Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 Index -> R_50: 25 ticks
2025-08-07T10:19:34.446Z [info] [TradeAction/Session] Processing Volatility 75 Index -> API Symbol: R_75
2025-08-07T10:19:34.446Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 75 Index (1s index: false)
2025-08-07T10:19:34.459Z [info] [DerivService/getTicks] WebSocket connection closed for R_50. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:34.577Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:34.732Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:35.077Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_75","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:35.109Z [info] [DerivService/getTicks] Closing WebSocket for R_75. Ticks received successfully
2025-08-07T10:19:35.109Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 Index -> R_75: 25 ticks
2025-08-07T10:19:35.109Z [info] [TradeAction/Session] Processing Volatility 100 Index -> API Symbol: R_100
2025-08-07T10:19:35.109Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 100 Index (1s index: false)
2025-08-07T10:19:35.133Z [info] [DerivService/getTicks] WebSocket connection closed for R_75. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:35.231Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:35.330Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:35.732Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:19:35.753Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T10:19:35.753Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 Index -> R_100: 25 ticks
2025-08-07T10:19:35.753Z [info] [TradeAction/Session] Processing Volatility 10 (1s) Index -> API Symbol: 1HZ10V
2025-08-07T10:19:35.753Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 10 (1s) Index (1s index: true)
2025-08-07T10:19:35.764Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:35.824Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:35.920Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:36.325Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ10V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:36.352Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ10V. Ticks received successfully
2025-08-07T10:19:36.352Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 (1s) Index -> 1HZ10V: 20 ticks
2025-08-07T10:19:36.352Z [info] [TradeAction/Session] Processing Volatility 25 (1s) Index -> API Symbol: 1HZ25V
2025-08-07T10:19:36.352Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 25 (1s) Index (1s index: true)
2025-08-07T10:19:36.404Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ10V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:36.436Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:36.522Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:36.936Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ25V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:36.954Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ25V. Ticks received successfully
2025-08-07T10:19:36.955Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 (1s) Index -> 1HZ25V: 20 ticks
2025-08-07T10:19:36.955Z [info] [TradeAction/Session] Processing Volatility 50 (1s) Index -> API Symbol: 1HZ50V
2025-08-07T10:19:36.955Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 50 (1s) Index (1s index: true)
2025-08-07T10:19:36.964Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ25V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:37.034Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:37.137Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:37.534Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:37.556Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T10:19:37.556Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 (1s) Index -> 1HZ50V: 20 ticks
2025-08-07T10:19:37.556Z [info] [TradeAction/Session] Processing Volatility 75 (1s) Index -> API Symbol: 1HZ75V
2025-08-07T10:19:37.556Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 75 (1s) Index (1s index: true)
2025-08-07T10:19:37.565Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:37.640Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:37.780Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:38.140Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:38.314Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-07T10:19:38.315Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 (1s) Index -> 1HZ75V: 20 ticks
2025-08-07T10:19:38.315Z [info] [TradeAction/Session] Processing Volatility 100 (1s) Index -> API Symbol: 1HZ100V
2025-08-07T10:19:38.315Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 100 (1s) Index (1s index: true)
2025-08-07T10:19:38.323Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:19:38.392Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:19:38.489Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:19:38.893Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:19:38.909Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T10:19:38.909Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 (1s) Index -> 1HZ100V: 20 ticks
2025-08-07T10:19:38.909Z [info] [TradeAction/Session] Available instruments with data: Volatility 10 Index, Volatility 25 Index, Volatility 50 Index, Volatility 75 Index, Volatility 100 Index, Volatility 10 (1s) Index, Volatility 25 (1s) Index, Volatility 50 (1s) Index, Volatility 75 (1s) Index, Volatility 100 (1s) Index
2025-08-07T10:19:38.909Z [info] [TradeAction/Session] Available API symbols with data: R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
2025-08-07T10:19:38.909Z [info] [TradeAction/Session] Calling AI for session strategy. TradeType: DigitsEvenOdd, TotalStake: 2
2025-08-07T10:19:38.909Z [info] [TradeAction/Session] Using pattern-based strategy: {
  shouldTrade: true,
  contractType: 'DIGITODD',
  reasoning: 'Pattern trigger: 3 consecutive Even digits (6,0,2) followed by Odd digit (7)'
}
2025-08-07T10:19:38.913Z [info] [TradeAction/Session] Pattern-based trades using safe mode: 5 tick duration
2025-08-07T10:19:38.913Z [info] [TradeAction/Session] AI Session Strategy received. Overall Reasoning: Pattern-based DIGITODD strategy: Pattern trigger: 3 consecutive Even digits (6,0,2) followed by Odd digit (7)
2025-08-07T10:19:38.913Z [info] [TradeAction/Session] AI proposes 1 trades.
2025-08-07T10:19:38.913Z [info] [TradeAction/TickTiming] Safe mode: Implementing split-tick execution for 1 bulk trades
2025-08-07T10:19:38.913Z [info] [TradeAction/TickTiming] Safe mode: ≤5 trades - executing per-tick on consecutive ticks
2025-08-07T10:19:38.913Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T10:19:38.913Z [info] [TradeAction/SingleTrade] Processing AI proposed trade for: undefined (Deriv: R_100), Turbo Mode: false
2025-08-07T10:19:38.913Z [error] [TradeAction/SingleTrade] AI proposal for undefined is incomplete. Skipping. {
  derivContractType: 'DIGITODD',
  stake: 2,
  duration: 5,
  durationUnit: 't',
  barrier: undefined,
  reasoning: 'Pattern trigger: 3 consecutive Even digits (6,0,2) followed by Odd digit (7) (Trade 1/1, safe mode)'
}
2025-08-07T10:19:38.913Z [info] [TradeAction/Session] Finished Volatility AI session. Total results processed: 1