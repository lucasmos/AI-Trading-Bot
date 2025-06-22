'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a trading strategy for Volatility Indices.
 *
 * - generateVolatilityTradingStrategy - The main flow function.
 * - VolatilityTradingStrategyInput - Input schema for the flow.
 * - VolatilityTradingStrategyOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import * as z from 'zod';
// Assuming PriceTick is defined in '@/types' and InstrumentIndicatorData can be structured from there or defined here
import type { VolatilityInstrumentType, PriceTick as ExternalPriceTick } from '@/types';

// Schemas for AI Flow
// Using z.string() for VolatilityInstrumentTypeSchema for flexibility, cast to VolatilityInstrumentType where needed.
const VolatilityInstrumentTypeSchema = z.string().describe("Deriv symbol for a volatility index, e.g., R_10, 1HZ10V");

const PriceTickSchema = z.object({
  epoch: z.number(),
  price: z.number(),
  time: z.string(),
}).describe("A single price tick data point.");

const InstrumentIndicatorDataSchema = z.object({
  rsi: z.number().optional(),
  macd: z.object({ macd: z.number(), signal: z.number(), histogram: z.number() }).optional(),
  bollingerBands: z.object({ upper: z.number(), middle: z.number(), lower: z.number() }).optional(),
  ema: z.number().optional(),
  atr: z.number().optional(),
}).describe("Calculated technical indicators for an instrument.");

// Import UserTradeTypeSchema and UserTradeType from the shared file
import { UserTradeTypeSchema, UserTradeType } from '@/types/ai-shared-types';

// Schema for the input of a single trade decision flow (NEWLY ADDED)
const VolatilitySingleTradeStrategyInputSchema = z.object({
  currentInstrument: VolatilityInstrumentTypeSchema.describe("The specific volatility instrument to analyze."),
  userSelectedTradeType: UserTradeTypeSchema.describe("The type of trade selected by the user."),
  stakePerTrade: z.number().min(0.01).describe("The allocated stake for this potential trade."),
  instrumentTicks: z.array(PriceTickSchema).describe("Recent price ticks for the current instrument."),
  instrumentIndicators: InstrumentIndicatorDataSchema.optional().describe('Calculated technical indicators for the current instrument.'),
});
export type VolatilitySingleTradeStrategyInput = z.infer<typeof VolatilitySingleTradeStrategyInputSchema>;

// Renaming: Input for the new flow that considers multiple instruments and a total stake.
const VolatilitySessionStrategyInputSchema = z.object({
  availableInstruments: z.array(VolatilityInstrumentTypeSchema).describe("List of volatility instruments to consider for trading, e.g., ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']."),
  userSelectedTradeType: UserTradeTypeSchema.describe("The type of trade selected by the user for all trades in this session."),
  totalSessionStake: z.number().min(0.35).describe("User's total stake to be apportioned across chosen trades for this session. Minimum $0.35 total."),
  // instrumentTicks and instrumentIndicators will now be records, mapping instrument symbol to its data.
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)).describe("Record mapping each available instrument symbol to its recent price ticks."),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema.optional()).optional().describe('Record mapping each available instrument to its calculated technical indicators.'),
});
export type VolatilitySessionStrategyInput = z.infer<typeof VolatilitySessionStrategyInputSchema>;

// Schema for pre-formatted indicators, remains the same
// Schema for pre-formatted indicators, remains the same
const PromptFormattedInstrumentIndicatorSchema = z.object({
  rsi: z.string().optional(),
  macdLine: z.string().optional(),
  macdSignal: z.string().optional(),
  macdHist: z.string().optional(),
  bbUpper: z.string().optional(),
  bbMiddle: z.string().optional(),
  bbLower: z.string().optional(),
  ema: z.string().optional(),
  atr: z.string().optional(),
});

// Corrected: Extend from VolatilitySessionStrategyInputSchema
const VolatilityStrategyPromptInputSchema = VolatilitySessionStrategyInputSchema.extend({
    formattedInstrumentIndicators: z.record(VolatilityInstrumentTypeSchema, PromptFormattedInstrumentIndicatorSchema.nullable()).optional().describe("Record mapping each instrument to its pre-formatted string versions of indicators.")
}).omit({ instrumentIndicators: true }); // Omit raw, use formatted (this was already in my previous full file, ensuring it's correct)

const VolatilitySingleTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema,
  shouldTrade: z.boolean().describe("Whether the AI recommends placing a trade or not."),
  derivContractType: z.string().optional().describe("The specific Deriv API contract type (e.g., CALL, PUT, DIGITEVEN, ONETOUCH). Required if shouldTrade is true."),
  duration: z.number().int().min(1).optional().describe("Trade duration value. Required if shouldTrade is true."),
  durationUnit: z.enum(['s', 'm', 'h', 'd', 't']).optional().describe("Unit for the duration (e.g., seconds, ticks). Required if shouldTrade is true."),
  barrier: z.string().optional().describe("Predicted barrier (as a string) or digit (as a string), if applicable to the trade type."),
  stake: z.number().min(0.01).optional().describe("Proposed stake for this trade. Required if shouldTrade is true."),
  reasoning: z.string().describe("AI's reasoning for the decision."),
});
export type VolatilitySingleTradeProposal = z.infer<typeof VolatilitySingleTradeProposalSchema>;


const determineDerivContractTypePrompt = ai.definePrompt({
  name: 'determineDerivContractTypePrompt',
  input: { schema: VolatilityStrategyPromptInputSchema }, // Use new schema with formatted indicators
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
Calculated Technical Indicators for {{{currentInstrument}}}:
  RSI: {{formattedIndicators.rsi}}
  MACD: Line: {{formattedIndicators.macdLine}}, Signal: {{formattedIndicators.macdSignal}}, Hist: {{formattedIndicators.macdHist}}
  Bollinger Bands: Upper: {{formattedIndicators.bbUpper}}, Middle: {{formattedIndicators.bbMiddle}}, Lower: {{formattedIndicators.bbLower}}
  EMA (20): {{formattedIndicators.ema}}
  ATR (14): {{formattedIndicators.atr}}
{{else}}
No technical indicators provided. Base your decision on price action and trade type logic.
{{/if}}

Your Task:
1. Based on the user's selected trade type ('{{{userSelectedTradeType}}}') and your analysis of the instrument data (price ticks and indicators if available), decide if a trade is viable.
2. If a trade is viable (set 'shouldTrade: true'):
   a. Determine the precise Deriv API contract type ('derivContractType').
      - For 'RiseFall': Output 'CALL' (price up) or 'PUT' (price down). The 'barrier' field MUST NOT be present in your JSON output.
      - For 'HigherLower': Output 'CALL' (price will be higher than a programmatically set default barrier) or 'PUT' (price will be lower than a programmatically set default barrier). The 'barrier' field MUST NOT be present in your JSON output for this type (it will be calculated by the system). You can state your barrier preference in the reasoning.
      - For 'TouchNoTouch': Output 'ONETOUCH' (price will touch a programmatically set default barrier) or 'NOTOUCH' (price will not touch a programmatically set default barrier). The 'barrier' field MUST NOT be present in your JSON output for this type (it will be calculated by the system). You can state your barrier preference in the reasoning.
      - For 'DigitsEvenOdd': Output 'DIGITEVEN' (last digit even) or 'DIGITODD' (last digit odd). The 'barrier' field MUST NOT be present in your JSON output.
      - For 'DigitsOverUnder': Output 'DIGITOVER' (last digit > predicted digit) or 'DIGITUNDER' (last digit < predicted digit). YOU ABSOLUTELY MUST provide a 'barrier' field in your JSON output. This 'barrier' must be a single digit string (e.g., "7", "3"). A DigitsOverUnder trade proposal without this digit 'barrier' is invalid.
   b. Recommend a trade 'duration' (integer value) and its 'durationUnit' ('s' for seconds, 'm' for minutes, 't' for ticks). For Digits contracts ('DigitsEvenOdd', 'DigitsOverUnder'), 'durationUnit' MUST be 't', and 'duration' is typically 1-10 ticks. For other types, 'durationUnit' is usually 's' (seconds) or 'm' (minutes). Minimum duration is 1 tick or 1 second.
   c. The 'stake' for this trade should be {{{stakePerTrade}}}. Include this in your proposal.
3. If no trade is viable (e.g., unclear signals, high risk for the chosen trade type), set 'shouldTrade: false'. In this case, do not provide 'derivContractType', 'duration', 'durationUnit', 'stake', or 'barrier'.
4. Provide concise 'reasoning' for your decision. If 'userSelectedTradeType' is 'HigherLower' or 'TouchNoTouch', you can suggest barrier characteristics in your reasoning (e.g., "barrier should be significantly above current spot", "aim for a tight barrier").

Output Format: Return a single JSON object matching the output schema.
- If 'shouldTrade' is true: 'derivContractType', 'duration', 'durationUnit', and 'stake' are ALWAYS mandatory.
- If 'shouldTrade' is true AND 'userSelectedTradeType' is 'DigitsOverUnder': the 'barrier' field (predicted digit) is ALSO ABSOLUTELY MANDATORY.
- For 'RiseFall', 'HigherLower', 'TouchNoTouch', 'DigitsEvenOdd' when 'shouldTrade' is true: the 'barrier' field MUST be omitted from your JSON output.
- If 'shouldTrade' is false: only 'instrument', 'shouldTrade', and 'reasoning' are needed.
CRITICAL CHECK: Before outputting JSON, if 'userSelectedTradeType' is 'HigherLower' or 'TouchNoTouch' and 'shouldTrade' is true, ensure you have OMITTED the 'barrier' field. If 'userSelectedTradeType' is 'DigitsOverUnder' and 'shouldTrade' is true, ensure you have INCLUDED the 'barrier' field with the predicted digit.

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

Example for HigherLower (predicting LOWER with relative barrier):
{
  "instrument": "{{{currentInstrument}}}",
  "shouldTrade": true,
  "derivContractType": "PUT",
  "duration": 120,
  "durationUnit": "s",
  "barrier": "-0.075",
  "stake": {{{stakePerTrade}}},
  "reasoning": "Price showing resistance, MACD declining. Barrier set slightly below current spot."
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

const volatilitySingleTradeStrategyFlow = ai.defineFlow(
  {
    name: 'volatilitySingleTradeStrategyFlow',
    inputSchema: VolatilitySingleTradeStrategyInputSchema,
    outputSchema: VolatilitySingleTradeProposalSchema,
  },
  async (input: VolatilitySingleTradeStrategyInput): Promise<VolatilitySingleTradeProposal> => {
    console.log(`[AI Flow] Received input for ${input.currentInstrument}, trade type ${input.userSelectedTradeType}, stake ${input.stakePerTrade}`);

    if (!input.instrumentTicks || input.instrumentTicks.length === 0) {
        console.warn(`[AI Flow] No tick data for ${input.currentInstrument}. Recommending no trade.`);
        return {
            instrument: input.currentInstrument as VolatilityInstrumentType,
            shouldTrade: false,
            reasoning: `No tick data available for ${input.currentInstrument} to make a decision.`,
        };
    }

    // Ensure instrumentIndicators is null or an object, not undefined for the prompt
    // Create formattedIndicators object
    let formattedIndicatorsForPrompt: z.infer<typeof PromptFormattedInstrumentIndicatorSchema> | null = null;
    if (input.instrumentIndicators) {
      const ind = input.instrumentIndicators;
      formattedIndicatorsForPrompt = {
        rsi: ind.rsi !== undefined ? ind.rsi.toFixed(2) : "N/A",
        macdLine: ind.macd?.macd !== undefined ? ind.macd.macd.toFixed(4) : "N/A",
        macdSignal: ind.macd?.signal !== undefined ? ind.macd.signal.toFixed(4) : "N/A",
        macdHist: ind.macd?.histogram !== undefined ? ind.macd.histogram.toFixed(4) : "N/A",
        bbUpper: ind.bollingerBands?.upper !== undefined ? ind.bollingerBands.upper.toFixed(4) : "N/A",
        bbMiddle: ind.bollingerBands?.middle !== undefined ? ind.bollingerBands.middle.toFixed(4) : "N/A",
        bbLower: ind.bollingerBands?.lower !== undefined ? ind.bollingerBands.lower.toFixed(4) : "N/A",
        ema: ind.ema !== undefined ? ind.ema.toFixed(4) : "N/A",
        atr: ind.atr !== undefined ? ind.atr.toFixed(4) : "N/A",
      };
    }

    const promptInput: z.infer<typeof VolatilityStrategyPromptInputSchema> = {
      currentInstrument: input.currentInstrument,
      userSelectedTradeType: input.userSelectedTradeType,
      stakePerTrade: input.stakePerTrade,
      instrumentTicks: input.instrumentTicks,
      formattedIndicators: formattedIndicatorsForPrompt, // Pass the formatted object
    };

    const { output } = await determineDerivContractTypePrompt(promptInput) as { output: VolatilitySingleTradeProposal | null };

    if (!output) {
      console.error(`[AIFlow/${input.currentInstrument}] AI failed to generate a trade proposal for type ${input.userSelectedTradeType}. Null output received from prompt.`);
      // Return a "no trade" decision instead of throwing an error to allow the loop to continue
      return {
        instrument: input.currentInstrument as VolatilityInstrumentType,
        shouldTrade: false,
        reasoning: `AI failed to generate a response for ${input.currentInstrument}.`,
      };
    }
    console.log(`[AIFlow/${input.currentInstrument}] Raw AI Output for type ${input.userSelectedTradeType}:`, JSON.stringify(output, null, 2));

    // Validate AI output
    if (output.shouldTrade) {
      let validationError: string | null = null;
      if (!output.derivContractType) validationError = "derivContractType is missing.";
      else if (!output.duration) validationError = "duration is missing.";
      else if (!output.durationUnit) validationError = "durationUnit is missing.";
      else if (!output.stake) validationError = "stake is missing.";
      else if (output.stake !== input.stakePerTrade) {
        console.warn(`[AI Flow] AI proposed stake ${output.stake} different from input ${input.stakePerTrade} for ${input.currentInstrument}. Overriding with input stake.`);
        output.stake = input.stakePerTrade;
      }

      // Barrier validation based on userSelectedTradeType
      if (input.userSelectedTradeType === 'DigitsOverUnder') {
        if (output.barrier === undefined || output.barrier === null || String(output.barrier).trim() === '') {
            validationError = `Barrier (predicted digit) is mandatory for DigitsOverUnder but was not provided by AI.`;
        } else {
            const barrierString = String(output.barrier).trim();
            // Check if it's a single digit string using regex
            if (!/^\d$/.test(barrierString)) {
                validationError = `Invalid barrier '${output.barrier}' for DigitsOverUnder. Must be a single digit string (0-9).`;
            } else {
                // Optional: further check if truly needed after regex, but safe
                const barrierNum = parseInt(barrierString);
                if (barrierNum < 0 || barrierNum > 9) {
                    validationError = `Invalid barrier value '${output.barrier}' for DigitsOverUnder. Must be between 0-9.`;
                }
            }
        }
      } else if (input.userSelectedTradeType === 'HigherLower' || input.userSelectedTradeType === 'TouchNoTouch') {
        // For HigherLower & TouchNoTouch, AI is now instructed to OMIT the barrier.
        // If AI provides one, we can warn and remove it, ensuring it doesn't cause issues downstream.
        if (output.barrier !== undefined && output.barrier !== null) {
          console.warn(`[AIFlow/${input.currentInstrument}] AI provided an unexpected barrier ('${output.barrier}') for ${input.userSelectedTradeType}. This will be ignored as it's set programmatically by the server action.`);
          delete output.barrier; // Remove it to adhere to the new contract (AI doesn't set this barrier type)
        }
      }
      // No barrier validation needed for RiseFall or DigitsEvenOdd from AI output.

      if (output.derivContractType?.startsWith("DIGIT") && output.durationUnit !== 't') {
        validationError = `Duration unit must be 't' (ticks) for Digit contracts. Got '${output.durationUnit}'.`;
      }

      if (validationError) {
        console.error(`[AIFlow/${input.currentInstrument}] AI recommended trade but failed validation for type ${input.userSelectedTradeType}: ${validationError}. Output:`, JSON.stringify(output, null, 2));
        return {
            instrument: input.currentInstrument as VolatilityInstrumentType,
            shouldTrade: false,
            reasoning: `AI proposed an invalid trade: ${validationError}`,
        };
      }
      console.log(`[AIFlow/${input.currentInstrument}] Validated AI Trade Proposal for type ${input.userSelectedTradeType}:`, JSON.stringify(output, null, 2));
    } else {
      console.log(`[AIFlow/${input.currentInstrument}] AI Recommends NO TRADE for type ${input.userSelectedTradeType}. Reasoning: ${output.reasoning}`);
    }
    // Ensure output instrument matches input, and cast type
    output.instrument = input.currentInstrument as VolatilityInstrumentType;
    return output;
  }
);

export const generateVolatilitySingleTradeDecision = volatilitySingleTradeStrategyFlow;

// Schema for the output of the session strategy
const VolatilitySessionStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilitySingleTradeProposalSchema).describe("List of trade proposals for the session."),
  overallReasoning: z.string().describe("Overall reasoning for the set of trades proposed for the session."),
  // Potential future additions: total stake allocated, number of trades, etc.
});
export type VolatilitySessionStrategyOutput = z.infer<typeof VolatilitySessionStrategyOutputSchema>;


