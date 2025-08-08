#ERROR LOG 1

2025-08-07T16:39:00.092Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:39:00.474Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:39:00.920Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T16:39:00.920Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 (1s) Index -> 1HZ100V: 20 ticks
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] Available instruments with data: Volatility 10 Index, Volatility 25 Index, Volatility 50 Index, Volatility 75 Index, Volatility 100 Index, Volatility 10 (1s) Index, Volatility 25 (1s) Index, Volatility 50 (1s) Index, Volatility 75 (1s) Index, Volatility 100 (1s) Index
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] Available API symbols with data: R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] Calling AI for session strategy. TradeType: DigitsEvenOdd, TotalStake: 1.67
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] Using pattern-based strategy: {
shouldTrade: true,
contractType: 'DIGITODD',
reasoning: 'Pattern trigger: 3 consecutive Even digits (4,2,0) followed by Odd digit (9)'
}
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] Pattern-based trades using turbo mode: 1 tick duration
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] AI Session Strategy received. Overall Reasoning: Pattern-based DIGITODD strategy: Pattern trigger: 3 consecutive Even digits (4,2,0) followed by Odd digit (9)
2025-08-07T16:39:00.921Z [info] [TradeAction/Session] AI proposes 1 trades.
2025-08-07T16:39:00.922Z [info] [TradeAction/TickTiming] Turbo mode: Executing all 1 trades immediately with same entry/exit price
2025-08-07T16:39:00.922Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T16:39:00.922Z [warning] Unhandled instrument in getInstrumentDecimalPlaces: undefined. Defaulting to 2 decimal places.
2025-08-07T16:39:00.959Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:39:01.016Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:39:01.118Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:39:01.516Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":1,"end":"latest","style":"ticks"}
2025-08-07T16:39:01.547Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T16:39:01.547Z [info] [TradeAction/TickTiming] Turbo mode: Captured shared price point for undefined: 1073.66
2025-08-07T16:39:01.548Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T16:39:01.548Z [info] [TradeAction/SingleTrade] Processing AI proposed trade for: undefined (Deriv: R_100), Turbo Mode: true
2025-08-07T16:39:01.548Z [error] [TradeAction/SingleTrade] AI proposal for undefined is incomplete. Skipping. {
derivContractType: 'DIGITODD',
stake: 1.67,
duration: 1,
durationUnit: 't',
barrier: undefined,
reasoning: 'Pattern trigger: 3 consecutive Even digits (4,2,0) followed by Odd digit (9) (Trade 1/1, turbo mode)'
}
2025-08-07T16:39:01.548Z [info] [TradeAction/Session] Finished Volatility AI session. Total results processed: 1
2025-08-07T16:39:01.689Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:53.982Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: CR8821305. Code: 1000, Reason: Balance successfully retrieved for CR8821305., WasClean: true. Duration: 435ms.
2025-08-07T16:38:54.048Z [info] [TradeAction/AI_SESSION] Starting AI session. User: 17315277, Account: VRTC13200397, Trade Type: DigitsEvenOdd, Total Stake: 1.67
2025-08-07T16:38:54.048Z [info] [TradeAction/AI_SESSION] Execution Mode: turbo, Bulk Trades: 1, Selected Instrument: Volatility 100 (1s) Index
2025-08-07T16:38:54.048Z [info] [TradeAction/AI_SESSION] Environment: Vercel Serverless, 1s Index: true
2025-08-07T16:38:54.049Z [info] [TradeAction/AI_SESSION] USER SETTINGS VALIDATION - Requested: 1 trades, Mode: turbo, Instrument: Volatility 100 (1s) Index
2025-08-07T16:38:54.049Z [info] [TradeAction/AI_SESSION] CRITICAL FIX: Available volatility indices for data fetching: [
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
2025-08-07T16:38:54.049Z [info] [TradeAction/Session] Processing Volatility 10 Index -> API Symbol: R_10
2025-08-07T16:38:54.049Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 10 Index (1s index: false)
2025-08-07T16:38:54.263Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:54.427Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:54.763Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_10","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T16:38:54.785Z [info] [DerivService/getTicks] Closing WebSocket for R_10. Ticks received successfully
2025-08-07T16:38:54.786Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 Index -> R_10: 25 ticks
2025-08-07T16:38:54.786Z [info] [TradeAction/Session] Processing Volatility 25 Index -> API Symbol: R_25
2025-08-07T16:38:54.786Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 25 Index (1s index: false)
2025-08-07T16:38:54.809Z [info] [DerivService/getTicks] WebSocket connection closed for R_10. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:54.885Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:55.024Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:55.386Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_25","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T16:38:55.413Z [info] [DerivService/getTicks] Closing WebSocket for R_25. Ticks received successfully
2025-08-07T16:38:55.414Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 Index -> R_25: 25 ticks
2025-08-07T16:38:55.414Z [info] [TradeAction/Session] Processing Volatility 50 Index -> API Symbol: R_50
2025-08-07T16:38:55.414Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 50 Index (1s index: false)
2025-08-07T16:38:55.432Z [info] [DerivService/getTicks] WebSocket connection closed for R_25. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:55.494Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:55.595Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:55.995Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_50","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T16:38:56.017Z [info] [DerivService/getTicks] Closing WebSocket for R_50. Ticks received successfully
2025-08-07T16:38:56.017Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 Index -> R_50: 25 ticks
2025-08-07T16:38:56.017Z [info] [TradeAction/Session] Processing Volatility 75 Index -> API Symbol: R_75
2025-08-07T16:38:56.017Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 75 Index (1s index: false)
2025-08-07T16:38:56.027Z [info] [DerivService/getTicks] WebSocket connection closed for R_50. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:56.087Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:56.315Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:56.588Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_75","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T16:38:56.611Z [info] [DerivService/getTicks] Closing WebSocket for R_75. Ticks received successfully
2025-08-07T16:38:56.611Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 Index -> R_75: 25 ticks
2025-08-07T16:38:56.611Z [info] [TradeAction/Session] Processing Volatility 100 Index -> API Symbol: R_100
2025-08-07T16:38:56.611Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 100 Index (1s index: false)
2025-08-07T16:38:56.620Z [info] [DerivService/getTicks] WebSocket connection closed for R_75. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:56.719Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:56.829Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:57.219Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T16:38:57.252Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T16:38:57.253Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 Index -> R_100: 25 ticks
2025-08-07T16:38:57.253Z [info] [TradeAction/Session] Processing Volatility 10 (1s) Index -> API Symbol: 1HZ10V
2025-08-07T16:38:57.253Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 10 (1s) Index (1s index: true)
2025-08-07T16:38:57.262Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:57.332Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:57.425Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:57.833Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ10V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:38:57.854Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ10V. Ticks received successfully
2025-08-07T16:38:57.855Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 (1s) Index -> 1HZ10V: 20 ticks
2025-08-07T16:38:57.855Z [info] [TradeAction/Session] Processing Volatility 25 (1s) Index -> API Symbol: 1HZ25V
2025-08-07T16:38:57.855Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 25 (1s) Index (1s index: true)
2025-08-07T16:38:57.866Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ10V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:57.936Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:58.061Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:58.437Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ25V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:38:58.495Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ25V. Ticks received successfully
2025-08-07T16:38:58.495Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 (1s) Index -> 1HZ25V: 20 ticks
2025-08-07T16:38:58.496Z [info] [TradeAction/Session] Processing Volatility 50 (1s) Index -> API Symbol: 1HZ50V
2025-08-07T16:38:58.496Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 50 (1s) Index (1s index: true)
2025-08-07T16:38:58.509Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ25V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:58.744Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:58.900Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:59.244Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:38:59.262Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T16:38:59.263Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 (1s) Index -> 1HZ50V: 20 ticks
2025-08-07T16:38:59.263Z [info] [TradeAction/Session] Processing Volatility 75 (1s) Index -> API Symbol: 1HZ75V
2025-08-07T16:38:59.263Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 75 (1s) Index (1s index: true)
2025-08-07T16:38:59.276Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:59.358Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:38:59.482Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:38:59.858Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:38:59.876Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-07T16:38:59.876Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 (1s) Index -> 1HZ75V: 20 ticks
2025-08-07T16:38:59.876Z [info] [TradeAction/Session] Processing Volatility 100 (1s) Index -> API Symbol: 1HZ100V
2025-08-07T16:38:59.876Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 100 (1s) Index (1s index: true)
2025-08-07T16:38:59.885Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:38:59.973Z [info] [DerivService/getTicks] Authorizing with provided token.

#ERROR LOG 2
2025-08-07T16:39:01.901Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 100 (1s) Index
2025-08-07T16:39:01.901Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 10, Execution Mode: turbo, Bulk Trades: 6, Account: demo, Strategy: Odd
2025-08-07T16:39:01.901Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-07T16:39:01.901Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:01.902Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:01.902Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 100 (1s) Index -> 1HZ100V
2025-08-07T16:39:01.976Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:39:02.331Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:39:02.477Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:39:02.537Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T16:39:02.537Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 100 (1s) Index: 538.41
2025-08-07T16:39:02.537Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-07T16:39:02.537Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [9, 3, 4, 0, 7, 1, 4, 7, 0, 1]
2025-08-07T16:39:02.537Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 3, Current Digit: 9
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 10, Bulk Trades: 6, Stake Per Trade: 1.67
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 6 trades simultaneously with identical entry/exit prices
2025-08-07T16:39:02.538Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 6 trades, executing exactly 6 trades
2025-08-07T16:39:02.538Z [info] [TradeAction/TurboMode] 🚀 Executing 6 trades simultaneously
2025-08-07T16:39:02.539Z [info] [TradeAction/TurboMode] Shared Price Point: 538.41 (Entry = Exit for all trades)
2025-08-07T16:39:02.539Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-07T16:39:02.539Z [info] [TradeAction/TurboMode] Trade 1/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.540Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.539Z
2025-08-07T16:39:02.542Z [info] [TradeAction/TurboMode] Trade 2/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.542Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.541Z
2025-08-07T16:39:02.543Z [info] [TradeAction/TurboMode] Trade 3/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.543Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.543Z
2025-08-07T16:39:02.545Z [info] [TradeAction/TurboMode] Trade 4/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.545Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.544Z
2025-08-07T16:39:02.546Z [info] [TradeAction/TurboMode] Trade 5/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.546Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.545Z
2025-08-07T16:39:02.547Z [info] [TradeAction/TurboMode] Trade 6/6 - Entry/Exit Price: 538.41
2025-08-07T16:39:02.547Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:02.546Z
2025-08-07T16:39:02.552Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:39:02.610Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 71ms. Authorizing...
2025-08-07T16:39:02.610Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.629Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 83ms. Authorizing...
2025-08-07T16:39:02.629Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.630Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 88ms. Authorizing...
2025-08-07T16:39:02.630Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.637Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 90ms. Authorizing...
2025-08-07T16:39:02.637Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.648Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 104ms. Authorizing...
2025-08-07T16:39:02.648Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.675Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 130ms. Authorizing...
2025-08-07T16:39:02.675Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:02.854Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.854Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.854Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.880Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.880Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.880Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.882Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.882Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.882Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.903Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.903Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.903Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.906Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.906Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.906Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.911Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:02.911Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:02.911Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:02.932Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ae57e3a9-c6f6-5ddd-66fc-654bba8c85bc, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.932Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ae57e3a9-c6f6-5ddd-66fc-654bba8c85bc
2025-08-07T16:39:02.932Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ae57e3a9-c6f6-5ddd-66fc-654bba8c85bc","price":1.67}
2025-08-07T16:39:02.940Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 0ad7b5f8-d93e-e896-22f1-e970805a080a, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.940Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 0ad7b5f8-d93e-e896-22f1-e970805a080a
2025-08-07T16:39:02.940Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"0ad7b5f8-d93e-e896-22f1-e970805a080a","price":1.67}
2025-08-07T16:39:02.943Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 8ae4a188-e209-08df-7601-9fe3a71acbf2, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.943Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 8ae4a188-e209-08df-7601-9fe3a71acbf2
2025-08-07T16:39:02.943Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"8ae4a188-e209-08df-7601-9fe3a71acbf2","price":1.67}
2025-08-07T16:39:02.959Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 56c86b60-1a58-d509-2a9f-ab296c63be7c, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.959Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 56c86b60-1a58-d509-2a9f-ab296c63be7c
2025-08-07T16:39:02.959Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"56c86b60-1a58-d509-2a9f-ab296c63be7c","price":1.67}
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: c48ed693-751c-9ed5-5d21-298828da87e3, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Stored proposal subscription ID: c48ed693-751c-9ed5-5d21-298828da87e3
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"c48ed693-751c-9ed5-5d21-298828da87e3","price":1.67}
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 7959bb1d-d477-19bf-ab0c-021c9684f042, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 7959bb1d-d477-19bf-ab0c-021c9684f042
2025-08-07T16:39:02.971Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"7959bb1d-d477-19bf-ab0c-021c9684f042","price":1.67}
2025-08-07T16:39:03.034Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9721.17,"buy_price":1.67,"contract_id":290358782008,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898668}. Duration: 493ms.
2025-08-07T16:39:03.034Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9721.17,"buy_price":1.67,"contract_id":290358782008,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898668}
2025-08-07T16:39:03.035Z [info] [DerivService/placeTrade] Forgetting subscription 0ad7b5f8-d93e-e896-22f1-e970805a080a after buy message processed (Error: false).
2025-08-07T16:39:03.042Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9719.5,"buy_price":1.67,"contract_id":290358782028,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898708}. Duration: 502ms.
2025-08-07T16:39:03.044Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9719.5,"buy_price":1.67,"contract_id":290358782028,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898708}
2025-08-07T16:39:03.044Z [info] [DerivService/placeTrade] Forgetting subscription ae57e3a9-c6f6-5ddd-66fc-654bba8c85bc after buy message processed (Error: false).
2025-08-07T16:39:03.046Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9717.83,"buy_price":1.67,"contract_id":290358782048,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898748}. Duration: 500ms.
2025-08-07T16:39:03.046Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9717.83,"buy_price":1.67,"contract_id":290358782048,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584742_1T","start_time":1754584742,"transaction_id":578521898748}
2025-08-07T16:39:03.047Z [info] [DerivService/placeTrade] Forgetting subscription 8ae4a188-e209-08df-7601-9fe3a71acbf2 after buy message processed (Error: false).
2025-08-07T16:39:03.052Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9719.5,"buy_price":1.67,"c', WasClean: true. Duration: 513ms.
2025-08-07T16:39:03.055Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9717.83,"buy_price":1.67,"', WasClean: true. Duration: 510ms.
2025-08-07T16:39:03.082Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9721.17,"buy_price":1.67,"', WasClean: true. Duration: 540ms.
2025-08-07T16:39:03.219Z [info] [TradeAction/TurboMode] ✅ Trade 2 executed - Contract ID: 290358782008, DB ID: 1e2d34bf-75e2-4bbc-a63b-35b60024b61f
2025-08-07T16:39:03.219Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782008
2025-08-07T16:39:03.220Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782008, DB trade 1e2d34bf-75e2-4bbc-a63b-35b60024b61f
2025-08-07T16:39:03.234Z [info] [TradeAction/TurboMode] ✅ Trade 5 executed - Contract ID: 290358782048, DB ID: 590ef8d0-de10-43e9-ae04-700caa4b3119
2025-08-07T16:39:03.234Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782048
2025-08-07T16:39:03.234Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782048, DB trade 590ef8d0-de10-43e9-ae04-700caa4b3119
2025-08-07T16:39:03.248Z [info] [TradeAction/TurboMode] ✅ Trade 1 executed - Contract ID: 290358782028, DB ID: e10048ee-33b1-4f16-bb0e-39c81432db91
2025-08-07T16:39:03.248Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782028
2025-08-07T16:39:03.248Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782028, DB trade e10048ee-33b1-4f16-bb0e-39c81432db91
2025-08-07T16:39:03.317Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9716.16,"buy_price":1.67,"contract_id":290358782088,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521898928}. Duration: 771ms.
2025-08-07T16:39:03.317Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9716.16,"buy_price":1.67,"contract_id":290358782088,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584742,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521898928}
2025-08-07T16:39:03.318Z [info] [DerivService/placeTrade] Forgetting subscription 56c86b60-1a58-d509-2a9f-ab296c63be7c after buy message processed (Error: false).
2025-08-07T16:39:03.328Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9716.16,"buy_price":1.67,"', WasClean: true. Duration: 781ms.
2025-08-07T16:39:03.328Z [info] [TradeAction/TurboMode] ✅ Trade 6 executed - Contract ID: 290358782088, DB ID: 0420bbe2-cc0e-468c-bcc9-7b2102e9915f
2025-08-07T16:39:03.328Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782088
2025-08-07T16:39:03.328Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782088, DB trade 0420bbe2-cc0e-468c-bcc9-7b2102e9915f
2025-08-07T16:39:03.329Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9714.49,"buy_price":1.67,"contract_id":290358782148,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584743,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521899148}. Duration: 785ms.
2025-08-07T16:39:03.329Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9714.49,"buy_price":1.67,"contract_id":290358782148,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584743,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521899148}
2025-08-07T16:39:03.329Z [info] [DerivService/placeTrade] Forgetting subscription c48ed693-751c-9ed5-5d21-298828da87e3 after buy message processed (Error: false).
2025-08-07T16:39:03.339Z [info] [TradeAction/TurboMode] ✅ Trade 3 executed - Contract ID: 290358782148, DB ID: 4d57b353-6f5e-4d66-a85b-a99dd8febe89
2025-08-07T16:39:03.339Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782148
2025-08-07T16:39:03.339Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782148, DB trade 4d57b353-6f5e-4d66-a85b-a99dd8febe89
2025-08-07T16:39:03.343Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9712.82,"buy_price":1.67,"contract_id":290358782168,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584743,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521899168}. Duration: 798ms.
2025-08-07T16:39:03.343Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9712.82,"buy_price":1.67,"contract_id":290358782168,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584743,"shortcode":"DIGITODD_1HZ100V_3.23_1754584743_1T","start_time":1754584743,"transaction_id":578521899168}
2025-08-07T16:39:03.343Z [info] [DerivService/placeTrade] Forgetting subscription 7959bb1d-d477-19bf-ab0c-021c9684f042 after buy message processed (Error: false).
2025-08-07T16:39:03.351Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9714.49,"buy_price":1.67,"', WasClean: true. Duration: 808ms.
2025-08-07T16:39:03.355Z [info] [TradeAction/TurboMode] ✅ Trade 4 executed - Contract ID: 290358782168, DB ID: 74a41859-1720-4934-9e76-8ff09ca77aa1
2025-08-07T16:39:03.355Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358782168
2025-08-07T16:39:03.355Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358782168, DB trade 74a41859-1720-4934-9e76-8ff09ca77aa1
2025-08-07T16:39:03.355Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 6/6 trades successful
2025-08-07T16:39:03.355Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-07T16:39:03.355Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 6/6
2025-08-07T16:39:03.355Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 0/6
2025-08-07T16:39:03.355Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-07T16:39:03.356Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-07T16:39:03.363Z [error] ⨯ ReferenceError: patternAnalysis is not defined
at O (.next/server/chunks/6595.js:133:31932) {
digest: '3975946301'
}

