import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';
import { getDerivAccountBalance } from '@/services/deriv';

/**
 * Handles GET requests to retrieve the authenticated user's Deriv account settings.
 *
 * Returns the user's Deriv settings as JSON if found. Responds with 401 if the user is not authenticated, 404 if settings are missing, or 500 for server errors.
 */
export async function GET(request: Request) {
  console.log('[API UserSettings GET] Request received.');
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.warn('[API UserSettings GET] Unauthorized access attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('[API UserSettings GET] Authenticated userId:', userId);

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: userId },
    });

    if (!userSettings) {
      console.warn(`[API UserSettings GET] UserSettings not found for userId: ${userId}`);
      return NextResponse.json({
        message: 'User settings not found. Please complete Deriv account linking or re-login.',
      }, { status: 404 });
    }
    console.log(`[API UserSettings GET] Sending UserSettings for userId: ${userId}`);
    return NextResponse.json(userSettings);
  } catch (error: any) {
    console.error('[API UserSettings GET] Error fetching user settings:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error while fetching settings.', details: error.message }, { status: 500 });
  }
}

/**
 * Handles POST requests to update the user's selected Deriv account type and refresh the corresponding account balance.
 *
 * Validates the authenticated user, updates the selected Deriv account type (`demo` or `real`), and attempts to fetch and update the latest balance for the selected account type. Returns the updated user settings as JSON.
 *
 * @param request - The HTTP request containing the new `selectedDerivAccountType` in the JSON body.
 * @returns The updated user settings as a JSON response, or an error response with appropriate status code if validation or update fails.
 *
 * @throws {Unauthorized} If the user is not authenticated.
 * @throws {BadRequest} If the request body is missing or contains an invalid `selectedDerivAccountType`, or if the Deriv API token is not found.
 * @throws {NotFound} If user settings do not exist for the authenticated user.
 * @throws {InternalServerError} For unexpected errors during processing.
 *
 * @remark
 * If the selected Deriv account type does not have an associated account ID, the balance will not be updated but the account type will still be changed.
 */
export async function POST(request: Request) {
  console.log('[API UserSettings POST] Request received.');
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.warn('[API UserSettings POST] Unauthorized access attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('[API UserSettings POST] Authenticated userId:', userId);

    const body = await request.json();
    const { selectedDerivAccountType } = body;
    console.log('[API UserSettings POST] Parsed selectedDerivAccountType from body:', selectedDerivAccountType);

    if (!selectedDerivAccountType || (selectedDerivAccountType !== 'demo' && selectedDerivAccountType !== 'real')) {
      console.warn(`[API UserSettings POST] Invalid selectedDerivAccountType for userId: ${userId}. Received: ${selectedDerivAccountType}`);
      return NextResponse.json({ error: 'Invalid selectedDerivAccountType. Must be "demo" or "real".' }, { status: 400 });
    }

    const userDerivAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'deriv-credentials',
      },
    });

    const derivApiToken = userDerivAccount?.access_token;
    console.log(`[API UserSettings POST] Deriv API Token found for userId ${userId}: ${!!derivApiToken}`);
    if (!derivApiToken) {
      console.warn(`[API UserSettings POST] Deriv access token not found for userId: ${userId}`);
      return NextResponse.json({ error: 'Deriv API token not found for the user.' }, { status: 400 });
    }

    const currentUserSettings = await prisma.userSettings.findUnique({
      where: { userId: userId },
    });
    console.log('[API UserSettings POST] Current UserSettings fetched for userId', userId, ':', JSON.stringify(currentUserSettings, null, 2));

    if (!currentUserSettings) {
      console.error(`[API UserSettings POST] UserSettings not found for userId: ${userId} during POST operation.`);
      return NextResponse.json({ error: 'User settings not found. Cannot update.' }, { status: 404 });
    }

    const accountIdToFetchBalance = selectedDerivAccountType === 'demo'
      ? currentUserSettings.derivDemoAccountId
      : currentUserSettings.derivRealAccountId;
    console.log(`[API UserSettings POST] Determined accountIdToFetch for userId ${userId}: ${accountIdToFetchBalance} (for type: ${selectedDerivAccountType})`);

    const dataToUpdate: {
      selectedDerivAccountType: 'demo' | 'real';
      derivDemoBalance?: number;
      derivRealBalance?: number;
      lastBalanceSync?: Date;
    } = {
      selectedDerivAccountType: selectedDerivAccountType, // Always update the selected type
    };

    if (accountIdToFetchBalance) { // Only attempt balance fetch if accountId exists for the selected type
      console.log(`[API UserSettings POST] Attempting to call getDerivAccountBalance for userId: ${userId}, accountId: ${accountIdToFetchBalance} with token: ${derivApiToken ? 'present' : 'MISSING'}`);
      try {
        const balanceInfo = await getDerivAccountBalance(derivApiToken, accountIdToFetchBalance);
        console.log(`[API UserSettings POST] getDerivAccountBalance response for userId ${userId}, accountId ${accountIdToFetchBalance}:`, JSON.stringify(balanceInfo, null, 2));

        if (balanceInfo && typeof balanceInfo.balance === 'number') {
          if (selectedDerivAccountType === 'demo') {
            dataToUpdate.derivDemoBalance = balanceInfo.balance;
          } else { // 'real'
            dataToUpdate.derivRealBalance = balanceInfo.balance;
          }
          dataToUpdate.lastBalanceSync = new Date();
          console.log(`[API UserSettings POST] Balance successfully fetched for userId: ${userId}, accountId: ${accountIdToFetchBalance}. Balance: ${balanceInfo.balance}`);
        } else {
           console.warn(`[API UserSettings POST] Received no/invalid balance info for userId: ${userId}, accountId: ${accountIdToFetchBalance}. Response:`, JSON.stringify(balanceInfo, null, 2));
        }
      } catch (balanceError: any) {
        console.error(`[API UserSettings POST] Error calling getDerivAccountBalance for userId: ${userId}, accountId: ${accountIdToFetchBalance}:`, balanceError.message, balanceError.stack);
      }
    } else {
      console.warn(`[API UserSettings POST] No Deriv accountId found for userId: ${userId} and type: ${selectedDerivAccountType}. Balance not updated.`);
    }

    console.log(`[API UserSettings POST] Data prepared for UserSettings update for userId ${userId}:`, JSON.stringify(dataToUpdate, null, 2));
    const updatedSettings = await prisma.userSettings.update({
      where: { userId: userId },
      data: dataToUpdate,
    });

    console.log(`[API UserSettings POST] UserSettings updated for userId: ${userId}. Sending updatedSettings in response:`, JSON.stringify(updatedSettings, null, 2));
    return NextResponse.json(updatedSettings);

  } catch (error: any) {
    console.error('[API UserSettings POST] Root error processing request:', error.message, error.stack);
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User settings not found, could not update.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error while updating settings.', details: error.message }, { status: 500 });
  }
}
