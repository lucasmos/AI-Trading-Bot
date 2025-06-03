'use client';

import { Suspense, useEffect, useState } from 'react'; // Added Suspense
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
// You might want to add some UI components for loading/error display
// import { Loader, Alert } from '@/components/ui';

// Inner component containing the actual logic
function DerivCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); // useSearchParams is used here
  const [message, setMessage] = useState<string>('Processing Deriv login...');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const processDerivLogin = async () => {
      // searchParams should be available here as Suspense wraps this component
      const token1 = searchParams.get('token1');
      const acct1 = searchParams.get('acct1'); // May be useful for context or logging
      console.log(`[DerivCallbackContent] Token: ${token1}, Account: ${acct1}`);

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
          console.error('[DerivCallbackContent] API validation failed:', data);
          setError(data.error || `Failed to validate Deriv session. Server responded with status ${apiResponse.status}.`);
          setIsLoading(false);
          return;
        }

        setMessage('Deriv session validated. Signing you in to the application...');
        console.log('[DerivCallbackContent] API validation successful, data:', data);

        const { derivUserId, email, name } = data;

        if (!derivUserId || !email) {
          console.error('[DerivCallbackContent] Essential user details (ID or Email) not received from server validation response:', data);
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

        console.log('[DerivCallbackContent] NextAuth signIn result:', signInResult);

        if (signInResult?.ok) {
          setMessage('Successfully signed in with Deriv! Redirecting to dashboard...');
          setTimeout(() => {
            router.push('/');
          }, 1000);
        } else {
          setError(signInResult?.error || 'Failed to sign in using Deriv credentials.');
          setIsLoading(false);
        }
      } catch (e: any) {
        console.error('[DerivCallbackContent] Deriv callback processing error:', e);
        setError(e.message || 'An unexpected error occurred during Deriv login processing.');
        setIsLoading(false);
      }
    };

    // Check if searchParams is actually available.
    // The Suspense boundary ensures this component doesn't render until searchParams is ready.
    // However, direct use in useEffect without it being a dependency might still be tricky if its instance changes.
    // For now, relying on Suspense to ensure it's ready when processDerivLogin is called.
    // An alternative is to pass searchParams to processDerivLogin or make it a dep.
    // Given it's from a hook within the same component, its identity should be stable for the component's lifecycle.
    processDerivLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array as router and searchParams are from hooks within this component and stable.

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
        </div>
      )}
    </div>
  );
}

// Default exported page component wraps the content in Suspense
export default function DerivCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
        <h1>Loading Deriv Login...</h1>
        <p>Please wait while we process your Deriv login information.</p>
        {/* You could add a simple spinner here if you have one without external dependencies or just text */}
      </div>
    }>
      <DerivCallbackContent />
    </Suspense>
  );
}
