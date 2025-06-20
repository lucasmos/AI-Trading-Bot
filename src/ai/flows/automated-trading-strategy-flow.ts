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

// Schema for detailed contract items from Deriv's contracts_for API
const DetailedDerivContractItemSchema = zod.object({
  contract_type: zod.string().describe("The specific API contract type name, e.g., 'MULTUP', 'CALL', 'PUT'."),
  contract_category: zod.string().optional().describe("Category of the contract, e.g., 'multipliers', 'callput', 'digits'."),
  contract_display: zod.string().optional().describe("User-friendly display name for the contract type, e.g., 'Higher', 'Lower', 'Matches'."),
  market: zod.string().optional().describe("Market type, e.g., 'forex', 'synthetic_index'."),
  submarket: zod.string().optional().describe("Submarket type, e.g., 'major_pairs', 'continuous_index'."),
  underlying_symbol: zod.string().optional().describe("The symbol this contract is for, e.g., 'R_100', 'frxEURUSD'."),
  expiry_type: zod.string().optional().describe("Type of expiry, e.g., 'intraday', 'daily', 'tick'."),
  min_contract_duration: zod.string().optional().describe("Minimum duration for the contract, e.g., '15s', '1m', '2t' (ticks)."),
  max_contract_duration: zod.string().optional().describe("Maximum duration for the contract, e.g., '365d', '24h'."),
  multiplier_range: zod.array(zod.number()).optional().describe("Array of available multiplier values, e.g., [10, 20, 50, 100]."),
  min_multiplier: zod.number().optional().describe("Minimum multiplier value if not specified in range."),
  max_multiplier: zod.number().optional().describe("Maximum multiplier value if not specified in range."),
  barriers: zod.number().optional().describe("Number of barriers, e.g., 0, 1, 2."),
  barrier_category: zod.string().optional().describe("Category of barrier, e.g., 'euro_atm', 'asian'."),
  sentiment: zod.string().optional().describe("Default sentiment if applicable, e.g., 'up', 'down'."),
  start_type: zod.string().optional().describe("How the contract starts, e.g., 'spot', 'forward'."),
  // Other potentially useful fields from contracts_for.available can be added here
  // e.g., low_barrier, high_barrier, barrier (as strings or numbers if consistent)
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
      availableContracts: zod.array(DetailedDerivContractItemSchema).optional().describe("Full list of available contract specifications from contracts_for API for this instrument."),
      isMarketCurrentlyOpen: zod.boolean().optional().describe('Whether the market for this instrument is determined to be currently open based on its detailed trading hours.'),
      tradingTimesData: zod.any().optional().describe('Raw trading times data from API for the instrument.'),
      tradingTimesDataString: zod.string().optional().describe('JSON string representation of trading times data, or error message.'),
      // rise_fall: zod.array(zod.string()).optional() // This is removed as availableContracts provides more detail
    })
  ).optional().describe('Detailed offerings for each instrument, including available contract types, their durations, and market status.')
});

// This is the type for the flow function's input parameter
type AutomatedTradingStrategyFlowInput = zod.infer<typeof AutomatedTradingStrategyInputZodSchema>;

// Export this if it's intended to be used externally, otherwise it's internal to this flow
export type AutomatedTradingStrategyInput = AutomatedTradingStrategyFlowInput; 

