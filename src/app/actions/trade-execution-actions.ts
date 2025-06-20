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

// Helper function to parse duration string
function parseDurationString(durationString: string): { duration: number; duration_unit: 's' | 'm' | 'h' | 'd' | 't' } | null {
  if (!durationString) return null;
  const match = durationString.match(/^(\d+)([smhdt])$/i); // Made unit case-insensitive
  if (!match) {
    console.warn(`[parseDurationString] Invalid format: ${durationString}`);
    return null;
  }
  const value = parseInt(match[1], 10);
  // Ensure unit is lowercase and one of the allowed types
  const unit = match[2].toLowerCase() as 's' | 'm' | 'h' | 'd' | 't';
  if (!['s', 'm', 'h', 'd', 't'].includes(unit)) {
      console.warn(`[parseDurationString] Invalid unit: ${match[2]} in ${durationString}`);
      return null;
  }
  if (isNaN(value) || value <= 0) {
     console.warn(`[parseDurationString] Invalid value: ${match[1]} in ${durationString}`);
     return null;
  }
  return { duration: value, duration_unit: unit };
}

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

      // Initialize tradeDetails with common fields
      const tradeDetails: TradeDetails = {
        symbol: derivSymbol,
        contract_type: tradeProposal.action, // Updated: from tradeProposal.action (now string)
        amount: tradeProposal.stake,
        currency: 'USD', // Assuming USD, or make it configurable
        basis: 'stake',  // Assuming 'stake' basis
        token: userDerivApiToken,
      };

      // Add optional fields if present in tradeProposal
      if (typeof tradeProposal.multiplier === 'number') {
        tradeDetails.multiplier = tradeProposal.multiplier;
      }
      if (typeof tradeProposal.take_profit === 'number') {
        tradeDetails.take_profit = tradeProposal.take_profit;
      }
      if (typeof tradeProposal.stop_loss === 'number') {
        tradeDetails.stop_loss = tradeProposal.stop_loss;
      }

      // Handle duration based on contract type
      let dbDuration: number = 0; // Default for DB
      let dbDurationUnit: 's' | 'm' | 'h' | 'd' | 't' = 's'; // Default for DB, assuming 't' for ticks is also possible for placeTrade

      const contractAction = tradeProposal.action.toUpperCase(); // Normalize for comparison

      if (contractAction === 'CALL' || contractAction === 'PUT') { // Or other timed contracts
        if (tradeProposal.durationString) {
          const parsedDuration = parseDurationString(tradeProposal.durationString);
          if (parsedDuration) {
            tradeDetails.duration = parsedDuration.duration;
            tradeDetails.duration_unit = parsedDuration.duration_unit;
            dbDuration = parsedDuration.duration; // Save for DB
            dbDurationUnit = parsedDuration.duration_unit; // Save for DB
          } else {
            const errorMsg = `Invalid durationString: "${tradeProposal.durationString}" for ${tradeProposal.instrument}`;
            console.error(`[executeAiTradingStrategy] ${errorMsg}`);
            results.push({ success: false, instrument: tradeProposal.instrument, error: errorMsg });
            continue; // Skip this trade
          }
        } else {
          const errorMsg = `Missing durationString for timed contract ${tradeProposal.action} on ${tradeProposal.instrument}`;
          console.error(`[executeAiTradingStrategy] ${errorMsg}`);
          results.push({ success: false, instrument: tradeProposal.instrument, error: errorMsg });
          continue; // Skip this trade
        }
      }
      // For MULTUP/MULTDOWN, duration and duration_unit are intentionally NOT set on tradeDetails for placeTrade call.
      // dbDuration and dbDurationUnit will retain their default values (0, 's') for these cases for DB storage.

      console.log(`[executeAiTradingStrategy] Attempting to place trade for ${tradeProposal.instrument} on account ${targetAccountId}:`, {
        ...tradeDetails,
        token: '***REDACTED***'
      });

      // Call placeTrade with targetAccountId
      const derivTradeResponse = await placeTrade(tradeDetails, targetAccountId);

      console.log(`[executeAiTradingStrategy] Trade placed successfully via Deriv API for ${tradeProposal.instrument}:`, derivTradeResponse);

      // Save the executed trade to the database
      // Note: The Prisma schema for 'Trade' and its 'type', 'duration', 'durationUnit' fields
      // might need alignment if they are strictly typed (e.g., 'CALL'|'PUT' for type, or non-nullable duration).
      // Assuming 'type' in schema is string, and duration/durationUnit can accept defaults.
      const savedDbTrade = await prisma.trade.create({
        data: {
          userId: userId,
          symbol: tradeProposal.instrument,
          type: tradeProposal.action, // Now a string, reflecting MULTUP, PUT, CALL etc.
          amount: tradeProposal.stake,
          price: derivTradeResponse.entry_spot,
          totalValue: tradeProposal.stake, // This might need adjustment for Multipliers if P&L is different
          status: 'OPEN',
          openTime: new Date(),
          derivContractId: derivTradeResponse.contract_id.toString(),
          derivAccountId: targetAccountId,
          accountType: selectedAccountType,
          aiStrategyId: strategy.aiStrategyId || null,

          // Store duration and unit used for the trade, or defaults for non-timed
          duration: dbDuration,
          durationUnit: dbDurationUnit,
          // Store multiplier, take_profit, stop_loss if they were part of the proposal
          multiplier: typeof tradeProposal.multiplier === 'number' ? tradeProposal.multiplier : null,
          takeProfit: typeof tradeProposal.take_profit === 'number' ? tradeProposal.take_profit : null,
          stopLoss: typeof tradeProposal.stop_loss === 'number' ? tradeProposal.stop_loss : null,

          metadata: {
            reasoning: tradeProposal.reasoning,
            derivLongcode: derivTradeResponse.longcode,
            durationString: tradeProposal.durationString || null, // Store original duration string
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