#ERROR LOG 3
2025-08-07T16:39:04.707Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9712.82,"buy_price":1.67,"', WasClean: true. Duration: 824ms.
2025-08-07T16:39:04.710Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 100 (1s) Index
2025-08-07T16:39:04.710Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 10, Execution Mode: turbo, Bulk Trades: 6, Account: demo, Strategy: Odd
2025-08-07T16:39:04.711Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-07T16:39:04.711Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:04.711Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:04.711Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 100 (1s) Index -> 1HZ100V
2025-08-07T16:39:04.808Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:39:04.928Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:39:05.309Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:39:05.335Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 100 (1s) Index: 538.33
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [4, 0, 7, 1, 4, 7, 0, 1, 6, 3]
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 3, Current Digit: 9
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 10, Bulk Trades: 6, Stake Per Trade: 1.67
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 6 trades simultaneously with identical entry/exit prices
2025-08-07T16:39:05.336Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 6 trades, executing exactly 6 trades
2025-08-07T16:39:05.336Z [info] [TradeAction/TurboMode] 🚀 Executing 6 trades simultaneously
2025-08-07T16:39:05.336Z [info] [TradeAction/TurboMode] Shared Price Point: 538.33 (Entry = Exit for all trades)
2025-08-07T16:39:05.336Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-07T16:39:05.337Z [info] [TradeAction/TurboMode] Trade 1/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.337Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.336Z
2025-08-07T16:39:05.338Z [info] [TradeAction/TurboMode] Trade 2/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.338Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.337Z
2025-08-07T16:39:05.339Z [info] [TradeAction/TurboMode] Trade 3/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.339Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.339Z
2025-08-07T16:39:05.340Z [info] [TradeAction/TurboMode] Trade 4/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.340Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.340Z
2025-08-07T16:39:05.341Z [info] [TradeAction/TurboMode] Trade 5/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.341Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.341Z
2025-08-07T16:39:05.343Z [info] [TradeAction/TurboMode] Trade 6/6 - Entry/Exit Price: 538.33
2025-08-07T16:39:05.343Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:05.342Z
2025-08-07T16:39:05.353Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:39:05.435Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 93ms. Authorizing...
2025-08-07T16:39:05.435Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.437Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 96ms. Authorizing...
2025-08-07T16:39:05.437Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.441Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 104ms. Authorizing...
2025-08-07T16:39:05.441Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.454Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 111ms. Authorizing...
2025-08-07T16:39:05.454Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.462Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 125ms. Authorizing...
2025-08-07T16:39:05.462Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.470Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 130ms. Authorizing...
2025-08-07T16:39:05.470Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:05.544Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.544Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.545Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.545Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.545Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.545Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.548Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.548Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.548Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.564Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.564Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.564Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.591Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: f2072da4-4506-b75f-3992-143d6d1597f7, Proposal Spot: 538.34. Buying contract...
2025-08-07T16:39:05.591Z [info] [DerivService/placeTrade] Stored proposal subscription ID: f2072da4-4506-b75f-3992-143d6d1597f7
2025-08-07T16:39:05.591Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"f2072da4-4506-b75f-3992-143d6d1597f7","price":1.67}
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:05.598Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:05.600Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ccd909a0-ed0a-471e-bf72-6d6e718673da, Proposal Spot: 538.34. Buying contract...
2025-08-07T16:39:05.600Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ccd909a0-ed0a-471e-bf72-6d6e718673da
2025-08-07T16:39:05.600Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ccd909a0-ed0a-471e-bf72-6d6e718673da","price":1.67}
2025-08-07T16:39:05.605Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: efc915d0-9ade-3ecc-23b6-4298faec2dff, Proposal Spot: 538.34. Buying contract...
2025-08-07T16:39:05.605Z [info] [DerivService/placeTrade] Stored proposal subscription ID: efc915d0-9ade-3ecc-23b6-4298faec2dff
2025-08-07T16:39:05.605Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"efc915d0-9ade-3ecc-23b6-4298faec2dff","price":1.67}
2025-08-07T16:39:05.713Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9719.17,"buy_price":1.67,"contract_id":290358786248,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906868}. Duration: 371ms.
2025-08-07T16:39:05.713Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9719.17,"buy_price":1.67,"contract_id":290358786248,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906868}
2025-08-07T16:39:05.713Z [info] [DerivService/placeTrade] Forgetting subscription efc915d0-9ade-3ecc-23b6-4298faec2dff after buy message processed (Error: false).
2025-08-07T16:39:05.716Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9720.84,"buy_price":1.67,"contract_id":290358786228,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906828}. Duration: 375ms.
2025-08-07T16:39:05.716Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9720.84,"buy_price":1.67,"contract_id":290358786228,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906828}
2025-08-07T16:39:05.716Z [info] [DerivService/placeTrade] Forgetting subscription f2072da4-4506-b75f-3992-143d6d1597f7 after buy message processed (Error: false).
2025-08-07T16:39:05.720Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9717.5,"buy_price":1.67,"contract_id":290358786288,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906928}. Duration: 383ms.
2025-08-07T16:39:05.720Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9717.5,"buy_price":1.67,"contract_id":290358786288,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584745,"shortcode":"DIGITODD_1HZ100V_3.23_1754584745_1T","start_time":1754584745,"transaction_id":578521906928}
2025-08-07T16:39:05.720Z [info] [DerivService/placeTrade] Forgetting subscription ccd909a0-ed0a-471e-bf72-6d6e718673da after buy message processed (Error: false).
2025-08-07T16:39:05.723Z [info] [TradeAction/TurboMode] ✅ Trade 5 executed - Contract ID: 290358786248, DB ID: 484a14a5-124a-48b1-84db-24b12d96cedd
2025-08-07T16:39:05.723Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358786248
2025-08-07T16:39:05.723Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358786248, DB trade 484a14a5-124a-48b1-84db-24b12d96cedd
2025-08-07T16:39:05.724Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9719.17,"buy_price":1.67,"', WasClean: true. Duration: 382ms.
2025-08-07T16:39:05.725Z [info] [TradeAction/TurboMode] ✅ Trade 4 executed - Contract ID: 290358786228, DB ID: dbb7aac7-358d-41cb-9c2b-3f46c2507758
2025-08-07T16:39:05.725Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358786228
2025-08-07T16:39:05.725Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358786228, DB trade dbb7aac7-358d-41cb-9c2b-3f46c2507758
2025-08-07T16:39:05.731Z [info] [TradeAction/TurboMode] ✅ Trade 1 executed - Contract ID: 290358786288, DB ID: 4ad5d251-0ef1-449a-9a88-49318969aa25
2025-08-07T16:39:05.731Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358786288
2025-08-07T16:39:05.731Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358786288, DB trade 4ad5d251-0ef1-449a-9a88-49318969aa25
2025-08-07T16:39:05.731Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9717.5,"buy_price":1.67,"c', WasClean: true. Duration: 395ms.
2025-08-07T16:39:05.732Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9720.84,"buy_price":1.67,"', WasClean: true. Duration: 392ms.
2025-08-07T16:39:06.295Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: b49b29b1-8ab5-855c-f582-0670a16826c3, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:06.295Z [info] [DerivService/placeTrade] Stored proposal subscription ID: b49b29b1-8ab5-855c-f582-0670a16826c3
2025-08-07T16:39:06.295Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"b49b29b1-8ab5-855c-f582-0670a16826c3","price":1.67}
2025-08-07T16:39:06.324Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 7fbefe71-10c5-39d9-49ea-f8673b386b52, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:06.324Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 7fbefe71-10c5-39d9-49ea-f8673b386b52
2025-08-07T16:39:06.324Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"7fbefe71-10c5-39d9-49ea-f8673b386b52","price":1.67}
2025-08-07T16:39:06.377Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: bbf5f3a8-7b68-e368-3156-15206fd98128, Proposal Spot: 538.41. Buying contract...
2025-08-07T16:39:06.377Z [info] [DerivService/placeTrade] Stored proposal subscription ID: bbf5f3a8-7b68-e368-3156-15206fd98128
2025-08-07T16:39:06.377Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"bbf5f3a8-7b68-e368-3156-15206fd98128","price":1.67}
2025-08-07T16:39:06.427Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9715.83,"buy_price":1.67,"contract_id":290358787008,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908508}. Duration: 1088ms.
2025-08-07T16:39:06.427Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9715.83,"buy_price":1.67,"contract_id":290358787008,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908508}
2025-08-07T16:39:06.427Z [info] [DerivService/placeTrade] Forgetting subscription 7fbefe71-10c5-39d9-49ea-f8673b386b52 after buy message processed (Error: false).
2025-08-07T16:39:06.438Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9715.83,"buy_price":1.67,"', WasClean: true. Duration: 1100ms.
2025-08-07T16:39:06.438Z [info] [TradeAction/TurboMode] ✅ Trade 2 executed - Contract ID: 290358787008, DB ID: 30f8e917-0a9a-4e3e-a5e5-c8f13ffdd8da
2025-08-07T16:39:06.438Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358787008
2025-08-07T16:39:06.438Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358787008, DB trade 30f8e917-0a9a-4e3e-a5e5-c8f13ffdd8da
2025-08-07T16:39:06.439Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9714.16,"buy_price":1.67,"contract_id":290358787028,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908528}. Duration: 1096ms.
2025-08-07T16:39:06.439Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9714.16,"buy_price":1.67,"contract_id":290358787028,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908528}
2025-08-07T16:39:06.439Z [info] [DerivService/placeTrade] Forgetting subscription b49b29b1-8ab5-855c-f582-0670a16826c3 after buy message processed (Error: false).
2025-08-07T16:39:06.450Z [info] [TradeAction/TurboMode] ✅ Trade 6 executed - Contract ID: 290358787028, DB ID: 385e2e99-b268-49f1-b534-92ed28a52e81
2025-08-07T16:39:06.450Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358787028
2025-08-07T16:39:06.450Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358787028, DB trade 385e2e99-b268-49f1-b534-92ed28a52e81
2025-08-07T16:39:06.453Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9714.16,"buy_price":1.67,"', WasClean: true. Duration: 1110ms.
2025-08-07T16:39:06.477Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9712.49,"buy_price":1.67,"contract_id":290358787108,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908648}. Duration: 1137ms.
2025-08-07T16:39:06.477Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9712.49,"buy_price":1.67,"contract_id":290358787108,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584746,"shortcode":"DIGITODD_1HZ100V_3.23_1754584746_1T","start_time":1754584746,"transaction_id":578521908648}
2025-08-07T16:39:06.477Z [info] [DerivService/placeTrade] Forgetting subscription bbf5f3a8-7b68-e368-3156-15206fd98128 after buy message processed (Error: false).
2025-08-07T16:39:06.487Z [info] [TradeAction/TurboMode] ✅ Trade 3 executed - Contract ID: 290358787108, DB ID: c89df61e-8b2f-4782-b316-fb5091fcc551
2025-08-07T16:39:06.487Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358787108
2025-08-07T16:39:06.487Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358787108, DB trade c89df61e-8b2f-4782-b316-fb5091fcc551
2025-08-07T16:39:06.487Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 6/6 trades successful
2025-08-07T16:39:06.488Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-07T16:39:06.488Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 6/6
2025-08-07T16:39:06.488Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 0/6
2025-08-07T16:39:06.488Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-07T16:39:06.488Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-07T16:39:06.490Z [error] ⨯ ReferenceError: patternAnalysis is not defined
at O (.next/server/chunks/6595.js:133:31932) {
digest: '3975946301'
}

