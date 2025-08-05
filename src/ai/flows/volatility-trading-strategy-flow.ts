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


// Simplified prompt for pattern-based and basic analysis
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

🚨 SIMPLIFIED TRADING STRATEGIES 🚨

**SUPPORTED TRADE TYPES:**

🔥 **DigitsEvenOdd** - PATTERN-BASED STRATEGY:
- PRIORITY: Use pattern-based decisions when available
- Analyze last digit patterns from recent ticks
- Look for 3+ consecutive same parity followed by opposite parity
- Choose DIGITEVEN or DIGITODD based on pattern analysis
- Duration: 5 ticks for quick resolution

🔥 **DigitsOverUnder** - DIGIT ANALYSIS STRATEGY:
- Analyze recent tick digits to identify trends
- Look for digit clustering patterns (high digits 6-9 vs low digits 0-4)
- Choose DIGITOVER or DIGITUNDER based on digit analysis
- MUST specify barrier digit (0-9) for prediction
- Duration: 5 ticks for quick resolution

🔥 **RiseFall** - PRICE MOVEMENT STRATEGY:
- Analyze recent price movement trends
- Look for momentum in price direction
- Choose CALL (price will rise) or PUT (price will fall)
- Duration: 60-300 seconds for trend development

**EXECUTION DECISION PROCESS:**

1. **Analyze the provided data** for {{{currentInstrument}}} and determine if a trade should be executed based on {{{userSelectedTradeType}}}.

2. **Contract Type Selection:**
   - DigitsEvenOdd: Output 'DIGITEVEN' or 'DIGITODD' (NO barrier field)
   - DigitsOverUnder: Output 'DIGITOVER' or 'DIGITUNDER' (MUST include barrier digit 0-9)
   - RiseFall: Output 'CALL' or 'PUT' (NO barrier field)

3. **Duration Guidelines:**
   - DigitsEvenOdd/DigitsOverUnder: Use 5 ticks ('t') for quick resolution
   - RiseFall: Use 60-300 seconds ('s') for trend development

4. **Stake:** Use {{{stakePerTrade}}} for all trades.

5. **No Trade Conditions:** Set 'shouldTrade: false' if signals are unclear or conflicting.

**VALIDATION RULES:**
- DigitsOverUnder: barrier field MANDATORY (digit 0-9 as string)
- DigitsEvenOdd/RiseFall: barrier field MUST be omitted
- All trades: duration, durationUnit, stake MANDATORY when shouldTrade=true

Output Format: Return a single JSON object matching the output schema.



