import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if necessary
import { prisma } from '@/lib/db'; // Adjust path if necessary
import type { Trade } from '@prisma/client'; // Import Prisma's Trade type if needed for request body typing

// Define an interface for the expected request body
interface RecordTradeRequestBody {
  symbol: string;
  contractType: 'CALL' | 'PUT'; // Or 'RISE' | 'FALL' if that's what Deriv API uses and you want to store that
  stakeAmount: number;
  entryPrice: number; // The price at which the contract was bought
  derivContractId: string; // From Deriv's placeTrade response
  derivAccountId: string; // e.g., VRTC... or CR...
  accountType: 'demo' | 'real';
  aiStrategyId?: string; // Optional
  openTime?: string | Date; // ISO string or Date object, Prisma will handle
  // status is typically 'OPEN' when recorded initially
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized. User session not found.' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json() as RecordTradeRequestBody;

    // Validate required fields
    const requiredFields: Array<keyof RecordTradeRequestBody> = [
      'symbol',
      'contractType',
      'stakeAmount',
      'entryPrice',
      'derivContractId',
      'derivAccountId',
      'accountType'
    ];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || (typeof body[field] === 'string' && !body[field])) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    if (body.stakeAmount <= 0) {
        return NextResponse.json({ error: 'Stake amount must be positive.' }, { status: 400 });
    }
    if (body.contractType !== 'CALL' && body.contractType !== 'PUT') {
        return NextResponse.json({ error: 'Invalid contractType. Must be CALL or PUT.' }, { status: 400 });
    }


    const tradeData = {
      userId: userId,
      symbol: body.symbol,
      type: body.contractType, // Maps to 'type' field in Prisma schema
      amount: body.stakeAmount, // Maps to 'amount' (stake)
      price: body.entryPrice,   // Maps to 'price' (entry price)
      status: 'OPEN',           // Initial status
      openTime: body.openTime ? new Date(body.openTime) : new Date(), // Prisma expects DateTime

      // Deriv specific fields from schema
      derivContractId: body.derivContractId,
      derivAccountId: body.derivAccountId,
      accountType: body.accountType, // 'demo' or 'real'

      // Optional fields
      aiStrategyId: body.aiStrategyId,

      // Fields to consider from Prisma schema not directly in request body:
      // totalValue: body.stakeAmount, // For options, totalValue might be same as stake. For CFDs it's different.
      // metadata: {}, // Could store AI reasoning if available
    };

    // Explicitly set totalValue if your model requires it.
    // If totalValue is optional or defaults, this isn't strictly needed.
    // For now, let's assume it's similar to stake for these types of trades.
    (tradeData as any).totalValue = body.stakeAmount;


    console.log(`[API/trades/record] Attempting to record trade for user ${userId}:`, tradeData);

    const newTrade = await prisma.trade.create({
      data: tradeData,
    });

    console.log(`[API/trades/record] Trade recorded successfully for user ${userId}, Trade ID: ${newTrade.id}`);
    return NextResponse.json(newTrade, { status: 201 });

  } catch (error: any) {
    console.error('[API/trades/record] Error recording trade:', error);
    if (error.name === 'SyntaxError') { // Handle JSON parsing errors specifically
        return NextResponse.json({ error: 'Invalid JSON in request body.', details: error.message }, { status: 400 });
    }
    // Handle Prisma validation errors or other known errors if necessary
    // e.g., if (error.code === 'P2002') return NextResponse.json({ error: 'Duplicate trade record?' }, { status: 409 });
    return NextResponse.json({ error: 'Internal server error while recording trade.', details: error.message }, { status: 500 });
  }
}
