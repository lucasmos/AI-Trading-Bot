'use server';

import {
  AutomatedTradingStrategyOutput,
  ForexCryptoCommodityInstrumentType
} from '@/types';
import {
  placeTrade,
  TradeDetails,
  PlaceTradeResponse,
  instrumentToDerivSymbol
} from '@/services/deriv';
import { prisma } from '@/lib/db'; // Import Prisma client

export interface TradeExecutionResult {
  success: boolean;
  instrument: ForexCryptoCommodityInstrumentType;
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string; // To return the ID of the trade record in our DB
}

/**
 * Executes a series of trades based on an AI-generated trading strategy, places them on the specified Deriv account, and records each trade in the database.
 *
 * For each trade proposal in the strategy, attempts to execute the trade via the Deriv API and persist the trade details. Returns an array of results indicating the success or failure of each trade, including error messages and database record IDs where applicable.
 *
 * @param strategy - The AI-generated trading strategy containing trade proposals to execute.
 * @param userDerivApiToken - The API token used to authenticate with the Deriv platform.
 * @param targetAccountId - The Deriv account ID where trades will be executed.
 * @param selectedAccountType - Specifies whether the trades are executed on a 'demo' or 'real' account.
 * @param userId - The unique identifier of the user executing the trades.
 * @returns An array of trade execution results, each detailing the outcome of an attempted trade.
 */
export async function executeAiTradingStrategy(
  strategy: AutomatedTradingStrategyOutput,
  userDerivApiToken: string,
  targetAccountId: string, // The specific Deriv account ID (CR... or VRTC...)
  selectedAccountType: 'demo' | 'real', // The type of account being traded on
  userId: string // The user's unique ID from your application's User model
  // aiStrategyId is now expected to be part of the strategy object if needed for saving
): Promise<TradeExecutionResult[]> {
  const results: TradeExecutionResult[] = [];

  if (!userDerivApiToken) {
    console.error('[executeAiTradingStrategy] Deriv API token is missing.');
    return strategy.tradesToExecute.map(tradeProposal => ({
      success: false,
      instrument: tradeProposal.instrument,
      error: 'Deriv API token is missing. Cannot execute trades.',
    }));
  }

  if (!userId) {
    console.error('[executeAiTradingStrategy] User ID is missing.');
    return strategy.tradesToExecute.map(tradeProposal => ({
      success: false,
      instrument: tradeProposal.instrument,
      error: 'User ID is missing. Cannot save trades.',
    }));
  }

  if (!targetAccountId) {
    console.error('[executeAiTradingStrategy] Target Deriv Account ID is missing.');
    return strategy.tradesToExecute.map(tradeProposal => ({
      success: false,
      instrument: tradeProposal.instrument,
      error: 'Target Deriv Account ID is missing. Cannot execute trades.',
    }));
  }

  for (const tradeProposal of strategy.tradesToExecute) {
    try {
      const derivSymbol = instrumentToDerivSymbol(tradeProposal.instrument as ForexCryptoCommodityInstrumentType);

      const tradeDetails: TradeDetails = {
        symbol: derivSymbol,
        contract_type: tradeProposal.action,
        duration: tradeProposal.durationSeconds,
        duration_unit: 's',
        amount: tradeProposal.stake,
        currency: 'USD',
        basis: 'stake',
        token: userDerivApiToken,
      };

      console.log(`[executeAiTradingStrategy] Attempting to place trade for ${tradeProposal.instrument} on account ${targetAccountId}:`, {
        ...tradeDetails,
        token: '***REDACTED***'
      });

      // Call placeTrade with targetAccountId
      const derivTradeResponse = await placeTrade(tradeDetails, targetAccountId);

      console.log(`[executeAiTradingStrategy] Trade placed successfully via Deriv API for ${tradeProposal.instrument}:`, derivTradeResponse);

      // Save the executed trade to the database
      const savedDbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: tradeProposal.instrument, // Storing the user-friendly symbol
          type: tradeProposal.action,       // 'CALL' or 'PUT'
          amount: tradeProposal.stake,
          price: derivTradeResponse.entry_spot, // Entry price from Deriv
          totalValue: tradeProposal.stake,      // For binary, totalValue is the stake
          status: 'OPEN',                       // Initial status
          openTime: new Date(),                 // Current time as open time
          derivContractId: derivTradeResponse.contract_id.toString(),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          aiStrategyId: strategy.aiStrategyId || null, // Assuming aiStrategyId is on strategy object
          metadata: { // Store additional info if needed
            reasoning: tradeProposal.reasoning,
            derivLongcode: derivTradeResponse.longcode,
          }
        },
      });
      console.log(`[executeAiTradingStrategy] Trade for ${tradeProposal.instrument} saved to DB. DB Trade ID: ${savedDbTrade.id}, Deriv Contract ID: ${derivTradeResponse.contract_id}`);

      results.push({
        success: true,
        instrument: tradeProposal.instrument,
        tradeResponse: derivTradeResponse,
        dbTradeId: savedDbTrade.id,
      });

    } catch (error: any) {
      console.error(`[executeAiTradingStrategy] Failed to place or save trade for ${tradeProposal.instrument}:`, error);
      results.push({
        success: false,
        instrument: tradeProposal.instrument,
        error: error.message || 'Unknown error during trade placement or DB save.',
      });
    }
  }

  return results;
}


