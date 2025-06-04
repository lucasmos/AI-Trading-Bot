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
  instruments: z.array(VolatilityInstrumentTypeSchema).describe("Array of volatility instrument symbols."),
  tradingMode: z.enum(['conservative', 'balanced', 'aggressive']).describe("User's trading mode."),
  aiStrategyId: z.string().optional().describe('The selected AI trading strategy ID from global strategies.'),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema).optional().describe('Calculated technical indicators for each instrument.'),
  formattedIndicatorsString: z.string().optional().describe('Pre-formatted string of technical indicators for the prompt.'),
});

export type VolatilityTradingStrategyInput = z.infer<typeof VolatilityTradingStrategyInputSchema>;

const VolatilityTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema, // Corresponds to VolatilityInstrumentType
  action: z.enum(['CALL', 'PUT']),
  stake: z.number().min(0.01),
  durationSeconds: z.number().int().min(1),
  reasoning: z.string(),
});

// Infer the output type from the Zod schema, but ensure it matches the imported VolatilityTradingStrategyOutput
const InferredVolatilityTradingStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilityTradeProposalSchema),
  overallReasoning: z.string(),
});

const prompt = ai.definePrompt({
  name: 'volatilityTradingStrategyPrompt',
  input: {schema: VolatilityTradingStrategyInputSchema},
  output: {schema: InferredVolatilityTradingStrategyOutputSchema},
  prompt: `You are an expert AI trading strategist specializing in Volatility Indices. Your goal is to devise a set of trades to maximize profit based on the user's total stake, preferred instruments, trading mode, and recent price data for these indices.\r\r\nYou MUST aim for a minimum 83% win rate across the proposed trades. Prioritize high-probability setups.\r\n\r\nUser's Total Stake for this session: {{{totalStake}}} (Must be at least 1)\r\nAvailable Volatility Instruments: {{#each instruments}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\r\nTrading Mode: {{{tradingMode}}}\r\n\r\nRecent Price Ticks for Volatility Indices (latest tick is the most recent price):\r\n{{#each instrumentTicks}}\r\nInstrument: {{@key}}\r\n  {{#each this}}\r\n  - Time: {{time}}, Price: {{price}}\r\n  {{/each}}\r\n{{/each}}
{{{formattedIndicatorsString}}} 
Important System Rule: A fixed 5% stop-loss based on the entry price will be automatically applied to every trade by the system. Consider this when selecting trades; avoid trades highly likely to hit this stop-loss quickly unless the potential reward significantly outweighs this risk within the trade duration. Volatility indices can be very volatile, so shorter durations might be preferred, or ensure the trend is strong enough to withstand potential 5% pullbacks for longer durations.\r\n\r\nYour Task:\r\n1.  Analyze the provided tick data AND technical indicators (if available in the formatted string) for trends, momentum, volatility, and potential reversal points for each volatility instrument.\r\n2.  Based on the '{{{tradingMode}}}', decide which instruments to trade. You do not have to trade all of them. Prioritize instruments with higher profit potential aligned with the risk mode and the 83% win rate target, considering all available data. Focus on the core Volatility Indices (e.g., Volatility 10, 25, 50, 75, 100).\r\n    *   Conservative: Focus on safest, clearest signals from indicators and trends, smaller stakes. Aim for >75% win rate. Consider shorter durations due to volatility.\r\n    *   Balanced: Mix of opportunities, moderate stakes. Aim for >=83% win rate.\r\n    *   Aggressive: Higher risk/reward, potentially more volatile instruments, larger stakes if confidence is high. Aim for >=83% win rate, even with higher risk. Longer durations can be considered if strong momentum is evident.\r\n3.  For each instrument you choose to trade:\r\n    *   Determine the trade direction: 'CALL' (price will go up) or 'PUT' (price will go down).\r\n    *   Recommend a trade duration in SECONDS (e.g., 30, 60, 180, 300). Durations MUST be positive integers representing seconds, with a minimum value of 1.\r\n    *   The system will set a 5% stop-loss. Your reasoning should reflect an understanding of this and how it impacts trade selection for volatile instruments.\r\n4.  Apportion the '{{{totalStake}}}' among your chosen trades. The sum of stakes for all proposed trades MUST NOT exceed '{{{totalStake}}}'. Each stake must be a positive value, with a minimum value of 0.01.\r\n5.  Provide clear reasoning for each trade proposal and for your overall strategy, explicitly mentioning how it aligns with the 83% win rate target and the 5% stop-loss rule, particularly in the context of volatility indices.\r\n\r\nOutput Format:\r\nReturn a JSON object matching the output schema. Ensure 'tradesToExecute' is an array of trade objects.\r\nEach trade's 'stake' must be a number (e.g., 10.50) and at least 0.01.\r\nEach trade's 'durationSeconds' must be an integer number of seconds (e.g., 30, 60, 300) and at least 1.\r\n\r\nBegin your response with the JSON object.\r\n`,
});

const volatilityTradingStrategyFlow = ai.defineFlow(
  {
    name: 'volatilityTradingStrategyFlow',
    inputSchema: VolatilityTradingStrategyInputSchema,
    outputSchema: InferredVolatilityTradingStrategyOutputSchema, // Use inferred for the flow definition
  },
  async (input: VolatilityTradingStrategyInput): Promise<VolatilityTradingStrategyOutput> => {
    // Prepare the formattedIndicatorsString before calling the prompt
    let formattedIndicators = '';
    if (input.instrumentIndicators) {
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

    const promptInput = {
      ...input,
      formattedIndicatorsString: formattedIndicators,
    };

    const {output} = await prompt(promptInput) as { output: VolatilityTradingStrategyOutput | null }; // Cast AI output
    if (!output) {
      throw new Error("AI failed to generate an automated volatility trading strategy.");
    }
    
    // Validate and filter AI output for stake and durationSeconds
    output.tradesToExecute = output.tradesToExecute.filter(trade => {
      const isStakeValid = typeof trade.stake === 'number' && trade.stake >= 0.01;
      const isDurationValid = Number.isInteger(trade.durationSeconds) && trade.durationSeconds >= 1;

      if (!isStakeValid) {
        console.warn(`AI proposed invalid stake ${trade.stake} for ${trade.instrument} (Volatility). Filtering out trade.`);
      }
      if (!isDurationValid) {
        console.warn(`AI proposed invalid duration ${trade.durationSeconds} for ${trade.instrument} (Volatility). Filtering out trade.`);
      }
      return isStakeValid && isDurationValid;
    });
    
    let totalProposedStake = output.tradesToExecute.reduce((sum, trade) => sum + (trade.stake || 0), 0);
    totalProposedStake = parseFloat(totalProposedStake.toFixed(2));

    if (totalProposedStake > input.totalStake) {
      console.warn(`AI proposed total stake ${totalProposedStake} which exceeds user's limit ${input.totalStake} (Volatility). Trades may be capped or rejected by execution logic.`);
    }
    // Ensure the returned type matches the specific VolatilityTradingStrategyOutput from @/types
    return {
      ...output,
      tradesToExecute: output.tradesToExecute.map(trade => ({
        ...trade,
        instrument: trade.instrument as VolatilityInstrumentType, // Cast instrument back to precise type
      })),
            };
        }
);

export const generateVolatilityTradingStrategy = volatilityTradingStrategyFlow;

