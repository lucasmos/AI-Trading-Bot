'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    
    localStorage.removeItem('derivAiUser');
    localStorage.removeItem('derivAiAuthMethod');
    localStorage.removeItem('derivAiSelectedDerivAccountType');
    localStorage.removeItem('derivAiDerivDemoBalance');
    localStorage.removeItem('derivAiDerivLiveBalance');
    localStorage.removeItem('derivAiDerivDemoAccountId');
    localStorage.removeItem('derivAiDerivLiveAccountId');

    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);
    localStorage.setItem('derivAiPaperBalance', DEFAULT_PAPER_BALANCE.toString());
    localStorage.setItem('derivAiLiveBalance', DEFAULT_LIVE_BALANCE.toString());
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
    localStorage.setItem('derivAiDerivDemoBalance', demoBal.toString());
    localStorage.setItem('derivAiDerivLiveBalance', liveBal.toString());
        if (demoId) localStorage.setItem('derivAiDerivDemoAccountId', demoId); else localStorage.removeItem('derivAiDerivDemoAccountId');
        if (liveId) localStorage.setItem('derivAiDerivLiveAccountId', liveId); else localStorage.removeItem('derivAiDerivLiveAccountId');
        if (initialAccountType) localStorage.setItem('derivAiSelectedDerivAccountType', initialAccountType); else localStorage.removeItem('derivAiSelectedDerivAccountType');

    } else {
        console.log('[AuthContext] NextAuth user login processing for balances.');
        setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
        setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
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
    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      console.log('[AuthContext] NextAuth is authenticated. User:', nextSession.user);
      
      // Assuming Session type is augmented in a .d.ts file to include id and provider on user
      const nextAuthUser = nextSession.user as {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        provider?: string; // Added for clarity, should come from session callback
      };

      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google' : (nextAuthUser.provider || 'nextauth') as AuthMethod;
                    
      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '',
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        photoURL: nextAuthUser.image,
        authMethod: authMethodFromProvider,
        provider: nextAuthUser.provider, // Ensure provider is passed here
      };

      if (authStatus !== 'authenticated' || JSON.stringify(adaptedUser) !== JSON.stringify(userInfo)) {
        console.log('[AuthContext] Syncing NextAuth session to context state.');
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
      } else if (authStatus === 'authenticated' && currentAuthMethod !== authMethodFromProvider) {
        setCurrentAuthMethod(authMethodFromProvider);
      }
      return;
    }

    if (nextAuthStatus === 'loading') {
      console.log('[AuthContext] NextAuth is loading. Setting context to pending.');
      if (authStatus !== 'pending') setAuthStatus('pending');
      return;
                }

    console.log('[AuthContext] NextAuth is unauthenticated. Checking for Deriv localStorage session.');
                const localUserString = localStorage.getItem('derivAiUser');
    const localAuthMethod = localStorage.getItem('derivAiAuthMethod') as AuthMethod;

                if (['deriv', 'deriv-credentials'].includes(localAuthMethod as string) && localUserString) {
                    try {
                        const user = JSON.parse(localUserString) as UserInfo;
            console.log(`[AuthContext] Maintaining ${localAuthMethod} session from localStorage as NextAuth is inactive.`);
                        login(user, localAuthMethod, { redirect: false });
                    } catch (e) {
            console.error(`[AuthContext] Error parsing stored ${localAuthMethod} user. Clearing auth data.`, e);
            if (authStatus !== 'unauthenticated') clearAuthData();
        }
    } else if (authStatus !== 'unauthenticated') {
        console.log('[AuthContext] No active NextAuth session and no Deriv localStorage session. Clearing auth data.');
        clearAuthData();
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAuthStatus, nextSession, clearAuthData, router, pathname, userInfo, authStatus]);

  const logout = useCallback(async () => {
    console.log(`[AuthContext] logout called. Current method: ${currentAuthMethod}`);

    console.log('[AuthContext] Signing out from NextAuth.');
    await nextAuthSignOut({ redirect: false });

          clearAuthData();
            router.push('/auth/login');

  }, [currentAuthMethod, router, clearAuthData]);

  useEffect(() => {
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
  }, [paperBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivDemoBalance, setDerivDemoBalance]);

  useEffect(() => {
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
  }, [liveBalance, userInfo, currentAuthMethod, selectedDerivAccountType, derivLiveBalanceState, setDerivLiveBalanceState]);

  const switchToDerivDemo = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivDemoBalance !== null) {
        setSelectedDerivAccountType('demo');
        setPaperBalance(derivDemoBalance); 
        localStorage.setItem('derivAiSelectedDerivAccountType', 'demo');
    }
  }, [currentAuthMethod, derivDemoBalance]);

  const switchToDerivLive = useCallback(() => {
    if (['deriv', 'deriv-credentials'].includes(currentAuthMethod as string) && derivLiveBalanceState !== null) {
        setSelectedDerivAccountType('live');
        setLiveBalance(derivLiveBalanceState); 
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