// New Flow: generateVolatilitySessionStrategy
// This flow orchestrates decisions for multiple instruments based on a total session stake.
export const generateVolatilitySessionStrategy = ai.defineFlow(
  {
    name: 'generateVolatilitySessionStrategy',
    inputSchema: VolatilitySessionStrategyInputSchema,
    outputSchema: VolatilitySessionStrategyOutputSchema,
  },
  async (input: VolatilitySessionStrategyInput): Promise<VolatilitySessionStrategyOutput> => {
    console.log(`[AI Session Flow] Received input. User Trade Type: ${input.userSelectedTradeType}, Total Stake: ${input.totalSessionStake}, Instruments: ${input.availableInstruments.join(', ')}`);
    const tradesToExecute: VolatilitySingleTradeProposal[] = [];
    let totalStakeAllocated = 0;
    const maxTradesPerSession = 5; // Example: Limit the number of trades AI can propose in one session
    let tradesProposedCount = 0;

    // Simple stake apportionment: divide total stake by number of instruments or a max number of trades
    // This can be made more sophisticated later (e.g., based on AI confidence per instrument)
    const potentialTradesToConsider = Math.min(input.availableInstruments.length, maxTradesPerSession);
    const baseStakePerTrade = potentialTradesToConsider > 0 ? parseFloat((input.totalSessionStake / potentialTradesToConsider).toFixed(2)) : 0;

    if (baseStakePerTrade < 0.35 && potentialTradesToConsider > 0) {
        console.warn(`[AI Session Flow] Base stake per trade ($${baseStakePerTrade}) is below Deriv minimum of $0.35. This might lead to issues if AI proposes trades with this stake.`);
        // Depending on strictness, could return no trades or let AI try with this (Deriv API will reject)
    }

    let overallReasoning = `AI session for ${input.userSelectedTradeType} with total stake $${input.totalSessionStake}. `;

    for (const instrument of input.availableInstruments) {
      if (tradesProposedCount >= maxTradesPerSession) {
        overallReasoning += `Max trades limit (${maxTradesPerSession}) reached. No more instruments analyzed. `;
        break;
      }

      const singleInstrumentTicks = input.instrumentTicks[instrument] || [];
      const singleInstrumentIndicators = input.instrumentIndicators?.[instrument];

      if (singleInstrumentTicks.length === 0) {
        console.log(`[AI Session Flow] Skipping ${instrument} due to no tick data.`);
        overallReasoning += `Skipped ${instrument} (no data). `;
        continue;
      }

      const singleTradeInput: VolatilitySingleTradeStrategyInput = {
        currentInstrument: instrument,
        userSelectedTradeType: input.userSelectedTradeType,
        stakePerTrade: baseStakePerTrade, // Provide the calculated stake for this instrument
        instrumentTicks: singleInstrumentTicks,
        instrumentIndicators: singleInstrumentIndicators,
      };

      console.log(`[AI Session Flow] Calling single trade decision for ${instrument}`);
      const decision = await generateVolatilitySingleTradeDecision(singleTradeInput);

      if (decision.shouldTrade && decision.stake && decision.stake > 0) {
        if (totalStakeAllocated + decision.stake <= input.totalSessionStake) {
          tradesToExecute.push(decision);
          totalStakeAllocated += decision.stake;
          tradesProposedCount++;
          overallReasoning += `For ${instrument}: ${decision.reasoning}. `;
          console.log(`[AI Session Flow] Trade proposed for ${instrument}. Stake: ${decision.stake}. Total allocated: ${totalStakeAllocated}`);
        } else {
          overallReasoning += `Skipped proposed trade for ${instrument} (stake ${decision.stake}) as it would exceed total session stake. `;
          console.log(`[AI Session Flow] Skipping trade for ${instrument} (stake ${decision.stake}) - exceeds total session stake.`);
        }
      } else {
        overallReasoning += `For ${instrument}: No trade recommended (${decision.reasoning}). `;
         console.log(`[AI Session Flow] No trade recommended for ${instrument}.`);
      }
    }

    if (tradesToExecute.length === 0) {
      overallReasoning += 'No suitable trading opportunities found across the analyzed instruments for the specified criteria.';
    } else {
      overallReasoning += `Total stake allocated: $${totalStakeAllocated.toFixed(2)} for ${tradesToExecute.length} trades.`;
    }

    console.log(`[AI Session Flow] Completed. Proposed ${tradesToExecute.length} trades. Final Reasoning: ${overallReasoning}`);
    return {
      tradesToExecute,
      overallReasoning,
    };
  }
);

