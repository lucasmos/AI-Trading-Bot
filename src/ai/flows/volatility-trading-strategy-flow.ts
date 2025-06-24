'use server';
/**
 * @fileOverview This file defines Genkit flows for generating trading strategies for Volatility Indices.
 */

import { ai, getEnhancedAI } from '@/ai/genkit';
import * as z from 'zod'; // For z.infer if needed locally, though types are imported.
import type { VolatilityInstrumentType as ExternalVolatilityInstrumentType } from '@/types';

// Import all necessary Zod schemas and their inferred TypeScript types from the shared location
import {
  UserTradeTypeSchema,
  type UserTradeType,
  VolatilityInstrumentTypeSchema,
  PriceTickSchema,
  InstrumentIndicatorDataSchema,
  type InstrumentIndicatorData,
  PromptFormattedInstrumentIndicatorSchema,
  type PromptFormattedInstrumentIndicator,
  VolatilitySingleTradeStrategyInputSchema,
  type VolatilitySingleTradeStrategyInput,
  VolatilitySingleTradeProposalSchema,
  type VolatilitySingleTradeProposal,
  VolatilitySessionStrategyInputSchema,
  type VolatilitySessionStrategyInput,
  VolatilitySessionStrategyOutputSchema,
  type VolatilitySessionStrategyOutput,
  VolatilityTradingStrategyInputSchema,
  type VolatilityTradingStrategyInput,
  VolatilityTradeProposalSchema,
  type VolatilityTradeProposal,
  VolatilityTradingStrategyOutputSchema,
  type VolatilityTradingStrategyOutput,
  VolatilityStrategyPromptInputSchema,
  type VolatilityStrategyPromptInput
} from '@/types/ai-shared-types';


