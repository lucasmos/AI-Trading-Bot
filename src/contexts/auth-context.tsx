// src/contexts/auth-context.tsx
'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
// Firebase imports removed for brevity as they are not the focus of this change
// import { auth, isFirebaseInitialized } from '@/lib/firebase/firebase';
// import { signOut as firebaseSignOutIfStillNeeded } from 'firebase/auth';
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
  // const pathname = usePathname(); // Not used in current logic after firebase removal
  const { data: nextSession, status: nextAuthStatus } = useSession();

  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentAuthMethod, setCurrentAuthMethod] = useState<AuthMethod>(null);

  const [paperBalance, setPaperBalance] = useState<number>(DEFAULT_PAPER_BALANCE);
  const [liveBalance, setLiveBalance] = useState<number>(DEFAULT_LIVE_BALANCE);

  const [derivDemoBalance, setDerivDemoBalance] = useState<number | null>(null);
  const [derivLiveBalanceState, setDerivLiveBalanceState] = useState<number | null>(null);
  const [derivDemoAccountId, setDerivDemoAccountId] = useState<string | null>(null);
  const [derivLiveAccountId, setDerivLiveAccountId] = useState<string | null>(null);
  const [selectedDerivAccountType, setSelectedDerivAccountType] = useState<'demo' | 'live' | null>(null);

  const lastProcessedNextAuthUserId = useRef<string | undefined | null>(null);

  const clearAuthData = useCallback(() => {
    console.log('[AuthContext] clearAuthData called.');
    setUserInfo(null);
    setCurrentAuthMethod(null);
    setAuthStatus('unauthenticated');
    setSelectedDerivAccountType(null);
    setDerivDemoBalance(null);
    setDerivLiveBalanceState(null);
    setDerivDemoAccountId(null);
    setDerivLiveAccountId(null);
    
    if (typeof window !== 'undefined') {
      // REMOVED: localStorage.removeItem('derivAiUser');
      // REMOVED: localStorage.removeItem('derivAiAuthMethod');
      localStorage.removeItem('derivAiSelectedDerivAccountType');
      localStorage.removeItem('derivAiDerivDemoBalance');
      localStorage.removeItem('derivAiDerivLiveBalance');
      localStorage.removeItem('derivAiDerivDemoAccountId');
      localStorage.removeItem('derivAiDerivLiveAccountId');
    }

    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);
    if (typeof window !== 'undefined') {
      // These are general paper/live balances, not tied to Deriv user ID specifically in key yet
      localStorage.setItem('derivAiPaperBalance', DEFAULT_PAPER_BALANCE.toString());
      localStorage.setItem('derivAiLiveBalance', DEFAULT_LIVE_BALANCE.toString());
    }
    console.log('[AuthContext] Cleared auth data (excluding derivAiUser/Method) and reset balances.');
  }, []);

  const login = useCallback((user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => {
    const authMethodToSet: AuthMethod = method || user.authMethod || null;
    console.log(`[AuthContext] login function called. User ID: ${user.id}, Method: ${authMethodToSet}`);
    
    setUserInfo(user);
    setCurrentAuthMethod(authMethodToSet);
    setAuthStatus('authenticated');

    // The `user` object passed to this login function will now consistently come from NextAuth's session.
    // It should contain Deriv-specific fields if the authMethod is 'deriv-credentials' (set in Step 4).
    const isDerivAuthMethod = authMethodToSet === 'deriv-credentials';
    console.log(`[AuthContext] Is Deriv credentials auth method: ${isDerivAuthMethod}`);

    if (isDerivAuthMethod) {
        console.log(`[AuthContext] Deriv login processing for method: ${authMethodToSet}.`);
        // user.derivDemoBalance etc. should be populated from NextAuth session (Step 4)
        const demoBal = typeof user.derivDemoBalance === 'number' ? user.derivDemoBalance : DEFAULT_PAPER_BALANCE;
        const liveBal = typeof user.derivRealBalance === 'number' ? user.derivRealBalance : DEFAULT_LIVE_BALANCE;
        const demoId = user.derivDemoAccountId || null;
        const liveId = user.derivRealAccountId || null;

        setDerivDemoBalance(demoBal);
        setDerivLiveBalanceState(liveBal);
        setDerivDemoAccountId(demoId);
        setDerivLiveAccountId(liveId);
        
        const initialAccountType = demoId ? 'demo' : (liveId ? 'live' : null);
        setSelectedDerivAccountType(initialAccountType);

        if (initialAccountType === 'demo') {
            setPaperBalance(demoBal);
            // setLiveBalance(liveBal); // Typically demo account uses paper, real uses live.
        } else if (initialAccountType === 'live') {
            setLiveBalance(liveBal);
            // setPaperBalance(demoBal);
        } else {
            // If no specific Deriv account type selected, or no Deriv accounts, use general balances
            // These general balances might be loaded from localStorage for non-Deriv users later
        }

        // Persist Deriv specific data to localStorage (user preferences for balances on this browser)
        if (typeof window !== 'undefined') {
            localStorage.setItem(`derivAiDerivDemoBalance_${user.id}`, demoBal.toString());
            localStorage.setItem(`derivAiDerivLiveBalance_${user.id}`, liveBal.toString());
            if (demoId) localStorage.setItem(`derivAiDerivDemoAccountId_${user.id}`, demoId); else localStorage.removeItem(`derivAiDerivDemoAccountId_${user.id}`);
            if (liveId) localStorage.setItem(`derivAiDerivLiveAccountId_${user.id}`, liveId); else localStorage.removeItem(`derivAiDerivLiveAccountId_${user.id}`);
            if (initialAccountType) localStorage.setItem(`derivAiSelectedDerivAccountType_${user.id}`, initialAccountType); else localStorage.removeItem(`derivAiSelectedDerivAccountType_${user.id}`);
        }
    } else { // For other auth methods like 'google'
        console.log('[AuthContext] Non-Deriv user login processing for balances.');
        if (typeof window !== 'undefined') {
          // Load general paper/live balances, perhaps previously saved for this user
          setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
          setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
        } else {
          setPaperBalance(DEFAULT_PAPER_BALANCE);
          setLiveBalance(DEFAULT_LIVE_BALANCE);
        }
        // Clear Deriv specific states if not a Deriv login
        setSelectedDerivAccountType(null); 
        setDerivDemoBalance(null);
        setDerivLiveBalanceState(null);
        setDerivDemoAccountId(null);
        setDerivLiveAccountId(null);
    }

    if (options?.redirect) {
        const redirectTo = typeof options.redirect === 'string' ? options.redirect : '/';
        router.push(redirectTo);
    }
  }, [router]); // Removed internal state setters from deps, as login is a complex state setter itself.

  useEffect(() => {
    console.log('[AuthContext] Main effect running. NextAuth status:', nextAuthStatus);

    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      const nextAuthUser = nextSession.user as UserInfo; // Assuming UserInfo matches NextAuth session user structure after Step 4

      // Determine authMethod from provider. 'deriv-credentials' is the new ID for Deriv.
      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google'
                                  : nextAuthUser.provider === 'deriv-credentials' ? 'deriv-credentials'
                                  : (nextAuthUser.provider || 'nextauth') as AuthMethod;

      // Adapt to UserInfo structure, ensuring Deriv fields are mapped
      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '',
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        photoURL: nextAuthUser.image, // next-auth typically uses 'image'
        authMethod: authMethodFromProvider,
        provider: nextAuthUser.provider, // Keep original provider from NextAuth
        derivDemoAccountId: nextAuthUser.derivDemoAccountId,
        derivRealAccountId: nextAuthUser.derivRealAccountId,
        derivDemoBalance: nextAuthUser.derivDemoBalance,
        derivRealBalance: nextAuthUser.derivRealBalance,
        // Ensure other fields expected by UserInfo are present or defaulted
      };

      if (lastProcessedNextAuthUserId.current !== adaptedUser.id || authStatus !== 'authenticated' || currentAuthMethod !== adaptedUser.authMethod) {
        console.log('[AuthContext] Syncing AuthContext state with NextAuth session.', { newUserId: adaptedUser.id, newAuthMethod: adaptedUser.authMethod });
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
        lastProcessedNextAuthUserId.current = adaptedUser.id;
      } else {
        console.log('[AuthContext] NextAuth session authenticated and AuthContext in sync.');
      }
    } else if (nextAuthStatus === 'loading') {
      console.log('[AuthContext] NextAuth is loading. Setting context to pending.');
      if (authStatus !== 'pending') {
        setAuthStatus('pending');
      }
      lastProcessedNextAuthUserId.current = null;
    } else { // nextAuthStatus === 'unauthenticated'
      console.log('[AuthContext] NextAuth is unauthenticated.');
      // REMOVED: Block that loaded 'derivAiUser' from localStorage.
      // If NextAuth is unauthenticated, this context should also be unauthenticated.
      if (authStatus !== 'unauthenticated') {
        console.log('[AuthContext] No active NextAuth session. Clearing auth data.');
        clearAuthData(); // This will set authStatus to 'unauthenticated'
      }
      lastProcessedNextAuthUserId.current = null;
    }
  }, [nextAuthStatus, nextSession, login, clearAuthData, authStatus, currentAuthMethod]); // Added authStatus and currentAuthMethod to deps for sync condition

  const logout = useCallback(async () => {
    console.log(`[AuthContext] logout called. Current method: ${currentAuthMethod}`);
    const previousAuthMethod = currentAuthMethod; // Store before clearing

    await nextAuthSignOut({ redirect: false }); // Sign out from NextAuth first

    // clearAuthData will be called by the useEffect when nextAuthStatus becomes 'unauthenticated'
    // but to ensure immediate UI update and cleanup:
    clearAuthData();

    if (typeof window !== 'undefined') {
      console.log('[AuthContext] Client environment detected, redirecting to login page.');
      // router.push('/auth/login'); // Redirect can be conditional based on previousAuthMethod or other logic
      if (previousAuthMethod === 'deriv-credentials' || previousAuthMethod === 'google') {
         router.push('/auth/login');
      } else {
         router.push('/'); // Or some other default non-auth page
      }
    }
  }, [currentAuthMethod, router, clearAuthData]); // clearAuthData is stable

  // Effects for persisting paper/live balances (can be kept if desired)
  useEffect(() => {
    if (typeof window !== 'undefined' && userInfo?.id) {
      // Only save general paper/live balance if not using Deriv account balances directly for these
      if (currentAuthMethod !== 'deriv-credentials' || selectedDerivAccountType === null) {
        localStorage.setItem(`derivAiPaperBalance_${userInfo.id}`, paperBalance.toString());
      }
    }
  }, [paperBalance, userInfo, currentAuthMethod, selectedDerivAccountType]);

  useEffect(() => {
    if (typeof window !== 'undefined' && userInfo?.id) {
      if (currentAuthMethod !== 'deriv-credentials' || selectedDerivAccountType === null) {
        localStorage.setItem(`derivAiLiveBalance_${userInfo.id}`, liveBalance.toString());
      }
    }
  }, [liveBalance, userInfo, currentAuthMethod, selectedDerivAccountType]);

  const switchToDerivDemo = useCallback(() => {
    if (currentAuthMethod === 'deriv-credentials' && derivDemoBalance !== null) {
        setSelectedDerivAccountType('demo');
        setPaperBalance(derivDemoBalance); 
        if (typeof window !== 'undefined' && userInfo?.id) {
          localStorage.setItem(`derivAiSelectedDerivAccountType_${userInfo.id}`, 'demo');
        }
    }
  }, [currentAuthMethod, derivDemoBalance, userInfo]);

  const switchToDerivLive = useCallback(() => {
    if (currentAuthMethod === 'deriv-credentials' && derivLiveBalanceState !== null) {
        setSelectedDerivAccountType('live');
        setLiveBalance(derivLiveBalanceState); 
        if (typeof window !== 'undefined' && userInfo?.id) {
          localStorage.setItem(`derivAiSelectedDerivAccountType_${userInfo.id}`, 'live');
        }
    }
  }, [currentAuthMethod, derivLiveBalanceState, userInfo]);

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
