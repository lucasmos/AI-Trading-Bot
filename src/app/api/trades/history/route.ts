// src/app/api/trades/history/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      console.log('[API/Trades/History] No session found or user ID missing.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`[API/Trades/History] Fetching trade history for user: ${userId}`);

    // No explicit $connect needed with modern Prisma versions unless specific reason
    // await prisma.$connect();
    const trades = await prisma.trade.findMany({
      where: { userId: userId },
      orderBy: [
        { closeTime: 'desc' },
        { openTime: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 100,
    });
    // No explicit $disconnect needed with modern Prisma versions unless specific reason
    // await prisma.$disconnect();

    console.log(`[API/Trades/History] Found ${trades.length} trades for user: ${userId}`);
    return NextResponse.json(trades, { status: 200 });

  } catch (error: any) {
    console.error('[API/Trades/History] Error fetching trade history:', error);
    // Ensure prisma.$disconnect is not called if $connect wasn't, or handle errors carefully
    // if (prisma && typeof (prisma as any).$disconnect === 'function') { // More robust check
    //   try {
    //     await (prisma as any).$disconnect();
    //   } catch (disconnectError) {
    //     console.error('[API/Trades/History] Error disconnecting Prisma after fetch failure:', disconnectError);
    //   }
    // }
    return NextResponse.json(
      { error: 'Failed to fetch trade history', details: error.message },
      { status: 500 }
    );
  }
}
