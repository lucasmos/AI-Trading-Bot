import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { contractId, token, accountId } = await request.json();

    if (!contractId || !token) {
      return NextResponse.json(
        { error: 'Contract ID and token are required' },
        { status: 400 }
      );
    }

    // Call Deriv API to get contract status
    const derivResponse = await fetch('https://api.deriv.com/websocket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 0
      })
    });

    if (!derivResponse.ok) {
      throw new Error(`Deriv API error: ${derivResponse.status}`);
    }

    const contractData = await derivResponse.json();

    if (contractData.error) {
      return NextResponse.json(
        { error: contractData.error.message },
        { status: 400 }
      );
    }

    // Return contract status
    return NextResponse.json(contractData.proposal_open_contract);

  } catch (error) {
    console.error('[API] Contract status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract status' },
      { status: 500 }
    );
  }
}
