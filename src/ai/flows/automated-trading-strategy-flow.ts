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
      tradingTimesData: zod.any().optional().describe('Raw trading times data from API for the instrument.'),
      tradingTimesDataString: zod.string().optional().describe('JSON string representation of trading times data, or error message.'),
      isMarketCurrentlyOpen: zod.boolean().optional().describe('Whether the market for this instrument is determined to be currently open based on its detailed trading hours.'),
      availableContracts: zod.array(zod.object({
        tradeTypeName: zod.string().describe("The API name of the trade type, e.g., 'CALL', 'PUT', 'MULTUP', 'MULTDOWN', 'multiplier', 'touchnotouch' etc. For Rise/Fall, AI should propose 'CALL' or 'PUT' as tradeType based on direction."),
        displayName: zod.string().optional().describe("User-friendly display name of the trade type."),
        availableDurations: zod.array(zod.string()).optional().describe("Specific duration strings like '15m', '60s', or 'no_expiry' if applicable."),
        // minMultiplier: zod.number().optional(), // Removed as per subtask
        // maxMultiplier: zod.number().optional(), // Removed as per subtask
        multiplier_range: zod.array(zod.number()).optional().describe("Array of valid multiplier values, e.g., [10, 20, 50, 100]. Required if tradeTypeName is MULTUP/MULTDOWN and supports multipliers.")
        // Potentially add min/max stake, min/max payout etc. later if needed
      })).optional().describe("List of available contract types and their specific parameters for this instrument.")
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
    {{#if this.availableContracts}}
      Available Contract Types:
      {{#each this.availableContracts}}
      - Type Name: '{{{this.tradeTypeName}}}' (Display: '{{this.displayName}}')
        {{#if this.availableDurations}}Durations: {{#each this.availableDurations}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
        {{#if this.multiplier_range}} Valid Multipliers: {{#each this.multiplier_range}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
      {{/each}}
    {{else}}
    - No specific contract types or durations listed for this instrument.
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
        *   Select an appropriate 'tradeType' from its 'Available Contract Types' list. Crucially: for Rise/Fall contracts, set 'tradeType' to 'CALL' (if expecting price to rise) or 'PUT' (if expecting price to fall). For Multiplier contracts, set 'tradeType' to 'MULTUP' (if expecting price to rise) or 'MULTDOWN' (if expecting price to fall).
        *   If the chosen 'tradeType' requires a fixed duration (like 'CALL'/'PUT'), you MUST provide a 'durationString' selected exactly from its 'Available Durations' (e.g., "15m", "60s").
        *   If the chosen 'tradeType' is 'MULTUP' or 'MULTDOWN', 'durationString' is typically not applicable. Instead, you MUST specify a 'multiplier' value. If a 'Valid Multipliers' list (multiplier_range) is provided for this trade type, you MUST choose a value EXACTLY from that list. For Multiplier trades ('MULTUP'/'MULTDOWN'), `take_profit` will be system-calculated as 15% of your proposed `stake`, and `stop_loss` will be system-calculated as 5% of your proposed `stake`. You do not need to propose these `take_profit` and `stop_loss` values. Focus on proposing the `instrument`, `tradeType`, `stake`, and a valid `multiplier` from the 'Valid Multipliers' list.
        *   Provide 'stake' (monetary value).
        *   The system will apply a general stop-loss of {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} of entry for Rise/Fall. For Multiplier trades, `stop_loss` is system-calculated as 5% of stake as mentioned above.
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

    // Map AI output to final structure and apply system-calculated TP/SL for Multipliers
    return {
      ...output,
      tradesToExecute: output.tradesToExecute.map(aiProposedTrade => {
        // aiProposedTrade is an object matching AutomatedTradeProposalZodSchema

        // Map to the final AutomatedTradeProposal structure (from src/types/index.ts)
        const finalTradeProposal: ImportedAutomatedTradeProposal = {
          instrument: aiProposedTrade.instrument as ForexCryptoCommodityInstrumentType,
          action: aiProposedTrade.tradeType, // Map tradeType to action
          stake: aiProposedTrade.stake,
          durationString: aiProposedTrade.durationString,
          reasoning: aiProposedTrade.reasoning,
          // avatarUrl can be added if it's part of Zod schema and ImportedAutomatedTradeProposal
        };

        if (typeof aiProposedTrade.multiplier === 'number') {
          finalTradeProposal.multiplier = aiProposedTrade.multiplier;
        }

        // System-calculated TP/SL for Multipliers
        if (finalTradeProposal.action === 'MULTUP' || finalTradeProposal.action === 'MULTDOWN') {
          if (typeof finalTradeProposal.stake === 'number' && finalTradeProposal.stake > 0) {
            const calculatedStopLoss = parseFloat((finalTradeProposal.stake * 0.05).toFixed(2));
            const calculatedTakeProfit = parseFloat((finalTradeProposal.stake * 0.15).toFixed(2));
            finalTradeProposal.stop_loss = calculatedStopLoss;
            finalTradeProposal.take_profit = calculatedTakeProfit;
            // console.log(`System calculated TP/SL for ${finalTradeProposal.instrument} ${finalTradeProposal.action}: Stake=${finalTradeProposal.stake}, TP=${finalTradeProposal.take_profit}, SL=${finalTradeProposal.stop_loss}`);
          } else {
            // console.warn(`Stake not valid for ${finalTradeProposal.instrument} ${finalTradeProposal.action}, cannot calculate TP/SL.`);
          }
        } else {
          // For non-multiplier trades, if AI suggests TP/SL (and Zod schema allows it), pass them through.
          // This part assumes that AutomatedTradeProposalZodSchema might still have optional takeProfit/stopLoss.
          if (typeof aiProposedTrade.takeProfit === 'number') {
            finalTradeProposal.take_profit = aiProposedTrade.takeProfit;
          }
          if (typeof aiProposedTrade.stopLoss === 'number') {
            finalTradeProposal.stop_loss = aiProposedTrade.stopLoss;
          }
        }
        return finalTradeProposal;
      }),
    };
  }
);

export const generateAutomatedTradingStrategy = automatedTradingStrategyFlow;
