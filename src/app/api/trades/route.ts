import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { serializeTradeForJSON } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let requestBody: any;
  try {
    requestBody = await request.json();
    // email and name are no longer strictly needed here for user creation, 
    // as /api/auth/verify should handle user reconciliation.
    const {
      userId, symbol, metadata,
      // Deriv API fields (required)
      derivContractType, derivBuyPrice, derivPayout, derivContractId, derivAccountId, derivTransactionId, accountType,
      derivLongcode, derivShortcode, derivPurchaseTime, derivSellPrice, derivSellTime, derivUnderlyingSymbol, derivDurationType, derivAppId
    } = requestBody;

    console.log('[Create Trade API] Attempting to create trade with data:', {
      userId, symbol,
      derivContractType,
      derivBuyPrice,
      derivContractId,
      metadata: metadata ? 'provided' : 'not provided'
    });

    if (!userId || !symbol) {
      console.error('[Create Trade API] Missing required fields for trade creation.');
      return NextResponse.json(
        { error: 'Missing required fields: userId and symbol are required' },
        { status: 400 }
      );
    }

    try {
      await prisma.$connect();
      console.log('[Create Trade API] Prisma connection successful.');
    } catch (connError) {
      console.error('[Create Trade API] Prisma connection error:', connError);
      return NextResponse.json(
        { error: 'Database connection failed', details: connError instanceof Error ? connError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // User should already exist due to upstream auth flow (/api/auth/verify)
    // A check can be performed here, but user creation logic is removed.
    const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
    });

    if (!userExists) {
        console.error(`[Create Trade API] User with ID ${userId} not found. Trade cannot be created. This indicates an issue with the user authentication/creation flow.`);
        return NextResponse.json(
            { error: `User with ID ${userId} not found. Ensure user is authenticated and reconciled correctly before trading.` },
            { status: 400 } // Bad request, as user should exist
        );
    }

    console.log(`[Create Trade API] User ${userId} confirmed. Proceeding with trade creation.`);

    // Use provided metadata or empty object
    const tradeMetadata = metadata || {};

    const trade = await prisma.trade.create({
      data: {
        userId,
        symbol,
        status: 'OPEN', // Default status for a new trade

        // Deriv API fields
        derivContractType,
        derivBuyPrice: derivBuyPrice ? parseInt(derivBuyPrice.toString()) : null,
        derivPayout,
        derivPurchaseTime: derivPurchaseTime ? BigInt(derivPurchaseTime) : BigInt(Math.floor(Date.now() / 1000)),
        derivSellPrice,
        derivSellTime: derivSellTime ? BigInt(derivSellTime) : null,
        derivContractId: derivContractId ? BigInt(derivContractId) : null,
        derivTransactionId: derivTransactionId ? derivTransactionId.toString() : null,
        derivLongcode,
        derivShortcode,
        derivUnderlyingSymbol,
        derivDurationType,
        derivAppId,
        derivAccountId,
        accountType,

        metadata: tradeMetadata,
      },
    });

    console.log('[Create Trade API] Trade created successfully in database:', {
      id: trade.id,
      userId: trade.userId,
      symbol: trade.symbol,
      status: trade.status,
      derivContractType: trade.derivContractType,
      derivBuyPrice: trade.derivBuyPrice
    });

    await prisma.$disconnect();

    // Serialize trade to handle BigInt fields before JSON response
    const serializedTrade = serializeTradeForJSON(trade);
    return NextResponse.json(serializedTrade);
  } catch (error: any) {
    console.error('[Create Trade API] Error during trade creation process:', error);
    
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error('[Create Trade API] Error disconnecting Prisma after trade creation failure:', e);
    }
    
    // Check if it's a known Prisma error (like foreign key violation)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') { // Foreign key constraint failed
        return NextResponse.json(
          { 
            error: 'Failed to create trade due to a database integrity issue (likely user ID not found).',
            details: `Prisma error code: ${error.code}. This usually means the user ID provided for the trade does not exist in the User table. Ensure the user authentication and creation process via /api/auth/verify is working correctly. Provided userId: ${requestBody?.userId}`,
          },
          { status: 400 } // Bad request because of data integrity
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to create trade due to an unexpected error.',
        details: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    );
  }
} 