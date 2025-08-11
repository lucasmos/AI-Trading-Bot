2025-08-11T13:20:50.615Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-11T13:20:50.722Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-11T13:20:51.116Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":1,"end":"latest","style":"ticks"}
2025-08-11T13:20:51.132Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-11T13:20:51.133Z [info] [TradeAction/SafeMode] 📊 Executing second batch (2 trades) on second tick - Price: 3711.12
2025-08-11T13:20:51.133Z [info] [TradeAction/SafeMode/Batch2] Executing 2 trades at price 3711.12
2025-08-11T13:20:51.133Z [info] [TradeAction/SafeMode/Batch2] Trade 1/2 - Entry Price: 3711.12
2025-08-11T13:20:51.133Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:51.132Z
2025-08-11T13:20:51.144Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-11T13:20:51.238Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 105ms. Authorizing...
2025-08-11T13:20:51.238Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:51.344Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:51.344Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:51.344Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:51.390Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ad7d84dc-a237-bb19-3b5d-07cfb4106813, Proposal Spot: 3711.87. Buying contract...
2025-08-11T13:20:51.390Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ad7d84dc-a237-bb19-3b5d-07cfb4106813
2025-08-11T13:20:51.390Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ad7d84dc-a237-bb19-3b5d-07cfb4106813","price":1.71}
2025-08-11T13:20:51.477Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9724.42,"buy_price":1.71,"contract_id":290738827928,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918451,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918451_1T","start_time":1754918451,"transaction_id":579255439748}. Duration: 345ms.
2025-08-11T13:20:51.477Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9724.42,"buy_price":1.71,"contract_id":290738827928,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918451,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918451_1T","start_time":1754918451,"transaction_id":579255439748}
2025-08-11T13:20:51.478Z [info] [DerivService/placeTrade] Forgetting subscription ad7d84dc-a237-bb19-3b5d-07cfb4106813 after buy message processed (Error: false).
2025-08-11T13:20:51.481Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3711.87,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:51.132Z"),
    derivContractId: "290738827928",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3711.87,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738827928",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3711.87,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:51.481Z [error] [TradeAction/SafeMode/Batch2] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3711.87,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:51.132Z"),
    derivContractId: "290738827928",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3711.87,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738827928",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3711.87,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:51.492Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9724.42,"buy_price":1.71,"', WasClean: true. Duration: 359ms.
2025-08-11T13:20:51.981Z [info] [TradeAction/SafeMode/Batch2] Trade 2/2 - Entry Price: 3711.12
2025-08-11T13:20:51.981Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:51.981Z
2025-08-11T13:20:52.074Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 93ms. Authorizing...
2025-08-11T13:20:52.074Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:52.334Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:52.334Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:52.334Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:52.398Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 11755850-2bf4-1c01-2318-6482800c5a8c, Proposal Spot: 3710.94. Buying contract...
2025-08-11T13:20:52.398Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 11755850-2bf4-1c01-2318-6482800c5a8c
2025-08-11T13:20:52.398Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"11755850-2bf4-1c01-2318-6482800c5a8c","price":1.71}
2025-08-11T13:20:52.492Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9722.71,"buy_price":1.71,"contract_id":290738829148,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918452,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918452_1T","start_time":1754918452,"transaction_id":579255442328}. Duration: 511ms.
2025-08-11T13:20:52.492Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9722.71,"buy_price":1.71,"contract_id":290738829148,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918452,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918452_1T","start_time":1754918452,"transaction_id":579255442328}
2025-08-11T13:20:52.493Z [info] [DerivService/placeTrade] Forgetting subscription 11755850-2bf4-1c01-2318-6482800c5a8c after buy message processed (Error: false).
2025-08-11T13:20:52.495Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.94,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:51.232Z"),
    derivContractId: "290738829148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.94,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738829148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.94,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:52.495Z [error] [TradeAction/SafeMode/Batch2] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.94,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:51.232Z"),
    derivContractId: "290738829148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.94,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738829148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 2,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 2: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.94,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:52.495Z [info] [TradeAction/SafeMode/Batch2] Batch completed: 0/2 successful
