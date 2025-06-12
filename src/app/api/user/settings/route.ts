import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';
import { getDerivAccountBalance } from '@/services/deriv';

/**
 * GET handler to fetch user's Deriv settings.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!userSettings) {
      // This case should be rare if UserSettings are created on first login via JWT callback
      // However, good to handle it. Could also create default settings here if desired.
      console.warn(`[API/user/settings GET] UserSettings not found for userId: ${session.user.id}`);
      return NextResponse.json({
        message: 'User settings not found. Please complete Deriv account linking or re-login.',
        // Optionally, return a default structure or an empty object to simplify client-side handling
        // For now, returning 404 to indicate resource not found.
      }, { status: 404 });
    }

    return NextResponse.json(userSettings);
  } catch (error: any) {
    console.error('[API/user/settings GET] Error fetching user settings:', error);
    return NextResponse.json({ error: 'Internal server error while fetching settings.', details: error.message }, { status: 500 });
  }
}

/**
 * POST handler to update user's selected Deriv account type and refresh balance.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { selectedDerivAccountType } = body;

    if (!selectedDerivAccountType || (selectedDerivAccountType !== 'demo' && selectedDerivAccountType !== 'real')) {
      return NextResponse.json({ error: 'Invalid selectedDerivAccountType. Must be "demo" or "real".' }, { status: 400 });
    }

    // Fetch the user's Deriv API token from the Account model
    const userDerivAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'deriv-credentials', // Assuming 'deriv-credentials' is the provider key for Deriv
      },
    });

    if (!userDerivAccount?.access_token) {
      console.warn(`[API/user/settings POST] Deriv access token not found for userId: ${session.user.id}`);
      return NextResponse.json({ error: 'Deriv API token not found for the user.' }, { status: 400 });
    }
    const derivApiToken = userDerivAccount.access_token;

    // Fetch current UserSettings
    const currentUserSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!currentUserSettings) {
      console.error(`[API/user/settings POST] UserSettings not found for userId: ${session.user.id} during POST.`);
      return NextResponse.json({ error: 'User settings not found. Cannot update.' }, { status: 404 });
    }

    const accountIdToFetchBalance = selectedDerivAccountType === 'demo'
      ? currentUserSettings.derivDemoAccountId
      : currentUserSettings.derivRealAccountId;

    const balanceUpdateData: {
      derivDemoBalance?: number;
      derivRealBalance?: number;
      lastBalanceSync?: Date;
    } = {};

    if (accountIdToFetchBalance && derivApiToken) {
      console.log(`[API/user/settings POST] Attempting to fetch balance for userId: ${session.user.id}, accountId: ${accountIdToFetchBalance}, type: ${selectedDerivAccountType}`);
      try {
        const balanceInfo = await getDerivAccountBalance(derivApiToken, accountIdToFetchBalance);
        if (balanceInfo && typeof balanceInfo.balance === 'number') {
          if (selectedDerivAccountType === 'demo') {
            balanceUpdateData.derivDemoBalance = balanceInfo.balance;
          } else { // 'real'
            balanceUpdateData.derivRealBalance = balanceInfo.balance;
          }
          balanceUpdateData.lastBalanceSync = new Date();
          console.log(`[API/user/settings POST] Balance successfully fetched and updated for userId: ${session.user.id}, accountId: ${accountIdToFetchBalance}. Balance: ${balanceInfo.balance}`);
        } else {
           console.warn(`[API/user/settings POST] Received no/invalid balance info for userId: ${session.user.id}, accountId: ${accountIdToFetchBalance}. Response:`, balanceInfo);
        }
      } catch (balanceError: any) {
        console.error(`[API/user/settings POST] Error fetching Deriv account balance for userId: ${session.user.id}, accountId: ${accountIdToFetchBalance}:`, balanceError.message || balanceError);
        // Do not stop the update of selectedDerivAccountType due to balance fetch failure.
        // The client can be notified or can check lastBalanceSync.
      }
    } else {
      if (!accountIdToFetchBalance) {
        console.warn(`[API/user/settings POST] No Deriv accountId found for userId: ${session.user.id} and type: ${selectedDerivAccountType}. Balance not updated.`);
      }
      // derivApiToken is already checked and would have returned 400 if missing
    }

    // Update UserSettings with the new selectedDerivAccountType and any fetched balances
    const updatedSettings = await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: {
        selectedDerivAccountType: selectedDerivAccountType,
        ...balanceUpdateData, // Spread derivDemoBalance/derivRealBalance and lastBalanceSync if fetched
      },
    });

    console.log(`[API/user/settings POST] UserSettings updated for userId: ${session.user.id}. New selected type: ${selectedDerivAccountType}`);
    return NextResponse.json(updatedSettings);

  } catch (error: any) {
    console.error('[API/user/settings POST] Error updating user settings:', error);
    // Check for specific Prisma errors if needed, e.g., record not found during update
    if (error.code === 'P2025') { // Prisma error code for record not found on update/delete
        return NextResponse.json({ error: 'User settings not found, could not update.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error while updating settings.', details: error.message }, { status: 500 });
  }
}
