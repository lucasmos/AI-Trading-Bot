'use server';

import {
  placeTrade,
  TradeDetails,
  PlaceTradeResponse,
  instrumentToDerivSymbol,
  getCandles,
  getTicks
} from '@/services/deriv';
import { prisma } from '@/lib/db';
import {
    generateVolatilitySessionStrategy,
    VolatilitySessionStrategyInput
} from '@/ai/flows/volatility-trading-strategy-flow';
import { UserTradeType } from '@/types/ai-shared-types';
import { calculateAllIndicators } from '@/lib/technical-analysis';
import { VolatilityInstrumentType, PriceTick, CandleData, InstrumentIndicatorData, ForexCommodityInstrumentType, AutomatedTradingStrategyOutput } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

// Kept for other parts of the application that might use it.
export interface TradeExecutionResult {
  success: boolean;
  instrument: ForexCryptoCommodityInstrumentType; // Kept specific for this interface
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string;
}

export async function executeAiTradingStrategy(
  strategy: AutomatedTradingStrategyOutput,
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string
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
        contract_type: tradeProposal.action, // 'CALL' or 'PUT' from AutomatedTradeProposal
        duration: tradeProposal.durationSeconds, // Assuming durationSeconds is present
        duration_unit: 's', // Assuming seconds for this flow
        amount: tradeProposal.stake,
        currency: 'USD',
        basis: 'stake',
        token: userDerivApiToken,
      };

      console.log(`[executeAiTradingStrategy] Attempting to place trade for ${tradeProposal.instrument} on account ${targetAccountId}:`, {
        ...tradeDetails,
        token: '***REDACTED***'
      });

      const derivTradeResponse = await placeTrade(tradeDetails, targetAccountId);
      console.log(`[executeAiTradingStrategy] Trade placed successfully via Deriv API for ${tradeProposal.instrument}:`, derivTradeResponse);

      const savedDbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: tradeProposal.instrument,
          type: tradeProposal.action,
          amount: tradeProposal.stake,
          price: derivTradeResponse.entry_spot,
          totalValue: tradeProposal.stake,
          status: 'OPEN',
          openTime: new Date(),
          derivContractId: derivTradeResponse.contract_id.toString(),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          aiStrategyId: strategy.aiStrategyId || null,
          metadata: {
            reasoning: tradeProposal.reasoning,
            derivLongcode: derivTradeResponse.longcode,
            tradeCategory: 'forexCrypto',
            automated: true,
            tradingMode: strategy.tradingMode || 'balanced',
            durationString: tradeProposal.durationString,
            multiplier: tradeProposal.multiplier,
            stopLoss: tradeProposal.stop_loss,
            takeProfit: tradeProposal.take_profit
          }
        },
      });
      console.log(`[executeAiTradingStrategy] Trade for ${tradeProposal.instrument} saved to DB. DB Trade ID: ${savedDbTrade.id}, Deriv Contract ID: ${derivTradeResponse.contract_id}`);
      results.push({ success: true, instrument: tradeProposal.instrument, tradeResponse: derivTradeResponse, dbTradeId: savedDbTrade.id });
    } catch (error: any) {
      console.error(`[executeAiTradingStrategy] Failed to place or save trade for ${tradeProposal.instrument}:`, error);
      results.push({ success: false, instrument: tradeProposal.instrument, error: error.message || 'Unknown error during trade placement or DB save.' });
    }
  }
  return results;
}


// Interface for the Volatility AI Trade Loop
export interface VolatilityTradeExecutionResult {
  success: boolean;
  instrument: VolatilityInstrumentType;
  tradeParams?: TradeDetails;
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string;
  aiReasoning?: string;
  overDigit?: number | null;
  underDigit?: number | null;
}

