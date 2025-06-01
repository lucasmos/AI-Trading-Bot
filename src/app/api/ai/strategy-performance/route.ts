import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { AI_TRADING_STRATEGIES } from '@/config/ai-strategies';

export interface StrategyPerformanceData {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const trades = await prisma.trade.findMany({
      where: {
        userId: userId,
        status: 'closed', // Only consider closed trades for performance
        aiStrategyId: { 
          not: null // Only trades that were executed by an AI strategy
        },
        profit: {
          not: null // Ensure profit is set to consider it a completed trade for PnL
        }
      },
      select: {
        aiStrategyId: true,
        profit: true,
        status: true, // Though filtered by status:closed, good to have if logic changes
      },
    });

    if (!trades || trades.length === 0) {
      return NextResponse.json([], { status: 200 }); // No AI trades found for this user
    }

    const performanceByStrategy: Record<string, Omit<StrategyPerformanceData, 'strategyName' | 'strategyId'> & { strategyId: string }> = {};

    for (const trade of trades) {
      if (trade.aiStrategyId) {
        if (!performanceByStrategy[trade.aiStrategyId]) {
          performanceByStrategy[trade.aiStrategyId] = {
            strategyId: trade.aiStrategyId,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnl: 0,
          };
        }
        const current = performanceByStrategy[trade.aiStrategyId];
        current.totalTrades++;
        current.totalPnl += trade.profit || 0;
        if (trade.profit && trade.profit > 0) {
          current.winningTrades++;
        } else if (trade.profit !== null) { // Consider non-null profit (including 0 or negative) as a concluded trade for loss counting
          current.losingTrades++;
        }
      }
    }

    const result: StrategyPerformanceData[] = Object.values(performanceByStrategy).map(perf => {
      const strategyConfig = AI_TRADING_STRATEGIES.find(s => s.id === perf.strategyId);
      return {
        ...perf,
        strategyName: strategyConfig ? strategyConfig.name : 'Unknown Strategy',
        winRate: perf.totalTrades > 0 ? parseFloat(((perf.winningTrades / perf.totalTrades) * 100).toFixed(2)) : 0,
        totalPnl: parseFloat(perf.totalPnl.toFixed(2)),
      };
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /ai/strategy-performance] Error fetching strategy performance:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error fetching strategy performance', error: errorMessage }, { status: 500 });
  }
} 