2025-08-11T13:20:52.495Z [info] [TradeAction/SafeMode] 🎯 Safe mode execution completed: 0/7 trades successful
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 0/7
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 7/7
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: SAFE
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Even
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] 📈 Pattern: even_after_odds
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] 🔢 USER SETTINGS VALIDATION - Requested: 7 trades, Executed: 7 trades
2025-08-11T13:20:52.495Z [info] [TradeAction/MANUAL_SESSION] ⚡ Manual session completed in ~2-3 seconds (vs ~15 seconds for AI mode)
2025-08-11T13:20:52.784Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9722.71,"buy_price":1.71,"', WasClean: true. Duration: 714ms.
2025-08-11T13:20:43.202Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: CR8821305. Code: 1000, Reason: Balance successfully retrieved for CR8821305., WasClean: true. Duration: 168962ms.
2025-08-11T13:20:43.202Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: Balance successfully retrieved for VRTC13200397., WasClean: true. Duration: 168989ms.
2025-08-11T13:20:43.337Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 75 (1s) Index
2025-08-11T13:20:43.337Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 12, Execution Mode: safe, Bulk Trades: 7, Account: demo, Strategy: Even
2025-08-11T13:20:43.337Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-11T13:20:43.337Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-11T13:20:43.337Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITEVEN',
  reasoning: 'Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0',
  currentDigit: 0,
  consecutiveCount: 7,
  patternType: 'even_after_odds'
}
2025-08-11T13:20:43.338Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 75 (1s) Index -> 1HZ75V
2025-08-11T13:20:43.498Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-11T13:20:43.652Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-11T13:20:44.008Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-11T13:20:44.031Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-11T13:20:44.031Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 75 (1s) Index: 3710.53
2025-08-11T13:20:44.031Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [6, 9, 3, 5, 9, 3, 9, 1, 0, 3]
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITEVEN',
  reasoning: 'Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0',
  currentDigit: 0,
  consecutiveCount: 7,
  patternType: 'even_after_odds'
}
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Even -> Contract Type: DIGITEVEN
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: even_after_odds, Consecutive: 7, Current Digit: 0
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 12, Bulk Trades: 7, Stake Per Trade: 1.71
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] 🛡️ SAFE MODE: Implementing two-tick execution strategy
2025-08-11T13:20:44.032Z [info] [TradeAction/MANUAL_SESSION] SAFE MODE VALIDATION - User requested 7 trades, executing exactly 7 trades
2025-08-11T13:20:44.032Z [info] [TradeAction/SafeMode] 🛡️ Implementing two-tick execution strategy for 7 trades
2025-08-11T13:20:44.032Z [info] [TradeAction/SafeMode] Initial Price Point: 3710.53, Contract Type: DIGITEVEN
2025-08-11T13:20:44.032Z [info] [TradeAction/SafeMode] Batch distribution: 5 trades on first tick, 2 trades on second tick
2025-08-11T13:20:44.032Z [info] [TradeAction/SafeMode] 📊 Executing first batch (5 trades) on current favorable tick
2025-08-11T13:20:44.033Z [info] [TradeAction/SafeMode/Batch1] Executing 5 trades at price 3710.53
2025-08-11T13:20:44.033Z [info] [TradeAction/SafeMode/Batch1] Trade 1/5 - Entry Price: 3710.53
2025-08-11T13:20:44.033Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:44.033Z
2025-08-11T13:20:44.054Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-11T13:20:44.153Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 119ms. Authorizing...
2025-08-11T13:20:44.153Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:44.451Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:44.451Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:44.451Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:45.515Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: d2f5de6d-d075-6eda-841a-374f8934219d, Proposal Spot: 3710.49. Buying contract...
2025-08-11T13:20:45.515Z [info] [DerivService/placeTrade] Stored proposal subscription ID: d2f5de6d-d075-6eda-841a-374f8934219d
2025-08-11T13:20:45.515Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"d2f5de6d-d075-6eda-841a-374f8934219d","price":1.71}
2025-08-11T13:20:45.605Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9727.95,"buy_price":1.71,"contract_id":290738819688,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918445,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918445_1T","start_time":1754918445,"transaction_id":579255423448}. Duration: 360ms.
2025-08-11T13:20:45.605Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9727.95,"buy_price":1.71,"contract_id":290738819688,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918445,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918445_1T","start_time":1754918445,"transaction_id":579255423448}
2025-08-11T13:20:45.606Z [info] [DerivService/placeTrade] Forgetting subscription d2f5de6d-d075-6eda-841a-374f8934219d after buy message processed (Error: false).
2025-08-11T13:20:45.609Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.49,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.132Z"),
    derivContractId: "290738819688",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.49,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738819688",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.49,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:45.609Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.49,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.132Z"),
    derivContractId: "290738819688",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.49,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738819688",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 2,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.49,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:45.614Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9727.95,"buy_price":1.71,"', WasClean: true. Duration: 368ms.