export interface VolatilityTradeOptions {
  executionMode: 'turbo' | 'safe';
  numberOfBulkTrades: number;
  selectedInstrument: string;
  predictionDigit?: number | null; // For Over/Under trade type
  selectedStrategy?: string; // Strategy selection (Even/Odd, Rise/Fall, Over/Under)
  patternTrigger?: {
    shouldTrade: boolean;
    contractType: string;
    reasoning: string;
  }; // Pattern-based trade trigger
}

// Helper function to wait for next tick using WebSocket
async function waitForNextTick(instrument: VolatilityInstrumentType, userDerivApiToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for next tick'));
    }, 10000); // 10 second timeout

    // Use the existing getTicks function to get a single new tick
    getTicks(instrument, 1, userDerivApiToken)
      .then(() => {
        clearTimeout(timeoutId);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Helper function to execute trades with tick-based timing
async function executeTradesWithTickTiming(
  tradesToExecute: any[],
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
  totalStakeFromUser: number,
  instrumentLatestSpot: Record<string, number | undefined>,
  instrumentATR: Record<string, number | undefined>,
  executionMode: 'turbo' | 'safe',
  numberOfBulkTrades: number,
  predictionDigit?: number | null,
  selectedStrategy?: string,
  patternTrigger?: {shouldTrade: boolean, contractType: string, reasoning: string} | null
): Promise<VolatilityTradeExecutionResult[]> {
  const results: VolatilityTradeExecutionResult[] = [];

  if (executionMode === 'turbo') {
    // Turbo mode: Execute all trades immediately on same tick
    console.log(`[TradeAction/TickTiming] Turbo mode: Executing all ${tradesToExecute.length} trades immediately`);

    for (const aiProposal of tradesToExecute) {
      const result = await executeSingleTrade(
        aiProposal,
        userDerivApiToken,
        targetAccountId,
        selectedAccountType,
        userId,
        userSelectedTradeType,
        totalStakeFromUser,
        instrumentLatestSpot,
        instrumentATR,
        predictionDigit,
        selectedStrategy,
        patternTrigger
      );
      results.push(result);
    }
  } else {
    // Safe mode: Implement split-tick execution strategy
    console.log(`[TradeAction/TickTiming] Safe mode: Implementing split-tick execution for ${numberOfBulkTrades} bulk trades`);

    if (numberOfBulkTrades <= 5) {
      // Execute all trades on consecutive ticks (per-tick basis)
      console.log(`[TradeAction/TickTiming] Safe mode: ≤5 trades - executing per-tick on consecutive ticks`);

      for (let i = 0; i < tradesToExecute.length; i++) {
        if (i > 0) {
          // Wait for next tick before executing subsequent trades
          const instrumentFromAI = tradesToExecute[i].instrument as VolatilityInstrumentType;
          try {
            await waitForNextTick(instrumentFromAI, userDerivApiToken);
            console.log(`[TradeAction/TickTiming] Waited for tick ${i + 1}, executing trade ${i + 1}/${tradesToExecute.length}`);
          } catch (error) {
            console.error(`[TradeAction/TickTiming] Error waiting for tick ${i + 1}:`, error);
            // Continue with execution even if tick timing fails
          }
        }

        const result = await executeSingleTrade(
          tradesToExecute[i],
          userDerivApiToken,
          targetAccountId,
          selectedAccountType,
          userId,
          userSelectedTradeType,
          totalStakeFromUser,
          instrumentLatestSpot,
          instrumentATR,
          predictionDigit,
          selectedStrategy,
          patternTrigger
        );
        results.push(result);
      }
    } else {
      // Execute 80% on first tick, 20% on second tick
      const firstTickCount = Math.floor(numberOfBulkTrades * 0.8);
      const secondTickCount = numberOfBulkTrades - firstTickCount;

      console.log(`[TradeAction/TickTiming] Safe mode: >5 trades - executing ${firstTickCount} trades on first tick, ${secondTickCount} trades on second tick`);

      // Execute first batch (80%) on first tick
      for (let i = 0; i < Math.min(firstTickCount, tradesToExecute.length); i++) {
        const result = await executeSingleTrade(
          tradesToExecute[i],
          userDerivApiToken,
          targetAccountId,
          selectedAccountType,
          userId,
          userSelectedTradeType,
          totalStakeFromUser,
          instrumentLatestSpot,
          instrumentATR,
          predictionDigit,
          selectedStrategy,
          patternTrigger
        );
        results.push(result);
      }

      // Wait for next tick before executing second batch
      if (secondTickCount > 0 && tradesToExecute.length > firstTickCount) {
        const instrumentFromAI = tradesToExecute[firstTickCount].instrument as VolatilityInstrumentType;
        try {
          await waitForNextTick(instrumentFromAI, userDerivApiToken);
          console.log(`[TradeAction/TickTiming] Waited for second tick, executing remaining ${secondTickCount} trades`);
        } catch (error) {
          console.error(`[TradeAction/TickTiming] Error waiting for second tick:`, error);
          // Continue with execution even if tick timing fails
        }

        // Execute second batch (20%) on second tick
        for (let i = firstTickCount; i < tradesToExecute.length; i++) {
          const result = await executeSingleTrade(
            tradesToExecute[i],
            userDerivApiToken,
            targetAccountId,
            selectedAccountType,
            userId,
            userSelectedTradeType,
            totalStakeFromUser,
            instrumentLatestSpot,
            instrumentATR,
            predictionDigit,
            selectedStrategy,
            patternTrigger
          );
          results.push(result);
        }
      }
    }
  }

  return results;
}

// Helper function to execute a single trade
async function executeSingleTrade(
  aiProposal: any,
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
  totalStakeFromUser: number,
  instrumentLatestSpot: Record<string, number | undefined>,
  instrumentATR: Record<string, number | undefined>,
  predictionDigit?: number | null,
  selectedStrategy?: string,
  patternTrigger?: {shouldTrade: boolean, contractType: string, reasoning: string} | null
): Promise<VolatilityTradeExecutionResult> {
  let tradeDetailsForApi: TradeDetails | null = null;
  let currentApiSymbol: string | null = null;
  const instrumentFromAI = aiProposal.instrument as VolatilityInstrumentType;
  let aiReasoningForThisTrade = aiProposal.reasoning;

  try {
    currentApiSymbol = instrumentToDerivSymbol(instrumentFromAI);
    console.log(`[TradeAction/SingleTrade] Processing AI proposed trade for: ${instrumentFromAI} (Deriv: ${currentApiSymbol})`);

    if (!aiProposal.instrument || !aiProposal.derivContractType || !aiProposal.duration || !aiProposal.durationUnit || !aiProposal.stake) {
      const missingFieldsError = `AI proposal for ${instrumentFromAI} is incomplete. Skipping.`;
      console.error(`[TradeAction/SingleTrade] ${missingFieldsError}`, aiProposal);
      return { success: false, instrument: instrumentFromAI, error: missingFieldsError, aiReasoning: aiProposal.reasoning };
    }

    let calculatedBarrier: string | number | undefined = aiProposal.barrier;

    // Override contract type based on selected strategy
    let finalContractType = aiProposal.derivContractType;
    if (selectedStrategy) {
      switch (selectedStrategy) {
        case 'Even':
          finalContractType = 'DIGITEVEN';
          break;
        case 'Odd':
          finalContractType = 'DIGITODD';
          break;
        case 'Rise':
          finalContractType = 'CALL';
          break;
        case 'Fall':
          finalContractType = 'PUT';
          break;
        case 'Over':
          finalContractType = 'DIGITOVER';
          break;
        case 'Under':
          finalContractType = 'DIGITUNDER';
          break;
        default:
          // Keep AI proposal if strategy doesn't match known types
          finalContractType = aiProposal.derivContractType;
      }
      console.log(`[TradeAction/SingleTrade] Using strategy-based contract type: ${finalContractType} (strategy: ${selectedStrategy})`);
    }

    if (userSelectedTradeType === 'DigitsOverUnder') {
      // Use prediction digit from user input if provided, otherwise fall back to AI proposal
      if (predictionDigit !== null && predictionDigit !== undefined) {
        calculatedBarrier = predictionDigit.toString();
        console.log(`[TradeAction/SingleTrade] Using user prediction digit: ${calculatedBarrier}`);
      } else if (aiProposal.barrier !== undefined && aiProposal.barrier !== null && String(aiProposal.barrier).trim() !== '') {
        const barrierString = String(aiProposal.barrier).trim();
        if (!/^\d$/.test(barrierString)) {
          throw new Error(`Invalid barrier '${aiProposal.barrier}' for DigitsOverUnder on ${instrumentFromAI}. Must be a single digit string (0-9).`);
        }
        calculatedBarrier = barrierString;
        console.log(`[TradeAction/SingleTrade] Using AI proposal barrier: ${calculatedBarrier}`);
      } else {
        throw new Error(`Barrier (predicted digit) is mandatory for DigitsOverUnder on ${instrumentFromAI} but was not provided by user or AI.`);
      }
    } else if (userSelectedTradeType === 'HigherLower') {
      const latestSpot = instrumentLatestSpot[instrumentFromAI];
      const atr = instrumentATR[instrumentFromAI];

      if (latestSpot !== undefined) {
        // Enhanced barrier calculation for Higher/Lower trades
        let offsetFactor: number;
        let fallbackPercentage: number;

        // Determine offset based on duration and instrument volatility
        if (aiProposal.durationUnit === 't') {
          offsetFactor = atr ? 0.8 : 0;
          fallbackPercentage = 0.002;
        } else if (aiProposal.durationUnit === 's' || aiProposal.durationUnit === 'm') {
          offsetFactor = atr ? 1.2 : 0;
          fallbackPercentage = 0.003;
        } else {
          offsetFactor = atr ? 2.0 : 0;
          fallbackPercentage = 0.01;
        }

        const atrBasedOffset = atr ? atr * offsetFactor : latestSpot * fallbackPercentage;
        const relativeOffset = (aiProposal.derivContractType === 'CALL') ? atrBasedOffset : -atrBasedOffset;
        const decimalPlaces = getInstrumentDecimalPlaces(instrumentFromAI);
        const sign = relativeOffset >= 0 ? '+' : '';
        calculatedBarrier = `${sign}${relativeOffset.toFixed(decimalPlaces)}`;

        console.log(`[TradeAction/SingleTrade] Enhanced RELATIVE barrier for ${instrumentFromAI} (${aiProposal.derivContractType}): ${calculatedBarrier}`);
      } else {
        throw new Error(`Cannot determine current spot price for programmatic barrier for ${instrumentFromAI}.`);
      }
    }

    tradeDetailsForApi = {
      symbol: currentApiSymbol,
      contract_type: finalContractType,
      duration: aiProposal.duration,
      duration_unit: aiProposal.durationUnit,
      amount: aiProposal.stake,
      currency: 'USD',
      basis: 'stake',
      token: userDerivApiToken,
      barrier: calculatedBarrier,
    };

    console.log(`[TradeAction/SingleTrade] Constructing TradeDetails for ${instrumentFromAI}:`, JSON.stringify({ ...tradeDetailsForApi, token: '***REDACTED***' }, null, 2));
    const derivTradeResponse = await placeTrade(tradeDetailsForApi, targetAccountId);
    console.log(`[TradeAction/SingleTrade] Deriv API placeTrade response for ${instrumentFromAI}: Contract ID ${derivTradeResponse.contract_id}`);

    const savedDbTrade = await prisma.trade.create({
      data: {
        userId: userId,
        symbol: instrumentFromAI,
        type: `${userSelectedTradeType} (${finalContractType})`,
        amount: tradeDetailsForApi.amount,
        price: derivTradeResponse.entry_spot,
        totalValue: tradeDetailsForApi.amount,
        status: 'OPEN',
        openTime: new Date(),
        derivContractId: derivTradeResponse.contract_id.toString(),
        derivAccountId: targetAccountId,
        accountType: selectedAccountType,
        aiStrategyId: null,
        metadata: {
          reasoning: aiReasoningForThisTrade,
          derivLongcode: derivTradeResponse.longcode,
          barrier: calculatedBarrier,
          duration: aiProposal.duration,
          durationUnit: aiProposal.durationUnit,
          userSelectedTradeType: userSelectedTradeType,
          derivSymbol: currentApiSymbol,
          totalSessionStake: totalStakeFromUser,
          selectedStrategy: selectedStrategy,
          finalContractType: finalContractType,
          patternTrigger: patternTrigger,
          isPatternBasedTrade: !!patternTrigger,
        }
      },
    });

    console.log(`[TradeAction/SingleTrade] Trade for ${instrumentFromAI} saved to DB. DB ID: ${savedDbTrade.id}`);
    return {
      success: true,
      instrument: instrumentFromAI,
      tradeParams: tradeDetailsForApi,
      tradeResponse: derivTradeResponse,
      dbTradeId: savedDbTrade.id,
      aiReasoning: aiReasoningForThisTrade
    };

  } catch (error: any) {
    console.error(`[TradeAction/SingleTrade] CRITICAL ERROR during trade execution for ${instrumentFromAI} (Deriv: ${currentApiSymbol || 'N/A'}):`, error.message, error.stack);
    return {
      success: false,
      instrument: instrumentFromAI,
      tradeParams: tradeDetailsForApi || undefined,
      error: error.message || `Unknown error for ${instrumentFromAI}.`,
      aiReasoning: aiReasoningForThisTrade
    };
  }
}

export async function executeVolatilityAiTradeLoop(
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
  totalStakeFromUser: number,
  options?: VolatilityTradeOptions
): Promise<VolatilityTradeExecutionResult[]> {
  // Use the new options or defaults
  const executionMode = options?.executionMode || 'safe';
  const numberOfBulkTrades = options?.numberOfBulkTrades || 1;
  const selectedInstrument = options?.selectedInstrument || 'Volatility 100 Index';
  const predictionDigit = options?.predictionDigit || null;
  const selectedStrategy = options?.selectedStrategy || '';
  const patternTrigger = options?.patternTrigger || null;

  const AVAILABLE_VOLATILITY_INDICES: VolatilityInstrumentType[] = ["R_10", "R_25", "R_50", "R_75", "R_100"];
  const results: VolatilityTradeExecutionResult[] = [];

  if (!userDerivApiToken || !targetAccountId || !userId) {
    const errorMsg = "User token, target account ID, or user ID is missing for Volatility AI trade loop.";
    console.error(`[TradeAction/Session] Pre-condition failed: ${errorMsg}`);
    return [{ success: false, instrument: "N/A" as VolatilityInstrumentType, error: errorMsg }];
  }

  console.log(`[TradeAction/Session] Starting AI session. User: ${userId}, Account: ${targetAccountId}, Trade Type: ${userSelectedTradeType}, Total Stake: ${totalStakeFromUser}`);
  console.log(`[TradeAction/Session] Execution Mode: ${executionMode}, Bulk Trades: ${numberOfBulkTrades}, Selected Instrument: ${selectedInstrument}`);

  const instrumentTicksForAI: Record<string, PriceTick[]> = {};
  const instrumentIndicatorsForAI: Record<string, InstrumentIndicatorData | undefined> = {};
  const instrumentLatestSpot: Record<string, number | undefined> = {};
  const instrumentATR: Record<string, number | undefined> = {};

  for (const instrument of AVAILABLE_VOLATILITY_INDICES) {
    try {
      let priceData: PriceTick[];
      let indicators: InstrumentIndicatorData | undefined = {};
      let rawCandlesData: CandleData[] | undefined = undefined;

      if (userSelectedTradeType.startsWith("Digits")) {
        // Fetch raw tick data and map into PriceTick[]
        // Reduced tick count for DigitsOverUnder to speed up AI processing
        const tickCount = userSelectedTradeType === 'DigitsOverUnder' ? 15 : 25;
        const tickData = await getTicks(instrument as VolatilityInstrumentType, tickCount, userDerivApiToken);
        priceData = tickData.map(tick => ({
          epoch: tick.epoch,
          price: tick.price, // Fixed: use tick.price instead of tick.quote
          time: new Date(tick.epoch * 1000).toISOString()
        }));
        if (priceData.length > 0) {
          instrumentLatestSpot[instrument] = priceData[priceData.length - 1].price;
        }
      } else {
        rawCandlesData = await getCandles(instrument as any, 30, 60, userDerivApiToken);
        if (rawCandlesData && rawCandlesData.length >= 5) {
          indicators = calculateAllIndicators(rawCandlesData); // This is the correct function
          priceData = rawCandlesData.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
          if (priceData.length > 0) {
            instrumentLatestSpot[instrument] = priceData[priceData.length - 1].price;
          }
          if (indicators?.atr) {
            instrumentATR[instrument] = indicators.atr;
          }
        } else {
          priceData = [];
        }
      }

      if (!priceData || priceData.length < 5) {
        console.warn(`[TradeAction/Session] Insufficient data for ${instrument}. Excluding from AI input to avoid schema issues.`);
        // Don't add to instrumentTicksForAI or instrumentIndicatorsForAI - exclude entirely
      } else {
        instrumentTicksForAI[instrument] = priceData.slice(-50);
        instrumentIndicatorsForAI[instrument] = indicators;
      }
    } catch (dataFetchError: any) {
      console.error(`[TradeAction/Session] Failed to fetch data for ${instrument}: ${dataFetchError.message}`);
      // For instruments that fail to fetch data, we'll exclude them from the AI input entirely
      // rather than including them with empty data, which can cause schema validation issues
      console.warn(`[TradeAction/Session] Excluding ${instrument} from AI input due to data fetch failure.`);
      // Don't add to instrumentTicksForAI or instrumentIndicatorsForAI
    }
  }

  // Filter out undefined indicators to avoid schema validation issues
  const cleanedInstrumentIndicators: Record<string, InstrumentIndicatorData> = {};
  for (const [instrument, indicators] of Object.entries(instrumentIndicatorsForAI)) {
    if (indicators !== undefined) {
      cleanedInstrumentIndicators[instrument] = indicators;
    }
  }

  // Only include instruments that have data available
  const availableInstrumentsWithData = AVAILABLE_VOLATILITY_INDICES.filter(instrument =>
    instrumentTicksForAI[instrument] && instrumentTicksForAI[instrument].length > 0
  );

  console.log(`[TradeAction/Session] Available instruments with data: ${availableInstrumentsWithData.join(', ')}`);

  if (availableInstrumentsWithData.length === 0) {
    console.error('[TradeAction/Session] No instruments have sufficient data for AI analysis.');
    return [{
      success: false,
      instrument: "N/A" as VolatilityInstrumentType,
      error: "No instruments have sufficient data for AI analysis. Please try again later."
    }];
  }

  // Build AI session input with conditional fields
  const aiSessionInput: VolatilitySessionStrategyInput = {
    // Single instrument selection - use the user-selected instrument
    selectedInstrument: selectedInstrument,
    availableInstruments: availableInstrumentsWithData, // Keep for backward compatibility
    userSelectedTradeType: userSelectedTradeType,
    totalSessionStake: totalStakeFromUser,
    instrumentTicks: instrumentTicksForAI,
    instrumentIndicators: cleanedInstrumentIndicators,

    // Pass all user settings from volatility trading controls
    executionMode: executionMode,
    numberOfBulkTrades: numberOfBulkTrades,
    accountType: selectedAccountType,
    selectedStrategy: selectedStrategy,

    // Only include predictionDigit if it's not null and trade type is DigitsOverUnder
    ...(predictionDigit !== null && predictionDigit !== undefined && userSelectedTradeType === 'DigitsOverUnder'
      ? { predictionDigit: predictionDigit }
      : {}),

    // Only include patternTrigger if it's not null and has valid data
    ...(patternTrigger !== null && patternTrigger !== undefined && patternTrigger.shouldTrade !== undefined
      ? { patternTrigger: patternTrigger }
      : {}),
  };

  console.log(`[TradeAction/Session] Calling AI for session strategy. TradeType: ${userSelectedTradeType}, TotalStake: ${totalStakeFromUser}`);

  try {
    let aiSessionStrategy;

    // Use pattern-based strategy for Even/Odd trades with pattern triggers
    if (patternTrigger && userSelectedTradeType === 'DigitsEvenOdd') {
      console.log(`[TradeAction/Session] Using pattern-based strategy:`, patternTrigger);

      // Create pattern-based trade proposals
      const stakePerTrade = totalStakeFromUser / numberOfBulkTrades;
      const tradesToExecute = Array.from({ length: numberOfBulkTrades }, (_, index) => ({
        derivContractType: patternTrigger.contractType,
        stake: stakePerTrade,
        duration: 5, // 5 ticks for digit trades
        durationUnit: 't' as const,
        barrier: undefined,
        reasoning: `${patternTrigger.reasoning} (Trade ${index + 1}/${numberOfBulkTrades})`
      }));

      aiSessionStrategy = {
        tradesToExecute,
        overallReasoning: `Pattern-based ${patternTrigger.contractType} strategy: ${patternTrigger.reasoning}`,
        totalStake: totalStakeFromUser,
        numberOfTrades: numberOfBulkTrades,
        success: true
      };
    } else {
      // Add timeout to prevent Vercel timeout
      // DigitsOverUnder needs more time due to complex tick analysis and barrier validation
      const timeoutDuration = userSelectedTradeType === 'DigitsOverUnder' ? 58000 : 45000;
      aiSessionStrategy = await Promise.race([
        generateVolatilitySessionStrategy(aiSessionInput),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`AI session timed out after ${timeoutDuration/1000} seconds`)), timeoutDuration);
        })
      ]);
    }
    console.log(`[TradeAction/Session] AI Session Strategy received. Overall Reasoning: ${aiSessionStrategy.overallReasoning}`);
    console.log(`[TradeAction/Session] AI proposes ${aiSessionStrategy.tradesToExecute.length} trades.`);

    if (aiSessionStrategy.tradesToExecute.length === 0) {
        results.push({
            success: false,
            instrument: "N/A" as VolatilityInstrumentType,
            error: `AI decided not to place any trades. Reasoning: ${aiSessionStrategy.overallReasoning || 'No specific reason provided.'}`,
            aiReasoning: aiSessionStrategy.overallReasoning
        });
        console.log(`[TradeAction/Session] Finished. AI proposed no trades.`);
        return results;
    }

    // Execute trades using the new tick-based execution strategy
    const executionResults = await executeTradesWithTickTiming(
      aiSessionStrategy.tradesToExecute,
      userDerivApiToken,
      targetAccountId,
      selectedAccountType,
      userId,
      userSelectedTradeType,
      totalStakeFromUser,
      instrumentLatestSpot,
      instrumentATR,
      executionMode,
      numberOfBulkTrades,
      predictionDigit,
      selectedStrategy,
      patternTrigger
    );

    results.push(...executionResults);
  } catch (aiError: any) {
      console.error(`[TradeAction/Session] CRITICAL ERROR during AI Session Strategy generation:`, aiError.message, aiError.stack);
      results.push({ success: false, instrument: "N/A" as VolatilityInstrumentType, error: `AI Strategy Generation Failed: ${aiError.message}` });
  }

  console.log(`[TradeAction/Session] Finished Volatility AI session. Total results processed: ${results.length}`);
  return results;
}
