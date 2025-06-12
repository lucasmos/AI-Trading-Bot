'use server';
/**
 * @fileOverview AI flow for generating an automated trading strategy for Forex, Crypto, and Commodities.
 *
 * - generateAutomatedTradingStrategy - A function that creates a trading plan.
 * - AutomatedTradingStrategyInput - The input type.
 * - AutomatedTradingStrategyOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import * as zod from 'zod';
import type { 
  ForexCryptoCommodityInstrumentType, 
  TradingMode, 
  PriceTick, 
  AutomatedTradingStrategyOutput as ImportedAutomatedTradingStrategyOutput,
  AutomatedTradeProposal as ImportedAutomatedTradeProposal
} from '@/types';

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

const ForexCryptoCommodityInstrumentTypeSchema = zod.string();

const AutomatedTradingStrategyInputZodSchema = zod.object({
  totalStake: zod.number().min(1),
  instruments: zod.array(ForexCryptoCommodityInstrumentTypeSchema),
  tradingMode: zod.enum(['conservative', 'balanced', 'aggressive']),
  aiStrategyId: zod.string().optional().describe('The selected AI trading strategy ID.'),
  stopLossPercentage: zod.number().min(1).max(50).optional().describe('User-defined stop-loss percentage (e.g., 1-50%). Default is 5% if not provided.'),
  instrumentTicks: zod.record(ForexCryptoCommodityInstrumentTypeSchema, zod.array(PriceTickSchema)),
  instrumentIndicators: zod.record(ForexCryptoCommodityInstrumentTypeSchema, InstrumentIndicatorDataSchema).optional().describe('Calculated technical indicators for each instrument.'),
  formattedIndicatorsString: zod.string().optional().describe('Pre-formatted string of technical indicators for the prompt.'),
});

type AutomatedTradingStrategyFlowInput = zod.infer<typeof AutomatedTradingStrategyInputZodSchema>;
export type AutomatedTradingStrategyInput = AutomatedTradingStrategyFlowInput; 

const AutomatedTradeProposalZodSchema = zod.object({
  instrument: ForexCryptoCommodityInstrumentTypeSchema,
  action: zod.enum(['CALL', 'PUT']),
  stake: zod.number().min(0.01),
  durationSeconds: zod.number().int().min(1),
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
Important System Rule: A stop-loss based on {{#if stopLossPercentage}}{{{stopLossPercentage}}}% (user-defined){{else}}a fixed 5% (system default){{/if}} of the entry price will be automatically applied to every trade by the system. Consider this when selecting trades; avoid trades highly likely to hit this stop-loss quickly unless the potential reward significantly outweighs this risk within the trade duration.\r\n
IMPORTANT: For this task, providing detailed, indicator-based reasoning is CRITICAL.
- The \`overallReasoning\` field MUST summarize your multi-indicator analysis.
- EACH \`AutomatedTradeProposal\` object in the \`tradesToExecute\` array MUST have a \`reasoning\` field. This field CANNOT be empty or generic. It MUST detail the specific BB, MACD, RSI, and ATR signals that justify that particular trade.
\r\nYour Task:\r\n1.  Your primary analysis MUST focus on the provided technical indicators: Bollinger Bands (BB), MACD, RSI, and ATR. Use the recent price ticks for context.\r\n    *   For Bollinger Bands: Identify periods of low/high volatility (squeeze/expansion), and potential breakouts or mean reversion signals.\r\n    *   For MACD: Look for crossovers (MACD line vs. Signal line), divergence with price, and histogram strength.\r\n    *   For RSI: Identify overbought/oversold conditions and potential divergences.\r\n    *   For ATR: Use ATR to understand current market volatility for each instrument, which can inform trade duration, confidence, or perceived risk.\r\n2.  Based on the '{{{tradingMode}}}', decide which instruments to trade. You do not have to trade all of them. Prioritize instruments with higher profit potential aligned with the >=83% win rate target, considering all available data.\r\n    *   Conservative: Focus on safest, clearest signals. Aim for >=85% win rate. Base decisions heavily on confirming signals from multiple indicators (BB, MACD, RSI, ATR). Smaller stakes relative to total stake are preferred.\r\n    *   Balanced: Mix of clear opportunities and calculated risks. Aim for >=83% win rate. Base decisions heavily on confirming signals from multiple indicators (BB, MACD, RSI, ATR). Moderate stakes.\r\n    *   Aggressive: Higher risk/reward, potentially more volatile instruments or counter-trend opportunities if signals are strong. Aim for >=80% win rate. Base decisions heavily on confirming signals from multiple indicators (BB, MACD, RSI, ATR). Larger stakes if confidence is high.\r\n3.  For each instrument you choose to trade:\r\n    *   Determine the trade direction: 'CALL' (price will go up) or 'PUT' (price will go down).\r\n    *   Recommend a trade duration in SECONDS (e.g., 30, 60, 180, 300). Durations MUST be positive integers representing seconds, with a minimum value of 1.\r\n    *   The system will set a {{#if stopLossPercentage}}{{{stopLossPercentage}}}%{{else}}5%{{/if}} stop-loss. Your reasoning should reflect an understanding of this.\r\n4.  Apportion the '{{{totalStake}}}' among your chosen trades. The sum of stakes for all proposed trades MUST NOT exceed '{{{totalStake}}}'. Each stake must be a positive value, with a minimum value of 0.01.\r\n5.  Provide MANDATORY DETAILED REASONING:\r\n    *   For \`overallReasoning\`: Concisely explain your general market outlook and strategy derived from the combined signals of Bollinger Bands, MACD, RSI, and ATR for the chosen instruments.\r\n    *   For EACH \`AutomatedTradeProposal\`'s \`reasoning\` field: This is a CRITICAL field. It MUST NOT be generic. Provide a specific, concise explanation (1-3 sentences) detailing:\r\n        *   Which of the four indicators (BB, MACD, RSI, ATR) provided the primary signal(s) for THIS trade.\r\n        *   What those signals were (e.g., 'RSI (<30) indicated oversold', 'MACD bullish cross above zero line', 'Price broke above upper Bollinger Band on expanding volatility (BB width increasing)', 'ATR confirmed sufficient volatility for movement').\r\n        *   How these signals justify the CALL/PUT decision and the chosen duration.\r\n        *   Example of good reasoning: 'EUR/USD CALL: RSI was oversold at 28. MACD histogram turned positive. Price touched lower Bollinger Band and showed signs of reversal. ATR is moderate, supporting a 180s duration for potential mean reversion.'\r\n    *   Your reasoning must clearly demonstrate analytical rigor and direct application of the provided indicator data to achieve the >=83% win rate target, while respecting the system's stop-loss rule.\r\n\r\nOutput Format:\r\nReturn a JSON object matching the output schema. Ensure 'tradesToExecute' is an array of trade objects.\r\nEach trade's 'stake' must be a number (e.g., 10.50) and at least 0.01.\r\nEach trade's 'durationSeconds' must be an integer number of seconds (e.g., 30, 60, 300) and at least 1.\r\nStrict Adherence to Output Schema: Ensure your entire response is a single, valid JSON object matching the output schema. All fields specified in the schema for \`AutomatedTradeProposal\` (instrument, action, stake, durationSeconds, reasoning) are expected for each trade. The \`reasoning\` field for each trade is mandatory.\r\n\r\nBegin your response with the JSON object.\r\n`,
});

const automatedTradingStrategyFlow = ai.defineFlow(
  {
    name: 'automatedTradingStrategyFlow',
    inputSchema: AutomatedTradingStrategyInputZodSchema,
    outputSchema: InferredAutomatedTradingStrategyOutputSchema, 
  },
  async (input: AutomatedTradingStrategyFlowInput): Promise<ImportedAutomatedTradingStrategyOutput> => {
    console.log('[AI Flow] Received input.instrumentIndicators:', JSON.stringify(input.instrumentIndicators, null, 2));

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
    console.log('[AI Flow] Constructed formattedIndicatorsString:', formattedIndicators);

    const promptInput: AutomatedTradingStrategyFlowInput = {
      ...input,
      instruments: input.instruments as ForexCryptoCommodityInstrumentType[],
      formattedIndicatorsString: formattedIndicators,
    };

    const result = await prompt(promptInput) as any;

    // console.log('[AI Flow] Full result object from AI prompt:', JSON.stringify(result, null, 2)); // REMOVED this line
    // Attempt to log raw text if available
    if (result && typeof result.text === 'function') {
        console.log('[AI Flow] Raw AI response text (attempt 1):', await result.text());
    } else if (result && result.raw) {
        console.log('[AI Flow] Raw AI response data (attempt 2):', JSON.stringify(result.raw, null, 2));
    } else if (result && result.output && typeof result.output === 'object') {
        console.log('[AI Flow] AI result.output (potentially parsed by Zod):', JSON.stringify(result.output, null, 2));
    } else {
        console.log('[AI Flow] Could not determine standard method to log raw AI text from result object.');
    }

    if (!result || !result.output) {
      console.error("[AI Flow] AI prompt result or result.output is null/undefined. Full result:", JSON.stringify(result, null, 2));
      throw new Error("AI failed to generate an automated trading strategy for Forex/Crypto/Commodities. Output was null.");
    }

    const output = result.output as ImportedAutomatedTradingStrategyOutput;

    if (output) {
        console.log('[AI Flow] Parsed AI Output - Overall Reasoning:', output.overallReasoning);
        if (output.tradesToExecute && output.tradesToExecute.length > 0) {
            output.tradesToExecute.forEach((trade, index) => {
                console.log(`[AI Flow] Parsed AI Output - Trade ${index + 1} (${trade.instrument}) Reasoning:`, trade.reasoning);
            });
        } else {
            console.log('[AI Flow] Parsed AI Output - No trades proposed.');
        }
    } else {
        console.log('[AI Flow] Parsed AI Output is null or undefined after initial checks.');
    }
    
    output.tradesToExecute = output.tradesToExecute.filter(trade => {
      const isStakeValid = typeof trade.stake === 'number' && trade.stake >= 0.01;
      const isDurationValid = Number.isInteger(trade.durationSeconds) && trade.durationSeconds >= 1;
      if (!isStakeValid) console.warn(`AI proposed invalid stake ${trade.stake} for ${trade.instrument}. Filtering out trade.`);
      if (!isDurationValid) console.warn(`AI proposed invalid duration ${trade.durationSeconds} for ${trade.instrument}. Filtering out trade.`);
      return isStakeValid && isDurationValid;
    });
    
    let totalProposedStake = output.tradesToExecute.reduce((sum, trade: ImportedAutomatedTradeProposal) => sum + (trade.stake || 0), 0);
    totalProposedStake = parseFloat(totalProposedStake.toFixed(2));

    if (totalProposedStake > input.totalStake) {
      console.warn(`AI proposed total stake ${totalProposedStake} which exceeds user's limit ${input.totalStake} (Forex/Crypto/Commodities). Trades may be capped or rejected by execution logic.`);
    }

    console.log('[AI Flow] Final output object being returned:', JSON.stringify(
        {
            overallReasoning: output.overallReasoning,
            tradesToExecute: output.tradesToExecute.map(t => ({
                instrument: t.instrument,
                action: t.action,
                reasoning: t.reasoning,
                stake: t.stake,
                durationSeconds: t.durationSeconds
            }))
        },
        null,
        2
    ));

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