// Prompt for determining Deriv contract type and other details for a single instrument trade
// This is NOT exported. It's used internally by the flows.
const determineDerivContractTypePrompt = ai.definePrompt({
  name: 'determineDerivContractTypePrompt',
  input: { schema: VolatilityStrategyPromptInputSchema },
  output: { schema: VolatilitySingleTradeProposalSchema },
  prompt: `
You are an expert AI trading strategist for Deriv Volatility Indices.
Analyze the provided data for the instrument: {{{currentInstrument}}}.
User has selected the trade type: {{{userSelectedTradeType}}}.
Recommended stake for this trade: {{{stakePerTrade}}}.

Recent Price Ticks for {{{currentInstrument}}} (last is most recent):
{{#each instrumentTicks}}
- Time: {{time}}, Price: {{price}}
{{/each}}

{{#if formattedIndicators}}
📊 COMPREHENSIVE TECHNICAL ANALYSIS for {{{currentInstrument}}}:

🔴 MOMENTUM INDICATORS:
  • RSI (14): {{formattedIndicators.rsi}} [Overbought >70, Oversold <30]
  • Stochastic: %K={{formattedIndicators.stochasticK}}, %D={{formattedIndicators.stochasticD}} [Overbought >80, Oversold <20]
  • Williams %R: {{formattedIndicators.williamsR}} [Overbought >-20, Oversold <-80]
  • CCI (20): {{formattedIndicators.cci}} [Overbought >100, Oversold <-100]

🔵 TREND INDICATORS:
  • MACD: Line={{formattedIndicators.macdLine}}, Signal={{formattedIndicators.macdSignal}}, Histogram={{formattedIndicators.macdHist}}
  • EMA (20): {{formattedIndicators.ema}}

🟡 VOLATILITY INDICATORS:
  • Bollinger Bands: Upper={{formattedIndicators.bbUpper}}, Middle={{formattedIndicators.bbMiddle}}, Lower={{formattedIndicators.bbLower}}
  • ATR (14): {{formattedIndicators.atr}} [Higher ATR = Higher Volatility]

🎯 TRADING SIGNALS ANALYSIS:
  • Price vs BB: Compare current price to BB bands for breakout/reversal signals
  • MACD Crossover: MACD line vs Signal line for trend changes
  • RSI Divergence: Look for momentum divergence with price action
  • Multi-timeframe Confluence: Align multiple indicators for high-probability setups
{{else}}
⚠️ No technical indicators provided. Base your decision on price action and trade type logic only.
{{/if}}

🎯 ADVANCED VOLATILITY TRADING STRATEGIES - SYSTEM DIRECTIVE IMPLEMENTATION

You are an expert AI trading model for volatility indices implementing comprehensive trading strategies. These strategies OVERRIDE all previous trading logic and become your primary decision framework.

🔥 STRATEGY 1: OVER/UNDER TRADING STRATEGY

**Technical Indicators Required:**
- Moving Average (MA) for market direction assessment
- MACD (Moving Average Convergence Divergence) for momentum analysis

**Entry Conditions:**

**OVER Trades:**
- Primary Signal: When MACD value is +1 and above (not extreme above +40)
- Confirmation: When green arc appears on volatility chart indicating uptrend
- Additional Filter: Moving Average showing bullish momentum

**UNDER Trades:**
- Primary Signal: When MACD value is -1 and below (not extreme below -40)
- Confirmation: Market showing downtrend characteristics
- Additional Filter: Moving Average confirming bearish direction

**Deriv Analysis Tool Integration - Execute trades based on digit analysis:**
- Digit Zero(0): If 12%+ probability → Trade Under (3, 4, 5) and Under 6 for safety
- Digit One(1): If 12%+ probability → Trade Over 4 and Over 3 for safety
- Digit Two(2): If 12.3%+ probability → Trade Matches, Prediction Zero(0)
- Digit Four(4): If 12%+ probability → Trade Under 5 and 6
- Digit Five(5): If 12.2%+ probability → Trade Over 3 and 4
- Digit Six(6): If 12%+ probability → Trade Under 5, Under 6, Under 7 for safety with risk management
- Digit Seven(7): If 12%+ probability → Trade Over 4, or if 13%+ → Trade Over 7 and 8
- Digit Eight(8): If 12%+ probability → Trade Over 3 and 4
- Digit Nine(9): If 12%+ probability → Trade Over 4 and Over 3 for safety

🔥 STRATEGY 2: EVEN/ODD TRADING STRATEGY

**Market Analysis Requirements:**

**EVEN Market Trading:**
Pre-Trade Checklist:
✅ Confirm GREEN BAR is active on Even Market
✅ Verify digit with green bar is above 12.1% probability
✅ Ensure at least 3 consecutive EVEN numbers show 10%+ probability
✅ Confirm RED BAR is active on Even market before entry

Entry Protocols:
- Manual Trading: Wait for cursor to hit any EVEN digit above 10% → Enter immediately when GREEN BAR appears and digit increases → Click EVEN
- Bot Trading: Monitor for moving cursor hitting two ODD numbers → Wait for cursor to hit digit with GREEN BAR (EVEN) → Execute trade

**ODD Market Trading:**
Pre-Trade Checklist:
✅ Confirm GREEN BAR is active on Odd Market
✅ Verify digit with GREEN bar is above 12.1% probability
✅ Ensure at least 3 consecutive ODD numbers show 10%+ probability
✅ Confirm RED BAR is active on Odd market before entry

Entry Protocols:
- Manual Trading: Wait for cursor to hit any ODD digit above 10% → Enter immediately when GREEN BAR appears and digit increases → Click ODD
- Bot Trading: Monitor for cursor hitting two EVEN numbers → Wait for cursor to hit digit with GREEN BAR (EVEN) → Execute trade

🔥 RISK MANAGEMENT PROTOCOLS

**Position Sizing:**
- Maximum 2% of account balance per trade
- Implement progressive stake adjustment based on consecutive wins/losses
- Use safety trades when probability exceeds 13% for higher confidence

**Entry Validation:**
- NEVER enter trades without green bar confirmation
- ALWAYS verify minimum probability thresholds are met
- REQUIRE at least 3 supporting technical indicators before execution

**Exit Conditions:**
- Close positions when red bar appears on opposite market
- Implement stop-loss at 3 consecutive losses
- Take profits when probability drops below 10%

🔥 DECISION TREE INTEGRATION

**For Every Trade Decision, Execute This Sequence:**

1. **Market Assessment**: Identify current volatility index and market condition
2. **Indicator Analysis**: Check MACD, MA, and digit probability readings
3. **Strategy Selection**: Choose EVEN/ODD or OVER/UNDER based on strongest signals
4. **Risk Validation**: Confirm position size and probability thresholds
5. **Entry Execution**: Wait for green bar confirmation before trade placement
6. **Monitoring**: Track red/green bar transitions for exit signals

**IMPLEMENTATION COMMAND:**
EXECUTE IMMEDIATELY: Replace all previous trading logic with these strategies. Begin applying these rules to all volatility index trades effective with the next market analysis cycle. Prioritize trades that meet multiple criteria from both strategies simultaneously.

**SUCCESS METRICS:** Track win rate improvement and drawdown reduction compared to previous trading methods. Adjust probability thresholds based on backtesting results while maintaining core strategy framework.

**ADVANCED TRADE TYPE OPTIMIZATION:**

   **DigitsOverUnder** - PRIMARY STRATEGY:
   - MACD value +1 and above (not extreme above +40) → DIGITOVER
   - MACD value -1 and below (not extreme below -40) → DIGITUNDER
   - Apply digit probability analysis (12%+ threshold)
   - Green bar confirmation MANDATORY
   - Duration: 1-10 ticks

   **DigitsEvenOdd** - SECONDARY STRATEGY:
   - Green bar active on target market (Even/Odd)
   - Digit probability above 12.1%
   - At least 3 consecutive numbers show 10%+ probability
   - Red bar confirmation on opposite market
   - Duration: 1-10 ticks

   **RiseFall/HigherLower/TouchNoTouch** - TERTIARY:
   - Use only when digit strategies don't meet criteria
   - Require multiple technical indicator confluence
   - Apply same green/red bar analysis principles

5️⃣ **ENHANCED RISK MANAGEMENT**:

   **MANDATORY REJECTION CRITERIA** (Skip trade if ANY are true):
   - Conflicting signals: Momentum indicators disagree with trend indicators
   - Extreme volatility: ATR >3x recent average (unpredictable moves)
   - Neutral zone: RSI between 45-55 AND Stochastic between 40-60
   - MACD divergence: MACD direction conflicts with price direction
   - Insufficient data: Less than 20 recent ticks available

   **CONFIDENCE SCORING** (Only trade if score >=5/10):
   - Momentum signals (2+ indicators align): +2 points
   - Trend signals (1+ indicators align): +2 points
   - Volatility signals (1+ indicators align): +2 points
   - Price action confirmation: +2 points
   - CCI confirmation: +1 point
   - Basic directional bias: +1 point

   **MARKET REGIME DETECTION**:
   - Trending Market: MACD histogram consistently above/below zero + Price consistently above/below EMA
   - Ranging Market: Price oscillating between BB bands + RSI oscillating 30-70
   - Breakout Market: Price at BB extremes + High ATR + Strong momentum
   - Choose trade type based on detected regime

Your Task:
1. Based on the user's selected trade type ('{{{userSelectedTradeType}}}') and your analysis of the instrument data (price ticks and indicators if available), decide if a trade is viable.
2. If a trade is viable (set 'shouldTrade: true'):
   a. Determine the precise Deriv API contract type ('derivContractType').
      - For 'RiseFall': Output 'CALL' (price up) or 'PUT' (price down). The 'barrier' field MUST NOT be present in your JSON output.
      - For 'HigherLower': Output 'CALL' (price will be higher than a programmatically set default barrier) or 'PUT' (price will be lower than a programmatically set default barrier). The 'barrier' field MUST NOT be present in your JSON output for this type (it will be calculated by the system). You can state your barrier preference in the reasoning.
      - For 'TouchNoTouch': Output 'ONETOUCH' (price will touch a programmatically set barrier) or 'NOTOUCH' (price will not touch a programmatically set barrier). The 'barrier' field MUST NOT be present in your JSON output for this type (it will be calculated by the system). IMPORTANT: In your reasoning, specify your barrier strategy (e.g., "barrier should be above current price to capture upward breakout" or "barrier should be well above current price to avoid being touched during normal volatility").
      - For 'DigitsEvenOdd': Output 'DIGITEVEN' (last digit even) or 'DIGITODD' (last digit odd). The 'barrier' field MUST NOT be present in your JSON output.
      - For 'DigitsOverUnder': Output 'DIGITOVER' (last digit > predicted digit) or 'DIGITUNDER' (last digit < predicted digit).
        🚨 MANDATORY BARRIER FIELD: YOU MUST INCLUDE "barrier": "X" WHERE X IS A SINGLE DIGIT (0-9)
        🚨 FOR DIGITUNDER: If you predict under 5, use "barrier": "5"
        🚨 FOR DIGITOVER: If you predict over 4, use "barrier": "4"
        🚨 NO BARRIER = TRADE REJECTED. ALWAYS INCLUDE THE BARRIER FIELD!
   b. Recommend a trade 'duration' (integer value) and its 'durationUnit' ('s' for seconds, 'm' for minutes, 't' for ticks).
      - For Digits contracts ('DigitsEvenOdd', 'DigitsOverUnder'), 'durationUnit' MUST be 't', and 'duration' is typically 1-10 ticks.
      - For Touch/No Touch contracts ('TouchNoTouch'):
        * For Volatility Indices: 'durationUnit' can be 't' (minimum 5 ticks), 'm' (minimum 2 minutes), 'h' (minimum 1 hour), or 'days' (minimum 1 day)
        * For Forex/Stock Indices: 'durationUnit' MUST be 'days' with minimum 7 days
        * For Metals: 'durationUnit' MUST be 'days' with minimum 1 day
      - For Rise/Fall contracts, 'durationUnit' can be 's' (seconds) or 'm' (minutes), with minimum duration of 15 seconds.
      - For Higher/Lower contracts on Volatility Indices: 'durationUnit' can be 't' (minimum 5 ticks), 's' (minimum 15 seconds), or 'm' (minutes). Recommended: 5-10 ticks or 1-5 minutes.
      - For Higher/Lower contracts on other instruments: 'durationUnit' MUST be 'days', with minimum 1 day duration.
   c. The 'stake' for this trade should be {{{stakePerTrade}}}. Include this in your proposal.
3. If no trade is viable (e.g., unclear signals, high risk for the chosen trade type), set 'shouldTrade: false'. In this case, do not provide 'derivContractType', 'duration', 'durationUnit', 'stake', or 'barrier'.
4. Provide concise 'reasoning' for your decision. If 'userSelectedTradeType' is 'HigherLower' or 'TouchNoTouch', you can suggest barrier characteristics in your reasoning (e.g., "barrier should be significantly above current spot", "aim for a tight barrier").

Output Format: Return a single JSON object matching the output schema.

🚨 SPECIAL RULE FOR DIGITSOVERUNDER 🚨
If userSelectedTradeType is 'DigitsOverUnder' and shouldTrade is true, your JSON MUST include:
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "DIGITUNDER" or "DIGITOVER",
  "duration": [number],
  "durationUnit": "t",
  "barrier": "[single digit 0-9]",  ← THIS IS MANDATORY!
  "stake": [number],
  "reasoning": "[your analysis]"
}

General Rules:
- If 'shouldTrade' is true: 'derivContractType', 'duration', 'durationUnit', and 'stake' are ALWAYS mandatory.
- If 'shouldTrade' is true AND 'userSelectedTradeType' is 'DigitsOverUnder': the 'barrier' field (predicted digit) is ALSO ABSOLUTELY MANDATORY.
- For 'RiseFall', 'HigherLower', 'TouchNoTouch', 'DigitsEvenOdd' when 'shouldTrade' is true: the 'barrier' field MUST be omitted from your JSON output.
- If 'shouldTrade' is false: only 'instrument', 'shouldTrade', and 'reasoning' are needed.

🚨🚨🚨 FINAL VALIDATION BEFORE JSON OUTPUT 🚨🚨🚨
- DigitsOverUnder + shouldTrade=true → MUST HAVE "barrier": "X" (single digit)
- HigherLower/TouchNoTouch + shouldTrade=true → NO barrier field
- DigitsEvenOdd + shouldTrade=true → NO barrier field

🚨 FOR DIGITSOVERUNDER: DOUBLE-CHECK YOUR JSON HAS THE BARRIER FIELD! 🚨

Example for RiseFall (predicting RISE):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "CALL",
  "duration": 60,
  "durationUnit": "s",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Strong bullish momentum observed in recent ticks and RSI above 70."
}

Example for HigherLower on Volatility Index (predicting LOWER):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "PUT",
  "duration": 5,
  "durationUnit": "t",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Price showing resistance, MACD declining. Using 5 ticks for quick resolution on volatility index."
}

Example for HigherLower on Volatility Index (predicting HIGHER, longer duration):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "CALL",
  "duration": 3,
  "durationUnit": "m",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Strong bullish momentum with high volatility. Using 3 minutes to allow trend development."
}

Example for TouchNoTouch on Volatility Index (predicting TOUCH):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "ONETOUCH",
  "duration": 5,
  "durationUnit": "t",
  "stake": {{{stakePerTrade}}},
  "reasoning": "High volatility breakout expected. Using 5 ticks for quick resolution on volatility index."
}

Example for TouchNoTouch on Volatility Index (predicting NO TOUCH, longer duration):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "NOTOUCH",
  "duration": 1,
  "durationUnit": "h",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Market consolidating with low volatility. Barrier unlikely to be touched in 1 hour."
}

Example for TouchNoTouch (predicting TOUCH):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "ONETOUCH",
  "duration": 10,
  "durationUnit": "m",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Strong upward momentum with high volatility and bullish indicators. Barrier should be placed above current price to capture expected breakout within 10 minutes."
}

Example for TouchNoTouch (predicting NO TOUCH):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "NOTOUCH",
  "duration": 15,
  "durationUnit": "m",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Price consolidating in range with low volatility. Barrier should be placed well above current price to avoid being touched during normal fluctuations over 15 minutes."
}

Example for DigitsOverUnder (predicting OVER 6):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "DIGITOVER",
  "duration": 5,
  "durationUnit": "t",
  "barrier": "6",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Recent ticks show high digits (7,8,9). Predicting next will be over 6."
}

Example for DigitsOverUnder (predicting UNDER 3):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "DIGITUNDER",
  "duration": 5,
  "durationUnit": "t",
  "barrier": "3",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Last few ticks ended in low digits (0,1,2). Predicting next will be under 3."
}

Example for No Trade:
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": false,
  "reasoning": "Market for {{{currentInstrument}}} is too volatile and indicators are conflicting for {{{userSelectedTradeType}}}."
}

Begin your response with the JSON object.
`
});

