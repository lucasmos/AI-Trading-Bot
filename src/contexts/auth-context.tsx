'use client';

import type { UserInfo, AuthStatus, AuthMethod } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  derivRealAccountId: string | null;
  currentAuthMethod: AuthMethod;
  switchToDerivDemo: () => Promise<void>;
  switchToDerivLive: () => Promise<void>;
  selectedDerivAccountType: 'demo' | 'real' | null;
  updateSelectedDerivAccountType: (newType: 'demo' | 'real') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PAPER_BALANCE = 10000;
const DEFAULT_LIVE_BALANCE = 0; 

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { data: nextSession, status: nextAuthStatus } = useSession();

  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentAuthMethod, setCurrentAuthMethod] = useState<AuthMethod>(null);

  const [paperBalance, setPaperBalance] = useState<number>(DEFAULT_PAPER_BALANCE);
  const [liveBalance, setLiveBalance] = useState<number>(DEFAULT_LIVE_BALANCE);

  const [derivDemoBalance, setDerivDemoBalance] = useState<number | null>(null);
  const [derivRealBalance, setDerivRealBalance] = useState<number | null>(null);
  const [derivDemoAccountId, setDerivDemoAccountId] = useState<string | null>(null);
  const [derivRealAccountId, setDerivRealAccountId] = useState<string | null>(null);
  const [selectedDerivAccountType, setSelectedDerivAccountType] = useState<'demo' | 'real' | null>(null);

  const lastProcessedNextAuthUserId = useRef<string | undefined | null>(undefined);

  const clearAuthData = useCallback(() => {
    console.log('[AuthContext/clearAuthData] Called.');
    setUserInfo(null);
    setCurrentAuthMethod(null);
    setAuthStatus('unauthenticated');

    setSelectedDerivAccountType(null);
    setDerivDemoBalance(null);
    setDerivRealBalance(null);
    setDerivDemoAccountId(null);
    setDerivRealAccountId(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('derivAiSelectedDerivAccountType');
      localStorage.removeItem('derivAiDerivDemoBalance');
      localStorage.removeItem('derivAiDerivLiveBalance');
      localStorage.removeItem('derivAiDerivDemoAccountId');
      localStorage.removeItem('derivAiDerivLiveAccountId');
      localStorage.removeItem(`derivAiPaperBalance_${userInfo?.id}`);
      localStorage.removeItem(`derivAiLiveBalance_${userInfo?.id}`);
    }

    setPaperBalance(DEFAULT_PAPER_BALANCE); 
    setLiveBalance(DEFAULT_LIVE_BALANCE);
    console.log('[AuthContext/clearAuthData] Cleared auth data and reset context balances.');
  }, [userInfo?.id]);

  const login = useCallback((user: UserInfo, method?: AuthMethod, options?: { redirect?: boolean | string }) => {
    const authMethodToSet: AuthMethod = method || user.authMethod || null;
    console.log(`[AuthContext/login] Called. User ID: ${user.id}, Method: ${authMethodToSet}, Provider: ${user.provider}`);
    // console.log('[AuthContext/login] Full user object from session/param:', JSON.stringify(user, null, 2));
    
    setUserInfo(user); // This will store the full adaptedUser object including all Deriv fields from session
    setCurrentAuthMethod(authMethodToSet);
    setAuthStatus('authenticated');

    const isDerivLinked = user.provider === 'deriv-credentials' || (user.derivAccessToken && (user.derivDemoAccountId || user.derivRealAccountId));

    if (isDerivLinked) {
        const serverSelectedType = user.selectedDerivAccountType || (user.derivDemoAccountId ? 'demo' : (user.derivRealAccountId ? 'real' : null));

        setSelectedDerivAccountType(serverSelectedType);
        setDerivDemoAccountId(user.derivDemoAccountId || null);
        setDerivRealAccountId(user.derivRealAccountId || null);
        
        const demoBalanceFromUser = typeof user.derivDemoBalance === 'number' ? user.derivDemoBalance : DEFAULT_PAPER_BALANCE;
        const realBalanceFromUser = typeof user.derivRealBalance === 'number' ? user.derivRealBalance : DEFAULT_LIVE_BALANCE;

        setDerivDemoBalance(demoBalanceFromUser);
        setDerivRealBalance(realBalanceFromUser);

        if (serverSelectedType === 'demo') {
            setPaperBalance(demoBalanceFromUser);
            setLiveBalance(realBalanceFromUser);
        } else if (serverSelectedType === 'real') {
            setLiveBalance(realBalanceFromUser);
            setPaperBalance(demoBalanceFromUser);
        } else {
             if (user.derivDemoAccountId) {
                setPaperBalance(demoBalanceFromUser);
                setLiveBalance(realBalanceFromUser);
                setSelectedDerivAccountType('demo');
            } else if (user.derivRealAccountId) {
                setLiveBalance(realBalanceFromUser);
                setPaperBalance(demoBalanceFromUser);
                setSelectedDerivAccountType('real');
            } else {
                setPaperBalance(DEFAULT_PAPER_BALANCE);
                setLiveBalance(DEFAULT_LIVE_BALANCE);
            }
        }
        console.log(`[AuthContext/login] Deriv-linked user. Context states set. Selected: ${selectedDerivAccountType}, DemoBal: ${derivDemoBalance}, RealBal: ${derivRealBalance}, Paper: ${paperBalance}, Live: ${liveBalance}`);
    } else {
        if (typeof window !== 'undefined') {
          setPaperBalance(parseFloat(localStorage.getItem(`derivAiPaperBalance_${user.id}`) || DEFAULT_PAPER_BALANCE.toString()));
          setLiveBalance(parseFloat(localStorage.getItem(`derivAiLiveBalance_${user.id}`) || DEFAULT_LIVE_BALANCE.toString()));
        } else {
          setPaperBalance(DEFAULT_PAPER_BALANCE);
          setLiveBalance(DEFAULT_LIVE_BALANCE);
        }
        setSelectedDerivAccountType(null); 
        setDerivDemoBalance(null);
        setDerivRealBalance(null);
        setDerivDemoAccountId(null);
        setDerivRealAccountId(null);
        console.log(`[AuthContext/login] Non-Deriv user. Context states set. Paper: ${paperBalance}, Live: ${liveBalance}`);
    }

    if (options?.redirect) {
        const redirectTo = typeof options.redirect === 'string' ? options.redirect : '/';
        router.push(redirectTo);
    }
  }, [router, paperBalance, liveBalance, selectedDerivAccountType, derivDemoBalance, derivRealBalance]);

  useEffect(() => {
    // console.log('[AuthContext/useEffect] Running. nextAuthStatus:', nextAuthStatus, 'authStatus:', authStatus);
    // console.log('[AuthContext/useEffect] nextSession?.user?.id:', nextSession?.user?.id, 'lastProcessedNextAuthUserId.current:', lastProcessedNextAuthUserId.current);
    // if (userInfo) console.log('[AuthContext/useEffect] current userInfo.selectedDerivAccountType:', userInfo.selectedDerivAccountType);
    // if (nextSession?.user) console.log('[AuthContext/useEffect] nextSession.user.selectedDerivAccountType:', (nextSession.user as any).selectedDerivAccountType);

    if (nextAuthStatus === 'authenticated' && nextSession?.user) {
      const nextAuthUser = nextSession.user as any;
      const authMethodFromProvider = nextAuthUser.provider === 'google' ? 'google' : (nextAuthUser.provider || 'nextauth') as AuthMethod;
      const adaptedUser: UserInfo = {
        id: nextAuthUser.id || '',
        name: nextAuthUser.name || nextAuthUser.email?.split('@')[0] || 'User',
        email: nextAuthUser.email || '',
        image: nextAuthUser.image,
        authMethod: authMethodFromProvider,
        provider: nextAuthUser.provider,
        derivAccessToken: nextAuthUser.derivAccessToken,
        derivApiToken: nextAuthUser.derivApiToken || (nextAuthUser.derivAccessToken ? { access_token: nextAuthUser.derivAccessToken } : undefined),
        derivAccountId: nextAuthUser.derivAccountId,
        derivDemoAccountId: nextAuthUser.derivDemoAccountId,
        derivRealAccountId: nextAuthUser.derivRealAccountId,
        derivDemoBalance: nextAuthUser.derivDemoBalance,
        derivRealBalance: nextAuthUser.derivRealBalance,
        selectedDerivAccountType: nextAuthUser.selectedDerivAccountType as ('demo' | 'real' | null),
      };

      if (lastProcessedNextAuthUserId.current !== adaptedUser.id || authStatus !== 'authenticated') {
        // User ID has changed (e.g., different user logged in) OR
        // transitioning from a non-authenticated state (pending, unauthenticated) to authenticated.
        // This is a full re-sync scenario.
        console.log(`[AuthContext/useEffect] Full sync: User ID changed or auth state transitioned. Old UserID: ${lastProcessedNextAuthUserId.current}, New UserID: ${adaptedUser.id}, AuthStatus was: ${authStatus}`);
        login(adaptedUser, adaptedUser.authMethod, { redirect: false });
        lastProcessedNextAuthUserId.current = adaptedUser.id;
      } else if (userInfo && adaptedUser.id === userInfo.id) {
        // User is the same, session is still authenticated.
        // This block is to selectively update fields that might change in the session
        // but are NOT the ones managed by client-side actions like updateSelectedDerivAccountType.
        // For example, name or email might be updated via NextAuth profile page.
        let updatedFields = false;
        const newUserInfo = { ...userInfo };

        if (adaptedUser.name !== userInfo.name) {
            newUserInfo.name = adaptedUser.name;
            updatedFields = true;
        }
        if (adaptedUser.email !== userInfo.email) {
            newUserInfo.email = adaptedUser.email;
            updatedFields = true;
        }
        if (adaptedUser.image !== userInfo.image) { // 'image' is standard NextAuth session field
            newUserInfo.image = adaptedUser.image;
            updatedFields = true;
        }
        // IMPORTANT: Do NOT compare/update fields like selectedDerivAccountType, derivDemoBalance, derivRealBalance here
        // as adaptedUser might have stale data for these if they were just updated by a client action (updateSelectedDerivAccountType).
        // The `login` function called above handles initial setup of these from session.
        // Subsequent changes to these Deriv-specific fields are driven by `updateSelectedDerivAccountType`.

        if (updatedFields) {
            console.log('[AuthContext/useEffect] Updating non-Deriv user fields from session for existing user:', newUserInfo);
            setUserInfo(newUserInfo);
        } else {
            // console.log('[AuthContext/useEffect] User is same, session authenticated, no non-Deriv field changes detected from session.');
        }
      }
    } else if (nextAuthStatus === 'loading') {
      if (authStatus !== 'pending') {
        // console.log('[AuthContext/useEffect] NextAuth loading. Setting authStatus to pending.');
        setAuthStatus('pending');
      }
    } else { // 'unauthenticated'
      if (authStatus !== 'unauthenticated') {
        console.log('[AuthContext/useEffect] NextAuth unauthenticated. Clearing auth data.');
        clearAuthData();
      }
      lastProcessedNextAuthUserId.current = null;
    }
  }, [nextAuthStatus, nextSession, login, clearAuthData, userInfo, authStatus]);


  const logout = useCallback(async () => {
    await nextAuthSignOut({ redirect: false });
    clearAuthData();
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
  }, [currentAuthMethod, router, clearAuthData]); // currentAuthMethod was in deps, can be removed if not used in body


  const updateSelectedDerivAccountType = useCallback(async (newType: 'demo' | 'real') => {
    console.log('[AuthContext/updateSelected] Called with newType:', newType);
    if (!userInfo || !['deriv', 'deriv-credentials'].includes(currentAuthMethod as string)) {
      console.warn('[AuthContext/updateSelected] User not logged in with Deriv or no userInfo, cannot update account type.');
      return;
    }
    const userInfoForLog = { ...userInfo, derivAccessToken: '***REDACTED***', derivApiToken: userInfo.derivApiToken ? { ...userInfo.derivApiToken, access_token: '***REDACTED***' } : undefined };
    console.log('[AuthContext/updateSelected] About to fetch /api/user/settings. Current userInfo (token redacted):', JSON.stringify(userInfoForLog, null, 2));

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedDerivAccountType: newType }),
      });
      console.log('[AuthContext/updateSelected] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API.' }));
        console.error('[AuthContext/updateSelected] API error response data:', errorData);
        throw new Error(errorData.error || `Failed to update Deriv account type: ${response.statusText}`);
      }

      const updatedSettings = await response.json();
      console.log('[AuthContext/updateSelected] API response data (updatedSettings):', JSON.stringify(updatedSettings, null, 2));

      console.log('[AuthContext/updateSelected] Setting selectedDerivAccountType to:', updatedSettings.selectedDerivAccountType);
      setSelectedDerivAccountType(updatedSettings.selectedDerivAccountType as 'demo' | 'real');

      console.log('[AuthContext/updateSelected] Setting derivDemoAccountId to:', updatedSettings.derivDemoAccountId);
      setDerivDemoAccountId(updatedSettings.derivDemoAccountId || null);

      console.log('[AuthContext/updateSelected] Setting derivRealAccountId to:', updatedSettings.derivRealAccountId);
      setDerivRealAccountId(updatedSettings.derivRealAccountId || null);

      const newDemoBalance = typeof updatedSettings.derivDemoBalance === 'number' ? updatedSettings.derivDemoBalance : DEFAULT_PAPER_BALANCE;
      const newRealBalance = typeof updatedSettings.derivRealBalance === 'number' ? updatedSettings.derivRealBalance : DEFAULT_LIVE_BALANCE;

      console.log('[AuthContext/updateSelected] Setting derivDemoBalance to:', newDemoBalance);
      setDerivDemoBalance(newDemoBalance);
      console.log('[AuthContext/updateSelected] Setting derivRealBalance to:', newRealBalance);
      setDerivRealBalance(newRealBalance);

      if (updatedSettings.selectedDerivAccountType === 'demo') {
        console.log(`[AuthContext/updateSelected] Setting paperBalance to (demo): ${newDemoBalance}, liveBalance to (real): ${newRealBalance}`);
        setPaperBalance(newDemoBalance);
        setLiveBalance(newRealBalance);
      } else if (updatedSettings.selectedDerivAccountType === 'real') {
        console.log(`[AuthContext/updateSelected] Setting liveBalance to (real): ${newRealBalance}, paperBalance to (demo): ${newDemoBalance}`);
        setLiveBalance(newRealBalance);
        setPaperBalance(newDemoBalance);
      }

      console.log('[AuthContext/updateSelected] Updating userInfo with new settings.');
      setUserInfo(prevUserInfo => prevUserInfo ? ({
        ...prevUserInfo,
        selectedDerivAccountType: updatedSettings.selectedDerivAccountType,
        derivDemoAccountId: updatedSettings.derivDemoAccountId || null,
        derivRealAccountId: updatedSettings.derivRealAccountId || null,
        derivDemoBalance: newDemoBalance,
        derivRealBalance: newRealBalance,
      }) : null);

    } catch (error) {
      console.error('[AuthContext/updateSelected] Error during API call or state update:', error);
    }
  }, [userInfo, currentAuthMethod]);

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
        setPaperBalance,
        liveBalance,  
        setLiveBalance,
        derivDemoBalance,
        derivLiveBalance: derivRealBalance,
        derivDemoAccountId,
        derivRealAccountId,
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
