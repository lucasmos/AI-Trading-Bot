'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
// You might want to add some UI components for loading/error display
// import { Loader, Alert } from '@/components/ui';

export default function DerivCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string>('Processing Deriv login...');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const processDerivLogin = async () => {
      // Ensure searchParams is available before trying to get values
      if (!searchParams) {
        setMessage('Waiting for callback parameters...');
        // Optional: Add a small delay or a retry mechanism if searchParams can be null initially
        // For now, this will just re-run if searchParams object itself changes.
        return;
      }

      const token1 = searchParams.get('token1');
      const acct1 = searchParams.get('acct1'); // May be useful for context or logging
      console.log(`[DerivCallback] Token: ${token1}, Account: ${acct1}`);


      if (!token1) {
        setError('Invalid Deriv callback: Missing token from Deriv.');
        setIsLoading(false);
        return;
      }

      setMessage('Validating Deriv session with the server...');
      try {
        const apiResponse = await fetch('/api/deriv/authorize-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ derivAccessToken: token1 }),
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
          console.error('[DerivCallback] API validation failed:', data);
          setError(data.error || `Failed to validate Deriv session. Server responded with status ${apiResponse.status}.`);
          setIsLoading(false);
          return;
        }

        setMessage('Deriv session validated. Signing you in to the application...');
        console.log('[DerivCallback] API validation successful, data:', data);

        const { derivUserId, email, name } = data;

        if (!derivUserId || !email) {
          console.error('[DerivCallback] Essential user details (ID or Email) not received from server validation response:', data);
          setError('Essential user details (ID or Email) not received from server after Deriv validation.');
          setIsLoading(false);
          return;
        }

        const signInResult = await signIn('deriv-credentials', {
          redirect: false,
          derivUserId: String(derivUserId),
          email: email,
          name: name || '',
          accessToken: token1,
        });

        console.log('[DerivCallback] NextAuth signIn result:', signInResult);

        if (signInResult?.ok) {
          setMessage('Successfully signed in with Deriv! Redirecting to dashboard...');
          // Add a small delay for the message to be visible before redirecting
          setTimeout(() => {
            router.push('/'); // Or your desired redirect path
          }, 1000);
        } else {
          setError(signInResult?.error || 'Failed to sign in using Deriv credentials.');
          setIsLoading(false);
        }
      } catch (e: any) {
        console.error('[DerivCallback] Deriv callback processing error:', e);
        setError(e.message || 'An unexpected error occurred during Deriv login processing.');
        setIsLoading(false);
      }
    };

    processDerivLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Removed router from deps as it's stable, only re-run if searchParams changes.

  // Basic UI for loading, error, and success messages
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
      <h1>Deriv Login Processing</h1>
      {isLoading && (
        <>
          {/* Consider adding a spinner component here */}
          <p>Loading...</p>
          <p>{message}</p>
        </>
      )}
      {error && !isLoading && (
        <div style={{ color: 'red', border: '1px solid red', padding: '20px', borderRadius: '5px', backgroundColor: '#ffebee' }}>
          <h2>Login Failed</h2>
          <p>{error}</p>
          <p style={{ marginTop: '20px' }}>
            <a href="/auth/login" style={{ color: 'blue', textDecoration: 'underline' }}>
              Try login again
            </a>
          </p>
        </div>
      )}
      {!isLoading && !error && (
        <div style={{ color: 'green' }}>
          <p>{message}</p>
          {/* This message is usually seen briefly before redirection */}
        </div>
      )}
    </div>
  );
}
