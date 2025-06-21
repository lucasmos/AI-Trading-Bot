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
import type { VolatilityInstrumentType, TradingMode, PriceTick, VolatilityTradingStrategyOutput, VolatilityTradeProposal } from '@/types';

// Define a schema for individual instrument indicators
const InstrumentIndicatorDataSchema = z.object({
  rsi: z.number().optional(),
  macd: z.object({ macd: z.number(), signal: z.number(), histogram: z.number() }).optional(),
  bollingerBands: z.object({ upper: z.number(), middle: z.number(), lower: z.number() }).optional(),
  ema: z.number().optional(),
  atr: z.number().optional(),
});

// Re-define PriceTick schema locally for this flow if it's not directly importable or to avoid complex imports
const PriceTickSchema = z.object({
  epoch: z.number(),
  price: z.number(),
  time: z.string(),
});

// Use z.string() for instrument keys/names and cast to VolatilityInstrumentType in code where needed.
const VolatilityInstrumentTypeSchema = z.string();

const VolatilityTradingStrategyInputSchema = z.object({
  totalStake: z.number().min(1).describe("User's total stake for the session."),
  instruments: z.array(VolatilityInstrumentTypeSchema).describe("Array of volatility instrument symbols (user-friendly names)."),
  tradingMode: z.enum(['conservative', 'balanced', 'aggressive']).describe("User's trading mode."),
  aiStrategyId: z.string().optional().describe('The selected AI trading strategy ID from global strategies.'),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema).optional().describe('Calculated technical indicators for each instrument.'),
  formattedIndicatorsString: z.string().optional().describe('Pre-formatted string of technical indicators for the prompt.'),
  availableInstrumentOfferings: z.string().optional().describe("A JSON string detailing available Deriv contract types, durations (min/max with units like s,t,m,d), and barrier requirements for each volatility instrument. AI MUST use this to make valid proposals for contract_type, duration_value, duration_unit, barrier, and last_digit_prediction."),
});

export type VolatilityTradingStrategyInput = z.infer<typeof VolatilityTradingStrategyInputSchema>;

const VolatilityTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema.describe("User-friendly instrument name, e.g., 'Volatility 100 Index'."),
  contract_type: z.string().describe("Specific Deriv contract type, e.g., CALL, PUT, DIGITMATCH, DIGITODD, MULTUP. Must be chosen from availableInstrumentOfferings."),
  stake: z.number().min(0.01).describe("Stake for this specific trade."),
  duration_value: z.number().int().min(1).describe("The value for the duration (e.g., 30, 5). Must be valid for the chosen instrument and contract_type based on availableInstrumentOfferings."),
  duration_unit: z.enum(['s', 'm', 'h', 'd', 't']).describe("Unit for the duration: s=seconds, m=minutes, h=hours, d=days, t=ticks. Must be valid for the chosen instrument and contract_type based on availableInstrumentOfferings."),
  reasoning: z.string().describe("Clear reasoning for proposing this trade."),
  barrier: z.string().optional().describe("Barrier for certain contract types (e.g., HIGHER, LOWER, DIGITOVER, DIGITUNDER). Can be relative (+/- value like '+2.5') or absolute (a price like '123.45'). Required if the chosen contract_type needs it, based on availableInstrumentOfferings."),
  last_digit_prediction: z.number().int().min(0).max(9).optional().describe("Predicted last digit (0-9) for DIGITMATCH/DIGITDIFF contracts. Required if contract_type is DIGITMATCH or DIGITDIFF."),
});

const InferredVolatilityTradingStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilityTradeProposalSchema),
  overallReasoning: z.string(),
});

