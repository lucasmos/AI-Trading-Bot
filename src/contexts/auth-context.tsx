'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, isFirebaseInitialized } from '@/lib/firebase/firebase';
import { signOut as firebaseSignOutIfStillNeeded } from 'firebase/auth';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

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
  }, [router, paperBalance, liveBalance]); // Added paperBalance, liveBalance as they are set inside

  useEffect(() => {
    console.log('[AuthContext] Main effect running. NextAuth status:', nextAuthStatus, 'Current authStatus:', authStatus);

    if (userJustSwitchedAccountTypeRef.current) {
      console.log('[AuthContext] User just switched account type (flag is true). Resetting flag and skipping further sync logic for this cycle.');
      userJustSwitchedAccountTypeRef.current = false;
      // By returning here, we prevent both login() and clearAuthData() based on potentially
      // intermediate nextSession state caused by updateNextAuthSession().
      // The state set by updateSelectedDerivAccountType is trusted for this render.
      return;
    }

    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      const nextAuthUser = nextSession.user as any;

      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google' : (nextAuthUser.provider || 'nextauth') as AuthMethod;

      // Adapt session user to UserInfo, ensuring all Deriv fields are included
      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '',
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        photoURL: nextAuthUser.image,
        authMethod: authMethodFromProvider,
        provider: nextAuthUser.provider,
        derivAccessToken: nextAuthUser.derivAccessToken, // Ensure this is passed from session
        derivAccountId: nextAuthUser.derivAccountId, // Main selected account ID
        derivDemoAccountId: nextAuthUser.derivDemoAccountId,
        derivRealAccountId: nextAuthUser.derivRealAccountId,
        derivDemoBalance: nextAuthUser.derivDemoBalance,
        derivRealBalance: nextAuthUser.derivRealBalance,
        selectedDerivAccountType: nextAuthUser.selectedDerivAccountType as ('demo' | 'real' | null),
        // Ensure derivApiToken is correctly mapped if it's a nested object in session
        derivApiToken: nextAuthUser.derivApiToken || (nextAuthUser.derivAccessToken ? { access_token: nextAuthUser.derivAccessToken } : undefined),
      };

      console.log('[AuthContext] Adapted user from NextAuth session:', JSON.stringify(adaptedUser, null, 2));

      // Condition for calling login (if not just switched, handled by the block above)
      if (lastProcessedNextAuthUserId.current !== adaptedUser.id || authStatus !== 'authenticated' ||
          (userInfo && (userInfo.selectedDerivAccountType !== adaptedUser.selectedDerivAccountType ||
                        userInfo.derivDemoBalance !== adaptedUser.derivDemoBalance ||
                        userInfo.derivRealBalance !== adaptedUser.derivRealBalance ))) {
        console.log('[AuthContext] Syncing AuthContext state with NextAuth session due to change.');
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
        lastProcessedNextAuthUserId.current = adaptedUser.id;
      } else {
        console.log('[AuthContext] NextAuth session is authenticated and AuthContext is already in sync.');
      }
      // Ensure authStatus is 'authenticated' if not already set by login()
      if (authStatus !== 'authenticated') {
          setAuthStatus('authenticated');
      }

    } else if (nextAuthStatus === 'loading') {
      if (authStatus !== 'pending') {
        console.log('[AuthContext] NextAuth session is loading. Setting authStatus to pending.');
        setAuthStatus('pending');
      }
      lastProcessedNextAuthUserId.current = null;

    } else { // nextAuthStatus is 'unauthenticated' or any other non-'authenticated', non-'loading' state
      // Only clear data if context thought user was authenticated or pending, but session is now definitively unauthenticated.
      if (authStatus === 'authenticated' || authStatus === 'pending') {
        console.log(`[AuthContext] Session no longer authenticated or has resolved to unauthenticated (current nextAuthStatus: ${nextAuthStatus}). Clearing auth data.`);
        clearAuthData(); // This will set authStatus to 'unauthenticated'
      } else {
        // If authStatus is already 'unauthenticated', do nothing to avoid redundant calls or loops.
        console.log(`[AuthContext] Session is ${nextAuthStatus} and authStatus is already 'unauthenticated'. No action needed.`);
      }
      lastProcessedNextAuthUserId.current = null;
    }
  }, [nextAuthStatus, nextSession, login, clearAuthData, userInfo, authStatus, /* userJustSwitchedAccountTypeRef is not needed as a dep */]);


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
      setUserInfo(prevUserInfo => prevUserInfo ? ({
        ...prevUserInfo,
        selectedDerivAccountType: updatedSettings.selectedDerivAccountType,
        derivDemoAccountId: updatedSettings.derivDemoAccountId,
        derivRealAccountId: updatedSettings.derivRealAccountId,
        derivDemoBalance: newDemoBalance,
        derivRealBalance: newRealBalance,
      }) : null);

      // After local context states are updated, also update the NextAuth session
      await updateNextAuthSession({
        ...nextSession,
        user: {
          ...nextSession?.user,
          selectedDerivAccountType: updatedSettings.selectedDerivAccountType,
          derivDemoAccountId: updatedSettings.derivDemoAccountId,
          derivRealAccountId: updatedSettings.derivRealAccountId,
          derivDemoBalance: newDemoBalance,
          derivRealBalance: newRealBalance,
          id: nextSession?.user?.id,
          name: nextSession?.user?.name,
          email: nextSession?.user?.email,
          image: nextSession?.user?.image,
          provider: (nextSession?.user as any)?.provider,
          derivAccessToken: (nextSession?.user as any)?.derivAccessToken,
          derivAccountId: updatedSettings.selectedDerivAccountType === 'demo' ? updatedSettings.derivDemoAccountId : updatedSettings.derivRealAccountId,
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
