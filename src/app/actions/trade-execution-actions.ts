'use server';

import {
  AutomatedTradingStrategyOutput,
  AutomatedTradeProposal,
  ForexCryptoCommodityInstrumentType
} from '@/types';
import {
  placeTrade,
  TradeDetails,
  PlaceTradeResponse,
  instrumentToDerivSymbol // Ensure this is exported from deriv.ts
} from '@/services/deriv';

export interface TradeExecutionResult {
  success: boolean;
  instrument: ForexCryptoCommodityInstrumentType;
  tradeResponse?: PlaceTradeResponse;
  error?: string;
}

export async function executeAiTradingStrategy(
  strategy: AutomatedTradingStrategyOutput,
  userDerivApiToken: string
): Promise<TradeExecutionResult[]> {
  const results: TradeExecutionResult[] = [];

  if (!userDerivApiToken) {
    console.error('[executeAiTradingStrategy] Deriv API token is missing.');
    // Return a result indicating token absence for all proposed trades
    return strategy.tradesToExecute.map(tradeProposal => ({
      success: false,
      instrument: tradeProposal.instrument,
      error: 'Deriv API token is missing. Cannot execute trades.',
    }));
  }

  for (const tradeProposal of strategy.tradesToExecute) {
    try {
      const derivSymbol = instrumentToDerivSymbol(tradeProposal.instrument as ForexCryptoCommodityInstrumentType);

      const tradeDetails: TradeDetails = {
        symbol: derivSymbol,
        contract_type: tradeProposal.action, // 'CALL' or 'PUT'
        duration: tradeProposal.durationSeconds,
        duration_unit: 's',
        amount: tradeProposal.stake,
        currency: 'USD', // Defaulting to USD
        basis: 'stake', // Defaulting to stake
        token: userDerivApiToken,
        // stop_loss and take_profit are not part of the AI proposal by default
      };

      console.log(`[executeAiTradingStrategy] Attempting to place trade for ${tradeProposal.instrument} (${derivSymbol}) with details:`, {
        ...tradeDetails,
        token: '***REDACTED***' // Avoid logging the token
      });

      const response = await placeTrade(tradeDetails);
      results.push({
        success: true,
        instrument: tradeProposal.instrument,
        tradeResponse: response,
      });
      console.log(`[executeAiTradingStrategy] Trade placed successfully for ${tradeProposal.instrument}:`, response);
    } catch (error: any) {
      console.error(`[executeAiTradingStrategy] Failed to place trade for ${tradeProposal.instrument}:`, error);
      results.push({
        success: false,
        instrument: tradeProposal.instrument,
        error: error.message || 'Unknown error during trade placement.',
      });
    }
  }

  return results;
}
