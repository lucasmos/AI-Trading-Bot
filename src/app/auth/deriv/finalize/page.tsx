'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { UserInfo } from '@/types';
import { Loader2 } from 'lucide-react';

export default function DerivFinalizePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, authStatus } = useAuth();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      router.replace('/'); // Already authenticated, redirect to dashboard
      return;
    }

    if (authStatus !== 'pending') {
      return;
    }

    const derivUserId = searchParams.get('derivUserId');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const derivDemoAccountId = searchParams.get('derivDemoAccountId');
    const derivDemoBalance = searchParams.get('derivDemoBalance');
    const derivRealAccountId = searchParams.get('derivRealAccountId');
    const derivRealBalance = searchParams.get('derivRealBalance');

    if (derivUserId && email) {
      const userInfoFromDeriv: UserInfo = {
        id: derivUserId,
        email: email,
        name: name || 'Deriv User',
        authMethod: 'deriv',
        derivDemoAccountId: derivDemoAccountId || undefined,
        derivDemoBalance: derivDemoBalance ? parseFloat(derivDemoBalance) : undefined,
        derivRealAccountId: derivRealAccountId || undefined,
        derivRealBalance: derivRealBalance ? parseFloat(derivRealBalance) : undefined,
      };

      console.log('[Deriv Finalize] Calling AuthContext.login with Deriv user info and redirect option...');
      login(userInfoFromDeriv, 'deriv', { redirect: true });
    } else {
      console.error('[Deriv Finalize] Missing essential Deriv user info. Redirecting to login with error.');
      router.replace('/auth/login?error=deriv_finalize_failed');
    }
  }, [authStatus, router, searchParams, login]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-semibold text-foreground">Finalizing Deriv Login...</p>
        <p className="text-sm text-muted-foreground">Please wait while we securely log you in.</p>
      </div>
    </Suspense>
  );
} 