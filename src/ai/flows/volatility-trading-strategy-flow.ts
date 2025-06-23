'use server';
/**
 * @fileOverview This file defines Genkit flows for generating trading strategies for Volatility Indices.
 */

import { ai } from '@/ai/genkit';
import * as z from 'zod'; // For z.infer if needed locally, though types are imported.
import type { VolatilityInstrumentType as ExternalVolatilityInstrumentType } from '@/types';

// Import all necessary Zod schemas and their inferred TypeScript types from the shared location
import {
  UserTradeTypeSchema,
  type UserTradeType,
  VolatilityInstrumentTypeSchema,
  PriceTickSchema,
  InstrumentIndicatorDataSchema,
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

🎯 PROFESSIONAL TRADING STRATEGY - TARGET WIN RATE: ≥75%

You are an elite volatility trader with institutional-level expertise. Your mission is to achieve a minimum 75% win rate through sophisticated technical analysis and disciplined trade selection.

🔥 MANDATORY TRADING RULES FOR HIGH WIN RATE:

1️⃣ **CONFLUENCE REQUIREMENT**: Only trade when AT LEAST 3 indicators align:
   - RSI + Stochastic + Williams %R (momentum confluence)
   - MACD + EMA (trend confluence)
   - Bollinger Bands + ATR (volatility confluence)
   - CCI + Price Action (reversal confluence)

2️⃣ **HIGH-PROBABILITY SETUPS ONLY**:
   - RSI Oversold (<30) + Stochastic <20 + Williams %R <-80 = STRONG BUY
   - RSI Overbought (>70) + Stochastic >80 + Williams %R >-20 = STRONG SELL
   - MACD Bullish Crossover + Price above EMA + BB Middle Break = TREND BUY
   - MACD Bearish Crossover + Price below EMA + BB Middle Break = TREND SELL

3️⃣ **VOLATILITY-BASED DURATION SELECTION**:
   - High ATR (>0.001): Use shorter durations (1-3 minutes)
   - Medium ATR (0.0005-0.001): Use medium durations (3-8 minutes)
   - Low ATR (<0.0005): Use longer durations (8-15 minutes)

4️⃣ **TRADE TYPE OPTIMIZATION**:
   - **RiseFall**: Best for clear trend + momentum alignment. Duration: 1-5 minutes.
   - **HigherLower**: Best for range-bound markets with clear support/resistance.
     * For Volatility Indices: Duration: 5-10 ticks OR 15 seconds to 5 minutes
     * For other instruments: Duration: 1-7 days (minimum 1 day required by Deriv)
   - **TouchNoTouch**: Best for high volatility breakouts or strong consolidation. Duration: 5-15 minutes.
   - **DigitsEvenOdd**: Best for sideways/choppy markets. Duration: 1-10 ticks.
   - **DigitsOverUnder**: Best for digit pattern analysis + momentum. Duration: 1-10 ticks.

5️⃣ **RISK MANAGEMENT**:
   - NEVER trade against strong trends (MACD + EMA alignment)
   - AVOID trading during extreme volatility spikes (ATR >2x average)
   - SKIP trades with conflicting signals (indicators disagreeing)
   - ONLY trade when confidence level is HIGH (multiple confirmations)

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
      - For Touch/No Touch contracts ('TouchNoTouch'), 'durationUnit' MUST be 'm' (minutes), and 'duration' MUST be at least 5 minutes (minimum: 5m, recommended: 5m-30m).
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

    const { output } = await determineDerivContractTypePrompt(promptGenerationInput) as { output: VolatilitySingleTradeProposal | null };

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
      if ((output.derivContractType === "ONETOUCH" || output.derivContractType === "NOTOUCH") &&
          (output.durationUnit !== 'm' || !output.duration || output.duration < 5)) {
        validationError = `Touch/No Touch contracts require minimum 5 minutes duration. Got ${output.duration}${output.durationUnit}.`;
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
