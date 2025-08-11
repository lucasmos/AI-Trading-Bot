2025-08-11T19:04:53.143Z [info] [DerivService Client-Side Check] Initial process.env.NEXT_PUBLIC_DERIV_WS_URL: wss://ws.derivws.com/websockets/v3
2025-08-11T19:04:53.143Z [info] [DerivService Client-Side Check] Initial process.env.NEXT_PUBLIC_DERIV_APP_ID: 80447
2025-08-11T19:04:53.143Z [info] [DerivService Client-Side Check] Constructed DERIV_API_URL at module scope: wss://ws.derivws.com/websockets/v3?app_id=80447
2025-08-11T19:04:53.350Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 75 (1s) Index
2025-08-11T19:04:53.350Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 13, Execution Mode: turbo, Bulk Trades: 7, Account: demo, Strategy: Odd
2025-08-11T19:04:53.350Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-11T19:04:53.350Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-11T19:04:53.350Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
  currentDigit: 9,
  consecutiveCount: 3,
  patternType: 'odd_after_evens'
}
2025-08-11T19:04:53.350Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 75 (1s) Index -> 1HZ75V
2025-08-11T19:04:53.560Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-11T19:04:53.672Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-11T19:04:54.062Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-11T19:04:54.084Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-11T19:04:54.085Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 75 (1s) Index: 3715.03
2025-08-11T19:04:54.085Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-11T19:04:54.085Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [8, 0, 3, 0, 3, 0, 0, 8, 9, 3]
2025-08-11T19:04:54.085Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-11T19:04:54.085Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITODD',
  reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
  currentDigit: 9,
  consecutiveCount: 3,
  patternType: 'odd_after_evens'
}
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 3, Current Digit: 9
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 13, Bulk Trades: 7, Stake Per Trade: 1.86
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 7 trades simultaneously with identical entry/exit prices
2025-08-11T19:04:54.086Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 7 trades, executing exactly 7 trades
2025-08-11T19:04:54.086Z [info] [TradeAction/TurboMode] 🚀 Executing 7 trades simultaneously
2025-08-11T19:04:54.086Z [info] [TradeAction/TurboMode] Shared Price Point: 3715.03 (Entry = Exit for all trades)
2025-08-11T19:04:54.086Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-11T19:04:54.086Z [info] [TradeAction/TurboMode] Trade 1/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.087Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.086Z
2025-08-11T19:04:54.089Z [info] [TradeAction/TurboMode] Trade 2/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.089Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.089Z
2025-08-11T19:04:54.091Z [info] [TradeAction/TurboMode] Trade 3/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.091Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.091Z
2025-08-11T19:04:54.098Z [info] [TradeAction/TurboMode] Trade 4/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.098Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.092Z
2025-08-11T19:04:54.098Z [info] [TradeAction/TurboMode] Trade 5/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.098Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.094Z
2025-08-11T19:04:54.098Z [info] [TradeAction/TurboMode] Trade 6/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.098Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.095Z
2025-08-11T19:04:54.098Z [info] [TradeAction/TurboMode] Trade 7/7 - Entry/Exit Price: 3715.03
2025-08-11T19:04:54.098Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-11T19:04:54.096Z
2025-08-11T19:04:54.101Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-11T19:04:54.220Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 125ms. Authorizing...
2025-08-11T19:04:54.220Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.223Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 136ms. Authorizing...
2025-08-11T19:04:54.223Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.249Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 153ms. Authorizing...
2025-08-11T19:04:54.249Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.263Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 174ms. Authorizing...
2025-08-11T19:04:54.264Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.280Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 188ms. Authorizing...
2025-08-11T19:04:54.280Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.284Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 188ms. Authorizing...
2025-08-11T19:04:54.284Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.292Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 199ms. Authorizing...
2025-08-11T19:04:54.292Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-11T19:04:54.334Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.334Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.334Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.337Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.337Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.337Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.372Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.372Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.372Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.398Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ddced5a5-a303-5860-95c0-59d6c210d247, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.398Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ddced5a5-a303-5860-95c0-59d6c210d247
2025-08-11T19:04:54.398Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ddced5a5-a303-5860-95c0-59d6c210d247","price":1.86}
2025-08-11T19:04:54.401Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.401Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.401Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.418Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 996d14c5-0a1e-a5d8-01ad-f9909b362e73, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.418Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 996d14c5-0a1e-a5d8-01ad-f9909b362e73
2025-08-11T19:04:54.418Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"996d14c5-0a1e-a5d8-01ad-f9909b362e73","price":1.86}
2025-08-11T19:04:54.427Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 368fbe4a-9c47-8097-a549-d862f8e79395, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.427Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 368fbe4a-9c47-8097-a549-d862f8e79395
2025-08-11T19:04:54.427Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"368fbe4a-9c47-8097-a549-d862f8e79395","price":1.86}
2025-08-11T19:04:54.434Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.434Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.435Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.437Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.437Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.437Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.440Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-11T19:04:54.440Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-11T19:04:54.440Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.86,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ75V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-11T19:04:54.477Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 7ef84d22-c7fc-d9e5-200c-f4dd1c139212, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.477Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 7ef84d22-c7fc-d9e5-200c-f4dd1c139212
2025-08-11T19:04:54.477Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"7ef84d22-c7fc-d9e5-200c-f4dd1c139212","price":1.86}
2025-08-11T19:04:54.485Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 7055f524-50d9-2219-9d05-0f0a1af267e6, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.485Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 7055f524-50d9-2219-9d05-0f0a1af267e6
2025-08-11T19:04:54.485Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"7055f524-50d9-2219-9d05-0f0a1af267e6","price":1.86}
2025-08-11T19:04:54.485Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 4f519916-e4c1-5940-17f4-7a250b16132c, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.486Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 4f519916-e4c1-5940-17f4-7a250b16132c
2025-08-11T19:04:54.486Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"4f519916-e4c1-5940-17f4-7a250b16132c","price":1.86}
2025-08-11T19:04:54.486Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 806aa385-e175-adaf-1fa9-01f447f549c9, Proposal Spot: 3715.74. Buying contract...
2025-08-11T19:04:54.486Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 806aa385-e175-adaf-1fa9-01f447f549c9
2025-08-11T19:04:54.486Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"806aa385-e175-adaf-1fa9-01f447f549c9","price":1.86}
2025-08-11T19:04:54.518Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9731.68,"buy_price":1.86,"contract_id":290769704688,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930728}. Duration: 428ms.
2025-08-11T19:04:54.518Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9731.68,"buy_price":1.86,"contract_id":290769704688,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930728}
2025-08-11T19:04:54.518Z [info] [DerivService/placeTrade] Forgetting subscription 996d14c5-0a1e-a5d8-01ad-f9909b362e73 after buy message processed (Error: false).
2025-08-11T19:04:54.531Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9731.68,"buy_price":1.86,"', WasClean: true. Duration: 441ms.
2025-08-11T19:04:54.536Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9729.82,"buy_price":1.86,"contract_id":290769704728,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930808}. Duration: 442ms.
2025-08-11T19:04:54.537Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9729.82,"buy_price":1.86,"contract_id":290769704728,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930808}
2025-08-11T19:04:54.537Z [info] [DerivService/placeTrade] Forgetting subscription 368fbe4a-9c47-8097-a549-d862f8e79395 after buy message processed (Error: false).
2025-08-11T19:04:54.538Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9733.54,"buy_price":1.86,"contract_id":290769704648,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930588}. Duration: 452ms.
2025-08-11T19:04:54.539Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9733.54,"buy_price":1.86,"contract_id":290769704648,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315930588}
2025-08-11T19:04:54.539Z [info] [DerivService/placeTrade] Forgetting subscription ddced5a5-a303-5860-95c0-59d6c210d247 after buy message processed (Error: false).
2025-08-11T19:04:54.549Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9733.54,"buy_price":1.86,"', WasClean: true. Duration: 463ms.
2025-08-11T19:04:54.573Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9729.82,"buy_price":1.86,"', WasClean: true. Duration: 479ms.
2025-08-11T19:04:54.581Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9727.96,"buy_price":1.86,"contract_id":290769704908,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931148}. Duration: 485ms.
2025-08-11T19:04:54.581Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9727.96,"buy_price":1.86,"contract_id":290769704908,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931148}
2025-08-11T19:04:54.581Z [info] [DerivService/placeTrade] Forgetting subscription 7ef84d22-c7fc-d9e5-200c-f4dd1c139212 after buy message processed (Error: false).
2025-08-11T19:04:54.594Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9727.96,"buy_price":1.86,"', WasClean: true. Duration: 497ms.
2025-08-11T19:04:54.597Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.1,"buy_price":1.86,"contract_id":290769704868,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931228}. Duration: 505ms.
2025-08-11T19:04:54.597Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.1,"buy_price":1.86,"contract_id":290769704868,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931228}
2025-08-11T19:04:54.597Z [info] [DerivService/placeTrade] Forgetting subscription 7055f524-50d9-2219-9d05-0f0a1af267e6 after buy message processed (Error: false).
2025-08-11T19:04:54.598Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9724.24,"buy_price":1.86,"contract_id":290769704928,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931268}. Duration: 507ms.
2025-08-11T19:04:54.598Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9724.24,"buy_price":1.86,"contract_id":290769704928,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931268}
2025-08-11T19:04:54.598Z [info] [DerivService/placeTrade] Forgetting subscription 4f519916-e4c1-5940-17f4-7a250b16132c after buy message processed (Error: false).
2025-08-11T19:04:54.607Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9724.24,"buy_price":1.86,"', WasClean: true. Duration: 515ms.
2025-08-11T19:04:54.608Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9722.38,"buy_price":1.86,"contract_id":290769704948,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931328}. Duration: 512ms.
2025-08-11T19:04:54.608Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9722.38,"buy_price":1.86,"contract_id":290769704948,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.","payout":3.6,"purchase_time":1754939094,"shortcode":"DIGITODD_1HZ75V_3.60_1754939094_1T","start_time":1754939094,"transaction_id":579315931328}
2025-08-11T19:04:54.608Z [info] [DerivService/placeTrade] Forgetting subscription 806aa385-e175-adaf-1fa9-01f447f549c9 after buy message processed (Error: false).
2025-08-11T19:04:54.617Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.1,"buy_price":1.86,"c', WasClean: true. Duration: 525ms.
2025-08-11T19:04:54.623Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9722.38,"buy_price":1.86,"', WasClean: true. Duration: 527ms.
2025-08-11T19:04:55.096Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704688",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704688",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704688",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.096Z [error] [TradeAction/TurboMode] ❌ Trade 2 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704688",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704688",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704688",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.097Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704928",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704928",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704928",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.097Z [error] [TradeAction/TurboMode] ❌ Trade 3 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704928",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704928",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704928",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.098Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704948",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704948",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704948",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.098Z [error] [TradeAction/TurboMode] ❌ Trade 6 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704948",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704948",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704948",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.150Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704648",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704648",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704648",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.150Z [error] [TradeAction/TurboMode] ❌ Trade 1 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704648",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704648",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704648",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.156Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704908",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704908",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704908",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.156Z [error] [TradeAction/TurboMode] ❌ Trade 7 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704908",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704908",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704908",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.162Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704868",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704868",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704868",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.162Z [error] [TradeAction/TurboMode] ❌ Trade 4 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704868",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704868",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704868",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.178Z [info] prisma:error 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704728",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704728",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704728",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.178Z [error] [TradeAction/TurboMode] ❌ Trade 5 failed: 
Invalid `prisma.trade.create()` invocation:

{
  data: {
    userId: "17315277",
    symbol: "1HZ75V",
    status: "OPEN",
    derivContractId: "290769704728",
    derivAccountId: "VRTC13200397",
    accountType: "demo",
    derivLongcode: "Win payout if the last digit of Volatility 75 (1s) Index is odd after 1 ticks.",
    derivShortcode: "DIGITODD_1HZ75V_1.86_1754939094_1T",
    derivBuyPrice: 1.86,
    derivPayout: 3.63,
    derivPurchaseTime: 1754939094n,
    derivSellPrice: null,
    derivSellTime: null,
    derivContractType: "DIGITODD",
    derivUnderlyingSymbol: "1HZ75V",
    derivDurationType: "ticks",
    derivAppId: 80447,
    derivTransactionId: "tx_290769704728",
                        ~~~~~~~~~~~~~~~~~
    metadata: {
      instrument: "Volatility 75 (1s) Index",
      tradeType: "DigitsEvenOdd",
      contractType: "DIGITODD",
      derivContractId: "290769704728",
      patternAnalysis: {
        shouldExecute: true,
        contractType: "DIGITODD",
        reasoning: "Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
        currentDigit: 9,
        consecutiveCount: 3,
        patternType: "odd_after_evens"
      },
      executionMode: "turbo",
      sharedPricePoint: 3715.03,
      reasoning: "TURBO MANUAL: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9",
      isPaperTrade: true,
      entryPrice: 3715.03,
      buyPrice: 1.86,
      duration: 1
    }
  }
}

Invalid value for argument `derivTransactionId`: invalid digit found in string. Expected big integer String.
2025-08-11T19:04:55.179Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 0/7 trades successful
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 0/7
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 7/7
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] 📈 Pattern: odd_after_evens
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] 🔢 USER SETTINGS VALIDATION - Requested: 7 trades, Executed: 7 trades
2025-08-11T19:04:55.179Z [info] [TradeAction/MANUAL_SESSION] ⚡ Manual session completed in ~2-3 seconds (vs ~15 seconds for AI mode)