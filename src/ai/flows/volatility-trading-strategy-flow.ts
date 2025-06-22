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

const VolatilitySingleTradeStrategyInputSchema = z.object({
  currentInstrument: VolatilityInstrumentTypeSchema.describe("The specific volatility instrument to analyze for a trade."),
  userSelectedTradeType: UserTradeTypeSchema.describe("The type of trade selected by the user."),
  stakePerTrade: z.number().min(0.01).describe("The allocated stake for this potential trade."),
  instrumentTicks: z.array(PriceTickSchema).describe("Recent price ticks for the current instrument."),
  instrumentIndicators: InstrumentIndicatorDataSchema.optional().describe('Calculated technical indicators for the current instrument.'),
});
export type VolatilitySingleTradeStrategyInput = z.infer<typeof VolatilitySingleTradeStrategyInputSchema>;

const VolatilitySingleTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema,
  shouldTrade: z.boolean().describe("Whether the AI recommends placing a trade or not."),
  derivContractType: z.string().optional().describe("The specific Deriv API contract type (e.g., CALL, PUT, DIGITEVEN, ONETOUCH). Required if shouldTrade is true."),
  duration: z.number().int().min(1).optional().describe("Trade duration value. Required if shouldTrade is true."),
  durationUnit: z.enum(['s', 'm', 'h', 'd', 't']).optional().describe("Unit for the duration (e.g., seconds, ticks). Required if shouldTrade is true."),
  barrier: z.union([z.string(), z.number()]).optional().describe("Predicted barrier or digit, if applicable to the trade type."),
  stake: z.number().min(0.01).optional().describe("Proposed stake for this trade. Required if shouldTrade is true."),
  reasoning: z.string().describe("AI's reasoning for the decision."),
});
export type VolatilitySingleTradeProposal = z.infer<typeof VolatilitySingleTradeProposalSchema>;


const determineDerivContractTypePrompt = ai.definePrompt({
  name: 'determineDerivContractTypePrompt',
  input: { schema: VolatilitySingleTradeStrategyInputSchema },
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

{{#if instrumentIndicators}}
Calculated Technical Indicators for {{{currentInstrument}}}:
  RSI: {{#if instrumentIndicators.rsi}}{{instrumentIndicators.rsi.toFixed 4}}{{else}}N/A{{/if}}
  MACD: {{#if instrumentIndicators.macd}}Line: {{instrumentIndicators.macd.macd.toFixed 4}}, Signal: {{instrumentIndicators.macd.signal.toFixed 4}}, Hist: {{instrumentIndicators.macd.histogram.toFixed 4}}{{else}}N/A{{/if}}
  Bollinger Bands: {{#if instrumentIndicators.bollingerBands}}Upper: {{instrumentIndicators.bollingerBands.upper.toFixed 4}}, Middle: {{instrumentIndicators.bollingerBands.middle.toFixed 4}}, Lower: {{instrumentIndicators.bollingerBands.lower.toFixed 4}}{{else}}N/A{{/if}}
  EMA (20): {{#if instrumentIndicators.ema}}{{instrumentIndicators.ema.toFixed 4}}{{else}}N/A{{/if}}
  ATR (14): {{#if instrumentIndicators.atr}}{{instrumentIndicators.atr.toFixed 4}}{{else}}N/A{{/if}}
{{else}}
No technical indicators provided. Base your decision on price action and trade type logic.
{{/if}}

Your Task:
1. Based on the user's selected trade type ('{{{userSelectedTradeType}}}') and your analysis of the instrument data (price ticks and indicators if available), decide if a trade is viable.
2. If a trade is viable (set 'shouldTrade: true'):
   a. Determine the precise Deriv API contract type ('derivContractType'). Examples:
      - For 'RiseFall': 'CALL' (if you predict price will rise) or 'PUT' (if you predict price will fall).
      - For 'HigherLower': 'CALL' (if you predict price will be higher than barrier) or 'PUT' (if price lower). Requires a 'barrier' (a specific price value, or a relative offset like "+0.123" or "-0.123").
      - For 'TouchNoTouch': 'ONETOUCH' (if you predict price will touch barrier) or 'NOTOUCH' (if not). Requires a 'barrier' (a specific price value or relative offset).
      - For 'DigitsEvenOdd': 'DIGITEVEN' (if you predict last digit is even) or 'DIGITODD' (if odd).
      - For 'DigitsOverUnder': 'DIGITOVER' (if you predict last digit > barrier) or 'DIGITUNDER' (if last digit < barrier). Requires a 'barrier' (the predicted reference digit, 0-8 for Over, 1-9 for Under).
   b. Recommend a trade 'duration' (integer) and its 'durationUnit' ('s' for seconds, 'm' for minutes, 't' for ticks). For Digits, duration is in ticks ('t'), typically 1-10 ticks. For others, usually seconds ('s') or minutes ('m'). Minimum duration is 1 tick or 1 second.
   c. If the '{{{userSelectedTradeType}}}' requires a barrier (i.e., 'HigherLower', 'TouchNoTouch', 'DigitsOverUnder'), provide the 'barrier' value.
      - For 'HigherLower'/'TouchNoTouch', 'barrier' is a price string (e.g., "123.45" for absolute, or "+0.123" for relative offset from current spot).
      - For 'DigitsOverUnder', 'barrier' is a single digit string (e.g., "7"). The prediction is relative to this digit.
   d. The 'stake' for this trade should be {{{stakePerTrade}}}. Include this in your proposal.
3. If no trade is viable (e.g., unclear signals, high risk for the chosen trade type), set 'shouldTrade: false'.
4. Provide concise 'reasoning' for your decision, explaining how the data supports your choice for the given '{{{userSelectedTradeType}}}'.

Output Format: Return a single JSON object matching the output schema.
If 'shouldTrade' is true, 'derivContractType', 'duration', 'durationUnit', and 'stake' are mandatory.
'barrier' is mandatory if 'shouldTrade' is true AND the '{{{userSelectedTradeType}}}' is 'HigherLower', 'TouchNoTouch', or 'DigitsOverUnder'.

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
    const promptInput = {
      ...input,
      instrumentIndicators: input.instrumentIndicators || null,
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
      const requiresBarrier = input.userSelectedTradeType === 'HigherLower' || input.userSelectedTradeType === 'TouchNoTouch' || input.userSelectedTradeType === 'DigitsOverUnder';
      if (requiresBarrier && (output.barrier === undefined || output.barrier === null || String(output.barrier).trim() === '')) {
        validationError = `Barrier is required for ${input.userSelectedTradeType} but was not provided by AI.`;
      }

      if (input.userSelectedTradeType === 'DigitsOverUnder' && output.barrier !== undefined) {
        const barrierNum = parseInt(String(output.barrier));
        if (isNaN(barrierNum) || barrierNum < 0 || barrierNum > 9) {
          validationError = `Invalid barrier '${output.barrier}' for DigitsOverUnder. Must be a digit 0-9.`;
        }
      }

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


// This is a type alias for external use if needed, actual VolatilityInstrumentType is from @/types
// Remove export of VolatilityInstrumentTypeAlias if it's not strictly needed externally
// or ensure it's also moved to a non-'use server' file if it were a value.
// Since it's a type, it's likely fine, but for maximum safety with 'use server' files,
// only async functions should be exported.
// For now, let's comment it out as it's not directly causing the "found object" error.
// export type VolatilityInstrumentTypeAlias = VolatilityInstrumentType;