// OLDER FLOW - Kept for compatibility if `volatility-trading/page.tsx` still uses it directly for simulation without the new loop.
// Ensure its schemas are also defined/exported or handle its removal if fully deprecated.
// For now, assuming VolatilityTradingStrategyInput and VolatilityTradingStrategyOutput are defined elsewhere or were part of a previous structure.
// If these are missing, they would also cause ReferenceErrors.
// Based on current file, they ARE missing. Let's define them.

export const VolatilityTradingStrategyInputSchema = z.object({
  totalStake: z.number().describe("Total stake amount for the trading strategy."),
  instruments: z.array(VolatilityInstrumentTypeSchema).describe("List of instruments to consider."),
  tradingMode: z.enum(['conservative', 'balanced', 'aggressive']).describe("User's preferred trading mode."),
  aiStrategyId: z.string().optional().describe("Identifier for a specific AI strategy variant."),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)).describe("Record mapping instrument to its price ticks."),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema.optional()).optional().describe("Record mapping instrument to its indicators."),
});
export type VolatilityTradingStrategyInput = z.infer<typeof VolatilityTradingStrategyInputSchema>;

export const VolatilityTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema,
  action: z.enum(['CALL', 'PUT']).describe("Direction of the proposed trade."),
  stake: z.number().describe("Stake for this specific trade."),
  durationSeconds: z.number().int().min(15).describe("Duration of the trade in seconds."),
  reasoning: z.string().describe("AI's reasoning for this trade proposal."),
  // barrier and other contract-specific params could be added if AI generates more complex proposals
});
export type VolatilityTradeProposal = z.infer<typeof VolatilityTradeProposalSchema>;