const AutomatedTradeProposalZodSchema = zod.object({
  instrument: ForexCryptoCommodityInstrumentTypeSchema,
  tradeType: zod.string().describe("The specific contract type name from Deriv API. For Rise/Fall, use 'CALL' or 'PUT'. For Multipliers, use 'MULTUP' (for price increase expectation) or 'MULTDOWN' (for price decrease expectation)."),
  stake: zod.number().min(0.01).describe("The monetary value to stake."),
  durationString: zod.string().optional().describe("Duration string like '15m', '60s'. Required for contract types like CALL/PUT. May not be applicable for 'multiplier' types which might be 'no_expiry'."),
  multiplier: zod.number().optional().describe("The multiplier value (e.g., 100, 200) for multiplier-type trades."),
  takeProfit: zod.number().optional().describe("Take profit amount/offset for the trade, if applicable (especially for multipliers)."),
  stopLoss: zod.number().optional().describe("Stop loss amount/offset for the trade, if applicable (especially for multipliers)."),
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
    - Current Market Status Flag: OPEN (system determined this market is likely open)
    {{else}}
    {{! This covers isMarketCurrentlyOpen being false, null, or undefined }}
    - Current Market Status Flag: Potentially CLOSED or UNKNOWN (system determined market may be closed, or flag was not available). You MUST verify with 'Trading Hours Data' below. If 'Trading Hours Data' confirms closed or is unavailable, DO NOT TRADE.
    {{/if}}
    {{#if this.availableContracts.length}}
      Available Contract Types (from contracts_for API):
      {{#each this.availableContracts}}
      - Contract Type (API Name): '{{{this.contract_type}}}' (Display: '{{this.contract_display}}', Category: '{{this.contract_category}}')
        Market: {{this.market}}, Submarket: {{this.submarket}}, Expiry Type: {{this.expiry_type}}, Start Type: {{this.start_type}}
        {{#if this.min_contract_duration}}Min Duration: {{this.min_contract_duration}};{{/if}} {{#if this.max_contract_duration}}Max Duration: {{this.max_contract_duration}};{{/if}}
        {{#if this.multiplier_range.length}}Multiplier Range: [{{#each this.multiplier_range}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
        {{#if this.min_multiplier}}Min Multiplier: {{this.min_multiplier}};{{/if}} {{#if this.max_multiplier}}Max Multiplier: {{this.max_multiplier}};{{/if}}
      {{/each}}
    {{else}}
    - No specific contract types or parameters listed for this instrument from contracts_for API.
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
    Prioritize instruments confirmed to be open. Prioritize instruments with higher profit potential aligned with the risk mode and the 70% win rate target, considering all available data.\r\n    *   Conservative: Focus on safest, clearest signals from indicators and trends, smaller stakes. Aim for >75% win rate.\r\n    *   Balanced: Mix of opportunities, moderate stakes. Aim for >=70% win rate.\r\n    *   Aggressive: Higher risk/reward, potentially more volatile instruments, larger stakes if confidence is high. Aim for >=70% win rate, even with higher risk.\r\n3.  For each instrument you choose to trade (after confirming its market is open based on the 'isMarketCurrentlyOpen' flag and detailed 'Trading Hours Data'):
        *   Select an appropriate 'tradeType' which MUST be one of the 'contract_type' values listed in its 'Available Contract Types' (e.g., 'CALL', 'PUT', 'MULTUP', 'MULTDOWN').
        *   If the chosen 'tradeType' requires a fixed duration (e.g., 'CALL'/'PUT', or any type with 'expiry_type' like 'intraday' or 'tick'), you MUST provide a 'durationString'. This duration string (e.g., "60s", "5m", "2t") must respect the 'min_contract_duration' and 'max_contract_duration' specified for that contract_type. You need to generate a sensible duration string that fits these constraints if specific options are not listed.
        *   If the chosen 'tradeType' is 'MULTUP' or 'MULTDOWN' (Category: 'multipliers'), 'durationString' is typically not applicable. Instead, you MUST specify a 'multiplier' value. This value should be chosen from the 'multiplier_range' array (e.g., pick one from [10, 50, 100]) or, if 'multiplier_range' is not available, pick a value between 'min_multiplier' and 'max_multiplier'. You may optionally suggest 'takeProfit' and 'stopLoss' amounts (monetary value, not pips/percentage).
        *   Provide 'stake' (monetary value).
        *   The system will apply a general stop-loss of {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} of entry for Rise/Fall if not overridden by a specific stop-loss parameter for other contract types. For Multiplier trades, your proposed 'stopLoss' (if any) will be used.
4.  Apportion the '{{{totalStake}}}' among your chosen trades. The sum of stakes for all proposed trades MUST NOT exceed '{{{totalStake}}}'. Each stake must be a positive value, with a minimum value of 0.01.
5.  Provide clear reasoning for each trade proposal and for your overall strategy, explicitly mentioning how it aligns with the 70% win rate target and the {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} stop-loss rule.\r\n\r\nOutput Format:\r\nReturn a JSON object matching the output schema. Ensure 'tradesToExecute' is an array of trade objects.\r\nEach trade's 'stake' must be a number (e.g., 10.50) and at least 0.01.
Each trade's 'tradeType' must be a string representing the chosen contract type (e.g., "CALL", "PUT" for Rise/Fall contracts; "MULTUP", "MULTDOWN" for Multiplier contracts).
If 'durationString' is applicable for the 'tradeType', it must be the exact string from the available offerings (e.g., "15m", "60s").
If 'multiplier' is applicable, it must be a number.
'takeProfit' and 'stopLoss' amounts are optional and are monetary values.
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
      // Duration string is now optional, so only validate if present.
      let isDurationStringValid = true;
      if (trade.durationString !== undefined && trade.durationString !== null) { // Check if it's provided
        isDurationStringValid = typeof trade.durationString === 'string' && trade.durationString.length > 0;
        if(!isDurationStringValid) console.warn(`AI proposed invalid duration string '${trade.durationString}' for ${trade.instrument}. Filtering out trade.`);
      }

      if (!isStakeValid) console.warn(`AI proposed invalid stake ${trade.stake} for ${trade.instrument}. Filtering out trade.`);
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
