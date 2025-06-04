'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context'; // Kept for handleMockLogin
import type { UserInfo } from '@/types';
import { useRouter } from 'next/navigation'; // Ensure this is uncommented and present
// import { signIn } from 'next-auth/react'; // Removed as it's no longer used for Deriv direct login
// import { useRouter } from 'next/navigation'; // Removed
import { LogIn } from 'lucide-react';
import Link from 'next/link';

export default function DerivLoginPage() {
  const { login } = useAuth(); // Use login from AuthContext
  const router = useRouter(); // Ensure this is present

  const handleMockLogin = () => {
    // Simulate a successful Deriv OAuth login
    const mockUser: UserInfo = {
      id: 'deriv-user-' + Math.random().toString(36).substring(2, 8), // More unique ID
      name: 'Demo Deriv Trader',
      email: 'demo.trader@example.com',
      authMethod: 'deriv', // Set authMethod to 'deriv'
      derivDemoAccountId: 'VRTC' + Math.floor(100000 + Math.random() * 900000), 
      derivRealAccountId: 'CR' + Math.floor(100000 + Math.random() * 900000),
      derivDemoBalance: 10000,
      derivRealBalance: 500, // Example real balance
    };
    // Call login with redirect option
    login(mockUser, 'deriv', { redirect: true });
  };

  const handleRealDerivLogin = () => {
    const derivAppId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
    const nextAuthUrl = process.env.NEXT_PUBLIC_NEXTAUTH_URL; // Get NEXTAUTH_URL

    if (!derivAppId || !nextAuthUrl) {
      console.error("Deriv App ID or NEXTAUTH_URL is not configured.");
      alert("Deriv login is currently unavailable. Please try again later.");
      return;
    }

    // Construct the redirect_uri for our custom Deriv OAuth callback API route
    const redirectUri = `${nextAuthUrl}/api/auth/deriv/callback`;

    // Construct the Deriv OAuth URL as per their documentation
    const derivOauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${derivAppId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    router.push(derivOauthUrl); // Redirect to Deriv OAuth
  };

  return (
    // AuthLayout will provide the centering and max-width
    <Card className="w-full shadow-xl"> 
      <CardHeader className="text-center">
        <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle className="text-3xl">Login with Deriv</CardTitle>
        <CardDescription>Securely connect your Deriv account to DerivAI Lite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button
          onClick={handleRealDerivLogin}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-lg py-6"
        >
          <LogIn className="mr-2 h-5 w-5" />
          Login with Deriv (Actual)
        </Button>

        <hr /> 

        <p className="text-sm text-muted-foreground text-center">
          Alternatively, you can use the simulated login for demonstration purposes:
        </p>
        <Button
          onClick={handleMockLogin}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6"
        >
          <LogIn className="mr-2 h-5 w-5" />
          Proceed to Deriv (Simulated)
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          DerivAI Lite will not store your Deriv credentials.
        </p>
        <p className="text-center text-sm">
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Back to other login options
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
