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


// This is a type alias for external use if needed, actual VolatilityInstrumentType is from @/types
// Remove export of VolatilityInstrumentTypeAlias if it's not strictly needed externally
// or ensure it's also moved to a non-'use server' file if it were a value.
// Since it's a type, it's likely fine, but for maximum safety with 'use server' files,
// only async functions should be exported.
// For now, let's comment it out as it's not directly causing the "found object" error.
// export type VolatilityInstrumentTypeAlias = VolatilityInstrumentType;
