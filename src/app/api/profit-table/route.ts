import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user and validate
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { settings: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType') || 'demo';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate account type
    if (!['demo', 'real'].includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      );
    }

    // Get appropriate account ID
    const derivAccountId = accountType === 'demo'
      ? user.settings?.derivDemoAccountId
      : user.settings?.derivRealAccountId;

    if (!derivAccountId) {
      return NextResponse.json(
        { error: `${accountType} account not configured` },
        { status: 400 }
      );
    }

    console.log(`[Profit Table API] Fetching entries for user ${user.id}, account ${derivAccountId}, type ${accountType}`);

    // Fetch profit table entries
    const entries = await prisma.profitTableEntry.findMany({
      where: {
        userId: user.id,
        derivAccountId: derivAccountId,
        accountType: accountType
      },
      orderBy: {
        purchaseTime: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count for pagination
    const totalCount = await prisma.profitTableEntry.count({
      where: {
        userId: user.id,
        derivAccountId: derivAccountId,
        accountType: accountType
      }
    });

    console.log(`[Profit Table API] Found ${entries.length} entries out of ${totalCount} total for user ${user.id}`);

    // Convert BigInt values to strings for JSON serialization
    const serializedEntries = entries.map(entry => {
      const buyPriceDisplay = entry.buyPrice / 100;
      const sellPriceDisplay = entry.sellPrice ? entry.sellPrice / 100 : null;

      // Calculate profit/loss: Sell Price - Buy Price (not Payout - Buy Price)
      let profitDisplay = null;
      if (entry.profit) {
        // Use stored profit if available
        profitDisplay = entry.profit / 100;
      } else if (sellPriceDisplay !== null) {
        // Calculate profit on-the-fly if sell price exists
        profitDisplay = sellPriceDisplay - buyPriceDisplay;
      }

      return {
        ...entry,
        contractId: entry.contractId.toString(),
        purchaseTime: entry.purchaseTime.toString(),
        sellTime: entry.sellTime?.toString() || null,
        transactionId: entry.transactionId.toString(),
        // Convert cents back to dollars for display
        buyPriceDisplay,
        sellPriceDisplay,
        payoutDisplay: entry.payout / 100,
        profitDisplay,
        // Include additional fields for consistency
        appId: entry.appId,
        symbol: entry.symbol
      };
    });

    return NextResponse.json({
      entries: serializedEntries,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + entries.length < totalCount
      }
    });

  } catch (error) {
    console.error('[Profit Table API] Error fetching profit table:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch profit table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