2025-08-11T13:20:46.109Z [info] [TradeAction/SafeMode/Batch1] Trade 3/5 - Entry Price: 3710.53
2025-08-11T13:20:46.109Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:46.109Z
2025-08-11T13:20:46.328Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 219ms. Authorizing...
2025-08-11T13:20:46.328Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:46.435Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:46.435Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:46.435Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:44.505Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 36802cbc-5d8e-f3e9-29c8-98450142ad20, Proposal Spot: 3710.41. Buying contract...
2025-08-11T13:20:44.505Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 36802cbc-5d8e-f3e9-29c8-98450142ad20
2025-08-11T13:20:44.505Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"36802cbc-5d8e-f3e9-29c8-98450142ad20","price":1.71}
2025-08-11T13:20:44.611Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9729.66,"buy_price":1.71,"contract_id":290738817628,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918444,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918444_1T","start_time":1754918444,"transaction_id":579255420248}. Duration: 577ms.
2025-08-11T13:20:44.611Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9729.66,"buy_price":1.71,"contract_id":290738817628,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918444,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918444_1T","start_time":1754918444,"transaction_id":579255420248}
2025-08-11T13:20:44.611Z [info] [DerivService/placeTrade] Forgetting subscription 36802cbc-5d8e-f3e9-29c8-98450142ad20 after buy message processed (Error: false).
2025-08-11T13:20:44.621Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9729.66,"buy_price":1.71,"', WasClean: true. Duration: 587ms.
2025-08-11T13:20:44.745Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.41,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.032Z"),
    derivContractId: "290738817628",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.41,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738817628",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.41,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:44.745Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.41,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.032Z"),
    derivContractId: "290738817628",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.41,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738817628",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 1,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.41,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:45.245Z [info] [TradeAction/SafeMode/Batch1] Trade 2/5 - Entry Price: 3710.53
2025-08-11T13:20:45.245Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:45.245Z
2025-08-11T13:20:45.359Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 113ms. Authorizing...
2025-08-11T13:20:45.359Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:45.463Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:45.463Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:45.463Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:46.492Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: aaa083ce-400b-ad06-6308-a9e3bdd01b57, Proposal Spot: 3710.02. Buying contract...
2025-08-11T13:20:46.492Z [info] [DerivService/placeTrade] Stored proposal subscription ID: aaa083ce-400b-ad06-6308-a9e3bdd01b57
2025-08-11T13:20:46.492Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"aaa083ce-400b-ad06-6308-a9e3bdd01b57","price":1.71}
2025-08-11T13:20:46.645Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.24,"buy_price":1.71,"contract_id":290738821148,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918446,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918446_1T","start_time":1754918446,"transaction_id":579255425908}. Duration: 535ms.
2025-08-11T13:20:46.645Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.24,"buy_price":1.71,"contract_id":290738821148,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918446,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918446_1T","start_time":1754918446,"transaction_id":579255425908}
2025-08-11T13:20:46.645Z [info] [DerivService/placeTrade] Forgetting subscription aaa083ce-400b-ad06-6308-a9e3bdd01b57 after buy message processed (Error: false).
2025-08-11T13:20:46.648Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.02,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.232Z"),
    derivContractId: "290738821148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.02,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738821148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 3,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.02,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:46.648Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 3 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.02,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.232Z"),
    derivContractId: "290738821148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.02,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738821148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 3,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.02,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:46.661Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.24,"buy_price":1.71,"', WasClean: true. Duration: 552ms.
2025-08-11T13:20:47.148Z [info] [TradeAction/SafeMode/Batch1] Trade 4/5 - Entry Price: 3710.53
2025-08-11T13:20:47.148Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:47.148Z
2025-08-11T13:20:47.256Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 107ms. Authorizing...
2025-08-11T13:20:47.256Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:47.366Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:47.366Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:47.366Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:47.420Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ee3ef01e-8c18-853e-1b85-93538b42d2a3, Proposal Spot: 3710.11. Buying contract...
2025-08-11T13:20:47.420Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ee3ef01e-8c18-853e-1b85-93538b42d2a3
2025-08-11T13:20:47.420Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ee3ef01e-8c18-853e-1b85-93538b42d2a3","price":1.71}
2025-08-11T13:20:47.507Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9724.53,"buy_price":1.71,"contract_id":290738822668,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918447,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918447_1T","start_time":1754918447,"transaction_id":579255429168}. Duration: 359ms.
2025-08-11T13:20:47.507Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9724.53,"buy_price":1.71,"contract_id":290738822668,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918447,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918447_1T","start_time":1754918447,"transaction_id":579255429168}
2025-08-11T13:20:47.508Z [info] [DerivService/placeTrade] Forgetting subscription ee3ef01e-8c18-853e-1b85-93538b42d2a3 after buy message processed (Error: false).
2025-08-11T13:20:47.510Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.11,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.332Z"),
    derivContractId: "290738822668",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.11,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738822668",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 4,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.11,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:47.510Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 4 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.11,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.332Z"),
    derivContractId: "290738822668",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.11,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738822668",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 4,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.11,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:47.520Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9724.53,"buy_price":1.71,"', WasClean: true. Duration: 372ms.