**FINAL VALIDATION:**
- DigitsOverUnder: barrier field MANDATORY (digit 0-9 as string)
- DigitsEvenOdd/RiseFall: barrier field MUST be omitted
- All trades: duration, durationUnit, stake MANDATORY when shouldTrade=true




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

    // Check for pattern-based trade trigger first
    if (input.patternTrigger && input.userSelectedTradeType === 'DigitsEvenOdd' && input.patternTrigger.shouldTrade) {
      console.log(`[AI Single Flow/${input.currentInstrument}] Using pattern-based strategy with user settings:`, {
        patternTrigger: input.patternTrigger,
        executionMode: input.executionMode,
        accountType: input.accountType,
        selectedStrategy: input.selectedStrategy
      });

      // Return pattern-based trade proposal with user settings applied
      return {
        instrument: input.currentInstrument as ExternalVolatilityInstrumentType,
        shouldTrade: true,
        derivContractType: input.patternTrigger.contractType,
        duration: input.executionMode === 'turbo' ? 1 : 5, // Turbo: 1 tick, Safe: 5 ticks
        durationUnit: 't',
        stake: input.stakePerTrade,
        reasoning: `PATTERN-BASED TRADE: ${input.patternTrigger.reasoning}. Strategy: ${input.selectedStrategy}. Execution: ${input.executionMode} mode. Account: ${input.accountType}. Confidence: ${(input.patternTrigger.confidence || 1) * 100}%. This trade uses deterministic pattern detection with user-configured settings.`
      };
    }

    if (!input.instrumentTicks || input.instrumentTicks.length === 0) {
      return {
        instrument: input.currentInstrument as ExternalVolatilityInstrumentType,
        shouldTrade: false,
        reasoning: `No tick data for ${input.currentInstrument}.`,
      };
    }

    const promptGenerationInput: VolatilityStrategyPromptInput = {
        availableInstruments: [input.currentInstrument],
        userSelectedTradeType: input.userSelectedTradeType,
        totalSessionStake: input.stakePerTrade,
        currentInstrument: input.currentInstrument,
        stakePerTrade: input.stakePerTrade,
        instrumentTicks: input.instrumentTicks, // Pass directly for template

        // Pass user settings to prompt
        executionMode: input.executionMode,
        accountType: input.accountType,
        selectedStrategy: input.selectedStrategy,
        predictionDigit: input.predictionDigit,
        patternTrigger: input.patternTrigger,
    };

    let output: VolatilitySingleTradeProposal | null = null;

    try {
      // Try Gemini first (now primary) with enhanced AI service
      const enhancedAI = getEnhancedAI();

      console.log(`[AI Single Flow/${input.currentInstrument}] Attempting Gemini generation (primary)`);

      // Build the prompt manually for enhanced AI service
      const systemPrompt = `You are an expert AI trading strategist for Deriv Volatility Indices. Analyze the provided data and return a JSON response matching the exact schema.`;

      const userPrompt = `
🚨 SIMPLIFIED VOLATILITY TRADING ANALYSIS 🚨

Analyze the provided data for the instrument: ${input.currentInstrument}.
User has selected the trade type: ${input.userSelectedTradeType}.
Recommended stake for this trade: ${input.stakePerTrade}.

📋 USER SETTINGS:
- Execution Mode: ${input.executionMode || 'safe'} (Turbo = 1 tick duration, Safe = 5+ ticks)
- Account Type: ${input.accountType || 'demo'}
- Selected Strategy: ${input.selectedStrategy || 'Auto'}
${input.predictionDigit !== undefined ? `- Prediction Digit: ${input.predictionDigit} (for DigitsOverUnder)` : ''}

${input.patternTrigger ? `
🔥 PATTERN TRIGGER DETECTED:
- Should Trade: ${input.patternTrigger.shouldTrade}
- Contract Type: ${input.patternTrigger.contractType}
- Pattern Reasoning: ${input.patternTrigger.reasoning}
- Confidence: ${(input.patternTrigger.confidence || 1) * 100}%
- Pattern Type: ${input.patternTrigger.patternType || 'N/A'}

⚠️ IMPORTANT: For DigitsEvenOdd trades with pattern triggers, prioritize the pattern-based decision over traditional analysis.
` : ''}

Recent Price Ticks for ${input.currentInstrument} (last is most recent):
${input.instrumentTicks.map(tick => `- Time: ${tick.time}, Price: ${tick.price}`).join('\n')}

📊 PRICE ANALYSIS for ${input.currentInstrument}:

Recent last digits: ${input.instrumentTicks.slice(-10).map(tick => tick.price.toString().slice(-1)).join(', ')}
Price trend: ${(() => {
  const prices = input.instrumentTicks.slice(-5).map(t => t.price);
  if (prices.length < 2) return 'Insufficient data';
  const latest = prices[prices.length - 1];
  const previous = prices[0];
  return latest > previous ? 'Rising' : latest < previous ? 'Falling' : 'Sideways';
})()}

🚨 SIMPLIFIED DECISION LOGIC 🚨

SUPPORTED TRADE TYPES: DigitsEvenOdd, DigitsOverUnder, RiseFall

DECISION CRITERIA FOR ${input.userSelectedTradeType}:

IF userSelectedTradeType is "DigitsEvenOdd":
- PRIORITY: Use pattern trigger if provided (bypasses analysis)
- FALLBACK: Analyze recent digit patterns for Even/Odd bias
- Duration: ${input.executionMode === 'turbo' ? '1 tick (Turbo mode)' : '5 ticks (Safe mode)'}

IF userSelectedTradeType is "DigitsOverUnder":
- Analyze recent digits for high/low clustering
- Choose barrier digit based on analysis${input.predictionDigit !== undefined ? ` (User suggested: ${input.predictionDigit})` : ''}
- Duration: ${input.executionMode === 'turbo' ? '1 tick (Turbo mode)' : '5 ticks (Safe mode)'}

IF userSelectedTradeType is "RiseFall":
- Analyze price trend from recent ticks
- Choose CALL (rising) or PUT (falling)
- Duration: ${input.executionMode === 'turbo' ? '60 seconds (Turbo mode)' : '180-300 seconds (Safe mode)'}

Return ONLY a JSON object with this exact structure:
{
  "instrument": "${input.currentInstrument}",
  "shouldTrade": true/false,
  "derivContractType": "CALL/PUT/DIGITEVEN/DIGITODD/DIGITOVER/DIGITUNDER" (only if shouldTrade is true),
  "duration": number (only if shouldTrade is true),
  "durationUnit": "s/t" (only if shouldTrade is true),
  "stake": ${input.stakePerTrade} (only if shouldTrade is true),
  "barrier": "single digit 0-9" (ONLY for DigitsOverUnder when shouldTrade is true),
  "reasoning": "your simplified analysis"
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

      // Validation and user settings enforcement
      const isPatternBased = !!(input.patternTrigger && input.patternTrigger.shouldTrade);

      // Enforce user execution mode settings
      if (input.executionMode === 'turbo' && output.durationUnit === 't' && output.duration && output.duration > 1) {
        console.log(`[AI Single Flow/${input.currentInstrument}] Enforcing Turbo mode: reducing duration from ${output.duration} to 1 tick`);
        output.duration = 1;
      } else if (input.executionMode === 'safe' && output.durationUnit === 't' && output.duration && output.duration < 5) {
        console.log(`[AI Single Flow/${input.currentInstrument}] Enforcing Safe mode: increasing duration from ${output.duration} to 5 ticks`);
        output.duration = 5;
      }

      // Enforce user prediction digit for DigitsOverUnder
      if (input.userSelectedTradeType === 'DigitsOverUnder' && input.predictionDigit !== undefined && output.barrier !== input.predictionDigit.toString()) {
        console.log(`[AI Single Flow/${input.currentInstrument}] Enforcing user prediction digit: changing barrier from ${output.barrier} to ${input.predictionDigit}`);
        output.barrier = input.predictionDigit.toString();
      }

      // Add user settings to reasoning
      if (output.reasoning) {
        output.reasoning += ` [User Settings: ${input.executionMode} mode, ${input.accountType} account, Strategy: ${input.selectedStrategy || 'Auto'}]`;
      }

      if (isPatternBased) {
        console.log(`[AI Single Flow/${input.currentInstrument}] Pattern-based trade approved with user settings enforced`);
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
      }
      if (output.derivContractType?.startsWith("DIGIT") && output.durationUnit !== 't') {
        validationError = `Duration unit must be 't' for Digit contracts. Got '${output.durationUnit}'.`;
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
    // Use selectedInstrument if provided, otherwise fall back to first available instrument
    const targetInstrument = input.selectedInstrument || input.availableInstruments[0];

    console.log(`[AI Session Flow] SINGLE INSTRUMENT TRADING - Target: ${targetInstrument}`);
    console.log(`[AI Session Flow] User Settings - Trade Type: ${input.userSelectedTradeType}, Total Stake: ${input.totalSessionStake}, Execution Mode: ${input.executionMode}, Bulk Trades: ${input.numberOfBulkTrades}, Account: ${input.accountType}, Strategy: ${input.selectedStrategy}`);

    // Validate that we have the selected instrument data
    if (!input.instrumentTicks[targetInstrument] || input.instrumentTicks[targetInstrument].length === 0) {
      console.error(`[AI Session Flow] No tick data available for selected instrument: ${targetInstrument}`);
      return {
        tradesToExecute: [],
        overallReasoning: `No tick data available for selected instrument ${targetInstrument}. Please ensure the instrument is properly selected and streaming.`
      };
    }

    // Check for pattern-based session strategy first
    if (input.patternTrigger && input.userSelectedTradeType === 'DigitsEvenOdd' && input.patternTrigger.shouldTrade) {
      console.log(`[AI Session Flow] Using pattern-based session strategy for ${targetInstrument}:`, input.patternTrigger);

      // Calculate stake per trade based on bulk trades setting
      const stakePerTrade = input.totalSessionStake / (input.numberOfBulkTrades || 1);

      // Create multiple trades based on bulk trades setting
      const patternBasedTrades: VolatilitySingleTradeProposal[] = [];
      for (let i = 0; i < (input.numberOfBulkTrades || 1); i++) {
        patternBasedTrades.push({
          instrument: targetInstrument as ExternalVolatilityInstrumentType,
          shouldTrade: true,
          derivContractType: input.patternTrigger.contractType,
          duration: input.executionMode === 'turbo' ? 1 : 5, // Turbo: 1 tick, Safe: 5 ticks
          durationUnit: 't',
          stake: Math.max(0.35, stakePerTrade), // Ensure minimum stake
          reasoning: `PATTERN-BASED TRADE ${i + 1}/${input.numberOfBulkTrades}: ${input.patternTrigger.reasoning}. Execution Mode: ${input.executionMode}. Strategy: ${input.selectedStrategy}. Account: ${input.accountType}. Confidence: ${(input.patternTrigger.confidence || 1) * 100}%.`
        });
      }

      return {
        tradesToExecute: patternBasedTrades,
        overallReasoning: `Pattern-based session strategy for ${input.userSelectedTradeType} on ${targetInstrument}. ${input.patternTrigger.reasoning}. Execution: ${input.executionMode} mode with ${input.numberOfBulkTrades} bulk trades. Total stake: $${input.totalSessionStake.toFixed(2)}. Account: ${input.accountType}.`
      };
    }

    // SINGLE INSTRUMENT TRADING - Only process the user-selected instrument
    const tradesToExecute: VolatilitySingleTradeProposal[] = [];
    let totalStakeAllocated = 0;

    // Calculate stake per trade based on bulk trades setting
    const numberOfTrades = input.numberOfBulkTrades || 1;
    const stakePerTrade = Math.max(0.35, input.totalSessionStake / numberOfTrades);

    console.log(`[AI Session Flow] SINGLE INSTRUMENT SESSION - Processing ${targetInstrument} with ${numberOfTrades} trades, $${stakePerTrade.toFixed(2)} per trade`);

    let overallReasoning = `AI session for ${input.userSelectedTradeType} on ${targetInstrument} with total stake $${input.totalSessionStake.toFixed(2)}. Execution Mode: ${input.executionMode}, Bulk Trades: ${numberOfTrades}, Account: ${input.accountType}. `;

    // Process only the selected instrument for the specified number of bulk trades
    for (let tradeIndex = 0; tradeIndex < numberOfTrades; tradeIndex++) {
      // Early exit if we've allocated all stake
      if (totalStakeAllocated >= input.totalSessionStake * 0.95) {
        overallReasoning += `Stake allocation complete. `;
        break;
      }

      const singleInstrumentTicks = input.instrumentTicks[targetInstrument] || [];
      const singleInstrumentIndicators = input.instrumentIndicators?.[targetInstrument];

      if (singleInstrumentTicks.length < 5) {
        console.log(`[AI Session Flow] Insufficient tick data for ${targetInstrument} (${singleInstrumentTicks.length}). Ending session.`);
        overallReasoning += `Insufficient tick data for ${targetInstrument}. `;
        break;
      }

      const singleTradeInput: VolatilitySingleTradeStrategyInput = {
        currentInstrument: targetInstrument,
        userSelectedTradeType: input.userSelectedTradeType,
        stakePerTrade: stakePerTrade,
        instrumentTicks: singleInstrumentTicks,
        instrumentIndicators: singleInstrumentIndicators,

        // Pass all user settings to single trade
        executionMode: input.executionMode || 'safe',
        accountType: input.accountType || 'demo',
        selectedStrategy: input.selectedStrategy,
        predictionDigit: input.predictionDigit,
        patternTrigger: input.patternTrigger,
      };

      console.log(`[AI Session Flow] Calling single trade decision ${tradeIndex + 1}/${numberOfTrades} for ${targetInstrument} with stake $${stakePerTrade.toFixed(2)}`);

      try {
        const decision = await generateVolatilitySingleTradeDecision(singleTradeInput);

        if (decision.shouldTrade && decision.stake && decision.stake >= 0.35) {
          const actualStakeForThisTrade = Math.min(decision.stake, input.totalSessionStake - totalStakeAllocated);

          if (actualStakeForThisTrade >= 0.35) {
            // Apply execution mode settings to the trade
            const finalTrade = {
              ...decision,
              stake: parseFloat(actualStakeForThisTrade.toFixed(2)),
              duration: input.executionMode === 'turbo' ? 1 : (decision.duration || 5), // Turbo: 1 tick, Safe: original or 5 ticks
              reasoning: `${decision.reasoning} [Trade ${tradeIndex + 1}/${numberOfTrades}, ${input.executionMode} mode, ${input.accountType} account]`
            };

            tradesToExecute.push(finalTrade);
            totalStakeAllocated += finalTrade.stake;
            overallReasoning += `Trade ${tradeIndex + 1} on ${targetInstrument}: ${decision.reasoning} (Stake: $${finalTrade.stake}, Mode: ${input.executionMode}). `;
            console.log(`[AI Session Flow] Trade ${tradeIndex + 1} PROPOSED for ${targetInstrument}. Stake: $${finalTrade.stake}. Total allocated: $${totalStakeAllocated.toFixed(2)}`);
          } else {
            overallReasoning += `Trade ${tradeIndex + 1}: Insufficient remaining stake ($${actualStakeForThisTrade.toFixed(2)} < $0.35). `;
          }
        } else {
          overallReasoning += `Trade ${tradeIndex + 1} on ${targetInstrument}: No trade recommended (${decision.reasoning}). `;
        }
      } catch (error) {
        console.error(`[AI Session Flow] Error processing trade ${tradeIndex + 1} for ${targetInstrument}:`, error);
        overallReasoning += `Error processing trade ${tradeIndex + 1}: ${(error as Error).message}. `;
        // Continue with next trade instead of failing entire session
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

// Simplified confidence scoring for pattern-based trades
function calculateTradeConfidenceScore(
  indicators: any,
  tradeProposal: VolatilitySingleTradeProposal,
  tradeType: UserTradeType,
  ticks?: any[],
  isPatternBased?: boolean
): number {
  // Pattern-based trades have high confidence by default
  if (isPatternBased && (tradeProposal.derivContractType === 'DIGITEVEN' || tradeProposal.derivContractType === 'DIGITODD')) {
    console.log(`[Confidence] Pattern-based ${tradeProposal.derivContractType} trade - using high confidence score`);
    return 8.5; // High confidence for pattern-based trades (out of 10)
  }

  // Simplified scoring for other trades
  return 6.0; // Default moderate confidence
}


