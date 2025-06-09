// src/app/auth/deriv/process-login/page.tsx
'use client';

import React, { useEffect, Suspense } from 'react'; // Ensure Suspense is imported
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

// This component contains the original logic that uses useSearchParams
function ProcessDerivLoginLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const derivUserId = searchParams.get('derivUserId');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const accessToken = searchParams.get('accessToken');
    const error = searchParams.get('error');

    if (error) {
      toast({
        title: 'Deriv Login Error',
        description: `Failed during Deriv callback: ${error}`,
        variant: 'destructive',
      });
      router.replace(`/auth/login?error=deriv_callback_failed&details=${encodeURIComponent(error)}`);
      return;
    }

    if (derivUserId && email && name && accessToken) {
      const performSignIn = async () => {
        const result = await signIn('deriv-credentials', {
          redirect: false,
          derivUserId,
          email,
          name,
          accessToken,
        });

        if (result?.ok && !result.error) {
          toast({
            title: 'Deriv Account Linked',
            description: 'Successfully connected your Deriv account.',
          });
          router.replace('/');
        } else {
          toast({
            title: 'Deriv Linking Failed',
            description: result?.error || 'Could not link Deriv account. Please try again.',
            variant: 'destructive',
          });
          router.replace(`/auth/login?error=${result?.error || 'deriv_linking_failed'}`);
        }
      };
      performSignIn();
    } else if (!error) { // Only show this if no other error was processed
      toast({
        title: 'Deriv Login Error',
        description: 'Incomplete information received from Deriv. Please try again.',
        variant: 'destructive',
      });
      router.replace('/auth/login?error=deriv_missing_params');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, toast]); // searchParams, router, toast are dependencies

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center">
        <p className="text-lg font-semibold">Processing Deriv Login...</p>
        <p className="text-muted-foreground">Please wait while we securely connect your Deriv account.</p>
        {/* You can add a spinner here */}
      </div>
    </div>
  );
}

// This is the new page component
export default function ProcessDerivLoginPage() {
  // The 'use client' directive is at the top of this file,
  // making the whole page a client component that uses Suspense.

  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-lg font-semibold">Loading Deriv login processor...</p>
      </div>
    }>
      <ProcessDerivLoginLogic />
    </Suspense>
  );
}
