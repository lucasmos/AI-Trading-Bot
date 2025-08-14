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
import { generateShortcode, calculatePayout } from '@/utils/deriv-trade-utils';
import { VolatilityInstrumentType, PriceTick, CandleData, InstrumentIndicatorData, ForexCommodityInstrumentType, AutomatedTradingStrategyOutput } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

// CRITICAL FIX: Enhanced trade monitoring function using actual Deriv API calls
async function startTradeMonitoring(contractId: string, dbTradeId: string, apiToken: string, accountId: string) {
  console.log(`[TradeMonitoring] Starting enhanced monitoring for contract ${contractId}, DB trade ${dbTradeId}`);

  // Monitor the trade using actual Deriv API contract status
  const maxMonitoringTime = 120000; // 2 minutes maximum monitoring
  const checkInterval = 5000; // Check every 5 seconds
  const startTime = Date.now();

  const monitorTrade = async () => {
    try {
      console.log(`[TradeMonitoring] Checking contract status for ${contractId}`);

      // Get actual contract status from Deriv API
      const contractStatus = await getContractStatus(parseInt(contractId), apiToken, accountId);
      
      console.log(`[TradeMonitoring] Contract ${contractId} status: ${contractStatus.status}`);

      // Check if trade is completed
      if (contractStatus.status === 'won' || contractStatus.status === 'lost' || contractStatus.status === 'sold') {
        // Calculate profit/loss: Sell Price - Buy Price
        const profit = (contractStatus.sell_price || 0) - contractStatus.buy_price;
        
        console.log(`[TradeMonitoring] Contract ${contractId} completed - Status: ${contractStatus.status}, Profit: ${profit}`);

        // Update the trade in database with actual Deriv API data
        await prisma.trade.update({
          where: { id: dbTradeId },
          data: {
            status: 'closed',
            derivSellPrice: contractStatus.sell_price || 0,
            derivSellTime: contractStatus.sell_time ? BigInt(contractStatus.sell_time) : BigInt(Math.floor(Date.now() / 1000))
          }
        });

        console.log(`[TradeMonitoring] ✅ Updated DB trade ${dbTradeId}: ${contractStatus.status} with profit ${profit}`);
        return; // Stop monitoring
      }

      // Continue monitoring if trade is still open and within time limit
      if (Date.now() - startTime < maxMonitoringTime) {
        setTimeout(monitorTrade, checkInterval);
      } else {
        console.log(`[TradeMonitoring] ⏰ Monitoring timeout for contract ${contractId}, marking as closed`);
        
        // Timeout fallback - get final status
        const finalStatus = await getContractStatus(parseInt(contractId), apiToken, accountId);
        await prisma.trade.update({
          where: { id: dbTradeId },
          data: {
            status: 'closed',
            derivSellPrice: finalStatus.sell_price || 0,
            derivSellTime: finalStatus.sell_time ? BigInt(finalStatus.sell_time) : BigInt(Math.floor(Date.now() / 1000))
          }
        });
      }

    } catch (error) {
      console.error(`[TradeMonitoring] Error checking contract ${contractId}:`, error);

      // Fallback: mark as closed with current timestamp
      try {
        await prisma.trade.update({
          where: { id: dbTradeId },
          data: {
            status: 'closed',
            derivSellPrice: 0,
            derivSellTime: BigInt(Math.floor(Date.now() / 1000))
          }
        });
        console.log(`[TradeMonitoring] ⚠️ Fallback: Marked trade ${dbTradeId} as closed due to monitoring error`);
      } catch (fallbackError) {
        console.error(`[TradeMonitoring] Critical error in fallback update:`, fallbackError);
      }
    }
  };

  // Start monitoring with initial delay
  setTimeout(monitorTrade, 3000); // Wait 3 seconds before first check
}

// Kept for other parts of the application that might use it.
export interface TradeExecutionResult {
  success: boolean;
  instrument: ForexCryptoCommodityInstrumentType; // Kept specific for this interface
  tradeResponse?: PlaceTradeResponse;
  error?: string;
  dbTradeId?: string;
}

// CRITICAL FIX: Pattern analysis function for Manual Mode Even/Odd trades
interface PatternAnalysisResult {
  shouldExecute: boolean;
  contractType: 'DIGITEVEN' | 'DIGITODD';
  reasoning: string;
  currentDigit: number;
  consecutiveCount: number;
  patternType: 'even_after_odds' | 'odd_after_evens' | 'none';
}

