2025-08-07T10:41:07.752Z [info] [DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: CR8821305. Code: 1000, Reason: Balance successfully retrieved for CR8821305., WasClean: true. Duration: 353ms.
2025-08-07T10:41:07.836Z [info] [TradeAction/Session] Starting AI session. User: 17315277, Account: VRTC13200397, Trade Type: DigitsEvenOdd, Total Stake: 1.71
2025-08-07T10:41:07.836Z [info] [TradeAction/Session] Execution Mode: turbo, Bulk Trades: 1, Selected Instrument: Volatility 50 (1s) Index
2025-08-07T10:41:07.836Z [info] [TradeAction/Session] Environment: Vercel Serverless, 1s Index: true
2025-08-07T10:41:07.836Z [info] [TradeAction/Session] CRITICAL FIX: Available volatility indices for data fetching: [
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
2025-08-07T10:41:07.837Z [info] [TradeAction/Session] Processing Volatility 10 Index -> API Symbol: R_10
2025-08-07T10:41:07.837Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 10 Index (1s index: false)
2025-08-07T10:41:07.993Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:08.093Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:08.494Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_10","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:41:08.529Z [info] [DerivService/getTicks] Closing WebSocket for R_10. Ticks received successfully
2025-08-07T10:41:08.529Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 Index -> R_10: 25 ticks
2025-08-07T10:41:08.529Z [info] [TradeAction/Session] Processing Volatility 25 Index -> API Symbol: R_25
2025-08-07T10:41:08.529Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 25 Index (1s index: false)
2025-08-07T10:41:08.538Z [info] [DerivService/getTicks] WebSocket connection closed for R_10. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:08.603Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:08.740Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:09.104Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_25","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:41:09.123Z [info] [DerivService/getTicks] Closing WebSocket for R_25. Ticks received successfully
2025-08-07T10:41:09.124Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 Index -> R_25: 25 ticks
2025-08-07T10:41:09.124Z [info] [TradeAction/Session] Processing Volatility 50 Index -> API Symbol: R_50
2025-08-07T10:41:09.124Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 50 Index (1s index: false)
2025-08-07T10:41:09.134Z [info] [DerivService/getTicks] WebSocket connection closed for R_25. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:09.199Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:09.298Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:09.699Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_50","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:41:09.718Z [info] [DerivService/getTicks] Closing WebSocket for R_50. Ticks received successfully
2025-08-07T10:41:09.718Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 Index -> R_50: 25 ticks
2025-08-07T10:41:09.719Z [info] [TradeAction/Session] Processing Volatility 75 Index -> API Symbol: R_75
2025-08-07T10:41:09.719Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 75 Index (1s index: false)
2025-08-07T10:41:09.725Z [info] [DerivService/getTicks] WebSocket connection closed for R_50. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:09.783Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:09.890Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:10.283Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_75","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:41:10.312Z [info] [DerivService/getTicks] Closing WebSocket for R_75. Ticks received successfully
2025-08-07T10:41:10.312Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 Index -> R_75: 25 ticks
2025-08-07T10:41:10.313Z [info] [TradeAction/Session] Processing Volatility 100 Index -> API Symbol: R_100
2025-08-07T10:41:10.313Z [info] [TradeAction/Session] Fetching 25 ticks for Volatility 100 Index (1s index: false)
2025-08-07T10:41:10.319Z [info] [DerivService/getTicks] WebSocket connection closed for R_75. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:10.387Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:10.524Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:10.887Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":25,"end":"latest","style":"ticks"}
2025-08-07T10:41:10.915Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T10:41:10.915Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 Index -> R_100: 25 ticks
2025-08-07T10:41:10.915Z [info] [TradeAction/Session] Processing Volatility 10 (1s) Index -> API Symbol: 1HZ10V
2025-08-07T10:41:10.915Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 10 (1s) Index (1s index: true)
2025-08-07T10:41:10.929Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:11.010Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:11.122Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:11.510Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ10V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:41:11.546Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ10V. Ticks received successfully
2025-08-07T10:41:11.546Z [info] [TradeAction/Session] Successfully stored data for Volatility 10 (1s) Index -> 1HZ10V: 20 ticks
2025-08-07T10:41:11.546Z [info] [TradeAction/Session] Processing Volatility 25 (1s) Index -> API Symbol: 1HZ25V
2025-08-07T10:41:11.546Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 25 (1s) Index (1s index: true)
2025-08-07T10:41:11.575Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ10V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:11.625Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:11.754Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:12.125Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ25V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:41:12.145Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ25V. Ticks received successfully
2025-08-07T10:41:12.145Z [info] [TradeAction/Session] Successfully stored data for Volatility 25 (1s) Index -> 1HZ25V: 20 ticks
2025-08-07T10:41:12.145Z [info] [TradeAction/Session] Processing Volatility 50 (1s) Index -> API Symbol: 1HZ50V
2025-08-07T10:41:12.146Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 50 (1s) Index (1s index: true)
2025-08-07T10:41:12.156Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ25V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:12.304Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:12.432Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:12.805Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ50V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:41:12.824Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ50V. Ticks received successfully
2025-08-07T10:41:12.825Z [info] [TradeAction/Session] Successfully stored data for Volatility 50 (1s) Index -> 1HZ50V: 20 ticks
2025-08-07T10:41:12.825Z [info] [TradeAction/Session] Processing Volatility 75 (1s) Index -> API Symbol: 1HZ75V
2025-08-07T10:41:12.825Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 75 (1s) Index (1s index: true)
2025-08-07T10:41:12.835Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ50V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:12.877Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:13.034Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:13.378Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ75V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:41:13.403Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ75V. Ticks received successfully
2025-08-07T10:41:13.404Z [info] [TradeAction/Session] Successfully stored data for Volatility 75 (1s) Index -> 1HZ75V: 20 ticks
2025-08-07T10:41:13.404Z [info] [TradeAction/Session] Processing Volatility 100 (1s) Index -> API Symbol: 1HZ100V
2025-08-07T10:41:13.404Z [info] [TradeAction/Session] Fetching 20 ticks for Volatility 100 (1s) Index (1s index: true)
2025-08-07T10:41:13.412Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ75V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:13.523Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:13.804Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:14.023Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"1HZ100V","adjust_start_time":1,"count":20,"end":"latest","style":"ticks"}
2025-08-07T10:41:14.047Z [info] [DerivService/getTicks] Closing WebSocket for 1HZ100V. Ticks received successfully
2025-08-07T10:41:14.047Z [info] [TradeAction/Session] Successfully stored data for Volatility 100 (1s) Index -> 1HZ100V: 20 ticks
2025-08-07T10:41:14.047Z [info] [TradeAction/Session] Available instruments with data: Volatility 10 Index, Volatility 25 Index, Volatility 50 Index, Volatility 75 Index, Volatility 100 Index, Volatility 10 (1s) Index, Volatility 25 (1s) Index, Volatility 50 (1s) Index, Volatility 75 (1s) Index, Volatility 100 (1s) Index
2025-08-07T10:41:14.047Z [info] [TradeAction/Session] Available API symbols with data: R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
2025-08-07T10:41:14.047Z [info] [TradeAction/Session] Calling AI for session strategy. TradeType: DigitsEvenOdd, TotalStake: 1.71
2025-08-07T10:41:14.048Z [info] [TradeAction/Session] Using pattern-based strategy: {
  shouldTrade: true,
  contractType: 'DIGITODD',
  reasoning: 'Pattern trigger: 3 consecutive Even digits (2,8,0) followed by Odd digit (3)'
}
2025-08-07T10:41:14.048Z [info] [TradeAction/Session] Pattern-based trades using turbo mode: 1 tick duration
2025-08-07T10:41:14.048Z [info] [TradeAction/Session] AI Session Strategy received. Overall Reasoning: Pattern-based DIGITODD strategy: Pattern trigger: 3 consecutive Even digits (2,8,0) followed by Odd digit (3)
2025-08-07T10:41:14.048Z [info] [TradeAction/Session] AI proposes 1 trades.
2025-08-07T10:41:14.048Z [info] [TradeAction/TickTiming] Turbo mode: Executing all 1 trades immediately with same entry/exit price
2025-08-07T10:41:14.048Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T10:41:14.048Z [warning] Unhandled instrument in getInstrumentDecimalPlaces: undefined. Defaulting to 2 decimal places.
2025-08-07T10:41:14.060Z [info] [DerivService/getTicks] WebSocket connection closed for 1HZ100V. Code: 1000, Reason: Ticks received successfully, Clean: true
2025-08-07T10:41:14.122Z [info] [DerivService/getTicks] Authorizing with provided token.
2025-08-07T10:41:14.257Z [info] [DerivService/getTicks] Authorization successful/response received.
2025-08-07T10:41:14.623Z [info] [DerivService/getTicks] Sending ticks_history request (style:ticks): {"ticks_history":"R_100","adjust_start_time":1,"count":1,"end":"latest","style":"ticks"}
2025-08-07T10:41:14.646Z [info] [DerivService/getTicks] Closing WebSocket for R_100. Ticks received successfully
2025-08-07T10:41:14.646Z [info] [TradeAction/TickTiming] Turbo mode: Captured shared price point for undefined: 1071.2
2025-08-07T10:41:14.647Z [warning] [instrumentToDerivSymbol] Unknown instrument symbol: undefined. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.
2025-08-07T10:41:14.647Z [info] [TradeAction/SingleTrade] Processing AI proposed trade for: undefined (Deriv: R_100), Turbo Mode: true
2025-08-07T10:41:14.647Z [error] [TradeAction/SingleTrade] AI proposal for undefined is incomplete. Skipping. {
  derivContractType: 'DIGITODD',
  stake: 1.71,
  duration: 1,
  durationUnit: 't',
  barrier: undefined,
  reasoning: 'Pattern trigger: 3 consecutive Even digits (2,8,0) followed by Odd digit (3) (Trade 1/1, turbo mode)'
}
2025-08-07T10:41:14.647Z [info] [TradeAction/Session] Finished Volatility AI session. Total results processed: 1
2025-08-07T10:41:14.952Z [info] [DerivService/getTicks] WebSocket connection closed for R_100. Code: 1000, Reason: Ticks received successfully, Clean: true