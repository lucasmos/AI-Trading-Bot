import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

interface TradeBasicInfo {
  id: string;
  userId: string;
  symbol: string;
  status: string;
  openTime: Date;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      console.error('[Trade History API] Missing userId in request');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('[Trade History API] Fetching trades for user:', userId);

    try {
      // Test if Prisma is working
      await prisma.$connect();
      console.log('[Trade History API] Prisma connection successful');
    } catch (connError) {
      console.error('[Trade History API] Prisma connection error:', connError);
      return NextResponse.json(
        { error: 'Database connection failed', details: connError instanceof Error ? connError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Debug: Log all trades in the database
    const allTrades = await prisma.trade.findMany({
      take: 10, // Limit to 10 for safety
    });
    console.log('[Trade History API] Sample of all trades in database:', 
      allTrades.map((t: TradeBasicInfo) => ({ 
        id: t.id, 
        userId: t.userId,
        symbol: t.symbol,
        status: t.status,
        openTime: t.openTime
      }))
    );

    const trades = await prisma.trade.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        openTime: 'desc',
      },
    });

    console.log(`[Trade History API] Found ${trades.length} trades for user ${userId}`);
    if (trades.length > 0) {
      console.log('[Trade History API] First trade sample:', {
        id: trades[0].id,
        userId: trades[0].userId,
        symbol: trades[0].symbol,
        status: trades[0].status,
        openTime: trades[0].openTime,
        closeTime: trades[0].closeTime,
        profit: trades[0].profit
      });
    } else {
      console.log('[Trade History API] No trades found. Checking if user exists...');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true }
      });
      console.log('[Trade History API] User lookup result:', user);
    }

    await prisma.$disconnect();
    return NextResponse.json(trades);
  } catch (error) {
    console.error('[Trade History API] Error in trade history API:', error);
    
    // Attempt to disconnect in case of error
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error('[Trade History API] Error disconnecting from Prisma:', e);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch trade history', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
      },
      { status: 500 }
    );
  }
} 