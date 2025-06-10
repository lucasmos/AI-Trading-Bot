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
  const pathname = usePathname();
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

  // Ref to track the last user ID processed by NextAuth session to prevent infinite loops
  const lastProcessedNextAuthUserId = useRef<string | undefined | null>(undefined);

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
      // localStorage.removeItem('derivAiUser'); // No longer relying on this for session
      // localStorage.removeItem('derivAiAuthMethod'); // No longer relying on this for session
      localStorage.removeItem('derivAiSelectedDerivAccountType');
      localStorage.removeItem('derivAiDerivDemoBalance');
      localStorage.removeItem('derivAiDerivLiveBalance');
      localStorage.removeItem('derivAiDerivDemoAccountId');
      localStorage.removeItem('derivAiDerivLiveAccountId');
    }

    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);
    if (typeof window !== 'undefined') {
      localStorage.setItem('derivAiPaperBalance', DEFAULT_PAPER_BALANCE.toString());
      localStorage.setItem('derivAiLiveBalance', DEFAULT_LIVE_BALANCE.toString());
    }
    console.log('[AuthContext] Cleared all auth data and reset balances to default.');
  }, []);

  const login = useCallback((user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => {
    const authMethodToSet: AuthMethod = method || user.authMethod || null;
    console.log(`[AuthContext] login (syncing from NextAuth). User ID: ${user.id}, Method: ${authMethodToSet}`);
    
    setUserInfo(user);
    setCurrentAuthMethod(authMethodToSet);
    setAuthStatus('authenticated');

    const isDerivAuthMethod = ['deriv', 'deriv-credentials'].includes(authMethodToSet as string);
    console.log(`[AuthContext] Is Deriv auth method: ${isDerivAuthMethod}`);

    if (isDerivAuthMethod) {
        console.log(`[AuthContext] Deriv login processing for method: ${authMethodToSet}.`);
        // For 'deriv-credentials', these user.deriv... fields might not be present initially from NextAuth.
        // They would be defaults unless explicitly passed to the login() function from elsewhere with this data.
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
    setLiveBalance(liveBal);  
        } else if (initialAccountType === 'live') {
            setLiveBalance(liveBal);
            setPaperBalance(demoBal); 
        } else {
            setPaperBalance(DEFAULT_PAPER_BALANCE);
            setLiveBalance(DEFAULT_LIVE_BALANCE);
        }
        // Persist Deriv specific data
    if (typeof window !== 'undefined') {
      localStorage.setItem('derivAiDerivDemoBalance', demoBal.toString());
      localStorage.setItem('derivAiDerivLiveBalance', liveBal.toString());
      if (demoId) localStorage.setItem('derivAiDerivDemoAccountId', demoId); else localStorage.removeItem('derivAiDerivDemoAccountId');
      if (liveId) localStorage.setItem('derivAiDerivLiveAccountId', liveId); else localStorage.removeItem('derivAiDerivLiveAccountId');
      if (initialAccountType) localStorage.setItem('derivAiSelectedDerivAccountType', initialAccountType); else localStorage.removeItem('derivAiSelectedDerivAccountType');
    }

    } else {
        console.log('[AuthContext] NextAuth user login processing for balances.');
        if (typeof window !== 'undefined') {
          setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
          setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
        } else {
          setPaperBalance(DEFAULT_PAPER_BALANCE);
          setLiveBalance(DEFAULT_LIVE_BALANCE);
        }
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
  }, [router]);

  useEffect(() => {
    console.log('[AuthContext] Main effect running. NextAuth status:', nextAuthStatus);

    // Case 1: NextAuth is authenticated
    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      const nextAuthUser = nextSession.user as {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        provider?: string;
        derivDemoAccountId?: string | null;
        derivRealAccountId?: string | null;
        derivDemoBalance?: number | null;
        derivRealBalance?: number | null;
        derivApiToken?: { access_token: string }; // Added for Deriv API token
      };

      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google' : (nextAuthUser.provider || 'nextauth') as AuthMethod;

      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '',
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        photoURL: nextAuthUser.image,
        authMethod: authMethodFromProvider,
        provider: nextAuthUser.provider,
        derivDemoAccountId: nextAuthUser.derivDemoAccountId,
        derivRealAccountId: nextAuthUser.derivRealAccountId,
        derivDemoBalance: nextAuthUser.derivDemoBalance,
        derivRealBalance: nextAuthUser.derivRealBalance,
        derivApiToken: nextAuthUser.derivApiToken, // Assign the token here
      };

      // Only call login if the NextAuth user ID has genuinely changed
      // or if we're transitioning from an unauthenticated state to an authenticated one with a new user.
      if (lastProcessedNextAuthUserId.current !== adaptedUser.id || authStatus !== 'authenticated') {
        console.log('[AuthContext] Syncing AuthContext state with NextAuth session due to change.', {
          currentAuthStatus: authStatus,
          currentUserId: userInfo?.id,
          currentAuthMethod: currentAuthMethod,
          nextAuthUserStatus: 'authenticated',
          nextAuthUserId: adaptedUser.id,
          nextAuthMethod: adaptedUser.authMethod,
        });
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
        lastProcessedNextAuthUserId.current = adaptedUser.id; // Mark this user ID as processed
      } else {
        console.log('[AuthContext] NextAuth session is authenticated and AuthContext is already in sync.');
      }
      return; // Exit early to avoid further checks
    }

    // Case 2: NextAuth is loading
    if (nextAuthStatus === 'loading') {
      console.log('[AuthContext] NextAuth is loading. Setting context to pending.');
      if (authStatus !== 'pending') { // Only update if necessary
        setAuthStatus('pending');
      }
      // Clear last processed user ID when NextAuth is loading/unauthenticated to ensure re-processing on next auth
      lastProcessedNextAuthUserId.current = null;
      return; // Exit early
    }

    // Case 3: NextAuth is unauthenticated (and not loading)
    // No more localStorage fallback for Deriv session. If NextAuth is unauthenticated, the user is unauthenticated.
    console.log('[AuthContext] NextAuth is unauthenticated.');
    if (authStatus !== 'unauthenticated') {
      console.log('[AuthContext] No active NextAuth session. Clearing auth data.');
      clearAuthData(); // Clears context state and any remaining relevant localStorage (like balances, selected accounts)
    }
    lastProcessedNextAuthUserId.current = null; // Clear ref for the last processed user

  // ESLint will complain about missing dependencies (userInfo, authStatus, currentAuthMethod).
  // We explicitly exclude them because their state is updated by `login` or `setAuthStatus/setUserInfo/setCurrentAuthMethod`
  // within this very `useEffect`, which would create an infinite loop.
  // The effect reacts to external changes (nextAuthStatus, nextSession) and stable callbacks (login, clearAuthData).
  // The internal state (userInfo, authStatus, currentAuthMethod) is read for conditional logic but does not trigger the effect.
  // This is a known pattern for preventing infinite loops in useEffect where state is updated by the effect.
  }, [nextAuthStatus, nextSession, login, clearAuthData]);

  const logout = useCallback(async () => {
    console.log(`[AuthContext] logout called. Current method: ${currentAuthMethod}`);

    console.log('[AuthContext] Signing out from NextAuth.');
    await nextAuthSignOut({ redirect: false }); // This should be safe.

    clearAuthData(); // This manipulates state and localStorage, ensure it's robust.
                     // localStorage access should ideally also be guarded by `typeof window !== 'undefined'`,
                     // but `clearAuthData` might already handle this or NextAuth's signOut does it.
                     // For now, focus on router.push.

    if (typeof window !== 'undefined') {
      console.log('[AuthContext] Client environment detected, redirecting to login page.');
      router.push('/auth/login');
    } else {
      console.log('[AuthContext] Server environment detected, skipping client-side redirect during logout.');
      // On the server, a redirect might need to be handled differently,
      // but for the _not-found page prerender, not redirecting is likely fine.
      // The goal here is to prevent `router.push` from causing issues during SSR.
    }
  }, [currentAuthMethod, router, clearAuthData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (userInfo) {
        if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string)) {
          if (selectedDerivAccountType === 'demo' && paperBalance !== derivDemoBalance) {
            setDerivDemoBalance(paperBalance);
            // This localStorage key might need to be more generic if balances aren't shared between 'deriv' and 'deriv-credentials'
            localStorage.setItem('derivAiDerivDemoBalance', paperBalance.toString());
          }
        } else {
          localStorage.setItem(`derivAiPaperBalance_${userInfo.id}`, paperBalance.toString());
        }
      } else {
        localStorage.setItem('derivAiPaperBalance', paperBalance.toString());
      }
    }
  }, [paperBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivDemoBalance, setDerivDemoBalance]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (userInfo) {
        if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string)) {
          if (selectedDerivAccountType === 'live' && liveBalance !== derivLiveBalanceState) {
            setDerivLiveBalanceState(liveBalance);
            // This localStorage key might need to be more generic
            localStorage.setItem('derivAiDerivLiveBalance', liveBalance.toString());
          }
        } else {
          localStorage.setItem(`derivAiLiveBalance_${userInfo.id}`, liveBalance.toString());
        }
      } else {
        localStorage.setItem('derivAiLiveBalance', liveBalance.toString());
      }
    }
  }, [liveBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivLiveBalanceState, setDerivLiveBalanceState]);

  const switchToDerivDemo = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivDemoBalance !== null) {
        setSelectedDerivAccountType('demo');
        setPaperBalance(derivDemoBalance); 
        if (typeof window !== 'undefined') {
          localStorage.setItem('derivAiSelectedDerivAccountType', 'demo');
        }
    }
  }, [currentAuthMethod, derivDemoBalance]);

  const switchToDerivLive = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivLiveBalanceState !== null) {
        setSelectedDerivAccountType('live');
        setLiveBalance(derivLiveBalanceState); 
        if (typeof window !== 'undefined') {
          localStorage.setItem('derivAiSelectedDerivAccountType', 'live');
        }
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