2025-08-11T13:20:48.011Z [info] [TradeAction/SafeMode/Batch1] Trade 5/5 - Entry Price: 3710.53
2025-08-11T13:20:48.011Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T13:20:48.011Z
2025-08-11T13:20:48.128Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 117ms. Authorizing...
2025-08-11T13:20:48.129Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T13:20:48.344Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T13:20:48.344Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T13:20:48.344Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.71,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T13:20:48.393Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 3435001c-65e0-5d27-20ce-ff9e3a7825a6, Proposal Spot: 3710.25. Buying contract...
2025-08-11T13:20:48.393Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 3435001c-65e0-5d27-20ce-ff9e3a7825a6
2025-08-11T13:20:48.393Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"3435001c-65e0-5d27-20ce-ff9e3a7825a6","price":1.71}
2025-08-11T13:20:48.508Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.13,"buy_price":1.71,"contract_id":290738823568,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918448,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918448_1T","start_time":1754918448,"transaction_id":579255430828}. Duration: 496ms.
2025-08-11T13:20:48.508Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.13,"buy_price":1.71,"contract_id":290738823568,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 1 ticks.","payout":3.31,"purchase_time":1754918448,"shortcode":"DIGITEVEN_1HZ75V_3.31_1754918448_1T","start_time":1754918448,"transaction_id":579255430828}
2025-08-11T13:20:48.508Z [info] [DerivService/placeTrade] Forgetting subscription 3435001c-65e0-5d27-20ce-ff9e3a7825a6 after buy message processed (Error: false).
2025-08-11T13:20:48.512Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.25,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.432Z"),
    derivContractId: "290738823568",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.25,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738823568",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 5,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.25,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:48.512Z [error] [TradeAction/SafeMode/Batch1] ❌ Trade 5 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    type: "DigitsEvenOdd (DIGITEVEN)",
    ~~~~
    amount: 1.71,
    price: 3710.25,
    totalValue: 1.71,
    status: "OPEN",
    openTime: new Date("2025-08-11T13:20:44.432Z"),
    derivContractId: "290738823568",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    tradeType: "DigitsEvenOdd",
    entryPrice: 3710.25,
    buyPrice: 1.71,
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITEVEN",
      derivContractId: "290738823568",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITEVEN",
        reasoning: "Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
        currentDigit: 0,
        consecutiveCount: 7,
        patternType: "even_after_odds"
      },
      executionMode: "safe",
      batchNumber: 1,
      batchPosition: 5,
      reasoning: "SAFE MANUAL Batch 1: Manual pattern monitoring detected: 7 consecutive odd digits followed by even digit 0",
      isPaperTrade: true,
      entryPrice: 3710.25,
      buyPrice: 1.71
    },
?   id?: String,
?   derivLongcode?: String | Null,
?   derivShortcode?: String | Null,
?   derivBuyPrice?: Float | Null,
?   derivPayout?: Float | Null,
?   derivPurchaseTime?: BigInt | Null,
?   derivSellPrice?: Float | Null,
?   derivSellTime?: BigInt | Null,
?   derivContractType?: String | Null,
?   derivUnderlyingSymbol?: String | Null,
?   derivDurationType?: String | Null,
?   derivAppId?: Int | Null,
?   derivTransactionId?: String | Null
  }
}

Unknown argument `type`. Available options are marked with ?.
2025-08-11T13:20:48.512Z [info] [TradeAction/SafeMode/Batch1] Batch completed: 0/5 successful
2025-08-11T13:20:48.512Z [info] [TradeAction/SafeMode] ⏳ Waiting for second favorable tick for remaining 2 trades
2025-08-11T13:20:48.520Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.13,"buy_price":1.71,"', WasClean: true. Duration: 509ms.