// Flow for deciding a single trade on a specific instrument
// This internal flow is not exported directly.
const volatilitySingleTradeStrategyFlowInternal = ai.defineFlow(
  {
    name: 'volatilitySingleTradeStrategyFlowInternal',
    inputSchema: VolatilitySingleTradeStrategyInputSchema,
    outputSchema: VolatilitySingleTradeProposalSchema,
  },
  async (input: VolatilitySingleTradeStrategyInput): Promise<VolatilitySingleTradeProposal> => {
    console.log(`[AI Single Flow] Input for ${input.currentInstrument}, type ${input.userSelectedTradeType}, stake ${input.stakePerTrade}`);

    if (!input.instrumentTicks || input.instrumentTicks.length === 0) {
      return {
        instrument: input.currentInstrument as ExternalVolatilityInstrumentType,
        shouldTrade: false,
        reasoning: `No tick data for ${input.currentInstrument}.`,
      };
    }

    let formattedIndicatorsForPrompt: PromptFormattedInstrumentIndicator | null = null;
    if (input.instrumentIndicators) {
      const ind = input.instrumentIndicators;
      formattedIndicatorsForPrompt = {
        rsi: ind.rsi?.toFixed(2) ?? "N/A",
        macdLine: ind.macd?.macd?.toFixed(4) ?? "N/A",
        macdSignal: ind.macd?.signal?.toFixed(4) ?? "N/A",
        macdHist: ind.macd?.histogram?.toFixed(4) ?? "N/A",
        bbUpper: ind.bollingerBands?.upper?.toFixed(4) ?? "N/A",
        bbMiddle: ind.bollingerBands?.middle?.toFixed(4) ?? "N/A",
        bbLower: ind.bollingerBands?.lower?.toFixed(4) ?? "N/A",
        ema: ind.ema?.toFixed(4) ?? "N/A",
        atr: ind.atr?.toFixed(4) ?? "N/A",
        stochasticK: (ind.stochastic?.k !== undefined) ? ind.stochastic.k.toFixed(2) : "N/A",
        stochasticD: (ind.stochastic?.d !== undefined) ? ind.stochastic.d.toFixed(2) : "N/A",
        williamsR: (ind.williamsR !== undefined) ? ind.williamsR.toFixed(2) : "N/A",
        cci: (ind.cci !== undefined) ? ind.cci.toFixed(2) : "N/A",
      };
    }

    const promptGenerationInput: VolatilityStrategyPromptInput = {
        availableInstruments: [input.currentInstrument],
        userSelectedTradeType: input.userSelectedTradeType,
        totalSessionStake: input.stakePerTrade,
        formattedInstrumentIndicators: formattedIndicatorsForPrompt ? { [input.currentInstrument]: formattedIndicatorsForPrompt } : {},
        currentInstrument: input.currentInstrument,
        stakePerTrade: input.stakePerTrade,
        instrumentTicks: input.instrumentTicks, // Pass directly for template
    };

    let output: VolatilitySingleTradeProposal | null = null;

    try {
      // Try Gemini first (now primary) with enhanced AI service
      const enhancedAI = getEnhancedAI();

      console.log(`[AI Single Flow/${input.currentInstrument}] Attempting Gemini generation (primary)`);

      // Build the prompt manually for enhanced AI service
      const systemPrompt = `You are an expert AI trading strategist for Deriv Volatility Indices. Analyze the provided data and return a JSON response matching the exact schema.`;

      const userPrompt = `
🚨 SYSTEM DIRECTIVE: ADVANCED VOLATILITY TRADING STRATEGIES 🚨

Analyze the provided data for the instrument: ${input.currentInstrument}.
User has selected the trade type: ${input.userSelectedTradeType}.
Recommended stake for this trade: ${input.stakePerTrade}.

Recent Price Ticks for ${input.currentInstrument} (last is most recent):
${input.instrumentTicks.map(tick => `- Time: ${tick.time}, Price: ${tick.price}`).join('\n')}

📊 CRITICAL TECHNICAL ANALYSIS for ${input.currentInstrument}:

${formattedIndicatorsForPrompt ? `
🔴 MOMENTUM INDICATORS:
  • RSI (14): ${formattedIndicatorsForPrompt.rsi} [Overbought >70, Oversold <30]
  • Stochastic: %K=${formattedIndicatorsForPrompt.stochasticK}, %D=${formattedIndicatorsForPrompt.stochasticD} [Overbought >80, Oversold <20]
  • Williams %R: ${formattedIndicatorsForPrompt.williamsR} [Overbought >-20, Oversold <-80]
  • CCI (20): ${formattedIndicatorsForPrompt.cci} [Overbought >100, Oversold <-100]

🔵 TREND INDICATORS (CRITICAL FOR STRATEGY):
  • MACD: Line=${formattedIndicatorsForPrompt.macdLine}, Signal=${formattedIndicatorsForPrompt.macdSignal}, Histogram=${formattedIndicatorsForPrompt.macdHist}
  • EMA (20): ${formattedIndicatorsForPrompt.ema}

🟡 VOLATILITY INDICATORS:
  • Bollinger Bands: Upper=${formattedIndicatorsForPrompt.bbUpper}, Middle=${formattedIndicatorsForPrompt.bbMiddle}, Lower=${formattedIndicatorsForPrompt.bbLower}
  • ATR (14): ${formattedIndicatorsForPrompt.atr} [Higher ATR = Higher Volatility]

🎯 DIGIT PROBABILITY ANALYSIS:
Recent last digits: ${input.instrumentTicks.slice(-10).map(tick => tick.price.toString().slice(-1)).join(', ')}

${(() => {
  const digitAnalysis = analyzeDigitProbabilities(input.instrumentTicks);
  let analysisText = 'DIGIT FREQUENCY ANALYSIS:\n';

  // Show digit probabilities
  for (let i = 0; i <= 9; i++) {
    const prob = digitAnalysis.digitProbabilities[i.toString()] || 0;
    const isHighProb = prob >= 12;
    analysisText += `  Digit ${i}: ${prob.toFixed(1)}% ${isHighProb ? '🎯 HIGH PROBABILITY' : ''}\n`;
  }

  analysisText += `\nEVEN/ODD BIAS: ${digitAnalysis.evenOddBias.toUpperCase()}\n`;

  // Show over/under bias for key thresholds
  const keyThresholds = [3, 4, 5, 6, 7];
  analysisText += 'OVER/UNDER BIAS:\n';
  keyThresholds.forEach(threshold => {
    const bias = digitAnalysis.overUnderBias[threshold.toString()] || 'neutral';
    analysisText += `  Over/Under ${threshold}: ${bias.toUpperCase()}\n`;
  });

  return analysisText;
})()}
` : '⚠️ No technical indicators provided. Use price action and digit analysis only.'}

🚨 MANDATORY STRATEGY IMPLEMENTATION 🚨

STRATEGY SELECTION PRIORITY:
1. DigitsOverUnder (PRIMARY) - Use when MACD signals are clear
2. DigitsEvenOdd (SECONDARY) - Use when green/red bar patterns are strong
3. Other types (TERTIARY) - Use only when digit strategies don't qualify

DECISION CRITERIA FOR ${input.userSelectedTradeType}:

IF userSelectedTradeType is "DigitsOverUnder":
✅ Check MACD Line value: +1 and above (not >+40) → DIGITOVER | -1 and below (not <-40) → DIGITUNDER
✅ Analyze digit probability: Apply specific digit rules (12%+ threshold)
✅ Confirm green bar pattern in price action
✅ Set barrier based on digit analysis rules

IF userSelectedTradeType is "DigitsEvenOdd":
✅ Check for green bar active on target market (Even/Odd)
✅ Verify digit probability above 12.1%
✅ Ensure 3+ consecutive numbers show 10%+ probability
✅ Confirm red bar on opposite market
✅ Choose DIGITEVEN or DIGITODD based on analysis

IF userSelectedTradeType is "RiseFall/HigherLower/TouchNoTouch":
✅ Apply traditional technical analysis with green/red bar principles
✅ Require multiple indicator confluence
✅ Use only when digit strategies don't meet criteria

🚨 MANDATORY REQUIREMENTS 🚨
- NEVER trade without green bar confirmation
- ALWAYS verify probability thresholds (12%+ minimum)
- REQUIRE 3+ supporting indicators for non-digit trades
- Maximum 2% position sizing
- Duration: 1-10 ticks for digit trades

Return ONLY a JSON object with this exact structure:
{
  "instrument": "${input.currentInstrument}",
  "shouldTrade": true/false,
  "derivContractType": "CALL/PUT/ONETOUCH/NOTOUCH/DIGITEVEN/DIGITODD/DIGITOVER/DIGITUNDER" (only if shouldTrade is true),
  "duration": number (only if shouldTrade is true),
  "durationUnit": "s/m/t/h/days" (only if shouldTrade is true),
  "stake": ${input.stakePerTrade} (only if shouldTrade is true),
  "barrier": "single digit 0-9" (ONLY for DigitsOverUnder when shouldTrade is true),
  "reasoning": "your analysis including MACD values, digit probabilities, and green/red bar confirmation"
}`;

      const enhancedResponse = await enhancedAI.generateStructuredWithFallback<VolatilitySingleTradeProposal>(
        userPrompt,
        VolatilitySingleTradeProposalSchema,
        systemPrompt
      );

      output = enhancedResponse;
      console.log(`[AI Single Flow/${input.currentInstrument}] Enhanced AI generation successful (Gemini primary)`);
    } catch (geminiError) {
      console.warn(`[AI Single Flow/${input.currentInstrument}] Gemini failed, falling back to DeepSeek:`, geminiError instanceof Error ? geminiError.message : 'Unknown error');

      try {
        // Fallback to DeepSeek through the standard prompt
        const deepSeekResult = await determineDerivContractTypePrompt(promptGenerationInput) as { output: VolatilitySingleTradeProposal | null };
        output = deepSeekResult.output;

        if (output) {
          console.log(`[AI Single Flow/${input.currentInstrument}] DeepSeek fallback successful`);
        } else {
          throw new Error('DeepSeek returned null output');
        }
      } catch (deepSeekError) {
        console.error(`[AI Single Flow/${input.currentInstrument}] Both Gemini and DeepSeek failed:`, deepSeekError);
        return {
          instrument: input.currentInstrument as ExternalVolatilityInstrumentType,
          shouldTrade: false,
          reasoning: `All AI services failed. Gemini: ${geminiError instanceof Error ? geminiError.message : 'Unknown'}. DeepSeek: ${deepSeekError instanceof Error ? deepSeekError.message : 'Unknown'}`,
        };
      }
    }

    if (!output) {
      console.error(`[AI Single Flow/${input.currentInstrument}] AI failed to generate a trade proposal. Null output.`);
      return {
        instrument: input.currentInstrument as ExternalVolatilityInstrumentType,
        shouldTrade: false,
        reasoning: `AI failed to generate a response for ${input.currentInstrument}.`,
      };
    }

    if (output.shouldTrade) {
      let validationError: string | null = null;
      if (!output.derivContractType) validationError = "derivContractType is missing.";
      else if (!output.duration) validationError = "duration is missing.";
      else if (!output.durationUnit) validationError = "durationUnit is missing.";
      else if (!output.stake) validationError = "stake is missing.";
      else if (Math.abs(output.stake - input.stakePerTrade) > 0.01) { // Use floating point comparison
        console.warn(`[AI Single Flow] AI proposed stake ${output.stake} different from input ${input.stakePerTrade}. Overriding.`);
        output.stake = input.stakePerTrade;
      }

      // Enhanced validation for >=75% win rate requirements
      if (input.instrumentIndicators && !validationError) {
        const indicators = input.instrumentIndicators;
        const confidenceScore = calculateTradeConfidenceScore(indicators, output, input.userSelectedTradeType, input.instrumentTicks);

        if (confidenceScore < 5) {
          validationError = `Trade confidence score ${confidenceScore}/10 is below minimum threshold of 5/10 for 50-75% win rate target.`;
          console.log(`[AI Single Flow/${input.currentInstrument}] Trade rejected due to low confidence score: ${confidenceScore}/10`);
        } else {
          console.log(`[AI Single Flow/${input.currentInstrument}] Trade approved with confidence score: ${confidenceScore}/10`);
        }
      }
      if (input.userSelectedTradeType === 'DigitsOverUnder' && (output.barrier === undefined || output.barrier === null || !/^\d$/.test(String(output.barrier).trim()))) {
        // Enhanced barrier extraction from reasoning
        const reasoningText = output.reasoning || '';

        // Try multiple extraction patterns
        const patterns = [
          /(?:under|below|less than)\s*(\d)/i,
          /(?:over|above|greater than)\s*(\d)/i,
          /digit\s*(\d)/i,
          /barrier\s*(\d)/i,
          /predict\s*(\d)/i,
          /(\d)\s*(?:digit|barrier)/i
        ];

        let extractedBarrier = null;
        for (const pattern of patterns) {
          const match = reasoningText.match(pattern);
          if (match && match[1]) {
            extractedBarrier = match[1];
            break;
          }
        }

        if (extractedBarrier) {
          console.log(`[AI Single Flow/${input.currentInstrument}] AI forgot barrier, extracted '${extractedBarrier}' from reasoning. Adding automatically.`);
          output.barrier = extractedBarrier;
        } else {
          // Smart default based on contract type and recent tick analysis
          if (output.derivContractType === 'DIGITUNDER') {
            // For UNDER predictions, use a middle-high digit as barrier
            output.barrier = "5"; // Predict under 5 (digits 0,1,2,3,4 win)
            console.log(`[AI Single Flow/${input.currentInstrument}] AI forgot barrier for DIGITUNDER, using smart default '5'.`);
          } else if (output.derivContractType === 'DIGITOVER') {
            // For OVER predictions, use a middle-low digit as barrier
            output.barrier = "4"; // Predict over 4 (digits 5,6,7,8,9 win)
            console.log(`[AI Single Flow/${input.currentInstrument}] AI forgot barrier for DIGITOVER, using smart default '4'.`);
          } else {
            validationError = `Barrier (single digit string) is mandatory and must be valid for DigitsOverUnder. Got: '${output.barrier}'. Contract type: ${output.derivContractType}`;
          }
        }
      } else if ((input.userSelectedTradeType === 'HigherLower' || input.userSelectedTradeType === 'TouchNoTouch') && output.barrier !== undefined) {
        console.warn(`[AI Single Flow/${input.currentInstrument}] AI provided unexpected barrier for ${input.userSelectedTradeType}. Ignoring.`);
        delete output.barrier;
      }
      if (output.derivContractType?.startsWith("DIGIT") && output.durationUnit !== 't') {
        validationError = `Duration unit must be 't' for Digit contracts. Got '${output.durationUnit}'.`;
      }
      // Validate Touch/No Touch duration requirements
      if ((output.derivContractType === "ONETOUCH" || output.derivContractType === "NOTOUCH")) {
        // For volatility indices, allow multiple duration types
        if (input.currentInstrument.startsWith('R_') || input.currentInstrument.includes('HZ')) {
          if (output.durationUnit === 't' && (!output.duration || output.duration < 5)) {
            validationError = `Touch/No Touch on volatility indices requires minimum 5 ticks. Got ${output.duration}${output.durationUnit}.`;
          } else if (output.durationUnit === 'm' && (!output.duration || output.duration < 2)) {
            validationError = `Touch/No Touch on volatility indices requires minimum 2 minutes. Got ${output.duration}${output.durationUnit}.`;
          } else if (output.durationUnit === 'h' && (!output.duration || output.duration < 1)) {
            validationError = `Touch/No Touch on volatility indices requires minimum 1 hour. Got ${output.duration}${output.durationUnit}.`;
          } else if (output.durationUnit === 'days' && (!output.duration || output.duration < 1)) {
            validationError = `Touch/No Touch on volatility indices requires minimum 1 day. Got ${output.duration}${output.durationUnit}.`;
          } else if (!['t', 'm', 'h', 'days'].includes(output.durationUnit || '')) {
            validationError = `Touch/No Touch on volatility indices supports 't', 'm', 'h', or 'days' duration units. Got ${output.durationUnit}.`;
          }
        } else if (input.currentInstrument.startsWith('frxXAU') || input.currentInstrument.startsWith('frxXAG') ||
                   input.currentInstrument.startsWith('frxXPT') || input.currentInstrument.startsWith('frxXPD')) {
          // For metals, require days (minimum 1)
          if (output.durationUnit !== 'days' || !output.duration || output.duration < 1) {
            validationError = `Touch/No Touch on metals requires minimum 1 day duration. Got ${output.duration}${output.durationUnit}.`;
          }
        } else {
          // For forex and stock indices, require days (minimum 7)
          if (output.durationUnit !== 'days' || !output.duration || output.duration < 7) {
            validationError = `Touch/No Touch on forex/indices requires minimum 7 days duration. Got ${output.duration}${output.durationUnit}.`;
          }
        }
      }

      // Validate Higher/Lower duration requirements
      if ((output.derivContractType === "CALL" || output.derivContractType === "PUT") &&
          input.userSelectedTradeType === 'HigherLower') {
        // For volatility indices, allow ticks (min 5), seconds (min 15), or minutes
        if (input.currentInstrument.startsWith('R_') || input.currentInstrument.includes('HZ')) {
          if (output.durationUnit === 't' && (!output.duration || output.duration < 5)) {
            validationError = `Higher/Lower on volatility indices requires minimum 5 ticks. Got ${output.duration}${output.durationUnit}.`;
          } else if (output.durationUnit === 's' && (!output.duration || output.duration < 15)) {
            validationError = `Higher/Lower on volatility indices requires minimum 15 seconds. Got ${output.duration}${output.durationUnit}.`;
          } else if (!['t', 's', 'm'].includes(output.durationUnit || '')) {
            validationError = `Higher/Lower on volatility indices supports 't', 's', or 'm' duration units. Got ${output.durationUnit}.`;
          }
        } else {
          // For other instruments, require days (minimum 1)
          if (output.durationUnit !== 'days' || !output.duration || output.duration < 1) {
            validationError = `Higher/Lower on non-volatility instruments requires minimum 1 day duration. Got ${output.duration}${output.durationUnit}.`;
          }
        }
      }
      if (validationError) {
        console.error(`[AI Single Flow/${input.currentInstrument}] Invalid trade proposal: ${validationError}`, output);
        return { instrument: input.currentInstrument as ExternalVolatilityInstrumentType, shouldTrade: false, reasoning: `AI proposed invalid trade: ${validationError}` };
      }
    }
    output.instrument = input.currentInstrument as ExternalVolatilityInstrumentType;
    return output;
  }
);
export const generateVolatilitySingleTradeDecision = volatilitySingleTradeStrategyFlowInternal;

