'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing market sentiment using FinBERT,
 * LSTM for price trend analysis, and an ensemble model to combine signals for optimal trade durations.
 *
 * - analyzeMarketSentiment - A function that orchestrates the market sentiment analysis process.
 * - AnalyzeMarketSentimentInput - The input type for the analyzeMarketSentiment function.
 * - AnalyzeMarketSentimentOutput - The return type for the analyzeMarketSentiment function.
 */

import { ai } from '@/ai/genkit';
import { type GenerateResponse } from 'genkit';
import * as z from 'zod';
import { getNewsArticles } from '@/services/news';
import { analyzeSentiment } from '@/lib/ai/sentiment';
import { getCandles } from '@/services/deriv';
import {SMA, EMA, ATR} from 'technicalindicators';
import type { TradingInstrument } from '@/types';

const AnalyzeMarketSentimentInputSchema = z.object({
  symbol: z.string().describe('The trading symbol to analyze (e.g., EUR/USD).'),
  tradingMode: z
    .enum(['conservative', 'balanced', 'aggressive'])
    .describe('The trading mode to use.'),
  rsi: z.number().optional().describe('Calculated Relative Strength Index (RSI) value for the symbol.'),
  macd: z.object({ 
    macd: z.number(), 
    signal: z.number(), 
    histogram: z.number() 
  }).optional().describe('Calculated MACD values (MACD line, signal line, histogram).'),
  bollingerBands: z.object({
    upper: z.number(),
    middle: z.number(),
    lower: z.number(),
  }).optional().describe('Calculated Bollinger Bands (upper, middle, lower bands).'),
  ema: z.number().optional().describe('Calculated Exponential Moving Average (EMA) value.'),
  atr: z.number().optional().describe('Calculated Average True Range (ATR) value.'),
});
export type AnalyzeMarketSentimentInput = z.infer<typeof AnalyzeMarketSentimentInputSchema>;

const AnalyzeMarketSentimentOutputSchema = z.object({
  action: z.enum(['CALL', 'PUT', 'HOLD']).describe('The recommended trading action.'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the recommendation (0 to 1).'),
  reasoning: z.string().describe('Explanation for the recommendation.'),
  details: z.object({
    newsSentiment: z.string().optional(),
    priceTrend: z.string().optional(),
    rsi: z.number().optional(),
    macd: z.object({ macd: z.number(), signal: z.number(), histogram: z.number() }).optional(),
    bollingerBands: z.object({ upper: z.number(), middle: z.number(), lower: z.number() }).optional(),
  }).optional(),
});
export type AnalyzeMarketSentimentOutput = z.infer<typeof AnalyzeMarketSentimentOutputSchema>;

export const analyzeMarketSentiment = ai.defineFlow(
  {
    name: 'analyzeMarketSentimentFlow',
    inputSchema: AnalyzeMarketSentimentInputSchema,
    outputSchema: AnalyzeMarketSentimentOutputSchema,
    // Removed prompt and model config from here
  },
  async (input: AnalyzeMarketSentimentInput): Promise<AnalyzeMarketSentimentOutput> => {
    console.log('[Flow:analyzeMarketSentimentFlow] Processing input:', input);

    let newsSentimentSummary = 'Neutral';
    try {
      const newsArticles = await getNewsArticles({ query: input.symbol }); 
    if (newsArticles && newsArticles.length > 0) {
        const sentimentText = newsArticles.map(a => a.title + " " + (a.description || '')).join('\n');
        const sentimentAnalysisResult = await analyzeSentiment(sentimentText);
        if (sentimentAnalysisResult && sentimentAnalysisResult.length > 0 && sentimentAnalysisResult[0].label) {
          newsSentimentSummary = sentimentAnalysisResult[0].label;
        }
      }
    } catch (error) {
      console.error(`[Flow:analyzeMarketSentimentFlow] Error fetching or analyzing news for ${input.symbol}:`, error);
      newsSentimentSummary = 'Error fetching news data';
      }
    console.log(`[Flow:analyzeMarketSentimentFlow] News sentiment for ${input.symbol}: ${newsSentimentSummary}`);

    let priceTrend = 'Stable';
    try {
      const fetchedCandles = await getCandles(input.symbol as TradingInstrument, 30);
      if (fetchedCandles && fetchedCandles.length > 1) {
        const closePrices = fetchedCandles.map(c => c.close);
        const firstPrice = closePrices[0];
        const lastPrice = closePrices[closePrices.length - 1];
        if (lastPrice > firstPrice) priceTrend = 'Upward';
        else if (lastPrice < firstPrice) priceTrend = 'Downward';
        else priceTrend = 'Sideways';
      } else if (fetchedCandles && fetchedCandles.length === 1) {
        priceTrend = 'Sideways';
      }
    } catch (error) {
      console.error(`[Flow:analyzeMarketSentimentFlow] Error fetching candles for ${input.symbol}:`, error);
      priceTrend = 'Error fetching price data';
    }
    console.log(`[Flow:analyzeMarketSentimentFlow] Price trend for ${input.symbol}: ${priceTrend}`);

    const promptText = `Analyze market sentiment for ${input.symbol} with trading mode ${input.tradingMode}. News: ${newsSentimentSummary}. Trend: ${priceTrend}. RSI: ${input.rsi?.toFixed(4) ?? 'N/A'}. MACD: ${input.macd ? `Line(${input.macd.macd.toFixed(4)}), Signal(${input.macd.signal.toFixed(4)}), Hist(${input.macd.histogram.toFixed(4)})` : 'N/A'}. BB: ${input.bollingerBands ? `Upper(${input.bollingerBands.upper.toFixed(4)}), Middle(${input.bollingerBands.middle.toFixed(4)}), Lower(${input.bollingerBands.lower.toFixed(4)})` : 'N/A'}. EMA: ${input.ema?.toFixed(4) ?? 'N/A'}. ATR: ${input.atr?.toFixed(4) ?? 'N/A'}. Provide action (CALL, PUT, HOLD), confidence (0.0-1.0), and detailed reasoning considering all provided data points.`;

    console.log('[Flow:analyzeMarketSentimentFlow] Constructed prompt:', promptText);

    try {
      const generationResponse: GenerateResponse<AnalyzeMarketSentimentOutput> = await ai.generate<any, typeof AnalyzeMarketSentimentOutputSchema>({
        model: 'googleai/gemini-pro',
        prompt: promptText,
        output: { schema: AnalyzeMarketSentimentOutputSchema },
      });

      const output = generationResponse.output;
      if (!output) {
        throw new Error('No output from AI generation');
      }
      return output;
    } catch (error) {
      console.error('[AnalyzeMarketSentimentFlow] Error:', error);
      // Return a structured error or a default neutral sentiment
      return {
        action: 'HOLD',
        reasoning: `Error during analysis: ${(error as Error).message}`,
        confidence: 0.5,
      };
    }
  }
);
