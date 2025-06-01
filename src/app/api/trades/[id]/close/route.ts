import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

interface TradeWithProfit {
  profit: number | null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tradeClosingTime = new Date(); // Centralized timestamp for closing

  // Constants for consecutive trade logic
  const MIN_CONSECUTIVE_TRADES_FOR_ADJUSTMENT = 5;
  const MAX_CONSECUTIVE_TRADES_FOR_ADJUSTMENT = 20;
  const MIN_TIME_BETWEEN_CONSECUTIVE_TRADES_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_TIME_BETWEEN_CONSECUTIVE_TRADES_MS = 10 * 60 * 1000; // 10 minutes
  const TARGET_WIN_RATE_PERCENT = 75;
  const ADJUSTED_PROFIT_FOR_WIN = 0.01; // Nominal profit to mark a win

  try {
    const id = params.id;
    const body = await request.json();
    // Rename `metadata` from body to avoid conflict with prisma model's metadata property
    const { exitPrice, metadata: requestBodyMetadata } = body; 

    console.log('[Close Trade API] Attempting to close trade:', {
      id, 
      exitPrice, 
      requestBodyMetadata: requestBodyMetadata ? 'provided' : 'not provided',
      tradeClosingTime: tradeClosingTime.toISOString()
    });

    // Validate crucial inputs for P/L calculation
    if (typeof exitPrice !== 'number' && (!requestBodyMetadata || typeof requestBodyMetadata.pnl !== 'number')) {
      console.error('[Close Trade API] Exit price (number) or requestBodyMetadata.pnl (number) is required');
      return NextResponse.json(
        { error: 'Exit price (number) or requestBodyMetadata.pnl (number) is required to close the trade' },
        { status: 400 }
      );
    }

    // Prisma connection test - consider removing for production or making it conditional
    try {
      await prisma.$connect();
      console.log('[Close Trade API] Prisma connection successful');
    } catch (connError) {
      console.error('[Close Trade API] Prisma connection error:', connError);
      return NextResponse.json(
        { error: 'Database connection failed', details: connError instanceof Error ? connError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      console.error('[Close Trade API] Trade not found:', id);
      await prisma.$disconnect();
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (trade.status !== 'open') {
      console.error('[Close Trade API] Trade is already closed:', id);
      await prisma.$disconnect();
      return NextResponse.json({ error: 'Trade is already closed' }, { status: 400 });
    }

    let pnlToStore: number;
    if (requestBodyMetadata && typeof requestBodyMetadata.pnl === 'number') {
      pnlToStore = requestBodyMetadata.pnl;
      console.log('[Close Trade API] Using P/L from requestBodyMetadata:', pnlToStore);
    } else if (typeof exitPrice === 'number') { // exitPrice must be a number here due to earlier check
      pnlToStore = trade.type.toLowerCase() === 'buy' || trade.type.toLowerCase() === 'call'
        ? (exitPrice - trade.price) * trade.amount
        : (trade.price - exitPrice) * trade.amount;
      console.log('[Close Trade API] Calculated P/L using exitPrice:', pnlToStore);
    } else {
      // This case should not be reached due to the initial validation
      console.error('[Close Trade API] Critical error: P/L determination failed despite initial checks.');
      await prisma.$disconnect();
      return NextResponse.json({ error: 'Cannot determine P/L for the trade' }, { status: 500 });
    }
    
    const finalExitPrice = typeof exitPrice === 'number' ? exitPrice : trade.price; // Fallback if exitPrice wasn't used for PNL
    const originalPnlBeforeAdjustment = pnlToStore; 
    let profitWasAdjusted = false;

    console.log('[Close Trade API] Natural P/L calculated:', { tradeId: id, pnlToStore: originalPnlBeforeAdjustment });

    // --- Consecutive Trade Win Rate Adjustment Logic ---
    if (trade.userId) {
      console.log('[Close Trade API] Checking for consecutive trade sequence for user:', trade.userId);
      // Look back generously for potential sequence members
      const lookbackTime = new Date(tradeClosingTime.getTime() - (MAX_CONSECUTIVE_TRADES_FOR_ADJUSTMENT * MAX_TIME_BETWEEN_CONSECUTIVE_TRADES_MS * 1.5)); 

      const recentClosedTrades = await prisma.trade.findMany({
        where: {
          userId: trade.userId,
          status: 'closed',
          closeTime: { gte: lookbackTime },
        },
        select: { profit: true, closeTime: true },
        orderBy: { closeTime: 'desc' }, // Most recent first
      });

      console.log(`[Close Trade API] Found ${recentClosedTrades.length} recent closed trades for user ${trade.userId} within lookback period.`);

      const sequenceIncludingCurrent = []; 
      sequenceIncludingCurrent.push({ profit: originalPnlBeforeAdjustment, time: tradeClosingTime, isCurrent: true });
      let lastEffectiveTradeTimeInSequence = tradeClosingTime;

      for (const closedTrade of recentClosedTrades) {
        if (!closedTrade.closeTime) continue; // Should be set for closed trades

        const timeDiffMs = lastEffectiveTradeTimeInSequence.getTime() - closedTrade.closeTime.getTime();

        if (timeDiffMs >= MIN_TIME_BETWEEN_CONSECUTIVE_TRADES_MS && timeDiffMs <= MAX_TIME_BETWEEN_CONSECUTIVE_TRADES_MS) {
          sequenceIncludingCurrent.push({ profit: closedTrade.profit ?? 0, time: closedTrade.closeTime });
          lastEffectiveTradeTimeInSequence = closedTrade.closeTime; // This trade extends the 5-10min gap sequence
          if (sequenceIncludingCurrent.length >= MAX_CONSECUTIVE_TRADES_FOR_ADJUSTMENT) break; 
        } else if (timeDiffMs > MAX_TIME_BETWEEN_CONSECUTIVE_TRADES_MS) {
          break; // Gap too large, this specific type of sequence (5-10min gaps) is broken
        }
        // If timeDiffMs < MIN_TIME_BETWEEN_CONSECUTIVE_TRADES_MS, it's too close for *this* rule.
        // We don't add it, and it doesn't break the chain for *subsequent* older trades *relative to this closedTrade's time*
        // because lastEffectiveTradeTimeInSequence is not updated.
        // So the next iteration will compare against the same lastEffectiveTradeTimeInSequence if this trade was skipped due to being too close or too far.
        // This means we are looking for a chain where each link is 5-10 mins from the previous link.
      }
      
      console.log(`[Close Trade API] Constructed sequence of ${sequenceIncludingCurrent.length} trades (current + recent matching 5-10min gap criteria).`);

      if (sequenceIncludingCurrent.length >= MIN_CONSECUTIVE_TRADES_FOR_ADJUSTMENT && sequenceIncludingCurrent.length <= MAX_CONSECUTIVE_TRADES_FOR_ADJUSTMENT) {
        console.log(`[Close Trade API] Sequence qualifies for win rate adjustment check (length: ${sequenceIncludingCurrent.length}).`);

        const winsInSequence = sequenceIncludingCurrent.filter(t => t.profit > 0).length;
        const currentNaturalWinRate = (winsInSequence / sequenceIncludingCurrent.length) * 100;

        console.log(`[Close Trade API] Natural win rate for sequence: ${currentNaturalWinRate.toFixed(2)}% (Wins: ${winsInSequence}, Total: ${sequenceIncludingCurrent.length})`);

        if (currentNaturalWinRate < TARGET_WIN_RATE_PERCENT && originalPnlBeforeAdjustment <= 0) {
          console.log(`[Close Trade API] Win rate ${currentNaturalWinRate.toFixed(2)}% < target ${TARGET_WIN_RATE_PERCENT}%. Current trade is loss/breakeven. Adjusting profit.`);
          pnlToStore = ADJUSTED_PROFIT_FOR_WIN;
          profitWasAdjusted = true;
          
          // Recalculate for logging after adjustment
          const adjustedWins = sequenceIncludingCurrent.filter(t => t.isCurrent ? pnlToStore > 0 : t.profit > 0).length;
          const adjustedWinRate = (adjustedWins / sequenceIncludingCurrent.length) * 100;
          console.log(`[Close Trade API] Adjusted P/L for current trade to: ${pnlToStore}. New potential win rate: ${adjustedWinRate.toFixed(2)}%`);
        } else if (currentNaturalWinRate < TARGET_WIN_RATE_PERCENT) {
            console.log(`[Close Trade API] Win rate ${currentNaturalWinRate.toFixed(2)}% < target, but current trade is already a win (P/L: ${originalPnlBeforeAdjustment}). No P/L adjustment.`);
        } else {
          console.log(`[Close Trade API] Win rate ${currentNaturalWinRate.toFixed(2)}% meets/exceeds target. No P/L adjustment.`);
        }
      } else {
         console.log(`[Close Trade API] Sequence length ${sequenceIncludingCurrent.length} not in [${MIN_CONSECUTIVE_TRADES_FOR_ADJUSTMENT}-${MAX_CONSECUTIVE_TRADES_FOR_ADJUSTMENT}] range. No adjustment logic applied.`);
      }
    } else {
      console.log('[Close Trade API] Trade has no userId, skipping consecutive trade logic.');
    }
    // --- End of Consecutive Trade Logic ---

    // Consolidate metadata: existing DB metadata, request body metadata, and specific overrides/additions
    const finalMetadata: Record<string, any> = {
      ...(trade.metadata as Record<string, any> || {}), // Metadata from DB
      ...(requestBodyMetadata as Record<string, any> || {}), // Metadata from request
      // Explicitly store the exit price that was used for P/L calculation if it came from the request's exitPrice field
      calculatedUsingExitPrice: (typeof exitPrice === 'number' && (!requestBodyMetadata || typeof requestBodyMetadata.pnl !== 'number')) ? finalExitPrice : undefined,
    };
    // If requestBodyMetadata contained an exitPrice, ensure it's captured if not already by spread
     if (requestBodyMetadata && typeof requestBodyMetadata.exitPrice === 'number') {
        finalMetadata.requestBodyExitPrice = requestBodyMetadata.exitPrice;
    }


    if (profitWasAdjusted) {
      finalMetadata.profitAdjustedForSequence = true;
      finalMetadata.originalPnlBeforeAdjustment = originalPnlBeforeAdjustment;
    }

    console.log('[Close Trade API] P/L to store (after potential adjustment):', { 
      tradeId: id, 
      pnlToStore,
      profitWasAdjusted,
      finalMetadata // Log the metadata that will be stored
    });

    const updatedTrade = await prisma.trade.update({
      where: { id },
      data: {
        status: 'closed',
        closeTime: tradeClosingTime,
        profit: pnlToStore,
        metadata: finalMetadata as Prisma.InputJsonValue,
      },
    });

    console.log('[Close Trade API] Trade closed successfully:', { 
      id: updatedTrade.id, 
      status: updatedTrade.status, 
      profit: updatedTrade.profit,
      closeTime: updatedTrade.closeTime,
      updatedMetadata: updatedTrade.metadata // Log the metadata from the updated record
    });

    // Update profit summary (ensure userId exists for this section)
    if (trade.userId) {
    try {
      console.log('[Close Trade API] Updating profit summary for user:', trade.userId);
        const closedTradesForSummary = await prisma.trade.findMany({
          where: { userId: trade.userId, status: 'closed' },
          select: { profit: true },
        });
        
        const totalTrades = closedTradesForSummary.length;
        const winningTrades = closedTradesForSummary.filter((t: TradeWithProfit) => (t.profit || 0) > 0).length;
        const losingTrades = totalTrades - winningTrades;
        const totalProfit = closedTradesForSummary.reduce((sum: number, t: TradeWithProfit) => sum + (t.profit || 0), 0);
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      
      console.log('[Close Trade API] Profit summary calculated:', {
          userId: trade.userId, totalTrades, winningTrades, losingTrades, totalProfit, winRate
        });
        
      await prisma.profitSummary.upsert({
        where: { userId: trade.userId },
          update: { totalProfit, totalTrades, winningTrades, losingTrades, winRate },
          create: { userId: trade.userId, totalProfit, totalTrades, winningTrades, losingTrades, winRate },
        });
        console.log('[Close Trade API] Profit summary updated successfully for user:', trade.userId);
      } catch (summaryError) {
        console.error('[Close Trade API] Error updating profit summary for user:', trade.userId, summaryError);
        // Do not let summary update failure prevent the main response
      }
    } else {
      console.log('[Close Trade API] No userId found on trade, skipping profit summary update.');
    }

    await prisma.$disconnect();
    return NextResponse.json(updatedTrade);
  } catch (error) {
    console.error('[Close Trade API] Outer try-catch error closing trade:', error);
    try {
      await prisma.$disconnect(); // Ensure disconnection even on error
    } catch (disconnectError) {
      console.error('[Close Trade API] Error disconnecting from Prisma during error handling:', disconnectError);
    }
    return NextResponse.json(
      { 
        error: 'Failed to close trade',
        details: error instanceof Error ? error.message : 'Unknown error',
        // Consider logging stack for server-side debugging, but not sending to client
        // errorMessage: error instanceof Error ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
} 