// Flow for generating a session-wide strategy
export const generateVolatilitySessionStrategy = ai.defineFlow(
  {
    name: 'generateVolatilitySessionStrategy',
    inputSchema: VolatilitySessionStrategyInputSchema,
    outputSchema: VolatilitySessionStrategyOutputSchema,
  },
  async (input: VolatilitySessionStrategyInput): Promise<VolatilitySessionStrategyOutput> => {
    console.log(`[AI Session Flow] Input. User Trade Type: ${input.userSelectedTradeType}, Total Stake: ${input.totalSessionStake}, Instruments: ${input.availableInstruments.join(', ')}`);
    const tradesToExecute: VolatilitySingleTradeProposal[] = [];
    let totalStakeAllocated = 0;
    const maxTradesPerSession = Math.max(1, Math.min(input.availableInstruments.length, 5));
    let tradesProposedCount = 0;

    const baseStakePerTrade = input.totalSessionStake > 0 && input.availableInstruments.length > 0
        ? parseFloat((input.totalSessionStake / Math.min(input.availableInstruments.length, maxTradesPerSession)).toFixed(2))
        : 0.35;

    if (baseStakePerTrade < 0.35 && input.availableInstruments.length > 0) {
        console.warn(`[AI Session Flow] Calculated base stake per trade ($${baseStakePerTrade}) is below Deriv minimum of $0.35.`);
    }

    let overallReasoning = `AI session for ${input.userSelectedTradeType} with total stake $${input.totalSessionStake.toFixed(2)}. `;

    // For DigitsOverUnder, limit to 2 instruments to prevent timeout (each takes ~25-30 seconds)
    const instrumentsToProcess = input.userSelectedTradeType === 'DigitsOverUnder'
      ? input.availableInstruments.slice(0, 2)
      : input.availableInstruments;

    console.log(`[AI Session Flow] Processing ${instrumentsToProcess.length} instruments for ${input.userSelectedTradeType}`);

    // Calculate proper stake per trade based on number of instruments to process
    const adjustedBaseStakePerTrade = input.totalSessionStake / Math.min(instrumentsToProcess.length, maxTradesPerSession);
    console.log(`[AI Session Flow] Adjusted stake per trade: $${adjustedBaseStakePerTrade.toFixed(2)} (Total: $${input.totalSessionStake}, Instruments: ${instrumentsToProcess.length})`);

    for (const instrument of instrumentsToProcess) {
      // Early exit conditions
      if (tradesProposedCount >= maxTradesPerSession && totalStakeAllocated >= input.totalSessionStake * 0.95) {
        overallReasoning += `Max trades or stake allocation reached. `;
        break;
      }

      // For DigitsOverUnder, exit early if we have enough trades to prevent timeout
      if (input.userSelectedTradeType === 'DigitsOverUnder' && tradesProposedCount >= 2) {
        overallReasoning += `DigitsOverUnder: Limiting to 2 trades to prevent timeout. `;
        break;
      }

      const singleInstrumentTicks = input.instrumentTicks[instrument] || [];
      const singleInstrumentIndicators = input.instrumentIndicators?.[instrument];

      if (singleInstrumentTicks.length < 5) {
        console.log(`[AI Session Flow] Skipping ${instrument} due to insufficient tick data (${singleInstrumentTicks.length}).`);
        overallReasoning += `Skipped ${instrument} (insufficient data). `;
        continue;
      }

      const currentStakeForThisTrade = Math.max(0.35, adjustedBaseStakePerTrade);

      const singleTradeInput: VolatilitySingleTradeStrategyInput = {
        currentInstrument: instrument,
        userSelectedTradeType: input.userSelectedTradeType,
        stakePerTrade: currentStakeForThisTrade,
        instrumentTicks: singleInstrumentTicks,
        instrumentIndicators: singleInstrumentIndicators,
      };

      console.log(`[AI Session Flow] Calling single trade decision for ${instrument} with stake ${currentStakeForThisTrade}`);

      try {
        const decision = await generateVolatilitySingleTradeDecision(singleTradeInput);

        if (decision.shouldTrade && decision.stake && decision.stake >= 0.35) {
          const actualStakeForThisTrade = Math.min(decision.stake, input.totalSessionStake - totalStakeAllocated);

          if (actualStakeForThisTrade >= 0.35) {
            decision.stake = parseFloat(actualStakeForThisTrade.toFixed(2));
            tradesToExecute.push(decision);
            totalStakeAllocated += decision.stake;
            tradesProposedCount++;
            overallReasoning += `For ${instrument}: ${decision.reasoning} (Stake: $${decision.stake}). `;
            console.log(`[AI Session Flow] Trade PROPOSED for ${instrument}. Stake: $${decision.stake}. Total allocated: $${totalStakeAllocated.toFixed(2)}`);
          } else {
            overallReasoning += `Skipped proposed trade for ${instrument} (adjusted stake $${actualStakeForThisTrade.toFixed(2)} too low). `;
          }
        } else {
          overallReasoning += `For ${instrument}: No trade recommended (${decision.reasoning}). `;
        }
      } catch (error) {
        console.error(`[AI Session Flow] Error processing ${instrument}:`, error);
        overallReasoning += `Error processing ${instrument}: ${(error as Error).message}. `;
        // Continue with next instrument instead of failing entire session
      }

      if (totalStakeAllocated >= input.totalSessionStake * 0.98) {
        overallReasoning += `Total stake allocation limit nearly reached. `;
        break;
      }
    }

    if (tradesToExecute.length === 0) {
      overallReasoning += 'No suitable trading opportunities found across the analyzed instruments for the specified criteria.';
    }

    return {
      tradesToExecute,
      overallReasoning,
    };
  }
);

