2025-08-11T11:50:45.090Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: Balance successfully retrieved for VRTC13200397., WasClean: true. Duration: 430ms.
2025-08-11T11:50:45.210Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 100 (1s) Index
2025-08-11T11:50:45.210Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 11, Execution Mode: turbo, Bulk Trades: 4, Account: demo, Strategy: Odd
2025-08-11T11:50:45.210Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-11T11:50:45.210Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-11T11:50:45.210Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5',
  currentDigit: 5,
  consecutiveCount: 5,
  patternType: 'odd_after_evens'
}
2025-08-11T11:50:45.211Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 100 (1s) Index -> 1HZ100V
2025-08-11T11:50:45.365Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-11T11:50:45.477Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-11T11:50:45.874Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-11T11:50:45.897Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 100 (1s) Index: 481.04
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [6, 5, 9, 4, 2, 8, 2, 6, 5, 4]
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5',
  currentDigit: 5,
  consecutiveCount: 5,
  patternType: 'odd_after_evens'
}
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 5, Current Digit: 5
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 11, Bulk Trades: 4, Stake Per Trade: 2.75
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 4 trades simultaneously with identical entry/exit prices
2025-08-11T11:50:45.898Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 4 trades, executing exactly 4 trades
2025-08-11T11:50:45.898Z [info] [TradeAction/TurboMode] 🚀 Executing 4 trades simultaneously
2025-08-11T11:50:45.899Z [info] [TradeAction/TurboMode] Shared Price Point: 481.04 (Entry = Exit for all trades)
2025-08-11T11:50:45.899Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-11T11:50:45.899Z [info] [TradeAction/TurboMode] Trade 1/4 - Entry/Exit Price: 481.04
2025-08-11T11:50:45.899Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-11T11:50:45.899Z
2025-08-11T11:50:45.902Z [info] [TradeAction/TurboMode] Trade 2/4 - Entry/Exit Price: 481.04
2025-08-11T11:50:45.902Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-11T11:50:45.901Z
2025-08-11T11:50:45.903Z [info] [TradeAction/TurboMode] Trade 3/4 - Entry/Exit Price: 481.04
2025-08-11T11:50:45.903Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-11T11:50:45.902Z
2025-08-11T11:50:45.904Z [info] [TradeAction/TurboMode] Trade 4/4 - Entry/Exit Price: 481.04
2025-08-11T11:50:45.904Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-11T11:50:45.903Z
2025-08-11T11:50:45.907Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-11T11:50:45.977Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 77ms. Authorizing...
2025-08-11T11:50:45.977Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T11:50:45.978Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 75ms. Authorizing...
2025-08-11T11:50:45.978Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T11:50:45.981Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 77ms. Authorizing...
2025-08-11T11:50:45.981Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T11:50:45.983Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 81ms. Authorizing...
2025-08-11T11:50:45.983Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T11:50:46.091Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T11:50:46.091Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T11:50:46.091Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2.75,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T11:50:46.092Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T11:50:46.092Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T11:50:46.092Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2.75,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T11:50:46.095Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T11:50:46.095Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T11:50:46.095Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2.75,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T11:50:46.106Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T11:50:46.106Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T11:50:46.106Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2.75,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T11:50:46.131Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 0b68de36-3c95-c1eb-1d09-ddd2c9c8b022, Proposal Spot: 481.04. Buying contract...
2025-08-11T11:50:46.131Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 0b68de36-3c95-c1eb-1d09-ddd2c9c8b022
2025-08-11T11:50:46.131Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"0b68de36-3c95-c1eb-1d09-ddd2c9c8b022","price":2.75}
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: a85222cb-2bac-cd2e-0998-e8a8eca406d8, Proposal Spot: 481.04. Buying contract...
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Stored proposal subscription ID: a85222cb-2bac-cd2e-0998-e8a8eca406d8
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"a85222cb-2bac-cd2e-0998-e8a8eca406d8","price":2.75}
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 87418967-43fc-6e97-e7a8-9bd7c46bec12, Proposal Spot: 481.04. Buying contract...
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 87418967-43fc-6e97-e7a8-9bd7c46bec12
2025-08-11T11:50:46.138Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"87418967-43fc-6e97-e7a8-9bd7c46bec12","price":2.75}
2025-08-11T11:50:46.161Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 62e9e04d-23fc-0ff8-aee9-e7a0bbdd9030, Proposal Spot: 481.04. Buying contract...
2025-08-11T11:50:46.161Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 62e9e04d-23fc-0ff8-aee9-e7a0bbdd9030
2025-08-11T11:50:46.161Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"62e9e04d-23fc-0ff8-aee9-e7a0bbdd9030","price":2.75}
2025-08-11T11:50:46.285Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.09,"buy_price":2.75,"contract_id":290730524088,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674868}. Duration: 382ms.
2025-08-11T11:50:46.285Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.09,"buy_price":2.75,"contract_id":290730524088,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674868}
2025-08-11T11:50:46.285Z [info] [DerivService/placeTrade] Forgetting subscription 0b68de36-3c95-c1eb-1d09-ddd2c9c8b022 after buy message processed (Error: false).
2025-08-11T11:50:46.305Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9717.84,"buy_price":2.75,"contract_id":290730524208,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239675128}. Duration: 404ms.
2025-08-11T11:50:46.305Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9717.84,"buy_price":2.75,"contract_id":290730524208,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239675128}
2025-08-11T11:50:46.305Z [info] [DerivService/placeTrade] Forgetting subscription 62e9e04d-23fc-0ff8-aee9-e7a0bbdd9030 after buy message processed (Error: false).
2025-08-11T11:50:46.312Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9723.34,"buy_price":2.75,"contract_id":290730524108,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674928}. Duration: 408ms.
2025-08-11T11:50:46.312Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9723.34,"buy_price":2.75,"contract_id":290730524108,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674928}
2025-08-11T11:50:46.312Z [info] [DerivService/placeTrade] Forgetting subscription a85222cb-2bac-cd2e-0998-e8a8eca406d8 after buy message processed (Error: false).
2025-08-11T11:50:46.315Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9717.84,"buy_price":2.75,"', WasClean: true. Duration: 415ms.
2025-08-11T11:50:46.321Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.09,"buy_price":2.75,"', WasClean: true. Duration: 418ms.
2025-08-11T11:50:46.326Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9720.59,"buy_price":2.75,"contract_id":290730524148,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674948}. Duration: 424ms.
2025-08-11T11:50:46.326Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9720.59,"buy_price":2.75,"contract_id":290730524148,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":5.32,"purchase_time":1754913046,"shortcode":"DIGITODD_1HZ100V_5.32_1754913046_1T","start_time":1754913046,"transaction_id":579239674948}
2025-08-11T11:50:46.326Z [info] [DerivService/placeTrade] Forgetting subscription 87418967-43fc-6e97-e7a8-9bd7c46bec12 after buy message processed (Error: false).
2025-08-11T11:50:46.333Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9723.34,"buy_price":2.75,"', WasClean: true. Duration: 428ms.
2025-08-11T11:50:46.356Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9720.59,"buy_price":2.75,"', WasClean: true. Duration: 454ms.
2025-08-11T11:50:46.433Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524208",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524208",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524208",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.433Z [error] [TradeAction/TurboMode] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524208",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524208",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524208",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.485Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524108",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524108",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524108",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.485Z [error] [TradeAction/TurboMode] ❌ Trade 4 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524108",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524108",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524108",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.491Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524088",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524088",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524088",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.491Z [error] [TradeAction/TurboMode] ❌ Trade 3 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524088",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524088",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524088",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.493Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524148",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.493Z [error] [TradeAction/TurboMode] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ100V",
    status: "OPEN",
    derivContractId: "290730524148",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ100V_2.75_1754913045_1T",
    derivBuyPrice: 2.75,
    derivPayout: 5.36,
    derivPurchaseTime: 1754913045n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ100V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290730524148",
    metadata: {
    ~~~~~~~~
      instrument: "Volatility 100 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290730524148",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
        currentDigit: 5,
        consecutiveCount: 5,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 481.04,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 5 consecutive even digits followed by odd digit 5",
      isPaperTrade: true,
      entryPrice: 481.04,
      buyPrice: 2.75,
      duration: 1
    },
?   id?: String
  }
}

Unknown argument `metadata`. Available options are marked with ?.
2025-08-11T11:50:46.493Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 0/4 trades successful
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 0/4
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 4/4
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] 📈 Pattern: odd_after_evens
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] 🔢 USER SETTINGS VALIDATION - Requested: 4 trades, Executed: 4 trades
2025-08-11T11:50:46.493Z [info] [TradeAction/MANUAL_SESSION] ⚡ Manual session completed in ~2-3 seconds (vs ~15 seconds for AI mode)