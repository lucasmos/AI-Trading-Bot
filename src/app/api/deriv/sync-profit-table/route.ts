import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getProfitTableService } from '@/services/deriv-profit-table';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user and their settings
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        settings: true
      }
    });

    if (!user || !user.settings) {
      return NextResponse.json(
        { error: 'User settings not found' },
        { status: 404 }
      );
    }

    const { accountType } = await req.json();
    if (!['demo', 'real'].includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      );
    }

    // Get appropriate API token and account ID
    const apiToken = accountType === 'demo' 
      ? user.settings.derivDemoApiToken 
      : user.settings.derivRealApiToken;
    const accountId = accountType === 'demo'
      ? user.settings.derivDemoAccountId
      : user.settings.derivRealAccountId;

    if (!apiToken || !accountId) {
      return NextResponse.json(
        { error: `Deriv ${accountType} account not configured` },
        { status: 400 }
      );
    }

    // Initialize profit table service
    const profitTableService = getProfitTableService(
      apiToken,
      accountId,
      user.id,
      accountType
    );

    // Start sync process (this runs asynchronously)
    await profitTableService.syncProfitTable();

    return NextResponse.json({
      message: 'Profit table sync initiated',
      status: 'success'
    });

  } catch (error) {
    console.error('[API] Error syncing profit table:', error);
    return NextResponse.json(
      { error: 'Failed to sync profit table' },
      { status: 500 }
    );
  }
}