const prompt = ai.definePrompt({
  name: 'volatilityTradingStrategyPrompt',
  input: {schema: VolatilityTradingStrategyInputSchema},
  output: {schema: InferredVolatilityTradingStrategyOutputSchema},
  prompt: `You are an expert AI trading strategist for Deriv Volatility Indices. Your goal is to devise trades to maximize profit based on the user's total stake, preferred instruments, trading mode, recent price data, and crucially, the **available contract offerings for each instrument**.
You MUST aim for a minimum 83% win rate. Prioritize high-probability setups.

User's Total Stake for this session: {{{totalStake}}} (Must be at least 0.35 for most contracts)
Available Volatility Instruments (user-friendly names): {{#each instruments}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Trading Mode: {{{tradingMode}}}

Recent Price Ticks for Volatility Indices (latest tick is the most recent price):
{{#each instrumentTicks}}
Instrument: {{@key}}
  {{#each this}}
  - Time: {{time}}, Price: {{price}}
  {{/each}}
{{/each}}

{{{formattedIndicatorsString}}}

**Crucial: Available Contract Offerings for each instrument (JSON format):**
This data specifies exactly which contract types, durations (min/max and units 's', 't', 'm', 'd'), and barrier requirements are available. You MUST adhere to these offerings.
{{{availableInstrumentOfferings}}}

Important System Rule: A fixed 5% stop-loss based on the entry price will be automatically applied by the system to Rise/Fall (CALL/PUT) contracts if a stop-loss is not part of the contract's native parameters. This is a conceptual guideline for risk; for contracts like Multipliers or those with explicit stop-loss parameters, those parameters will be used. For standard options, the risk is limited to the stake.

Your Task:
1.  Analyze tick data, technical indicators, AND the 'availableInstrumentOfferings' for trends, momentum, volatility, and potential entry points for each instrument.
2.  Based on '{{{tradingMode}}}' and available offerings, decide which instruments and contract types to trade.
    *   Conservative: Safest signals, smaller stakes. Focus on contract types with clear probability (e.g., ATM CALL/PUT if trend is strong, or DIGITDIFF if volatility is low and a digit seems unlikely).
    *   Balanced: Mix of opportunities, moderate stakes.
    *   Aggressive: Higher risk/reward, potentially more complex contract types if offerings allow and data supports.
3.  For each chosen trade:
    *   **instrument**: Use the user-friendly name provided (e.g., 'Volatility 100 Index').
    *   **contract_type**: Select a SPECIFIC Deriv contract type (e.g., "CALL", "PUT", "DIGITMATCH", "DIGITDIFF", "DIGITOVER", "MULTUP") that is listed as available for the instrument in 'availableInstrumentOfferings'.
    *   **stake**: Allocate a portion of '{{{totalStake}}}'. Min stake is usually around $0.35-$1.00.
    *   **duration_value**: An integer (e.g., 30, 5, 2).
    *   **duration_unit**: 's' (seconds), 'm' (minutes), 'h' (hours), 'd' (days), or 't' (ticks). Both value and unit must be within the min/max range specified in 'availableInstrumentOfferings' for the chosen contract_type and instrument.
    *   **barrier**: REQUIRED if the chosen 'contract_type' (e.g., DIGITOVER, DIGITUNDER, non-ATM CALL/PUT like HIGHER/LOWER) needs it, as specified in 'availableInstrumentOfferings'. Can be relative (e.g., "+2.05", "-0.50") or absolute.
    *   **last_digit_prediction**: REQUIRED if 'contract_type' is "DIGITMATCH" or "DIGITDIFF". Must be an integer from 0-9.
    *   **reasoning**: Clear justification.
4.  The sum of stakes MUST NOT exceed '{{{totalStake}}}'.
5.  Provide overall strategy reasoning, referencing how choices align with 'availableInstrumentOfferings'.

Output Format:
Return a JSON object matching the output schema.
'tradesToExecute' is an array of trade objects.
Each trade must have 'instrument', 'contract_type', 'stake', 'duration_value', 'duration_unit', 'reasoning'.
'barrier' and 'last_digit_prediction' should ONLY be included if required by the chosen 'contract_type' for that instrument.

Begin your response with the JSON object.
`,
});

// Import Deriv services - ensure these are available in the server environment
import { getGlobalTradingOfferings, getVolatilityInstrumentOfferings, instrumentToDerivSymbol } from '@/services/deriv';
import type { TradingDurationsData, TradeTypeDurations } from '@/services/deriv';