#ERROR LOG 4:
2025-08-07T16:39:09.622Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: Balance successfully retrieved for VRTC13200397., WasClean: true. Duration: 753ms.
2025-08-07T16:39:09.622Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for Volatility 100 (1s) Index
2025-08-07T16:39:09.622Z [info] [TradeAction/MANUAL_SESSION] User Settings - Trade Type: DigitsEvenOdd, Total Stake: 10, Execution Mode: turbo, Bulk Trades: 6, Account: demo, Strategy: Odd
2025-08-07T16:39:09.622Z [info] [TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated
2025-08-07T16:39:09.622Z [info] [TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:09.622Z [info] [TradeAction/MANUAL_SESSION] Pre-validated Pattern: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:09.623Z [info] [TradeAction/ManualSession] Fetching data ONLY for selected instrument: Volatility 100 (1s) Index -> 1HZ100V
2025-08-07T16:39:09.691Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T16:39:09.827Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T16:39:10.191Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T16:39:10.324Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T16:39:10.324Z [info] [TradeAction/MANUAL_SESSION] Latest price for Volatility 100 (1s) Index: 538.65
2025-08-07T16:39:10.324Z [info] [TradeAction/MANUAL_SESSION] Fetched 20 ticks for pattern analysis
2025-08-07T16:39:10.324Z [info] [TradeAction/MANUAL_SESSION] Recent digits: [7, 0, 1, 6, 3, 4, 1, 5, 3, 5]
2025-08-07T16:39:10.324Z [info] [TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring
2025-08-07T16:39:10.324Z [info] [TradeAction/MANUAL_SESSION] Pattern Analysis Result: {
shouldExecute: true,
contractType: 'DIGITODD',
reasoning: 'Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9',
currentDigit: 9,
consecutiveCount: 3,
patternType: 'odd_after_evens'
}
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: Manual pattern monitoring detected: 3 consecutive even digits followed by odd digit 9
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: Odd -> Contract Type: DIGITODD
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] Pattern Details - Type: odd_after_evens, Consecutive: 3, Current Digit: 9
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: 10, Bulk Trades: 6, Stake Per Trade: 1.67
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL 6 trades simultaneously with identical entry/exit prices
2025-08-07T16:39:10.325Z [info] [TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested 6 trades, executing exactly 6 trades
2025-08-07T16:39:10.325Z [info] [TradeAction/TurboMode] 🚀 Executing 6 trades simultaneously
2025-08-07T16:39:10.325Z [info] [TradeAction/TurboMode] Shared Price Point: 538.65 (Entry = Exit for all trades)
2025-08-07T16:39:10.325Z [info] [TradeAction/TurboMode] Contract Type: DIGITODD, Pattern: odd_after_evens
2025-08-07T16:39:10.325Z [info] [TradeAction/TurboMode] Trade 1/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.325Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.324Z
2025-08-07T16:39:10.326Z [info] [TradeAction/TurboMode] Trade 2/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.327Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.326Z
2025-08-07T16:39:10.328Z [info] [TradeAction/TurboMode] Trade 3/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.328Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.327Z
2025-08-07T16:39:10.329Z [info] [TradeAction/TurboMode] Trade 4/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.329Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.328Z
2025-08-07T16:39:10.330Z [info] [TradeAction/TurboMode] Trade 5/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.330Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.329Z
2025-08-07T16:39:10.331Z [info] [TradeAction/TurboMode] Trade 6/6 - Entry/Exit Price: 538.65
2025-08-07T16:39:10.331Z [info] [DerivService/placeTrade] Initiated for accountId: VRTC13200397, symbol: 1HZ100V at 2025-08-07T16:39:10.330Z
2025-08-07T16:39:10.335Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T16:39:10.388Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 58ms. Authorizing...
2025-08-07T16:39:10.388Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.399Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 74ms. Authorizing...
2025-08-07T16:39:10.399Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.400Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 71ms. Authorizing...
2025-08-07T16:39:10.400Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.406Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 75ms. Authorizing...
2025-08-07T16:39:10.406Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.422Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 95ms. Authorizing...
2025-08-07T16:39:10.422Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.468Z [info] [DerivService/placeTrade] WebSocket opened for accountId: VRTC13200397. Time to open: 140ms. Authorizing...
2025-08-07T16:39:10.468Z [info] [DerivService/placeTrade] Sending authorize request: {"authorize":"TOKEN_PRESENT"}
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.516Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.521Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.521Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.521Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.524Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.524Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.524Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.528Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.528Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.528Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.563Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: ea0e345f-7b41-e12d-f225-b8ed9399ee84, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.563Z [info] [DerivService/placeTrade] Stored proposal subscription ID: ea0e345f-7b41-e12d-f225-b8ed9399ee84
2025-08-07T16:39:10.563Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"ea0e345f-7b41-e12d-f225-b8ed9399ee84","price":1.67}
2025-08-07T16:39:10.567Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 852f9767-84c2-b140-7f01-7e67a69fafab, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.567Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 852f9767-84c2-b140-7f01-7e67a69fafab
2025-08-07T16:39:10.567Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"852f9767-84c2-b140-7f01-7e67a69fafab","price":1.67}
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 7bb7b06b-71ce-cc21-eafd-9b0584fe311a, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 7bb7b06b-71ce-cc21-eafd-9b0584fe311a
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"7bb7b06b-71ce-cc21-eafd-9b0584fe311a","price":1.67}
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: bd2ac89a-b09b-4271-0431-0fada3a6d8aa, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Stored proposal subscription ID: bd2ac89a-b09b-4271-0431-0fada3a6d8aa
2025-08-07T16:39:10.569Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"bd2ac89a-b09b-4271-0431-0fada3a6d8aa","price":1.67}
2025-08-07T16:39:10.571Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: fd8fd3e6-b185-2fd9-9fe0-23a3bdc92fd7, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.571Z [info] [DerivService/placeTrade] Stored proposal subscription ID: fd8fd3e6-b185-2fd9-9fe0-23a3bdc92fd7
2025-08-07T16:39:10.571Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"fd8fd3e6-b185-2fd9-9fe0-23a3bdc92fd7","price":1.67}
2025-08-07T16:39:10.593Z [info] [DerivService/placeTrade] Authorization successful. Token's current active account: VRTC13200397. Target account for trade: VRTC13200397.
2025-08-07T16:39:10.593Z [info] [DerivService/placeTrade] Session already active on target account VRTC13200397. Proceeding to proposal...
2025-08-07T16:39:10.593Z [info] [DerivService/placeTrade] Sending proposal request: {"proposal":1,"subscribe":1,"amount":1.67,"basis":"stake","contract_type":"DIGITODD","currency":"USD","symbol":"1HZ100V","duration":1,"duration_unit":"t","product_type":"basic"}
2025-08-07T16:39:10.666Z [info] [DerivService/placeTrade] Proposal received for account VRTC13200397. ID: 0a669819-1c0c-cf0c-d6da-f3bb650b7196, Proposal Spot: 538.59. Buying contract...
2025-08-07T16:39:10.666Z [info] [DerivService/placeTrade] Stored proposal subscription ID: 0a669819-1c0c-cf0c-d6da-f3bb650b7196
2025-08-07T16:39:10.666Z [info] [DerivService/placeTrade] Sending buy request for account VRTC13200397: {"buy":"0a669819-1c0c-cf0c-d6da-f3bb650b7196","price":1.67}
2025-08-07T16:39:10.669Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9720.51,"buy_price":1.67,"contract_id":290358795568,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923348}. Duration: 344ms.
2025-08-07T16:39:10.669Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9720.51,"buy_price":1.67,"contract_id":290358795568,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923348}
2025-08-07T16:39:10.669Z [info] [DerivService/placeTrade] Forgetting subscription 7bb7b06b-71ce-cc21-eafd-9b0584fe311a after buy message processed (Error: false).
2025-08-07T16:39:10.678Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9718.84,"buy_price":1.67,"contract_id":290358795588,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923408}. Duration: 347ms.
2025-08-07T16:39:10.678Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9718.84,"buy_price":1.67,"contract_id":290358795588,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923408}
2025-08-07T16:39:10.678Z [info] [DerivService/placeTrade] Forgetting subscription 852f9767-84c2-b140-7f01-7e67a69fafab after buy message processed (Error: false).
2025-08-07T16:39:10.679Z [info] [TradeAction/TurboMode] ✅ Trade 1 executed - Contract ID: 290358795568, DB ID: 812ac435-b4b9-4027-9374-ebacd7387d6e
2025-08-07T16:39:10.679Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795568
2025-08-07T16:39:10.679Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795568, DB trade 812ac435-b4b9-4027-9374-ebacd7387d6e
2025-08-07T16:39:10.680Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9720.51,"buy_price":1.67,"', WasClean: true. Duration: 356ms.
2025-08-07T16:39:10.688Z [info] [TradeAction/TurboMode] ✅ Trade 6 executed - Contract ID: 290358795588, DB ID: b811a7f6-6bb1-4744-a080-2384218f8783
2025-08-07T16:39:10.688Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795588
2025-08-07T16:39:10.688Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795588, DB trade b811a7f6-6bb1-4744-a080-2384218f8783
2025-08-07T16:39:10.688Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9717.17,"buy_price":1.67,"contract_id":290358795608,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923468}. Duration: 359ms.
2025-08-07T16:39:10.688Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9717.17,"buy_price":1.67,"contract_id":290358795608,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923468}
2025-08-07T16:39:10.688Z [info] [DerivService/placeTrade] Forgetting subscription fd8fd3e6-b185-2fd9-9fe0-23a3bdc92fd7 after buy message processed (Error: false).
2025-08-07T16:39:10.691Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9718.84,"buy_price":1.67,"', WasClean: true. Duration: 361ms.
2025-08-07T16:39:10.694Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9715.5,"buy_price":1.67,"contract_id":290358795688,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923608}. Duration: 367ms.
2025-08-07T16:39:10.694Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9715.5,"buy_price":1.67,"contract_id":290358795688,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923608}
2025-08-07T16:39:10.694Z [info] [DerivService/placeTrade] Forgetting subscription bd2ac89a-b09b-4271-0431-0fada3a6d8aa after buy message processed (Error: false).
2025-08-07T16:39:10.698Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9717.17,"buy_price":1.67,"', WasClean: true. Duration: 368ms.
2025-08-07T16:39:10.698Z [info] [TradeAction/TurboMode] ✅ Trade 5 executed - Contract ID: 290358795608, DB ID: 9a328a77-e75e-4080-a581-9a0ebed29db9
2025-08-07T16:39:10.698Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795608
2025-08-07T16:39:10.698Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795608, DB trade 9a328a77-e75e-4080-a581-9a0ebed29db9
2025-08-07T16:39:10.704Z [info] [TradeAction/TurboMode] ✅ Trade 2 executed - Contract ID: 290358795688, DB ID: 00931c66-2311-4a64-81fb-692ba7d75fc5
2025-08-07T16:39:10.704Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795688
2025-08-07T16:39:10.704Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795688, DB trade 00931c66-2311-4a64-81fb-692ba7d75fc5
2025-08-07T16:39:10.705Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9715.5,"buy_price":1.67,"c', WasClean: true. Duration: 378ms.
2025-08-07T16:39:10.707Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9713.83,"buy_price":1.67,"contract_id":290358795648,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923708}. Duration: 378ms.
2025-08-07T16:39:10.707Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9713.83,"buy_price":1.67,"contract_id":290358795648,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521923708}
2025-08-07T16:39:10.707Z [info] [DerivService/placeTrade] Forgetting subscription ea0e345f-7b41-e12d-f225-b8ed9399ee84 after buy message processed (Error: false).
2025-08-07T16:39:10.717Z [info] [DerivService/placeTrade] WebSocket connection closed for accountId: VRTC13200397. Code: 1000, Reason: 'Contract purchased successfully on account VRTC13200397: {"balance_after":9713.83,"buy_price":1.67,"', WasClean: true. Duration: 389ms.
2025-08-07T16:39:10.718Z [info] [TradeAction/TurboMode] ✅ Trade 4 executed - Contract ID: 290358795648, DB ID: 74d47fdd-30e6-4e81-96f6-b4ec8f8face9
2025-08-07T16:39:10.718Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795648
2025-08-07T16:39:10.718Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795648, DB trade 74d47fdd-30e6-4e81-96f6-b4ec8f8face9
2025-08-07T16:39:10.785Z [info] [DerivService/placeTrade] AccountID: VRTC13200397. Contract purchased successfully on account VRTC13200397: {"balance_after":9712.16,"buy_price":1.67,"contract_id":290358795948,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521924008}. Duration: 457ms.
2025-08-07T16:39:10.785Z [info] [DerivService/placeTrade] Closing WebSocket for accountId: VRTC13200397. Original log: Contract purchased successfully on account VRTC13200397: {"balance_after":9712.16,"buy_price":1.67,"contract_id":290358795948,"longcode":"Win payout if the last digit of Volatility 100 (1s) Index is odd after 1 ticks.","payout":3.23,"purchase_time":1754584750,"shortcode":"DIGITODD_1HZ100V_3.23_1754584750_1T","start_time":1754584750,"transaction_id":578521924008}
2025-08-07T16:39:10.785Z [info] [DerivService/placeTrade] Forgetting subscription 0a669819-1c0c-cf0c-d6da-f3bb650b7196 after buy message processed (Error: false).
2025-08-07T16:39:10.795Z [info] [TradeAction/TurboMode] ✅ Trade 3 executed - Contract ID: 290358795948, DB ID: dc2b44d4-db37-4757-80de-97d2f0cdfebb
2025-08-07T16:39:10.795Z [info] [TradeAction/TurboMode] Starting trade monitoring for contract 290358795948
2025-08-07T16:39:10.795Z [info] [TradeMonitoring] Starting enhanced monitoring for contract 290358795948, DB trade dc2b44d4-db37-4757-80de-97d2f0cdfebb
2025-08-07T16:39:10.795Z [info] [TradeAction/TurboMode] 🎯 Turbo execution completed: 6/6 trades successful
2025-08-07T16:39:10.795Z [info] [TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:
2025-08-07T16:39:10.796Z [info] [TradeAction/MANUAL_SESSION] ✅ Successful trades: 6/6
2025-08-07T16:39:10.796Z [info] [TradeAction/MANUAL_SESSION] ❌ Failed trades: 0/6
2025-08-07T16:39:10.796Z [info] [TradeAction/MANUAL_SESSION] 📊 Execution mode: TURBO
2025-08-07T16:39:10.796Z [info] [TradeAction/MANUAL_SESSION] 🎲 Strategy: Odd
2025-08-07T16:39:10.797Z [error] ⨯ ReferenceError: patternAnalysis is not defined
at O (.next/server/chunks/6595.js:133:31932) {
digest: '3975946301'
}