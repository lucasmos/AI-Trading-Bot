2025-08-11T19:37:13.983Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: Balance successfully retrieved for VRTC13200397., WasClean: true. Duration: 152391ms.
2025-08-11T19:37:14.043Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 75 (1s) Index
2025-08-11T19:37:14.043Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 10, Execution Mode: turbo, Bulk Trades: 5, Account: demo, Strategy: Odd
2025-08-11T19:37:14.043Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-11T19:37:14.043Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-11T19:37:14.043Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 5',
  currentDigit: 5,
  consecutiveCount: 4,
  patternType: 'odd_after_evens'
}
2025-08-11T19:37:14.044Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 75 (1s) Index -> 1HZ75V
2025-08-11T19:37:14.260Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-11T19:37:14.362Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-11T19:37:14.760Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-11T19:37:14.779Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 75 (1s) Index: 3742.99
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [1, 3, 1, 9, 8, 8, 4, 6, 5, 9]
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 5',
  currentDigit: 5,
  consecutiveCount: 4,
  patternType: 'odd_after_evens'
}
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 4 consecutive even digits followed by odd digit 5
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-11T19:37:14.780Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 4, Current Digit: 5
2025-08-11T19:37:14.781Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 10, Bulk Trades: 5, Stake Per Trade: 2
2025-08-11T19:37:14.781Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 5 trades simultaneously with identical entry/exit prices
2025-08-11T19:37:14.781Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 5 trades, executing exactly 5 trades
2025-08-11T19:37:14.781Z [info] [TradeAction/TurboMode] 🚀 Executing 5 trades simultaneously
2025-08-11T19:37:14.781Z [info] [TradeAction/TurboMode] Shared Price Point: 3742.99 (Entry = Exit for all trades)
2025-08-11T19:37:14.781Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-11T19:37:14.781Z [info] [TradeAction/TurboMode] Trade 1/5 - Entry/Exit Price: 3742.99
2025-08-11T19:37:14.782Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:37:14.781Z
2025-08-11T19:37:14.784Z [info] [TradeAction/TurboMode] Trade 2/5 - Entry/Exit Price: 3742.99
2025-08-11T19:37:14.784Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:37:14.784Z
2025-08-11T19:37:14.786Z [info] [TradeAction/TurboMode] Trade 3/5 - Entry/Exit Price: 3742.99
2025-08-11T19:37:14.786Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:37:14.785Z
2025-08-11T19:37:14.788Z [info] [TradeAction/TurboMode] Trade 4/5 - Entry/Exit Price: 3742.99
2025-08-11T19:37:14.788Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:37:14.787Z
2025-08-11T19:37:14.790Z [info] [TradeAction/TurboMode] Trade 5/5 - Entry/Exit Price: 3742.99
2025-08-11T19:37:14.790Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:37:14.790Z
2025-08-11T19:37:14.799Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-11T19:37:14.853Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 63ms. Authorizing...
2025-08-11T19:37:14.853Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:37:14.870Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 85ms. Authorizing...
2025-08-11T19:37:14.870Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:37:14.871Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 83ms. Authorizing...
2025-08-11T19:37:14.871Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:37:14.873Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 88ms. Authorizing...
2025-08-11T19:37:14.873Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:37:14.884Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 103ms. Authorizing...
2025-08-11T19:37:14.884Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:37:14.970Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:37:14.970Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:37:14.970Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:37:14.988Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:37:14.988Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:37:14.988Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:37:15.004Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:37:15.004Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:37:15.004Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:37:15.009Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:37:15.009Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:37:15.009Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:37:15.034Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: dde8fc37-3757-9a20-bdb1-8b328bedb51c, Proposal Spot: 3742.99. Buying contract...
2025-08-11T19:37:15.034Z [info] [DerivService/placeTrade] Stored proposal subscription ID: dde8fc37-3757-9a20-bdb1-8b328bedb51c
2025-08-11T19:37:15.034Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"dde8fc37-3757-9a20-bdb1-8b328bedb51c","price":2}
2025-08-11T19:37:15.035Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:37:15.035Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:37:15.036Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":2,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 1424aff3-7aa9-2d7a-9f84-c8a214fda9d2, Proposal Spot: 3742.99. Buying contract...
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 1424aff3-7aa9-2d7a-9f84-c8a214fda9d2
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"1424aff3-7aa9-2d7a-9f84-c8a214fda9d2","price":2}
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 74e6b61e-d3ef-2bdb-a45a-6881755f45f8, Proposal Spot: 3742.99. Buying contract...
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 74e6b61e-d3ef-2bdb-a45a-6881755f45f8
2025-08-11T19:37:15.045Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"74e6b61e-d3ef-2bdb-a45a-6881755f45f8","price":2}
2025-08-11T19:37:15.071Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 47309803-9f7e-be96-9804-fb13beeb0b3f, Proposal Spot: 3742.99. Buying contract...
2025-08-11T19:37:15.071Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 47309803-9f7e-be96-9804-fb13beeb0b3f
2025-08-11T19:37:15.071Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"47309803-9f7e-be96-9804-fb13beeb0b3f","price":2}
2025-08-11T19:37:15.101Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 8df4123d-5071-9391-2b64-2c23e98610ee, Proposal Spot: 3742.99. Buying contract...
2025-08-11T19:37:15.101Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 8df4123d-5071-9391-2b64-2c23e98610ee
2025-08-11T19:37:15.101Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"8df4123d-5071-9391-2b64-2c23e98610ee","price":2}
2025-08-11T19:37:15.118Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9720.38,"buy_price":2,"contract_id":290772562288,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581388}. Duration: 333ms.
2025-08-11T19:37:15.118Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9720.38,"buy_price":2,"contract_id":290772562288,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581388}
2025-08-11T19:37:15.118Z [info] [DerivService/placeTrade] Forgetting subscription dde8fc37-3757-9a20-bdb1-8b328bedb51c after buy message processed (Error: false).
2025-08-11T19:37:15.128Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9720.38,"buy_price":2,"con', WasClean: true. Duration: 343ms.
2025-08-11T19:37:15.134Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9718.38,"buy_price":2,"contract_id":290772562328,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581428}. Duration: 345ms.
2025-08-11T19:37:15.134Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9718.38,"buy_price":2,"contract_id":290772562328,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581428}
2025-08-11T19:37:15.134Z [info] [DerivService/placeTrade] Forgetting subscription 74e6b61e-d3ef-2bdb-a45a-6881755f45f8 after buy message processed (Error: false).
2025-08-11T19:37:15.210Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9714.38,"buy_price":2,"contract_id":290772562368,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581488}. Duration: 424ms.
2025-08-11T19:37:15.210Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9714.38,"buy_price":2,"contract_id":290772562368,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581488}
2025-08-11T19:37:15.210Z [info] [DerivService/placeTrade] Forgetting subscription 47309803-9f7e-be96-9804-fb13beeb0b3f after buy message processed (Error: false).
2025-08-11T19:37:15.213Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9716.38,"buy_price":2,"contract_id":290772562348,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581448}. Duration: 423ms.
2025-08-11T19:37:15.213Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9716.38,"buy_price":2,"contract_id":290772562348,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581448}
2025-08-11T19:37:15.213Z [info] [DerivService/placeTrade] Forgetting subscription 1424aff3-7aa9-2d7a-9f84-c8a214fda9d2 after buy message processed (Error: false).
2025-08-11T19:37:15.222Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9714.38,"buy_price":2,"con', WasClean: true. Duration: 436ms.
2025-08-11T19:37:15.227Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9716.38,"buy_price":2,"con', WasClean: true. Duration: 437ms.
2025-08-11T19:37:15.228Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9712.38,"buy_price":2,"contract_id":290772562448,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581548}. Duration: 446ms.
2025-08-11T19:37:15.228Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9712.38,"buy_price":2,"contract_id":290772562448,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.87,"purchase_time":1754941035,"shortcode":"DIGITODD_1HZ75V_3.87_1754941035_1T","start_time":1754941035,"transaction_id":579321581548}
2025-08-11T19:37:15.228Z [info] [DerivService/placeTrade] Forgetting subscription 8df4123d-5071-9391-2b64-2c23e98610ee after buy message processed (Error: false).
2025-08-11T19:37:15.237Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9718.38,"buy_price":2,"con', WasClean: true. Duration: 449ms.
2025-08-11T19:37:15.280Z [info] [TradeAction/TurboMode] ✅ Trade 4 executed - Contract ID: 290772562328, DB ID: 11aa1cdf-43c1-4665-b697-019ab49aa399
2025-08-11T19:37:15.281Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290772562328
2025-08-11T19:37:15.281Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290772562328, DB trade 11aa1cdf-43c1-4665-b697-019ab49aa399
2025-08-11T19:37:15.285Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9712.38,"buy_price":2,"con', WasClean: true. Duration: 504ms.
2025-08-11T19:37:15.317Z [info] [TradeAction/TurboMode] ✅ Trade 5 executed - Contract ID: 290772562348, DB ID: bc7696a7-7195-46c7-8183-a3779aec7acb
2025-08-11T19:37:15.317Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290772562348
2025-08-11T19:37:15.317Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290772562348, DB trade bc7696a7-7195-46c7-8183-a3779aec7acb
2025-08-11T19:37:15.331Z [info] [TradeAction/TurboMode] ✅ Trade 2 executed - Contract ID: 290772562288, DB ID: 41a03358-1dec-4d69-9c2a-9964351a5448
2025-08-11T19:37:15.331Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290772562288
2025-08-11T19:37:15.331Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290772562288, DB trade 41a03358-1dec-4d69-9c2a-9964351a5448
2025-08-11T19:37:15.345Z [info] [TradeAction/TurboMode] ✅ Trade 3 executed - Contract ID: 290772562368, DB ID: f55122f7-643a-4e35-afe4-4e7933b36c44
2025-08-11T19:37:15.345Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290772562368
2025-08-11T19:37:15.345Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290772562368, DB trade f55122f7-643a-4e35-afe4-4e7933b36c44
2025-08-11T19:37:15.348Z [info] [TradeAction/TurboMode] ✅ Trade 1 executed - Contract ID: 290772562448, DB ID: aa314993-5680-4a43-bed3-1143475b1823
2025-08-11T19:37:15.348Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290772562448
2025-08-11T19:37:15.348Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290772562448, DB trade aa314993-5680-4a43-bed3-1143475b1823
2025-08-11T19:37:15.348Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 5/5 trades successful
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 5/5
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 0/5
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] 📈 Pattern: odd_after_evens
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] 🔢 USER SETTINGS VALIDATION - Requested: 5 trades, Executed: 5 trades
2025-08-11T19:37:15.348Z [info] [TradeAction/MANUAL_SESSION] ⚡ Manual session completed in ~2-3 seconds (vs ~15 seconds for AI mode)