const volatilityTradingStrategyFlow = ai.defineFlow(
  {
    name: 'volatilityTradingStrategyFlow',
    inputSchema: VolatilityTradingStrategyInputSchema,
    outputSchema: InferredVolatilityTradingStrategyOutputSchema,
  },
  async (input: VolatilityTradingStrategyInput): Promise<VolatilityTradingStrategyOutput> => {
    let formattedIndicators = '';
    if (input.instrumentIndicators) {
      // ... (indicator formatting remains the same)
      formattedIndicators = '\n\nCalculated Technical Indicators:\n';
      for (const inst in input.instrumentIndicators) {
        const ind = input.instrumentIndicators[inst as VolatilityInstrumentType];
        formattedIndicators += `Instrument: ${inst}\n`;
        formattedIndicators += `  RSI: ${ind.rsi?.toFixed(4) ?? 'N/A'}\n`;
        formattedIndicators += `  MACD: ${ind.macd ? `Line(${ind.macd.macd.toFixed(4)}), Signal(${ind.macd.signal.toFixed(4)}), Hist(${ind.macd.histogram.toFixed(4)})` : 'N/A'}\n`;
        formattedIndicators += `  Bollinger Bands: ${ind.bollingerBands ? `Upper(${ind.bollingerBands.upper.toFixed(4)}), Middle(${ind.bollingerBands.middle.toFixed(4)}), Lower(${ind.bollingerBands.lower.toFixed(4)})` : 'N/A'}\n`;
        formattedIndicators += `  EMA: ${ind.ema?.toFixed(4) ?? 'N/A'}\n`;
        formattedIndicators += `  ATR: ${ind.atr?.toFixed(4) ?? 'N/A'}\n`;
      }
    }

    let availableOfferingsString = "{}"; // Default to empty JSON object string
    try {
      // Fetch global offerings once. In a real app, this might be cached.
      // Assuming no token is needed for getGlobalTradingOfferings for synthetic indices, or it's handled internally.
      const globalOfferings: TradingDurationsData = await getGlobalTradingOfferings();

      const offeringsForPrompt: Record<string, TradeTypeDurations[]> = {};
      if (globalOfferings && input.instruments) {
        for (const userFriendlyInstrumentName of input.instruments) {
          const derivSymbol = instrumentToDerivSymbol(userFriendlyInstrumentName as InstrumentType); // Cast needed
          const specificOfferings = getVolatilityInstrumentOfferings(derivSymbol, globalOfferings);
          if (specificOfferings.length > 0) {
            offeringsForPrompt[userFriendlyInstrumentName] = specificOfferings; // Use user-friendly name as key for AI
          }
        }
      }
      if (Object.keys(offeringsForPrompt).length > 0) {
        availableOfferingsString = JSON.stringify(offeringsForPrompt, null, 2);
      } else {
        console.warn("[volatilityTradingStrategyFlow] No specific offerings could be compiled for the provided instruments. AI will have limited info on available contract types/durations.");
        availableOfferingsString = JSON.stringify({ note: "Could not retrieve specific contract offerings. AI should attempt general contract types like CALL/PUT with common durations (e.g., 30s, 60s, 5t, 10t) if making proposals." });
      }
    } catch (error) {
      console.error("[volatilityTradingStrategyFlow] Error fetching or processing instrument offerings:", error);
      availableOfferingsString = JSON.stringify({ error: "Failed to retrieve instrument offerings. AI should proceed with caution, defaulting to common contract types if possible." });
    }

    const promptInput = {
      ...input,
      formattedIndicatorsString: formattedIndicators,
      availableInstrumentOfferings: availableOfferingsString,
    };

    const {output} = await prompt(promptInput) as { output: VolatilityTradingStrategyOutput | null };
    if (!output) {
      throw new Error("AI failed to generate an automated volatility trading strategy.");
    }
    
    output.tradesToExecute = output.tradesToExecute.filter(trade => {
      const isStakeValid = typeof trade.stake === 'number' && trade.stake >= 0.01;
      // Validate new duration fields
      const isDurationValueValid = Number.isInteger(trade.duration_value) && trade.duration_value >= 1;
      const isDurationUnitValid = ['s', 'm', 'h', 'd', 't'].includes(trade.duration_unit);
      const isContractTypeValid = typeof trade.contract_type === 'string' && trade.contract_type.length > 0;

      if (!isStakeValid) console.warn(`AI proposed invalid stake ${trade.stake} for ${trade.instrument}. Filtering out.`);
      if (!isDurationValueValid) console.warn(`AI proposed invalid duration_value ${trade.duration_value} for ${trade.instrument}. Filtering out.`);
      if (!isDurationUnitValid) console.warn(`AI proposed invalid duration_unit ${trade.duration_unit} for ${trade.instrument}. Filtering out.`);
      if (!isContractTypeValid) console.warn(`AI proposed invalid contract_type ${trade.contract_type} for ${trade.instrument}. Filtering out.`);

      // Additional validation for barrier/last_digit_prediction based on contract_type
      if (trade.contract_type === 'DIGITMATCH' || trade.contract_type === 'DIGITDIFF') {
        if (trade.last_digit_prediction === undefined || trade.last_digit_prediction < 0 || trade.last_digit_prediction > 9) {
          console.warn(`AI proposed ${trade.contract_type} for ${trade.instrument} without a valid last_digit_prediction. Filtering out.`);
          return false;
        }
      }
      // Add more specific validations for barrier if other contract types needing it are common

      return isStakeValid && isDurationValueValid && isDurationUnitValid && isContractTypeValid;
    });
    
    let totalProposedStake = output.tradesToExecute.reduce((sum, trade) => sum + (trade.stake || 0), 0);
    totalProposedStake = parseFloat(totalProposedStake.toFixed(2));

    if (totalProposedStake > input.totalStake) {
      console.warn(`AI proposed total stake ${totalProposedStake} which exceeds user's limit ${input.totalStake}. Trades may be capped or rejected.`);
    }

    return {
      ...output,
      tradesToExecute: output.tradesToExecute.map(trade => ({
        ...trade,
        instrument: trade.instrument as VolatilityInstrumentType,
      })),
    };
  }
);

export const generateVolatilityTradingStrategy = volatilityTradingStrategyFlow;