// OLDER FLOW - Kept for compatibility if `volatility-trading/page.tsx` still uses it directly for simulation
export const generateVolatilityTradingStrategy = ai.defineFlow(
  {
    name: 'generateVolatilityTradingStrategy',
    inputSchema: VolatilityTradingStrategyInputSchema,
    outputSchema: VolatilityTradingStrategyOutputSchema,
  },
  async (input: VolatilityTradingStrategyInput): Promise<VolatilityTradingStrategyOutput> => {
    console.warn("[AI Flow - generateVolatilityTradingStrategy] This is an older/mocked page simulation flow.");
    const tradesToExecute: VolatilityTradeProposal[] = [];
    let allocatedStake = 0;

    if (input.instruments.length > 0 && input.totalStake > 0) {
        const instrumentToTrade = input.instruments[0];
        const stakeForThisTrade = Math.min(input.totalStake, 10);
        const ticksForInstrument = input.instrumentTicks[instrumentToTrade];

        if (ticksForInstrument && ticksForInstrument.length > 1) {
            const lastPrice = ticksForInstrument[ticksForInstrument.length -1].price;
            const prevPrice = ticksForInstrument[ticksForInstrument.length -2].price;

            tradesToExecute.push({
                instrument: instrumentToTrade as ExternalVolatilityInstrumentType,
                action: lastPrice > prevPrice ? 'CALL' : 'PUT',
                stake: stakeForThisTrade,
                durationSeconds: 60,
                reasoning: `Mock simulation decision for ${instrumentToTrade}. Mode: ${input.tradingMode}.`,
            });
            allocatedStake += stakeForThisTrade;
        }
    }

    return {
      tradesToExecute,
      overallReasoning: `Mock simulation strategy. Total stake: $${allocatedStake.toFixed(2)}. Mode: ${input.tradingMode}.`,
    };
  }
);