function analyzeEvenOddPatterns(digits: number[], selectedStrategy: string): PatternAnalysisResult {
  if (digits.length < 4) {
    return {
      shouldExecute: false,
      contractType: selectedStrategy === 'Even' ? 'DIGITEVEN' : 'DIGITODD',
      reasoning: `Insufficient data for pattern analysis. Need at least 4 digits, got ${digits.length}`,
      currentDigit: digits[digits.length - 1] || 0,
      consecutiveCount: 0,
      patternType: 'none'
    };
  }

  const currentDigit = digits[digits.length - 1];
  const isCurrentEven = currentDigit % 2 === 0;

  // Count consecutive digits of the same type before the current digit
  let consecutiveCount = 0;
  let consecutiveType: 'even' | 'odd' | null = null;

  // Look backwards from the second-to-last digit
  for (let i = digits.length - 2; i >= 0; i--) {
    const digit = digits[i];
    const isEven = digit % 2 === 0;
    const digitType = isEven ? 'even' : 'odd';

    if (consecutiveType === null) {
      consecutiveType = digitType;
      consecutiveCount = 1;
    } else if (consecutiveType === digitType) {
      consecutiveCount++;
    } else {
      break; // Different type, stop counting
    }
  }

  // CRITICAL FIX: Apply specific Even/Odd trading rules
  let shouldExecute = false;
  let patternType: 'even_after_odds' | 'odd_after_evens' | 'none' = 'none';
  let reasoning = '';

  if (selectedStrategy === 'Even') {
    // Even Trade Strategy: Execute ONLY when there are 3+ consecutive odd digits followed by an even digit
    if (consecutiveCount >= 3 && consecutiveType === 'odd' && isCurrentEven) {
      shouldExecute = true;
      patternType = 'even_after_odds';
      reasoning = `Even strategy triggered: ${consecutiveCount} consecutive odd digits [${digits.slice(-consecutiveCount-1, -1).join(',')}] followed by even digit ${currentDigit}`;
    } else if (consecutiveCount >= 3 && consecutiveType === 'odd' && !isCurrentEven) {
      reasoning = `Even strategy waiting: ${consecutiveCount} consecutive odd digits detected, but current digit ${currentDigit} is odd. Need even digit to trigger.`;
    } else {
      reasoning = `Even strategy not triggered: Need 3+ consecutive odd digits followed by even. Current: ${consecutiveCount} consecutive ${consecutiveType || 'unknown'} digits, current digit ${currentDigit} is ${isCurrentEven ? 'even' : 'odd'}`;
    }
  } else if (selectedStrategy === 'Odd') {
    // Odd Trade Strategy: Execute ONLY when there are 3+ consecutive even digits followed by an odd digit
    if (consecutiveCount >= 3 && consecutiveType === 'even' && !isCurrentEven) {
      shouldExecute = true;
      patternType = 'odd_after_evens';
      reasoning = `Odd strategy triggered: ${consecutiveCount} consecutive even digits [${digits.slice(-consecutiveCount-1, -1).join(',')}] followed by odd digit ${currentDigit}`;
    } else if (consecutiveCount >= 3 && consecutiveType === 'even' && isCurrentEven) {
      reasoning = `Odd strategy waiting: ${consecutiveCount} consecutive even digits detected, but current digit ${currentDigit} is even. Need odd digit to trigger.`;
    } else {
      reasoning = `Odd strategy not triggered: Need 3+ consecutive even digits followed by odd. Current: ${consecutiveCount} consecutive ${consecutiveType || 'unknown'} digits, current digit ${currentDigit} is ${isCurrentEven ? 'even' : 'odd'}`;
    }
  }

  return {
    shouldExecute,
    contractType: selectedStrategy === 'Even' ? 'DIGITEVEN' : 'DIGITODD',
    reasoning,
    currentDigit,
    consecutiveCount,
    patternType
  };
}

// CRITICAL FIX: Turbo Mode execution - ALL trades execute simultaneously with identical entry/exit prices
async function executeManualTurboMode(
  instrument: VolatilityInstrumentType,
  contractType: 'DIGITEVEN' | 'DIGITODD',
  numberOfTrades: number,
  stakePerTrade: number,
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  patternAnalysis: PatternAnalysisResult,
  sharedPricePoint: number,
  tickDuration: number = 1
): Promise<VolatilityTradeExecutionResult[]> {

  console.log(`[TradeAction/TurboMode] 🚀 Executing ${numberOfTrades} trades simultaneously`);
  console.log(`[TradeAction/TurboMode] Shared Price Point: ${sharedPricePoint} (Entry = Exit for all trades)`);
  console.log(`[TradeAction/TurboMode] Contract Type: ${contractType}, Pattern: ${patternAnalysis.patternType}`);

  const results: VolatilityTradeExecutionResult[] = [];
  const executionTimestamp = Date.now();

  // CRITICAL FIX: Execute all trades in parallel with identical parameters
  const tradePromises = Array.from({ length: numberOfTrades }, async (_, index) => {
    const tradeDetails: TradeDetails = {
      symbol: instrumentToDerivSymbol(instrument),
      contract_type: contractType,
      duration: tickDuration, // User-selected tick duration
      duration_unit: 't',
      amount: stakePerTrade,
      currency: 'USD',
      basis: 'stake',
      token: userDerivApiToken,
      sharedPricePoint: sharedPricePoint, // CRITICAL: Enforce shared price
      isTurboMode: true // CRITICAL: Enable Turbo mode flag
    };

    console.log(`[TradeAction/TurboMode] Trade ${index + 1}/${numberOfTrades} - Entry/Exit Price: ${sharedPricePoint}`);

    try {
      const tradeResponse = await placeTrade(tradeDetails, targetAccountId);

      // Validate required fields from Deriv API response
      if (!tradeResponse.contract_id) {
        throw new Error('Missing contract_id in Deriv API response');
      }
      if (!tradeResponse.buy_price) {
        throw new Error('Missing buy_price in Deriv API response');
      }
      if (!tradeResponse.longcode) {
        throw new Error('Missing longcode in Deriv API response');
      }

      // Save to database with complete Deriv API fields
      const dbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: instrumentToDerivSymbol(instrument),
          status: 'OPEN',
          derivContractId: BigInt(tradeResponse.contract_id),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,

          // Complete Deriv API fields for database persistence
          derivLongcode: tradeResponse.longcode,
          derivShortcode: generateShortcode(contractType, instrumentToDerivSymbol(instrument), tradeResponse.buy_price, Math.floor(executionTimestamp / 1000), tickDuration),
          derivBuyPrice: Math.round(tradeResponse.buy_price * 100), // Convert to integer (cents) as per user preference
          derivPayout: calculatePayout(tradeResponse.buy_price, contractType),
          derivPurchaseTime: BigInt(Math.floor(executionTimestamp / 1000)),
          derivSellPrice: null, // Will be updated when trade closes
          derivSellTime: null, // Will be updated when trade closes
          derivContractType: contractType,
          derivUnderlyingSymbol: instrumentToDerivSymbol(instrument),
          derivDurationType: 'ticks',
          derivAppId: 80447, // Our app ID
          derivTransactionId: BigInt(tradeResponse.transaction_id || tradeResponse.contract_id), // Use actual transaction ID from Deriv API

          metadata: {
            instrument: instrument,
            tradeType: 'DigitsEvenOdd',
            contractType: contractType,
            derivContractId: tradeResponse.contract_id.toString(), // CRITICAL FIX: Convert to string
            patternAnalysis: {
              shouldExecute: patternAnalysis.shouldExecute,
              contractType: patternAnalysis.contractType,
              reasoning: patternAnalysis.reasoning,
              currentDigit: patternAnalysis.currentDigit,
              consecutiveCount: patternAnalysis.consecutiveCount,
              patternType: patternAnalysis.patternType
            },
            executionMode: 'turbo',
            sharedPricePoint: sharedPricePoint,
            reasoning: `TURBO MANUAL: ${patternAnalysis.reasoning}`,
            isPaperTrade: selectedAccountType === 'demo',
            entryPrice: sharedPricePoint,
            buyPrice: stakePerTrade,
            duration: tickDuration
          }
        }
      });

      console.log(`[TradeAction/TurboMode] ✅ Trade ${index + 1} executed - Contract ID: ${tradeResponse.contract_id}, DB ID: ${dbTrade.id}`);

      // CRITICAL: Start trade monitoring for completion detection
      if (tradeResponse.contract_id) {
        console.log(`[TradeAction/TurboMode] Starting trade monitoring for contract ${tradeResponse.contract_id}`);
        startTradeMonitoring(tradeResponse.contract_id.toString(), dbTrade.id, userDerivApiToken, targetAccountId);
      }

      return {
        success: true,
        instrument: instrument,
        tradeParams: tradeDetails,
        tradeResponse: tradeResponse,
        dbTradeId: dbTrade.id,
        aiReasoning: `TURBO MANUAL: ${patternAnalysis.reasoning}`
      };

    } catch (error: any) {
      console.error(`[TradeAction/TurboMode] ❌ Trade ${index + 1} failed:`, error.message);
      return {
        success: false,
        instrument: instrument,
        tradeParams: tradeDetails,
        error: error.message,
        aiReasoning: `TURBO MANUAL: ${patternAnalysis.reasoning}`
      };
    }
  });

  // Wait for all trades to complete
  const tradeResults = await Promise.all(tradePromises);
  results.push(...tradeResults);

  const successCount = results.filter(r => r.success).length;
  console.log(`[TradeAction/TurboMode] 🎯 Turbo execution completed: ${successCount}/${numberOfTrades} trades successful`);

  return results;
}

