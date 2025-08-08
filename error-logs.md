2025-08-08T07:43:41.870Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: CR8821305. Code: 1000, Reason: Balance successfully retrieved for CR8821305., WasClean: true. Duration: 56970ms.
2025-08-08T07:43:41.876Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 75 (1s) Index
2025-08-08T07:43:41.876Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 10, Execution Mode: safe, Bulk Trades: 6, Account: demo, Strategy: Even
2025-08-08T07:43:41.876Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-08T07:43:41.876Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-08T07:43:41.876Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
  shouldExecute: true,
  contractType: 'DIGITEVEN',
  reasoning: 'Manual pattern monitoring detected: 5 consecutive odd digits followed by even digit 2',
  currentDigit: 2,
  consecutiveCount: 5,
  patternType: 'even_after_odds'
}
2025-08-08T07:43:41.877Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 75 (1s) Index -> 1HZ75V
2025-08-08T07:43:41.950Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-08T07:43:42.048Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-08T07:43:42.451Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-08T07:43:42.476Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 75 (1s) Index: 4132.26
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [2, 9, 7, 9, 7, 3, 7, 0, 2, 6]
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
  shouldExecute: true,
  contractType: 'DIGITEVEN',
  reasoning: 'Manual pattern monitoring detected: 5 consecutive odd digits followed by even digit 2',
  currentDigit: 2,
  consecutiveCount: 5,
  patternType: 'even_after_odds'
}
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 5 consecutive odd digits followed by even digit 2
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Even -> Contract Type: DIGITEVEN
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: even_after_odds, Consecutive: 5, Current Digit: 2
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 10, Bulk Trades: 6, Stake Per Trade: 1.67
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] 🛡️ SAFE MODE: Implementing two-tick execution strategy
2025-08-08T07:43:42.477Z [info] [TradeAction/MANUAL_SESSION] SAFE MODE VALIDATION - User requested 6 trades, executing exactly 6 trades
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode] 🛡️ Implementing two-tick execution strategy for 6 trades
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode] Initial Price Point: 4132.26, Contract Type: DIGITEVEN
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode] Batch distribution: 4 trades on first tick, 2 trades on second tick
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode] 📊 Executing first batch (4 trades) on current favorable tick
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode/Batch1] Executing 4 trades at price 4132.26
2025-08-08T07:43:42.478Z [info] [TradeAction/SafeMode/Batch1] Trade 1/4 - Entry Price: 4132.26
2025-08-08T07:43:42.479Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:42.478Z
2025-08-08T07:43:42.484Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-08T07:43:42.570Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 91ms. Authorizing...
2025-08-08T07:43:42.570Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:42.678Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:42.678Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:42.678Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:42.736Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: e929b606-5568-640a-47b3-2edb3218ebdf, Proposal Spot: 4132.26. Buying contract...
2025-08-08T07:43:42.736Z [info] [DerivService/placeTrade] Stored proposal subscription ID: e929b606-5568-640a-47b3-2edb3218ebdf
2025-08-08T07:43:42.736Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"e929b606-5568-640a-47b3-2edb3218ebdf","price":1.67}
2025-08-08T07:43:42.836Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9729.87,"buy_price":1.67,"contract_id":290415091608,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639022,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639022_5T","start_time":1754639022,"transaction_id":578633033448}. Duration: 357ms.
2025-08-08T07:43:42.836Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9729.87,"buy_price":1.67,"contract_id":290415091608,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639022,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639022_5T","start_time":1754639022,"transaction_id":578633033448}
2025-08-08T07:43:42.836Z [info] [DerivService/placeTrade] Forgetting subscription e929b606-5568-640a-47b3-2edb3218ebdf after buy message processed (Error: false).
2025-08-08T07:43:42.859Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9729.87,"buy_price":1.67,"', WasClean: true. Duration: 380ms.
2025-08-08T07:43:43.550Z [info] [TradeAction/SafeMode/Batch1] ✅ Trade 1 executed - Contract ID: 290415091608, Entry: 4132.26
2025-08-08T07:43:43.550Z [info] [TradeAction/SafeMode/Batch1] Starting trade monitoring for contract 290415091608
2025-08-08T07:43:43.550Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415091608, DB trade 22422ae3-2491-4a1c-b6aa-b55751d28574
2025-08-08T07:43:44.051Z [info] [TradeAction/SafeMode/Batch1] Trade 2/4 - Entry Price: 4132.26
2025-08-08T07:43:44.051Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:44.050Z
2025-08-08T07:43:44.104Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 53ms. Authorizing...
2025-08-08T07:43:44.104Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:44.267Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:44.267Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:44.267Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:44.314Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: e1c042eb-c664-4a36-0bcd-b73f0eccd89a, Proposal Spot: 4133.02. Buying contract...
2025-08-08T07:43:44.314Z [info] [DerivService/placeTrade] Stored proposal subscription ID: e1c042eb-c664-4a36-0bcd-b73f0eccd89a
2025-08-08T07:43:44.314Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"e1c042eb-c664-4a36-0bcd-b73f0eccd89a","price":1.67}
2025-08-08T07:43:44.412Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9728.2,"buy_price":1.67,"contract_id":290415092808,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639024,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639024_5T","start_time":1754639024,"transaction_id":578633036928}. Duration: 361ms.
2025-08-08T07:43:44.412Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9728.2,"buy_price":1.67,"contract_id":290415092808,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639024,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639024_5T","start_time":1754639024,"transaction_id":578633036928}
2025-08-08T07:43:44.412Z [info] [DerivService/placeTrade] Forgetting subscription e1c042eb-c664-4a36-0bcd-b73f0eccd89a after buy message processed (Error: false).
2025-08-08T07:43:44.423Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9728.2,"buy_price":1.67,"c', WasClean: true. Duration: 372ms.
2025-08-08T07:43:44.423Z [info] [TradeAction/SafeMode/Batch1] ✅ Trade 2 executed - Contract ID: 290415092808, Entry: 4133.02
2025-08-08T07:43:44.423Z [info] [TradeAction/SafeMode/Batch1] Starting trade monitoring for contract 290415092808
2025-08-08T07:43:44.423Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415092808, DB trade 0d7347c4-74e1-4ec7-aa3a-651228b3495d
2025-08-08T07:43:44.924Z [info] [TradeAction/SafeMode/Batch1] Trade 3/4 - Entry Price: 4132.26
2025-08-08T07:43:44.924Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:44.924Z
2025-08-08T07:43:44.996Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 71ms. Authorizing...
2025-08-08T07:43:44.996Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:45.099Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:45.099Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:45.099Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:45.203Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 464bda7c-bec1-60dc-c92b-87ef19c25978, Proposal Spot: 4132.27. Buying contract...
2025-08-08T07:43:45.203Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 464bda7c-bec1-60dc-c92b-87ef19c25978
2025-08-08T07:43:45.203Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"464bda7c-bec1-60dc-c92b-87ef19c25978","price":1.67}
2025-08-08T07:43:45.835Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.53,"buy_price":1.67,"contract_id":290415096328,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639025,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639025_5T","start_time":1754639025,"transaction_id":578633041148}. Duration: 911ms.
2025-08-08T07:43:45.835Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.53,"buy_price":1.67,"contract_id":290415096328,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639025,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639025_5T","start_time":1754639025,"transaction_id":578633041148}
2025-08-08T07:43:45.836Z [info] [DerivService/placeTrade] Forgetting subscription 464bda7c-bec1-60dc-c92b-87ef19c25978 after buy message processed (Error: false).
2025-08-08T07:43:45.845Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.53,"buy_price":1.67,"', WasClean: true. Duration: 920ms.
2025-08-08T07:43:45.847Z [info] [TradeAction/SafeMode/Batch1] ✅ Trade 3 executed - Contract ID: 290415096328, Entry: 4132.27
2025-08-08T07:43:45.847Z [info] [TradeAction/SafeMode/Batch1] Starting trade monitoring for contract 290415096328
2025-08-08T07:43:45.847Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415096328, DB trade 7608907e-12c7-42ba-a7b6-43354661f6af
2025-08-08T07:43:46.348Z [info] [TradeAction/SafeMode/Batch1] Trade 4/4 - Entry Price: 4132.26
2025-08-08T07:43:46.348Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:46.347Z
2025-08-08T07:43:46.417Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 69ms. Authorizing...
2025-08-08T07:43:46.417Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:46.553Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:46.553Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:46.553Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:46.614Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 35de40dc-7c93-3091-2f15-45eba25e4806, Proposal Spot: 4131.89. Buying contract...
2025-08-08T07:43:46.614Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 35de40dc-7c93-3091-2f15-45eba25e4806
2025-08-08T07:43:46.614Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"35de40dc-7c93-3091-2f15-45eba25e4806","price":1.67}
2025-08-08T07:43:46.705Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9724.86,"buy_price":1.67,"contract_id":290415097868,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639026,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639026_5T","start_time":1754639026,"transaction_id":578633044128}. Duration: 357ms.
2025-08-08T07:43:46.705Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9724.86,"buy_price":1.67,"contract_id":290415097868,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639026,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639026_5T","start_time":1754639026,"transaction_id":578633044128}
2025-08-08T07:43:46.705Z [info] [DerivService/placeTrade] Forgetting subscription 35de40dc-7c93-3091-2f15-45eba25e4806 after buy message processed (Error: false).
2025-08-08T07:43:46.715Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9724.86,"buy_price":1.67,"', WasClean: true. Duration: 367ms.
2025-08-08T07:43:46.716Z [info] [TradeAction/SafeMode/Batch1] ✅ Trade 4 executed - Contract ID: 290415097868, Entry: 4131.89
2025-08-08T07:43:46.716Z [info] [TradeAction/SafeMode/Batch1] Starting trade monitoring for contract 290415097868
2025-08-08T07:43:46.716Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415097868, DB trade bd04179b-3270-4c2d-9a54-9b0d3388b588
2025-08-08T07:43:46.716Z [info] [TradeAction/SafeMode/Batch1] Batch completed: 4/4 successful
2025-08-08T07:43:46.716Z [info] [TradeAction/SafeMode] ⏳ Waiting for second favorable tick for remaining 2 trades
2025-08-08T07:43:48.767Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-08T07:43:48.907Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-08T07:43:49.268Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":1,"end":"latest","style":"ticks"}
2025-08-08T07:43:49.284Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-08T07:43:49.285Z [info] [TradeAction/SafeMode] 📊 Executing second batch (2 trades) on second tick - Price: 4130.9
2025-08-08T07:43:49.285Z [info] [TradeAction/SafeMode/Batch2] Executing 2 trades at price 4130.9
2025-08-08T07:43:49.285Z [info] [TradeAction/SafeMode/Batch2] Trade 1/2 - Entry Price: 4130.9
2025-08-08T07:43:49.285Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:49.284Z
2025-08-08T07:43:49.294Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-08T07:43:49.365Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 80ms. Authorizing...
2025-08-08T07:43:49.365Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:49.463Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:49.463Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:49.463Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:49.507Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: fed55c5c-4181-4892-3bf1-92fdc0e2e93d, Proposal Spot: 4130.9. Buying contract...
2025-08-08T07:43:49.507Z [info] [DerivService/placeTrade] Stored proposal subscription ID: fed55c5c-4181-4892-3bf1-92fdc0e2e93d
2025-08-08T07:43:49.507Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"fed55c5c-4181-4892-3bf1-92fdc0e2e93d","price":1.67}
2025-08-08T07:43:49.592Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9726.42,"buy_price":1.67,"contract_id":290415100668,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639029,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639029_5T","start_time":1754639029,"transaction_id":578633052168}. Duration: 307ms.
2025-08-08T07:43:49.592Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9726.42,"buy_price":1.67,"contract_id":290415100668,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639029,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639029_5T","start_time":1754639029,"transaction_id":578633052168}
2025-08-08T07:43:49.592Z [info] [DerivService/placeTrade] Forgetting subscription fed55c5c-4181-4892-3bf1-92fdc0e2e93d after buy message processed (Error: false).
2025-08-08T07:43:49.601Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9726.42,"buy_price":1.67,"', WasClean: true. Duration: 316ms.
2025-08-08T07:43:49.604Z [info] [TradeAction/SafeMode/Batch2] ✅ Trade 1 executed - Contract ID: 290415100668, Entry: 4130.9
2025-08-08T07:43:49.604Z [info] [TradeAction/SafeMode/Batch2] Starting trade monitoring for contract 290415100668
2025-08-08T07:43:49.604Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415100668, DB trade 94ee5775-3760-415d-b06e-c15cb4f1bc4a
2025-08-08T07:43:50.105Z [info] [TradeAction/SafeMode/Batch2] Trade 2/2 - Entry Price: 4130.9
2025-08-08T07:43:50.105Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ75V at 2025-08-08T07:43:50.104Z
2025-08-08T07:43:50.162Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 57ms. Authorizing...
2025-08-08T07:43:50.162Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-08T07:43:50.297Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-08T07:43:50.297Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-08T07:43:50.297Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITEVEN","currency":"USD","symbol":"1HZ75V","duration":5,"duration_unit":"t","product_type":"basic"}
2025-08-08T07:43:50.342Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 53686120-7b38-409a-91bd-31a979ce8938, Proposal Spot: 4131.74. Buying contract...
2025-08-08T07:43:50.342Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 53686120-7b38-409a-91bd-31a979ce8938
2025-08-08T07:43:50.342Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"53686120-7b38-409a-91bd-31a979ce8938","price":1.67}
2025-08-08T07:43:50.432Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9724.75,"buy_price":1.67,"contract_id":290415101488,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639030,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639030_5T","start_time":1754639030,"transaction_id":578633053548}. Duration: 327ms.
2025-08-08T07:43:50.432Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9724.75,"buy_price":1.67,"contract_id":290415101488,"longcode":"Win payout if the last digit of Volatility 75 (1s) Index is even after 5 ticks.","payout":3.23,"purchase_time":1754639030,"shortcode":"DIGITEVEN_1HZ75V_3.23_1754639030_5T","start_time":1754639030,"transaction_id":578633053548}
2025-08-08T07:43:50.432Z [info] [DerivService/placeTrade] Forgetting subscription 53686120-7b38-409a-91bd-31a979ce8938 after buy message processed (Error: false).
2025-08-08T07:43:50.442Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9724.75,"buy_price":1.67,"', WasClean: true. Duration: 337ms.
2025-08-08T07:43:50.444Z [info] [TradeAction/SafeMode/Batch2] ✅ Trade 2 executed - Contract ID: 290415101488, Entry: 4131.74
2025-08-08T07:43:50.444Z [info] [TradeAction/SafeMode/Batch2] Starting trade monitoring for contract 290415101488
2025-08-08T07:43:50.444Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290415101488, DB trade d8e3db6a-65e4-429b-a740-4a9f3f50fd85
2025-08-08T07:43:50.444Z [info] [TradeAction/SafeMode/Batch2] Batch completed: 2/2 successful
2025-08-08T07:43:50.444Z [info] [TradeAction/SafeMode] 🎯 Safe mode execution completed: 6/6 trades successful
2025-08-08T07:43:50.444Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-08T07:43:50.444Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 6/6
2025-08-08T07:43:50.445Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 0/6
2025-08-08T07:43:50.445Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: SAFE
2025-08-08T07:43:50.445Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Even
2025-08-08T07:43:50.454Z [error] ⨯ ReferenceError: patternAnalysis is not defined
    at O (.next/server/chunks/6595.js:133:31932) {
  digest: '3975946301'
}