import {
    generateVolatilitySingleTradeDecision,
    VolatilitySingleTradeStrategyInput
    // UserTradeType will be imported from the new shared file
} from '@/ai/flows/volatility-trading-strategy-flow';
import { UserTradeType } from '@/types/ai-shared-types'; // Import from shared location
import { getCandles, getTicks } from '@/services/deriv'; // Added getTicks
import { calculateAllIndicators } from '@/lib/technical-analysis'; // Corrected import name
import { VolatilityInstrumentType, PriceTick, CandleData } from '@/types'; // Added CandleData

export interface VolatilityTradeExecutionResult {
  success: boolean;
  instrument: VolatilityInstrumentType;
  tradeParams?: TradeDetails; // Details sent to placeTrade
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string;
  aiReasoning?: string;
}

// Moved VOLATILITY_INDICES_TO_TRADE and STAKE_PER_TRADE inside executeVolatilityAiTradeLoop

export async function executeVolatilityAiTradeLoop(
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
): Promise<VolatilityTradeExecutionResult[]> {
  const VOLATILITY_INDICES_TO_TRADE: VolatilityInstrumentType[] = ["R_10", "R_25", "R_50", "R_75", "R_100"];
  const STAKE_PER_TRADE = 1; // Example: Can be made configurable. Min stake for Deriv is often $0.35 for options.

  const results: VolatilityTradeExecutionResult[] = [];

  if (!userDerivApiToken || !targetAccountId || !userId) {
    const errorMsg = "User token, target account ID, or user ID is missing for Volatility AI trade loop.";
    console.error(`[TradeAction/Loop] Pre-condition failed: ${errorMsg}`); // Updated console log prefix
    return VOLATILITY_INDICES_TO_TRADE.map(instrument => ({ // VOLATILITY_INDICES_TO_TRADE is now in scope
        success: false,
        instrument,
        error: errorMsg,
    }));
  }

  console.log(`[TradeAction/Loop] Starting trade loop. User: ${userId}, Account: ${targetAccountId}, Trade Type: ${userSelectedTradeType}`); // Updated console log prefix

  for (const instrument of VOLATILITY_INDICES_TO_TRADE) {
    let tradeDetailsForApi: TradeDetails | null = null;
    let aiReasoning: string | undefined = undefined;
    let currentApiSymbol: string | null = null;

    try {
      currentApiSymbol = instrumentToDerivSymbol(instrument as any); // Ensure mapping
      console.log(`[TradeAction/Loop] START Processing instrument: ${instrument} (Deriv Symbol: ${currentApiSymbol}), User Trade Type: ${userSelectedTradeType}`);

      // 1. Fetch data for AI
      const priceDataPoints = 100; // Number of data points for AI analysis
      // Using 1-minute candles to get a decent amount of data quickly. For ticks, might need more frequent calls or shorter granularity.
      // For Digits, very recent tick data (last 10-20 ticks) is more relevant than 100 1-minute candles.
      // This part needs careful consideration based on how `getCandles` and AI expect data.
      // Let's assume for now `getCandles` can provide granular enough data if `granularity=1` (second)
      // and count is e.g. 60 for last minute of 1-sec data points.
      const candleCountForTicks = 60; // e.g., last 60 seconds of data
      const tickGranularity = userSelectedTradeType.startsWith("Digits") ? 0 : 60; // 0 for ticks, 60 for 1-min candles for others (or adjust)
                                                                                    // Deriv API: 0 for ticks, 60, 120, ... for candles
                                                                                    // For simplicity, let's use 1-minute candles (granularity 60) for non-digits
                                                                                    // and try to simulate ticks with 1s candles for digits.

      let priceTicksForAI: PriceTick[];
      let indicators: any = {}; // Initialize indicators object

      if (userSelectedTradeType.startsWith("Digits")) {
          // For Digits, fetch actual ticks.
          priceTicksForAI = await getTicks(instrument as any, 25, userDerivApiToken); // Fetch last 25 ticks
          // Indicators might not be as relevant for very short-term Digit trades based on ticks,
          // or would need to be calculated from tick data if meaningful.
          // For now, we might skip complex indicators for Digits or use very short-term ones.
          // Let's assume `calculateAllIndicators` can handle PriceTick[] or we adapt it.
          // If calculateAllIndicators expects CandleData[], we cannot directly use it with ticks.
          // For simplicity, we'll pass empty indicators for Digits if calculateAllIndicators can't process ticks.
          // Or, pass priceTicksForAI to a modified calculateAllIndicators if it can handle PriceTick[].
          // Assuming calculateAllIndicators needs candles, we'll have limited indicators for Digits from pure ticks.
          // This part might need refinement based on how indicators are truly generated from ticks.
          console.log(`[TradeAction/Loop] Fetched ${priceTicksForAI.length} ticks for ${instrument} (Digits trade).`);
          // For Digits, we primarily rely on recent tick patterns.
          // If you have specific indicators for ticks, calculate them here.
          // Otherwise, indicators object might remain sparse or empty for AI.
          // For example, if RSI can be calculated from tick prices:
          // if (priceTicksForAI.length > 14) {
          //   const tickPrices = priceTicksForAI.map(t => t.price);
          //   indicators.rsi = calculateRSI(tickPrices, 14); // Assuming calculateRSI can take prices directly
          // }

      } else {
          // For other types, fetch 1-minute candles and calculate indicators from them.
          const rawCandlesData = await getCandles(instrument as any, 60, 60, userDerivApiToken);
          if (!rawCandlesData || rawCandlesData.length < 5) {
              const errorMsg = `Insufficient candle data for ${instrument} (needed 5, got ${rawCandlesData?.length}). Cannot calculate indicators or proceed.`;
              console.warn(`[TradeAction/Loop] ${errorMsg}`);
              results.push({ success: false, instrument, error: "Insufficient candle data.", aiReasoning: "Skipped due to insufficient candle data."});
              continue;
          }
          indicators = calculateAllIndicators(rawCandlesData);
          priceTicksForAI = rawCandlesData.map(c => ({
              epoch: c.epoch,
              price: c.close,
              time: c.time
          }));
      }

      if (!priceTicksForAI || priceTicksForAI.length < 5) { // Check after fetching
          const errorMsg = `Insufficient price data (ticks/candles) for ${instrument} (needed 5, got ${priceTicksForAI?.length}). Skipping.`;
          console.warn(`[TradeAction/Loop] ${errorMsg}`);
          results.push({ success: false, instrument, error: "Insufficient price data.", aiReasoning: "Skipped due to insufficient price data."});
          continue;
      }

      const aiInput: VolatilitySingleTradeStrategyInput = {
        currentInstrument: instrument,
        userSelectedTradeType: userSelectedTradeType,
        stakePerTrade: STAKE_PER_TRADE,
        instrumentTicks: priceTicksForAI.slice(-50), // Send last 50 data points to AI
        instrumentIndicators: indicators,
      };
      console.log(`[TradeAction/Loop] Calling AI for ${instrument} (Deriv: ${currentApiSymbol}), User Trade Type: ${userSelectedTradeType}. AI Input (Indicators):`, JSON.stringify(indicators, null, 2), `AI Input (Ticks): ${priceTicksForAI.length} points provided, sending last 50.`);
      const aiProposal = await generateVolatilitySingleTradeDecision(aiInput);
      aiReasoning = aiProposal.reasoning;
      console.log(`[TradeAction/Loop] AI Proposal received for ${instrument}: `, JSON.stringify(aiProposal, null, 2));


      if (!aiProposal.shouldTrade || !aiProposal.derivContractType || !aiProposal.duration || !aiProposal.durationUnit || !aiProposal.stake) {
        const noTradeReason = `AI decided not to trade or proposal incomplete: ${aiProposal.reasoning || 'No specific reason.'}`;
        console.log(`[TradeAction/Loop] SKIPPING ${instrument}: ${noTradeReason}`);
        results.push({ success: false, instrument, error: noTradeReason, aiReasoning });
        continue;
      }

      tradeDetailsForApi = {
        symbol: currentApiSymbol,
        contract_type: aiProposal.derivContractType,
        duration: aiProposal.duration,
        duration_unit: aiProposal.durationUnit,
        amount: aiProposal.stake, // Use stake from AI proposal
        currency: 'USD',
        basis: 'stake',
        token: userDerivApiToken,
        barrier: aiProposal.barrier,
      };

      console.log(`[TradeAction/Loop] Constructing TradeDetails for ${instrument} (Deriv: ${currentApiSymbol}):`, JSON.stringify({ ...tradeDetailsForApi, token: '***REDACTED***' }, null, 2));

      const derivTradeResponse = await placeTrade(tradeDetailsForApi, targetAccountId);
      console.log(`[TradeAction/Loop] Deriv API placeTrade response for ${instrument}: Contract ID ${derivTradeResponse.contract_id}`, derivTradeResponse);

      const savedDbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: instrument, // Store user-friendly name
          type: `${userSelectedTradeType} (${aiProposal.derivContractType})`,
          amount: tradeDetailsForApi.amount,
          price: derivTradeResponse.entry_spot,
          totalValue: tradeDetailsForApi.amount, // For options, stake is usually the value at risk
          status: 'OPEN', // Assuming trade is open until result is known
          openTime: new Date(),
          derivContractId: derivTradeResponse.contract_id.toString(),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          aiStrategyId: null, // Populate if applicable
          metadata: {
            reasoning: aiProposal.reasoning,
            derivLongcode: derivTradeResponse.longcode,
            barrier: aiProposal.barrier,
            duration: aiProposal.duration,
            durationUnit: aiProposal.durationUnit,
            userSelectedTradeType: userSelectedTradeType,
            derivSymbol: currentApiSymbol,
          }
        },
      });
      console.log(`[TradeAction/Loop] Trade for ${instrument} saved to DB. DB ID: ${savedDbTrade.id}`);

      results.push({
        success: true,
        instrument,
        tradeParams: tradeDetailsForApi,
        tradeResponse: derivTradeResponse,
        dbTradeId: savedDbTrade.id,
        aiReasoning,
      });

    } catch (error: any) {
      console.error(`[TradeAction/Loop] CRITICAL ERROR during trade execution for ${instrument} (Deriv: ${currentApiSymbol || 'N/A'}):`, error.message, error.stack);
      results.push({
        success: false,
        instrument,
        tradeParams: tradeDetailsForApi || undefined,
        error: error.message || 'Unknown error during trade execution for volatility instrument.',
        aiReasoning,
      });
    }
  }
  console.log(`[TradeAction/Loop] Finished Volatility AI trade loop. Total results processed: ${results.length}`);
  return results;
}