// NEW STRATEGY CONFIDENCE SCORING - SYSTEM DIRECTIVE IMPLEMENTATION
function calculateTradeConfidenceScore(
  indicators: InstrumentIndicatorData,
  tradeProposal: VolatilitySingleTradeProposal,
  tradeType: UserTradeType,
  ticks?: PriceTick[]
): number {
  let score = 0;
  const isDigitOver = tradeProposal.derivContractType === 'DIGITOVER';
  const isDigitUnder = tradeProposal.derivContractType === 'DIGITUNDER';
  const isDigitEven = tradeProposal.derivContractType === 'DIGITEVEN';
  const isDigitOdd = tradeProposal.derivContractType === 'DIGITODD';
  const isBullish = tradeProposal.derivContractType === 'CALL' || tradeProposal.derivContractType === 'ONETOUCH';
  const isBearish = tradeProposal.derivContractType === 'PUT' || tradeProposal.derivContractType === 'NOTOUCH';

  // 🚨 NEW STRATEGY SCORING - SYSTEM DIRECTIVE IMPLEMENTATION 🚨

  // 1. MACD SIGNAL ANALYSIS (Weight: 40% - PRIMARY INDICATOR)
  let macdScore = 0;
  if (indicators.macd) {
    const { macd: macdLine } = indicators.macd;
    // OVER/UNDER Strategy Implementation
    if (isDigitOver && macdLine >= 1 && macdLine <= 40) {
      macdScore = 4; // Perfect MACD signal for DIGITOVER (40% of 10 points)
    } else if (isDigitUnder && macdLine <= -1 && macdLine >= -40) {
      macdScore = 4; // Perfect MACD signal for DIGITUNDER (40% of 10 points)
    } else if ((isDigitOver || isBullish) && macdLine > 0) {
      macdScore = 2; // Partial bullish signal
    } else if ((isDigitUnder || isBearish) && macdLine < 0) {
      macdScore = 2; // Partial bearish signal
    }
  }
  score += macdScore;

  // 2. GREEN BAR CONFIRMATION (Weight: 30% - MANDATORY FOR ENTRY)
  let greenBarScore = 0;
  // Simulated green bar analysis based on price momentum
  if (indicators.rsi !== undefined) {
    // Green bar simulation: RSI showing momentum in trade direction
    if ((isDigitOver || isDigitEven || isBullish) && indicators.rsi > 45) {
      greenBarScore = 3; // Green bar confirmed for bullish trades
    } else if ((isDigitUnder || isDigitOdd || isBearish) && indicators.rsi < 55) {
      greenBarScore = 3; // Green bar confirmed for bearish trades
    }
  }
  score += greenBarScore;

  // 3. DIGIT PROBABILITY ANALYSIS (Weight: 20% - SECONDARY INDICATOR)
  let digitScore = 0;
  if (ticks && ticks.length >= 10) {
    const digitAnalysis = analyzeDigitProbabilities(ticks);

    if (isDigitEven || isDigitOdd) {
      // Even/Odd strategy - check if bias supports trade direction
      if ((isDigitEven && digitAnalysis.evenOddBias === 'even') ||
          (isDigitOdd && digitAnalysis.evenOddBias === 'odd')) {
        digitScore = 2; // Strong bias supports trade
      } else if (digitAnalysis.evenOddBias === 'neutral') {
        digitScore = 1; // Neutral bias - partial score
      }
    } else if (isDigitOver || isDigitUnder) {
      // Over/Under strategy - check specific digit probabilities
      const barrier = tradeProposal.barrier ? parseInt(tradeProposal.barrier) : 5;
      const overUnderBias = digitAnalysis.overUnderBias[barrier.toString()];

      if ((isDigitOver && overUnderBias === 'over') ||
          (isDigitUnder && overUnderBias === 'under')) {
        digitScore = 2; // Strong bias supports trade
      } else if (overUnderBias === 'neutral') {
        digitScore = 1; // Neutral bias - partial score
      }
    }
  } else {
    // Fallback scoring when insufficient tick data
    if (isDigitEven || isDigitOdd || isDigitOver || isDigitUnder) {
      digitScore = 1; // Base score for digit trades
    }
  }
  score += digitScore;

  // 4. SUPPORTING TECHNICAL INDICATORS (Weight: 10% - CONFIRMATION)
  let supportScore = 0;

  // Moving Average confirmation
  if (indicators.ema !== undefined && indicators.bollingerBands) {
    const currentPrice = indicators.bollingerBands.middle;
    if ((isDigitOver || isBullish) && currentPrice >= indicators.ema) {
      supportScore += 0.5; // MA supports bullish direction
    } else if ((isDigitUnder || isBearish) && currentPrice <= indicators.ema) {
      supportScore += 0.5; // MA supports bearish direction
    }
  }

  // Additional momentum confirmation
  if (indicators.williamsR !== undefined) {
    if ((isDigitOver || isBullish) && indicators.williamsR > -80) {
      supportScore += 0.5; // Williams %R supports bullish
    } else if ((isDigitUnder || isBearish) && indicators.williamsR < -20) {
      supportScore += 0.5; // Williams %R supports bearish
    }
  }

  score += supportScore;

  // 🚨 MANDATORY REQUIREMENTS CHECK 🚨

  // Minimum score requirements based on new strategy
  const minimumScore = 6; // Require 60% confidence minimum

  // MACD requirement for digit over/under trades
  if ((isDigitOver || isDigitUnder) && macdScore < 2) {
    score = 0; // Fail trade if MACD doesn't support direction
  }

  // Green bar requirement (simulated through momentum)
  if (greenBarScore === 0) {
    score = 0; // Fail trade if no green bar confirmation
  }

  // Probability threshold requirement
  if ((isDigitEven || isDigitOdd || isDigitOver || isDigitUnder) && digitScore === 0) {
    score = 0; // Fail trade if digit probability not met
  }

  // Apply minimum score threshold
  if (score < minimumScore) {
    score = 0; // Fail trade if minimum confidence not met
  }

  return Math.min(score, 10); // Cap at 10
}

