// src/app/auth/deriv/process-login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast'; // Assuming this hook exists

export default function ProcessDerivLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const derivUserId = searchParams.get('derivUserId');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const accessToken = searchParams.get('accessToken');
    const error = searchParams.get('error'); // Potential error from the callback

    if (error) {
      toast({
        title: 'Deriv Login Error',
        description: `Failed during Deriv callback: ${error}`,
        variant: 'destructive',
      });
      router.replace('/auth/login?error=deriv_callback_failed');
      return;
    }

    if (derivUserId && email && name && accessToken) {
      const performSignIn = async () => {
        const result = await signIn('deriv-credentials', {
          redirect: false, // Handle redirect manually
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
          router.replace('/'); // Redirect to homepage or dashboard
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
    } else {
      // Handle missing parameters, maybe redirect to login with an error
      toast({
        title: 'Deriv Login Error',
        description: 'Incomplete information received from Deriv. Please try again.',
        variant: 'destructive',
      });
      router.replace('/auth/login?error=deriv_missing_params');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, toast]); // Ensure all dependencies using searchParams are listed

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