export const VolatilityTradingStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilityTradeProposalSchema).describe("Array of trades the AI has decided to execute."),
  overallReasoning: z.string().describe("Overall reasoning for the strategy and proposed trades."),
});
export type VolatilityTradingStrategyOutput = z.infer<typeof VolatilityTradingStrategyOutputSchema>;


export const generateVolatilityTradingStrategy = ai.defineFlow(
  {
    name: 'generateVolatilityTradingStrategy', // This is the OLD flow name
    inputSchema: VolatilityTradingStrategyInputSchema, // Using the newly defined schema
    outputSchema: VolatilityTradingStrategyOutputSchema, // Using the newly defined schema
  },
  async (input: VolatilityTradingStrategyInput): Promise<VolatilityTradingStrategyOutput> => {
    // This is a simplified mock implementation for the old flow.
    // Replace with actual logic if this flow is still actively used and needs to be intelligent.
    console.warn("[AI Flow - generateVolatilityTradingStrategy] This is an older/mocked flow. For new multi-instrument session strategies, use generateVolatilitySessionStrategy.");
    const tradesToExecute: VolatilityTradeProposal[] = [];
    let allocatedStake = 0;

    if (input.instruments.length > 0 && input.totalStake > 0) {
        const instrumentToTrade = input.instruments[0]; // Just pick the first one for this mock
        const stakeForThisTrade = Math.min(input.totalStake, 10); // Cap stake for mock

        if (input.instrumentTicks[instrumentToTrade] && input.instrumentTicks[instrumentToTrade].length > 1) {
            const ticks = input.instrumentTicks[instrumentToTrade];
            const lastPrice = ticks[ticks.length -1].price;
            const prevPrice = ticks[ticks.length -2].price;

            tradesToExecute.push({
                instrument: instrumentToTrade,
                action: lastPrice > prevPrice ? 'CALL' : 'PUT', // Simple mock logic
                stake: stakeForThisTrade,
                durationSeconds: 60,
                reasoning: `Mock decision for ${instrumentToTrade} based on simple price change. Last: ${lastPrice}, Prev: ${prevPrice}. Trading Mode: ${input.tradingMode}`,
            });
            allocatedStake += stakeForThisTrade;
        }
    }

    return {
      tradesToExecute,
      overallReasoning: `Mock strategy for ${input.instruments.join(', ')}. Total stake attempted: $${allocatedStake.toFixed(2)}. Trading Mode: ${input.tradingMode}. AI Strategy ID: ${input.aiStrategyId || 'default'}.`,
    };
  }
);
