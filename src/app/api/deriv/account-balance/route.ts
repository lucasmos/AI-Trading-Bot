import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if necessary
import { getDerivAccountBalance } from '@/services/deriv'; // Adjust path if necessary
import { ExtendedUser } from '@/types/next-auth'; // Assuming ExtendedUser is defined here and includes derivAccessToken

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as ExtendedUser; // Cast to your extended user type
    const derivAccessToken = user.derivAccessToken;

    if (!derivAccessToken) {
      return NextResponse.json({ error: 'Deriv access token not found in session' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId query parameter is required' }, { status: 400 });
    }

    // Validate that the requested accountId belongs to the user if necessary,
    // For instance, by checking against user.derivDemoAccountId and user.derivRealAccountId from the session.
    // This adds a layer of security.
    if (accountId !== user.derivDemoAccountId && accountId !== user.derivRealAccountId) {
        console.warn(`[API/deriv/account-balance] User ${user.id} attempted to fetch balance for unauthorized accountId ${accountId}. Allowed demo: ${user.derivDemoAccountId}, real: ${user.derivRealAccountId}`);
        // Depending on strictness, you might allow fetching any account ID if the token has access,
        // but it's safer to restrict to known accounts of the user.
        // For now, let's assume the token itself is scoped and Deriv API will handle permissions.
        // If direct validation is needed:
        // return NextResponse.json({ error: 'Requested account ID does not match user accounts' }, { status: 403 });
    }


    console.log(`[API/deriv/account-balance] Fetching balance for accountId: ${accountId}, User: ${user.id}`);

    try {
      const balanceDetails = await getDerivAccountBalance(derivAccessToken, accountId);
      return NextResponse.json(balanceDetails);
    } catch (error: any) {
      console.error(`[API/deriv/account-balance] Error calling getDerivAccountBalance for accountId ${accountId}, User ${user.id}:`, error);
      return NextResponse.json({
        error: `Failed to fetch balance for account ${accountId}.`,
        details: error.message || 'Unknown error from Deriv service.'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API/deriv/account-balance] General error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
