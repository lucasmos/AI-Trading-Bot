import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { contractId, exitPrice, profit, status, closeTime, tickDuration } = await request.json();

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Map the status correctly for database storage
    let dbStatus: string;
    switch (status) {
      case 'won':
        dbStatus = 'WON';
        break;
      case 'lost':
        dbStatus = 'LOST';
        break;
      default:
        dbStatus = 'CLOSED';
    }

    // Update the trade in the database using Deriv API fields
    const updatedTrade = await prisma.trade.update({
      where: {
        derivContractId: BigInt(contractId)
      },
      data: {
        derivSellPrice: exitPrice,
        derivSellTime: BigInt(Math.floor(new Date(closeTime).getTime() / 1000)),
        status: dbStatus, // CRITICAL FIX: Use proper status mapping
        metadata: {
          update: true,
          outcome: status,
          finalProfit: profit,
          exitPrice: exitPrice,
          finalStatus: status, // Add final status to metadata
          profit: profit, // Store profit in metadata for backward compatibility
          tickDuration: tickDuration || 1 // Store the number of ticks used for the trade
        }
      }
    });

    console.log(`[API] Updated trade completion for contract ${contractId}: ${status} with profit ${profit}`);

    return NextResponse.json({
      success: true,
      tradeId: updatedTrade.id,
      profit: profit,
      status: status
    });

  } catch (error) {
    console.error('[API] Trade completion update error:', error);
    
    // If trade not found, it might be a different type of trade
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Trade not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update trade completion' },
      { status: 500 }
    );
  }
}
