'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
// import { auth, isFirebaseInitialized } from '@/lib/firebase/firebase'; // No longer used
// import { signOut as firebaseSignOutIfStillNeeded } from 'firebase/auth'; // No longer used
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
  derivLiveBalance: number | null;
  derivDemoAccountId: string | null;
  derivLiveAccountId: string | null;
  currentAuthMethod: AuthMethod;
  switchToDerivDemo: () => void;
  switchToDerivLive: () => void;
  selectedDerivAccountType: 'demo' | 'live' | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PAPER_BALANCE = 10000;
const DEFAULT_LIVE_BALANCE = 0; 

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname(); // Keep pathname if used in dependencies, otherwise can be removed if not directly used
  const { data: nextSession, status: nextAuthStatus } = useSession();

  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentAuthMethod, setCurrentAuthMethod] = useState<AuthMethod>(null);

  // Initialize balances from generic localStorage on initial load, then user-specific
  const [paperBalance, setPaperBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const genericStored = localStorage.getItem('derivAiPaperBalance');
      return genericStored ? parseFloat(genericStored) : DEFAULT_PAPER_BALANCE;
    }
    return DEFAULT_PAPER_BALANCE;
  });
  const [liveBalance, setLiveBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const genericStored = localStorage.getItem('derivAiLiveBalance');
      return genericStored ? parseFloat(genericStored) : DEFAULT_LIVE_BALANCE;
    }
    return DEFAULT_LIVE_BALANCE;
  });

  const [derivDemoBalance, setDerivDemoBalance] = useState<number | null>(null);
  const [derivLiveBalanceState, setDerivLiveBalanceState] = useState<number | null>(null);
  const [derivDemoAccountId, setDerivDemoAccountId] = useState<string | null>(null);
  const [derivLiveAccountId, setDerivLiveAccountId] = useState<string | null>(null);
  const [selectedDerivAccountType, setSelectedDerivAccountType] = useState<'demo' | 'live' | null>(null);

  const clearAuthData = useCallback(() => {
    console.log('[AuthContext] clearAuthData called.');
    setUserInfo(null);
    setCurrentAuthMethod(null);
    setAuthStatus('unauthenticated');

    // Reset Deriv specific states
    setSelectedDerivAccountType(null);
    setDerivDemoBalance(null);
    setDerivLiveBalanceState(null);
    setDerivDemoAccountId(null);
    setDerivLiveAccountId(null);
    
    // Remove generic Deriv state items from localStorage
    localStorage.removeItem('derivAiUser'); // This might be the user object from mock/previous direct Deriv login
    localStorage.removeItem('derivAiAuthMethod'); // Old auth method storage
    localStorage.removeItem('derivAiSelectedDerivAccountType');
    localStorage.removeItem('derivAiDerivDemoBalance');
    localStorage.removeItem('derivAiDerivLiveBalance');
    localStorage.removeItem('derivAiDerivDemoAccountId');
    localStorage.removeItem('derivAiDerivLiveAccountId');

    // Reset paper and live balances to default values in context state
    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);

    // DO NOT write defaults to generic localStorage keys anymore.
    // User-specific balances will be handled by login/useEffect.
    // localStorage.removeItem('derivAiPaperBalance'); // Optional: remove generic keys if they exist
    // localStorage.removeItem('derivAiLiveBalance'); // Optional: remove generic keys if they exist

    console.log('[AuthContext] Cleared session-specific auth data and reset balances in context to default.');
  }, []);

  const login = useCallback((user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => {
    const authMethodToSet: AuthMethod = method || user.authMethod || null;
    console.log(`[AuthContext] login. User ID: ${user.id}, Method: ${authMethodToSet}`);
    
    setUserInfo(user);
    setCurrentAuthMethod(authMethodToSet);
    setAuthStatus('authenticated');

    // Load user-specific balances or set to default if not found
    if (user && user.id) {
      const storedPaperBalance = localStorage.getItem(`derivAiPaperBalance_${user.id}`);
      if (storedPaperBalance && !isNaN(parseFloat(storedPaperBalance))) {
        console.log(`[AuthContext] Loaded paper balance for user ${user.id}: ${storedPaperBalance}`);
        setPaperBalance(parseFloat(storedPaperBalance));
      } else {
        console.log(`[AuthContext] No stored paper balance for user ${user.id}, setting to default.`);
        setPaperBalance(DEFAULT_PAPER_BALANCE);
      }

      const storedLiveBalance = localStorage.getItem(`derivAiLiveBalance_${user.id}`);
      if (storedLiveBalance && !isNaN(parseFloat(storedLiveBalance))) {
        console.log(`[AuthContext] Loaded live balance for user ${user.id}: ${storedLiveBalance}`);
        setLiveBalance(parseFloat(storedLiveBalance));
      } else {
        console.log(`[AuthContext] No stored live balance for user ${user.id}, setting to default.`);
        setLiveBalance(DEFAULT_LIVE_BALANCE);
      }
    } else {
      // Fallback if user.id is somehow not available (should not happen for authenticated user)
      console.warn('[AuthContext] User ID not available, setting balances to default.');
      setPaperBalance(DEFAULT_PAPER_BALANCE);
      setLiveBalance(DEFAULT_LIVE_BALANCE);
    }

    const isDerivAuthMethod = ['deriv', 'deriv-credentials'].includes(authMethodToSet as string);
    console.log(`[AuthContext] Is Deriv auth method: ${isDerivAuthMethod}`);

    if (isDerivAuthMethod) {
        console.log(`[AuthContext] Deriv login specific setup for method: ${authMethodToSet}.`);
        // These are Deriv's own account balances, not the general paper/live balances.
        // They might come from user object if mock login, or fetched from Deriv API in a real scenario.
        // For 'deriv-credentials' initiated by NextAuth, these won't be on 'user' object from session.
        const demoBal = typeof user.derivDemoBalance === 'number' ? user.derivDemoBalance : parseFloat(localStorage.getItem('derivAiDerivDemoBalance') || DEFAULT_PAPER_BALANCE.toString());
        const liveBal = typeof user.derivRealBalance === 'number' ? user.derivRealBalance : parseFloat(localStorage.getItem('derivAiDerivLiveBalance') || DEFAULT_LIVE_BALANCE.toString());
        const demoId = user.derivDemoAccountId || localStorage.getItem('derivAiDerivDemoAccountId');
        const liveId = user.derivRealAccountId || localStorage.getItem('derivAiDerivLiveAccountId');

        setDerivDemoBalance(demoBal);
        setDerivLiveBalanceState(liveBal);
        setDerivDemoAccountId(demoId);
        setDerivLiveAccountId(liveId);
        
        // Determine initial selected account type for Deriv
        const initialAccountType = localStorage.getItem('derivAiSelectedDerivAccountType') as ('demo' | 'live' | null) || (demoId ? 'demo' : (liveId ? 'live' : null));
        setSelectedDerivAccountType(initialAccountType);

        // If a Deriv account type is selected, it might influence the main paper/live balances
        // This is where switchToDerivDemo or switchToDerivLive would typically be called,
        // or their logic replicated if appropriate on login.
        if (initialAccountType === 'demo') {
            // setPaperBalance(demoBal); // This would overwrite user-specific paper balance.
            // Let switchToDerivDemo handle this if user explicitly switches.
            console.log(`[AuthContext] Deriv demo account selected. Main paper balance remains: ${paperBalance}`);
        } else if (initialAccountType === 'live') {
            // setLiveBalance(liveBal); // This would overwrite user-specific live balance.
            console.log(`[AuthContext] Deriv live account selected. Main live balance remains: ${liveBalance}`);
        }
        // Persist generic Deriv specific data (these are not user-specific balances)
        localStorage.setItem('derivAiDerivDemoBalance', demoBal.toString());
        localStorage.setItem('derivAiDerivLiveBalance', liveBal.toString());
        if (demoId) localStorage.setItem('derivAiDerivDemoAccountId', demoId); else localStorage.removeItem('derivAiDerivDemoAccountId');
        if (liveId) localStorage.setItem('derivAiDerivLiveAccountId', liveId); else localStorage.removeItem('derivAiDerivLiveAccountId');
        if (initialAccountType) localStorage.setItem('derivAiSelectedDerivAccountType', initialAccountType); else localStorage.removeItem('derivAiSelectedDerivAccountType');

    } else {
        // For non-Deriv methods, ensure Deriv specific context states are cleared/reset
        console.log('[AuthContext] Non-Deriv auth method. Clearing Deriv-specific states.');
        setSelectedDerivAccountType(null); 
        setDerivDemoBalance(null);
        setDerivLiveBalanceState(null);
        setDerivDemoAccountId(null);
        setDerivLiveAccountId(null);
        // Generic Deriv localStorage items are not cleared here, clearAuthData handles them on logout.
    }

    if (options?.redirect) {
        const redirectTo = typeof options.redirect === 'string' ? options.redirect : '/';
        router.push(redirectTo);
    }
  }, [router]);


  // Main useEffect for syncing with NextAuth session
  useEffect(() => {
    console.log('[AuthContext] Main effect running. NextAuth status:', nextAuthStatus);
    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      console.log('[AuthContext] NextAuth is authenticated. User from session:', nextSession.user);
      
      const nextAuthUser = nextSession.user as UserInfo & { provider?: string }; // Augment with provider
                    
      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google' :
                                   nextAuthUser.provider === 'credentials' ? 'credentials' : // Assuming 'Email & Password' is 'credentials'
                                   nextAuthUser.provider === 'deriv-credentials' ? 'deriv-credentials' :
                                   (nextAuthUser.provider || 'nextauth') as AuthMethod;

      // Adapt NextAuth user to your UserInfo type
      // Important: Do not spread nextAuthUser directly if its structure differs significantly or has extra fields
      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '', // Ensure ID is present
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        photoURL: nextAuthUser.image, // NextAuth uses 'image' for photoURL
        authMethod: authMethodFromProvider,
        // Include other fields from your UserInfo type if they come from NextAuth session, otherwise they'll be undefined
        // e.g., derivDemoBalance, derivRealAccountId will not be on nextAuthUser from 'deriv-credentials'
      };

      // Check if user info or auth status truly changed to prevent unnecessary re-logins/renders
      if (authStatus !== 'authenticated' || userInfo?.id !== adaptedUser.id || currentAuthMethod !== adaptedUser.authMethod) {
        console.log('[AuthContext] Syncing NextAuth session to context state. Adapted User:', adaptedUser);
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
      }
      return;
    }

    if (nextAuthStatus === 'loading') {
      if (authStatus !== 'pending') {
        console.log('[AuthContext] NextAuth is loading. Setting context to pending.');
        setAuthStatus('pending');
      }
      return;
    }

    // Handle unauthenticated state
    if (authStatus !== 'unauthenticated') {
        console.log('[AuthContext] NextAuth is unauthenticated. No active session. Clearing auth data.');
        clearAuthData();
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAuthStatus, nextSession, clearAuthData, login, authStatus, currentAuthMethod, userInfo]); // Added login, authStatus, currentAuthMethod, userInfo


  // useEffect for persisting paperBalance
  useEffect(() => {
    if (userInfo && userInfo.id && authStatus === 'authenticated') {
      console.log(`[AuthContext] Persisting paperBalance for user ${userInfo.id}: ${paperBalance}`);
      localStorage.setItem(`derivAiPaperBalance_${userInfo.id}`, paperBalance.toString());
    }
    // If Deriv demo balance should mirror paper balance when a Deriv demo account is active
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) &&
        selectedDerivAccountType === 'demo' &&
        paperBalance !== derivDemoBalance && // Avoid loop if already same
        derivDemoBalance !== null) { // Only if derivDemoBalance is initialized
      console.log(`[AuthContext] Mirroring paperBalance to derivDemoBalance: ${paperBalance}`);
      setDerivDemoBalance(paperBalance);
      localStorage.setItem('derivAiDerivDemoBalance', paperBalance.toString()); // Generic key for current Deriv demo state
    }
  }, [paperBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivDemoBalance, authStatus]);

  // useEffect for persisting liveBalance
  useEffect(() => {
    if (userInfo && userInfo.id && authStatus === 'authenticated') {
      console.log(`[AuthContext] Persisting liveBalance for user ${userInfo.id}: ${liveBalance}`);
      localStorage.setItem(`derivAiLiveBalance_${userInfo.id}`, liveBalance.toString());
    }
    // If Deriv live balance should mirror live balance when a Deriv live account is active
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) &&
        selectedDerivAccountType === 'live' &&
        liveBalance !== derivLiveBalanceState && // Avoid loop if already same
        derivLiveBalanceState !== null) { // Only if derivLiveBalanceState is initialized
      console.log(`[AuthContext] Mirroring liveBalance to derivLiveBalanceState: ${liveBalance}`);
      setDerivLiveBalanceState(liveBalance);
      localStorage.setItem('derivAiDerivLiveBalance', liveBalance.toString()); // Generic key for current Deriv live state
    }
  }, [liveBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivLiveBalanceState, authStatus]);


  const switchToDerivDemo = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivDemoBalance !== null) {
        console.log(`[AuthContext] Switching to Deriv Demo Account. Balance: ${derivDemoBalance}`);
        setSelectedDerivAccountType('demo');
        setPaperBalance(derivDemoBalance); // Update main paper balance to reflect Deriv demo
        localStorage.setItem('derivAiSelectedDerivAccountType', 'demo');
    }
  }, [currentAuthMethod, derivDemoBalance]);

  const switchToDerivLive = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivLiveBalanceState !== null) {
        console.log(`[AuthContext] Switching to Deriv Live Account. Balance: ${derivLiveBalanceState}`);
        setSelectedDerivAccountType('live');
        setLiveBalance(derivLiveBalanceState); // Update main live balance to reflect Deriv live
        localStorage.setItem('derivAiSelectedDerivAccountType', 'live');
    }
  }, [currentAuthMethod, derivLiveBalanceState]);

  return (
    <AuthContext.Provider 
      value={{ 
        authStatus, 
        userInfo, 
        login, 
        logout,
        paperBalance, 
        setPaperBalance,
        liveBalance,  
        setLiveBalance,
        derivDemoBalance,
        derivLiveBalance: derivLiveBalanceState,
        derivDemoAccountId,
        derivLiveAccountId,
        currentAuthMethod,
        switchToDerivDemo,
        switchToDerivLive,
        selectedDerivAccountType,
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
