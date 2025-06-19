'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, isFirebaseInitialized } from '@/lib/firebase/firebase';
import { signOut as firebaseSignOutIfStillNeeded } from 'firebase/auth';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { getUpdatedUserBalances } from '@/app/actions/balance-actions';

interface AuthContextType {
  authStatus: AuthStatus;
  userInfo: UserInfo | null;
  login: (user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => void;
  logout: () => void;
  paperBalance: number; 
  setPaperBalance: React.Dispatch<React.SetStateAction<number>>;
  liveBalance: number;  
  setLiveBalance: React.Dispatch<React.SetStateAction<number>>;
  derivDemoBalance: number | null;
  derivLiveBalance: number | null; // This is the state for Real balance
  derivDemoAccountId: string | null;
  derivRealAccountId: string | null; // Changed from derivLiveAccountId for consistency
  currentAuthMethod: AuthMethod;
  // switchToDerivDemo and switchToDerivLive will be refactored
  switchToDerivDemo: () => Promise<void>;
  switchToDerivLive: () => Promise<void>;
  selectedDerivAccountType: 'demo' | 'real' | null; // Changed 'live' to 'real'
  updateSelectedDerivAccountType: (newType: 'demo' | 'real') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PAPER_BALANCE = 10000;
const DEFAULT_LIVE_BALANCE = 0; 

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: nextSession, status: nextAuthStatus, update: updateNextAuthSession } = useSession();

  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentAuthMethod, setCurrentAuthMethod] = useState<AuthMethod>(null);

  const [paperBalance, setPaperBalance] = useState<number>(DEFAULT_PAPER_BALANCE);
  const [liveBalance, setLiveBalance] = useState<number>(DEFAULT_LIVE_BALANCE);

  const [derivDemoBalance, setDerivDemoBalance] = useState<number | null>(null);
  const [derivRealBalance, setDerivRealBalance] = useState<number | null>(null); // Changed from derivLiveBalanceState
  const [derivDemoAccountId, setDerivDemoAccountId] = useState<string | null>(null);
  const [derivRealAccountId, setDerivRealAccountId] = useState<string | null>(null); // Changed from derivLiveAccountId
  const [selectedDerivAccountType, setSelectedDerivAccountType] = useState<'demo' | 'real' | null>(null); // Changed 'live' to 'real'

  // Ref to track the last user ID processed by NextAuth session to prevent infinite loops
  const lastProcessedNextAuthUserId = useRef<string | undefined | null>(undefined);
  const userJustSwitchedAccountTypeRef = useRef(false);
  const [hasAttemptedInitialSessionBalanceSync, setHasAttemptedInitialSessionBalanceSync] = useState(false);

  const clearAuthData = useCallback(() => {
    console.log('[AuthContext] clearAuthData called.');
    setUserInfo(null);
    setCurrentAuthMethod(null);
    setAuthStatus('unauthenticated');

    // Clear Deriv specific states
    setSelectedDerivAccountType(null);
    setDerivDemoBalance(null);
    setDerivRealBalance(null);
    setDerivDemoAccountId(null);
    setDerivRealAccountId(null);
    
    if (typeof window !== 'undefined') {
      // These are the specific Deriv items to remove from local storage.
      localStorage.removeItem('derivAiSelectedDerivAccountType'); // Outdated key, ensure removal
      localStorage.removeItem('derivAiDerivDemoBalance'); // Outdated key
      localStorage.removeItem('derivAiDerivLiveBalance'); // Outdated key
      localStorage.removeItem('derivAiDerivDemoAccountId'); // Outdated key
      localStorage.removeItem('derivAiDerivLiveAccountId'); // Outdated key

      // General paper/live balances might still be used for non-Deriv users or as defaults before Deriv sync
      // However, their primary role when Deriv is linked is now superseded by server-synced values.
      // For now, we reset them to default and clear user-specific ones to avoid stale data.
      localStorage.removeItem(`derivAiPaperBalance_${userInfo?.id}`); // Clear user-specific if any
      localStorage.removeItem(`derivAiLiveBalance_${userInfo?.id}`); // Clear user-specific if any
    }

    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);
    // No need to set generic 'derivAiPaperBalance' in localStorage here as it's context-managed.
    // User-specific balances for non-Deriv methods are handled in their respective useEffects or login logic.
    console.log('[AuthContext] Cleared auth data and reset context balances to default.');
  }, [userInfo?.id]); // Added userInfo.id as clearAuthData might be called when userInfo is still set from previous session

  const login = useCallback((user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => {
    const authMethodToSet: AuthMethod = method || user.authMethod || null;
    console.log(`[AuthContext] login. User ID: ${user.id}, Method: ${authMethodToSet}`);
    console.log('[AuthContext] User object received in login:', JSON.stringify(user, null, 2));
    
    setUserInfo(user);
    setCurrentAuthMethod(authMethodToSet);
    setAuthStatus('authenticated');

    const isDerivLinked = user.provider === 'deriv-credentials' || (user.derivAccessToken && (user.derivDemoAccountId || user.derivRealAccountId));
    console.log(`[AuthContext] Is Deriv linked: ${isDerivLinked}`);

    if (isDerivLinked) {
        const serverSelectedType = user.selectedDerivAccountType as ('demo' | 'real' | null) || (user.derivDemoAccountId ? 'demo' : (user.derivRealAccountId ? 'real' : null));

        console.log(`[AuthContext] Deriv login. Server selected type: ${serverSelectedType}`);
        console.log(`[AuthContext] Deriv Balances from user obj: Demo: ${user.derivDemoBalance}, Real: ${user.derivRealBalance}`);
        console.log(`[AuthContext] Deriv Account IDs from user obj: Demo: ${user.derivDemoAccountId}, Real: ${user.derivRealAccountId}`);

        setSelectedDerivAccountType(serverSelectedType);
        setDerivDemoAccountId(user.derivDemoAccountId || null);
        setDerivRealAccountId(user.derivRealAccountId || null);
        
        const demoBalanceFromUser = typeof user.derivDemoBalance === 'number' ? user.derivDemoBalance : DEFAULT_PAPER_BALANCE;
        const realBalanceFromUser = typeof user.derivRealBalance === 'number' ? user.derivRealBalance : DEFAULT_LIVE_BALANCE;

        setDerivDemoBalance(demoBalanceFromUser);
        setDerivRealBalance(realBalanceFromUser);

        if (serverSelectedType === 'demo') {
            setPaperBalance(demoBalanceFromUser);
            setLiveBalance(realBalanceFromUser); // Also set the other balance to its actual or default
        } else if (serverSelectedType === 'real') {
            setLiveBalance(realBalanceFromUser);
            setPaperBalance(demoBalanceFromUser); // Also set the other balance
        } else {
            // No specific Deriv account type selected, or no Deriv accounts linked.
            // Fallback to general paper/live balances (could be from localStorage for non-Deriv users or defaults)
            setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
            setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
            console.log('[AuthContext] No Deriv account type selected, using default/localStorage balances.');
        }
        // LocalStorage for Deriv-specific fields is removed. Data comes from session.
        console.log(`[AuthContext] Deriv login processed. Paper: ${paperBalance}, Live: ${liveBalance}, Selected: ${serverSelectedType}`);

    } else {
        console.log('[AuthContext] Non-Deriv login. Using default/localStorage balances.');
        // For non-Deriv users, or if Deriv isn't fully setup (e.g. Google login without Deriv link yet)
        if (typeof window !== 'undefined') {
          setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
          setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
        } else {
          setPaperBalance(DEFAULT_PAPER_BALANCE);
          setLiveBalance(DEFAULT_LIVE_BALANCE);
        }
        // Ensure Deriv specific states are cleared for non-Deriv users
        setSelectedDerivAccountType(null); 
        setDerivDemoBalance(null);
        setDerivRealBalance(null);
        setDerivDemoAccountId(null);
        setDerivRealAccountId(null);
    }

    if (options?.redirect) {
        const redirectTo = typeof options.redirect === 'string' ? options.redirect : '/';
        router.push(redirectTo);
    }
  }, [router]);

  useEffect(() => {
    const processSessionLogic = async () => {
      console.log(`[AuthContext] Main effect. Status: ${nextAuthStatus}. Initial Sync Attempted: ${hasAttemptedInitialSessionBalanceSync}. User Just Switched: ${userJustSwitchedAccountTypeRef.current}`);

      if (nextAuthStatus === 'authenticated' && nextSession?.user) {
        const currentSessionUser = nextSession.user as any;

        if (userJustSwitchedAccountTypeRef.current) {
          console.log('[AuthContext] Account type switch detected. Proceeding to adapt user from current session.');
          userJustSwitchedAccountTypeRef.current = false; // Reset flag
          // Fall through to adapt and login logic with currentSessionUser
        } else if (!hasAttemptedInitialSessionBalanceSync) {
          console.log('[AuthContext] New authenticated session. Attempting initial balance refresh...');
          setHasAttemptedInitialSessionBalanceSync(true); // Set flag: attempt will be made

          try {
            const freshBalances = await getUpdatedUserBalances({
              userId: currentSessionUser.id,
              demoAccountId: currentSessionUser.derivDemoAccountId,
              demoApiToken: currentSessionUser.derivDemoApiToken,
              realAccountId: currentSessionUser.derivRealAccountId,
              realApiToken: currentSessionUser.derivRealApiToken,
            });

            let sessionNeedsUpdate = false;
            const updatedUserPayload = { ...currentSessionUser };

            if (freshBalances.derivDemoBalance !== undefined && freshBalances.derivDemoBalance !== null && freshBalances.derivDemoBalance !== updatedUserPayload.derivDemoBalance) {
              updatedUserPayload.derivDemoBalance = freshBalances.derivDemoBalance;
              sessionNeedsUpdate = true;
            }
            if (freshBalances.derivRealBalance !== undefined && freshBalances.derivRealBalance !== null && freshBalances.derivRealBalance !== updatedUserPayload.derivRealBalance) {
              updatedUserPayload.derivRealBalance = freshBalances.derivRealBalance;
              sessionNeedsUpdate = true;
            }

            if (sessionNeedsUpdate) {
              console.log('[AuthContext] Fresh balances retrieved and differ. Updating NextAuth session.');
              await updateNextAuthSession({ user: updatedUserPayload });
              // IMPORTANT: Return here. The useEffect will re-run with the updated nextSession.
              // The rest of the logic (adapt user, login) will execute in that subsequent run.
              return;
            } else {
              console.log('[AuthContext] Fresh balances same as session or not fetched; no session update needed from initial sync. Proceeding with current session data.');
              // Fall through to adapt and login logic with currentSessionUser
            }
          } catch (e) {
            console.error('[AuthContext] Error during initial balance refresh:', e);
            // Fall through to adapt and login logic with currentSessionUser (potentially stale)
          }
        }

        // This block is reached if:
        // 1. Initial sync was already attempted for this session instance (`hasAttemptedInitialSessionBalanceSync` is true).
        // 2. User just switched account type (flag was true, now reset, initial sync skipped for this run).
        // 3. Initial sync was attempted, but no session update was needed (balances same or error).
        console.log('[AuthContext] Proceeding to adapt and potentially login with current/updated session data.');

        const authMethodFromProvider = currentSessionUser.provider === 'google' ? 'google' : (currentSessionUser.provider || 'nextauth') as AuthMethod;

        let determinedInitialAccountType: 'demo' | 'real' | null = null;
        if (typeof window !== 'undefined') {
          const lastUsed = localStorage.getItem('lastUsedDerivAccountType') as 'demo' | 'real' | null;
          if (lastUsed) {
            if (lastUsed === 'demo' && currentSessionUser.derivDemoAccountId && currentSessionUser.derivDemoApiToken) {
              determinedInitialAccountType = 'demo';
            } else if (lastUsed === 'real' && currentSessionUser.derivRealAccountId && currentSessionUser.derivRealApiToken) {
              determinedInitialAccountType = 'real';
            }
          }
        }
        if (!determinedInitialAccountType) {
          if (currentSessionUser.derivDemoAccountId && currentSessionUser.derivDemoApiToken) {
            determinedInitialAccountType = 'demo';
          } else if (currentSessionUser.derivRealAccountId && currentSessionUser.derivRealApiToken) {
            determinedInitialAccountType = 'real';
          } else {
            determinedInitialAccountType = currentSessionUser.selectedDerivAccountType as ('demo' | 'real' | null) || null;
          }
        }

        const activeDerivToken = determinedInitialAccountType === 'real' ? currentSessionUser.derivRealApiToken : currentSessionUser.derivDemoApiToken;
        const activeDerivAccountId = determinedInitialAccountType === 'real' ? currentSessionUser.derivRealAccountId : currentSessionUser.derivDemoAccountId;

        const adaptedUser: UserInfo = {
          id: currentSessionUser.id || '',
          name: currentSessionUser.name || currentSessionUser.email?.split('@')[0] || 'User',
          email: currentSessionUser.email || '',
          photoURL: currentSessionUser.image,
          authMethod: authMethodFromProvider,
          provider: currentSessionUser.provider,
          selectedDerivAccountType: determinedInitialAccountType,
          derivAccessToken: activeDerivToken || null,
          derivAccountId: activeDerivAccountId || null,
          derivApiToken: activeDerivToken ? { access_token: activeDerivToken } : undefined,
          derivDemoAccountId: currentSessionUser.derivDemoAccountId || null,
          derivRealAccountId: currentSessionUser.derivRealAccountId || null,
          derivDemoBalance: currentSessionUser.derivDemoBalance,
          derivRealBalance: currentSessionUser.derivRealBalance,
          derivDemoApiToken: currentSessionUser.derivDemoApiToken || null,
          derivRealApiToken: currentSessionUser.derivRealApiToken || null,
        };

        console.log('[AuthContext] Adapted user for login/sync check:', JSON.stringify(adaptedUser, null, 2));

        if (lastProcessedNextAuthUserId.current !== adaptedUser.id ||
            authStatus !== 'authenticated' ||
            (userInfo && ( // Only compare if userInfo already exists
              userInfo.selectedDerivAccountType !== adaptedUser.selectedDerivAccountType ||
              userInfo.derivDemoBalance !== adaptedUser.derivDemoBalance ||
              userInfo.derivRealBalance !== adaptedUser.derivRealBalance ||
              userInfo.derivAccessToken !== adaptedUser.derivAccessToken
            ))) {
          console.log('[AuthContext] Syncing AuthContext state with session data.');
          login(adaptedUser, adaptedUser.authMethod, { redirect: false });
          lastProcessedNextAuthUserId.current = adaptedUser.id;
        } else {
          console.log('[AuthContext] AuthContext already in sync with session data.');
        }

      } else if (nextAuthStatus === 'loading') {
        if (authStatus !== 'pending') setAuthStatus('pending');
        // DO NOT reset hasAttemptedInitialSessionBalanceSync here
        // lastProcessedNextAuthUserId.current = null; // Keep this if it helps prevent re-processing same user after loading
      } else { // Unauthenticated
        if (authStatus !== 'unauthenticated') {
          console.log('[AuthContext] Session ended or unauthenticated. Clearing auth data.');
          clearAuthData();
        }
        setHasAttemptedInitialSessionBalanceSync(false); // Reset for next new session
        lastProcessedNextAuthUserId.current = null;
      }
    };

    processSessionLogic();
  }, [
      nextAuthStatus,
      nextSession,
      login, // Keep login from useCallback
      clearAuthData, // Keep clearAuthData from useCallback
      userInfo, // current context userInfo
      authStatus, // current context authStatus
      updateNextAuthSession, // from useSession
      hasAttemptedInitialSessionBalanceSync // local state
  ]);


  const logout = useCallback(async () => {
    console.log(`[AuthContext] logout called. Current method: ${currentAuthMethod}`);
    await nextAuthSignOut({ redirect: false });
    clearAuthData();
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
  }, [currentAuthMethod, router, clearAuthData]);

  // Remove useEffects that sync paperBalance/liveBalance back to derivDemoBalance/derivLiveBalanceState and localStorage
  // as these are now primarily driven by the session/API.
  // LocalStorage for non-Deriv user balances can be handled within the login/logout logic or specific non-Deriv components if needed.

  const updateSelectedDerivAccountType = useCallback(async (newType: 'demo' | 'real') => {
    userJustSwitchedAccountTypeRef.current = true; // Set flag immediately
    console.log(`[AuthContext] updateSelectedDerivAccountType called with: ${newType}. Flag set.`);

    if (!userInfo || !['deriv', 'deriv-credentials'].includes(currentAuthMethod as string)) {
      console.warn('[AuthContext] User not logged in with Deriv or no userInfo, cannot update account type.');
      userJustSwitchedAccountTypeRef.current = false; // Reset flag if returning early
      return;
    }

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedDerivAccountType: newType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update Deriv account type: ${response.statusText}`);
      }

      const updatedSettings = await response.json();
      console.log('[AuthContext] Received updated settings from API:', updatedSettings);

      // Update context state from API response
      setSelectedDerivAccountType(updatedSettings.selectedDerivAccountType as 'demo' | 'real');
      setDerivDemoAccountId(updatedSettings.derivDemoAccountId || null);
      setDerivRealAccountId(updatedSettings.derivRealAccountId || null);

      const newDemoBalance = typeof updatedSettings.derivDemoBalance === 'number' ? updatedSettings.derivDemoBalance : DEFAULT_PAPER_BALANCE;
      const newRealBalance = typeof updatedSettings.derivRealBalance === 'number' ? updatedSettings.derivRealBalance : DEFAULT_LIVE_BALANCE;

      setDerivDemoBalance(newDemoBalance);
      setDerivRealBalance(newRealBalance);

      // Update main paper/live balances based on the new selected type
      if (updatedSettings.selectedDerivAccountType === 'demo') {
        setPaperBalance(newDemoBalance);
        setLiveBalance(newRealBalance); // Reflect the other balance too
      } else if (updatedSettings.selectedDerivAccountType === 'real') {
        setLiveBalance(newRealBalance);
        setPaperBalance(newDemoBalance); // Reflect the other balance too
      }
       // Update userInfo state as well to keep it in sync with context for other consumers
      setUserInfo(prevUserInfo => {
        if (!prevUserInfo) return null;

        const newSelectedType = updatedSettings.selectedDerivAccountType as 'demo' | 'real';
        let newAccessToken = prevUserInfo.derivAccessToken;
        let newAccountId = prevUserInfo.derivAccountId;

        if (newSelectedType === 'demo') {
          newAccessToken = prevUserInfo.derivDemoApiToken || undefined;
          newAccountId = updatedSettings.derivDemoAccountId || null;
        } else if (newSelectedType === 'real') {
          newAccessToken = prevUserInfo.derivRealApiToken || undefined;
          newAccountId = updatedSettings.derivRealAccountId || null;
        }

        return {
          ...prevUserInfo,
          selectedDerivAccountType: newSelectedType,
          derivDemoAccountId: updatedSettings.derivDemoAccountId || null,
          derivRealAccountId: updatedSettings.derivRealAccountId || null,
          derivDemoBalance: newDemoBalance,
          derivRealBalance: newRealBalance,
          derivAccessToken: newAccessToken,
          derivAccountId: newAccountId,
          derivApiToken: newAccessToken ? { access_token: newAccessToken, token_type: prevUserInfo.derivApiToken?.token_type || 'bearer' } : undefined,
        };
      });

      // After local context states are updated, also update the NextAuth session
      let activeTokenForSession = (nextSession?.user as any)?.derivAccessToken;
      let activeAccountIdForSession = (nextSession?.user as any)?.derivAccountId;

      if (updatedSettings.selectedDerivAccountType === 'demo') {
          activeTokenForSession = (userInfo?.derivDemoApiToken) || undefined; // Use userInfo from context which should be updated by now, or nextSession's specific demo token
          activeAccountIdForSession = updatedSettings.derivDemoAccountId || null;
      } else if (updatedSettings.selectedDerivAccountType === 'real') {
          activeTokenForSession = (userInfo?.derivRealApiToken) || undefined; // Use userInfo from context or nextSession's specific real token
          activeAccountIdForSession = updatedSettings.derivRealAccountId || null;
      }

      // Store the newly selected type in localStorage
      if (typeof window !== 'undefined' && updatedSettings.selectedDerivAccountType) {
        localStorage.setItem('lastUsedDerivAccountType', updatedSettings.selectedDerivAccountType);
      }

      setAuthStatus('authenticated');
      await updateNextAuthSession({
        ...nextSession,
        user: {
          ...nextSession?.user, // Spread existing user fields
          selectedDerivAccountType: updatedSettings.selectedDerivAccountType,
          derivDemoAccountId: updatedSettings.derivDemoAccountId,
          derivRealAccountId: updatedSettings.derivRealAccountId,
          derivDemoBalance: newDemoBalance,
          derivRealBalance: newRealBalance,
          // Update these to reflect the switch:
          derivAccessToken: activeTokenForSession,
          derivAccountId: activeAccountIdForSession,
          // Carry over other important fields from existing session user
          id: nextSession?.user?.id,
          name: nextSession?.user?.name,
          email: nextSession?.user?.email,
          image: nextSession?.user?.image,
          provider: (nextSession?.user as any)?.provider,
          // Also ensure specific tokens in session are passed through if they exist from initial login
          derivDemoApiToken: (nextSession?.user as any)?.derivDemoApiToken,
          derivRealApiToken: (nextSession?.user as any)?.derivRealApiToken,
        }
      });
      console.log('[AuthContext] NextAuth session update requested after account type switch.');

    } catch (error) {
      console.error('[AuthContext] Error updating selected Deriv account type:', error);
      userJustSwitchedAccountTypeRef.current = false; // Reset flag on error too
      // Optionally, show a toast message to the user here
    }
  }, [userInfo, currentAuthMethod, updateNextAuthSession, nextSession]);

  const switchToDerivDemo = useCallback(async () => {
    await updateSelectedDerivAccountType('demo');
  }, [updateSelectedDerivAccountType]);

  const switchToDerivLive = useCallback(async () => {
    await updateSelectedDerivAccountType('real');
  }, [updateSelectedDerivAccountType]);

  return (
    <AuthContext.Provider 
      value={{ 
        authStatus, 
        userInfo, 
        login, 
        logout,
        paperBalance, 
        setPaperBalance, // These setters might be removed if balances are purely derived from Deriv states
        liveBalance,  
        setLiveBalance, // These setters might be removed
        derivDemoBalance,
        derivLiveBalance: derivRealBalance, // Expose derivRealBalance as derivLiveBalance
        derivDemoAccountId,
        derivRealAccountId, // Expose derivRealAccountId
        currentAuthMethod,
        switchToDerivDemo,
        switchToDerivLive,
        selectedDerivAccountType,
        updateSelectedDerivAccountType,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
