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
 * Executes all trades specified in an AI-generated trading strategy on a Deriv account and records each trade in the database.
 *
 * For each trade proposal in the strategy, attempts to place the trade using the provided Deriv API token and account information, then saves the trade details to the database. Returns an array of results indicating the outcome of each trade execution.
 *
 * @param strategy - The AI-generated trading strategy containing trade proposals to execute.
 * @param userDerivApiToken - The API token used to authenticate with Deriv.
 * @param targetAccountId - The Deriv account ID where trades will be placed.
 * @param selectedAccountType - Specifies whether the trades are executed on a 'demo' or 'real' account.
 * @param userId - The unique user ID from the application's user model.
 * @returns An array of results for each trade, indicating success or failure, and including trade response and database trade ID if successful.
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