// NEW FUNCTION: Digit Probability Analysis - System Directive Implementation
function analyzeDigitProbabilities(ticks: PriceTick[]): {
  digitProbabilities: Record<string, number>;
  evenOddBias: 'even' | 'odd' | 'neutral';
  overUnderBias: Record<string, 'over' | 'under' | 'neutral'>;
} {
  if (ticks.length < 10) {
    // Not enough data for reliable analysis
    return {
      digitProbabilities: {},
      evenOddBias: 'neutral',
      overUnderBias: {}
    };
  }

  // Extract last digits from recent ticks
  const lastDigits = ticks.slice(-50).map(tick => {
    const priceStr = tick.price.toString();
    return priceStr.charAt(priceStr.length - 1);
  });

  // Calculate digit frequency
  const digitCounts: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) {
    digitCounts[i.toString()] = 0;
  }

  lastDigits.forEach(digit => {
    if (digitCounts[digit] !== undefined) {
      digitCounts[digit]++;
    }
  });

  // Calculate probabilities
  const digitProbabilities: Record<string, number> = {};
  const totalTicks = lastDigits.length;

  for (let i = 0; i <= 9; i++) {
    const digit = i.toString();
    digitProbabilities[digit] = (digitCounts[digit] / totalTicks) * 100;
  }

  // Analyze even/odd bias
  const evenCount = [0, 2, 4, 6, 8].reduce((sum, digit) => sum + digitCounts[digit.toString()], 0);
  const oddCount = [1, 3, 5, 7, 9].reduce((sum, digit) => sum + digitCounts[digit.toString()], 0);

  let evenOddBias: 'even' | 'odd' | 'neutral' = 'neutral';
  if (evenCount > oddCount * 1.2) evenOddBias = 'even';
  else if (oddCount > evenCount * 1.2) evenOddBias = 'odd';

  // Analyze over/under bias for each threshold
  const overUnderBias: Record<string, 'over' | 'under' | 'neutral'> = {};

  for (let threshold = 0; threshold <= 9; threshold++) {
    const overCount = lastDigits.filter(digit => parseInt(digit) > threshold).length;
    const underCount = lastDigits.filter(digit => parseInt(digit) < threshold).length;

    if (overCount > underCount * 1.2) {
      overUnderBias[threshold.toString()] = 'over';
    } else if (underCount > overCount * 1.2) {
      overUnderBias[threshold.toString()] = 'under';
    } else {
      overUnderBias[threshold.toString()] = 'neutral';
    }
  }

  return {
    digitProbabilities,
    evenOddBias,
    overUnderBias
  };
}
