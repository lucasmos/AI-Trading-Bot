'use server';

import {
  AutomatedTradingStrategyOutput,
  ForexCryptoCommodityInstrumentType
} from '@/types';
import {
  placeTrade,
  TradeDetails,
  PlaceTradeResponse,
  instrumentToDerivSymbol,
  getCandles, // Ensure getCandles is imported
  getTicks    // Ensure getTicks is imported
} from '@/services/deriv';
import { prisma } from '@/lib/db';

// Types needed for the new executeVolatilityAiTradeLoop
import {
    generateVolatilitySessionStrategy, // Corrected: Import the new flow name
    VolatilitySessionStrategyInput // Corrected: Import the new input type
} from '@/ai/flows/volatility-trading-strategy-flow';
import { UserTradeType } from '@/types/ai-shared-types';
import { calculateAllIndicators } from '@/lib/technical-analysis';
import { VolatilityInstrumentType, PriceTick, CandleData, InstrumentIndicatorData, ActiveAutomatedVolatilityTrade } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils'; // Assuming this utility exists

export interface TradeExecutionResult {
  success: boolean;
  instrument: ForexCryptoCommodityInstrumentType;
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

// Interface for the new Volatility AI Trade Loop
export interface VolatilityTradeExecutionResult {
  success: boolean;
  instrument: VolatilityInstrumentType;
  tradeParams?: TradeDetails;
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string;
  aiReasoning?: string;
}

export async function executeVolatilityAiTradeLoop(
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
  totalStakeFromUser: number
): Promise<VolatilityTradeExecutionResult[]> {
  const AVAILABLE_VOLATILITY_INDICES: VolatilityInstrumentType[] = ["R_10", "R_25", "R_50", "R_75", "R_100"];
  const results: VolatilityTradeExecutionResult[] = [];

  if (!userDerivApiToken || !targetAccountId || !userId) {
    const errorMsg = "User token, target account ID, or user ID is missing for Volatility AI trade loop.";
    console.error(`[TradeAction/Session] Pre-condition failed: ${errorMsg}`);
    return [{ success: false, instrument: "N/A" as VolatilityInstrumentType, error: errorMsg }];
  }

  console.log(`[TradeAction/Session] Starting AI session. User: ${userId}, Account: ${targetAccountId}, Trade Type: ${userSelectedTradeType}, Total Stake: ${totalStakeFromUser}`);

  // 1. Fetch data for ALL available instruments first
  const instrumentTicksForAI: Record<string, PriceTick[]> = {};
  const instrumentIndicatorsForAI: Record<string, InstrumentIndicatorData | undefined> = {};
  const instrumentLatestSpot: Record<string, number | undefined> = {}; // To store latest spot for barrier calc
  const instrumentATR: Record<string, number | undefined> = {}; // To store ATR for barrier calc

  for (const instrument of AVAILABLE_VOLATILITY_INDICES) {
    try {
      let priceData: PriceTick[];
      let indicators: InstrumentIndicatorData | undefined = {};

      if (userSelectedTradeType.startsWith("Digits")) {
        priceData = await getTicks(instrument as any, 25, userDerivApiToken); // Fetch last 25 ticks
        if (priceData.length > 0) {
          instrumentLatestSpot[instrument] = priceData[priceData.length - 1].price;
        }
      } else {
        const rawCandlesData = await getCandles(instrument as any, 30, 60, userDerivApiToken); // Fetch 30 1-min candles
        if (rawCandlesData && rawCandlesData.length >= 5) {
          indicators = calculateAllIndicators(rawCandlesData);
          priceData = rawCandlesData.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
          if (priceData.length > 0) {
            instrumentLatestSpot[instrument] = priceData[priceData.length - 1].price;
          }
          if (indicators?.atr) { // Ensure indicators and atr itself are defined
            instrumentATR[instrument] = indicators.atr;
          }
        } else {
          priceData = [];
        }
      }

      if (!priceData || priceData.length < 5) {
        console.warn(`[TradeAction/Session] Insufficient data for ${instrument}. It will be passed to AI with limited info.`);
        instrumentTicksForAI[instrument] = [];
        instrumentIndicatorsForAI[instrument] = undefined; // Explicitly undefined
      } else {
        instrumentTicksForAI[instrument] = priceData.slice(-50);
        instrumentIndicatorsForAI[instrument] = indicators;
      }
    } catch (dataFetchError: any) {
      console.error(`[TradeAction/Session] Failed to fetch data for ${instrument}: ${dataFetchError.message}`);
      instrumentTicksForAI[instrument] = [];
      instrumentIndicatorsForAI[instrument] = undefined; // Explicitly undefined on error
    }
  }

  // 2. Call AI flow ONCE with all data and total stake
  const aiSessionInput: VolatilitySessionStrategyInput = {
    availableInstruments: AVAILABLE_VOLATILITY_INDICES,
    userSelectedTradeType: userSelectedTradeType,
    totalSessionStake: totalStakeFromUser,
    instrumentTicks: instrumentTicksForAI, // This is Record<string, PriceTick[]>
    instrumentIndicators: instrumentIndicatorsForAI, // This is Record<string, InstrumentIndicatorData | undefined>
  };

  console.log(`[TradeAction/Session] Calling AI for session strategy. TradeType: ${userSelectedTradeType}, TotalStake: ${totalStakeFromUser}`);

  try {
    const aiSessionStrategy = await generateVolatilitySessionStrategy(aiSessionInput);
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

    // 3. Loop through AI's proposed trades and execute them
    for (const aiProposal of aiSessionStrategy.tradesToExecute) {
      let tradeDetailsForApi: TradeDetails | null = null;
      let currentApiSymbol: string | null = null;
      const instrumentFromAI = aiProposal.instrument as VolatilityInstrumentType;
      let aiReasoningForThisTrade = aiProposal.reasoning;

      try {
        currentApiSymbol = instrumentToDerivSymbol(instrumentFromAI);
        console.log(`[TradeAction/SessionLoop] Processing AI proposed trade for: ${instrumentFromAI} (Deriv: ${currentApiSymbol})`);

        let calculatedBarrier: string | number | undefined = aiProposal.barrier;

        if ((userSelectedTradeType === 'HigherLower' || userSelectedTradeType === 'TouchNoTouch')) {
          // Use the pre-fetched latest spot and ATR for this instrument
          const latestSpot = instrumentLatestSpot[instrumentFromAI];
          const atr = instrumentATR[instrumentFromAI];

          if (latestSpot !== undefined) {
            const offsetFactor = userSelectedTradeType === 'HigherLower' ? 0.3 : 0.5;
            // Use a very small percentage of spot as fallback if ATR is not available
            const atrBasedOffset = atr ? atr * offsetFactor : latestSpot * 0.0005;

            let barrierValue = (aiProposal.derivContractType === 'CALL' || aiProposal.derivContractType === 'ONETOUCH')
                               ? latestSpot + atrBasedOffset
                               : latestSpot - atrBasedOffset;
            const decimalPlaces = getInstrumentDecimalPlaces(instrumentFromAI);
            calculatedBarrier = barrierValue.toFixed(decimalPlaces);
            console.log(`[TradeAction/SessionLoop] Programmatically determined barrier for ${instrumentFromAI} (${aiProposal.derivContractType}): ${calculatedBarrier} (Spot: ${latestSpot}, ATR used: ${atr !== undefined}, Offset: ${atrBasedOffset.toFixed(decimalPlaces)})`);
          } else {
            // This means data fetching for this specific instrument (chosen by AI) failed earlier or yielded no spot price.
            throw new Error(`Cannot determine current spot price for programmatic barrier for ${instrumentFromAI}. Data might have been insufficient.`);
          }
        }

        tradeDetailsForApi = {
          symbol: currentApiSymbol,
          contract_type: aiProposal.derivContractType,
          duration: aiProposal.duration,
          duration_unit: aiProposal.durationUnit,
          amount: aiProposal.stake,
          currency: 'USD',
          basis: 'stake',
          token: userDerivApiToken,
          barrier: calculatedBarrier,
        };

        console.log(`[TradeAction/SessionLoop] Constructing TradeDetails for ${instrumentFromAI}:`, JSON.stringify({ ...tradeDetailsForApi, token: '***REDACTED***' }, null, 2));
        const derivTradeResponse = await placeTrade(tradeDetailsForApi, targetAccountId);
        console.log(`[TradeAction/SessionLoop] Deriv API placeTrade response for ${instrumentFromAI}: Contract ID ${derivTradeResponse.contract_id}`);

        const savedDbTrade = await prisma.trade.create({
          data: {
            userId: userId,
            symbol: instrumentFromAI,
            type: `${userSelectedTradeType} (${aiProposal.derivContractType})`,
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
              overallAIReasoning: aiSessionStrategy.overallReasoning,
            }
          },
        });
        console.log(`[TradeAction/SessionLoop] Trade for ${instrumentFromAI} saved to DB. DB ID: ${savedDbTrade.id}`);
        results.push({ success: true, instrument: instrumentFromAI, tradeParams: tradeDetailsForApi, tradeResponse: derivTradeResponse, dbTradeId: savedDbTrade.id, aiReasoning: aiReasoningForThisTrade });

      } catch (error: any) {
        console.error(`[TradeAction/SessionLoop] CRITICAL ERROR during trade execution for ${instrumentFromAI} (Deriv: ${currentApiSymbol || 'N/A'}):`, error.message, error.stack);
        results.push({ success: false, instrument: instrumentFromAI, tradeParams: tradeDetailsForApi || undefined, error: error.message || `Unknown error for ${instrumentFromAI}.`, aiReasoning: aiReasoningForThisTrade });
      }
    }
  } catch (aiError: any) {
      console.error(`[TradeAction/Session] CRITICAL ERROR during AI Session Strategy generation:`, aiError.message, aiError.stack);
      results.push({ success: false, instrument: "N/A" as VolatilityInstrumentType, error: `AI Strategy Generation Failed: ${aiError.message}` });
  }

  console.log(`[TradeAction/Session] Finished Volatility AI session. Total results processed: ${results.length}`);
  return results;
}
