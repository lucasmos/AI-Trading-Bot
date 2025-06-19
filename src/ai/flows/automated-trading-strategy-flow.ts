'use server';
/**
 * @fileOverview AI flow for generating an automated trading strategy for Forex, Crypto, and Commodities.
 *
 * - generateAutomatedTradingStrategy - A function that creates a trading plan.
 * - AutomatedTradingStrategyInput - The input type.
 * - AutomatedTradingStrategyOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import * as zod from 'zod'; // Use 'zod' to avoid conflict if 'z' is used elsewhere
import type { 
  ForexCryptoCommodityInstrumentType, 
  TradingMode, 
  PriceTick, 
  AutomatedTradingStrategyOutput as ImportedAutomatedTradingStrategyOutput,
  AutomatedTradeProposal as ImportedAutomatedTradeProposal
} from '@/types';
import { FOREX_CRYPTO_COMMODITY_INSTRUMENTS } from '@/config/instruments';

// Define a schema for individual instrument indicators (can be shared or redefined)
const InstrumentIndicatorDataSchema = zod.object({
  rsi: zod.number().optional(),
  macd: zod.object({ macd: zod.number(), signal: zod.number(), histogram: zod.number() }).optional(),
  bollingerBands: zod.object({ upper: zod.number(), middle: zod.number(), lower: zod.number() }).optional(),
  ema: zod.number().optional(),
  atr: zod.number().optional(),
});

const PriceTickSchema = zod.object({
  epoch: zod.number(),
  price: zod.number(),
  time: zod.string(),
});

const ForexCryptoCommodityInstrumentTypeSchema = zod.string(); // This will be replaced by zod.enum

const AutomatedTradingStrategyInputZodSchema = zod.object({ // Renamed to avoid conflict with exported type alias
  totalStake: zod.number().min(1),
  instruments: zod.array(zod.enum(FOREX_CRYPTO_COMMODITY_INSTRUMENTS as [string, ...string[]])),
  tradingMode: zod.enum(['conservative', 'balanced', 'aggressive']),
  aiStrategyId: zod.string().optional().describe('The selected AI trading strategy ID.'),
  stopLossPercentage: zod.number().min(1).max(50).optional().describe('User-defined stop-loss percentage (e.g., 1-50%). Default is 5% if not provided.'),
  instrumentTicks: zod.record(ForexCryptoCommodityInstrumentTypeSchema, zod.array(PriceTickSchema)),
  instrumentIndicators: zod.record(ForexCryptoCommodityInstrumentTypeSchema, InstrumentIndicatorDataSchema).optional().describe('Calculated technical indicators for each instrument.'),
  formattedIndicatorsString: zod.string().optional().describe('Pre-formatted string of technical indicators for the prompt.'),
  instrumentOfferings: zod.record(
    zod.string(), // Instrument symbol (e.g., "frxEURUSD")
    zod.object({
      rise_fall: zod.array(zod.string()).optional(), // Array of valid duration strings (e.g., ["15m", "1h"])
      tradingTimesData: zod.any().optional().describe('Raw trading times data from API for the instrument.'), // Original field for data from page.tsx
      tradingTimesDataString: zod.string().optional().describe('JSON string representation of trading times data, or error message.'), // New field for prompt
      isMarketCurrentlyOpen: zod.boolean().optional().describe('Whether the market for this instrument is determined to be currently open based on its detailed trading hours.') // New field
      // Future: extendable for other contract types like 'multiplier'
    })
  ).optional().describe('Specific available trade types (e.g., rise_fall) and their exact string durations, and trading times for each instrument symbol.')
});

// This is the type for the flow function's input parameter
type AutomatedTradingStrategyFlowInput = zod.infer<typeof AutomatedTradingStrategyInputZodSchema>;

// Export this if it's intended to be used externally, otherwise it's internal to this flow
export type AutomatedTradingStrategyInput = AutomatedTradingStrategyFlowInput; 

const AutomatedTradeProposalZodSchema = zod.object({
  instrument: ForexCryptoCommodityInstrumentTypeSchema,
  action: zod.enum(['CALL', 'PUT']),
  stake: zod.number().min(0.01),
  durationString: zod.string().describe('The exact duration string, e.g., "15m", "60s", "1h", selected from available offerings.'),
  reasoning: zod.string(),
});

const InferredAutomatedTradingStrategyOutputSchema = zod.object({
  tradesToExecute: zod.array(AutomatedTradeProposalZodSchema),
  overallReasoning: zod.string(),
});

const prompt = ai.definePrompt({
  name: 'automatedTradingStrategyPrompt',
  input: {schema: AutomatedTradingStrategyInputZodSchema},
  output: {schema: InferredAutomatedTradingStrategyOutputSchema},
  prompt: `You are an expert AI trading strategist for Forex, Cryptocurrencies, and Commodities. Your goal is to devise a set of trades to maximize profit based on the user's total stake, preferred instruments, trading mode, and recent price data.\r\r\nYou MUST aim for a minimum 83% win rate across the proposed trades. Prioritize high-probability setups.\r\n\r\nUser's Total Stake for this session: {{{totalStake}}} (Must be at least 1)\r\nAvailable Instruments (Forex/Crypto/Commodities): {{#each instruments}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\r\nTrading Mode: {{{tradingMode}}}\r\nUser-defined Stop-Loss Percentage: {{#if stopLossPercentage}}{{{stopLossPercentage}}}% (This will override the default system stop-loss){{else}}System Default 5%{{/if}}\r\n\r\nRecent Price Ticks (latest tick is the most recent price):\r\n{{#each instrumentTicks}}\r\nInstrument: {{@key}}\r\n  {{#each this}}\r\n  - Time: {{time}}, Price: {{price}}\r\n  {{/each}}\r\n{{/each}}
{{{formattedIndicatorsString}}}
Available Trade Offerings by Instrument (IMPORTANT!):
{{#if instrumentOfferings}}
  {{#each instrumentOfferings}}
  For Instrument: {{@key}}
    {{#if this.isMarketCurrentlyOpen}}
    - Current Market Status: OPEN (explicitly determined)
    {{else if (eq this.isMarketCurrentlyOpen false)}}
    - Current Market Status: CLOSED (explicitly determined)
    {{else}}
    - Current Market Status: Unknown (rely on Trading Hours Data below)
    {{/if}}
    {{#if this.rise_fall}}
    - Trade Type: Rise/Fall (CALL/PUT)
      Available Durations: {{#if this.rise_fall.length}}{{#each this.rise_fall}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
    {{else}}
    - No Rise/Fall trade type specified for this instrument in the offerings.
    {{/if}}
    {{#if this.tradingTimesDataString}}
    - Trading Hours Data (for detailed checks if OPEN): {{{this.tradingTimesDataString}}}
    {{else}}
    - Trading Hours: Data explicitly not available or not processed.
    {{/if}}
  {{/each}}
{{else}}
(Detailed instrument-specific offerings not provided. You will have to rely on general knowledge for durations, but this is less reliable.)
{{/if}}

Important System Rule: A stop-loss based on {{#if stopLossPercentage}}{{{stopLossPercentage}}}% (user-defined){{else}}a fixed 5% (system default){{/if}} of the entry price will be automatically applied to every trade by the system. Consider this when selecting trades; avoid trades highly likely to hit this stop-loss quickly unless the potential reward significantly outweighs this risk within the trade duration.\r\n\r\nYour Task:\r\n1.  Analyze the provided tick data AND technical indicators (if available in the formatted string) for trends, momentum, volatility, and potential reversal points for each instrument.\r\n2.  **Primary Rule: For each instrument, a flag 'isMarketCurrentlyOpen' is provided under 'Available Trade Offerings by Instrument'. If 'isMarketCurrentlyOpen' is explicitly 'false', YOU MUST NOT propose a trade for that instrument, regardless of any other indicators. If 'isMarketCurrentlyOpen' is explicitly 'true', you should then verify with the 'Trading Hours Data' that your intended trade duration falls within active sessions and avoid proposing trades near market closing times unless specifically justified by the strategy. If the 'isMarketCurrentlyOpen' flag is not provided or is unknown for an instrument, you must then carefully check its 'Trading Hours Data'. If this data indicates the market for the instrument is likely closed at the current time (assume current time is UTC and within a few minutes of the 'Recent Price Ticks' timestamps), or if no trading hours data is available or shows an error, DO NOT propose a trade for that instrument.**
    Based on the '{{{tradingMode}}}', decide which instruments to trade (respecting the market status rules above). You do not have to trade all of them.
    Prioritize instruments confirmed to be open. Prioritize instruments with higher profit potential aligned with the risk mode and the 70% win rate target, considering all available data.\r\n    *   Conservative: Focus on safest, clearest signals from indicators and trends, smaller stakes. Aim for >75% win rate.\r\n    *   Balanced: Mix of opportunities, moderate stakes. Aim for >=70% win rate.\r\n    *   Aggressive: Higher risk/reward, potentially more volatile instruments, larger stakes if confidence is high. Aim for >=70% win rate, even with higher risk.\r\n3.  For each instrument you choose to trade:\r\n    *   Determine the trade direction: 'CALL' (price will go up) or 'PUT' (price will go down).\r\n    *   Recommend a trade duration. **You MUST select a duration from the 'Available Durations' listed for the chosen instrument and 'Rise/Fall' trade type in the 'Available Trade Offerings by Instrument' section.** If no durations are listed for Rise/Fall or the type itself is not available for an instrument, DO NOT propose a Rise/Fall trade for it. Durations are strings like '15m', '1h', '300s'. You must output the chosen duration string exactly as provided in the 'Available Durations' list. The system will parse this string. Do not convert it to seconds yourself. Instead, use the output field named durationString (this is a new field that replaces durationSeconds).
    *   The system will set a {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} stop-loss. Your reasoning should reflect an understanding of this.\r\n4.  Apportion the '{{{totalStake}}}' among your chosen trades. The sum of stakes for all proposed trades MUST NOT exceed '{{{totalStake}}}'. Each stake must be a positive value, with a minimum value of 0.01.
5.  Provide clear reasoning for each trade proposal and for your overall strategy, explicitly mentioning how it aligns with the 70% win rate target and the {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} stop-loss rule.\r\n\r\nOutput Format:\r\nReturn a JSON object matching the output schema. Ensure 'tradesToExecute' is an array of trade objects.\r\nEach trade's 'stake' must be a number (e.g., 10.50) and at least 0.01.
Each trade's 'durationString' must be the exact string from the available offerings (e.g., "15m", "60s").
\r\n\r\nBegin your response with the JSON object.\r\n`,
});

const automatedTradingStrategyFlow = ai.defineFlow(
  {
    name: 'automatedTradingStrategyFlow',
    inputSchema: AutomatedTradingStrategyInputZodSchema, // Use the Zod schema directly
    outputSchema: InferredAutomatedTradingStrategyOutputSchema, 
  },
  async (input: AutomatedTradingStrategyFlowInput): Promise<ImportedAutomatedTradingStrategyOutput> => {
    let formattedIndicators = '';
    if (input.instrumentIndicators) { 
      formattedIndicators = '\n\nCalculated Technical Indicators:\n';
      for (const inst in input.instrumentIndicators) {
        const ind = input.instrumentIndicators[inst as ForexCryptoCommodityInstrumentType];
        if (ind) {
            formattedIndicators += `Instrument: ${inst}\n`;
            formattedIndicators += `  RSI: ${ind.rsi?.toFixed(4) ?? 'N/A'}\n`;
            formattedIndicators += `  MACD: ${ind.macd ? `Line(${ind.macd.macd.toFixed(4)}), Signal(${ind.macd.signal.toFixed(4)}), Hist(${ind.macd.histogram.toFixed(4)})` : 'N/A'}\n`;
            formattedIndicators += `  Bollinger Bands: ${ind.bollingerBands ? `Upper(${ind.bollingerBands.upper.toFixed(4)}), Middle(${ind.bollingerBands.middle.toFixed(4)}), Lower(${ind.bollingerBands.lower.toFixed(4)})` : 'N/A'}\n`;
            formattedIndicators += `  EMA: ${ind.ema?.toFixed(4) ?? 'N/A'}\n`;
            formattedIndicators += `  ATR: ${ind.atr?.toFixed(4) ?? 'N/A'}\n`;
        }
      }
    }

    // Process instrumentOfferings immutably
    const processedInstrumentOfferings: AutomatedTradingStrategyFlowInput['instrumentOfferings'] = {};
    if (input.instrumentOfferings) {
      for (const instrumentKey in input.instrumentOfferings) {
        const originalOffering = input.instrumentOfferings[instrumentKey];
        // Create a new offering object by spreading the originalOffering
        // and explicitly type the newOffering to include tradingTimesDataString
        const newOffering: typeof originalOffering & { tradingTimesDataString?: string } = { ...originalOffering };

        let ttDataString = 'Data not available.'; // Default
        if (originalOffering.tradingTimesData) {
          // Type-safe check for error property
          if (typeof originalOffering.tradingTimesData === 'object' &&
              originalOffering.tradingTimesData !== null &&
              'error' in originalOffering.tradingTimesData &&
              typeof originalOffering.tradingTimesData.error === 'string') {
            ttDataString = `Error fetching trading times: ${originalOffering.tradingTimesData.error}`;
          } else if (typeof originalOffering.tradingTimesData === 'object' && originalOffering.tradingTimesData !== null) {
            // Check if it's not the error object before stringifying
            if (!('error' in originalOffering.tradingTimesData)) {
                 ttDataString = JSON.stringify(originalOffering.tradingTimesData);
            } else {
                // It's an object but has an error property we didn't catch above, or some other structure
                ttDataString = 'Trading times data in unexpected error format.';
            }
          }
          // Non-object tradingTimesData will use the default 'Data not available.'
        }
        newOffering.tradingTimesDataString = ttDataString;
        processedInstrumentOfferings[instrumentKey] = newOffering;
      }
    }

    // Ensure all properties passed to prompt are defined in AutomatedTradingStrategyInputZodSchema
    const promptInput: AutomatedTradingStrategyFlowInput = {
      ...input,
      instruments: input.instruments,
      instrumentOfferings: processedInstrumentOfferings, // Use the new immutable object
      formattedIndicatorsString: formattedIndicators,
    };
    // stopLossPercentage will be passed through via ...input if present

    const result = await prompt(promptInput) as { output: ImportedAutomatedTradingStrategyOutput | null };
    if (!result || !result.output) {
      throw new Error("AI failed to generate an automated trading strategy for Forex/Crypto/Commodities.");
    }
    const output = result.output;
    
    output.tradesToExecute = output.tradesToExecute.filter(trade => {
      const isStakeValid = typeof trade.stake === 'number' && trade.stake >= 0.01;
      // Validate durationString: ensuring it's a non-empty string. More specific validation (matching a pattern) can be added if necessary.
      const isDurationStringValid = typeof trade.durationString === 'string' && trade.durationString.length > 0;
      if (!isStakeValid) console.warn(`AI proposed invalid stake ${trade.stake} for ${trade.instrument}. Filtering out trade.`);
      if (!isDurationStringValid) console.warn(`AI proposed invalid duration string '${trade.durationString}' for ${trade.instrument}. Filtering out trade.`);
      return isStakeValid && isDurationStringValid;
    });
    
    let totalProposedStake = output.tradesToExecute.reduce((sum, trade: ImportedAutomatedTradeProposal) => sum + (trade.stake || 0), 0);
    totalProposedStake = parseFloat(totalProposedStake.toFixed(2));

    if (totalProposedStake > input.totalStake) {
      console.warn(`AI proposed total stake ${totalProposedStake} which exceeds user's limit ${input.totalStake} (Forex/Crypto/Commodities). Trades may be capped or rejected by execution logic.`);
    }

    return {
      ...output,
      tradesToExecute: output.tradesToExecute.map(trade => ({
        ...trade,
        instrument: trade.instrument as ForexCryptoCommodityInstrumentType,
      })),
    };
  }
);

export const generateAutomatedTradingStrategy = automatedTradingStrategyFlow;
