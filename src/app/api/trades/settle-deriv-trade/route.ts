// src/app/api/trades/settle-deriv-trade/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let requestBody: any;
  try {
    requestBody = await request.json();
    const {
      derivContractId,
      finalStatus,
      pnl,
      exitPrice,
      sellTime // ISO string expected from client
    } = requestBody;

    console.log('[Settle Deriv Trade API] Received request:', requestBody);

    if (derivContractId === undefined || !finalStatus || pnl === undefined) {
      console.error('[Settle Deriv Trade API] Missing required fields: derivContractId, finalStatus, or pnl.');
      return NextResponse.json(
        { error: 'Missing required fields: derivContractId, finalStatus, pnl' },
        { status: 400 }
      );
    }

    const contractIdNum = parseInt(derivContractId.toString(), 10);
    if (isNaN(contractIdNum)) {
      console.error('[Settle Deriv Trade API] Invalid derivContractId format.');
      return NextResponse.json({ error: 'Invalid derivContractId format' }, { status: 400 });
    }

    const pnlNum = parseFloat(pnl.toString());
    if (isNaN(pnlNum)) {
      console.error('[Settle Deriv Trade API] Invalid pnl format.');
      return NextResponse.json({ error: 'Invalid pnl format' }, { status: 400 });
    }

    let exitPriceNum: number | null = null;
    if (exitPrice !== undefined && exitPrice !== null) {
        const parsedExitPrice = parseFloat(exitPrice.toString());
        if (isNaN(parsedExitPrice)) {
            console.error('[Settle Deriv Trade API] Invalid exitPrice format.');
            return NextResponse.json({ error: 'Invalid exitPrice format' }, { status: 400 });
        }
        exitPriceNum = parsedExitPrice;
    }


    await prisma.$connect();
    console.log('[Settle Deriv Trade API] Prisma connection successful.');

    const existingTrade = await prisma.trade.findUnique({
      where: { derivContractId: contractIdNum },
    });

    if (!existingTrade) {
      console.error(`[Settle Deriv Trade API] Trade with derivContractId ${contractIdNum} not found.`);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: `Trade with Deriv Contract ID ${contractIdNum} not found` },
        { status: 404 }
      );
    }

    if (existingTrade.status !== 'open' && existingTrade.status !== 'pending_settlement') { // Allow settling if it was somehow marked pending
        console.warn(`[Settle Deriv Trade API] Trade ${existingTrade.id} (Deriv ID: ${contractIdNum}) is already settled with status: ${existingTrade.status}. Incoming status: ${finalStatus}.`);
        // Decide if to overwrite or return current state. For now, let's allow overwrite if new data is final.
        // Or, simply return current state if already final:
        // await prisma.$disconnect();
        // return NextResponse.json({ message: 'Trade already settled.', trade: existingTrade }, { status: 200 });
    }


    const updatedTrade = await prisma.trade.update({
      where: { id: existingTrade.id }, // Update by the internal DB ID
      data: {
        status: finalStatus,
        pnl: pnlNum,
        exitPrice: exitPriceNum,
        closeTime: sellTime ? new Date(sellTime) : new Date(),
        // Any other fields to update upon settlement
      },
    });

    console.log(`[Settle Deriv Trade API] Trade ${updatedTrade.id} (Deriv ID: ${contractIdNum}) settled successfully.`);
    await prisma.$disconnect();
    return NextResponse.json(updatedTrade);

  } catch (error: any) {
    console.error('[Settle Deriv Trade API] Error during trade settlement:', error);
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error('[Settle Deriv Trade API] Error disconnecting Prisma after settlement failure:', e);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Database error during trade settlement.', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to settle trade.', details: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