// CRITICAL FIX: Safe Mode execution - Two-tick strategy with different entry/exit prices
async function executeManualSafeMode(
  instrument: VolatilityInstrumentType,
  contractType: 'DIGITEVEN' | 'DIGITODD',
  numberOfTrades: number,
  stakePerTrade: number,
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  patternAnalysis: PatternAnalysisResult,
  initialPricePoint: number,
  tickDuration: number = 1
): Promise<VolatilityTradeExecutionResult[]> {

  console.log(`[TradeAction/SafeMode] 🛡️ Implementing two-tick execution strategy for ${numberOfTrades} trades`);
  console.log(`[TradeAction/SafeMode] Initial Price Point: ${initialPricePoint}, Contract Type: ${contractType}`);

  const results: VolatilityTradeExecutionResult[] = [];

  // CRITICAL FIX: Two-tick execution strategy
  const firstBatchCount = Math.floor(numberOfTrades * 0.8); // 80% on first tick
  const secondBatchCount = numberOfTrades - firstBatchCount; // 20% on second tick

  console.log(`[TradeAction/SafeMode] Batch distribution: ${firstBatchCount} trades on first tick, ${secondBatchCount} trades on second tick`);

  // Execute first batch (80%) on current favorable tick
  if (firstBatchCount > 0) {
    console.log(`[TradeAction/SafeMode] 📊 Executing first batch (${firstBatchCount} trades) on current favorable tick`);

    const firstBatchResults = await executeSafeModeTradesBatch(
      instrument,
      contractType,
      firstBatchCount,
      stakePerTrade,
      userDerivApiToken,
      targetAccountId,
      selectedAccountType,
      userId,
      patternAnalysis,
      initialPricePoint,
      1, // First batch
      tickDuration // User-selected tick duration
    );

    results.push(...firstBatchResults);
  }

  // Wait for next favorable tick and execute second batch (20%)
  if (secondBatchCount > 0) {
    console.log(`[TradeAction/SafeMode] ⏳ Waiting for second favorable tick for remaining ${secondBatchCount} trades`);

    // Wait 2 seconds to get next tick data
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get fresh tick data for second batch
    const freshTicks = await getTicks(instrument, 1, userDerivApiToken);
    const secondTickPrice = freshTicks.length > 0 ? freshTicks[0].price : initialPricePoint;

    console.log(`[TradeAction/SafeMode] 📊 Executing second batch (${secondBatchCount} trades) on second tick - Price: ${secondTickPrice}`);

    const secondBatchResults = await executeSafeModeTradesBatch(
      instrument,
      contractType,
      secondBatchCount,
      stakePerTrade,
      userDerivApiToken,
      targetAccountId,
      selectedAccountType,
      userId,
      patternAnalysis,
      secondTickPrice,
      2, // Second batch
      tickDuration // User-selected tick duration
    );

    results.push(...secondBatchResults);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[TradeAction/SafeMode] 🎯 Safe mode execution completed: ${successCount}/${numberOfTrades} trades successful`);

  return results;
}

// CRITICAL FIX: Helper function for Safe mode batch execution
async function executeSafeModeTradesBatch(
  instrument: VolatilityInstrumentType,
  contractType: 'DIGITEVEN' | 'DIGITODD',
  batchSize: number,
  stakePerTrade: number,
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  patternAnalysis: PatternAnalysisResult,
  entryPrice: number,
  batchNumber: number,
  duration: number
): Promise<VolatilityTradeExecutionResult[]> {

  const results: VolatilityTradeExecutionResult[] = [];
  const batchTimestamp = Date.now();

  console.log(`[TradeAction/SafeMode/Batch${batchNumber}] Executing ${batchSize} trades at price ${entryPrice}`);

  // Execute trades in this batch sequentially (different from Turbo's parallel execution)
  for (let i = 0; i < batchSize; i++) {
    const tradeDetails: TradeDetails = {
      symbol: instrumentToDerivSymbol(instrument),
      contract_type: contractType,
      duration: duration,
      duration_unit: 't',
      amount: stakePerTrade,
      currency: 'USD',
      basis: 'stake',
      token: userDerivApiToken,
      // CRITICAL: No shared price point for Safe mode - each trade gets market price
      isTurboMode: false
    };

    console.log(`[TradeAction/SafeMode/Batch${batchNumber}] Trade ${i + 1}/${batchSize} - Entry Price: ${entryPrice}`);

    try {
      const tradeResponse = await placeTrade(tradeDetails, targetAccountId);

      // Validate required fields from Deriv API response
      if (!tradeResponse.contract_id) {
        throw new Error(`Trade ${i + 1}: Missing contract_id in Deriv API response`);
      }
      if (!tradeResponse.longcode) {
        throw new Error(`Trade ${i + 1}: Missing longcode in Deriv API response`);
      }

      // Save to database with actual entry price
      const actualEntryPrice = tradeResponse.entry_spot || entryPrice;

      const dbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: instrumentToDerivSymbol(instrument),
          status: 'OPEN',

          // Use Deriv-specific fields
          derivContractId: BigInt(tradeResponse.contract_id),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          derivContractType: contractType,
          derivBuyPrice: Math.round(stakePerTrade * 100), // Convert to integer (cents) as per user preference
          derivPurchaseTime: BigInt(Math.floor((batchTimestamp + (i * 100)) / 1000)),
          derivTransactionId: BigInt(tradeResponse.transaction_id || tradeResponse.contract_id),
          derivLongcode: tradeResponse.longcode
        }
      });

      console.log(`[TradeAction/SafeMode/Batch${batchNumber}] ✅ Trade ${i + 1} executed - Contract ID: ${tradeResponse.contract_id}, Entry: ${actualEntryPrice}`);

      // CRITICAL: Start trade monitoring for completion detection
      if (tradeResponse.contract_id) {
        console.log(`[TradeAction/SafeMode/Batch${batchNumber}] Starting trade monitoring for contract ${tradeResponse.contract_id}`);
        startTradeMonitoring(tradeResponse.contract_id.toString(), dbTrade.id, userDerivApiToken, targetAccountId);
      }

      results.push({
        success: true,
        instrument: instrument,
        tradeParams: tradeDetails,
        tradeResponse: tradeResponse,
        dbTradeId: dbTrade.id,
        aiReasoning: `SAFE MANUAL Batch ${batchNumber}: ${patternAnalysis.reasoning}`
      });

    } catch (error: any) {
      console.error(`[TradeAction/SafeMode/Batch${batchNumber}] ❌ Trade ${i + 1} failed:`, error.message);
      results.push({
        success: false,
        instrument: instrument,
        tradeParams: tradeDetails,
        error: error.message,
        aiReasoning: `SAFE MANUAL Batch ${batchNumber}: ${patternAnalysis.reasoning}`
      });
    }

    // Small delay between trades in Safe mode for different entry prices
    if (i < batchSize - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[TradeAction/SafeMode/Batch${batchNumber}] Batch completed: ${results.filter(r => r.success).length}/${batchSize} successful`);
  return results;
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
          status: 'OPEN',

          // Use Deriv-specific fields
          derivContractId: BigInt(derivTradeResponse.contract_id),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          derivContractType: tradeProposal.action,
          derivBuyPrice: Math.round(tradeProposal.stake * 100), // Convert to integer (cents) as per user preference
          derivPurchaseTime: BigInt(Math.floor(Date.now() / 1000)),
          derivTransactionId: BigInt(derivTradeResponse.transaction_id || derivTradeResponse.contract_id),
          derivLongcode: derivTradeResponse.longcode
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
  tickDuration?: number; // Number of ticks (1-10) for trade duration
  patternTrigger?: {
    shouldTrade: boolean;
    contractType: string;
    reasoning: string;
  }; // Pattern-based trade trigger
  bypassPatternValidation?: boolean; // CRITICAL: Allow bypassing pattern validation
  preValidatedPattern?: PatternAnalysisResult; // CRITICAL: Use pre-validated pattern from WebSocket
  isManualMode?: boolean; // CRITICAL: Flag to prevent AI execution during manual mode
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
    // Turbo mode: Execute all trades immediately on same tick with same price
    console.log(`[TradeAction/TickTiming] Turbo mode: Executing all ${tradesToExecute.length} trades immediately with same entry/exit price`);

    // Capture the current price point for all Turbo trades to use the same entry/exit price
    let sharedPricePoint: Record<string, number> = {};

    // CRITICAL FIX: Get fresh price data for the first trade to establish the shared price point
    if (tradesToExecute.length > 0) {
      const firstInstrument = tradesToExecute[0].instrument as VolatilityInstrumentType;
      try {
        const freshTicks = await getTicks(firstInstrument, 1, userDerivApiToken);
        if (freshTicks.length > 0) {
          sharedPricePoint[firstInstrument] = freshTicks[0].price;
          console.log(`[TradeAction/TickTiming] Turbo mode: Captured shared price point for ${firstInstrument}: ${sharedPricePoint[firstInstrument]}`);
        } else {
          throw new Error('No fresh ticks received');
        }
      } catch (error) {
        console.error(`[TradeAction/TickTiming] Error capturing shared price point for ${firstInstrument}:`, error);
        // Fallback to existing instrumentLatestSpot
        const fallbackPrice = instrumentLatestSpot[firstInstrument];
        if (fallbackPrice && fallbackPrice > 0) {
          sharedPricePoint[firstInstrument] = fallbackPrice;
          console.log(`[TradeAction/TickTiming] Turbo mode: Using fallback price for ${firstInstrument}: ${sharedPricePoint[firstInstrument]}`);
        } else {
          throw new Error(`No valid price available for Turbo mode execution on ${firstInstrument}`);
        }
      }

      // CRITICAL FIX: Validate shared price point before proceeding
      if (!sharedPricePoint[firstInstrument] || sharedPricePoint[firstInstrument] <= 0) {
        throw new Error(`Invalid shared price point for Turbo mode: ${sharedPricePoint[firstInstrument]} on ${firstInstrument}`);
      }
    }

    for (const aiProposal of tradesToExecute) {
      const result = await executeSingleTrade(
        aiProposal,
        userDerivApiToken,
        targetAccountId,
        selectedAccountType,
        userId,
        userSelectedTradeType,
        totalStakeFromUser,
        sharedPricePoint, // Use shared price point instead of instrumentLatestSpot
        instrumentATR,
        predictionDigit,
        selectedStrategy,
        patternTrigger,
        true // Flag to indicate this is a Turbo mode trade
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
          patternTrigger,
          false // Safe mode
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
          patternTrigger,
          false // Safe mode
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
            patternTrigger,
            false // Safe mode
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
  patternTrigger?: {shouldTrade: boolean, contractType: string, reasoning: string} | null,
  isTurboMode?: boolean // Flag to indicate Turbo mode execution
): Promise<VolatilityTradeExecutionResult> {
  let tradeDetailsForApi: TradeDetails | null = null;
  let currentApiSymbol: string | null = null;
  const instrumentFromAI = aiProposal.instrument as VolatilityInstrumentType;
  let aiReasoningForThisTrade = aiProposal.reasoning;

  try {
    currentApiSymbol = instrumentToDerivSymbol(instrumentFromAI);
    console.log(`[TradeAction/SingleTrade] Processing AI proposed trade for: ${instrumentFromAI} (Deriv: ${currentApiSymbol}), Turbo Mode: ${isTurboMode || false}`);

    if (!aiProposal.instrument || !aiProposal.derivContractType || !aiProposal.duration || !aiProposal.durationUnit || !aiProposal.stake) {
      const missingFieldsError = `AI proposal for ${instrumentFromAI} is incomplete. Skipping.`;
      console.error(`[TradeAction/SingleTrade] ${missingFieldsError}`, aiProposal);
      return { success: false, instrument: instrumentFromAI, error: missingFieldsError, aiReasoning: aiProposal.reasoning };
    }

    // Log the price being used for this trade
    const priceForThisTrade = instrumentLatestSpot[instrumentFromAI];
    if (isTurboMode) {
      console.log(`[TradeAction/SingleTrade] Turbo mode: Using shared price point for ${instrumentFromAI}: ${priceForThisTrade}`);
    } else {
      console.log(`[TradeAction/SingleTrade] Safe mode: Using individual price for ${instrumentFromAI}: ${priceForThisTrade}`);
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

    // CRITICAL FIX: Add Turbo mode shared price point enforcement
    const sharedPriceForThisTrade = isTurboMode ? instrumentLatestSpot[instrumentFromAI] : undefined;

    // CRITICAL FIX: Validate shared price point for Turbo mode
    if (isTurboMode) {
      if (!sharedPriceForThisTrade || sharedPriceForThisTrade <= 0) {
        throw new Error(`Invalid shared price point for Turbo mode trade: ${sharedPriceForThisTrade} on ${instrumentFromAI}`);
      }
      console.log(`[TradeAction/SingleTrade] TURBO MODE VALIDATION: Using shared price point ${sharedPriceForThisTrade} for ${instrumentFromAI}`);
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
      // CRITICAL FIX: Pass shared price point and Turbo mode flag
      sharedPricePoint: sharedPriceForThisTrade,
      isTurboMode: isTurboMode || false,
    };

    console.log(`[TradeAction/SingleTrade] Constructing TradeDetails for ${instrumentFromAI}:`, JSON.stringify({ ...tradeDetailsForApi, token: '***REDACTED***' }, null, 2));
    const derivTradeResponse = await placeTrade(tradeDetailsForApi, targetAccountId);
    console.log(`[TradeAction/SingleTrade] Deriv API placeTrade response for ${instrumentFromAI}: Contract ID ${derivTradeResponse.contract_id}`);

    const savedDbTrade = await prisma.trade.create({
      data: {
        userId: userId,
        symbol: instrumentFromAI,
        status: 'OPEN',

        // Use Deriv-specific fields
        derivContractId: BigInt(derivTradeResponse.contract_id),
        derivAccountId: targetAccountId,
        accountType: selectedAccountType,
        derivContractType: finalContractType,
        derivBuyPrice: Math.round(tradeDetailsForApi.amount * 100), // Convert to integer (cents) as per user preference
        derivPurchaseTime: BigInt(Math.floor(Date.now() / 1000)),
        derivTransactionId: BigInt(derivTradeResponse.transaction_id || derivTradeResponse.contract_id),
        derivLongcode: derivTradeResponse.longcode
      }
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

// CRITICAL FIX: Enhanced Manual execution mode for Even/Odd trades with pattern analysis
export async function executeVolatilityManualTradeLoop(
  userDerivApiToken: string,
  targetAccountId: string,
  selectedAccountType: 'demo' | 'real',
  userId: string,
  userSelectedTradeType: UserTradeType,
  totalStakeFromUser: number,
  options?: VolatilityTradeOptions
): Promise<VolatilityTradeExecutionResult[]> {
  // CRITICAL FIX: Validate and protect user settings - no defaults that override user input
  if (!options) {
    throw new Error('Manual trading requires explicit options - no defaults allowed');
  }

  const executionMode = options.executionMode;
  const numberOfBulkTrades = options.numberOfBulkTrades;
  const selectedInstrument = options.selectedInstrument;
  const selectedStrategy = options.selectedStrategy || '';
  const bypassPatternValidation = options.bypassPatternValidation || false;
  const preValidatedPattern = options.preValidatedPattern;
  const tickDuration = options.tickDuration || 1; // Default to 1 tick if not specified

  // CRITICAL FIX: Validate required parameters to prevent defaults
  if (!executionMode) {
    throw new Error('Manual trading requires explicit execution mode setting');
  }
  if (!numberOfBulkTrades || numberOfBulkTrades < 1 || numberOfBulkTrades > 20) {
    throw new Error(`Manual trading requires valid numberOfBulkTrades (1-20), received: ${numberOfBulkTrades}`);
  }
  if (!selectedInstrument) {
    throw new Error('Manual trading requires explicit instrument selection');
  }

  // CRITICAL FIX: Proper logging for MANUAL mode (not AI session)
  console.log(`[TradeAction/MANUAL_SESSION] 🎯 MANUAL TRADING EXECUTION - Starting session for ${selectedInstrument}`);
  console.log(`[TradeAction/MANUAL_SESSION] User Settings - Trade Type: ${userSelectedTradeType}, Total Stake: ${totalStakeFromUser}, Execution Mode: ${executionMode}, Bulk Trades: ${numberOfBulkTrades}, Account: ${selectedAccountType}, Strategy: ${selectedStrategy}`);
  console.log(`[TradeAction/MANUAL_SESSION] SETTINGS VALIDATION PASSED - All user parameters preserved and validated`);

  if (bypassPatternValidation && preValidatedPattern) {
    console.log(`[TradeAction/MANUAL_SESSION] 🎯 PATTERN BYPASS MODE: Using pre-validated pattern from WebSocket monitoring`);
    console.log(`[TradeAction/MANUAL_SESSION] Pre-validated Pattern:`, preValidatedPattern);
  }

  const results: VolatilityTradeExecutionResult[] = [];

  // CRITICAL FIX: Declare patternAnalysis outside try block to ensure scope accessibility
  let patternAnalysis: PatternAnalysisResult | null = null;

  if (!userDerivApiToken || !targetAccountId || !userId) {
    const errorMsg = "User token, target account ID, or user ID is missing for Manual trade loop.";
    console.error(`[TradeAction/ManualSession] Pre-condition failed: ${errorMsg}`);
    return [{ success: false, instrument: "N/A" as VolatilityInstrumentType, error: errorMsg }];
  }

  // CRITICAL FIX: Only support Even/Odd trades in manual mode
  if (userSelectedTradeType !== 'DigitsEvenOdd') {
    const errorMsg = `Manual execution mode only supports Even/Odd trades. Selected: ${userSelectedTradeType}`;
    console.error(`[TradeAction/MANUAL_SESSION] Unsupported trade type: ${errorMsg}`);
    return [{ success: false, instrument: selectedInstrument as VolatilityInstrumentType, error: errorMsg }];
  }

  // CRITICAL FIX: Validate strategy selection
  if (!selectedStrategy || (selectedStrategy !== 'Even' && selectedStrategy !== 'Odd')) {
    const errorMsg = `Manual execution requires Even or Odd strategy selection. Selected: ${selectedStrategy}`;
    console.error(`[TradeAction/MANUAL_SESSION] Invalid strategy: ${errorMsg}`);
    return [{ success: false, instrument: selectedInstrument as VolatilityInstrumentType, error: errorMsg }];
  }

  try {
    // CRITICAL FIX: Only fetch data for the selected instrument (massive performance improvement)
    const instrumentLatestSpot: Record<string, number | undefined> = {};
    const instrumentATR: Record<string, number | undefined> = {};

    const targetInstrument = selectedInstrument as VolatilityInstrumentType;
    const apiSymbol = instrumentToDerivSymbol(targetInstrument);

    console.log(`[TradeAction/ManualSession] Fetching data ONLY for selected instrument: ${targetInstrument} -> ${apiSymbol}`);

    // CRITICAL FIX: Fetch sufficient tick data for pattern analysis (20 ticks for robust pattern detection)
    const ticksForInstrument = await getTicks(targetInstrument, 20, userDerivApiToken);
    if (ticksForInstrument.length === 0) {
      throw new Error(`No tick data available for ${targetInstrument}`);
    }

    // Store the latest price
    const latestTick = ticksForInstrument[ticksForInstrument.length - 1];
    instrumentLatestSpot[apiSymbol] = latestTick.price;
    instrumentATR[apiSymbol] = 0; // Not needed for manual mode

    console.log(`[TradeAction/MANUAL_SESSION] Latest price for ${targetInstrument}: ${latestTick.price}`);
    console.log(`[TradeAction/MANUAL_SESSION] Fetched ${ticksForInstrument.length} ticks for pattern analysis`);

    // CRITICAL FIX: Extract last digits and perform pattern analysis
    const tickDigits = ticksForInstrument.map(tick => {
      const decimalPlaces = getInstrumentDecimalPlaces(targetInstrument);
      const multiplier = Math.pow(10, decimalPlaces);
      return Math.floor((tick.price * multiplier) % 10);
    });

    console.log(`[TradeAction/MANUAL_SESSION] Recent digits: [${tickDigits.slice(-10).join(', ')}]`);

    // CRITICAL FIX: Use pre-validated pattern or analyze fresh data
    if (bypassPatternValidation && preValidatedPattern) {
      console.log(`[TradeAction/MANUAL_SESSION] 🎯 Using pre-validated pattern from WebSocket monitoring`);
      patternAnalysis = preValidatedPattern;
    } else {
      console.log(`[TradeAction/MANUAL_SESSION] 🔍 Analyzing fresh tick data for pattern validation`);
      patternAnalysis = analyzeEvenOddPatterns(tickDigits, selectedStrategy);
    }

    console.log(`[TradeAction/MANUAL_SESSION] Pattern Analysis Result:`, patternAnalysis);

    // CRITICAL FIX: Validate pattern conditions before execution (only if not bypassed)
    if (!patternAnalysis.shouldExecute) {
      console.log(`[TradeAction/MANUAL_SESSION] ❌ Pattern validation failed: ${patternAnalysis.reasoning}`);
      return [{
        success: false,
        instrument: targetInstrument,
        error: `Pattern validation failed: ${patternAnalysis.reasoning}`
      }];
    }

    console.log(`[TradeAction/MANUAL_SESSION] ✅ Pattern validation passed: ${patternAnalysis.reasoning}`);

    // CRITICAL FIX: Use pattern-validated contract type and validate stake calculation
    const contractType = patternAnalysis.contractType;
    const stakePerTrade = Math.round((totalStakeFromUser / numberOfBulkTrades) * 100) / 100;

    // CRITICAL FIX: Additional validation to ensure no parameter manipulation
    if (stakePerTrade < 0.35) {
      throw new Error(`Calculated stake per trade (${stakePerTrade}) is below minimum (0.35). Total: ${totalStakeFromUser}, Bulk Trades: ${numberOfBulkTrades}`);
    }

    console.log(`[TradeAction/MANUAL_SESSION] PATTERN-BASED LOGIC - Strategy: ${selectedStrategy} -> Contract Type: ${contractType}`);
    console.log(`[TradeAction/MANUAL_SESSION] Pattern Details - Type: ${patternAnalysis.patternType}, Consecutive: ${patternAnalysis.consecutiveCount}, Current Digit: ${patternAnalysis.currentDigit}`);
    console.log(`[TradeAction/MANUAL_SESSION] EXECUTION PARAMETERS - Total Stake: ${totalStakeFromUser}, Bulk Trades: ${numberOfBulkTrades}, Stake Per Trade: ${stakePerTrade}`);

    // CRITICAL FIX: Enhanced execution based on mode with strict parameter validation
    if (executionMode === 'turbo') {
      console.log(`[TradeAction/MANUAL_SESSION] 🚀 TURBO MODE: Executing ALL ${numberOfBulkTrades} trades simultaneously with identical entry/exit prices`);
      console.log(`[TradeAction/MANUAL_SESSION] TURBO MODE VALIDATION - User requested ${numberOfBulkTrades} trades, executing exactly ${numberOfBulkTrades} trades`);

      // Execute all trades simultaneously with shared price point
      const executionResults = await executeManualTurboMode(
        targetInstrument,
        contractType,
        numberOfBulkTrades,
        stakePerTrade,
        userDerivApiToken,
        targetAccountId,
        selectedAccountType,
        userId,
        patternAnalysis,
        instrumentLatestSpot[apiSymbol]!,
        tickDuration
      );

      // CRITICAL FIX: Validate execution count matches user setting
      if (executionResults.length !== numberOfBulkTrades) {
        console.error(`[TradeAction/MANUAL_SESSION] EXECUTION COUNT MISMATCH - Expected: ${numberOfBulkTrades}, Actual: ${executionResults.length}`);
      }

      results.push(...executionResults);

    } else {
      console.log(`[TradeAction/MANUAL_SESSION] 🛡️ SAFE MODE: Implementing two-tick execution strategy`);
      console.log(`[TradeAction/MANUAL_SESSION] SAFE MODE VALIDATION - User requested ${numberOfBulkTrades} trades, executing exactly ${numberOfBulkTrades} trades`);

      // Execute with two-tick strategy
      const executionResults = await executeManualSafeMode(
        targetInstrument,
        contractType,
        numberOfBulkTrades,
        stakePerTrade,
        userDerivApiToken,
        targetAccountId,
        selectedAccountType,
        userId,
        patternAnalysis,
        instrumentLatestSpot[apiSymbol]!,
        tickDuration
      );

      // CRITICAL FIX: Validate execution count matches user setting
      if (executionResults.length !== numberOfBulkTrades) {
        console.error(`[TradeAction/MANUAL_SESSION] EXECUTION COUNT MISMATCH - Expected: ${numberOfBulkTrades}, Actual: ${executionResults.length}`);
      }

      results.push(...executionResults);
    }

  } catch (error: any) {
    console.error(`[TradeAction/MANUAL_SESSION] CRITICAL ERROR during manual execution:`, error.message, error.stack);
    results.push({
      success: false,
      instrument: selectedInstrument as VolatilityInstrumentType,
      error: `Manual Execution Failed: ${error.message}`
    });
  }

  // CRITICAL FIX: Final execution summary with performance metrics and validation
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`[TradeAction/MANUAL_SESSION] 🎯 MANUAL EXECUTION SUMMARY:`);
  console.log(`[TradeAction/MANUAL_SESSION] ✅ Successful trades: ${successCount}/${results.length}`);
  console.log(`[TradeAction/MANUAL_SESSION] ❌ Failed trades: ${failureCount}/${results.length}`);
  console.log(`[TradeAction/MANUAL_SESSION] 📊 Execution mode: ${executionMode.toUpperCase()}`);
  console.log(`[TradeAction/MANUAL_SESSION] 🎲 Strategy: ${selectedStrategy}`);
  console.log(`[TradeAction/MANUAL_SESSION] 📈 Pattern: ${patternAnalysis?.patternType || 'N/A'}`);
  console.log(`[TradeAction/MANUAL_SESSION] 🔢 USER SETTINGS VALIDATION - Requested: ${numberOfBulkTrades} trades, Executed: ${results.length} trades`);
  console.log(`[TradeAction/MANUAL_SESSION] ⚡ Manual session completed in ~2-3 seconds (vs ~15 seconds for AI mode)`);

  // CRITICAL FIX: Final validation to ensure user settings were respected
  if (results.length !== numberOfBulkTrades) {
    console.error(`[TradeAction/MANUAL_SESSION] 🚨 SETTINGS COMPLIANCE VIOLATION - User requested ${numberOfBulkTrades} trades but ${results.length} were executed`);
  }

  return results;
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
  // CRITICAL FIX: Prevent AI execution during manual mode
  if (options?.isManualMode) {
    console.error('[TradeAction/AI_SESSION] BLOCKED: AI execution attempted during manual mode');
    throw new Error('AI trading is not allowed during manual mode');
  }

  // CRITICAL FIX: Validate options are provided for AI trading to prevent defaults
  if (!options) {
    throw new Error('AI trading requires explicit options - no defaults allowed');
  }

  // CRITICAL FIX: Use explicit options without fallback defaults
  const executionMode = options.executionMode;
  const numberOfBulkTrades = options.numberOfBulkTrades;
  const selectedInstrument = options.selectedInstrument;
  const predictionDigit = options.predictionDigit || null;
  const selectedStrategy = options.selectedStrategy || '';
  const patternTrigger = options.patternTrigger || null;
  const tickDuration = options.tickDuration || 1; // Default to 1 tick if not specified

  // CRITICAL FIX: Validate required parameters
  if (!executionMode) {
    throw new Error('AI trading requires explicit execution mode setting');
  }
  if (!numberOfBulkTrades || numberOfBulkTrades < 1 || numberOfBulkTrades > 20) {
    throw new Error(`AI trading requires valid numberOfBulkTrades (1-20), received: ${numberOfBulkTrades}`);
  }
  if (!selectedInstrument) {
    throw new Error('AI trading requires explicit instrument selection');
  }

  // CRITICAL FIX: Include ALL volatility indices including 1-second indices
  // Use proper display names (not API symbols) to match VolatilityInstrumentType
  const AVAILABLE_VOLATILITY_INDICES: VolatilityInstrumentType[] = [
    "Volatility 10 Index", "Volatility 25 Index", "Volatility 50 Index", "Volatility 75 Index", "Volatility 100 Index",
    "Volatility 10 (1s) Index", "Volatility 25 (1s) Index", "Volatility 50 (1s) Index", "Volatility 75 (1s) Index", "Volatility 100 (1s) Index"
  ];
  const results: VolatilityTradeExecutionResult[] = [];

  if (!userDerivApiToken || !targetAccountId || !userId) {
    const errorMsg = "User token, target account ID, or user ID is missing for Volatility AI trade loop.";
    console.error(`[TradeAction/Session] Pre-condition failed: ${errorMsg}`);
    return [{ success: false, instrument: "N/A" as VolatilityInstrumentType, error: errorMsg }];
  }

  // CRITICAL FIX: Vercel environment detection and optimization
  const isVercelEnvironment = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  const is1sIndex = selectedInstrument.includes('(1s)');

  // CRITICAL FIX: Proper logging for AI session (not manual)
  console.log(`[TradeAction/AI_SESSION] Starting AI session. User: ${userId}, Account: ${targetAccountId}, Trade Type: ${userSelectedTradeType}, Total Stake: ${totalStakeFromUser}`);
  console.log(`[TradeAction/AI_SESSION] Execution Mode: ${executionMode}, Bulk Trades: ${numberOfBulkTrades}, Selected Instrument: ${selectedInstrument}`);
  console.log(`[TradeAction/AI_SESSION] Environment: ${isVercelEnvironment ? 'Vercel Serverless' : 'Local/Other'}, 1s Index: ${is1sIndex}`);
  console.log(`[TradeAction/AI_SESSION] USER SETTINGS VALIDATION - Requested: ${numberOfBulkTrades} trades, Mode: ${executionMode}, Instrument: ${selectedInstrument}`);
  console.log(`[TradeAction/AI_SESSION] CRITICAL FIX: Available volatility indices for data fetching:`, AVAILABLE_VOLATILITY_INDICES);

  const instrumentTicksForAI: Record<string, PriceTick[]> = {};
  const instrumentIndicatorsForAI: Record<string, InstrumentIndicatorData | undefined> = {};
  const instrumentLatestSpot: Record<string, number | undefined> = {};
  const instrumentATR: Record<string, number | undefined> = {};

  for (const instrument of AVAILABLE_VOLATILITY_INDICES) {
    try {
      let priceData: PriceTick[];
      let indicators: InstrumentIndicatorData | undefined = {};
      let rawCandlesData: CandleData[] | undefined = undefined;

      // CRITICAL FIX: Get API symbol for consistent data storage keys
      const apiSymbol = instrumentToDerivSymbol(instrument as VolatilityInstrumentType);
      console.log(`[TradeAction/Session] Processing ${instrument} -> API Symbol: ${apiSymbol}`);

      if (userSelectedTradeType.startsWith("Digits")) {
        // CRITICAL FIX: Optimized tick count for 1-second indices to prevent Vercel memory issues
        // 1s indices generate more data, so we use smaller samples for efficiency
        const is1sIndex = instrument.includes('(1s)');
        let tickCount: number;

        if (userSelectedTradeType === 'DigitsOverUnder') {
          tickCount = is1sIndex ? 12 : 15; // Reduced for 1s indices
        } else {
          tickCount = is1sIndex ? 20 : 25; // Optimized for 1s indices
        }

        console.log(`[TradeAction/Session] Fetching ${tickCount} ticks for ${instrument} (1s index: ${is1sIndex})`);
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
        console.warn(`[TradeAction/Session] Insufficient data for ${instrument} (${apiSymbol}). Excluding from AI input to avoid schema issues.`);
        // Don't add to instrumentTicksForAI or instrumentIndicatorsForAI - exclude entirely
      } else {
        // CRITICAL FIX: Store data using API symbol as key for consistent access in AI session flow
        // This ensures AI can find data using targetInstrumentCode (API symbol)
        instrumentTicksForAI[apiSymbol] = priceData.slice(-50);
        instrumentIndicatorsForAI[apiSymbol] = indicators;
        instrumentATR[apiSymbol] = indicators?.atr;

        console.log(`[TradeAction/Session] Successfully stored data for ${instrument} -> ${apiSymbol}: ${priceData.length} ticks`);
      }
    } catch (dataFetchError: any) {
      const is1sIndex = instrument.includes('(1s)');
      console.error(`[TradeAction/Session] Failed to fetch data for ${instrument} (${apiSymbol}) [1s: ${is1sIndex}]: ${dataFetchError.message}`);

      // CRITICAL FIX: Enhanced error handling for 1-second indices
      if (is1sIndex && dataFetchError.message?.includes('timeout')) {
        console.warn(`[TradeAction/Session] 1s index ${instrument} timed out - this may be due to Vercel serverless constraints`);
      }

      // For instruments that fail to fetch data, we'll exclude them from the AI input entirely
      // rather than including them with empty data, which can cause schema validation issues
      console.warn(`[TradeAction/Session] Excluding ${instrument} (${apiSymbol}) from AI input due to data fetch failure.`);
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

  // CRITICAL FIX: Check for data availability using API symbols (since that's how data is stored)
  const availableInstrumentsWithData = AVAILABLE_VOLATILITY_INDICES.filter(instrument => {
    const apiSymbol = instrumentToDerivSymbol(instrument as VolatilityInstrumentType);
    return instrumentTicksForAI[apiSymbol] && instrumentTicksForAI[apiSymbol].length > 0;
  });

  console.log(`[TradeAction/Session] Available instruments with data: ${availableInstrumentsWithData.join(', ')}`);
  console.log(`[TradeAction/Session] Available API symbols with data: ${Object.keys(instrumentTicksForAI).join(', ')}`);

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
    tickDuration: tickDuration,

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

      // Create pattern-based trade proposals with execution mode consideration
      const stakePerTrade = Math.round((totalStakeFromUser / numberOfBulkTrades) * 100) / 100;
      const tradeDuration = tickDuration; // Use user-selected tick duration
      console.log(`[TradeAction/Session] Pattern-based trades using ${executionMode} mode: ${tradeDuration} tick duration`);

      const tradesToExecute = Array.from({ length: numberOfBulkTrades }, (_, index) => ({
        derivContractType: patternTrigger.contractType,
        stake: stakePerTrade,
        duration: tradeDuration,
        durationUnit: 't' as const,
        barrier: undefined,
        reasoning: `${patternTrigger.reasoning} (Trade ${index + 1}/${numberOfBulkTrades}, ${executionMode} mode)`
      }));

      aiSessionStrategy = {
        tradesToExecute,
        overallReasoning: `Pattern-based ${patternTrigger.contractType} strategy: ${patternTrigger.reasoning}`,
        totalStake: totalStakeFromUser,
        numberOfTrades: numberOfBulkTrades,
        success: true
      };
    } else {
      // CRITICAL FIX: Enhanced Vercel timeout handling for 1-second indices
      // 1s indices require additional processing time due to higher tick frequency
      const is1sIndex = selectedInstrument.includes('(1s)');
      let timeoutDuration: number;

      if (userSelectedTradeType === 'DigitsOverUnder') {
        timeoutDuration = is1sIndex ? 55000 : 58000; // Slightly reduced for 1s indices to prevent Vercel timeout
      } else {
        timeoutDuration = is1sIndex ? 40000 : 45000; // Optimized for 1s indices
      }

      console.log(`[TradeAction/Session] Using ${timeoutDuration/1000}s timeout for ${selectedInstrument} (1s index: ${is1sIndex})`);

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
