'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

function FinalizeDerivLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const derivUserId = searchParams.get('derivUserId');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const accessToken = searchParams.get('accessToken');

    if (derivUserId && email && accessToken) {
      console.log('[FinalizeDerivLogin] Attempting to signIn with deriv-credentials:', { derivUserId, email, name, accessToken });
      signIn('deriv-credentials', {
        redirect: false, // Handle redirect manually
        derivUserId,
        email,
        name: name || '', // Ensure name is at least an empty string
        accessToken,
      }).then(response => {
        if (response?.ok && !response?.error) {
          console.log('[FinalizeDerivLogin] signIn successful, redirecting to home.');
          router.push('/'); // Or your desired dashboard path
        } else {
          console.error('[FinalizeDerivLogin] next-auth signIn error:', response?.error);
          router.push(`/auth/login?error=DerivSigninFailed&message=${encodeURIComponent(response?.error || 'Unknown error')}`);
        }
      }).catch(error => {
        console.error('[FinalizeDerivLogin] signIn exception:', error);
        router.push(`/auth/login?error=DerivSigninException&message=${encodeURIComponent(error?.message || 'Unknown exception')}`);
      });
    } else {
      console.error('[FinalizeDerivLogin] Missing required query parameters.');
      router.push('/auth/login?error=DerivSigninMissingParams');
    }
  }, [router, searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Finalizing your Deriv login, please wait...</p>
    </div>
  );
}

export default function FinalizeDerivPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinalizeDerivLogin />
    </Suspense>
  );
}
